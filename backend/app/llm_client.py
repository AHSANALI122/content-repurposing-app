"""The ONE place the LLM client is created.

We use the OpenAI SDK pointed at Gemini's OpenAI-compatible endpoint. To change
model/provider, change env vars (LLM_API_KEY / LLM_BASE_URL / LLM_MODEL) — not code.
Downstream code must use `chat.completions` (Gemini does not support `/responses`).
"""
from __future__ import annotations

from openai import OpenAI

from app.config import settings

client = OpenAI(api_key=settings.llm_api_key, base_url=settings.llm_base_url)
