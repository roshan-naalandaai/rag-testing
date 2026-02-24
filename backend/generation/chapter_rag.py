from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path


CHAPTER_DATA_DIR = Path(__file__).parent.parent / "data"


@dataclass
class RetrievedTopic:
    id: int
    name: str
    level: int
    description: str
    path: list[str]
    score: float


class ChapterRAG:
    """
    Lightweight deterministic retriever over chapter roadmap JSON.
    """

    def __init__(self, chapter: str = "chapter2", roadmap_file: str = "u2.json") -> None:
        self.chapter = chapter
        self.roadmap_path = CHAPTER_DATA_DIR / chapter / roadmap_file
        self.pdf_dir = CHAPTER_DATA_DIR / chapter
        self._payload = self._load_payload()
        self._nodes = self._flatten_topics(self._payload.get("topics", []))

    def retrieve(self, query: str, top_k: int = 8) -> list[RetrievedTopic]:
        q_tokens = _tokens(query)
        if not q_tokens:
            return []

        rows: list[RetrievedTopic] = []
        for node in self._nodes:
            name_tokens = _tokens(node["name"])
            desc_tokens = _tokens(node.get("description", ""))
            path_tokens = _tokens(" ".join(node.get("path", [])))

            name_overlap = len(q_tokens & name_tokens)
            desc_overlap = len(q_tokens & desc_tokens)
            path_overlap = len(q_tokens & path_tokens)

            if name_overlap == 0 and desc_overlap == 0 and path_overlap == 0:
                continue

            level = int(node.get("level", 0))
            # Encourage granular nodes (level 1/2) for teaching scripts.
            level_weight = 1.1 if level == 1 else 1.2 if level >= 2 else 0.9
            score = (name_overlap * 2.0 + desc_overlap * 1.0 + path_overlap * 0.7) * level_weight

            rows.append(
                RetrievedTopic(
                    id=int(node["id"]),
                    name=node["name"],
                    level=level,
                    description=node.get("description", ""),
                    path=node.get("path", []),
                    score=round(score, 3),
                )
            )

        rows.sort(key=lambda x: x.score, reverse=True)
        dedup: list[RetrievedTopic] = []
        seen: set[int] = set()
        for row in rows:
            if row.id in seen:
                continue
            seen.add(row.id)
            dedup.append(row)
            if len(dedup) >= top_k:
                break
        return dedup

    def chapter_pdfs(self) -> list[str]:
        pdfs = sorted(self.pdf_dir.glob("*.pdf"))
        return [str(p.name) for p in pdfs]

    def infer_unit_pdf(self, query: str) -> str | None:
        m = re.search(r"(?:unit|u)\s*([1-9][0-9]?)", query.lower())
        if not m:
            return None
        n = int(m.group(1))
        if n <= 0:
            return None
        suffix = f"u{n}.pdf"
        for pdf_name in self.chapter_pdfs():
            if pdf_name.lower().endswith(suffix):
                return pdf_name
        return None

    def _load_payload(self) -> dict:
        if not self.roadmap_path.exists():
            raise FileNotFoundError(f"Roadmap not found: {self.roadmap_path}")
        return json.loads(self.roadmap_path.read_text(encoding="utf-8"))

    def _flatten_topics(self, topics: list[dict]) -> list[dict]:
        rows: list[dict] = []

        def walk(node: dict, path: list[str]) -> None:
            current_path = [*path, node.get("name", "")]
            rows.append(
                {
                    "id": node.get("id"),
                    "name": node.get("name", ""),
                    "level": node.get("level", 0),
                    "description": node.get("description", ""),
                    "path": current_path,
                }
            )
            for child in node.get("children", []):
                walk(child, current_path)

        for topic in topics:
            walk(topic, [])
        return rows


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))

