from fastapi import APIRouter, HTTPException

from services import output_service

router = APIRouter()


@router.get("/outputs")
async def list_outputs():
    return output_service.list_outputs()


@router.get("/outputs/{output_id}/uncompiled")
async def get_uncompiled(output_id: str):
    data = output_service.get_uncompiled(output_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Output not found")
    return data


@router.get("/outputs/{output_id}/compiled")
async def get_compiled(output_id: str):
    data = output_service.get_compiled(output_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Compiled output not found")
    return data
