import os
from openai import AsyncOpenAI
from .base import LLMProvider


class OpenAIProvider(LLMProvider):
    supports_tool_calling = True
    supports_json_mode = True

    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        response = await self.client.chat.completions.create(
            model="gpt-4o",
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
            model="gpt-4o",
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
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        return response.choices[0].message.content
