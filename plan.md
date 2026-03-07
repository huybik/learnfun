# EduForge Refactor Plan: Python Server + React (Vite) Frontend

## Decisions

- **Frontend:** Vite + React Router (drop Next.js)
- **Server:** Python FastAPI
- **Yjs:** pycrdt-websocket (embedded in FastAPI)
- **Messaging:** In-process async calls (Teacher -> TA direct), Redis pub/sub for server -> browser and future scaling
- **Rewrite style:** Big bang — build fresh, test when complete

## Architecture Overview

```
Browser (Vite + React)
  |-- LiveKit client (audio/video, room)
  |-- WebSocket (Yjs sync via pycrdt-websocket)
  |-- REST (session, join, bundles, health)
  |-- SSE or WebSocket (real-time events: content pushes, UI control)

Python Server (FastAPI)
  |-- Teacher Agent (LiveKit Agents SDK + Gemini Live API)
  |-- TA Agent (Gemini Flash, content generation pipeline)
  |-- Tool Registry (schemas, auth, rate-limit)
  |-- Content System (template registry, bundle builder, scans data/)
  |-- Storage (asyncpg + pgvector, Redis)
  |-- Yjs Server (pycrdt-websocket, mounted on /yjs)
  |-- Event Bus (in-process async, Redis pub/sub for browser bridge)

Infrastructure (docker-compose)
  |-- PostgreSQL + pgvector
  |-- Redis
  |-- LiveKit Server
```

**Key architecture change:** The Teacher agent moves from browser-side to server-side. Currently the browser connects directly to Gemini Live API via WebSocket. In the new architecture, a Python LiveKit Agent joins the room as "ai-teacher", receives participant audio via LiveKit, pipes it to Gemini Live API server-side, and publishes Gemini's audio response back to the LiveKit room. The browser just connects to LiveKit normally — no direct Gemini connection from the client.

**Teacher -> TA flow (simplified):** Gemini issues a tool call -> Teacher agent calls `ta.generate()` directly in-process (async function call, no message bus) -> TA returns bundle -> Teacher pushes event to browser via Redis pub/sub -> SSE/WebSocket.

---

## Part 1: Project Scaffold [DONE]

**Goal:** Create the directory structure and project configuration for both server and client. No logic — just the skeleton.

**Produces:**
```
eduforge/
  server/
    pyproject.toml          # Python project config (FastAPI, uvicorn, google-genai, livekit-agents, asyncpg, redis, pycrdt-websocket, pydantic)
    server/__init__.py
    server/main.py          # Empty FastAPI app with CORS, placeholder routers
    server/config.py        # Pydantic BaseSettings (env vars)
    server/logging.py       # Structured JSON logger (structlog)
  client/
    package.json            # React 19, Vite, React Router, livekit-client, yjs, tailwindcss, zustand
    vite.config.ts          # Proxy /api -> server, alias @/ -> src/, @data/ -> ../data/
    tsconfig.json
    index.html
    src/
      main.tsx              # React entry, BrowserRouter
      App.tsx               # Route definitions (Home, Room)
  data/                     # Symlink or copy — game/lesson plugins (unchanged)
  docker-compose.yml        # PostgreSQL, Redis, LiveKit
```

**Source reference (current):**
- `package.json` — current deps to carry to client
- `src/config/env.ts` — env vars to port to `server/config.py`
- `tsconfig.json`, `tailwind.config.ts` — carry to client

**Agent instructions:**
- Read `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs` from current project
- Create `server/pyproject.toml` with deps: `fastapi`, `uvicorn[standard]`, `google-genai`, `livekit-agents`, `livekit-api`, `asyncpg`, `redis[hiredis]`, `pycrdt-websocket`, `pydantic-settings`, `structlog`, `python-jose[cryptography]`, `httpx`
- Create `client/package.json` with deps from current `package.json` minus: `next`, `nats`, `pg`, `livekit-server-sdk`, `jose`, `dotenv-flow`. Add: `vite`, `@vitejs/plugin-react`, `react-router-dom`
- Create `vite.config.ts` with proxy `/api` -> `http://localhost:8000`, aliases `@/` -> `./src/`, `@data/` -> `../data/`
- Create `docker-compose.yml` with PostgreSQL (+ pgvector extension), Redis, LiveKit server
- Create `server/config.py` porting env vars from `src/config/env.ts`: `GEMINI_API_KEY`, `DATABASE_URL`, `REDIS_URL`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `JWT_SECRET`
- Create `server/logging.py` — structlog JSON logger matching current log format `{ ts, level, module, msg, ...data }`
- Create empty `server/main.py` with FastAPI app, CORS middleware, and placeholder `include_router` calls
- Do NOT port any logic yet

---

## Part 2: Storage Layer [DONE]

**Goal:** Port PostgreSQL database access from TypeScript to Python. Set up asyncpg connection pool and query functions.

**Produces:**
```
server/storage/
  __init__.py
  db.py              # asyncpg pool lifecycle (startup/shutdown)
  models.py          # Pydantic models for DB rows
  queries/
    __init__.py
    users.py          # get_user, create_user
    profiles.py       # get_profile, upsert_profile
    progress.py       # get_progress, update_progress
    sessions.py       # create_session, get_session, end_session
```

**Source reference (current):**
- `src/modules/storage/db/client.ts` — connection setup
- `src/modules/storage/db/queries/users.ts` — user queries
- `src/modules/storage/db/queries/profiles.ts` — profile queries
- `src/modules/storage/db/queries/progress.ts` — progress queries (used by TA for difficulty)
- `src/modules/storage/db/queries/sessions.ts` — session queries
- `src/modules/storage/db/migrate.ts` — schema/migrations
- `src/types/user.ts` — UserProfile, LearningProgress types
- `src/types/room.ts` — Room, Participant types

**Agent instructions:**
- Read ALL source files listed above
- Create `db.py` with asyncpg pool: `init_db()` (called at FastAPI startup), `get_pool()`, `close_db()`
- Port each query file 1:1 from TypeScript to Python async functions using asyncpg
- Create `models.py` with Pydantic models matching TypeScript types in `src/types/user.ts` and `src/types/room.ts`
- Include the migration SQL from `migrate.ts` as a `migrations/001_initial.sql` file
- Use `server.config.settings` for DATABASE_URL
- Do NOT add ORM — keep raw asyncpg queries like the current code

---

## Part 3: Content System [DONE]

**Goal:** Port template registry and bundle builder. These scan `data/` for manifests and store filled bundles.

**Produces:**
```
server/content/
  __init__.py
  templates.py       # list_templates(), get_template() — scans data/games/*/manifest.json and data/lessons/*/manifest.json
  bundles.py         # store_bundle(), get_bundle(), list_bundles()
  models.py          # Pydantic models: TemplateManifest, TemplateSlot, FilledBundle, GamePodTemplate, LessonTemplate
```

**Source reference (current):**
- `src/modules/content/template-registry.ts` — `listTemplates()` scans data/ dirs
- `src/modules/content/bundle-builder.ts` — `storeBundle()`, `getBundle()`
- `src/types/content.ts` — TemplateManifest, TemplateSlot, FilledBundle, GamePodTemplate, LessonTemplate
- `data/games/*/manifest.json` — example manifests to understand structure
- `data/lessons/*/manifest.json`

**Agent instructions:**
- Read ALL source files listed above, plus at least 2 manifest.json files from `data/`
- Create Pydantic models in `models.py` matching `src/types/content.ts` exactly
- Port `listTemplates()` — walk `data/games/` and `data/lessons/`, read each `manifest.json`, return list of `TemplateManifest`
- Port `storeBundle()` — write filled bundle JSON to `data/bundles/{id}.json`
- Port `getBundle()` — read bundle JSON by ID
- Template scanning should be relative to project root (configurable via `settings.DATA_DIR`)

---

## Part 4: Tool System [DONE]

**Goal:** Port the tool registry with schemas, auth, and rate limiting.

**Produces:**
```
server/tools/
  __init__.py
  schemas.py         # Tool definitions with Pydantic schemas (replacing Zod)
  registry.py        # ToolRegistry class: register, execute (auth + rate-limit + validate + call)
  auth.py            # validate_caller()
  rate_limit.py      # RateLimiter (in-memory, same logic as current)
```

**Source reference (current):**
- `src/modules/tools/tool-types.ts` — TOOL_DEFINITIONS, ToolName, ToolCall, ToolResponse, CallerRole, schemas
- `src/modules/tools/tool-registry.ts` — ToolRegistry class
- `src/modules/tools/middleware/auth.ts` — validateCaller()
- `src/modules/tools/middleware/rate-limit.ts` — RateLimiter
- `src/types/tools.ts` — ToolDefinition, ToolCall, ToolResponse

**Agent instructions:**
- Read ALL source files listed above
- Port `TOOL_DEFINITIONS` — replace Zod schemas with Pydantic models
- Port `ToolRegistry` class preserving the execute pipeline: exists -> auth -> rate-limit -> validate -> handler
- Port `validateCaller()` and `RateLimiter` as-is
- Tool handler type: `async (params: dict, context: ToolHandlerContext) -> ToolResponse`
- Keep the same tool names: `request_ta_action`, `query_content`, `execute_filled_bundle`, `light_control`, `signal_feedback`, `update_profile`, `load_content`, `get_room_state`

---

## Part 5: TA Agent [DONE]

**Goal:** Port the content generation pipeline — the TA agent that uses Gemini Flash to fill template slots.

**Produces:**
```
server/agents/
  __init__.py
  ta/
    __init__.py
    agent.py            # TAAgent class: start/stop, handle_request()
    content_generator.py # ContentGenerator: generate_filled_data(), resolve_template()
    request_handler.py  # handle_ta_request() pipeline: query -> personalize -> generate -> validate -> store -> publish
    personalizer.py     # build_personalization_context(), adjust_difficulty()
    safety_filter.py    # validate_content()
    models.py           # TARequest, TAResponse, TADependencies, GenerateParams
```

**Source reference (current):**
- `src/modules/ta/ta-agent.ts` — TAAgent class
- `src/modules/ta/content-generator.ts` — ContentGenerator (Gemini Flash calls, template resolution, prompt building)
- `src/modules/ta/request-handler.ts` — handleTARequest pipeline, TARequest/TAResponse/TADependencies types
- `src/modules/ta/personalizer.ts` — personalization logic
- `src/modules/ta/safety-filter.ts` — content safety validation

**Agent instructions:**
- Read ALL source files listed above
- Use `google-genai` Python SDK (same package name, Python equivalent of `@google/genai`)
- Port `ContentGenerator` — `generate_filled_data()` using `client.models.generate_content()` with `response_mime_type="application/json"` and `response_schema`
- Port `resolve_template()` — heuristic + AI fallback, same logic
- Port `handle_ta_request()` pipeline exactly: query_template -> personalize -> generate -> store -> publish
- Port `TAAgent` class but **remove all NATS code** — the agent will be called directly via `agent.handle_request()` from the Teacher or API route
- The `publish_to_room` dependency will call the event bus (Part 8) instead of NATS
- Use Pydantic models for TARequest, TAResponse
- `gemini-flash-latest` is a valid model alias — do not change it

---

## Part 6: Event Bus + Redis [DONE]

**Goal:** Replace NATS with an in-process event bus for agent-to-agent calls, and Redis pub/sub for server-to-browser events.

**Produces:**
```
server/events/
  __init__.py
  bus.py             # InProcessBus: publish/subscribe with asyncio — for internal agent communication
  redis_bridge.py    # RedisBridge: publish events to Redis channels, subscribe for SSE/WS delivery
  subjects.py        # Channel/subject names (ported from orchestration/subjects.ts)
```

**Source reference (current):**
- `src/modules/orchestration/subjects.ts` — SUBJECTS dict, roomSubject() helper
- `src/modules/orchestration/nats-client.ts` — publish/subscribe pattern (replace with Redis)
- `src/modules/orchestration/routing/teacher-ta-router.ts` — routing logic
- `src/modules/orchestration/routing/content-push-router.ts` — content push routing
- `src/modules/orchestration/routing/room-event-router.ts` — room event routing

**Agent instructions:**
- Read ALL source files listed above
- Port `SUBJECTS` dict and `room_subject()` helper from `subjects.ts`
- Create `InProcessBus` — simple asyncio pub/sub for in-process events (Teacher -> TA calls won't use this, they're direct function calls; this is for room-scoped events like UI control)
- Create `RedisBridge` using `redis.asyncio`:
  - `publish(channel, data)` — publish JSON to a Redis channel
  - `subscribe(channel)` — returns async iterator of messages (used by SSE endpoint)
  - Channels follow the SUBJECTS naming: `room.{roomId}.content`, `room.{roomId}.ui`, etc.
- Connect to Redis at FastAPI startup, close at shutdown
- Keep it simple — no complex routing. The TA publishes `room.{roomId}.content` after generating a bundle. The SSE endpoint subscribes to `room.{roomId}.*` and forwards to the browser.

---

## Part 7: Teacher Agent (LiveKit Agents SDK + Gemini Live) [DONE]

**Goal:** Port the Teacher agent to run server-side using Python LiveKit Agents SDK. This is the biggest architectural change.

**Produces:**
```
server/agents/teacher/
  __init__.py
  agent.py           # TeacherAgent: LiveKit Agent that connects to Gemini Live API
  gemini_session.py  # GeminiSession wrapper (Gemini Live API via google-genai Python SDK)
  voice_config.py    # Voice/language resolution
  system_prompt.py   # buildTeacherPrompt()
  audio_utils.py     # PCM conversion helpers
```

**Source reference (current):**
- `src/modules/teacher/teacher-agent.ts` — TeacherAgent (orchestrates Gemini + LiveKit)
- `src/modules/teacher/gemini-session.ts` — GeminiSession (WebSocket to Gemini Live API, event handling)
- `src/modules/teacher/livekit-bridge.ts` — LiveKitBridge (audio routing between LiveKit and Gemini)
- `src/modules/teacher/voice-config.ts` — voice/language config
- `src/modules/teacher/system-prompt.ts` — buildTeacherPrompt()
- `src/modules/teacher/audio-utils.ts` — PCM conversion
- `src/config/constants.ts` — DEFAULT_VOICES, SUPPORTED_LANGUAGES

**Agent instructions:**
- Read ALL source files listed above
- This is a **major architecture change**: currently the GeminiSession runs in the browser. Now it runs server-side.
- Use the **LiveKit Agents SDK** (`livekit-agents` Python package) to create an agent that:
  1. Joins a LiveKit room as participant "ai-teacher"
  2. Receives audio from room participants via LiveKit
  3. Pipes audio to Gemini Live API via `google-genai` Python SDK's live/streaming API
  4. Receives Gemini audio responses and publishes them back to the LiveKit room
  5. Handles tool calls from Gemini — dispatches to ToolRegistry, then calls TA agent directly for `request_ta_action`
- Port `GeminiSession` — use `google.genai` Python SDK's `client.live.connect()` (same pattern as TS SDK)
- Port `buildTeacherPrompt()` from `system-prompt.ts`
- Port `resolveVoiceConfig()` from `voice-config.ts`
- Port audio utils (pcm16_to_float32, float32_to_pcm16)
- The Teacher agent is started when a room session is created (Part 8 API wires this)
- Tool call flow: Gemini tool call -> `tool_registry.execute()` -> for `request_ta_action`, call `ta_agent.handle_request()` directly -> publish result to Redis -> SSE to browser
- **Remove all browser-specific code** (AudioContext, MediaStreamTrack, ScriptProcessor) — LiveKit Agents SDK handles audio I/O

---

## Part 8: API Routes [DONE]

**Goal:** Port all Next.js API routes to FastAPI endpoints.

**Produces:**
```
server/api/
  __init__.py
  session.py         # POST /api/session — create session, return roomId + token + livekitToken
  join.py            # POST /api/join — join existing room
  health.py          # GET /api/health
  token.py           # GET /api/get-token — ephemeral Gemini token (or LiveKit token now that Gemini is server-side)
  bundles.py         # GET /api/bundles/{id} — serve stored bundle JSON
  logs.py            # POST /api/logs — receive browser logs
  events.py          # GET /api/room/{room_id}/events — SSE stream (Redis subscription)
  ta.py              # POST /api/ta — direct TA request (fallback when not triggered by Teacher)
```

**Source reference (current):**
- `src/app/api/session/route.ts` (also `src/modules/orchestration/api/session/route.ts`)
- `src/app/api/join/route.ts` (also `src/modules/orchestration/api/join/route.ts`)
- `src/app/api/health/route.ts` (also `src/modules/orchestration/api/health/route.ts`)
- `src/app/api/get-token/route.ts` — mints ephemeral Gemini API key
- `src/app/api/bundles/[id]/route.ts` — serves bundle JSON
- `src/app/api/logs/route.ts` — receives browser logs
- `src/app/api/room/[roomId]/events/route.ts` — SSE bridge (NATS -> browser)
- `src/app/api/ta/route.ts` (also `src/modules/ta/api/route.ts`)
- `src/modules/orchestration/session/session-manager.ts` — session creation logic
- `src/modules/orchestration/session/session-store.ts` — session storage
- `src/modules/orchestration/session/jwt-auth.ts` — JWT token minting/verification

**Agent instructions:**
- Read ALL source files listed above
- Port each API route to a FastAPI router
- `POST /api/session`: Create session + room, generate JWT, generate LiveKit token (using `livekit-api` Python SDK), start Teacher agent for the room, return `{ sessionId, roomId, token, livekitToken, livekitUrl }`
- `GET /api/get-token`: Since Gemini now runs server-side, this endpoint may only need to return a LiveKit token. Read the current implementation and decide — if the frontend still needs any token, provide it.
- `GET /api/room/{room_id}/events`: SSE endpoint using `StreamingResponse`. Subscribe to Redis channels `room.{room_id}.*` and yield events as SSE.
- `POST /api/ta`: Directly call `ta_agent.handle_request()` — no NATS
- Port JWT logic using `python-jose`
- Port session manager/store — can use Redis for session storage instead of in-memory
- Register all routers in `server/main.py`

---

## Part 9: Yjs Integration [DONE]

**Goal:** Set up pycrdt-websocket for real-time CRDT sync, mounted inside the FastAPI app.

**Produces:**
```
server/sync/
  __init__.py
  yjs_server.py      # pycrdt-websocket setup, room document management
```

**Source reference (current):**
- `src/modules/realtime/sync/yjs-provider.ts` — Yjs WebSocket provider setup
- `src/modules/realtime/sync/cursor-sync.ts` — cursor position sync via Yjs awareness
- `src/modules/realtime/sync/awareness.ts` — Yjs awareness protocol
- `src/modules/realtime/sync/sync-store.ts` — shared Yjs document state

**Agent instructions:**
- Read ALL source files listed above to understand what Yjs data is synced (cursors, game state, scores, positions)
- Install and use `pycrdt` + `pycrdt-websocket`
- Create a `WebsocketServer` and mount it at `/yjs/{room_id}` in the FastAPI app
- Each room gets its own Yjs document
- Documents are created on first connection, cleaned up when the room closes
- Keep it minimal — the browser-side Yjs client (`y-websocket` provider) connects to this endpoint
- Do NOT port the React hooks (useCursors, useSync, etc.) — those stay in the frontend (Part 10)

---

## Part 10: React Frontend (Vite) [DONE]

**Goal:** Extract the React frontend from Next.js into a standalone Vite app. Port pages, components, hooks.

**Produces:**
```
client/src/
  main.tsx                    # React entry
  App.tsx                     # Routes: / -> Home, /room/:roomId -> Room
  config/
    constants.ts              # Voices, languages (from src/config/constants.ts)
    api.ts                    # API base URL, fetch helpers
  types/                      # Ported from src/types/ (content.ts, room.ts, user.ts, events.ts, tools.ts)
  lib/
    utils.ts                  # cn(), sleep(), retry()
    log-forwarder.ts          # Browser log interceptor -> POST /api/logs
  modules/
    display/                  # Board, BundleRenderer, plugin-registry, all components — COPY AS-IS
    realtime/
      hooks/
        useRoom.ts            # LiveKit room hook (same, remove NATS dependency)
        useSync.ts            # Yjs sync hook (point to /yjs/{roomId} WebSocket)
        useCursors.ts         # Cursor sync via Yjs awareness
        usePresence.ts        # Presence via Yjs awareness
        useVoice.ts           # Voice controls
        useServerEvents.ts    # NEW: replaces useNatsEvents — SSE from /api/room/{roomId}/events
    engine/                   # 2D game engine — COPY AS-IS
    teacher/
      hooks/
        useTeacherAudio.ts    # Local mic capture + LiveKit audio playback (simplified — no direct Gemini connection)
  pages/
    Home.tsx                  # From src/app/page.tsx — change fetch URLs to /api/session
    Room.tsx                  # From src/app/room/[roomId]/page.tsx — major simplification (see below)
```

**Source reference (current):**
- `src/app/page.tsx` — Home page
- `src/app/room/[roomId]/page.tsx` — Room page (heavy — manages Gemini, LiveKit, NATS, tools, transcripts, content)
- `src/app/layout.tsx` — Root layout
- `src/modules/display/**` — All display components
- `src/modules/realtime/**` — All realtime hooks
- `src/modules/engine/**` — Game engine
- `src/modules/teacher/hooks/**` — Teacher React hooks
- `src/config/constants.ts` — Voices, languages
- `src/lib/*` — Utilities
- `src/types/*` — Type definitions

**Agent instructions:**
- Read ALL source files listed above (especially `page.tsx` and `room/[roomId]/page.tsx` carefully)
- **Home page:** Minimal changes — replace `next/navigation` with `react-router-dom`, keep the same UI
- **Room page — this is the big simplification:**
  - REMOVE: direct Gemini connection (useTeacher, gemini-session, useTeacherAudio mic-to-gemini pipeline)
  - REMOVE: useTeacherTools (tool dispatch) — tools are handled server-side now
  - REMOVE: useNatsEvents — replace with useServerEvents (SSE from Python server)
  - KEEP: LiveKit room connection (useRoom) — students still connect to LiveKit for audio
  - KEEP: Board, transcript overlay, sidebar, controls
  - KEEP: Content loading from SSE events (handleContentReady pattern, but from SSE not NATS)
  - The room page becomes much simpler: connect to LiveKit, listen for SSE events, render content
  - Audio is handled by LiveKit — student speaks into LiveKit, Teacher agent (server-side) hears it
  - Transcript: receive from SSE (server pushes transcription events from Gemini to Redis to SSE)
  - Text chat: POST to `/api/room/{roomId}/message` (new endpoint) which forwards to Teacher agent
- **Display module:** Copy as-is. Only change imports from `@/` to match new paths.
- **Engine module:** Copy as-is.
- **Plugin registry + data/ plugins:** Copy as-is. Preserve `@data/` alias in vite.config.ts.
- Replace all `next/navigation` with `react-router-dom` (useParams, useNavigate, useSearchParams)
- Replace all `"use client"` directives — not needed in Vite
- Point all `fetch("/api/...")` calls to the same paths (Vite proxy handles routing to Python server in dev)

---

## Part 11: Integration & Docker [DONE]

**Goal:** Wire everything together. Startup lifecycle, docker-compose, environment.

**Produces:**
```
server/main.py              # Updated: mount all routers, Yjs server, startup/shutdown events
docker-compose.yml          # Updated: add Python server + Vite dev server
.env.example                # All env vars documented
```

**Agent instructions:**
- Read `server/main.py` and all `__init__.py` files created in previous parts
- Wire FastAPI startup events:
  1. `init_db()` — PostgreSQL pool
  2. `init_redis()` — Redis connection
  3. Mount Yjs WebSocket server at `/yjs/{room_id}`
  4. Initialize TA agent (singleton)
  5. Initialize Tool Registry with handlers
- Wire FastAPI shutdown events:
  1. Close DB pool
  2. Close Redis
  3. Stop any running Teacher agents
- Update `docker-compose.yml`:
  - `postgres` (port 5432, pgvector image)
  - `redis` (port 6379)
  - `livekit` (port 7880)
  - `server` (port 8000, mounts `./server` + `./data`)
  - `client` (port 5173, Vite dev server, proxy to server)
- Create `.env.example` with all required env vars
- Verify all imports resolve, all parts connect

---

## Dependency Graph

```
Part 1  (Scaffold)
  |
  +-- Part 2  (Storage)
  |
  +-- Part 3  (Content)
  |
  +-- Part 4  (Tools)
  |     |
  +-- Part 5  (TA Agent) -------- depends on: Part 2, 3, 4
  |     |
  +-- Part 6  (Event Bus) ------- depends on: Part 1
  |     |
  +-- Part 7  (Teacher Agent) --- depends on: Part 4, 5, 6
  |     |
  +-- Part 8  (API Routes) ------ depends on: Part 2, 5, 6, 7
  |     |
  +-- Part 9  (Yjs) ------------- depends on: Part 1
  |
  +-- Part 10 (React Frontend) -- depends on: Part 8, 9 (needs API contract)
  |
  +-- Part 11 (Integration) ----- depends on: ALL
```

**Parallelizable:** Parts 2, 3, 4, 6, 9 can all run in parallel after Part 1.
**Sequential:** Part 5 needs 2+3+4. Part 7 needs 4+5+6. Part 8 needs 2+5+6+7. Part 10 needs API contracts from 8. Part 11 is last.

---

## Files NOT Ported (Deleted)

These are Next.js-specific or superseded by the new architecture:

- `src/app/` — Next.js app router (replaced by Vite pages + FastAPI routes)
- `src/modules/orchestration/nats-client.ts` — replaced by Redis
- `src/modules/teacher/livekit-bridge.ts` — replaced by LiveKit Agents SDK (server-side)
- `src/modules/teacher/gemini-session.ts` — rewritten for Python (server-side)
- `src/modules/teacher/hooks/useTeacher.ts` — no longer needed (teacher is server-side)
- `src/modules/teacher/hooks/useTeacherTools.ts` — tools handled server-side
- `src/modules/realtime/hooks/useNatsEvents.ts` — replaced by useServerEvents (SSE)
- `next.config.ts`, `middleware.ts` — Next.js specific
- `src/modules/storage/hooks/` — browser-side hooks for localStorage, stays but simplified

## Files Copied As-Is (minimal changes)

- `src/modules/display/**` — all components, hooks, plugin-registry
- `src/modules/engine/**` — 2D game engine
- `data/**` — all game/lesson plugins and manifests
- `src/types/**` — TypeScript types (kept in client, mirrored as Pydantic in server)
- `src/config/constants.ts` — voices, languages
- `src/lib/utils.ts` — cn(), sleep(), retry()
