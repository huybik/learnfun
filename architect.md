# LearnFun (LearnFun) Architecture

## System Overview

An interactive AI learning platform where an AI Teacher (Gemini Live voice) conducts real-time lessons and games with students, assisted by a Teaching Assistant (Gemini Flash) that generates content on demand.

```
+=====================================================================+
|                           B R O W S E R                             |
|                                                                     |
|  +----------+     +-------------+     +-------------------------+   |
|  |          |     |             |     |        Board            |   |
|  | Home.tsx |---->|  Room.tsx   |---->| +-----+ +-----+ +-----+|   |
|  | (create  |     |  (hooks,   |     | |Game | |Lesson| |FX   ||   |
|  |  session)|     |   layout)  |     | |Pods | |Render| |Layer||   |
|  +----+-----+     +---+---+----+     | +-----+ +-----+ +-----+|   |
|       |               |   |          +------------^------------+   |
|       |   +-----------+   +----------+            |                |
|       |   | LiveKit        | SSE      | fetch     |                |
|       |   | audio          | events   | bundles   |                |
+=======|===|================|==========|===========|================+
        |   |                |          |           |
        |   |                |          |           |
+=======|===|================|==========|===========|================+
|       v   v                v          v           |    S E R V E R |
|  +----------+    +----------+    +---------+      |                |
|  |  FastAPI  |   | LiveKit  |    |  Redis  |      |                |
|  |  /api/*   |   | Server   |    | Pub/Sub |<-----+                |
|  +-----+-----+  +----+-----+    +----^----+                       |
|        |              |              |                              |
|        v              v              |                              |
|  +-----------+  +-----------+--------+                              |
|  |    TA     |  |  Teacher  |                                       |
|  |   Agent   |  |   Agent   |                                       |
|  +-----+-----+  +-----+----+                                       |
|        |               |                                            |
|  +-----v-----+   +-----v------+    +----------+    +-----------+   |
|  |  Gemini   |   |  Gemini    |    | Postgres |    |  Yjs WS   |   |
|  |  Flash    |   |  Live API  |    | +pgvector |    | (pycrdt)  |   |
|  +-----------+   +------------+    +----------+    +-----------+   |
+=====================================================================+
```

---

## Startup Sequence (`main.py` lifespan)

```
  FastAPI app.lifespan
  |
  |  STARTUP
  |  =======
  |  +--> init_db()                  asyncpg pool (2..20 conns) --> PostgreSQL
  |  +--> redis_bridge.connect()     aioredis singleton         --> Redis
  |  +--> start_yjs()                pycrdt WebsocketServer     --> /yjs/*
  |  +--> ta_agent.start()           TAAgent + ContentGenerator --> Gemini Flash
  |  +--> _register_placeholder_tools()  no-op stubs for 8 tools
  |  +--> app.state.ta_agent = ta_agent
  |  +--> app.state.tool_registry = tool_registry
  |  +--> mount routers: /api/*
  |  +--> mount Yjs:     /yjs/*
  |
  |  yield  <-- app is running -->
  |
  |  SHUTDOWN
  |  ========
  |  +--> ta_agent.stop()
  |  +--> stop_yjs(task)
  |  +--> redis_bridge.close()
  |  +--> close_db()
```

---

## 1. API Layer (`server/api/`)

### Route Map

```
  +------------------------------------------------------------------+
  |                     FastAPI  /api  router                         |
  +------------------------------------------------------------------+
  |                                                                  |
  |  POST /session -----> session.py -----> room_manager             |
  |  POST /join --------> join.py -------> room_manager              |
  |  GET  /get-token ----> token.py -----> tokens (JWT mint)         |
  |  GET  /room/{id}/events -> events.py -> Redis sub -> SSE stream  |
  |  POST /ta -----------> ta.py --------> TAAgent.handle_request()  |
  |  GET  /bundles/{id} -> bundles.py ----> content/bundles           |
  |  GET  /health -------> health.py ----> active session count      |
  |  POST /logs ---------> logs.py ------> (client log ingestion)    |
  |                                                                  |
  +------------------------------------------------------------------+
```

### Session + Join Flow (`room_manager.py`)

```
  Browser                     room_manager                  Redis
  =======                     ============                  =====
     |                             |                          |
     |  POST /api/session          |                          |
     |  { userName, voice, lang }  |                          |
     |---------------------------->|                          |
     |                             |                          |
     |                     gen session_id (uuid)              |
     |                     gen room_id    (uuid)              |
     |                     gen user_id    (uuid)              |
     |                             |                          |
     |                     _sessions[session_id] = {          |
     |                       room_id, host_id,                |
     |                       participants: [user_id]          |
     |                     }                                  |
     |                             |                          |
     |                     generate_session_token() -> JWT    |
     |                     generate_livekit_token() -> JWT    |
     |                             |                          |
     |                             |--- publish_event ------->|
     |                             |    "room.created"        |
     |                             |                          |
     |<----------------------------+                          |
     |  { sessionId, roomId,       |                          |
     |    token, livekitToken,     |                          |
     |    livekitUrl }             |                          |
     |                             |                          |
     |  POST /api/join             |                          |
     |  { sessionId, userName }    |                          |
     |---------------------------->|                          |
     |                             |                          |
     |                     lookup _sessions[sessionId]        |
     |                     gen user_id, append to .participants
     |                     generate_session_token(role=student)
     |                     generate_livekit_token()           |
     |                             |--- publish_event ------->|
     |                             |    "room.user_joined"    |
     |<----------------------------+                          |
     |  { token, livekitToken,     |                          |
     |    livekitUrl }             |                          |
```

### SSE Event Bridge (`events.py`)

```
  Redis Pub/Sub                    events.py                     Browser
  ==============                   =========                     =======
       |                               |                            |
       |    GET /api/room/{id}/events  |                            |
       |                               |<---------------------------|
       |                               |                            |
       |  subscribe 4 channels:        |  SSE: "connected"         |
       |  +---------------------------+|--------------------------->|
       |  |                           ||                            |
       |  | room.{id}.content         ||                            |
       |  | room.{id}.ui             ||                            |
       |  | room.{id}.game.started   ||                            |
       |  | room.{id}.game.ended     ||                            |
       |  +---------------------------+|                            |
       |                               |                            |
       |--- message on .content ------>|  SSE: "content_ready"     |
       |                               |--------------------------->|
       |                               |                            |
       |--- message on .ui ----------->|  SSE: "ui_control"        |
       |                               |--------------------------->|
       |                               |                            |
       |         (every 15s)           |  ": ping\n\n"             |
       |                               |--------------------------->|
       |                               |                            |
       |                               |  (client disconnects)      |
       |  unsubscribe all channels     |<---------------------------|
       |<------------------------------|                            |
```

---

## 2. Teacher Agent (`server/agents/teacher/`)

### Internal Structure

```
  +====================================================================+
  |                        TeacherAgent                                |
  +====================================================================+
  |                                                                    |
  |  +-------------------+     +----------------------------------+   |
  |  | voice_config.py   |     |       system_prompt.py            |   |
  |  |                   |     |                                    |   |
  |  | resolve_voice()   |     | build_teacher_prompt()            |   |
  |  | TEACHER_VOICES[]  |     |   personality + rules +            |   |
  |  | SUPPORTED_LANGS[] |     |   participants + tools +           |   |
  |  +--------+----------+     |   content catalog                  |   |
  |           |                +----------------+-------------------+   |
  |           |                                 |                       |
  |           v                                 v                       |
  |  +--------+------------------------------------------+             |
  |  |              GeminiSession                         |             |
  |  |  (gemini_session.py)                               |             |
  |  |                                                    |             |
  |  |  connect() / disconnect() / _reconnect()           |             |
  |  |  send_audio() / send_text() / send_tool_response() |             |
  |  |  _receive_loop() -> callbacks                      |             |
  |  +----+-----------+-----------+-----------+-----------+             |
  |       |           |           |           |                         |
  |    on_audio   on_tool_call  on_turn    on_error                    |
  |       |           |        _complete      |                         |
  |       v           v           |           v                         |
  |  +---------+  +----------+   |     (log + reconnect)               |
  |  | LiveKit |  | Tool     |   |                                     |
  |  | publish |  | dispatch |   |                                     |
  |  | audio   |  |          |   |                                     |
  |  +---------+  +-----+----+   |                                     |
  |                     |        |                                     |
  +=====================|========|=====================================+
                        |        |
         +--------------+--------+---------+
         |                                 |
    request_ta_action               other tools
         |                                 |
    TAAgent                        ToolRegistry
```

### Audio Bridge Detail

```
  Student's              LiveKit               TeacherAgent            Gemini
  Microphone             Server                                     Live API
  ==========             ======                ============          ========
      |                    |                        |                    |
      |  mic audio         |                        |                    |
      |--(WebRTC)--------->|                        |                    |
      |                    |  track_subscribed      |                    |
      |                    |----------------------->|                    |
      |                    |                        |                    |
      |                    |  AudioStream           |                    |
      |                    |  (PCM16, 16kHz, mono)  |                    |
      |                    |----------------------->|                    |
      |                    |                        |                    |
      |                    |         _forward_audio_to_gemini()         |
      |                    |                        |                    |
      |                    |                        |  send_audio()     |
      |                    |                        |  (PCM16 blob)     |
      |                    |                        |--(WebSocket)----->|
      |                    |                        |                    |
      |                    |                        |     (thinks...)   |
      |                    |                        |                    |
      |                    |                        |  on_audio()       |
      |                    |                        |  (PCM16, 24kHz)   |
      |                    |                        |<-(WebSocket)------|
      |                    |                        |                    |
      |                    |  audio_source          |                    |
      |                    |  .capture_frame()      |                    |
      |                    |<-----------------------|                    |
      |                    |                        |                    |
      |  teacher voice     |                        |                    |
      |<--(WebRTC)---------|                        |                    |
      |                    |                        |                    |
  Student's
  Speaker
```

### Tool Call Dispatch

```
  Gemini Live API           TeacherAgent              ToolRegistry / TAAgent
  ===============           ============              ======================
       |                         |                           |
       |  tool_call              |                           |
       |  [{name, id, args}]     |                           |
       |------------------------>|                           |
       |                         |                           |
       |            _execute_tool_call(fc)                   |
       |                         |                           |
       |                  +------+------+                    |
       |                  |             |                    |
       |           name ==              name !=              |
       |       "request_ta_action"   "request_ta_action"     |
       |                  |             |                    |
       |         _dispatch_ta       registry.execute()       |
       |          _action()         (auth+rate+validate)     |
       |                  |             |                    |
       |           TAAgent.handle       handler(params,ctx)  |
       |           _request()           |                    |
       |                  |             |                    |
       |                  |             +------+             |
       |                  |                    |             |
       |                  v                    v             |
       |          +-------+--------+   +-------+--------+   |
       |          | publish_event  |   | publish_event  |   |
       |          | CONTENT_PUSH   |   | UI_CONTROL     |   |
       |          | -> Redis       |   | -> Redis       |   |
       |          +-------+--------+   +-------+--------+   |
       |                  |                    |             |
       |   send_tool_response     send_tool_response        |
       |   (scheduling=WHEN_IDLE) (immediate)               |
       |<-----------------+--------------------+             |
       |                                                     |
```

---

## 3. GeminiSession (`gemini_session.py`)

### Connection Lifecycle

```
  +------------------------------------------------------------------+
  |                    GeminiSession States                           |
  +------------------------------------------------------------------+
  |                                                                  |
  |                      connect()                                   |
  |   DISCONNECTED -----------------> CONNECTED                      |
  |        ^                             |                           |
  |        |                             |  _receive_loop()          |
  |        |                             |  running as bg task       |
  |        |                             |                           |
  |        |   disconnect()              |  msg.go_away              |
  |        +-----------------------------+-------+                   |
  |        |                                     |                   |
  |        |                              RECONNECTING               |
  |        |                              (up to 3 retries,          |
  |        |                               2s * attempt delay)       |
  |        |                                     |                   |
  |        |                              success? -> CONNECTED      |
  |        +---- all retries failed <--- failure?                    |
  |                                                                  |
  +------------------------------------------------------------------+
```

### Message Processing (`_receive_loop`)

```
  Gemini WebSocket             _handle_message()              Callbacks
  ================             ==================             =========
       |                             |                            |
       |  async for msg in session   |                            |
       |                             |                            |
       |  msg.usage_metadata ------->|  log token counts          |
       |                             |                            |
       |  msg.session_resumption     |                            |
       |  _update --------------->|  save _session_handle      |
       |                             |  _session_resumable       |
       |                             |                            |
       |  msg.go_away -------------->|  create_task(_reconnect)   |
       |                             |                            |
       |  msg.tool_call ------------>|  on_tool_call(fc_list) --->|
       |                             |                            |
       |  msg.tool_call              |                            |
       |  _cancellation ------------>|  log cancelled ids         |
       |                             |                            |
       |  msg.setup_complete ------->|  on_setup_complete() ----->|
       |                             |                            |
       |  server_content             |                            |
       |  .interrupted ------------->|  on_interrupted() -------->|
       |                             |                            |
       |  server_content             |                            |
       |  .turn_complete ----------->|  on_turn_complete() ------>|
       |                             |                            |
       |  server_content             |                            |
       |  .output_transcription ---->|  on_transcription -------->|
       |                             |  ("ai", text)              |
       |                             |                            |
       |  server_content             |                            |
       |  .input_transcription ----->|  on_transcription -------->|
       |                             |  ("user", text)            |
       |                             |                            |
       |  server_content             |                            |
       |  .model_turn.parts          |                            |
       |  [inline_data audio/pcm] -->|  on_audio(bytes) --------->|
       |                             |                            |
```

### Send Methods

```
  TeacherAgent                    GeminiSession                Gemini API
  ============                    =============                ==========
       |                               |                          |
       |  send_audio(pcm_bytes)        |                          |
       |------------------------------>|  send_realtime_input     |
       |                               |  (Blob, audio/pcm)      |
       |                               |------------------------->|
       |                               |                          |
       |  send_audio_stream_end()      |                          |
       |------------------------------>|  send_realtime_input     |
       |                               |  (audio_stream_end=True) |
       |                               |------------------------->|
       |                               |                          |
       |  send_text(text)              |                          |
       |------------------------------>|  send_client_content     |
       |                               |  (Content, turn_complete)|
       |                               |------------------------->|
       |                               |                          |
       |  send_tool_response(          |                          |
       |    call_id, name,             |                          |
       |    response, scheduling)      |                          |
       |------------------------------>|  send_tool_response      |
       |                               |  (FunctionResponse +     |
       |                               |   scheduling enum)       |
       |                               |------------------------->|
       |                               |                          |
```

---

## 4. TA Agent (`server/agents/ta/`)

### Pipeline Overview

```
  +=======================================================================+
  |                          TA Agent Pipeline                            |
  +=======================================================================+
  |                                                                       |
  |  INPUT: TARequest                                                     |
  |  { request_id, intent, context, room_id, user_profiles }             |
  |                                                                       |
  |  +---+  +----------+  +----------+  +--------+  +------+  +------+  |
  |  | 1 |  |    2     |  |    3     |  |   4    |  |  5   |  |  6   |  |
  |  |   |  |          |  |          |  |        |  |      |  |      |  |
  |  |Que|->|Personal- |->| Adjust   |->|Generate|->|Store |->|Publi-|  |
  |  |ry |  |ize       |  | Diffic.  |  |Content |  |Bundle|  |sh to |  |
  |  |Tpl|  |          |  |          |  |        |  |      |  |Redis |  |
  |  +---+  +----------+  +----------+  +--------+  +------+  +------+  |
  |    |         |              |            |           |          |     |
  |    v         v              v            v           v          v     |
  |  Template  Prompt       Difficulty    Gemini     bundle.json  SSE    |
  |  Manifest  additions    hint str     Flash API   on disk    to room |
  |                                       (JSON)                        |
  |                                                                       |
  |  OUTPUT: TAResponse                                                   |
  |  { request_id, success, bundle, filled_data, elapsed }               |
  +=======================================================================+
```

### Step 1: Template Resolution (`content_generator.py`)

```
  intent string                ContentGenerator              Templates on disk
  =============                ================              ================
       |                             |                             |
       |                             |  list_templates()           |
       |                             |---------------------------->|
       |                             |  [TemplateManifest, ...]    |
       |                             |<----------------------------|
       |                             |                             |
       |  resolve_template(intent, templates)                      |
       |                             |                             |
       |                    +--------+--------+                    |
       |                    |                 |                    |
       |           heuristic match       AI fallback              |
       |                    |                 |                    |
       |        +------+----+----+      Gemini Flash              |
       |        |           |    |      prompt: catalog            |
       |        v           v    v      + intent                   |
       |     alias       lexical |      -> { "id": "..." }        |
       |     lookup      scoring |            |                    |
       |     (5 maps)    (tokens)|            |                    |
       |        |           |    |            |                    |
       |        +------+----+    |            |                    |
       |               |        |            |                    |
       |               v        +-----+------+                    |
       |            best match        |                            |
       |                              v                            |
       |                      TemplateManifest | None              |
       |                                                           |
       |  Alias map:                                               |
       |    "spaceshooter" <- space shooter, shooter, space game   |
       |    "solar-system" <- solar system, planets, astronomy     |
       |    "flashcard"    <- flash card, cards, quiz              |
       |    "wordmatch"    <- word match, matching, pair words     |
       |    "sentencebuilder" <- sentence builder, build sentence  |
```

### Steps 2-3: Personalization + Difficulty

```
  user_profiles[]               request_handler.py              PostgreSQL
  ===============               ==================              ==========
       |                              |                              |
       |  build_personalization       |                              |
       |  _context(profiles, intent)  |                              |
       |                              |                              |
       |  Extract from profiles:      |                              |
       |  +-- observations[]     ---->| "Learner observations: ..."  |
       |  +-- interests (regex)  ---->| "interests include: ..."     |
       |  +-- language pref      ---->| "Target language: vi-VN"     |
       |  +-- names              ---->| "Learner names: Minh, ..."   |
       |                              |                              |
       |  Returns:                    |                              |
       |  PersonalizationContext {    |                              |
       |    prompt_additions: str     |                              |
       |    applied_factors: [...]    |                              |
       |  }                           |                              |
       |                              |                              |
       |  adjust_difficulty()         |                              |
       |                              |  get_progress(user_id)       |
       |                              |----------------------------->|
       |                              |  LearningProgress {          |
       |                              |    total_points,             |
       |                              |    current_streak,           |
       |                              |    unit_progress{}           |
       |                              |  }                           |
       |                              |<-----------------------------|
       |                              |                              |
       |  +---------------------------+----------+                   |
       |  | points < 50 & units <= 1 |  "easy"  |                   |
       |  | points < 200 | units <= 3|  "medium" |                   |
       |  | otherwise                |  "hard"   |                   |
       |  | streak >= 5              |  +bonus   |                   |
       |  +---------------------------+----------+                   |
       |                              |                              |
       |  Returns:                    |                              |
       |  DifficultyAdjustment {      |                              |
       |    difficulty, hint          |                              |
       |  }                           |                              |
```

### Step 4: Content Generation

```
  ContentGenerator             Gemini Flash API            Template Slots
  ================             ================            ==============
       |                            |                           |
       |  _build_prompt():          |                           |
       |  +-- template desc         |                     slots defined
       |  +-- intent                |                     in manifest.json
       |  +-- context               |                           |
       |  +-- personalization       |                           |
       |  +-- difficulty hint       |                           |
       |  +-- AI instructions       |                           |
       |                            |                           |
       |  _build_response_schema(): |                           |
       |  { type: OBJECT,           |                           |
       |    properties: {           |                           |
       |      [slot.id]: {          |                           |
       |        type: STRING,       |                           |
       |        description: label  |                           |
       |      }, ...                |                           |
       |    },                      |                           |
       |    required: [...]         |                           |
       |  }                         |                           |
       |                            |                           |
       |  generate_content(         |                           |
       |    model, prompt,          |                           |
       |    response_mime_type=     |                           |
       |      "application/json",   |                           |
       |    response_schema)        |                           |
       |--------------------------->|                           |
       |                            |                           |
       |  { "word_pairs": "[...]",  |                           |
       |    "theme": "animals",     |                           |
       |    "hint_text": "..." }    |                           |
       |<---------------------------|                           |
       |                            |                           |
       |  Returns: dict[str, Any]   |                           |
       |  (filled slot values)      |                           |
```

### Steps 5-7: Bundle Storage + Publish

```
  request_handler            bundles.py              Redis               Browser
  ===============            ==========              =====               =======
       |                         |                     |                    |
       |  FilledBundle {         |                     |                    |
       |    templateId,          |                     |                    |
       |    sessionId,           |                     |                    |
       |    filledSlots,         |                     |                    |
       |    createdAt            |                     |                    |
       |  }                      |                     |                    |
       |                         |                     |                    |
       |  store_bundle(bundle)   |                     |                    |
       |------------------------>|                     |                    |
       |                         |  write to:          |                    |
       |                         |  data/bundles/      |                    |
       |                         |   {sessionId}/      |                    |
       |                         |    bundle.json      |                    |
       |  bundle_id              |                     |                    |
       |<------------------------|                     |                    |
       |                         |                     |                    |
       |  publish_event(                               |                    |
       |    channel=room.{id}.content,                 |                    |
       |    type="ta.content_ready",                   |                    |
       |    payload={contentId, bundlePath})            |                    |
       |---------------------------------------------->|                    |
       |                                               |  SSE: content_ready|
       |                                               |--(events.py)------>|
       |                                               |                    |
       |                                               |    GET /api/bundles|
       |                                               |    /{contentId}    |
       |                                               |<-------------------|
       |                                               |    FilledBundle    |
       |                                               |------------------->|
       |                                               |                    |
```

---

## 5. Event System (`server/events/`)

### Architecture

```
  +====================================================================+
  |                        Event System                                |
  +====================================================================+
  |                                                                    |
  |  +------------------+       +-------------------+                  |
  |  |  helpers.py       |       |  subjects.py      |                  |
  |  |                  |       |                   |                  |
  |  |  publish_event() |       |  SUBJECTS = {     |                  |
  |  |  serialize_event()|       |   CONTENT_PUSH,   |                  |
  |  +--------+---------+       |   UI_CONTROL,     |                  |
  |           |                 |   GAME_STARTED,   |                  |
  |           |                 |   GAME_ENDED,     |                  |
  |           v                 |   ROOM_CREATED,   |                  |
  |  +--------+---------+       |   ROOM_JOINED,    |                  |
  |  |  redis_bridge.py  |       |   ROOM_CLOSED,    |                  |
  |  |  (RedisBridge)    |       |   ...             |                  |
  |  |                  |       | }                 |                  |
  |  |  .publish(ch,data)|       |                   |                  |
  |  |  .subscribe(ch)  |       |  room_subject(     |                  |
  |  |    -> AsyncIter   |       |   tpl, room_id)   |                  |
  |  +--------+---------+       +-------------------+                  |
  |           |                                                        |
  |           v                                                        |
  |  +--------+---------+       +-------------------+                  |
  |  |  Redis Server     |       |  bus.py            |                  |
  |  |  (external)       |       |  (InProcessBus)    |                  |
  |  |                  |       |                   |                  |
  |  |  Channels:       |       |  .subscribe(ch,fn)|                  |
  |  |  room.{id}.content|       |  .publish(ch,data)|                  |
  |  |  room.{id}.ui    |       |  (in-process,     |                  |
  |  |  room.{id}.game.* |       |   not used in     |                  |
  |  |  room.created    |       |   current flow)   |                  |
  |  |  room.closed     |       +-------------------+                  |
  |  +------------------+                                              |
  |                                                                    |
  |  +------------------+                                              |
  |  |  models.py        |                                              |
  |  |                  |                                              |
  |  |  Participant {    |   Event Envelope:                            |
  |  |    id, name,      |   {                                          |
  |  |    role, joined,  |     "type": "ta.content_ready",              |
  |  |    lk_identity    |     "timestamp": 1709856000.123,             |
  |  |  }                |     "sourceId": "ta-agent",                  |
  |  |  Room {           |     "payload": { ... }                       |
  |  |    id, name,      |   }                                          |
  |  |    host_id,       |                                              |
  |  |    participants[] |                                              |
  |  |  }                |                                              |
  |  +------------------+                                              |
  +====================================================================+
```

### Event Flow Map

```
  WHO PUBLISHES              CHANNEL                   WHO SUBSCRIBES
  ==============             =======                   ==============

  room_manager         room.created                (global listeners)
  room_manager         room.{id}.joined            (global listeners)
  room_manager         room.closed                 (global listeners)

  TeacherAgent         room.{id}.ui                events.py -> SSE -> Browser
   (tool results)       (ui_control)

  TeacherAgent         room.{id}.content           events.py -> SSE -> Browser
   (_dispatch_ta)       (ta_response)

  request_handler      room.{id}.content           events.py -> SSE -> Browser
   (TA pipeline)        (ta.content_ready)

  (future)             room.{id}.game.started      events.py -> SSE -> Browser
  (future)             room.{id}.game.ended        events.py -> SSE -> Browser
```

---

## 6. Tool System (`server/tools/`)

### Execution Pipeline

```
  +====================================================================+
  |                   ToolRegistry.execute()                            |
  +====================================================================+
  |                                                                    |
  |  INPUT: name (ToolName), params (dict), caller (CallerIdentity)    |
  |                                                                    |
  |  +-------+    +--------+    +---------+    +--------+    +------+  |
  |  |   1   |    |   2    |    |    3    |    |   4    |    |  5   |  |
  |  |       |    |        |    |         |    |        |    |      |  |
  |  |Lookup |--->| Auth   |--->| Rate    |--->|Validate|--->|Invoke|  |
  |  |tool in|    | check  |    | Limit   |    |Pydantic|    |handler  |
  |  |_tools |    |        |    |         |    |schema  |    |      |  |
  |  |dict   |    |        |    |         |    |        |    |      |  |
  |  +---+---+    +---+----+    +----+----+    +---+----+    +---+--+  |
  |      |            |              |             |             |      |
  |   unknown?     role not in    >30 calls/    validation   exception?|
  |      |         allowed_callers  minute        error          |      |
  |      v            v              v             v             v      |
  |  ToolResponse  ToolResponse  ToolResponse  ToolResponse  ToolResponse
  |  success=false success=false success=false success=false success=*  |
  |  "Unknown      "Role X not  "Rate limit  "Validation   data/error  |
  |   tool: ..."    allowed"     exceeded"    error: ..."              |
  |                                                                    |
  +====================================================================+

  auth.py:
  +--------------------+--------------------------------------------+
  | validate_caller()  | Check caller.role in tool.allowed_callers  |
  | tools_for_role()   | List tool names a role can use             |
  +--------------------+--------------------------------------------+

  rate_limit.py:
  +--------------------+--------------------------------------------+
  | RateLimiter        | Sliding window: 30 calls per 60s           |
  |                    | Key: "{caller_id}:{tool_name}"             |
  |                    | Returns: RateLimitResult{allowed, retry_ms}|
  +--------------------+--------------------------------------------+
```

### Tool Definitions

```
  +=======================+==========+==========================================+
  | Tool Name             | Callers  | Params Schema                            |
  +=======================+==========+==========================================+
  | request_ta_action     | teacher  | intent (str), context (dict),            |
  |                       |          | urgency (low|normal|high)                |
  +-----------------------+----------+------------------------------------------+
  | query_content         | ta       | type (lesson|game), tags?,               |
  |                       |          | difficulty?, userContext?                |
  +-----------------------+----------+------------------------------------------+
  | execute_filled_bundle | ta       | bundleId (str), roomId (str),            |
  |                       |          | filledData (dict)                        |
  +-----------------------+----------+------------------------------------------+
  | light_control         | teacher  | action (highlight|pause|resume|          |
  |                       |          |   emote|focus), params (dict)            |
  +-----------------------+----------+------------------------------------------+
  | signal_feedback       | both     | type (correct|incorrect|info),           |
  |                       |          | points? (int), message? (str)            |
  +-----------------------+----------+------------------------------------------+
  | update_profile        | both     | observation (str, min 1 char)            |
  +-----------------------+----------+------------------------------------------+
  | load_content          | both     | contentType (unit|template|bundle),      |
  |                       |          | contentId (str), page? (int)             |
  +-----------------------+----------+------------------------------------------+
  | get_room_state        | both     | roomId (str), include? [participants,    |
  |                       |          |   content, annotations, cursors]         |
  +=======================+==========+==========================================+
```

---

## 7. Content System (`server/content/`)

### File Structure + Data Flow

```
  data/
  +-------------------------------------------------------------------+
  | games/                                                             |
  |   flashcard/                                                       |
  |     manifest.json -----> TemplateManifest (GamePodTemplate)        |
  |     src/                                                           |
  |       index.ts ---------> exports FlashcardGame component          |
  |       FlashcardGame.tsx                                            |
  |                                                                    |
  |   sentencebuilder/       (same structure)                          |
  |   spaceshooter/          (same + types.ts, wave-system.ts, etc.)   |
  |   wordmatch/             (same structure)                          |
  |                                                                    |
  | lessons/                                                           |
  |   solar-system/                                                    |
  |     manifest.json -----> TemplateManifest (LessonTemplate)         |
  |     src/                                                           |
  |       index.ts ---------> exports SolarSystemLesson component      |
  |       SolarSystemLesson.tsx, SolarSystemScene.tsx,                 |
  |       SolarSystemQuiz.tsx, ProceduralPlanet.tsx,                   |
  |       PlanetInfoPanel.tsx, planet-data.ts                          |
  |                                                                    |
  | bundles/                  (runtime-generated)                      |
  |   {sessionId}/                                                     |
  |     bundle.json --------> FilledBundle (AI-filled slot values)     |
  +-------------------------------------------------------------------+
```

### Model Hierarchy

```
  +-----------------------------+
  |     TemplateManifest        |  (base)
  |-----------------------------|
  | id, name, description       |
  | type: "lesson" | "game"     |
  | version, bundlePath         |
  | slots: TemplateSlot[]       |
  | tags?, aiInstructions?      |
  | createdAt, updatedAt        |
  +--------+----------+--------+
           |          |
     +-----+---+  +--+----------+
     |GamePod  |  |  Lesson     |
     |Template |  |  Template   |
     |---------|  |-------------|
     |gameKind:|  |lessonKind?  |
     | wordmatch| |pages: int   |
     | flashcard| |unitId: str  |
     | sentence | +-------------+
     |  builder |
     | space    |
     |  shooter |
     | freeform |
     +---------+

  +-----------------------------+       +-------------------+
  |     TemplateSlot            |       |   FilledBundle    |
  |-----------------------------|       |-------------------|
  | id: str                     |       | templateId        |
  | kind: text|image|audio|video|       | sessionId         |
  | label: str                  |       | filledSlots: {}   |
  | required: bool              |       | bundlePath        |
  | defaultValue?: str          |       | createdAt         |
  +-----------------------------+       +-------------------+
```

### Template -> Bundle Lifecycle

```
  manifest.json         TA Pipeline            bundle.json          Browser
  =============         ===========            ===========          =======
       |                     |                      |                  |
       | list_templates()    |                      |                  |
       |-------------------->|                      |                  |
       |  TemplateManifest   |                      |                  |
       |  { slots: [         |                      |                  |
       |    {id:"word_pairs",|                      |                  |
       |     kind:"text",    |                      |                  |
       |     required:true}, |                      |                  |
       |    {id:"theme", ..} |                      |                  |
       |  ] }                |                      |                  |
       |                     |                      |                  |
       |              Gemini Flash fills slots       |                  |
       |                     |                      |                  |
       |                     |  store_bundle()      |                  |
       |                     |--------------------->|                  |
       |                     |                      |  bundle.json:    |
       |                     |                      |  { templateId,   |
       |                     |                      |    filledSlots: { |
       |                     |                      |      "word_pairs":|
       |                     |                      |       "[...]",   |
       |                     |                      |      "theme":    |
       |                     |                      |       "animals"  |
       |                     |                      |    }}            |
       |                     |                      |                  |
       |                     |                      |  GET /api/bundles|
       |                     |                      |<--------------  |
       |                     |                      |  FilledBundle    |
       |                     |                      |--------------->  |
       |                     |                      |                  |
       |                     |                      |    ContentRenderer
       |                     |                      |    parses slots, |
       |                     |                      |    renders game  |
```

---

## 8. Storage (`server/storage/`)

### Schema + Query Map

```
  +====================================================================+
  |                      PostgreSQL + pgvector                         |
  +====================================================================+
  |                                                                    |
  |  +-----------------------+     +-----------------------------+     |
  |  |    UserProfile        |     |    LearningProgress         |     |
  |  |-----------------------|     |-----------------------------|     |
  |  | id: str (PK)          |     | user_id: str (FK)           |     |
  |  | name: str             |     | total_points: int           |     |
  |  | observations: text[]  |     | current_streak: int         |     |
  |  | preferences: jsonb    |     | highest_streak: int         |     |
  |  |   { voice, language,  |     | unit_progress: jsonb {}     |     |
  |  |     show_avatar }     |     | last_activity_at: timestamp |     |
  |  | created_at: timestamp |     +-----------------------------+     |
  |  | updated_at: timestamp |                                        |
  |  +-----------------------+                                        |
  |                                                                    |
  |  +-----------------------+                                        |
  |  |   SessionRecord       |                                        |
  |  |-----------------------|                                        |
  |  | id: str (PK)          |                                        |
  |  | user_id: str (FK)     |                                        |
  |  | room_id: str          |                                        |
  |  | started_at: timestamp |                                        |
  |  | ended_at: timestamp?  |                                        |
  |  | activities: jsonb[]   |                                        |
  |  | duration_seconds: int?|                                        |
  |  +-----------------------+                                        |
  |                                                                    |
  +====================================================================+

  queries/
  +--------------------+------------------------------------------------+
  | File               | Functions                                      |
  +--------------------+------------------------------------------------+
  | users.py           | create_user, get_user, update_user, list_users |
  | profiles.py        | get_profile, update_profile                    |
  | progress.py        | get_progress(user_id) -> LearningProgress     |
  | sessions.py        | create_session_record, end_session_record      |
  | _helpers.py        | build_update_sql(table, fields, where)         |
  |                    | format_vector(embedding) -> pgvector string    |
  +--------------------+------------------------------------------------+

  db.py (connection pool):
  +-------------------+----------------------------------------------+
  | init_db()         | asyncpg.create_pool(dsn, min=2, max=20)      |
  | get_pool()        | Return active pool (raises if not init'd)    |
  | close_db()        | pool.close()                                 |
  +-------------------+----------------------------------------------+
```

---

## 9. Yjs Sync (`server/sync/yjs_server.py`)

```
  +=======================================================================+
  |                     Yjs Collaborative Sync                            |
  +=======================================================================+
  |                                                                       |
  |   SERVER                                                              |
  |   +-------------------------+                                         |
  |   | pycrdt WebsocketServer  |  mounted at /yjs via ASGIServer        |
  |   | rooms_ready=True        |                                         |
  |   | auto_clean_rooms=True   |  each room = 1 CRDT doc                |
  |   +------------+------------+                                         |
  |                |                                                      |
  |       ws://host/yjs/{room_id}                                         |
  |                |                                                      |
  +=============|==========================================================
                |
  ==============|==========================================================
  |             |                                                         |
  |   CLIENT    |                                                         |
  |   +---------v-----------+                                             |
  |   |  yjs-provider.ts     |  createYjsProvider(roomId, wsUrl)          |
  |   |  Y.Doc + WebSocket   |  -> { doc, provider, awareness }          |
  |   |  Provider             |                                           |
  |   +---------+------------+                                            |
  |             |                                                         |
  |   +---------v------------+                                            |
  |   |   SyncStore           |  Typed wrapper over Y.Doc shared types    |
  |   |   (sync-store.ts)     |                                           |
  |   +-----------------------+                                           |
  |   |                       |                                           |
  |   |  Y.Map("board")       |  { currentBundle, focusPoint, page }     |
  |   |  Y.Map("game")        |  { active, type, data, scores, turns }   |
  |   |  Y.Map("cursors")     |  { [userId]: {x, y, color, name} }      |
  |   |  Y.Array("annotations")|  [ {points, color, userId, ...} ]       |
  |   |  Y.Array("chat")      |  [ {id, userId, text, timestamp} ]      |
  |   |                       |                                           |
  |   |  observe(path, cb)    |  Reactive: triggers React re-render      |
  |   |  getSnapshot()        |  Full state dump                         |
  |   +-----------------------+                                           |
  |                                                                       |
  |   Client hooks that use SyncStore:                                    |
  |   +-------------------+-------------------------------------------+  |
  |   | useSync()          | Read/write board + game state reactively  |  |
  |   | useCursors()       | Read/write cursor positions              |  |
  |   | usePresence()      | User online status via Yjs awareness     |  |
  |   +-------------------+-------------------------------------------+  |
  +=======================================================================+
```

---

## 10. Client Application (`client/src/`)

### Page Navigation

```
  +====================================================================+
  |                           App.tsx                                   |
  |                     (react-router-dom)                              |
  +====================================================================+
  |                                                                    |
  |     Route "/"                        Route "/room/:roomId"         |
  |     +----------+                     +-------------------+         |
  |     |          |  POST /api/session  |                   |         |
  |     | HomePage |-------------------->|    RoomPage        |         |
  |     |          |  navigate() with    |                   |         |
  |     |          |  ?token=JWT         |                   |         |
  |     +----------+                     +-------------------+         |
  |                                                                    |
  +====================================================================+
```

### RoomPage Hook Dependency Graph

```
  +====================================================================+
  |                      RoomPage Hooks                                |
  +====================================================================+
  |                                                                    |
  |  +------------------+                                              |
  |  | useSessionData() |  reads localStorage("learnfun-session")      |
  |  | -> sessionData   |  { userName, livekitToken, livekitUrl, ... } |
  |  +--------+---------+                                              |
  |           |                                                        |
  |           |  livekitUrl + livekitToken                              |
  |           v                                                        |
  |  +--------+---------+                                              |
  |  | useRoom()         |  connects LiveKit + Yjs                     |
  |  | -> room           |  { connectionState, participants,           |
  |  |                   |    localParticipant, syncStore }             |
  |  +--------+---------+                                              |
  |           |                                                        |
  |     +-----+------+----------+                                      |
  |     |            |          |                                      |
  |     v            v          v                                      |
  |  +--+-------+ +--+-----+ +-+----------------+                     |
  |  |useRoom   | |useRoom | |useServerEvents() |                     |
  |  |Partici-  | |Trans-  | |  -> sse           |                     |
  |  |pants()   | |cript() | |  { connected }   |                     |
  |  |-> list,  | |-> list,| |                   |                     |
  |  |  localId | |  addFn,| |  SSE handlers:    |                     |
  |  |          | |  ref   | |  onContentReady   |                     |
  |  +----------+ +--------+ |  onTranscript     |                     |
  |                           |  onUIControl      |                     |
  |                           |  onGameStarted    |                     |
  |                           |  onGameEnded      |                     |
  |                           +------------------+                     |
  |                                                                    |
  |  (available but not yet wired in RoomPage):                        |
  |  +-------------+  +------------+  +-------------+                  |
  |  | useVoice()   |  | useSync()  |  | usePresence()|                  |
  |  | mic/speaker  |  | Yjs state  |  | online users |                  |
  |  | toggle       |  | read/write |  | typing status|                  |
  |  +-------------+  +------------+  +-------------+                  |
  +====================================================================+
```

### Display Module Component Tree

```
  +====================================================================+
  |                   Display Module (modules/display/)                 |
  +====================================================================+
  |                                                                    |
  |  RoomLayout (layout/RoomLayout.tsx)                                |
  |  +--------------------------------------------------------------+  |
  |  |                                                              |  |
  |  |  +--main area (flex-1)--+  +--sidebar (w-80)--+             |  |
  |  |  |                      |  |                   |             |  |
  |  |  |  +--- Board ------+  |  |  ParticipantList  |             |  |
  |  |  |  |                |  |  |  (ui/)             |             |  |
  |  |  |  | Layer 1 (z-10) |  |  |                   |             |  |
  |  |  |  | BundleRenderer |  |  |  Debug info        |             |  |
  |  |  |  |   |            |  |  |  (LK state,        |             |  |
  |  |  |  |   +-> game?    |  |  |   SSE state,       |             |  |
  |  |  |  |   |  Content   |  |  |   mic state)       |             |  |
  |  |  |  |   |  Renderer  |  |  +-------------------+             |  |
  |  |  |  |   |  (GAME_    |  |                                    |  |
  |  |  |  |   |  COMPONENTS)|  |                                    |  |
  |  |  |  |   |            |  |                                    |  |
  |  |  |  |   +-> lesson?  |  |                                    |  |
  |  |  |  |      Content   |  |                                    |  |
  |  |  |  |      Renderer  |  |                                    |  |
  |  |  |  |      (LESSON_  |  |                                    |  |
  |  |  |  |      COMPONENTS)|  |                                    |  |
  |  |  |  |                |  |                                    |  |
  |  |  |  | Layer 2 (z-20) |  |                                    |  |
  |  |  |  | Annotations    |  |                                    |  |
  |  |  |  |                |  |                                    |  |
  |  |  |  | Layer 3 (z-30) |  |                                    |  |
  |  |  |  | SharedCursors  |  |                                    |  |
  |  |  |  |                |  |                                    |  |
  |  |  |  | Layer 4 (z-40) |  |                                    |  |
  |  |  |  | ScreenEffects  |  |                                    |  |
  |  |  |  | (focus +       |  |                                    |  |
  |  |  |  |  emotes +      |  |                                    |  |
  |  |  |  |  confetti)     |  |                                    |  |
  |  |  |  +----------------+  |                                    |  |
  |  |  |                      |                                    |  |
  |  |  |  Transcript overlay  |                                    |  |
  |  |  |  (bottom, z-40)     |                                    |  |
  |  |  |  +-- ChatInput      |                                    |  |
  |  |  |                      |                                    |  |
  |  |  +----------------------+                                    |  |
  |  |                                                              |  |
  |  |  +--- controls (bottom bar) ---+                             |  |
  |  |  | ControlBar                   |                             |  |
  |  |  | [Mic] [Camera] [End Game]   |                             |  |
  |  |  +-----------------------------+                             |  |
  |  |                                                              |  |
  |  |  +--- overlay ---+                                           |  |
  |  |  | LoadingOverlay |                                           |  |
  |  |  +---------------+                                           |  |
  |  +--------------------------------------------------------------+  |
  +====================================================================+
```

### Plugin Registry

```
  +====================================================================+
  |                plugin-registry.ts (lazy imports)                    |
  +====================================================================+
  |                                                                    |
  |  GAME_COMPONENTS                    LESSON_COMPONENTS              |
  |  +--------------+-----------+       +--------------+----------+    |
  |  | Key          | Component |       | Key          | Component|    |
  |  +--------------+-----------+       +--------------+----------+    |
  |  | "wordmatch"  | lazy()    |       | "solar-system"| lazy()  |    |
  |  |              | data/games|       |              | data/    |    |
  |  |              | /wordmatch|       |              | lessons/ |    |
  |  |              | /src      |       |              | solar-   |    |
  |  +--------------+-----------+       |              | system/  |    |
  |  | "flashcard"  | lazy()    |       |              | src      |    |
  |  |              | .../src   |       +--------------+----------+    |
  |  +--------------+-----------+                                      |
  |  |"sentence-    | lazy()    |       hasGameComponent(kind)         |
  |  | builder"     | .../src   |       hasLessonComponent(kind)       |
  |  +--------------+-----------+                                      |
  |  |"spaceshooter"| lazy()    |                                      |
  |  |              | .../src   |                                      |
  |  +--------------+-----------+                                      |
  |                                                                    |
  |  ContentRenderer wraps the selected component in:                  |
  |  <GameContext.Provider value={contextValue}>                       |
  |    <Suspense fallback={loading...}>                                |
  |      <Component />   <-- lazy-loaded game/lesson                   |
  |    </Suspense>                                                     |
  |  </GameContext.Provider>                                           |
  |                                                                    |
  |  GameContextValue = {                                              |
  |    gameType: string,          // e.g. "wordmatch"                  |
  |    initialData: parsed slots, // from FilledBundle.filledSlots     |
  |    updateGameStateForAI: fn,  // report state changes              |
  |    endGame: fn,               // signal completion                 |
  |  }                                                                 |
  +====================================================================+
```

### Realtime Module

```
  +====================================================================+
  |              Realtime Module (modules/realtime/)                    |
  +====================================================================+
  |                                                                    |
  |  livekit/                                                          |
  |  +------------------------------+                                  |
  |  | livekit-client.ts             |                                  |
  |  |                              |                                  |
  |  | createLivekitConnection()    |                                  |
  |  |   +-- new Room(adaptive,     |                                  |
  |  |   |     dynacast)            |                                  |
  |  |   +-- .connect(url, token)   |                                  |
  |  |   +-- .disconnect()          |                                  |
  |  |                              |                                  |
  |  |   Events:                    |     +--------------------+       |
  |  |   onConnectionChange(cb)     |     | spatial-audio.ts   |       |
  |  |   onParticipantJoined(cb)    |     | (3D audio helpers) |       |
  |  |   onParticipantLeft(cb)      |     +--------------------+       |
  |  |   onTrackSubscribed(cb)      |                                  |
  |  |                              |                                  |
  |  |   Getters:                   |                                  |
  |  |   getLocalParticipant()      |                                  |
  |  |   getParticipants()          |                                  |
  |  +------------------------------+                                  |
  |                                                                    |
  |  sync/                                                             |
  |  +------------------------------+                                  |
  |  | yjs-provider.ts              |  Y.Doc + WebsocketProvider       |
  |  | sync-store.ts                |  Typed maps (board,game,cursors) |
  |  | awareness.ts                 |  User presence protocol          |
  |  | cursor-sync.ts               |  Cursor broadcast helpers        |
  |  +------------------------------+                                  |
  |                                                                    |
  |  hooks/                                                            |
  |  +------------------------------+                                  |
  |  | useRoom.ts                   |  LiveKit + Yjs lifecycle         |
  |  |   IN:  url, token, roomId    |                                  |
  |  |   OUT: connectionState,      |                                  |
  |  |        participants,         |                                  |
  |  |        syncStore             |                                  |
  |  +------------------------------+                                  |
  |  | useVoice.ts                  |  Mic/speaker toggle              |
  |  |   IN:  LivekitConnection     |                                  |
  |  |   OUT: isMicEnabled,         |                                  |
  |  |        toggleMic,            |                                  |
  |  |        toggleSpeaker         |                                  |
  |  +------------------------------+                                  |
  |  | useServerEvents.ts           |  SSE subscription + reconnect    |
  |  |   IN:  roomId, handlers      |                                  |
  |  |   OUT: { connected }         |                                  |
  |  +------------------------------+                                  |
  |  | usePresence.ts               |  Yjs awareness users             |
  |  |   IN:  awareness, userId     |                                  |
  |  |   OUT: users, remoteUsers,   |                                  |
  |  |        setTyping             |                                  |
  |  +------------------------------+                                  |
  |  | useSync.ts                   |  Reactive Yjs state              |
  |  |   IN:  SyncStore             |                                  |
  |  |   OUT: boardState, gameState,|                                  |
  |  |        setBoardContent, ...  |                                  |
  |  +------------------------------+                                  |
  |  | useCursors.ts                |  Cursor position sync            |
  |  | useSessionData.ts            |  localStorage reader             |
  |  | useRoomTranscript.ts         |  Transcript array manager        |
  |  | useRoomParticipants.ts       |  Map LK participants to UI       |
  |  +------------------------------+                                  |
  +====================================================================+
```

### Engine Module

```
  +====================================================================+
  |               Engine Module (modules/engine/)                      |
  +====================================================================+
  |                                                                    |
  |  useGameEngine(canvasRef, config)                                  |
  |  +----------------------------------------------------------------+|
  |  |                                                                ||
  |  |  +-------------+    +-------------+    +-----------------+     ||
  |  |  | InputManager|    |  GameLoop   |    | EntityManager   |     ||
  |  |  |             |    |             |    |                 |     ||
  |  |  | keyboard    |    | requestAnim |    | add/remove/     |     ||
  |  |  | touch       |    | ationFrame  |    | query entities  |     ||
  |  |  | mouse       |--->| update(dt)  |--->| collision       |     ||
  |  |  | gamepad     |    | render()    |    | detection       |     ||
  |  |  +-------------+    +------+------+    +-----------------+     ||
  |  |                            |                                   ||
  |  |                    +-------+-------+                           ||
  |  |                    |               |                           ||
  |  |              +-----v-----+   +-----v------+                   ||
  |  |              |  Camera   |   |  Renderer   |                   ||
  |  |              |           |   |             |                   ||
  |  |              | viewport  |   | Canvas 2D   |                   ||
  |  |              | transform |   | draw helpers|                   ||
  |  |              | follow    |   | shapes,     |                   ||
  |  |              | shake     |   | sprites,    |                   ||
  |  |              +-----------+   | text        |                   ||
  |  |                              +-------------+                   ||
  |  |                                                                ||
  |  |  +------------------+    +------------------+                  ||
  |  |  | ParticleEmitter  |    |  AudioManager    |                  ||
  |  |  |                  |    |                  |                  ||
  |  |  | spawn, update,   |    | Web Audio API    |                  ||
  |  |  | render particles |    | load, play,      |                  ||
  |  |  | (explosions,     |    | stop sounds      |                  ||
  |  |  |  trails, sparks) |    |                  |                  ||
  |  |  +------------------+    +------------------+                  ||
  |  |                                                                ||
  |  +----------------------------------------------------------------+|
  |                                                                    |
  |  useVirtualJoystick()                                              |
  |  +--------------------------------+                                |
  |  | Mobile touch joystick overlay  |                                |
  |  | renders on-screen stick        |                                |
  |  | outputs: { dx, dy, active }    |                                |
  |  +--------------------------------+                                |
  +====================================================================+
```

---

## End-to-End Flow: Student Asks for a Game

```
  STUDENT                BROWSER              SERVER                   AI
     |                      |                    |                      |
     | "Let's play a        |                    |                      |
     |  word game!"         |                    |                      |
     |----(speaks)--------->|                    |                      |
     |                      |---(LiveKit audio)->|                      |
     |                      |                    |---(PCM 16kHz)------->|
     |                      |                    |              Gemini Live API
     |                      |                    |                      |
     |                      |                    |   Gemini decides to  |
     |                      |                    |   call tool:         |
     |                      |                    |   request_ta_action  |
     |                      |                    |   { intent: "start   |
     |                      |                    |     word matching    |
     |                      |                    |     game" }          |
     |                      |                    |<----(tool_call)------|
     |                      |                    |                      |
     |                      |            TeacherAgent                   |
     |                      |            _dispatch_ta_action()          |
     |                      |                    |                      |
     |                      |            TAAgent.handle_request()       |
     |                      |                    |                      |
     |                      |            1. resolve_template()          |
     |                      |               -> "wordmatch"             |
     |                      |            2. personalize()               |
     |                      |            3. adjust_difficulty()         |
     |                      |            4. generate_filled_data()      |
     |                      |               -> Gemini Flash fills       |
     |                      |                  word pairs, hints,       |
     |                      |                  theme                    |
     |                      |            5. store_bundle()              |
     |                      |            6. publish_event()             |
     |                      |               "ta.content_ready"          |
     |                      |               -> Redis CONTENT_PUSH      |
     |                      |                    |                      |
     |                      |                    |---(tool_response)--->|
     |                      |                    |              (WHEN_IDLE)
     |                      |                    |                      |
     |                      |<---(SSE: content_ready)--                |
     |                      |                    |                      |
     |                      | fetch /api/bundles/{id}                  |
     |                      |<----(FilledBundle)--                     |
     |                      |                    |                      |
     |                      | ContentRenderer                          |
     |                      | -> GAME_COMPONENTS["wordmatch"]          |
     |                      | -> WordMatchGame renders                 |
     |                      |                    |                      |
     |<-(game on screen)----|                    |<---(audio PCM 24kHz)|
     |<-(teacher voice:     |                    |              "Great! |
     |   "Great! Let's      |                    |               Let's  |
     |    match some words!")|                   |               match!"|
     |                      |                    |                      |
```

---

## Infrastructure

```
  +====================================================================+
  |                       Infrastructure                               |
  +====================================================================+
  |                                                                    |
  |  Docker Compose                                                    |
  |  +-------------------+  +------------------+  +-----------------+  |
  |  | PostgreSQL        |  |  Redis           |  | LiveKit Server  |  |
  |  | + pgvector        |  |                  |  |                 |  |
  |  | port 5432         |  |  port 6379       |  | port 7880       |  |
  |  | user profiles,    |  |  pub/sub for     |  | WebRTC SFU      |  |
  |  | progress,         |  |  event fan-out   |  | audio/video     |  |
  |  | sessions          |  |  (room-scoped    |  | rooms           |  |
  |  |                   |  |   channels)      |  |                 |  |
  |  +-------------------+  +------------------+  +-----------------+  |
  |                                                                    |
  |  External APIs                                                     |
  |  +---------------------------+  +------------------------------+   |
  |  | Gemini Live API           |  | Gemini Flash API             |   |
  |  | gemini-2.5-flash-native-  |  | gemini-flash-latest          |   |
  |  | audio-preview             |  |                              |   |
  |  |                           |  | Used by: TA ContentGenerator |   |
  |  | Used by: TeacherAgent     |  |   - resolve_template()       |   |
  |  |   - Real-time voice       |  |   - generate_filled_data()   |   |
  |  |   - Tool calls            |  |                              |   |
  |  |   - Transcription         |  | Structured JSON output       |   |
  |  +---------------------------+  +------------------------------+   |
  |                                                                    |
  |  Config (server/config.py via .env)                                |
  |  +--------------------------------------------------------------+  |
  |  | GEMINI_API_KEY          | API key for both Gemini models     |  |
  |  | GEMINI_LIVE_MODEL       | Model ID for Live API              |  |
  |  | GEMINI_AFFECTIVE_DIALOG | Enable emotional voice (bool)      |  |
  |  | GEMINI_PROACTIVE_AUDIO  | Enable proactive responses (bool)  |  |
  |  | DATABASE_URL            | PostgreSQL connection string        |  |
  |  | REDIS_URL               | Redis connection string             |  |
  |  | LIVEKIT_URL             | LiveKit server WebSocket URL        |  |
  |  | LIVEKIT_API_KEY         | LiveKit API key                     |  |
  |  | LIVEKIT_API_SECRET      | LiveKit API secret                  |  |
  |  | JWT_SECRET              | Secret for session JWTs              |  |
  |  | DATA_DIR                | Path to data/ directory              |  |
  |  +--------------------------------------------------------------+  |
  +====================================================================+
```
