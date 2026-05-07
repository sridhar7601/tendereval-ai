"""
Unified LLM client — Azure OpenAI GPT-4.1 (preferred) with OpenAI fallback.

Replaces direct Anthropic usage. Brief allows synthetic data only; on-prem
LLM swap path documented (just change AZURE_OPENAI_ENDPOINT to a self-hosted
Llama-3 / Mistral endpoint with OpenAI-compatible chat-completions API).

Used by: criteria_extractor, evaluator, dashboard briefing, audit narration.
All callers are deterministic-fallback-aware via mocks.is_mock_enabled().
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(_BACKEND_DIR / ".env.local")
load_dotenv(_BACKEND_DIR / ".env")

logger = logging.getLogger(__name__)

CACHE_DIR = _BACKEND_DIR / "data" / "llm_cache"


def has_llm() -> bool:
    return bool(os.environ.get("AZURE_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY"))


def _hash_key(payload: Any) -> str:
    blob = json.dumps(payload, sort_keys=True, default=str).encode()
    return hashlib.sha256(blob).hexdigest()[:16]


def _read_cache(key: str) -> str | None:
    path = CACHE_DIR / f"{key}.txt"
    if not path.exists():
        return None
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return None


def _write_cache(key: str, text: str) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    (CACHE_DIR / f"{key}.txt").write_text(text, encoding="utf-8")


def chat(
    system_prompt: str,
    user_content: str,
    *,
    max_tokens: int = 1024,
    temperature: float = 0.2,
    cache: bool = False,
    cache_key: str | None = None,
) -> str:
    """Single chat completion. Azure preferred, OpenAI fallback. Optionally disk-cached."""
    if cache and cache_key:
        cached = _read_cache(cache_key)
        if cached:
            return cached

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    azure_key = os.environ.get("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    if azure_key and azure_endpoint:
        with httpx.Client(timeout=60.0) as client:
            r = client.post(
                azure_endpoint,
                headers={"Content-Type": "application/json", "api-key": azure_key},
                json={
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
            )
            r.raise_for_status()
            data = r.json()
            text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
            if cache and cache_key:
                _write_cache(cache_key, text)
            return text

    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        raise RuntimeError("No LLM API key configured (set AZURE_OPENAI_* or OPENAI_API_KEY)")
    with httpx.Client(timeout=60.0) as client:
        r = client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {openai_key}"},
            json={
                "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
        )
        r.raise_for_status()
        data = r.json()
        text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
        if cache and cache_key:
            _write_cache(cache_key, text)
        return text


def extract_json_from_response(text: str) -> Any:
    """Strip markdown code fences and parse JSON."""
    if "```json" in text:
        text = text.split("```json", 1)[1].split("```", 1)[0]
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0]
    return json.loads(text.strip())
