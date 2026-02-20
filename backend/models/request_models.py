from typing import Literal, Optional
from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    provider: Literal["openai", "claude", "gemini"]
    topic: str
    mode: Literal["direct_schema", "two_pass", "tool_calling", "grammar_constrained"] = "direct_schema"
    user_mastery: Optional[dict[str, float]] = None
    user_id: Optional[str] = None


class EvaluateRequest(BaseModel):
    provider: Literal["openai", "claude", "gemini"]
    topic: str
    mode: Literal["direct_schema", "two_pass", "tool_calling", "grammar_constrained"] = "direct_schema"
    runs: int = Field(default=3, ge=1, le=10)
