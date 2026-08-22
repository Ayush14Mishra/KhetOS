"""Small local role-based authentication layer for the IHAT1 field gateway.

For a production public deployment, replace these seeded accounts with a
managed identity provider. This local implementation keeps the hackathon
deployment private, role-aware and usable without internet.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Literal, Optional

from fastapi import Header, HTTPException
from pydantic import BaseModel, Field

from .config import settings

Role = Literal["admin", "field_worker", "farmer"]


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)


class CurrentUser(BaseModel):
    id: str
    name: str
    email: str
    role: Role
    farm_ids: list[str]


DEFAULT_USERS = [
    {"id": "USR-ADMIN-001", "name": "Aarav Admin", "email": "admin@gramin.local", "role": "admin", "farm_ids": ["*"], "password_hash": "d5bd587fa248ceb3c299b43b1b6a8ac36b68653d68403f3bf70b812da31f3c23"},
    {"id": "USR-WORKER-001", "name": "Meera Field Worker", "email": "worker@gramin.local", "role": "field_worker", "farm_ids": ["FARM-001"], "password_hash": "95d70c3c01422c402d4f462935c44650c3877cab2795e1a584888e79057c849d"},
    {"id": "USR-FARMER-001", "name": "Riya Farmer", "email": "farmer@gramin.local", "role": "farmer", "farm_ids": ["FARM-001"], "password_hash": "f21745bec5e33927f7d2e76e617c47d8476955a96f562678d1f4f97864d1bcda"},
]


def _hash_password(password: str, email: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), email.lower().encode(), 200_000).hex()


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _sign(value: str) -> str:
    return _b64(hmac.new(settings.auth_secret.encode(), value.encode(), hashlib.sha256).digest())


def _user_from_record(record: dict) -> CurrentUser:
    return CurrentUser(**{key: record[key] for key in ["id", "name", "email", "role", "farm_ids"]})


def login(request: LoginRequest) -> dict:
    email = request.email.strip().lower()
    record = next((item for item in DEFAULT_USERS if item["email"] == email), None)
    if not record or not hmac.compare_digest(_hash_password(request.password, email), record["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    user = _user_from_record(record)
    return {"access_token": create_token(user), "token_type": "bearer", "user": user.model_dump()}


def create_token(user: CurrentUser) -> str:
    payload = {**user.model_dump(), "exp": int(time.time()) + settings.auth_token_hours * 3600}
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    return f"{body}.{_sign(body)}"


def get_current_user(authorization: Optional[str] = Header(default=None)) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Sign in is required")
    try:
        token = authorization.removeprefix("Bearer ")
        body, signature = token.split(".", 1)
        if not hmac.compare_digest(signature, _sign(body)):
            raise ValueError("signature")
        payload = json.loads(_unb64(body))
        if int(payload["exp"]) < time.time():
            raise ValueError("expired")
        return CurrentUser(**{key: payload[key] for key in ["id", "name", "email", "role", "farm_ids"]})
    except (KeyError, TypeError, ValueError, UnicodeDecodeError):
        raise HTTPException(401, "Your session is invalid or has expired")


def allow_farm(user: CurrentUser, farm_id: str) -> None:
    if "*" not in user.farm_ids and farm_id not in user.farm_ids:
        raise HTTPException(403, "You do not have access to this farm")


def allow_roles(user: CurrentUser, *roles: Role) -> None:
    if user.role not in roles:
        raise HTTPException(403, "Your role does not have permission for this action")
