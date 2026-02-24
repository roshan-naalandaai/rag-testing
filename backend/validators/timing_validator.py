from __future__ import annotations

import logging

from constants.app_constants import ELEMENT_TIMING_BUFFER, MIN_ELEMENT_DURATION

logger = logging.getLogger("backend")


def fix_element_timings(spec: dict) -> dict:
    """
    Post-process a parsed SceneSpec dict to ensure every element fits within
    its scene duration (with a ELEMENT_TIMING_BUFFER second gap).
    If a scene overflows, all element durations are scaled down proportionally.
    """
    for scene in spec.get("scenes", []):
        scene_dur = scene.get("duration", 0)
        elements = scene.get("elements", [])
        if not elements:
            continue

        last_end = max(
            el.get("startTime", 0) + el.get("duration", 0) for el in elements
        )
        budget = scene_dur - ELEMENT_TIMING_BUFFER

        if last_end > budget and last_end > 0:
            scale = budget / last_end
            logger.warning(
                "timing_validator: overflow in scene '%s' "
                "(last_end=%.2f > budget=%.2f). Scaling elements by %.3f",
                scene.get("id", "?"),
                last_end,
                budget,
                scale,
            )
            for el in elements:
                el["startTime"] = round(el.get("startTime", 0) * scale, 3)
                el["duration"] = round(
                    max(MIN_ELEMENT_DURATION, el.get("duration", 0) * scale), 3
                )

    return spec
