"""TeacherAgent -- LiveKit Agent that bridges participants to Gemini Live API."""

from __future__ import annotations

import asyncio
import json
import re
import uuid
from typing import Any, Optional

from livekit import rtc

from server.agents.ta.agent import TAAgent
from server.agents.ta.models import TARequest
from server.config import settings
from server.content.templates import list_games
from server.events.helpers import publish_event
from server.events.subjects import SUBJECTS, room_subject
from server.logging import get_logger
from server.run_logger import log_teacher_prompt
from server.tools.registry import ToolRegistry
from server.tools.schemas import (
    TOOL_DEFINITIONS,
    CallerIdentity,
)

from .gemini_session import GeminiSession
from .system_prompt import build_teacher_prompt
from .voice_config import resolve_voice_config

log = get_logger("teacher:agent")

# Gemini Live input expects 16 kHz mono PCM-16
INPUT_SAMPLE_RATE = 16000
# Gemini Live output is 24 kHz mono PCM-16
OUTPUT_SAMPLE_RATE = 24000

_JSON_SCHEMA_KEY_ALIASES: dict[str, str] = {
    "additional_properties": "additionalProperties",
    "any_of": "anyOf",
    "max_items": "maxItems",
    "max_length": "maxLength",
    "max_properties": "maxProperties",
    "min_items": "minItems",
    "min_length": "minLength",
    "min_properties": "minProperties",
    "prefix_items": "prefixItems",
    "property_ordering": "propertyOrdering",
}


def _sanitize_json_schema(value: Any) -> Any:
    """Normalize JSON Schema keys for Gemini API compatibility."""
    if isinstance(value, list):
        return [_sanitize_json_schema(item) for item in value]

    if not isinstance(value, dict):
        return value

    # Unwrap anyOf from Pydantic Optional (e.g. anyOf: [{type: X}, {type: null}])
    if "anyOf" in value:
        non_null = [v for v in value["anyOf"] if v != {"type": "null"}]
        base = non_null[0] if non_null else {}
        merged = {k: v for k, v in value.items() if k != "anyOf"}
        merged.update(base)
        return _sanitize_json_schema(merged)

    sanitized: dict[str, Any] = {}
    for key, item in value.items():
        if item is None:
            continue

        if key == "properties" and isinstance(item, dict):
            sanitized["properties"] = {
                prop_name: _sanitize_json_schema(prop_schema)
                for prop_name, prop_schema in item.items()
            }
            continue

        out_key = _JSON_SCHEMA_KEY_ALIASES.get(key, key)
        sanitized[out_key] = _sanitize_json_schema(item)

    return sanitized


class TeacherAgent:
    """Orchestrates the AI Teacher:

    1. Joins a LiveKit room as participant ``ai-teacher``.
    2. Receives audio from room participants via LiveKit.
    3. Pipes audio to Gemini Live API via ``GeminiSession``.
    4. Receives Gemini audio responses and publishes them back to the LiveKit room.
    5. Handles tool calls from Gemini -- dispatches to ``ToolRegistry``.
    """

    def __init__(
        self,
        *,
        room_id: str,
        livekit_url: Optional[str] = None,
        livekit_token: Optional[str] = None,
        user_profile: Optional[dict[str, Any]] = None,
        participants: Optional[list[dict[str, Any]]] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        tool_registry: Optional[ToolRegistry] = None,
        ta_agent: Optional[TAAgent] = None,
    ) -> None:
        self._room_id = room_id
        self._livekit_url = livekit_url or settings.LIVEKIT_URL
        self._livekit_token = livekit_token or ""
        self._user_profile = user_profile or {}
        self._participants = participants or []
        self._api_key = api_key or settings.GEMINI_API_KEY
        self._model = model or settings.GEMINI_LIVE_MODEL
        self._tool_registry = tool_registry
        self._ta_agent = ta_agent

        # Participant tracking for multiplayer
        self._participant_names: dict[str, str] = {
            p.get("id", ""): p.get("name", "Unknown")
            for p in self._participants if p.get("id")
        }
        self._current_speaker: str | None = None

        self._gemini: Optional[GeminiSession] = None
        self._room: Optional[rtc.Room] = None
        self._audio_source: Optional[rtc.AudioSource] = None
        self._audio_track: Optional[rtc.LocalAudioTrack] = None
        self._running = False
        self._tasks: set[asyncio.Task[None]] = set()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Connect to LiveKit room and Gemini, then start bridging audio."""
        if self._running:
            log.warning("Already running")
            return

        self._running = True

        try:
            # 1. Build system prompt
            available_games = []
            try:
                available_games = list_games()
            except Exception as exc:
                log.warning("Could not load game catalog", error=str(exc))

            # Resolve voice + language from user profile preferences
            prefs = self._user_profile.get("preferences", {})
            voice_cfg = resolve_voice_config(
                prefs.get("voice"),
                prefs.get("language"),
            )

            # Build tool definitions for Gemini (only teacher-allowed tools)
            tool_defs = []
            for t in TOOL_DEFINITIONS:
                if "teacher" not in t.allowed_callers:
                    continue
                td: dict = {
                    "name": t.name,
                    "description": t.description,
                    "parameters_json_schema": _sanitize_json_schema(
                        t.schema_cls.model_json_schema()
                    ),
                }
                # Long-running tools are NON_BLOCKING so Gemini keeps talking
                if t.name == "request_ta_action":
                    td["behavior"] = "NON_BLOCKING"
                tool_defs.append(td)

            system_instruction = build_teacher_prompt(
                room_id=self._room_id,
                participants=self._participants,
                user_profiles=[self._user_profile] if self._user_profile else [],
                tools=tool_defs,
                available_games=available_games,
            )

            # Log system prompt
            try:
                log_teacher_prompt(
                    session_id=self._room_id,
                    prompt=system_instruction,
                    metadata={"model": self._model, "tools": [t["name"] for t in tool_defs]},
                )
            except Exception:
                log.warning("Failed to write teacher run log")

            # 2. Create Gemini session
            self._gemini = GeminiSession(
                api_key=self._api_key,
                model=self._model,
                system_instruction=system_instruction,
                tools=tool_defs,
                voice=voice_cfg["voice"],
                language=voice_cfg["language"],
                affective_dialog=settings.GEMINI_AFFECTIVE_DIALOG,
                proactive_audio=settings.GEMINI_PROACTIVE_AUDIO,
                session_id=self._room_id,
            )

            self._wire_gemini_callbacks()
            await self._gemini.connect()

            # 3. Join LiveKit room
            await self._join_livekit_room()

            log.info("Teacher agent started", room_id=self._room_id)

        except Exception as exc:
            log.error("Failed to start teacher agent", error=str(exc))
            self._running = False
            raise

    async def stop(self) -> None:
        """Disconnect from everything and clean up."""
        log.info("Stopping teacher agent", room_id=self._room_id)
        self._running = False

        # Cancel tracked background tasks
        for task in list(self._tasks):
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()

        if self._gemini:
            await self._gemini.disconnect()
            self._gemini = None

        if self._room:
            await self._room.disconnect()
            self._room = None

        self._audio_source = None
        self._audio_track = None

        log.info("Teacher agent stopped")

    def _track_task(self, task: asyncio.Task[None]) -> None:
        """Register a background task so it can be cancelled on stop()."""
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def send_text(self, text: str) -> bool:
        """Send a text message to Gemini.

        Returns True when forwarded, False when the session is unavailable.
        """
        if not self._running:
            log.warning("Teacher not running; text not sent", room_id=self._room_id)
            return False

        if not self._gemini or not self._gemini.connected:
            log.warning("Gemini unavailable; text not sent", room_id=self._room_id)
            return False

        await self._gemini.send_text(text)
        return True

    async def send_image(
        self,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
        caption: str = "This is a screenshot of the game the student currently sees.",
    ) -> bool:
        """Send an image to Gemini for visual context."""
        if not self._running or not self._gemini or not self._gemini.connected:
            return False
        await self._gemini.send_image(image_bytes, mime_type=mime_type, caption=caption)
        return True

    # ------------------------------------------------------------------
    # LiveKit room
    # ------------------------------------------------------------------

    async def _join_livekit_room(self) -> None:
        """Join the LiveKit room and set up audio I/O."""
        self._room = rtc.Room()

        # Create an audio source for publishing Gemini's audio output
        self._audio_source = rtc.AudioSource(OUTPUT_SAMPLE_RATE, 1)
        self._audio_track = rtc.LocalAudioTrack.create_audio_track(
            "teacher-voice", self._audio_source
        )

        # Wire room events
        self._room.on("track_subscribed", self._on_track_subscribed)
        self._room.on("active_speakers_changed", self._on_active_speakers_changed)

        # Connect to room
        await self._room.connect(self._livekit_url, self._livekit_token)

        # Publish the teacher's audio track
        await self._room.local_participant.publish_track(
            self._audio_track,
            rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE),
        )

        log.info("Joined LiveKit room", room_id=self._room_id)

    def _on_track_subscribed(
        self,
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        """Handle a remote audio track subscription -- pipe to Gemini."""
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return

        log.debug("Audio track subscribed", participant=participant.identity)
        audio_stream = rtc.AudioStream(track, sample_rate=INPUT_SAMPLE_RATE, num_channels=1)
        self._track_task(asyncio.create_task(self._forward_audio_to_gemini(audio_stream, participant.identity)))

    async def _forward_audio_to_gemini(
        self, audio_stream: rtc.AudioStream, participant_id: str
    ) -> None:
        """Read frames from LiveKit and send to Gemini via a decoupled queue.

        The queue prevents backpressure on audio reads if a send stalls.
        """
        queue: asyncio.Queue[bytes | None] = asyncio.Queue(maxsize=50)

        async def reader() -> None:
            try:
                async for event in audio_stream:
                    if not self._running:
                        break
                    await queue.put(event.frame.data.tobytes())
            finally:
                try:
                    queue.put_nowait(None)
                except asyncio.QueueFull:
                    pass

        reader_task = asyncio.create_task(reader())
        try:
            while True:
                data = await queue.get()
                if data is None:
                    break
                if self._gemini and self._gemini.connected:
                    await self._gemini.send_audio(data)
        except Exception as exc:
            log.error("Audio forward error", participant=participant_id, error=str(exc))
        finally:
            reader_task.cancel()
            if self._gemini and self._gemini.connected:
                try:
                    await self._gemini.send_audio_stream_end()
                except Exception:
                    pass

    # ------------------------------------------------------------------
    # Multiplayer: active speaker + participant notifications
    # ------------------------------------------------------------------

    def _on_active_speakers_changed(self, speakers: list[rtc.Participant]) -> None:
        """Send a text hint to Gemini when the active speaker changes."""
        if len(self._participant_names) <= 1:
            return
        human = [s for s in speakers if s.identity != "ai-teacher"]
        new_speaker = human[0].identity if human else None
        if new_speaker and new_speaker != self._current_speaker:
            self._current_speaker = new_speaker
            name = self._participant_names.get(new_speaker, new_speaker)
            if self._gemini and self._gemini.connected:
                self._track_task(asyncio.create_task(
                    self._gemini.send_text(f"[now speaking: {name}]")
                ))

    async def notify_participant_joined(self, user_id: str, name: str) -> None:
        """Notify the teacher that a new participant joined the room."""
        self._participant_names[user_id] = name
        if self._gemini and self._gemini.connected:
            await self._gemini.send_text(
                f"[system: {name} just joined the room. Their player ID is {user_id}. "
                f"Address them by name and welcome them!]"
            )

    async def notify_participant_left(self, user_id: str, name: str) -> None:
        """Notify the teacher that a participant left the room."""
        self._participant_names.pop(user_id, None)
        if user_id == self._current_speaker:
            self._current_speaker = None
        if self._gemini and self._gemini.connected:
            await self._gemini.send_text(f"[system: {name} has left the room]")

    # ------------------------------------------------------------------
    # Gemini callbacks
    # ------------------------------------------------------------------

    def _wire_gemini_callbacks(self) -> None:
        """Wire up GeminiSession callbacks."""
        if not self._gemini:
            return

        self._gemini.on_audio = self._on_gemini_audio
        self._gemini.on_tool_call = self._on_gemini_tool_call
        self._gemini.on_turn_complete = self._on_turn_complete
        self._gemini.on_interrupted = self._on_interrupted
        self._gemini.on_transcription = self._on_gemini_transcription
        self._gemini.on_error = self._on_gemini_error
        self._gemini.on_closed = self._on_gemini_closed

    async def _on_gemini_audio(self, audio_bytes: bytes) -> None:
        """Publish Gemini's audio response to LiveKit room."""
        if not self._audio_source:
            return
        # Create an AudioFrame from the raw PCM-16 bytes
        frame = rtc.AudioFrame(
            data=audio_bytes,
            sample_rate=OUTPUT_SAMPLE_RATE,
            num_channels=1,
            samples_per_channel=len(audio_bytes) // 2,
        )
        await self._audio_source.capture_frame(frame)

    def _on_gemini_tool_call(self, function_calls: list[Any]) -> None:
        """Handle tool calls from Gemini -- dispatch asynchronously.

        NON_BLOCKING tools (e.g. request_ta_action) don't need an immediate
        response — Gemini keeps talking. Blocking tools get their response
        sent back when execution completes.
        """
        for fc in function_calls:
            if not fc.id or not fc.name:
                continue
            log.info("Dispatching tool call", name=fc.name, id=fc.id)
            self._track_task(asyncio.create_task(self._execute_tool_call(fc)))

    async def _execute_tool_call(self, fc: Any) -> None:
        """Execute a single tool call through the registry or direct TA dispatch."""
        try:
            name = fc.name
            args = dict(fc.args) if fc.args else {}

            # Special case: request_ta_action goes directly to the TA agent
            if name == "request_ta_action" and self._ta_agent:
                await self._dispatch_ta_action(fc.id, args)
                return

            # All other tools go through the registry
            if self._tool_registry:
                caller = CallerIdentity(
                    id="ai-teacher",
                    role="teacher",
                    session_id=self._room_id,
                )
                response = await self._tool_registry.execute(name, args, caller)

                # Send tool response back to Gemini so it can use the result
                if self._gemini and self._gemini.connected:
                    await self._gemini.send_tool_response(
                        call_id=fc.id,
                        name=name,
                        response={"success": response.success, "data": response.data, "error": response.error},
                    )

                # Publish result to Redis for SSE delivery
                channel = room_subject(SUBJECTS["UI_CONTROL"], self._room_id)
                await publish_event(
                    channel=channel,
                    event_type="tool_result",
                    payload={
                        "tool": name,
                        "call_id": fc.id,
                        "success": response.success,
                        "data": response.data,
                        "error": response.error,
                    },
                    source_id="ai-teacher",
                )
            else:
                log.warning("No tool registry configured", tool=name)

        except Exception as exc:
            log.error("Tool call execution failed", name=fc.name, error=str(exc))

    async def _dispatch_ta_action(self, call_id: str, args: dict[str, Any]) -> None:
        """Forward a request_ta_action tool call to the TA agent."""
        if not self._ta_agent:
            log.warning("No TA agent configured")
            return

        context = args.get("context", {})
        if not isinstance(context, dict):
            context = {"description": str(context)}

        request = TARequest(
            request_id=f"ta-{uuid.uuid4().hex[:8]}",
            intent=args.get("intent", ""),
            template_id=args.get("template_id") or args.get("templateId"),
            context=context,
            room_id=self._room_id,
            user_profiles=[self._user_profile] if self._user_profile else [],
        )

        try:
            response = await self._ta_agent.handle_request(request)

            # Send result back to Gemini with WHEN_IDLE scheduling
            # so it learns the outcome without interrupting current speech
            if self._gemini and self._gemini.connected:
                tool_result: dict[str, Any] = {
                    "success": response.success,
                    "request_id": response.request_id,
                    "error": response.error,
                }
                if response.filled_data:
                    tool_result["game_content"] = response.filled_data
                await self._gemini.send_tool_response(
                    call_id=call_id,
                    name="request_ta_action",
                    response=tool_result,
                    scheduling="WHEN_IDLE",
                )

            # Note: ta.content_ready is already published by the TA request_handler pipeline.

            log.info(
                "TA action completed",
                request_id=response.request_id,
                success=response.success,
            )
        except Exception as exc:
            log.error("TA dispatch failed", call_id=call_id, error=str(exc))

    _GARBAGE_TRANSCRIPTION_RE = re.compile(r"<ctrl\d+>")

    def _on_gemini_transcription(self, source: str, text: str) -> None:
        """Publish transcription via LiveKit data channel (lower latency than Redis→SSE)."""
        if not self._room:
            return
        text = self._GARBAGE_TRANSCRIPTION_RE.sub("", text).strip()
        if not text:
            return
        data = json.dumps({"source": source, "text": text}).encode()
        self._track_task(
            asyncio.create_task(
                self._room.local_participant.publish_data(data, topic="transcript")
            )
        )

    def _on_turn_complete(self) -> None:
        log.debug("Turn complete")

    def _on_interrupted(self) -> None:
        log.debug("Interrupted")

    def _on_gemini_error(self, exc: Exception) -> None:
        log.error("Gemini session error", error=str(exc))

    def _on_gemini_closed(self) -> None:
        log.info("Gemini session closed")
        if self._running:
            log.warning("Gemini closed unexpectedly while agent is running")
