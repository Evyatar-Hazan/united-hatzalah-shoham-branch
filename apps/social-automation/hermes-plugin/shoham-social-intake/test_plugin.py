import importlib.util
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


def test_only_target_group_is_intercepted(monkeypatch):
    module = _load()
    created = []
    class Task:
        def add_done_callback(self, callback):
            return None
    monkeypatch.setattr(module.asyncio, "get_running_loop", lambda: SimpleNamespace(create_task=lambda coro: created.append(coro) or Task()))
    assert module._on_pre_gateway_dispatch(event=_event("other@g.us")) is None
    result = module._on_pre_gateway_dispatch(event=_event())
    assert result == {"action": "skip", "reason": "shoham-social-deterministic-intake"}
    for coro in created:
        coro.close()
