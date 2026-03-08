from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.agents.ta.agent import TAAgent
from server.agents.teacher.manager import stop_all as stop_all_teachers
from server.events.redis_bridge import redis_bridge
from server.logging import get_logger
from server.storage.db import init_db, close_db
from server.sync.yjs_server import mount_yjs, start_yjs, stop_yjs
from server.tools.handlers import register_all as register_tool_handlers
from server.tools.registry import ToolRegistry

log = get_logger("main")

# ---------------------------------------------------------------------------
# Singletons (accessible via app.state after startup)
# ---------------------------------------------------------------------------

ta_agent = TAAgent()
tool_registry = ToolRegistry()


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- startup ---
    await init_db()
    await redis_bridge.connect()
    yjs_task = await start_yjs()
    await ta_agent.start()
    register_tool_handlers(tool_registry)

    app.state.ta_agent = ta_agent
    app.state.tool_registry = tool_registry

    log.info("LearnFun server started")
    yield

    # --- shutdown ---
    await stop_all_teachers()
    await ta_agent.stop()
    await stop_yjs(yjs_task)
    await redis_bridge.close()
    await close_db()
    log.info("LearnFun server stopped")


app = FastAPI(title="LearnFun", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mount_yjs(app)

from server.api.router import api_router  # noqa: E402

app.include_router(api_router)
