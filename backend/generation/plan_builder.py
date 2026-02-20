"""
plan_builder.py
~~~~~~~~~~~~~~~
Builds all programmatic context objects consumed by the generator before
an LLM call is made.  No LLM logic lives here.

Pipeline (called once per /generate request):
  1. resolve_learning_path  — ordered concept list from KG + UserGraph
  2. build_teaching_bundle  — structured context object sent to LLM
  3. build_teaching_plan    — internal planning object (NOT sent to user)
  4. calibrate_confidence   — numeric confidence score, capped by weak prereqs
  5. build_structured_plan  — assembles everything into the final plan dict
"""

from __future__ import annotations

import logging
# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_CONCEPT_NODES: int = 5          # Hard cap on concepts sent to LLM
MASTERY_THRESHOLD: float = 0.6      # Below this → concept is "weak"
EXAMPLE_MASTERY_CUTOFF: float = 0.4 # Below this → include 2 examples
WEAK_PREREQ_CONFIDENCE_CAP: float = 0.5

logger = logging.getLogger("backend")

# ---------------------------------------------------------------------------
# 1 & 2 — Teaching bundle
# ---------------------------------------------------------------------------

def build_teaching_bundle(target_concept: str, kg, user_graph) -> dict:
    """
    Build a structured context object for the target concept.

    {
        "target": { concept metadata, trimmed examples },
        "weak_prerequisites":   [ ... ],   # effective mastery < 0.6
        "strong_prerequisites": [ ... ],   # effective mastery >= 0.6
        "examples": [ one or two examples depending on mastery ],
        "student_mastery_snapshot": { concept_id: effective_mastery, ... }
    }

    Retrieval control rules:
    - Include only description, ONE example per concept, and depends_on.
    - If target effective mastery < 0.4, include up to 2 examples.
    - Hard cap: at most MAX_CONCEPT_NODES concept nodes total (including target).
    """
    all_prereqs = kg.get_all_prerequisites(target_concept)  # foundational → advanced
    target_mastery = user_graph.get_effective_mastery(target_concept)

    weak_prereqs: list[dict] = []
    strong_prereqs: list[dict] = []

    for cid in all_prereqs:
        m = user_graph.get_effective_mastery(cid)
        node = _trim_concept(kg.get_concept_metadata(cid), m)
        if m < MASTERY_THRESHOLD:
            weak_prereqs.append(node)
        else:
            strong_prereqs.append(node)

    # Build target node
    target_meta = kg.get_concept_metadata(target_concept)
    example_count = 2 if target_mastery < EXAMPLE_MASTERY_CUTOFF else 1
    target_node = {
        "id": target_meta["id"],
        "title": target_meta["title"],
        "description": target_meta["description"],
        "examples": target_meta["examples"][:example_count],
        "depends_on": target_meta["depends_on"],
    }

    # Collect mastery snapshot for all referenced concepts
    all_concept_ids = (
        [cid for cid in all_prereqs]
        + [target_concept]
    )
    snapshot = user_graph.mastery_snapshot(all_concept_ids)

    # --- Retrieval cap: total nodes including target must not exceed MAX ---
    # Prioritise weak prerequisites (student needs them most).
    budget = MAX_CONCEPT_NODES - 1  # reserve 1 slot for target
    weak_prereqs = weak_prereqs[:budget]
    remaining = budget - len(weak_prereqs)
    strong_prereqs = strong_prereqs[:remaining]

    return {
        "target": target_node,
        "weak_prerequisites": weak_prereqs,
        "strong_prerequisites": strong_prereqs,
        "examples": target_node["examples"],
        "student_mastery_snapshot": snapshot,
    }


# ---------------------------------------------------------------------------
# 3 — Internal teaching plan  (NOT returned to user / LLM verbatim)
# ---------------------------------------------------------------------------

def build_teaching_plan(target_concept: str, bundle: dict, user_graph) -> dict:
    """
    Produce an internal planning object that guides prompt construction.

    {
        "review_concepts":      [ concept_ids to briefly recap ],
        "focus_concept":        concept_id to teach in depth,
        "skip_reinforcement":   [ concept_ids already well-known ],
        "explanation_depth":    "low" | "medium" | "high"
    }

    Depth rules (based on target effective mastery):
        < 0.3  → "high"
        0.3–0.7 → "medium"
        > 0.7  → "low"
    """
    target_mastery = user_graph.get_effective_mastery(target_concept)

    if target_mastery < 0.3:
        depth = "high"
    elif target_mastery <= 0.7:
        depth = "medium"
    else:
        depth = "low"

    review_concepts = [node["id"] for node in bundle["weak_prerequisites"]]
    skip_reinforcement = [node["id"] for node in bundle["strong_prerequisites"]]

    return {
        "review_concepts": review_concepts,
        "focus_concept": target_concept,
        "skip_reinforcement": skip_reinforcement,
        "explanation_depth": depth,
    }


# ---------------------------------------------------------------------------
# 4 — Confidence calibration
# ---------------------------------------------------------------------------

def calibrate_confidence(target_concept: str, bundle: dict, user_graph) -> float:
    """
    Compute a confidence score [0.0, 1.0] for how well-prepared the student
    is to learn target_concept right now.

    Factors:
    - Average mastery coverage of all prerequisites
    - Dependency completeness  (ratio of strong / total prereqs)
    - Number of supporting concept nodes available

    Cap: if any weak prerequisite exists, confidence cannot exceed
    WEAK_PREREQ_CONFIDENCE_CAP (0.5).
    """
    snapshot: dict[str, float] = bundle["student_mastery_snapshot"]
    all_prereq_ids = (
        [n["id"] for n in bundle["weak_prerequisites"]]
        + [n["id"] for n in bundle["strong_prerequisites"]]
    )

    if not all_prereq_ids:
        # Root concept — always confident
        return 1.0

    # Average mastery coverage
    avg_mastery = sum(snapshot.get(cid, 0.0) for cid in all_prereq_ids) / len(all_prereq_ids)

    # Dependency completeness
    n_total = len(all_prereq_ids)
    n_strong = len(bundle["strong_prerequisites"])
    completeness = n_strong / n_total if n_total > 0 else 1.0

    # Supporting nodes factor (more nodes = higher confidence, saturates at 5)
    node_factor = min(1.0, (n_total + 1) / MAX_CONCEPT_NODES)

    raw_confidence = (avg_mastery * 0.5) + (completeness * 0.35) + (node_factor * 0.15)

    # Cap when weak prerequisites exist
    if bundle["weak_prerequisites"]:
        raw_confidence = min(raw_confidence, WEAK_PREREQ_CONFIDENCE_CAP)

    return round(max(0.0, min(1.0, raw_confidence)), 3)


# ---------------------------------------------------------------------------
# 5 — Main entry point
# ---------------------------------------------------------------------------

def build_structured_plan(topic: str, kg, user_graph) -> dict:
    """
    Full pipeline:
      1. Resolve ordered concept sequence for the topic.
      2. For each unknown concept build a bundle + teaching plan.
      3. Assemble final plan dict consumed by generator._build_system_prompt.

    Returns:
    {
        "topic": str,
        "concept_sequence": [
            {
                "id", "title", "description", "examples",
                "_teaching_plan": { ... },   # internal, stripped before LLM
                "_confidence": float,         # internal, stripped before LLM
            },
            ...
        ]
    }
    """
    concept_ids = kg.get_topic_concepts(topic)
    unknown_ids = user_graph.filter_unknown(concept_ids)

    # Sort foundational → advanced using graph depth ordering
    ordered_ids = kg.sort_by_depth(unknown_ids)
    logger.info(
        "plan_builder:topic=%s concepts=%s unknown=%s ordered=%s",
        topic, len(concept_ids), len(unknown_ids), len(ordered_ids),
    )
    logger.debug("plan_builder:concept_ids=%s", concept_ids)
    logger.debug("plan_builder:unknown_ids=%s", unknown_ids)
    logger.debug("plan_builder:ordered_ids=%s", ordered_ids)

    concept_sequence = []
    for concept_id in ordered_ids:
        bundle = build_teaching_bundle(concept_id, kg, user_graph)
        teaching_plan = build_teaching_plan(concept_id, bundle, user_graph)
        confidence = calibrate_confidence(concept_id, bundle, user_graph)

        target = bundle["target"]
        concept_sequence.append({
            "id": target["id"],
            "title": target["title"],
            "description": target["description"],
            "examples": target["examples"],
            # Internal fields — used by prompt builder, not forwarded to LLM
            "_teaching_plan": teaching_plan,
            "_confidence": confidence,
            "_weak_prerequisites": bundle["weak_prerequisites"],
        })

    return {
        "topic": topic,
        "concept_sequence": concept_sequence,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _trim_concept(meta: dict, effective_mastery: float) -> dict:
    """Return a concept node with only the fields needed for LLM context."""
    example_count = 2 if effective_mastery < EXAMPLE_MASTERY_CUTOFF else 1
    return {
        "id": meta["id"],
        "title": meta["title"],
        "description": meta["description"],
        "examples": meta["examples"][:example_count],
        "depends_on": meta["depends_on"],
    }
