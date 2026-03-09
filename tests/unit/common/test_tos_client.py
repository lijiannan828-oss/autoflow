"""Unit tests for backend.common.tos_client."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from backend.common.tos_client import (
    BUCKET,
    _parse_key,
    download_bytes,
    download_json,
    generate_presigned_url,
    upload_bytes,
    upload_json,
)


# ── URL Parsing ─────────────────────────────────────────────────────

class TestParseKey:
    def test_tos_url_with_bucket(self):
        url = f"tos://{BUCKET}/path/to/file.json"
        assert _parse_key(url) == "path/to/file.json"

    def test_tos_url_without_matching_bucket(self):
        url = "tos://other-bucket/path/to/file.json"
        assert _parse_key(url) == "other-bucket/path/to/file.json"

    def test_tos_url_bare_key(self):
        url = "tos://file.json"
        assert _parse_key(url) == "file.json"

    def test_plain_key_passthrough(self):
        assert _parse_key("path/to/file.json") == "path/to/file.json"

    def test_nested_path(self):
        url = f"tos://{BUCKET}/ev-123/N01/script.json"
        assert _parse_key(url) == "ev-123/N01/script.json"

    def test_empty_string(self):
        assert _parse_key("") == ""


# ── upload_json ──────────────────────────────────────────────────────

class TestUploadJson:
    @patch("backend.common.tos_client._get_client")
    def test_uploads_and_returns_url(self, mock_get_client):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        data = {"key": "value", "num": 42}
        result = upload_json("test/path.json", data)

        assert result == f"tos://{BUCKET}/test/path.json"
        mock_client.put_object.assert_called_once()
        call_args = mock_client.put_object.call_args
        assert call_args[0][0] == BUCKET
        assert call_args[0][1] == "test/path.json"
        # Verify content is valid JSON
        content = call_args[1].get("content") or call_args[0][2]
        parsed = json.loads(content)
        assert parsed == data

    @patch("backend.common.tos_client._get_client")
    def test_json_ensure_ascii_false(self, mock_get_client):
        """Chinese characters should not be escaped."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        data = {"name": "测试数据"}
        upload_json("test.json", data)

        call_args = mock_client.put_object.call_args
        content = call_args[1].get("content") or call_args[0][2]
        assert "测试数据" in content.decode("utf-8")


# ── upload_bytes ─────────────────────────────────────────────────────

class TestUploadBytes:
    @patch("backend.common.tos_client._get_client")
    def test_uploads_binary(self, mock_get_client):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        content = b"\x00\x01\x02\x03"
        result = upload_bytes("test/image.png", content, content_type="image/png")

        assert result == f"tos://{BUCKET}/test/image.png"
        mock_client.put_object.assert_called_once()
        call_args = mock_client.put_object.call_args
        assert call_args[1].get("content_type") == "image/png"


# ── download_json ────────────────────────────────────────────────────

class TestDownloadJson:
    @patch("backend.common.tos_client._get_client")
    def test_downloads_and_parses(self, mock_get_client):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        data = {"result": "success"}
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(data).encode("utf-8")
        mock_client.get_object.return_value = mock_resp

        result = download_json(f"tos://{BUCKET}/test/data.json")
        assert result == data
        mock_client.get_object.assert_called_once_with(BUCKET, "test/data.json")


# ── download_bytes ───────────────────────────────────────────────────

class TestDownloadBytes:
    @patch("backend.common.tos_client._get_client")
    def test_downloads_binary(self, mock_get_client):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        raw = b"\xff\xfe\xfd"
        mock_resp = MagicMock()
        mock_resp.read.return_value = raw
        mock_client.get_object.return_value = mock_resp

        result = download_bytes(f"tos://{BUCKET}/test/file.bin")
        assert result == raw


# ── generate_presigned_url ───────────────────────────────────────────

class TestGeneratePresignedUrl:
    @patch("backend.common.tos_client._get_client")
    def test_returns_signed_url(self, mock_get_client):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_result = MagicMock()
        mock_result.signed_url = "https://tos-cn-shanghai.volces.com/bucket/key?sig=abc"
        mock_client.pre_signed_url.return_value = mock_result

        url = generate_presigned_url("path/to/file.mp4", expires_in=7200)
        assert url.startswith("https://")
        mock_client.pre_signed_url.assert_called_once()

    @patch("backend.common.tos_client._get_client")
    def test_default_expiry(self, mock_get_client):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_result = MagicMock()
        mock_result.signed_url = "https://example.com/signed"
        mock_client.pre_signed_url.return_value = mock_result

        generate_presigned_url("key")
        call_kwargs = mock_client.pre_signed_url.call_args
        assert call_kwargs[1].get("expires") == 3600 or call_kwargs[0][3] == 3600
