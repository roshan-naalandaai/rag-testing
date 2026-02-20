from typing import Literal
import logging

from providers.base import LLMProvider
from generation.plan_builder import build_structured_plan
from services.validation_service import validate_scene_spec
from schemas.scene_spec import SceneSpec

GenerationMode = Literal["direct_schema", "two_pass", "tool_calling", "grammar_constrained"]
logger = logging.getLogger("backend")

# ---------------------------------------------------------------------------
# Schema rules + type reference (injected into every system prompt)
# ---------------------------------------------------------------------------

_RULES_AND_SCHEMA = """\
RULES:
- Output ONLY the JSON object. No markdown, no code fences, no explanation, no comments.
- Do not include any keys not defined in the schema.
- All required fields must be present.
- All enum values must be exactly as listed.
- Element startTime + duration must not exceed the containing scene's duration.
- Scene time ranges must not overlap (each scene's startTime + duration <= next scene's startTime).

SCHEMA:

SceneSpec {
  meta: Meta
  assets: Assets
  scenes: Scene[]
}

Meta {
  title: string
  version: string                          -- e.g. "1.0"
  resolution: { width: int, height: int }  -- positive integers
  fps: int                                 -- positive integer
  backgroundColor: string                  -- CSS color e.g. "#000000"
}

Assets {
  svgs: SvgAsset[]
  audio: AudioAsset[]
  images: string[]                         -- may be empty list
}

SvgAsset  { id: string, url: string, width: int, height: int }
AudioAsset { id: string, url: string }

Scene {
  id: string
  name: string
  startTime: float   -- >= 0
  duration: float    -- > 0
  background: string -- CSS color
  audio: AudioRef
  elements: Element[]
}

AudioRef { assetId: string, volume: float }  -- volume 0.0 to 1.0

Element is one of: TextElement | SvgElement | ShapeElement
All elements share:
  type: string  startTime: float  duration: float  layout: Layout

Layout {
  position: "center" | "left" | "right" | "top" | "bottom"
  region: "main-content" | "top-banner" | "bottom-banner" | "left-third" | "right-third"
        | "center-third" | "left-half" | "right-half" | "top-third" | "bottom-third"
  size: "small" | "medium" | "large"   -- optional
  offset: { x: int, y: int }           -- optional
}

TextElement  (type="text")  { text, color, fontSize: int, fontFamily, animationType: "draw"|"fade"|"none" }
SvgElement   (type="svg")   { assetId: string }
ShapeElement (type="shape") { shape: "rectangle"|"circle"|"line", color: string, fill: boolean }
"""

# ---------------------------------------------------------------------------
# Prompt helpers
# ---------------------------------------------------------------------------

def _format_plan(plan: dict) -> str:
    """
    Render the lesson plan as human-readable text for the system prompt.

    Internal keys prefixed with '_' (teaching_plan, confidence,
    weak_prerequisites) are consumed here for prompt shaping but are
    NOT forwarded verbatim to the LLM.
    """
    lines = [f"LESSON PLAN — Topic: {plan['topic']}", ""]
    for i, concept in enumerate(plan["concept_sequence"], 1):
        teaching_plan = concept.get("_teaching_plan", {})
        depth_label = teaching_plan.get("explanation_depth", "medium")
        review_ids = teaching_plan.get("review_concepts", [])
        weak_prereqs = concept.get("_weak_prerequisites", [])

        lines.append(f"{i}. {concept['title']}  [depth: {depth_label}]")
        lines.append(f"   {concept['description']}")

        if concept["examples"]:
            lines.append("   Examples:")
            for ex in concept["examples"]:
                lines.append(f"   - {ex}")

        if review_ids:
            lines.append(f"   ⚠ Student needs review of: {', '.join(review_ids)}")

        if weak_prereqs:
            titles = [p["title"] for p in weak_prereqs]
            lines.append(f"   Prerequisites to reinforce: {', '.join(titles)}")

        lines.append("")
    return "\n".join(lines)


def _build_system_prompt(plan: dict) -> str:
    return (
        "You are a scene specification generator for educational videos. "
        "Your only job is to output a single valid JSON object following the SceneSpec schema.\n\n"
        f"{_format_plan(plan)}\n"
        f"{_RULES_AND_SCHEMA}"
    )


# ---------------------------------------------------------------------------
# Generator
# ---------------------------------------------------------------------------

class SceneSpecGenerator:
    def __init__(
        self,
        provider: LLMProvider,
        mode: GenerationMode = "direct_schema",
        kg=None,
        user_graph=None,
    ):
        self.provider = provider
        self.mode = mode
        self.kg = kg
        self.user_graph = user_graph
        self.repair_attempted: bool = False
        # Populated after generate() so callers can update mastery
        self._last_plan: dict | None = None

    async def generate(self, topic: str) -> str:
        self.repair_attempted = False
        plan = build_structured_plan(topic, self.kg, self.user_graph)
        self._last_plan = plan

        # Record exposure for every concept that was included in this lesson
        if self.user_graph is not None:
            for concept in plan["concept_sequence"]:
                self.user_graph.record_exposure(concept["id"])

        system_prompt = _build_system_prompt(plan)
        user_prompt = (
            f"Generate a SceneSpec JSON for the following educational topic: {topic}"
        )
        logger.info(
            "generator:plan_built topic=%s concepts=%s mode=%s",
            topic, len(plan.get("concept_sequence", [])), self.mode,
        )
        logger.info(
            "generator:prompt_sizes system_chars=%s user_chars=%s",
            len(system_prompt), len(user_prompt),
        )
        logger.debug("generator:plan_verbose topic=%s plan=%s", topic, plan)
        logger.debug("generator:system_prompt\n%s", system_prompt)
        logger.debug("generator:user_prompt\n%s", user_prompt)

        if self.mode == "direct_schema":
            return await self._direct_schema(system_prompt, user_prompt)
        elif self.mode == "two_pass":
            return await self._two_pass(system_prompt, user_prompt)
        elif self.mode == "tool_calling":
            return await self._tool_calling(system_prompt, user_prompt)
        elif self.mode == "grammar_constrained":
            return await self._grammar_constrained(system_prompt, user_prompt)
        else:
            raise ValueError(f"Unknown generation mode: '{self.mode}'")

    # ------------------------------------------------------------------
    # Post-interaction update  (call after user answers a check question)
    # ------------------------------------------------------------------

    def post_interaction_update(
        self,
        concept_id: str,
        *,
        correct: bool,
        misunderstanding_detected: bool = False,
    ) -> None:
        """
        Update UserGraph state after a student interaction.

        Parameters
        ----------
        concept_id : str
            The concept the student was checked on.
        correct : bool
            Whether the student answered correctly.
        misunderstanding_detected : bool
            True if the system detected a conceptual misunderstanding
            (e.g. from response analysis), regardless of technical correctness.
        """
        if self.user_graph is None:
            return

        if correct:
            self.user_graph.record_correct_answer(concept_id)
        else:
            self.user_graph.record_confusion(concept_id)

        if misunderstanding_detected:
            # Increment confusion even on a technically correct answer if
            # the student demonstrated a conceptual gap.
            self.user_graph.record_confusion(concept_id)

    # ------------------------------------------------------------------
    # Mode implementations
    # ------------------------------------------------------------------

    async def _direct_schema(self, system_prompt: str, user_prompt: str) -> str:
        return await self.provider.generate(system_prompt, user_prompt)

    async def _two_pass(self, system_prompt: str, user_prompt: str) -> str:
        draft = await self.provider.generate(system_prompt, user_prompt)

        result = validate_scene_spec(draft)
        if result["valid"]:
            return draft

        self.repair_attempted = True
        error_summary = "\n".join(result["errors"])
        correction_prompt = (
            f"The JSON you generated has the following validation errors:\n\n"
            f"{error_summary}\n\n"
            f"Original JSON:\n{draft}\n\n"
            f"Return only the corrected JSON with no explanation."
        )
        return await self.provider.generate(system_prompt, correction_prompt)

    async def _tool_calling(self, system_prompt: str, user_prompt: str) -> str:
        if not self.provider.supports_tool_calling:
            return await self._direct_schema(system_prompt, user_prompt)

        tool_schema = {
            "name": "generate_scene_spec",
            "description": (
                "Generate a structured SceneSpec JSON object for an educational video "
                "based on the lesson plan provided in the system prompt."
            ),
            "parameters": SceneSpec.model_json_schema(),
        }
        return await self.provider.generate_with_tools(system_prompt, user_prompt, tool_schema)

    async def _grammar_constrained(self, system_prompt: str, user_prompt: str) -> str:
        if self.provider.supports_json_mode:
            return await self.provider.generate_with_json_mode(system_prompt, user_prompt)

        # Fallback: instruct strictly, reject if non-JSON markers are present.
        output = await self.provider.generate(system_prompt, user_prompt)
        stripped = output.strip()
        if "```" in output or not stripped.startswith("{"):
            raise ValueError(
                "grammar_constrained: output contains non-JSON content "
                "(markdown fences or leading text). No repair is performed in this mode."
            )
        return output
