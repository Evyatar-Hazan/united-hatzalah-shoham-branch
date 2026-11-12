from __future__ import annotations

import hashlib
import json
import logging
import os
import sqlite3
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

TARGET_CHAT = "120363432982998492@g.us"
SPOOL_DIR = Path.home() / "Library/Application Support/ShohamSocial/intake-spool"
DATABASE_PATH = Path.home() / "Library/Application Support/ShohamSocial/social.db"


def _is_known_approver(sender_id: str) -> bool:
    if not sender_id or not DATABASE_PATH.exists():
        return False
    try:
        with sqlite3.connect(f"file:{DATABASE_PATH}?mode=ro", uri=True, timeout=0.2) as database:
            row = database.execute(
                "SELECT 1 FROM approver_identities WHERE sender_id=? LIMIT 1",
                (sender_id,),
            ).fetchone()
        return row is not None
    except sqlite3.Error:
        logger.exception("Shoham intake could not verify private approver identity")
        return False


def _is_target(event: Any) -> bool:
    source = getattr(event, "source", None)
    platform = str(getattr(getattr(source, "platform", None), "value", getattr(source, "platform", ""))).lower()
    chat_id = str(getattr(source, "chat_id", ""))
    sender_id = str(getattr(event, "user_id", "") or "")
    if platform != "whatsapp":
        return False
    return chat_id == TARGET_CHAT or (not chat_id.endswith("@g.us") and _is_known_approver(sender_id))


def _message(event: Any) -> str:
    text = str(getattr(event, "text", "") or "")
    if getattr(event, "reply_to_text", None) and getattr(event, "reply_to_message_id", None):
        label = "your previous message" if getattr(event, "reply_to_is_own_message", False) else ""
        text = f'[Replying to {label}: "{str(event.reply_to_text)[:500]}"]\n\n{text}'
    for path, media_type in zip(getattr(event, "media_urls", []) or [], getattr(event, "media_types", []) or []):
        text += f"\n{str(media_type or 'Document').title()} path: `{path}`"
    return text


def _persist(event: Any) -> bool:
    source = getattr(event, "source", None)
    chat_id = str(getattr(source, "chat_id", "") or "")
    source_scope = "group" if chat_id == TARGET_CHAT else "private"
    payload = {
        "session_id": "shoham-social-intake",
        "extra": {
            "platform": "whatsapp",
            "chat_id": chat_id,
            "group_id": TARGET_CHAT,
            "source_scope": source_scope,
            "user_message": _message(event),
            "turn_id": str(getattr(event, "message_id", "") or "event"),
            "sender_id": str(getattr(event, "user_id", "") or "unknown"),
            "sender_name": str(getattr(event, "user_name", "") or ""),
            "reply_to_is_own": bool(getattr(event, "reply_to_is_own_message", False)),
            "reply_to_id": str(getattr(event, "reply_to_message_id", "") or ""),
            "reply_to_text": str(getattr(event, "reply_to_text", "") or ""),
        },
    }
    source_id = payload["extra"]["turn_id"]
    filename = hashlib.sha256(source_id.encode()).hexdigest() + ".json"
    SPOOL_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    target = SPOOL_DIR / filename
    try:
        descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        return True
    except OSError:
        logger.exception("Shoham intake could not open durable spool")
        return False
    try:
        content = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
        os.write(descriptor, content)
        os.fsync(descriptor)
        return True
    except OSError:
        logger.exception("Shoham intake could not persist durable spool")
        try:
            target.unlink(missing_ok=True)
        except OSError:
            pass
        return False
    finally:
        os.close(descriptor)


def _on_pre_gateway_dispatch(**kwargs: Any) -> dict[str, str] | None:
    event = kwargs.get("event")
    if event is None or not _is_target(event):
        return None
    if not _persist(event):
        return {"action": "skip", "reason": "shoham-social-intake-persist-failed"}
    return {"action": "skip", "reason": "shoham-social-deterministic-intake"}


def register(ctx: Any) -> None:
    ctx.register_hook("pre_gateway_dispatch", _on_pre_gateway_dispatch)
