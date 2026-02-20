"""
Provider registry — single source of truth for available LLM providers.
To add a new provider: import it and add it to _REGISTRY.
"""

from .base import LLMProvider
from .openai_provider import OpenAIProvider
from .claude_provider import ClaudeProvider
from .gemini_provider import GeminiProvider

_REGISTRY: dict[str, type[LLMProvider]] = {
    "openai": OpenAIProvider,
    "claude": ClaudeProvider,
    "gemini": GeminiProvider,
}


def get_provider(name: str) -> LLMProvider:
    if name not in _REGISTRY:
        raise ValueError(f"Unknown provider: '{name}'. Available: {list(_REGISTRY)}")
    return _REGISTRY[name]()
