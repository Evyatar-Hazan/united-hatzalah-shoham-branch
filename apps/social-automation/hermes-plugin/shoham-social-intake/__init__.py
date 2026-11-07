from __future__ import annotations

import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

TARGET_CHAT = "120363432982998492@g.us"
SPOOL_DIR = Path.home() / "Library/Application Support/ShohamSocial/intake-spool"


def _is_target(event: Any) -> bool:
    source = getattr(event, "source", None)
    platform = str(getattr(getattr(source, "platform", None), "value", getattr(source, "platform", ""))).lower()
    return platform == "whatsapp" and str(getattr(source, "chat_id", "")) == TARGET_CHAT


def _message(event: Any) -> str:
    text = str(getattr(event, "text", "") or "")
    if getattr(event, "reply_to_text", None) and getattr(event, "reply_to_message_id", None):
        label = "your previous message" if getattr(event, "reply_to_is_own_message", False) else ""
        text = f'[Replying to {label}: "{str(event.reply_to_text)[:500]}"]\n\n{text}'
    for path, media_type in zip(getattr(event, "media_urls", []) or [], getattr(event, "media_types", []) or []):
        text += f"\n{str(media_type or 'Document').title()} path: `{path}`"
    return text


def _persist(event: Any) -> bool:
    payload = {
        "session_id": "shoham-social-intake",
        "extra": {
            "platform": "whatsapp",
            "chat_id": TARGET_CHAT,
            "user_message": _message(event),
            "turn_id": str(getattr(event, "message_id", "") or "event"),
            "sender_id": str(getattr(event, "user_id", "") or "unknown"),
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
