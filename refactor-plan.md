# Refactor Plan

## Review Summary

Full codebase review found: **over-engineering**, **code duplication**, **separation of concerns violations**, and **dead code**. The architecture matches the vision (FastAPI + Vite, LiveKit Agents, Gemini, Redis pub/sub, Yjs, pgvector). No structural gaps vs plan.md/vision.md. Issues are implementation-level, not architectural.

---

## Phase 1: Dead Code & Cleanup (low risk, high clarity)

**Scope:** Remove unused code, fix missing files, fix inconsistencies. No logic changes.

### 1.1 Delete dead code
- [ ] Delete `server/server/agents/ta/safety_filter.py` — never imported or called anywhere (131 lines)
- [ ] Delete `client/src/modules/teacher/hooks/useTeacherAudio.ts` — only toggles local `isMuted` bool, not wired to LiveKit; actual mic control is in `useVoice.ts`. Remove import from Room.tsx
- [ ] Remove unused `GamePhase` states ("starting", "error") from `client/src/modules/display/hooks/useGameState.ts`
- [ ] Remove `_dirs_for_type` unused `expected_type` field in `server/server/content/templates.py`

### 1.2 Remove unused imports
- [ ] `datetime` import in `server/server/storage/models.py` — never used
- [ ] `Enum` import in `server/server/tools/schemas.py` — never used
- [ ] `GamePodTemplate`, `LessonTemplate` imports in `server/server/agents/teacher/system_prompt.py` — never referenced
- [ ] Remove unused `_template: TemplateManifest` parameter from `personalizer.adjust_difficulty()` — only uses `progress`
- [ ] Move lazy import `from .models import GenerateParams` to top-level in `server/server/agents/ta/request_handler.py` (line 77) — no circular import risk

### 1.3 Fix logging inconsistency
- [ ] Replace `logging.getLogger()` with `get_logger()` from `server/server/logging.py` in:
  - `server/server/storage/db.py`
  - `server/server/storage/queries/users.py`
  - `server/server/storage/queries/profiles.py`
  - `server/server/storage/queries/progress.py`
  - `server/server/storage/queries/sessions.py`

### 1.5 Fix assertions in production code
- [ ] Replace `assert self._redis is not None` with `if not self._redis: raise RuntimeError(...)` in `server/server/events/redis_bridge.py` (lines 46, 53)
- [ ] Same pattern in `server/server/storage/db.py` (`get_pool()`)

### 1.6 Fix TA agent singleton conflict
- [ ] Remove `_agent` singleton from `server/server/api/ta.py` — use `request.app.state.ta_agent` from FastAPI lifespan instead. Currently two separate TAAgent instances exist (one in main.py lifespan, one lazy-created in api/ta.py)

### 1.7 Remove incomplete stubs in Room.tsx
- [ ] `handleGameStateUpdate` is just `console.log` — either implement or remove
- [ ] `handleGameEnd` only sets a boolean — either implement cleanup/server notification or remove

---

## Phase 2: Server Storage Dedup (single module, safe)

**Scope:** `server/server/storage/` — eliminate duplicated query patterns.

### 2.1 Merge duplicate user/profile getters
- [ ] `users.get_user(user_id)` and `profiles.get_profile(user_id)` both return `UserProfile | None` with nearly identical SQL (LEFT JOIN vs INNER JOIN). Pick one approach, delete the other. Callers should use a single function.
- [ ] Consolidate the row-to-model conversion — `users._row_to_profile()` and inline conversion in `profiles.get_profile()` do the same thing

### 2.2 Extract shared SQL helpers
- [ ] Create `server/server/storage/queries/_helpers.py` with:
  - `build_update_sql(table, fields_dict, where_clause)` — replaces the duplicated dynamic UPDATE pattern in `users.py` (lines 118-147) and `profiles.py` (lines 50-90)
  - `format_vector(embedding)` — replaces duplicated pgvector string formatting in `profiles.py` (lines 96, 111)

### 2.3 Move Room/Participant models out of storage
- [ ] Move `Participant` and `Room` from `server/server/storage/models.py` to `server/server/events/models.py` (or a shared `server/server/models.py`) — they aren't persisted, only used for event publishing in `session_manager.py`

---

## Phase 3: Server Tools Simplification (single module, safe)

**Scope:** `server/server/tools/` — reduce over-engineering.

### 3.1 Simplify RateLimiter
- [ ] Replace `RateLimitAllowed`/`RateLimitDenied` union with a simple `RateLimitResult(allowed: bool, retry_after_ms: int | None)` dataclass
- [ ] Update `registry.py` to use `.allowed` instead of `getattr()` check

### 3.2 Deduplicate TOOL_NAMES
- [ ] Remove the `TOOL_NAMES` list — derive it from the `ToolName` Literal type (or vice versa, single source of truth)

### 3.3 Inline auth + rate_limit into registry (optional)
- [ ] `auth.py` (49 lines) and `rate_limit.py` (77 lines) are only used by `registry.py`. Consider inlining if we want fewer files. **Low priority** — current separation is acceptable.

---

## Phase 4: TA Agent Consolidation (single module)

**Scope:** `server/server/agents/ta/` — reduce 6 files to 4.

### 4.1 Merge personalizer into request_handler
- [ ] Move `personalizer.py` functions (`build_personalization_context`, `adjust_difficulty`) into `request_handler.py` — only 2 functions, 134 lines, tightly coupled to the request handling pipeline
- [ ] Keep `content_generator.py` separate — it has distinct responsibility (Gemini API calls, prompt building, template resolution). request_handler is orchestration; content_generator is generation. Different concerns.

### 4.2 Simplify dependency injection
- [ ] Remove `TADependencies` dataclass and `_build_dependencies()` factory in `agent.py` — pass `ContentGenerator` directly to the pipeline function instead of wrapping its methods in async closures

### 4.3 Result structure
```
server/server/agents/ta/
  __init__.py
  models.py            # TARequest, TAResponse, GenerateParams (keep as-is)
  content_generator.py  # Gemini generation, template resolution, prompt building
  request_handler.py    # orchestration pipeline + personalization (merged)
  agent.py              # simplified: just manages lifecycle, calls request_handler directly
```

---

## Phase 5: Event Publishing Dedup (cross-cutting)

**Scope:** Extract duplicated event envelope construction.

### 5.1 Create event helper
- [ ] Add `publish_event(channel, event_type, payload, source_id)` to `server/server/events/helpers.py`
- [ ] Replace duplicated envelope construction in:
  - `server/server/agents/ta/request_handler.py` (line 108)
  - `server/server/api/session_manager.py` (lines 109-114, 153-158, 181-186)
  - `server/server/agents/teacher/agent.py` (lines 294-301, 327-333)

### 5.2 Extract JSON serialization helper
- [ ] `json.dumps(..., default=str)` appears in 3 files (redis_bridge.py, logs.py, events.py). Add a `serialize_event()` helper alongside `publish_event()`.

---

## Phase 6: API Naming Clarity (renames only)

**Scope:** Reduce confusion between similarly-named modules.

### 6.1 Rename ambiguous files
- [ ] Rename `server/server/api/auth.py` to `server/server/api/tokens.py` — it does JWT/LiveKit token generation, not auth middleware. Avoids confusion with `tools/auth.py` (role-based tool access)
- [ ] Rename `server/server/api/session_manager.py` to `server/server/api/room_manager.py` — it manages rooms (in-memory), not learning sessions. Avoids confusion with `storage/queries/sessions.py` (DB persistence)

---

## Phase 7: Client Display Consolidation (single module)

**Scope:** `client/src/modules/display/` — reduce component fragmentation.

### 7.1 Merge duplicate renderers
- [ ] Merge `GamePodRenderer.tsx` and `InteractiveLessonRenderer.tsx` into a single `ContentRenderer.tsx` — they are ~95% identical (both wrap components in GameContext with same initialData parsing, contextValue creation, error handling, and Suspense wrapping; differ only in which component registry they load from)

### 7.2 Merge overlay effects
- [ ] Merge `FocusHighlight.tsx` (52 lines) and `EmoteOverlay.tsx` (97 lines) into a single `ScreenEffects.tsx` — both are pointer-events-none overlay layers with similar visibility/animation lifecycle patterns

### 7.3 Result structure
```
client/src/modules/display/components/
  Board.tsx               # keep
  BundleRenderer.tsx      # keep
  LessonRenderer.tsx      # keep
  ContentRenderer.tsx     # NEW: merged GamePod + InteractiveLesson
  SharedCursors.tsx       # keep
  Annotations.tsx         # keep
  ScreenEffects.tsx       # NEW: merged FocusHighlight + EmoteOverlay
  ui/                     # keep as-is
```

---

## Phase 8: Client Room.tsx Decomposition (single page)

**Scope:** `client/src/pages/Room.tsx` — break up the 373-line god component.

### 8.1 Extract custom hooks
- [ ] `useSessionData()` — extract session loading from localStorage (currently inline in Room.tsx)
- [ ] `useRoomTranscript()` — extract transcript management with turn-sealing logic (currently ~40 lines of refs and callbacks)
- [ ] `useRoomParticipants()` — extract LiveKit participant mapping to app Participant type

Place these in `client/src/modules/realtime/hooks/`.

### 8.2 Simplify useGameState
- [ ] Remove unused phases, remove `setTimeout(..., 0)` cleanup hack
- [ ] Simplify to `{ isRunning, gameType, updateState, setRunning }`

---

## Phase 9: Client Logger Merge (small)

**Scope:** `client/src/lib/` — merge overlapping logging.

### 9.1 Unify logger + log-forwarder
- [ ] Merge `logger.ts` and `log-forwarder.ts` into a single `logger.ts` that:
  - Creates structured loggers with module context
  - Optionally batches and forwards to `/api/logs`
  - Removes global console monkey-patching in favor of explicit logger instances

---

## Not Refactoring (intentional)

These were flagged but are acceptable as-is:

| Item | Reason to keep |
|------|---------------|
| Engine module (8 files, 800+ lines) | Well-designed, will be used by game plugins. Not hurting anything. |
| Realtime hooks (6 separate hooks) | Good separation, each has distinct responsibility |
| Global singleton pattern (db, redis) | Standard FastAPI pattern. DI can come later. |
| Tool parameter models (8 models) | Match 1:1 with tool definitions, Pydantic requires this |
| Cursor-sync vs awareness duplication | Different throttling strategies, acceptable |
| Client types mirroring server | No shared schema possible (Python+TS). Manual sync is fine. |
| useBundleLoader manual cache | Simple enough for now. React Query is overkill. |
| GeminiSession callbacks (8 hooks) | Complex but matches Gemini Live API surface. on_setup_complete and on_transcription are unwired but reasonable to keep for extensibility. |
| content_generator.py (292 lines) | Distinct responsibility from request_handler (generation vs orchestration). Worth keeping separate. |
| ControlBar.tsx (143 lines) | Dense but functional. Splitting into MicButton, CameraButton etc. is premature. |

---

## Vision Alignment Check

| Vision Requirement | Status |
|---|---|
| Python FastAPI server | Done |
| React Vite frontend (no Next.js) | Done |
| Teacher as server-side LiveKit Agent | Done |
| TA agent with Gemini Flash | Done |
| In-process Teacher->TA calls | Done |
| Redis pub/sub for server->browser | Done |
| SSE endpoint for browser events | Done |
| Yjs via pycrdt-websocket | Done |
| PostgreSQL + pgvector | Done |
| Template registry scanning data/ | Done |
| Tool system with auth + rate limit | Done |
| Docker Compose infrastructure | Done |
| <100ms sync, <2s load target | Architecture supports it, not measured yet |

**No architectural gaps.** All vision modules are implemented. Refactoring is about code quality, not missing features.

---

## Execution Order

Phases are independent and can be worked by separate agents in parallel:

```
Phase 1 (Cleanup)          -- no deps, do first
Phase 2 (Storage Dedup)    -- server/storage/ only
Phase 3 (Tools Simplify)   -- server/tools/ only
Phase 4 (TA Consolidate)   -- server/agents/ta/ only
Phase 5 (Event Dedup)      -- cross-cutting, after Phase 4
Phase 6 (API Renames)      -- server/api/ only, after Phase 5
Phase 7 (Display Merge)    -- client/display/ only
Phase 8 (Room Decompose)   -- client/pages/ only
Phase 9 (Logger Merge)     -- client/lib/ only
```

Phases 1-4 and 7-9 can run in parallel. Phase 5 depends on Phase 4. Phase 6 depends on Phase 5.
