# **EduForge: Real-Time AI Collaborative Learning Playground**

**Vision:** A self-hosted, highly engaging educational platform where children interact with dynamic lessons and multiplayer games in a shared browser environment. It is powered by a dual-agent architecture: an **AI Teacher** (real-time voice personality via server-side LiveKit Agent) and an **AI TA** (a silent, high-speed backend wizard that fills prebuilt templates with personalized content). Everything syncs in real-time, delivering a magical, low-latency (<100ms sync, <2s load) multiplayer classroom experience.

**Architecture:** Python (FastAPI) server + React (Vite) frontend. The server handles all AI agent logic, content generation, session management, and real-time coordination. The frontend is a lightweight React app focused purely on rendering and user interaction.

---

### **Module 1: Content Storage & Templates (The Buckets)**

**Goal:** Store 50-200+ high-quality, instantly loadable templates. Ensure <2s load times by separating the *code* from the *content*.

* **Concept:** Instead of generating code on the fly, you store prebuilt HTML5/SVG/Three.js shells. The AI only generates the JSON data to fill these shells.
* **Lesson Templates:** JSON manifests + SVG/GSAP animations + audio tracks + fillable slots (vocabulary, images, questions).
* **Game Pods:** Prebuilt React/React Three Fiber shells (e.g., word-match, ecosystem builder) with schemas for dynamic content.
* **Tech:** Local filesystem (`/data/lessons`, `/data/games`, `/data/bundles`). Python scans manifests at startup.

### **Module 2: Tool System**

**Goal:** Provide a standardized, secure contract between the AI agents and the platform.

* **Concept:** A typed tool registry with Pydantic schemas, caller authentication, and rate limiting. Tools define what the AI can do to manipulate the environment.
* **Key Tools:**
  * `request_ta_action(intent, context)`: Used by the Teacher to wake up the TA.
  * `query_content(type, filter, user_context)`: Used by the TA to find the right template.
  * `execute_filled_bundle(bundle_id, filled_data)`: Used by the TA to push the newly filled lesson to the live room.
  * `light_control(action, params)`: Used by the Teacher to highlight an SVG, pause the game, or trigger an emote.
* **Tech:** Python Pydantic schemas, ToolRegistry class with execute pipeline (auth -> rate-limit -> validate -> handler).

### **Module 3: The AI Teacher (Server-Side Voice Agent)**

**Goal:** Be the lively, always-present voice that narrates, cheers, guides, and reacts instantly.

* **Concept:** This agent handles *all* real-time user interactions. It maintains high energy and low latency because it is strictly forbidden from doing heavy JSON generation. It runs entirely server-side as a LiveKit Agent.
* **Responsibilities:** Joins the LiveKit room as a participant. Receives student audio via LiveKit, pipes it to Gemini Live API, and publishes Gemini's voice response back to the room. Uses `light_control` and `request_ta_action` tools based on the conversation.
* **Tech Stack:** **Python LiveKit Agents SDK** + **Gemini Multimodal Live API** (`google-genai` Python SDK). The agent runs as a server-side process — no AI logic in the browser.

### **Module 4: The AI TA (Backend Generation Agent)**

**Goal:** Handle all creative heavy lifting, schema filling, and personalization in under 2 seconds.

* **Concept:** The invisible backend specialist. It never speaks. It receives requests directly from the Teacher agent (in-process async function call), grabs templates from local storage, injects custom data based on the user's profile, and pushes the payload to the frontend via Redis.
* **Responsibilities:** Fast JSON generation, personalization (e.g., "User loves cars, make the math game car-themed"), and content safety filtering.
* **Tech Stack:** **Gemini Flash** (via `gemini-flash-latest` alias for high-speed, structured JSON outputs) using `google-genai` Python SDK.

### **Module 5: Interactive Main Display & Renderer**

**Goal:** One unified, beautiful browser surface supporting rich interactions (drag, click, voice).

* **Concept:** The shared "board" where kids see and touch everything together. It dynamically imports the bundles the AI TA creates.
* **Features:** Shared cursors, annotations, plugin-based game/lesson rendering.
* **Tech Stack:** React 19 (Vite), React Three Fiber (for 3D), Tailwind CSS, Zustand. Plugin registry maps template IDs to lazy-loaded React components.

### **Module 6: Realtime Sync & Multiplayer Layer**

**Goal:** Zero-lag shared state across all users in a room.

* **Concept:** If a kid drags a vocabulary word across the screen, every other kid (and the AI Teacher) needs to see it move instantly.
* **Features:** Conflict-free edits (CRDTs), spatial audio, turn indicators, shared timers.
* **Tech Stack:** Self-hosted **LiveKit Server** (WebRTC SFU for voice/video) + **Yjs** (CRDT via **pycrdt-websocket** embedded in the FastAPI server, browser connects with `y-websocket` provider).

### **Module 7: Event Bus & Server-to-Browser Bridge**

**Goal:** Glue everything together with fast, reliable messaging.

* **Concept:** Agent-to-agent communication is direct in-process async calls (Teacher calls TA directly). Server-to-browser events use Redis pub/sub with an SSE bridge.
* **Teacher -> TA:** Direct async function call within the Python server. No message bus needed.
* **Server -> Browser:** Redis pub/sub channels (`room.{roomId}.content`, `room.{roomId}.ui`) -> SSE endpoint (`/api/room/{roomId}/events`) -> browser.
* **Tech Stack:** **Redis** pub/sub (via `redis.asyncio`) + FastAPI SSE `StreamingResponse`.

### **Module 8: Storage & Database**

**Goal:** Persistent, searchable storage for assets and user profiles.

* **Concept:** Store kid profiles, progress, and historical preferences so the AI TA can personalize future sessions.
* **Tech Stack:** **PostgreSQL** (with `pgvector` for user embeddings/semantic search) via **asyncpg**. **Redis** for ephemeral session state and caching.

---

### **How It Actually Flows (Example Scenario)**

1. **The Trigger:** A student says, *"I'm bored, can we play a space game with these spelling words?"*
2. **The Teacher:** The **AI Teacher** (Python LiveKit Agent) receives the student's audio via LiveKit, pipes it to the Gemini Live API, and gets back a fun voice reply: *"Oh, space? Let's do it! Buckle up, astronauts!"* The audio is published back to the LiveKit room. Simultaneously, Gemini issues a tool call: `request_ta_action(intent: "space spelling game", words: ["astronaut", "planet"])`.
3. **The Orchestration:** The Teacher agent calls the TA agent directly (in-process async call). No message bus hop.
4. **The TA:** The **AI TA** (Gemini Flash) wakes up. It queries the local template registry for the "Space Racer" game shell. It generates a JSON payload mapping the spelling words to asteroids. It stores the filled bundle and publishes a `content_ready` event to Redis.
5. **The Sync:** The browser receives the event via SSE, fetches the bundle from `/api/bundles/{id}`, and the Board component renders the game plugin. Yjs ensures the game state syncs across all kids in the room. The game begins.

---

### **Tech Stack Summary**

| Layer | Technology |
|-------|-----------|
| Server | Python, FastAPI, Uvicorn |
| AI Teacher | LiveKit Agents SDK (Python), Gemini Multimodal Live API |
| AI TA | Gemini Flash (`google-genai` Python SDK) |
| Frontend | React 19, Vite, React Router, Tailwind CSS, Zustand |
| Realtime | LiveKit Server (WebRTC SFU), Yjs (pycrdt-websocket) |
| Database | PostgreSQL + pgvector (asyncpg) |
| Messaging | Redis pub/sub (server->browser via SSE) |
| Auth | JWT (python-jose) |
| Infrastructure | Docker Compose (PostgreSQL, Redis, LiveKit) |
