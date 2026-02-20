import json
import os
import google.generativeai as genai
from .base import LLMProvider


class GeminiProvider(LLMProvider):
    supports_tool_calling = True
    supports_json_mode = True

    def __init__(self):
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=system_prompt,
        )
        response = await model.generate_content_async(user_prompt)
        return response.text

    async def generate_with_tools(
        self, system_prompt: str, user_prompt: str, tool_schema: dict
    ) -> str:
        # Gemini's function calling schema doesn't support JSON Schema $defs or anyOf.
        # Use a single string parameter; the model places the full SceneSpec JSON there.
        function_declaration = {
            "name": tool_schema["name"],
            "description": (
                tool_schema["description"]
                + " Place the complete SceneSpec as a JSON string in scene_spec_json."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "scene_spec_json": {
                        "type": "string",
                        "description": "The complete SceneSpec JSON object as a string.",
                    }
                },
                "required": ["scene_spec_json"],
            },
        }
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=system_prompt,
            tools=[{"function_declarations": [function_declaration]}],
            tool_config={"function_calling_config": {"mode": "ANY"}},
        )
        response = await model.generate_content_async(user_prompt)
        for part in response.candidates[0].content.parts:
            fc = part.function_call
            if fc and fc.name:
                return dict(fc.args).get("scene_spec_json", "")
        raise RuntimeError("Gemini tool_calling: no function_call in response")

    async def generate_with_json_mode(
        self, system_prompt: str, user_prompt: str
    ) -> str:
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=system_prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json"
            ),
        )
        response = await model.generate_content_async(user_prompt)
        return response.text
