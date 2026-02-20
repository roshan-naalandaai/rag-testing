import json
import logging
from pydantic import ValidationError
from schemas.scene_spec import SceneSpec

logger = logging.getLogger("backend")


def validate_scene_spec(json_str: str) -> dict:
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.info("validate_scene_spec:json_parse_error error=%s", e)
        return {"valid": False, "errors": [f"JSON parse error: {e}"], "parsed": None}

    try:
        spec = SceneSpec.model_validate(data)
    except ValidationError as e:
        errors = [f"{' -> '.join(str(loc) for loc in err['loc'])}: {err['msg']}" for err in e.errors()]
        logger.info("validate_scene_spec:validation_error count=%s", len(errors))
        return {"valid": False, "errors": errors, "parsed": None}

    return {"valid": True, "errors": [], "parsed": spec.model_dump()}
