"""PCM conversion helpers for audio piped between LiveKit and Gemini."""

from __future__ import annotations

import base64
import struct


def pcm16_to_base64(pcm_bytes: bytes) -> str:
    """Encode raw PCM-16 bytes to a base64 string (for Gemini realtime input)."""
    return base64.b64encode(pcm_bytes).decode("ascii")


def base64_to_pcm16(b64: str) -> bytes:
    """Decode a base64 string back to raw PCM-16 bytes."""
    return base64.b64decode(b64)


def pcm16_to_float32(pcm_bytes: bytes) -> list[float]:
    """Convert 16-bit signed PCM bytes to float32 samples in [-1.0, 1.0]."""
    sample_count = len(pcm_bytes) // 2
    samples = struct.unpack(f"<{sample_count}h", pcm_bytes[: sample_count * 2])
    return [s / 32768.0 for s in samples]


def float32_to_pcm16(samples: list[float]) -> bytes:
    """Convert float32 samples in [-1.0, 1.0] to 16-bit signed PCM bytes."""
    clamped = [max(-1.0, min(1.0, s)) for s in samples]
    int16 = [int(s * 0x7FFF) if s >= 0 else int(s * 0x8000) for s in clamped]
    return struct.pack(f"<{len(int16)}h", *int16)
