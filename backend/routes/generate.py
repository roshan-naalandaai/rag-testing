from fastapi import APIRouter, HTTPException

from managers.generation_manager import run_generation_pipeline
from schemas.request_models import GenerateRequest

router = APIRouter()


@router.post("/generate")
async def generate(request: GenerateRequest):
    result = await run_generation_pipeline(
        prompt=request.prompt,
        provider_name=request.provider,
        model_name=request.model,
        chapter=request.chapter,
        roadmap_file=request.roadmap_file,
        agent_mode=request.agent_mode,
        planner_provider_name=request.planner_provider,
        planner_model_name=request.planner_model,
        drafter_provider_name=request.drafter_provider,
        drafter_model_name=request.drafter_model,
        reviewer_provider_name=request.reviewer_provider,
        reviewer_model_name=request.reviewer_model,
    )

    exc_type = result.pop("_exc_type", None)
    if exc_type == "ValueError":
        raise HTTPException(status_code=400, detail=result["errors"][0])

    return result
