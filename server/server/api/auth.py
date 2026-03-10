"""POST /api/auth/* — register, login, verify."""

from datetime import datetime, timedelta, timezone

import bcrypt
from asyncpg import UniqueViolationError
from fastapi import APIRouter, HTTPException, Request
from jose import JWTError, jwt
from pydantic import BaseModel

from server.config import settings
from server.logging import get_logger
from server.storage.queries.users import (
    create_user_with_auth,
    get_user_by_id,
    get_user_by_username,
)

from .tokens import ALGORITHM

log = get_logger("api:auth")
router = APIRouter(prefix="/auth")

AUTH_TOKEN_EXPIRY_DAYS = 7


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _generate_auth_token(user_id: str, display_name: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "displayName": display_name,
        "type": "auth",
        "iat": now,
        "exp": now + timedelta(days=AUTH_TOKEN_EXPIRY_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def _decode_auth_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") != "auth":
            return None
        return {"userId": payload["sub"], "displayName": payload["displayName"]}
    except JWTError:
        return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    username: str
    password: str
    displayName: str


class LoginRequest(BaseModel):
    username: str
    password: str


class VerifyRequest(BaseModel):
    token: str | None = None


@router.post("/register")
async def post_register(body: RegisterRequest):
    password_hash = _hash_password(body.password)

    try:
        user = await create_user_with_auth(body.username, password_hash, body.displayName)
    except UniqueViolationError:
        raise HTTPException(status_code=409, detail="Username already taken")

    token = _generate_auth_token(user["id"], user["name"])
    log.info("User registered", username=body.username, user_id=user["id"])
    return {"token": token, "userId": user["id"], "displayName": user["name"]}


@router.post("/login")
async def post_login(body: LoginRequest):
    user = await get_user_by_username(body.username)
    if user is None or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not _verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id = str(user["id"])
    display_name = user["name"]
    token = _generate_auth_token(user_id, display_name)
    log.info("User logged in", username=body.username, user_id=user_id)
    return {"token": token, "userId": user_id, "displayName": display_name}


@router.post("/verify")
async def post_verify(body: VerifyRequest, request: Request):
    # Accept token from body or Authorization header
    token = body.token
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(status_code=401, detail="No token provided")

    info = _decode_auth_token(token)
    if info is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Verify user still exists
    user = await get_user_by_id(info["userId"])
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return {"userId": info["userId"], "displayName": info["displayName"]}
