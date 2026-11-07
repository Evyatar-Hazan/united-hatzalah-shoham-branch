from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

TARGET_CHAT = "120363432982998492@g.us"
RUNNER = Path.home() / "Library/Application Support/ShohamSocial/run-hook.sh"
_tasks: set[asyncio.Task[Any]] = set()


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


async def _process(event: Any) -> None:
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
    try:
        process = await asyncio.create_subprocess_exec(
            str(RUNNER),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(
            process.communicate(json.dumps(payload, ensure_ascii=False).encode()), timeout=45
        )
        if process.returncode != 0:
            logger.error("Shoham intake failed: %s", stderr.decode(errors="replace")[:500])
        elif stdout:
            logger.debug("Shoham intake completed")
    except Exception:
        logger.exception("Shoham intake failed closed")


def _on_pre_gateway_dispatch(**kwargs: Any) -> dict[str, str] | None:
    event = kwargs.get("event")
    if event is None or not _is_target(event):
        return None
    task = asyncio.get_running_loop().create_task(_process(event))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return {"action": "skip", "reason": "shoham-social-deterministic-intake"}


def register(ctx: Any) -> None:
    ctx.register_hook("pre_gateway_dispatch", _on_pre_gateway_dispatch)
