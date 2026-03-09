"""Unit tests for backend.common.mq — MockMQClient and MQMessage."""

from __future__ import annotations

import time
from unittest.mock import MagicMock

import pytest

from backend.common.mq import MQMessage, MockMQClient


@pytest.fixture
def client():
    return MockMQClient()


# ── MQMessage dataclass ─────────────────────────────────────────────

class TestMQMessage:
    def test_auto_generates_id(self):
        msg = MQMessage(id="", topic="test", body={"k": "v"})
        assert msg.id != ""
        assert len(msg.id) > 0

    def test_auto_sets_timestamp(self):
        before = time.time()
        msg = MQMessage(id="", topic="test", body={})
        after = time.time()
        assert before <= msg.timestamp <= after

    def test_preserves_explicit_id(self):
        msg = MQMessage(id="my-id", topic="test", body={})
        assert msg.id == "my-id"

    def test_tags_optional(self):
        msg = MQMessage(id="id1", topic="t", body={})
        assert msg.tags is None
        msg2 = MQMessage(id="id2", topic="t", body={}, tags="tag1")
        assert msg2.tags == "tag1"


# ── MockMQClient.publish ────────────────────────────────────────────

class TestPublish:
    def test_returns_message_id(self, client):
        msg_id = client.publish("test-topic", {"data": 1})
        assert isinstance(msg_id, str)
        assert len(msg_id) > 0

    def test_stores_message(self, client):
        client.publish("topic-a", {"value": 42})
        msg = client.consume_one("topic-a")
        assert msg is not None
        assert msg.body == {"value": 42}
        assert msg.topic == "topic-a"

    def test_publish_with_tags(self, client):
        client.publish("topic-a", {"v": 1}, tags="important")
        msg = client.consume_one("topic-a")
        assert msg.tags == "important"


# ── MockMQClient.consume_one ─────────────────────────────────────────

class TestConsumeOne:
    def test_returns_none_on_empty(self, client):
        assert client.consume_one("empty-topic") is None

    def test_fifo_order(self, client):
        client.publish("t", {"seq": 1})
        client.publish("t", {"seq": 2})
        client.publish("t", {"seq": 3})

        assert client.consume_one("t").body["seq"] == 1
        assert client.consume_one("t").body["seq"] == 2
        assert client.consume_one("t").body["seq"] == 3
        assert client.consume_one("t") is None

    def test_topics_are_isolated(self, client):
        client.publish("topic-a", {"a": 1})
        client.publish("topic-b", {"b": 2})

        assert client.consume_one("topic-a").body == {"a": 1}
        assert client.consume_one("topic-b").body == {"b": 2}
        assert client.consume_one("topic-a") is None


# ── MockMQClient.subscribe ──────────────────────────────────────────

class TestSubscribe:
    def test_handler_called_on_publish(self, client):
        handler = MagicMock()
        client.subscribe("events", handler)
        client.publish("events", {"action": "test"})

        handler.assert_called_once()
        msg = handler.call_args[0][0]
        assert isinstance(msg, MQMessage)
        assert msg.body == {"action": "test"}

    def test_multiple_handlers(self, client):
        h1 = MagicMock()
        h2 = MagicMock()
        client.subscribe("events", h1)
        client.subscribe("events", h2)
        client.publish("events", {"x": 1})

        h1.assert_called_once()
        h2.assert_called_once()

    def test_handler_error_does_not_propagate(self, client):
        """A failing handler should not crash publish."""
        bad_handler = MagicMock(side_effect=RuntimeError("boom"))
        good_handler = MagicMock()
        client.subscribe("events", bad_handler)
        client.subscribe("events", good_handler)

        # Should not raise
        client.publish("events", {"data": 1})
        good_handler.assert_called_once()

    def test_handler_only_for_subscribed_topic(self, client):
        handler = MagicMock()
        client.subscribe("topic-a", handler)
        client.publish("topic-b", {"data": 1})
        handler.assert_not_called()


# ── MockMQClient.health ─────────────────────────────────────────────

class TestHealth:
    def test_health_status(self, client):
        h = client.health()
        assert h["status"] == "ok"
        assert h["backend"] == "mock"

    def test_health_tracks_published_count(self, client):
        client.publish("t1", {})
        client.publish("t2", {})
        h = client.health()
        assert h["total_published"] == 2

    def test_health_lists_topics(self, client):
        client.publish("alpha", {})
        client.publish("beta", {})
        h = client.health()
        assert "alpha" in h["topics"]
        assert "beta" in h["topics"]
