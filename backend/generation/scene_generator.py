from __future__ import annotations

import json
import logging
from pathlib import Path

from generation.chapter_rag import ChapterRAG, RetrievedTopic
from providers.base import LLMProvider
from providers.registry import get_provider
from schemas.scene_spec import SceneSpec
from utils.json_utils import parse_json_mode_response, parse_tool_response

logger = logging.getLogger("backend")

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

_TOOL_SCHEMA = {
    "name": "generate_lesson",
    "description": (
        "Generate an animated whiteboard accounting lesson with per-scene voiceover narration."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "scene_spec": {
                "type": "string",
                "description": (
                    "Complete SceneSpec JSON string. Must be valid JSON that strictly "
                    "conforms to the SceneSpec schema provided in the system prompt."
                ),
            },
            "voiceover": {
                "type": "array",
                "description": "Teacher narration lines, one entry per scene.",
                "items": {
                    "type": "object",
                    "properties": {
                        "scene_id": {"type": "string"},
                        "narration": {
                            "type": "string",
                            "description": "What the teacher says while this scene is displayed.",
                        },
                    },
                    "required": ["scene_id", "narration"],
                },
            },
        },
        "required": ["scene_spec", "voiceover"],
    },
}

_DEFAULT_PLAN = {
    "learner_case": "new_concept",
    "focus_points": [],
    "risk_areas": [],
}


class SceneGenerator:
    """
    RAG retrieval -> prompt building -> LLM call -> (scene_spec_str, voiceover_list).
    """

    def __init__(self, provider: LLMProvider, chapter_rag: ChapterRAG) -> None:
        self.provider = provider
        self.rag = chapter_rag

    async def generate(self, prompt: str) -> tuple[str, list[dict]]:
        """Single-agent generation."""
        topics = self._retrieve_topics(prompt)
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_generation_user_prompt(prompt, topics)
        return await self._invoke_generation(self.provider, system_prompt, user_prompt)

    async def generate_multi(
        self,
        prompt: str,
        planner_provider_name: str,
        planner_model_name: str | None,
        drafter_provider_name: str,
        drafter_model_name: str | None,
        reviewer_provider_name: str,
        reviewer_model_name: str | None,
    ) -> tuple[str, list[dict]]:
        """
        Multi-agent generation:
        1) Planner agent creates a concise teaching plan.
        2) Draft agent generates scene_spec + voiceover from that plan.
        3) Reviewer agent improves correctness, pedagogy, and visual alignment.
        """
        topics = self._retrieve_topics(prompt)
        system_prompt = self._build_system_prompt()
        planner_provider = get_provider(planner_provider_name, model=planner_model_name)
        drafter_provider = get_provider(drafter_provider_name, model=drafter_model_name)
        reviewer_provider = get_provider(reviewer_provider_name, model=reviewer_model_name)

        teaching_plan = await self._planner_step(prompt, topics, planner_provider)

        draft_user_prompt = self._build_generation_user_prompt(
            prompt,
            topics,
            planning_notes=teaching_plan,
        )
        draft_scene_spec, draft_voiceover = await self._invoke_generation(
            drafter_provider,
            system_prompt,
            draft_user_prompt,
        )

        review_prompt = self._build_review_prompt(
            prompt=prompt,
            topics=topics,
            teaching_plan=teaching_plan,
            draft_scene_spec=draft_scene_spec,
            draft_voiceover=draft_voiceover,
        )
        final_scene_spec, final_voiceover = await self._invoke_generation(
            reviewer_provider,
            system_prompt,
            review_prompt,
        )

        if not final_voiceover and draft_voiceover:
            final_voiceover = draft_voiceover

        return final_scene_spec, final_voiceover

    def _retrieve_topics(self, prompt: str) -> list[RetrievedTopic]:
        topics = self.rag.retrieve(prompt, top_k=8)
        if not topics:
            raise ValueError(
                "No relevant topics found in the chapter roadmap for this prompt. "
                "Try rephrasing your question."
            )
        return topics

    def _build_system_prompt(self) -> str:
        schema_ref = json.dumps(SceneSpec.model_json_schema(), indent=2)
        return _load_system_prompt(schema_ref)

    def _build_generation_user_prompt(
        self,
        prompt: str,
        topics: list[RetrievedTopic],
        planning_notes: dict | None = None,
    ) -> str:
        user_prompt = _load_user_prompt(prompt, topics)
        if planning_notes:
            user_prompt += (
                "\n\nPlanner notes (treat as strict guidance):\n"
                + json.dumps(planning_notes, indent=2)
                + "\n\nGenerate the final lesson using the planner notes."
            )
        return user_prompt

    def _build_review_prompt(
        self,
        prompt: str,
        topics: list[RetrievedTopic],
        teaching_plan: dict,
        draft_scene_spec: str,
        draft_voiceover: list[dict],
    ) -> str:
        base_prompt = _load_user_prompt(prompt, topics)
        return (
            base_prompt
            + "\n\nYou are the Reviewer Agent. Improve the draft lesson below."
            + "\nGoals: improve pedagogical clarity, timing realism, and scene-to-voiceover alignment."
            + "\nKeep the same core topic and stay within schema and animation constraints."
            + "\n\nPlanner notes:\n"
            + json.dumps(teaching_plan, indent=2)
            + "\n\nDraft output to revise:\n"
            + json.dumps(
                {
                    "scene_spec": draft_scene_spec,
                    "voiceover": draft_voiceover,
                },
                indent=2,
            )
            + "\n\nReturn only improved scene_spec and voiceover in the required format."
        )

    async def _planner_step(
        self,
        prompt: str,
        topics: list[RetrievedTopic],
        provider: LLMProvider,
    ) -> dict:
        topic_lines = "\n".join(
            f"[{t.id}] {t.name} (depth {t.level}): {t.description}" for t in topics[:6]
        )

        planner_system = (
            "You are Planner Agent for an accounting tutor. "
            "Output compact JSON only."
        )
        planner_user = (
            f"User query: {prompt}\n\n"
            f"Retrieved topics:\n{topic_lines}\n\n"
            "Return a JSON object with keys:\n"
            "- learner_case: one of [new_concept, confused_terms, procedure_problem_solving, "
            "calculation_errors, memorized_not_understood, weak_prerequisites, low_confidence, "
            "advanced_learner, exam_prep, revision_session]\n"
            "- focus_points: array of 3-5 short bullets\n"
            "- risk_areas: array of 1-3 common mistakes\n"
            "- scene_emphasis: array of short strings describing which scene should carry what emphasis\n"
        )

        try:
            if provider.supports_json_mode:
                raw = await provider.generate_with_json_mode(planner_system, planner_user)
            else:
                raw = await provider.generate(planner_system, planner_user)

            parsed = _safe_json_object(raw)
            if not parsed:
                return dict(_DEFAULT_PLAN)

            return {
                "learner_case": str(parsed.get("learner_case", _DEFAULT_PLAN["learner_case"])),
                "focus_points": parsed.get("focus_points", []),
                "risk_areas": parsed.get("risk_areas", []),
                "scene_emphasis": parsed.get("scene_emphasis", []),
            }
        except Exception:
            logger.exception("planner_step: failed, falling back to default plan")
            return dict(_DEFAULT_PLAN)

    async def _invoke_generation(
        self,
        provider: LLMProvider,
        system_prompt: str,
        user_prompt: str,
    ) -> tuple[str, list[dict]]:
        if provider.supports_tool_calling:
            raw = await provider.generate_with_tools(
                system_prompt,
                user_prompt,
                _TOOL_SCHEMA,
            )
            return parse_tool_response(raw)

        if provider.supports_json_mode:
            augmented = (
                user_prompt
                + "\n\nReturn a JSON object with exactly two keys:\n"
                + '  "scene_spec": <the complete SceneSpec as a JSON string>\n'
                + '  "voiceover": <array of {scene_id, narration}>'
            )
            raw = await provider.generate_with_json_mode(system_prompt, augmented)
            return parse_json_mode_response(raw)

        augmented = (
            user_prompt
            + "\n\nReturn ONLY a valid JSON object with exactly two keys:\n"
            + '  "scene_spec": <the complete SceneSpec as a JSON string>\n'
            + '  "voiceover": <array of {scene_id, narration}>\n'
            + "No markdown, no explanation."
        )
        raw = await provider.generate(system_prompt, augmented)
        return parse_json_mode_response(raw)


# prompt loaders

def _load_system_prompt(schema_ref: str) -> str:
    template = (_PROMPTS_DIR / "system_prompt.md").read_text(encoding="utf-8")
    return template.replace("{schema_ref}", schema_ref)


def _load_user_prompt(query: str, topics: list[RetrievedTopic]) -> str:
    topic_lines = "\n".join(
        f"  [{t.id}] {t.name} (depth {t.level}): {t.description}"
        for t in topics[:6]
    )
    template = (_PROMPTS_DIR / "user_prompt.md").read_text(encoding="utf-8")
    return template.replace("{query}", query).replace("{topics}", topic_lines)


def _safe_json_object(raw: str) -> dict | None:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    candidate = text[start : end + 1]
    try:
        parsed = json.loads(candidate)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None
