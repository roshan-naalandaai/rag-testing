from __future__ import annotations

import json
import logging

from validators.timing_validator import fix_element_timings

logger = logging.getLogger("backend")


def parse_tool_response(raw: str) -> tuple[str, list[dict]]:
    """Parse the JSON string returned by an LLM tool call."""
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("json_utils: tool response is not valid JSON; returning as-is")
        return raw, []

    scene_spec_raw = parsed.get("scene_spec", "")
    voiceover = parsed.get("voiceover", [])

    if isinstance(scene_spec_raw, dict):
        scene_spec_str = json.dumps(fix_element_timings(scene_spec_raw))
    else:
        raw_str = str(scene_spec_raw).strip()
        try:
            scene_spec_str = json.dumps(fix_element_timings(json.loads(raw_str)))
        except json.JSONDecodeError:
            scene_spec_str = raw_str

    return scene_spec_str, voiceover if isinstance(voiceover, list) else []


def parse_json_mode_response(raw: str) -> tuple[str, list[dict]]:
    """Parse a JSON-mode response that wraps scene_spec + voiceover."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()

    try:
        outer = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("json_utils: json_mode response is not parseable; returning raw")
        return text, []

    if not isinstance(outer, dict):
        return text, []

    scene_spec_raw = outer.get("scene_spec", "")
    voiceover = outer.get("voiceover", [])

    if isinstance(scene_spec_raw, dict):
        scene_spec_str = json.dumps(fix_element_timings(scene_spec_raw))
    else:
        raw_str = str(scene_spec_raw).strip()
        try:
            scene_spec_str = json.dumps(fix_element_timings(json.loads(raw_str)))
        except json.JSONDecodeError:
            scene_spec_str = raw_str

    return scene_spec_str, voiceover if isinstance(voiceover, list) else []
