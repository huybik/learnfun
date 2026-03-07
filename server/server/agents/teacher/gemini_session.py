"""GeminiSession -- async wrapper around google-genai Live streaming API.

Supports session management (compression + resumption),
and auto-reconnect on GoAway or unexpected disconnects.
"""

from __future__ import annotations

import asyncio
import base64
from typing import Any, Callable, Optional

from google import genai
from google.genai import types

from server.logging import get_logger
from server.run_logger import log_teacher_event

log = get_logger("gemini_session")

# Max reconnect attempts before giving up
MAX_RECONNECT_ATTEMPTS = 3
RECONNECT_DELAY_S = 2.0


class GeminiSession:
    """Wraps the ``google.genai`` async Live API into a simple interface.

    Connects to Gemini Live, sends audio/text, and yields events:
    audio chunks, tool calls, turn completions, and transcriptions.

    Features:
    - Context window compression (sliding window) for sessions beyond 15 min
    - Session resumption with handles for reconnect across drops
    - GoAway handling with automatic reconnection
    - Affective dialog and proactive audio support
    """

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        system_instruction: str,
        tools: list[dict[str, Any]],
        voice: Optional[str] = None,
        language: Optional[str] = None,
        affective_dialog: bool = True,
        proactive_audio: bool = True,
        session_id: str = "",
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._system_instruction = system_instruction
        self._session_id = session_id
        self._tools = tools
        self._voice = voice
        self._language = language
        self._affective_dialog = affective_dialog
        self._proactive_audio = proactive_audio

        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(api_version="v1alpha"),
        )
        self._session: Any = None  # genai AsyncSession
        self._session_ctx: Any = None  # async context manager
        self._connected = False
        self._receive_task: Optional[asyncio.Task[None]] = None
        self._reconnecting = False

        # Session resumption state
        self._session_handle: Optional[str] = None
        self._session_resumable = False

        # Callbacks (set by TeacherAgent)
        self.on_audio: Optional[Callable[[bytes], Any]] = None
        self.on_tool_call: Optional[Callable[[list[Any]], None]] = None
        self.on_turn_complete: Optional[Callable[[], None]] = None
        self.on_interrupted: Optional[Callable[[], None]] = None
        self.on_setup_complete: Optional[Callable[[], None]] = None
        self.on_error: Optional[Callable[[Exception], None]] = None
        self.on_closed: Optional[Callable[[], None]] = None
        self.on_transcription: Optional[Callable[[str, str], None]] = None

    @property
    def connected(self) -> bool:
        return self._connected

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def _build_config(self) -> types.LiveConnectConfig:
        """Build LiveConnectConfig with session management features."""
        # Function declarations
        function_declarations: list[types.FunctionDeclaration] = []
        for t in self._tools:
            declaration: dict[str, Any] = {
                "name": t["name"],
                "description": t["description"],
                "behavior": t.get("behavior"),
            }

            if t.get("parameters_json_schema") is not None:
                declaration["parameters_json_schema"] = t.get("parameters_json_schema")
            elif t.get("parameters") is not None:
                # Backward compatibility: prefer JSON schema path for dict payloads.
                params = t.get("parameters")
                if isinstance(params, dict):
                    declaration["parameters_json_schema"] = params
                else:
                    declaration["parameters"] = params

            function_declarations.append(types.FunctionDeclaration(**declaration))

        # Speech config
        speech_config = None
        if self._voice:
            speech_config = types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=self._voice,
                    )
                )
            )

        # Session resumption (use saved handle if reconnecting)
        session_resumption = types.SessionResumptionConfig(
            handle=self._session_handle,
        )

        return types.LiveConnectConfig(
            system_instruction=types.Content(
                parts=[types.Part(text=self._system_instruction)]
            ),
            tools=[types.Tool(function_declarations=function_declarations)]
            if function_declarations
            else None,
            response_modalities=["AUDIO"],
            speech_config=speech_config,
            output_audio_transcription=types.AudioTranscriptionConfig(),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            context_window_compression=types.ContextWindowCompressionConfig(
                sliding_window=types.SlidingWindow(),
            ),
            session_resumption=session_resumption,
            enable_affective_dialog=self._affective_dialog,
            proactivity=types.ProactivityConfig(
                proactive_audio=self._proactive_audio,
            ),
        )

    async def connect(self) -> None:
        """Open the async streaming connection to Gemini Live API."""
        if self._session is not None:
            log.warning("Already connected")
            return

        log.info("Connecting to Gemini Live API", model=self._model)

        config = self._build_config()

        try:
            self._session_ctx = self._client.aio.live.connect(
                model=self._model,
                config=config,
            )
            self._session = await self._session_ctx.__aenter__()
            self._connected = True
            is_resuming = self._session_handle is not None
            log.info("Session established", resumed=is_resuming)

            if self.on_setup_complete:
                self.on_setup_complete()

            # Start background receive loop
            self._receive_task = asyncio.create_task(self._receive_loop())
        except Exception as exc:
            log.error("Connection failed", error=str(exc))
            self._session = None
            self._connected = False
            raise

    async def disconnect(self) -> None:
        """Close the session."""
        self._reconnecting = False  # prevent auto-reconnect during intentional disconnect

        if self._receive_task and not self._receive_task.done():
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
            self._receive_task = None

        if self._session_ctx is not None:
            try:
                await self._session_ctx.__aexit__(None, None, None)
            except Exception:
                pass
            self._session_ctx = None
            self._session = None

        self._connected = False
        log.info("Disconnected")

        if self.on_closed:
            self.on_closed()

    async def _reconnect(self) -> None:
        """Reconnect using saved session handle."""
        if not self._session_handle or not self._session_resumable:
            log.warning(
                "Cannot reconnect",
                has_handle=self._session_handle is not None,
                resumable=self._session_resumable,
            )
            return

        log.info("Reconnecting with session handle")

        # Close current session without triggering on_closed
        if self._session_ctx is not None:
            try:
                await self._session_ctx.__aexit__(None, None, None)
            except Exception:
                pass
            self._session_ctx = None
            self._session = None
        self._connected = False

        for attempt in range(1, MAX_RECONNECT_ATTEMPTS + 1):
            try:
                await asyncio.sleep(RECONNECT_DELAY_S * attempt)
                await self.connect()
                log.info("Reconnected successfully", attempt=attempt)
                return
            except Exception as exc:
                log.warning("Reconnect attempt failed", attempt=attempt, error=str(exc))

        log.error("All reconnect attempts exhausted")
        if self.on_error:
            self.on_error(RuntimeError("Failed to reconnect after max attempts"))
        if self.on_closed:
            self.on_closed()

    # ------------------------------------------------------------------
    # Sending
    # ------------------------------------------------------------------

    async def send_audio(self, pcm_bytes: bytes, mime_type: str = "audio/pcm;rate=16000") -> None:
        """Send raw PCM audio to Gemini as realtime input."""
        if not self._session:
            return
        await self._session.send_realtime_input(
            media=types.Blob(data=pcm_bytes, mime_type=mime_type)
        )

    async def send_audio_stream_end(self) -> None:
        """Signal end of audio stream to flush Gemini's buffered audio."""
        if not self._session:
            return
        await self._session.send_realtime_input(audio_stream_end=True)
        log.debug("Sent audio stream end")

    async def send_text(self, text: str) -> None:
        """Send a text message as client content."""
        if not self._session:
            return
        await self._session.send_client_content(
            turns=types.Content(role="user", parts=[types.Part(text=text)]),
            turn_complete=True,
        )
        log.debug("Sent text", text=text[:120])

    async def send_tool_response(
        self,
        call_id: str,
        name: str,
        response: dict[str, Any],
        scheduling: Optional[str] = None,
    ) -> None:
        """Send a tool response back to Gemini.

        For NON_BLOCKING tools, use scheduling to control when Gemini
        processes the result: INTERRUPT, WHEN_IDLE, or SILENT.
        """
        if not self._session:
            return

        sched = None
        if scheduling:
            sched = types.FunctionResponseScheduling(scheduling)

        await self._session.send_tool_response(
            function_responses=[
                types.FunctionResponse(
                    id=call_id,
                    name=name,
                    response=response,
                    scheduling=sched,
                )
            ]
        )
        log.info("Sent tool response", call_id=call_id, name=name, scheduling=scheduling)

    # ------------------------------------------------------------------
    # Receive loop
    # ------------------------------------------------------------------

    async def _receive_loop(self) -> None:
        """Read messages from the Gemini session until closed."""
        try:
            while self._session is not None:
                saw_message = False

                # google-genai receive() yields one complete model turn,
                # then returns. Keep calling it to stay live across turns.
                async for msg in self._session.receive():
                    saw_message = True
                    await self._handle_message(msg)

                if self._session is None or not self._connected:
                    break

                if not saw_message:
                    log.info("Receive stream ended")
                    break
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.error("Receive loop error", error=str(exc))
            if self.on_error:
                self.on_error(exc)

        if self._connected:
            self._connected = False
            if not self._reconnecting and self.on_closed:
                self.on_closed()

    def _log_msg(self, event_type: str, data: Any) -> None:
        """Best-effort log a teacher event to runs/."""
        try:
            log_teacher_event(self._session_id, event_type, data)
        except Exception:
            pass

    async def _handle_message(self, msg: Any) -> None:
        """Process a single server message."""
        # Usage metadata — log token consumption
        if msg.usage_metadata:
            um = msg.usage_metadata
            log.debug(
                "Usage",
                prompt_tokens=um.prompt_token_count,
                response_tokens=um.response_token_count,
                total_tokens=um.total_token_count,
            )
            self._log_msg("usage", {
                "prompt_tokens": um.prompt_token_count,
                "response_tokens": um.response_token_count,
                "total_tokens": um.total_token_count,
            })

        # Session resumption update — save handle for reconnects
        if msg.session_resumption_update:
            update = msg.session_resumption_update
            if update.new_handle:
                self._session_handle = update.new_handle
                self._session_resumable = bool(update.resumable)
                log.debug("Session handle updated", resumable=update.resumable)
            return

        # GoAway — server is about to close, reconnect gracefully
        if msg.go_away is not None:
            time_left = getattr(msg.go_away, "time_left", None)
            log.info("GoAway received, will reconnect", time_left=time_left)
            self._reconnecting = True
            asyncio.create_task(self._reconnect())
            return

        # Tool calls
        if msg.tool_call:
            fc_list = msg.tool_call.function_calls or []
            if fc_list:
                self._log_msg("tool_call", [
                    {"id": fc.id, "name": fc.name, "args": dict(fc.args) if fc.args else {}}
                    for fc in fc_list
                ])
                if self.on_tool_call:
                    self.on_tool_call(fc_list)
            return

        # Tool call cancellation
        if msg.tool_call_cancellation:
            log.info("Tool call cancellation", ids=msg.tool_call_cancellation.ids)
            return

        # Setup complete
        if msg.setup_complete:
            log.info("Setup complete")
            if self.on_setup_complete:
                self.on_setup_complete()
            return

        # Server content
        server_content = msg.server_content
        if server_content is None:
            return

        # Interrupted
        if server_content.interrupted:
            if self.on_interrupted:
                self.on_interrupted()
            return

        # Generation complete (distinct from turn_complete)
        if getattr(server_content, "generation_complete", False):
            log.debug("Generation complete")

        # Turn complete
        if server_content.turn_complete:
            if self.on_turn_complete:
                self.on_turn_complete()
            return

        # Transcriptions
        if server_content.output_transcription and server_content.output_transcription.text:
            self._log_msg("transcription_ai", {"text": server_content.output_transcription.text})
            if self.on_transcription:
                self.on_transcription("ai", server_content.output_transcription.text)

        if server_content.input_transcription and server_content.input_transcription.text:
            self._log_msg("transcription_user", {"text": server_content.input_transcription.text})
            if self.on_transcription:
                self.on_transcription("user", server_content.input_transcription.text)

        # Audio parts from model turn
        if server_content.model_turn and server_content.model_turn.parts:
            for part in server_content.model_turn.parts:
                if (
                    part.inline_data
                    and part.inline_data.mime_type
                    and part.inline_data.mime_type.startswith("audio/pcm")
                ):
                    audio_bytes = part.inline_data.data
                    if audio_bytes and self.on_audio:
                        if isinstance(audio_bytes, str):
                            audio_bytes = base64.b64decode(audio_bytes)
                        result = self.on_audio(audio_bytes)
                        if asyncio.iscoroutine(result):
                            await result
