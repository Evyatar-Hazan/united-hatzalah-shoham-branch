import importlib.util
import json
import sqlite3
from pathlib import Path
from types import SimpleNamespace


def _load():
    path = Path(__file__).with_name("__init__.py")
    spec = importlib.util.spec_from_file_location("shoham_social_intake", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _event(chat_id="120363432982998492@g.us", user_id="u1"):
    return SimpleNamespace(
        text="שיחה רגילה",
        source=SimpleNamespace(platform=SimpleNamespace(value="whatsapp"), chat_id=chat_id),
        message_id="m1",
        user_id=user_id,
        user_name="ארז",
        reply_to_text=None,
        reply_to_message_id=None,
        reply_to_is_own_message=False,
        media_urls=[],
        media_types=[],
    )


def _source_identity_event(chat_id="120363432982998492@g.us", user_id="10001@lid"):
    event = _event(chat_id, None)
    event.source.user_id = user_id
    event.source.user_name = "ארז אגסי סניף שוהם"
    return event


def test_only_target_group_is_intercepted(monkeypatch, tmp_path):
    module = _load()
    monkeypatch.setattr(module, "SPOOL_DIR", tmp_path)
    assert module._on_pre_gateway_dispatch(event=_event("other@g.us")) is None
    result = module._on_pre_gateway_dispatch(event=_event())
    assert result == {"action": "skip", "reason": "shoham-social-deterministic-intake"}
    files = list(tmp_path.glob("*.json"))
    assert len(files) == 1
    payload = json.loads(files[0].read_text())
    assert payload["extra"]["user_message"] == "שיחה רגילה"
    assert payload["extra"]["sender_name"] == "ארז"

    assert module._on_pre_gateway_dispatch(event=_event()) == result
    assert len(list(tmp_path.glob("*.json"))) == 1


def test_sender_identity_falls_back_to_session_source(monkeypatch, tmp_path):
    module = _load()
    monkeypatch.setattr(module, "SPOOL_DIR", tmp_path)
    result = module._on_pre_gateway_dispatch(event=_source_identity_event())
    assert result == {"action": "skip", "reason": "shoham-social-deterministic-intake"}
    payload = json.loads(next(tmp_path.glob("*.json")).read_text())
    assert payload["extra"]["sender_id"] == "10001@lid"
    assert payload["extra"]["sender_name"] == "ארז אגסי סניף שוהם"


def test_only_verified_approver_private_messages_are_intercepted(monkeypatch, tmp_path):
    module = _load()
    spool = tmp_path / "spool"
    database_path = tmp_path / "social.db"
    database = sqlite3.connect(database_path)
    database.execute("CREATE TABLE approver_identities(approver_key TEXT, display_name TEXT, sender_id TEXT)")
    database.execute("INSERT INTO approver_identities VALUES('erez','ארז','10001@lid')")
    database.commit()
    database.close()
    monkeypatch.setattr(module, "SPOOL_DIR", spool)
    monkeypatch.setattr(module, "DATABASE_PATH", database_path)

    assert module._on_pre_gateway_dispatch(event=_event("unknown@lid", "unknown@lid")) is None
    result = module._on_pre_gateway_dispatch(event=_event("10001@lid", "10001@lid"))
    assert result == {"action": "skip", "reason": "shoham-social-deterministic-intake"}
    payload = json.loads(next(spool.glob("*.json")).read_text())
    assert payload["extra"]["chat_id"] == "10001@lid"
    assert payload["extra"]["source_scope"] == "private"
    assert payload["extra"]["group_id"] == module.TARGET_CHAT
