from __future__ import annotations

import time


class UserGraph:
    """
    Tracks per-concept mastery and interaction history for a single student.

    Mastery is stored as a raw float [0.0, 1.0].  Use get_effective_mastery()
    for all pedagogical decisions — it applies a confusion penalty on top of
    the raw value so that repeated failures dampen an otherwise high score.
    """

    # ------------------------------------------------------------------
    # Constants
    # ------------------------------------------------------------------

    CONFUSION_PENALTY_PER_COUNT: float = 0.1
    CORRECT_ANSWER_BOOST: float = 0.05
    DECAY_RATE_PER_SECOND: float = 1e-6   # ~0.086/day — conservative

    # ------------------------------------------------------------------
    # Construction
    # ------------------------------------------------------------------

    def __init__(self) -> None:
        # Seed with reasonable defaults for the accounting domain.
        self.mastery: dict[str, float] = {
            "entity_concept": 0.9,
            "accounting_equation": 0.7,
            "accrual": 0.2,
            "matching": 0.1,
        }
        self.last_updated: dict[str, float] = {}
        self.exposure_count: dict[str, int] = {}
        self.confusion_count: dict[str, int] = {}

    # ------------------------------------------------------------------
    # Core mastery accessors
    # ------------------------------------------------------------------

    def set_mastery(self, concept_id: str, level: float) -> None:
        """Directly set raw mastery (clamped to [0, 1])."""
        self.mastery[concept_id] = max(0.0, min(1.0, level))
        self.last_updated[concept_id] = time.time()

    def get_mastery(self, concept_id: str) -> float:
        """Return raw mastery without any penalty applied."""
        return self.mastery.get(concept_id, 0.0)

    def get_effective_mastery(self, concept_id: str) -> float:
        """
        Return mastery adjusted for confusion history (and optional time decay).

        effective = max(0.0, raw_mastery - 0.1 * confusion_count)
        """
        raw = self.get_mastery(concept_id)
        penalty = self.CONFUSION_PENALTY_PER_COUNT * self.confusion_count.get(concept_id, 0)
        return max(0.0, raw - penalty)

    # ------------------------------------------------------------------
    # Interaction recording
    # ------------------------------------------------------------------

    def record_exposure(self, concept_id: str) -> None:
        """Call when a concept is explained to the student."""
        self.exposure_count[concept_id] = self.exposure_count.get(concept_id, 0) + 1
        self.last_updated[concept_id] = time.time()

    def record_confusion(self, concept_id: str) -> None:
        """
        Call when the student fails a check question for this concept.
        Also applies a small mastery reduction.
        """
        self.confusion_count[concept_id] = self.confusion_count.get(concept_id, 0) + 1
        # Reduce raw mastery slightly so repeated failures compound correctly.
        current = self.mastery.get(concept_id, 0.0)
        self.mastery[concept_id] = max(0.0, current - self.CONFUSION_PENALTY_PER_COUNT)
        self.last_updated[concept_id] = time.time()

    def record_correct_answer(self, concept_id: str) -> None:
        """
        Call when the student answers a check question correctly.
        Applies a small mastery boost (capped at 1.0).
        """
        current = self.mastery.get(concept_id, 0.0)
        self.mastery[concept_id] = min(1.0, current + self.CORRECT_ANSWER_BOOST)
        self.last_updated[concept_id] = time.time()

    def to_dict(self) -> dict:
        """Return a serializable snapshot of user graph state."""
        concepts = set(self.mastery) | set(self.confusion_count) | set(self.exposure_count)
        effective = {cid: self.get_effective_mastery(cid) for cid in concepts}
        return {
            "mastery": dict(self.mastery),
            "effective_mastery": effective,
            "exposure_count": dict(self.exposure_count),
            "confusion_count": dict(self.confusion_count),
            "last_updated": dict(self.last_updated),
        }

    # ------------------------------------------------------------------
    # Optional: time-based decay
    # ------------------------------------------------------------------

    def apply_decay(self, concept_id: str) -> None:
        """
        Gently reduce raw mastery based on elapsed time since last update.
        Safe to call at any point; does nothing if the concept has never been
        seen or was updated very recently.
        """
        if concept_id not in self.last_updated:
            return
        elapsed = time.time() - self.last_updated[concept_id]
        decay = self.DECAY_RATE_PER_SECOND * elapsed
        current = self.mastery.get(concept_id, 0.0)
        self.mastery[concept_id] = max(0.0, current - decay)

    def apply_decay_all(self) -> None:
        """Apply time-based decay to every tracked concept."""
        for concept_id in list(self.mastery):
            self.apply_decay(concept_id)

    # ------------------------------------------------------------------
    # Filtering helpers
    # ------------------------------------------------------------------

    def filter_unknown(self, concept_list: list[str], threshold: float = 0.6) -> list[str]:
        """Return concepts whose *effective* mastery is below threshold."""
        return [c for c in concept_list if self.get_effective_mastery(c) < threshold]

    def mastery_snapshot(self, concept_ids: list[str]) -> dict[str, float]:
        """Return a dict of effective mastery values for the given concepts."""
        return {cid: self.get_effective_mastery(cid) for cid in concept_ids}
