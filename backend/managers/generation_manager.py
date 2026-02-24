from __future__ import annotations

import json
import logging
import time
import uuid

from constants.app_constants import RAG_TOP_K
from generation.chapter_rag import ChapterRAG
from generation.scene_generator import SceneGenerator
from logging_config import get_request_logger
from providers.registry import get_provider
from services import output_service
from services.validation_service import validate_scene_spec

logger = logging.getLogger("backend")

# Cached RAG instances — avoid reloading roadmap JSON on every request
_rag_cache: dict[tuple[str, str], ChapterRAG] = {}


def _get_rag(chapter: str, roadmap_file: str) -> ChapterRAG:
    key = (chapter, roadmap_file)
    if key not in _rag_cache:
        _rag_cache[key] = ChapterRAG(chapter=chapter, roadmap_file=roadmap_file)
    return _rag_cache[key]


async def run_generation_pipeline(
    prompt: str,
    provider_name: str,
    model_name: str | None,
    chapter: str,
    roadmap_file: str,
    agent_mode: str = "single",
    planner_provider_name: str | None = None,
    planner_model_name: str | None = None,
    drafter_provider_name: str | None = None,
    drafter_model_name: str | None = None,
    reviewer_provider_name: str | None = None,
    reviewer_model_name: str | None = None,
) -> dict:
    """
    Full generation pipeline: RAG → LLM → validate → save → compile.
    Returns a result dict. On a handled error, includes '_exc_type' so the
    route layer can map it to the appropriate HTTP status code.
    """
    req_id = uuid.uuid4().hex[:8]
    rlog = get_request_logger(req_id)

    rlog.info("=== NEW REQUEST ===")
    rlog.info("req_id   : %s", req_id)
    rlog.info("provider : %s", provider_name)
    rlog.info("model    : %s", model_name or "(default)")
    rlog.info("mode     : %s", agent_mode)
    if agent_mode == "multi":
        rlog.info(
            "roles    : planner=%s/%s drafter=%s/%s reviewer=%s/%s",
            provider_name,
            planner_model_name or "(default)",
            provider_name,
            drafter_model_name or "(default)",
            provider_name,
            reviewer_model_name or "(default)",
        )
    rlog.info("chapter  : %s / %s", chapter, roadmap_file)
    rlog.info("prompt   : %s", prompt)

    logger.info(
        "generate:start id=%s provider=%s model=%s mode=%s prompt=%r",
        req_id, provider_name, model_name or "(default)", agent_mode, prompt[:80],
    )

    # ── RAG retrieval ──────────────────────────────────────────────────────────
    rag = _get_rag(chapter, roadmap_file)
    retrieved = rag.retrieve(prompt, top_k=RAG_TOP_K)
    rlog.info("RAG retrieved %d topics:", len(retrieved))
    for t in retrieved:
        rlog.info("  [%s] %s  score=%.3f", t.id, t.name, t.score)

    # ── LLM generation ─────────────────────────────────────────────────────────
    provider = get_provider(provider_name, model=model_name)
    generator = SceneGenerator(provider=provider, chapter_rag=rag)

    t0 = time.perf_counter()
    rlog.info("LLM call start  provider=%s", provider_name)

    try:
        if agent_mode == "multi":
            resolved_planner = planner_provider_name or provider_name
            resolved_drafter = drafter_provider_name or provider_name
            resolved_reviewer = reviewer_provider_name or provider_name
            resolved_planner_model = planner_model_name
            resolved_drafter_model = drafter_model_name
            resolved_reviewer_model = reviewer_model_name
            scene_spec_str, voiceover = await generator.generate_multi(
                prompt,
                planner_provider_name=resolved_planner,
                planner_model_name=resolved_planner_model,
                drafter_provider_name=resolved_drafter,
                drafter_model_name=resolved_drafter_model,
                reviewer_provider_name=resolved_reviewer,
                reviewer_model_name=resolved_reviewer_model,
            )
        else:
            scene_spec_str, voiceover = await generator.generate(prompt)
    except ValueError as exc:
        elapsed = round((time.perf_counter() - t0) * 1000, 1)
        rlog.error("Generation ValueError: %s", exc)
        return {
            "req_id": req_id,
            "valid": False,
            "errors": [str(exc)],
            "scene_spec": None,
            "compiled": None,
            "compile_error": None,
            "voiceover": [],
            "saved_id": None,
            "latency_ms": elapsed,
            "_exc_type": "ValueError",
        }
    except Exception as exc:
        elapsed = round((time.perf_counter() - t0) * 1000, 1)
        rlog.exception("LLM call failed after %.0f ms", elapsed)
        logger.exception("generate:llm_error id=%s", req_id)
        return {
            "req_id": req_id,
            "valid": False,
            "errors": [str(exc)],
            "scene_spec": None,
            "compiled": None,
            "compile_error": None,
            "voiceover": [],
            "saved_id": None,
            "latency_ms": elapsed,
            "_exc_type": "LLMError",
        }

    llm_elapsed = round((time.perf_counter() - t0) * 1000, 1)
    rlog.info("LLM call done   latency=%.0f ms", llm_elapsed)
    rlog.info("Voiceover entries: %d", len(voiceover))
    for v in voiceover:
        rlog.debug(
            "  scene_id=%s  narration=%s",
            v.get("scene_id"), v.get("narration", "")[:80],
        )

    # ── Validation ─────────────────────────────────────────────────────────────
    rlog.info("Validating SceneSpec ...")
    validation = validate_scene_spec(scene_spec_str)

    if validation["valid"]:
        rlog.info("Validation PASSED")
    else:
        rlog.warning("Validation FAILED (%d errors):", len(validation["errors"]))
        for e in validation["errors"]:
            rlog.warning("  %s", e)

    # ── Save & compile ─────────────────────────────────────────────────────────
    saved_id = None
    compiled = None
    compile_error = None

    if validation["valid"]:
        saved_id, uncompiled_path = output_service.save_uncompiled(
            scene_spec_str, prompt
        )
        rlog.info("Saved uncompiled → %s", uncompiled_path)

        t_compile = time.perf_counter()
        compiled, compile_error = await output_service.compile_output(
            saved_id, uncompiled_path
        )
        compile_elapsed = round((time.perf_counter() - t_compile) * 1000, 1)

        if compiled:
            rlog.info("Compile PASSED  latency=%.0f ms", compile_elapsed)
        else:
            rlog.warning(
                "Compile FAILED  latency=%.0f ms  error=%s",
                compile_elapsed, compile_error,
            )

    total_elapsed = round((time.perf_counter() - t0) * 1000, 1)
    rlog.info("=== DONE  total_latency=%.0f ms ===", total_elapsed)

    logger.info(
        "generate:done id=%s valid=%s compiled=%s latency=%.0fms",
        req_id, validation["valid"], compiled is not None, total_elapsed,
    )

    scene_spec_parsed = None
    try:
        scene_spec_parsed = json.loads(scene_spec_str)
    except Exception:
        pass

    return {
        "req_id": req_id,
        "valid": validation["valid"],
        "errors": validation["errors"],
        "scene_spec": scene_spec_parsed,
        "compiled": compiled,
        "compile_error": compile_error or None,
        "voiceover": voiceover,
        "saved_id": saved_id,
        "latency_ms": total_elapsed,
        "agent_mode": agent_mode,
        "provider": provider_name,
        "model": model_name,
        "agent_providers": (
            {
                "planner": provider_name,
                "drafter": provider_name,
                "reviewer": provider_name,
            }
            if agent_mode == "multi"
            else None
        ),
        "agent_models": (
            {
                "planner": planner_model_name,
                "drafter": drafter_model_name,
                "reviewer": reviewer_model_name,
            }
            if agent_mode == "multi"
            else None
        ),
    }
