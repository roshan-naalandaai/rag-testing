import time
import os
import uuid
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from models.request_models import GenerateRequest, EvaluateRequest
from providers.registry import get_provider
from generation.generator import SceneSpecGenerator
from services.validation_service import validate_scene_spec
from services import output_service
from knowledge_graph.basic_graph import BasicGraph
from user_graph.user_graph import UserGraph
from logging_config import setup_logging

_VERBOSE = os.getenv("LOG_VERBOSE", "").strip().lower() in {"1", "true", "yes", "on"}
setup_logging(verbose=_VERBOSE)
logger = logging.getLogger("backend")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stateless — safe to share across requests.
_kg = BasicGraph()
_user_graphs: dict[str, UserGraph] = {}


def _get_user_graph(user_id: str) -> UserGraph:
    uid = user_id.strip() or "default"
    ug = _user_graphs.get(uid)
    if ug is None:
        ug = UserGraph()
        _user_graphs[uid] = ug
    return ug


def _apply_user_mastery(ug: UserGraph, user_mastery: dict[str, float] | None) -> None:
    if not user_mastery:
        return
    for concept_id, level in user_mastery.items():
        ug.set_mastery(concept_id, level)



@app.get("/")
async def root():
    return {"message": "Welcome to the FastAPI backend!"}


@app.post("/generate")
async def generate(request: GenerateRequest):
    req_id = uuid.uuid4().hex[:8]
    logger.info(
        "generate:start id=%s provider=%s mode=%s topic=%s user_id=%s",
        req_id, request.provider, request.mode, request.topic, request.user_id or "default",
    )
    logger.info(
        "generate:inputs id=%s mastery_keys=%s",
        req_id, len(request.user_mastery or {}),
    )
    if _VERBOSE:
        logger.debug("generate:inputs_verbose id=%s mastery=%s", req_id, request.user_mastery)
    provider = get_provider(request.provider)
    user_id = (request.user_id or "default").strip() or "default"
    user_graph = _get_user_graph(user_id)
    _apply_user_mastery(user_graph, request.user_mastery)

    generator = SceneSpecGenerator(
        provider=provider,
        mode=request.mode,
        kg=_kg,
        user_graph=user_graph,
    )

    t0 = time.perf_counter()
    try:
        raw_output = await generator.generate(request.topic)
    except (KeyError, ValueError) as exc:
        logger.warning("generate:bad_request id=%s error=%s", req_id, exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as e:
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
        logger.error("generate:llm_error id=%s error=%s", req_id, e)
        return {
            "raw_output": "",
            "valid": False,
            "errors": [str(e)],
            "parsed": None,
            "latency_ms": elapsed_ms,
            "mode": request.mode,
            "saved_id": None,
            "compiled": None,
            "compile_error": None,
        }
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

    result = validate_scene_spec(raw_output)
    if _VERBOSE:
        logger.debug("generate:raw_output id=%s\n%s", req_id, raw_output)

    saved_id = None
    compiled = None
    compile_error = None

    if result["valid"]:
        saved_id, uncompiled_path = output_service.save_uncompiled(raw_output, request.topic)
        compiled, compile_error = await output_service.compile_output(saved_id, uncompiled_path)
        if compile_error:
            logger.warning("generate:compile_failed id=%s saved_id=%s error=%s", req_id, saved_id, compile_error)
    else:
        logger.info("generate:invalid_output id=%s errors=%s", req_id, len(result["errors"]))

    logger.info(
        "generate:done id=%s valid=%s latency_ms=%s saved_id=%s",
        req_id, result["valid"], elapsed_ms, saved_id,
    )
    return {
        "raw_output": raw_output,
        "valid": result["valid"],
        "errors": result["errors"],
        "parsed": result["parsed"],
        "latency_ms": elapsed_ms,
        "mode": request.mode,
        "saved_id": saved_id,
        "compiled": compiled,
        "compile_error": compile_error or None,
    }


@app.post("/evaluate")
async def evaluate(request: EvaluateRequest):
    req_id = uuid.uuid4().hex[:8]
    logger.info(
        "evaluate:start id=%s provider=%s mode=%s topic=%s runs=%s",
        req_id, request.provider, request.mode, request.topic, request.runs,
    )
    runs = []

    for _ in range(request.runs):
        provider = get_provider(request.provider)
        user_graph = UserGraph()
        generator = SceneSpecGenerator(
            provider=provider,
            mode=request.mode,
            kg=_kg,
            user_graph=user_graph,
        )

        t0 = time.perf_counter()
        try:
            raw_output = await generator.generate(request.topic)
        except ValueError:
            raw_output = ""
        latency_ms = (time.perf_counter() - t0) * 1000

        validation = validate_scene_spec(raw_output)
        runs.append({
            "valid": validation["valid"],
            "parsed": validation["parsed"],
            "latency_ms": latency_ms,
            "repair_attempted": generator.repair_attempted,
        })

    n = len(runs)
    valid_count = sum(r["valid"] for r in runs)
    invalid_count = n - valid_count
    repair_count = sum(r["repair_attempted"] for r in runs)
    latencies = [r["latency_ms"] for r in runs]

    first_valid_parsed = next((r["parsed"] for r in runs if r["valid"]), None)
    if first_valid_parsed is None:
        identical_structure_count = 0
    else:
        identical_structure_count = sum(
            1 for r in runs if r["valid"] and r["parsed"] == first_valid_parsed
        )

    result = {
        "runs": n,
        "valid_count": valid_count,
        "invalid_count": invalid_count,
        "identical_structure_count": identical_structure_count,
        "repair_count": repair_count,
        "valid_pct": round(valid_count / n * 100, 1),
        "identical_pct": round(identical_structure_count / n * 100, 1),
        "repair_pct": round(repair_count / n * 100, 1),
        "latency_per_run": [round(l, 1) for l in latencies],
        "avg_latency_ms": round(sum(latencies) / n, 1),
        "min_latency_ms": round(min(latencies), 1),
        "max_latency_ms": round(max(latencies), 1),
    }
    logger.info(
        "evaluate:done id=%s valid_pct=%s avg_latency_ms=%s",
        req_id, result["valid_pct"], result["avg_latency_ms"],
    )
    return result



@app.get("/knowledge-graph")
async def get_knowledge_graph():
    return {
        "topics": _kg.list_topics(),
        "concepts": _kg.list_concepts(),
    }


@app.get("/user-graph")
async def get_user_graph(user_id: str | None = None):
    ug = _get_user_graph((user_id or "default").strip() or "default")
    return ug.to_dict()
# ── Outputs endpoints ─────────────────────────────────────────────────────────

@app.get("/outputs")
async def list_outputs():
    return output_service.list_outputs()


@app.get("/outputs/{output_id}/uncompiled")
async def get_uncompiled(output_id: str):
    data = output_service.get_uncompiled(output_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Uncompiled output not found")
    return data


@app.get("/outputs/{output_id}/compiled")
async def get_compiled(output_id: str):
    data = output_service.get_compiled(output_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Compiled output not found")
    return data
