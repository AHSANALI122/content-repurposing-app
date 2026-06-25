"""Agent repurpose: a tool-calling loop over the OpenAI SDK (Gemini).

The agent is given a URL and/or pasted text. It decides its own steps: it may
call ``fetch_url`` to read a page, then must call ``submit_outputs`` once with the
final platform copy. We expose a ``trace`` of what it did.

Guardrails honored here:
- ``fetch_url`` is SSRF-safe (see CLAUDE.md §2 / spec §5): only public http/https,
  loopback/private/link-local/metadata/reserved blocked, every redirect hop
  re-validated. Never loosen this.
- Tool/loop errors surface as short, controlled trace messages — never raw provider
  exceptions or stack traces.
"""
from __future__ import annotations

import ipaddress
import json
import logging
import socket
from urllib.parse import urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup

from app.config import settings
from app.llm import PLATFORM_RULES, TONE_GUIDES
from app.llm_client import client
from app.models import Platform, Tone

logger = logging.getLogger("echo")

# Generous headroom so Gemini 2.5 thinking tokens don't truncate output.
_MAX_TOKENS = 4000
# How many reasoning/tool turns the agent may take before we give up.
_MAX_STEPS = 8
# Readable text handed back to the model from a fetched page.
_FETCH_CHAR_LIMIT = 8000
# Cap raw HTML we parse so a huge page can't blow up memory/CPU.
_HTML_BYTE_LIMIT = 2_000_000
_MAX_REDIRECTS = 4
_FETCH_TIMEOUT = 10.0
_USER_AGENT = "EchoAgent/1.0 (+content-repurposer)"


# --- SSRF-safe URL fetching ---------------------------------------------------


def _assert_public_url(url: str) -> None:
    """Raise ValueError unless ``url`` is http/https resolving only to public IPs."""
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https"):
        raise ValueError("Only http and https URLs are allowed.")
    host = parts.hostname
    if not host:
        raise ValueError("URL is missing a host.")

    try:
        infos = socket.getaddrinfo(host, parts.port or (443 if parts.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise ValueError("Could not resolve the URL's host.") from exc

    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_loopback
            or ip.is_private
            or ip.is_link_local  # 169.254.0.0/16 — incl. cloud metadata endpoint
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise ValueError("URL resolves to a blocked (non-public) address.")


def _extract_text(html: str) -> str:
    """Strip boilerplate and return collapsed, truncated readable text."""
    soup = BeautifulSoup(html[:_HTML_BYTE_LIMIT], "html.parser")
    for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "aside"]):
        tag.decompose()
    text = soup.get_text(separator=" ", strip=True)
    text = " ".join(text.split())
    return text[:_FETCH_CHAR_LIMIT]


def fetch_url(url: str) -> str:
    """Fetch a public web page and return readable text. SSRF-safe.

    Redirects are followed manually (max ~4 hops), re-validating the target of
    every hop. Raises ValueError with a short, safe message on any failure.
    """
    current = url
    headers = {"User-Agent": _USER_AGENT}
    with httpx.Client(follow_redirects=False, timeout=_FETCH_TIMEOUT, headers=headers) as http:
        for _ in range(_MAX_REDIRECTS + 1):
            _assert_public_url(current)
            try:
                resp = http.get(current)
            except httpx.HTTPError as exc:
                logger.warning("fetch_url request failed for %s: %s", current, exc)
                raise ValueError("Failed to fetch the page.") from exc

            if resp.is_redirect:
                location = resp.headers.get("location")
                if not location:
                    raise ValueError("Redirect without a destination.")
                current = urljoin(current, location)
                continue

            if resp.status_code >= 400:
                raise ValueError(f"The page returned HTTP {resp.status_code}.")
            return _extract_text(resp.text)

    raise ValueError("Too many redirects.")


# --- Tool schemas -------------------------------------------------------------

_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "fetch_url",
            "description": (
                "Fetch a public web page and return its readable text. Use this when "
                "the user provided a URL and you need its content before writing."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The http(s) URL to fetch."}
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "submit_outputs",
            "description": (
                "Submit the final platform-native copy. Call this exactly once when "
                "you are done, with one entry per requested platform."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "outputs": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "platform": {
                                    "type": "string",
                                    "enum": [p.value for p in Platform],
                                },
                                "content": {"type": "string"},
                            },
                            "required": ["platform", "content"],
                        },
                    }
                },
                "required": ["outputs"],
            },
        },
    },
]


# --- Loop ---------------------------------------------------------------------


def _build_system_prompt(tone: Tone, platforms: list[Platform]) -> str:
    platform_lines = "\n".join(
        f"- {p.value}: {PLATFORM_RULES[p]}" for p in platforms
    )
    return (
        "You are an autonomous content repurposing agent. You turn source material "
        "into platform-native copy that preserves the core message and value.\n\n"
        "You are given source material as pasted text and/or a URL. If a URL is "
        "provided, call fetch_url to read it before writing. You may call fetch_url "
        "more than once if needed.\n\n"
        f"Write copy for each of these platforms, following its rules exactly:\n"
        f"{platform_lines}\n\n"
        f"TONE:\n{TONE_GUIDES[tone]}\n\n"
        "When finished, call submit_outputs exactly once with one entry per platform. "
        "Each entry's content must be only the finished copy — no explanations, "
        "labels, or markdown code fences."
    )


def _build_user_prompt(url: str | None, source_text: str | None, title: str) -> str:
    parts = [f"Title: {title}"]
    if url:
        parts.append(f"URL to fetch: {url}")
    if source_text:
        parts.append(f"Pasted source content:\n{source_text}")
    return "\n\n".join(parts)


def _assistant_message(msg, tool_calls) -> dict:
    """Re-serialize an assistant turn (with its tool calls) for the next request."""
    return {
        "role": "assistant",
        "content": msg.content or "",
        "tool_calls": [
            {
                "id": tc.id,
                "type": "function",
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                },
            }
            for tc in tool_calls
        ],
    }


def _parse_submitted(tool_call, platforms: list[Platform]) -> list[tuple[Platform, str]]:
    """Filter submitted outputs to the requested platforms, de-duplicated."""
    requested = {p.value for p in platforms}
    try:
        args = json.loads(tool_call.function.arguments or "{}")
    except json.JSONDecodeError:
        return []
    result: list[tuple[Platform, str]] = []
    seen: set[str] = set()
    for item in args.get("outputs", []):
        if not isinstance(item, dict):
            continue
        plat = item.get("platform")
        content = item.get("content")
        if (
            plat in requested
            and plat not in seen
            and isinstance(content, str)
            and content.strip()
        ):
            seen.add(plat)
            result.append((Platform(plat), content.strip()))
    return result


def run_agent(
    url: str | None,
    source_text: str | None,
    title: str,
    tone: Tone,
    platforms: list[Platform],
) -> tuple[list[tuple[Platform, str]], list[dict[str, str]]]:
    """Run the tool-calling loop. Returns (outputs, trace).

    ``outputs`` is a list of (platform, content) filtered to the requested
    platforms. ``trace`` is a list of {type, detail} steps.
    """
    trace: list[dict[str, str]] = []
    messages: list[dict] = [
        {"role": "system", "content": _build_system_prompt(tone, platforms)},
        {"role": "user", "content": _build_user_prompt(url, source_text, title)},
    ]

    for _ in range(_MAX_STEPS):
        response = client.chat.completions.create(
            model=settings.llm_model,
            messages=messages,  # type: ignore[arg-type]
            tools=_TOOLS,  # type: ignore[arg-type]
            max_tokens=_MAX_TOKENS,
        )
        msg = response.choices[0].message
        tool_calls = msg.tool_calls or []

        if not tool_calls:
            # Plain text with no tool call — nudge it to finish properly.
            trace.append(
                {"type": "note", "detail": "Model replied without a tool call; nudging it to submit."}
            )
            messages.append({"role": "assistant", "content": msg.content or ""})
            messages.append(
                {
                    "role": "user",
                    "content": "Please call submit_outputs now with the final copy for each platform.",
                }
            )
            continue

        messages.append(_assistant_message(msg, tool_calls))

        finish_call = None
        for tc in tool_calls:
            if tc.function.name == "fetch_url":
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                target = args.get("url", "")
                try:
                    page_text = fetch_url(target)
                    trace.append({"type": "tool", "detail": f"Fetched {target}"})
                    tool_content = page_text
                except ValueError as exc:
                    trace.append({"type": "error", "detail": f"Could not fetch {target}: {exc}"})
                    tool_content = (
                        f"ERROR: could not fetch URL ({exc}). "
                        "Proceed using any pasted text, or report that you could not."
                    )
                messages.append(
                    {"role": "tool", "tool_call_id": tc.id, "content": tool_content}
                )
            elif tc.function.name == "submit_outputs":
                finish_call = tc

        if finish_call is not None:
            outputs = _parse_submitted(finish_call, platforms)
            trace.append(
                {"type": "finish", "detail": f"Submitted copy for {len(outputs)} platform(s)."}
            )
            return outputs, trace

    trace.append({"type": "error", "detail": "Agent stopped before producing final copy."})
    return [], trace
