# Refactor Plan

## Review Summary

Full codebase review found: **over-engineering**, **code duplication**, **separation of concerns violations**, and **dead code**. The architecture matches the vision (FastAPI + Vite, LiveKit Agents, Gemini, Redis pub/sub, Yjs, pgvector). No structural gaps vs plan.md/vision.md. Issues are implementation-level, not architectural.

---

## Phase 1: Dead Code & Cleanup (low risk, high clarity)

**Scope:** Remove unused code, fix missing files, fix inconsistencies. No logic changes.

### 1.1 Delete dead code
- [ ] Delete `server/server/agents/ta/safety_filter.py` — never imported or called anywhere
- [ ] Delete `client/src/modules/teacher/hooks/useTeacherAudio.ts` — returns only local UI state, actual mic control is in `useVoice.ts`
- [ ] Remove unused `GamePhase` states ("starting", "error") from `client/src/modules/display/hooks/useGameState.ts`
- [ ] Remove `_dirs_for_type` unused `expected_type` field in `server/server/content/templates.py`

### 1.2 Add missing `__init__.py` files
- [ ] `server/server/agents/__init__.py`
- [ ] `server/server/agents/ta/__init__.py`
- [ ] `server/server/agents/teacher/__init__.py`
- [ ] `server/server/api/__init__.py`

### 1.3 Fix logging inconsistency
- [ ] Replace `logging.getLogger()` with `get_logger()` from `server/server/logging.py` in:
  - `server/server/storage/db.py`
  - `server/server/storage/queries/users.py`
  - `server/server/storage/queries/profiles.py`
  - `server/server/storage/queries/progress.py`
  - `server/server/storage/queries/sessions.py`

### 1.4 Fix assertions in production code
- [ ] Replace `assert self._redis is not None` with `if not self._redis: raise RuntimeError(...)` in `server/server/events/redis_bridge.py`
- [ ] Same pattern in `server/server/storage/db.py` (`get_pool()`)

---

## Phase 2: Server Storage Dedup (single module, safe)

**Scope:** `server/server/storage/` — eliminate duplicated query patterns.

### 2.1 Extract shared SQL helpers
- [ ] Create `server/server/storage/queries/_helpers.py` with:
  - `build_update_sql(table, fields_dict, where_clause)` — replaces the duplicated dynamic UPDATE pattern in `users.py` (lines 118-147) and `profiles.py` (lines 50-90)
  - `format_vector(embedding)` — replaces duplicated pgvector string formatting in `profiles.py` (lines 96, 111)

### 2.2 Deduplicate SQL JOIN clauses
- [ ] Extract shared user+profile SELECT clause used in `users.py` and `profiles.py` into a constant `USER_PROFILE_SELECT` in `_helpers.py`

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
- [ ] `auth.py` (47 lines, 2 functions) and `rate_limit.py` (77 lines) are only used by `registry.py`. Consider inlining if we want fewer files. **Low priority** — current separation is acceptable.

---

## Phase 4: TA Agent Consolidation (single module)

**Scope:** `server/server/agents/ta/` — reduce 6 files to 3.

### 4.1 Merge request_handler + content_generator
- [ ] Merge `request_handler.py` (149 lines) into `content_generator.py` (292 lines) as a single `core.py` — they form one pipeline and `request_handler` is just orchestration over `content_generator`
- [ ] Move `personalizer.py` functions (`build_personalization_context`, `adjust_difficulty`) into `core.py` — only 2 functions, 135 lines, tightly coupled to the generation pipeline

### 4.2 Simplify dependency injection
- [ ] Remove `TADependencies` dataclass and `_build_dependencies()` factory in `agent.py` — pass dependencies directly to the pipeline function instead of wrapping them in async closures

### 4.3 Result structure
```
server/server/agents/ta/
  __init__.py
  models.py      # TARequest, TAResponse, GenerateParams (keep as-is)
  core.py         # merged: content_generator + request_handler + personalizer
  agent.py        # simplified: just manages lifecycle, calls core directly
```

---

## Phase 5: Event Publishing Dedup (cross-cutting)

**Scope:** Extract duplicated event envelope construction.

### 5.1 Create event helper
- [ ] Add `publish_event(channel, event_type, payload, source_id)` to `server/server/events/bus.py` or a new `server/server/events/helpers.py`
- [ ] Replace duplicated envelope construction in:
  - `server/server/agents/ta/request_handler.py` (line 108)
  - `server/server/api/session_manager.py` (lines 109-114, 153-158, 181-186)
  - `server/server/agents/teacher/agent.py` (lines 294-301, 327-333)

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
- [ ] Merge `GamePodRenderer.tsx` and `InteractiveLessonRenderer.tsx` into a single `ContentRenderer.tsx` — they are 95% identical (both wrap components in GameContext with same logic, differ only in type guard)

### 7.2 Merge overlay effects
- [ ] Merge `FocusHighlight.tsx` (53 lines) and `EmoteOverlay.tsx` (98 lines) into a single `ScreenEffects.tsx` — both are small overlay components rendered on top of the board

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

Place these in `client/src/modules/realtime/hooks/` or `client/src/pages/hooks/`.

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
| GeminiSession callbacks | Complex but matches Gemini Live API surface |

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
