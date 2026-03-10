"""POST /api/game/end — persist game scores when a game ends."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.logging import get_logger
from server.storage.queries.progress import add_points, record_game_result

log = get_logger("api:scores")
router = APIRouter()


class GameEndBody(BaseModel):
    roomId: str
    gameType: str
    scores: dict[str, int]
    details: dict = {}


@router.post("/game/end")
async def post_game_end(body: GameEndBody):
    log.info("Game end", room_id=body.roomId, game_type=body.gameType, players=len(body.scores))
    try:
        for user_id, score in body.scores.items():
            await record_game_result(
                user_id=user_id,
                game_type=body.gameType,
                score=score,
                details=body.details,
            )
            await add_points(user_id, score)
        return {"ok": True}
    except Exception as exc:
        log.error("Failed to save game results", error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to save game results")
