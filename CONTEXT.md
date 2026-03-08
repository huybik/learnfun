# LearnFun — Project Context

Interactive learning platform: AI teacher + teaching assistant guide students through games in real-time rooms.

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
  - `games.py` — serves built game dist files from `data/games/{id}/dist/`
  - `bundles.py`, `health.py`
- `agents/teacher/` — LiveKit-based teacher agent
  - `agent.py` — TeacherAgent (LiveKit Agent, Gemini Live voice)
  - `gemini_session.py` — Gemini Live API session wrapper
  - `system_prompt.py`, `voice_config.py`
- `agents/ta/` — Teaching Assistant agent (Gemini Flash)
  - `agent.py` — TAAgent lifecycle, delegates to request_handler
  - `request_handler.py` — orchestration pipeline + personalization
  - `content_generator.py` — Gemini generation guided by skill.md
  - `models.py` — TARequest, TAResponse, GenerateParams
- `events/` — event system
  - `redis_bridge.py` — Redis pub/sub connection
  - `bus.py` — in-process event bus
  - `helpers.py` — `publish_event()` + `serialize_event()` (shared envelope)
  - `models.py` — Participant, Room (event-only, not persisted)
  - `subjects.py` — event channel definitions
- `storage/` — PostgreSQL
  - `db.py` — connection pool (singleton)
  - `models.py` — UserProfile, UserPreferences, LearningProgress, etc.
  - `queries/` — users, profiles, progress, sessions, `_helpers.py` (shared SQL builders)
- `content/` — game registry (scans `data/games/`)
  - `templates.py` — `list_games()`, `get_game()`, parses skill.md frontmatter
  - `models.py` — `GameMeta`, `FilledBundle`
  - `bundles.py` — bundle storage
- `tools/` — tool system with auth + rate limiting
  - `registry.py`, `schemas.py` (ToolName Literal as single source), `auth.py`, `rate_limit.py`
  - `handlers.py` — concrete handlers for all 8 tools (query_content, execute_filled_bundle, light_control, signal_feedback, update_profile, load_content, get_room_state; request_ta_action handled directly by TeacherAgent)
- `sync/yjs_server.py` — Yjs via pycrdt-websocket
- `config.py`, `logging.py` (structured `get_logger()`)

**Client** (`client/src/`) — React + Vite + TypeScript + Tailwind
- `pages/Room.tsx` — main room page (uses extracted hooks)
- `pages/Home.tsx` — landing page
- `modules/display/` — content rendering
  - `components/Board.tsx` — main board layout (layered: GameHost + cursors + annotations + effects)
  - `components/GameHost.tsx` — iframe-based game loader, postMessage bridge to games
  - `components/ScreenEffects.tsx` — merged overlays (focus highlight + emotes)
  - `components/SharedCursors.tsx`, `Annotations.tsx`
  - `components/ui/` — ChatInput, ControlBar, LoadingOverlay, ParticipantList, ScoreBoard
  - `layout/RoomLayout.tsx`
- `modules/realtime/` — real-time communication
  - `hooks/useRoom.ts`, `useVoice.ts`, `usePresence.ts`, `useServerEvents.ts`
  - `hooks/useSessionData.ts`, `useRoomTranscript.ts`, `useRoomParticipants.ts` — extracted from Room.tsx
  - `hooks/useCursors.ts`, `useSync.ts`
  - `livekit/` — LiveKit client, spatial audio
  - `sync/` — Yjs provider, awareness, cursor-sync, sync-store
- `modules/engine/` — game engine (canvas, input, audio, particles, camera)
- `modules/teacher/` — (hooks removed, audio via useVoice.ts)
- `lib/logger.ts` — structured logging (browser console only)
- `types/` — TypeScript type definitions
- `config/` — API config, constants

**Data** (`data/`) — game content (at project root, shared by server + client)
- `games/` — flashcard, sentencebuilder, spaceshooter, wordmatch, solar-system
- `games/_sdk/` — shared SDK (GameBridge, GameAPI interface, dev panel) for iframe games
- Each game is a standalone Vite project: `skill.md` (YAML frontmatter + AI instructions) + `src/` (vanilla TS or any framework)
- Games run in iframes, served from `/games/{id}/` via `api/games.py`

## Key Patterns

- **Game plugin**: Each game in `data/games/<id>/` is a standalone Vite project with `skill.md` (frontmatter for metadata, body for AI context). Games implement `GameAPI` (init/handleAction/getState/destroy) via the `_sdk` bridge. Communication uses postMessage (HostToGame: init/action, GameToHost: ready/state/event/end). No manifest.json — skill.md is the single source.
- **Skill.md structure**: YAML frontmatter (id, name, tags, maxPlayers) + markdown sections: Input Data (for TA generation), State Updates (for teacher), Teacher Guide (facilitation tips)
- **Event envelope**: All Redis events use `publish_event()` from `events/helpers.py` (type, timestamp, sourceId, payload)
- **Logging**: Server uses `get_logger()` from `server/logging.py` (not `logging.getLogger()`)
- **Gemini Live receive**: Use `async for msg in session.receive()` (not `async for msg in session`) and call `receive()` repeatedly in a loop because each call yields one complete turn in google-genai ≥1.66.0
- **TA singleton**: Single instance on `app.state.ta_agent` (set in main.py lifespan)
- **Tool names**: `ToolName` Literal is the single source of truth; `TOOL_NAMES` derived via `get_args()`
- **Rate limiting**: `RateLimitResult(allowed, retry_after_ms)` — simple dataclass
- **SQL helpers**: `_helpers.py` provides `build_update_sql()`
- **Tool flow**: Gemini → tool call → TeacherAgent → ToolRegistry.execute() → handler → publish_event() → SSE → client. `light_control` and `signal_feedback` publish to UI_CONTROL channel; Room.tsx handles via `onUIControl` → ScreenEffects

## Infrastructure

- Docker Compose: PostgreSQL, Redis, LiveKit server
- LiveKit Agents SDK for teacher voice
- Gemini Live API for teacher, Gemini Flash for TA
- Yjs for collaborative state sync
