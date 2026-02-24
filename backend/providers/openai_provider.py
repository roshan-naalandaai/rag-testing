import hashlib
import logging
import os

from openai import AsyncOpenAI

from constants.app_constants import OPENAI_MODEL
from providers.base import LLMProvider

logger = logging.getLogger("backend")


class OpenAIProvider(LLMProvider):
    supports_tool_calling = True
    supports_json_mode = True

    def __init__(self, model: str | None = None):
        api_key = os.environ["OPENAI_API_KEY"]
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model or OPENAI_MODEL
        logger.info("openai_provider:key_fingerprint %s", self._fingerprint(api_key))

    @staticmethod
    def _fingerprint(api_key: str) -> str:
        """Non-sensitive identifier for debugging env/key mismatch issues."""
        if not api_key:
            return "masked=empty len=0 sha8=none"
        masked = f"{api_key[:10]}...{api_key[-4:]}" if len(api_key) > 14 else "***"
        sha8 = hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:8]
        return f"masked={masked} len={len(api_key)} sha8={sha8}"

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response.choices[0].message.content

    async def generate_with_tools(
        self, system_prompt: str, user_prompt: str, tool_schema: dict
    ) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            tools=[{
                "type": "function",
                "function": {
                    "name": tool_schema["name"],
                    "description": tool_schema["description"],
                    "parameters": tool_schema["parameters"],
                },
            }],
            tool_choice={"type": "function", "function": {"name": tool_schema["name"]}},
        )
        return response.choices[0].message.tool_calls[0].function.arguments

    async def generate_with_json_mode(
        self, system_prompt: str, user_prompt: str
    ) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        return response.choices[0].message.content
