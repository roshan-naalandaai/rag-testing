from pydantic import BaseModel
from typing import Literal

from constants.app_constants import DEFAULT_CHAPTER, DEFAULT_PROVIDER, DEFAULT_ROADMAP_FILE


class GenerateRequest(BaseModel):
    prompt: str
    provider: str = DEFAULT_PROVIDER
    model: str | None = None
    chapter: str = DEFAULT_CHAPTER
    roadmap_file: str = DEFAULT_ROADMAP_FILE
    agent_mode: Literal["single", "multi"] = "single"
    planner_provider: str | None = None
    planner_model: str | None = None
    drafter_provider: str | None = None
    drafter_model: str | None = None
    reviewer_provider: str | None = None
    reviewer_model: str | None = None
