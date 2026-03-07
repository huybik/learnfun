"""GeminiSession -- async wrapper around google-genai Live streaming API."""

from __future__ import annotations

import asyncio
import base64
from typing import Any, Optional

from google import genai
from google.genai import types

from server.logging import get_logger

log = get_logger("gemini_session")


class GeminiSession:
    """Wraps the ``google.genai`` async Live API into a simple interface.

    Connects to Gemini Live, sends audio/text, and yields events:
    audio chunks, tool calls, turn completions, and transcriptions.
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
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._system_instruction = system_instruction
        self._tools = tools
        self._voice = voice
        self._language = language

        self._client = genai.Client(api_key=api_key)
        self._session: Any = None  # genai AsyncSession
        self._connected = False
        self._receive_task: Optional[asyncio.Task[None]] = None

        # Callbacks (set by TeacherAgent)
        self.on_audio: Optional[Any] = None  # (bytes) -> None
        self.on_tool_call: Optional[Any] = None  # (list[FunctionCall]) -> None
        self.on_turn_complete: Optional[Any] = None  # () -> None
        self.on_interrupted: Optional[Any] = None  # () -> None
        self.on_setup_complete: Optional[Any] = None  # () -> None
        self.on_error: Optional[Any] = None  # (Exception) -> None
        self.on_closed: Optional[Any] = None  # () -> None
        self.on_transcription: Optional[Any] = None  # (source, text) -> None

    @property
    def connected(self) -> bool:
        return self._connected

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def connect(self) -> None:
        """Open the async streaming connection to Gemini Live API."""
        if self._session is not None:
            log.warning("Already connected")
            return

        log.info("Connecting to Gemini Live API", model=self._model)

        # Build function declarations for Gemini
        function_declarations = []
        for t in self._tools:
            function_declarations.append(
                types.FunctionDeclaration(
                    name=t["name"],
                    description=t["description"],
                    parameters=t.get("parameters"),
                )
            )

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

        config = types.LiveConnectConfig(
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
        )

        try:
            self._session = await self._client.aio.live.connect(
                model=self._model,
                config=config,
            )
            self._connected = True
            log.info("Session established")

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
        if self._receive_task and not self._receive_task.done():
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
            self._receive_task = None

        if self._session is not None:
            try:
                await self._session.close()
            except Exception:
                pass
            self._session = None

        self._connected = False
        log.info("Disconnected")

        if self.on_closed:
            self.on_closed()

    # ------------------------------------------------------------------
    # Sending
    # ------------------------------------------------------------------

    async def send_audio(self, pcm_bytes: bytes, mime_type: str = "audio/pcm;rate=16000") -> None:
        """Send raw PCM audio to Gemini as realtime input."""
        if not self._session:
            return
        b64 = base64.b64encode(pcm_bytes).decode("ascii")
        await self._session.send_realtime_input(
            media=types.Blob(data=b64, mime_type=mime_type)
        )

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
    ) -> None:
        """Send a tool response back to Gemini."""
        if not self._session:
            return
        await self._session.send_tool_response(
            function_responses=[
                types.FunctionResponse(id=call_id, name=name, response=response)
            ]
        )
        log.info("Sent tool response", call_id=call_id, name=name)

    # ------------------------------------------------------------------
    # Receive loop
    # ------------------------------------------------------------------

    async def _receive_loop(self) -> None:
        """Read messages from the Gemini session until closed."""
        try:
            async for msg in self._session:
                await self._handle_message(msg)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.error("Receive loop error", error=str(exc))
            if self.on_error:
                self.on_error(exc)
        finally:
            self._connected = False
            if self.on_closed:
                self.on_closed()

    async def _handle_message(self, msg: Any) -> None:
        """Process a single server message."""
        # Tool calls
        if msg.tool_call:
            fc_list = msg.tool_call.function_calls or []
            if fc_list and self.on_tool_call:
                self.on_tool_call(fc_list)
            return

        # Tool call cancellation (log only)
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

        # Turn complete
        if server_content.turn_complete:
            if self.on_turn_complete:
                self.on_turn_complete()
            return

        # Transcriptions
        if server_content.output_transcription and server_content.output_transcription.text:
            if self.on_transcription:
                self.on_transcription("ai", server_content.output_transcription.text)

        if server_content.input_transcription and server_content.input_transcription.text:
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
                        # Data comes as base64 string from the SDK
                        if isinstance(audio_bytes, str):
                            audio_bytes = base64.b64decode(audio_bytes)
                        self.on_audio(audio_bytes)
