from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.agents.ta.agent import TAAgent
from server.events.redis_bridge import redis_bridge
from server.logging import get_logger
from server.storage.db import init_db, close_db
from server.sync.yjs_server import mount_yjs, start_yjs, stop_yjs
from server.tools.registry import ToolRegistry
from server.tools.schemas import TOOL_DEFINITIONS, ToolResponse

log = get_logger("main")

# ---------------------------------------------------------------------------
# Singletons (accessible via app.state after startup)
# ---------------------------------------------------------------------------

ta_agent = TAAgent()
tool_registry = ToolRegistry()


def _register_placeholder_tools() -> None:
    """Register every defined tool with a no-op handler."""

    async def _noop(params: dict, ctx) -> ToolResponse:
        return ToolResponse(call_id=ctx.call_id, success=True, data={"stub": True})

    for defn in TOOL_DEFINITIONS:
        if not tool_registry.has(defn.name):
            tool_registry.register(defn.name, _noop)


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
    _register_placeholder_tools()

    app.state.ta_agent = ta_agent
    app.state.tool_registry = tool_registry

    log.info("LearnFun server started")
    yield

    # --- shutdown ---
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
