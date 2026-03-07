# LearnFun — Project Context

Interactive learning platform: AI teacher + teaching assistant guide students through lessons and games in real-time rooms.

## Architecture

**Server** (`server/server/`) — Python FastAPI
- `main.py` — app lifespan, mounts all routers
- `api/` — REST/SSE endpoints
  - `router.py` — route registration
  - `tokens.py` — JWT + LiveKit token generation
  - `room_manager.py` — in-memory room lifecycle (create/join/close)
  - `join.py`, `session.py`, `token.py` — session/join flows
  - `events.py` — SSE streaming to browser via Redis subscription
  - `ta.py` — TA agent endpoint (uses `app.state.ta_agent`)
  - `bundles.py`, `health.py`, `logs.py`
- `agents/teacher/` — LiveKit-based teacher agent
  - `agent.py` — TeacherAgent (LiveKit Agent, Gemini Live voice)
  - `gemini_session.py` — Gemini Live API session wrapper
  - `system_prompt.py`, `voice_config.py`
- `agents/ta/` — Teaching Assistant agent (Gemini Flash)
  - `agent.py` — TAAgent lifecycle, delegates to request_handler
  - `request_handler.py` — orchestration pipeline + personalization
  - `content_generator.py` — Gemini generation, template resolution
  - `models.py` — TARequest, TAResponse, GenerateParams
- `events/` — event system
  - `redis_bridge.py` — Redis pub/sub connection
  - `bus.py` — in-process event bus
  - `helpers.py` — `publish_event()` + `serialize_event()` (shared envelope)
  - `models.py` — Participant, Room (event-only, not persisted)
  - `subjects.py` — event channel definitions
- `storage/` — PostgreSQL + pgvector
  - `db.py` — connection pool (singleton)
  - `models.py` — UserProfile, UserPreferences, LearningProgress, etc.
  - `queries/` — users, profiles, progress, sessions, `_helpers.py` (shared SQL builders)
- `content/` — template registry (scans `data/`)
  - `templates.py`, `models.py`, `bundles.py`
- `tools/` — tool system with auth + rate limiting
  - `registry.py`, `schemas.py` (ToolName Literal as single source), `auth.py`, `rate_limit.py`
- `sync/yjs_server.py` — Yjs via pycrdt-websocket
- `config.py`, `logging.py` (structured `get_logger()`)

**Client** (`client/src/`) — React + Vite + TypeScript + Tailwind
- `pages/Room.tsx` — main room page (uses extracted hooks)
- `pages/Home.tsx` — landing page
- `modules/display/` — content rendering
  - `components/Board.tsx` — main board layout
  - `components/ContentRenderer.tsx` — unified game/lesson renderer (parameterized by registry)
  - `components/BundleRenderer.tsx`, `LessonRenderer.tsx`
  - `components/ScreenEffects.tsx` — merged overlays (focus highlight + emotes)
  - `components/SharedCursors.tsx`, `Annotations.tsx`
  - `components/ui/` — ChatInput, ControlBar, LoadingOverlay, ParticipantList, ScoreBoard
  - `hooks/useGameState.ts`, `hooks/useBundleLoader.ts`
  - `plugin-registry.ts`, `layout/RoomLayout.tsx`
- `modules/realtime/` — real-time communication
  - `hooks/useRoom.ts`, `useVoice.ts`, `usePresence.ts`, `useServerEvents.ts`
  - `hooks/useSessionData.ts`, `useRoomTranscript.ts`, `useRoomParticipants.ts` — extracted from Room.tsx
  - `hooks/useCursors.ts`, `useSync.ts`
  - `livekit/` — LiveKit client, spatial audio
  - `sync/` — Yjs provider, awareness, cursor-sync, sync-store
- `modules/engine/` — game engine (canvas, input, audio, particles, camera)
- `modules/teacher/` — (hooks removed, audio via useVoice.ts)
- `lib/logger.ts` — structured logging + batched forwarding to /api/logs
- `types/` — TypeScript type definitions
- `config/` — API config, constants

**Data** (`data/`) — game/lesson content bundles
- `games/` — flashcard, sentencebuilder, spaceshooter, wordmatch
- `lessons/` — solar-system

## Key Patterns

- **Event envelope**: All Redis events use `publish_event()` from `events/helpers.py` (type, timestamp, sourceId, payload)
- **Logging**: Server uses `get_logger()` from `server/logging.py` (not `logging.getLogger()`)
- **Gemini Live receive**: Use `async for msg in session.receive()` (not `async for msg in session`) — changed in google-genai ≥1.66.0
- **TA singleton**: Single instance on `app.state.ta_agent` (set in main.py lifespan)
- **Tool names**: `ToolName` Literal is the single source of truth; `TOOL_NAMES` derived via `get_args()`
- **Rate limiting**: `RateLimitResult(allowed, retry_after_ms)` — simple dataclass
- **SQL helpers**: `_helpers.py` provides `build_update_sql()` and `format_vector()`

## Infrastructure

- Docker Compose: PostgreSQL + pgvector, Redis, LiveKit server
- LiveKit Agents SDK for teacher voice
- Gemini Live API for teacher, Gemini Flash for TA
- Yjs for collaborative state sync
