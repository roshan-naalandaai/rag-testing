import json
import os
from anthropic import AsyncAnthropic
from .base import LLMProvider


class ClaudeProvider(LLMProvider):
    supports_tool_calling = True
    supports_json_mode = True

    def __init__(self):
        self.client = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        response = await self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8096,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt},
            ],
        )
        return response.content[0].text

    async def generate_with_tools(
        self, system_prompt: str, user_prompt: str, tool_schema: dict
    ) -> str:
        response = await self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8096,
            system=system_prompt,
            tools=[{
                "name": tool_schema["name"],
                "description": tool_schema["description"],
                "input_schema": tool_schema["parameters"],
            }],
            tool_choice={"type": "tool", "name": tool_schema["name"]},
            messages=[
                {"role": "user", "content": user_prompt},
            ],
        )
        for block in response.content:
            if block.type == "tool_use":
                return json.dumps(block.input)
        raise RuntimeError("Claude tool_calling: no tool_use block in response")

    async def generate_with_json_mode(
        self, system_prompt: str, user_prompt: str
    ) -> str:
        # Response prefilling: seed the assistant turn with "{" to force raw JSON
        # output from the first character, bypassing markdown wrapping.
        response = await self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8096,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": "{"},
            ],
        )
        return "{" + response.content[0].text
