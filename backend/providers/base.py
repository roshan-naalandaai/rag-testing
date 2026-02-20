from abc import ABC, abstractmethod


class LLMProvider(ABC):
    supports_tool_calling: bool = False
    supports_json_mode: bool = False

    @abstractmethod
    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        pass

    async def generate_with_tools(
        self, system_prompt: str, user_prompt: str, tool_schema: dict
    ) -> str:
        raise NotImplementedError(f"{type(self).__name__} does not support tool calling")

    async def generate_with_json_mode(
        self, system_prompt: str, user_prompt: str
    ) -> str:
        raise NotImplementedError(f"{type(self).__name__} does not support JSON mode")
