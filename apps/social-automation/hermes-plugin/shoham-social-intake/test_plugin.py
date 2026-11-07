import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace


def _load():
    path = Path(__file__).with_name("__init__.py")
    spec = importlib.util.spec_from_file_location("shoham_social_intake", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _event(chat_id="120363432982998492@g.us"):
    return SimpleNamespace(
        text="שיחה רגילה",
        source=SimpleNamespace(platform=SimpleNamespace(value="whatsapp"), chat_id=chat_id),
        message_id="m1",
        user_id="u1",
        reply_to_text=None,
        reply_to_message_id=None,
        reply_to_is_own_message=False,
        media_urls=[],
        media_types=[],
    )


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

    assert module._on_pre_gateway_dispatch(event=_event()) == result
    assert len(list(tmp_path.glob("*.json"))) == 1
