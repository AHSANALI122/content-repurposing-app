"""Single-shot repurpose: build platform/tone-specific prompts and call the LLM.

One LLM call per platform. Exceptions propagate to the router, which rolls back
and returns a generic 502 — never leak raw provider errors to the client.
"""
from __future__ import annotations

from app.config import settings
from app.llm_client import client
from app.models import Platform, Tone

# Generous headroom so Gemini 2.5 thinking tokens don't truncate visible output.
_MAX_TOKENS = 2500

TONE_GUIDES: dict[Tone, str] = {
    Tone.professional: "Professional and polished: clear, credible, and authoritative without jargon.",
    Tone.casual: "Casual and conversational: friendly, warm, and easy-going, like talking to a friend.",
    Tone.witty: "Witty and clever: playful, sharp, and entertaining, with light humor that still informs.",
    Tone.bold: "Bold and punchy: confident, high-energy, and opinionated, with strong hooks and short lines.",
}

PLATFORM_RULES: dict[Platform, str] = {
    Platform.twitter: (
        "Write a Twitter/X thread of 5–8 tweets. Open with a strong hook tweet. "
        "Number each tweet like `1/`, `2/`, … and keep every tweet under 280 characters. "
        "Separate tweets with a blank line. No preamble — output only the thread."
    ),
    Platform.linkedin: (
        "Write a LinkedIn post. Start with a one-line hook followed by a blank line. "
        "Use short, skimmable paragraphs. End with an engaging question to drive comments, "
        "then add 3–5 relevant hashtags on the final line."
    ),
    Platform.instagram: (
        "Write an Instagram caption. Make it punchy and engaging, with emojis where they "
        "feel natural. End with a clear call to action, then add 8–12 relevant hashtags."
    ),
    Platform.newsletter: (
        "Write an email newsletter section. The first line must be `Subject: <subject>`. "
        "Then write 2–3 short paragraphs, and finish with a clear takeaway for the reader."
    ),
}


def _build_messages(
    source_text: str, title: str, tone: Tone, platform: Platform
) -> list[dict[str, str]]:
    system = (
        "You are an expert content repurposer. You turn long-form source material into "
        "platform-native copy that preserves the core message and value.\n\n"
        f"FORMAT RULES:\n{PLATFORM_RULES[platform]}\n\n"
        f"TONE:\n{TONE_GUIDES[tone]}\n\n"
        "Output only the finished copy — no explanations, labels, or markdown code fences."
    )
    user = f"Title: {title}\n\nSource content:\n{source_text}"
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def repurpose_for_platform(
    source_text: str, title: str, tone: Tone, platform: Platform
) -> str:
    """Call the LLM once for a single platform and return the generated copy."""
    response = client.chat.completions.create(
        model=settings.llm_model,
        messages=_build_messages(source_text, title, tone, platform),  # type: ignore[arg-type]
        max_tokens=_MAX_TOKENS,
    )
    content = response.choices[0].message.content
    if not content or not content.strip():
        raise ValueError(f"Empty completion for platform {platform.value}")
    return content.strip()
