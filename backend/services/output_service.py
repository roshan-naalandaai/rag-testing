"""
Handles saving LLM outputs (uncompiled) and running them through the
TypeScript layout compiler to produce pixel-coordinate outputs (compiled).
"""

import asyncio
import json
import re
import shutil
import subprocess
import logging
from datetime import datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).parent.parent
OUTPUTS_DIR = BACKEND_DIR / "outputs"
UNCOMPILED_DIR = OUTPUTS_DIR / "uncompiled"
COMPILED_DIR = OUTPUTS_DIR / "compiled"

# Path to the TypeScript compiler entry point
COMPILER_SCRIPT = BACKEND_DIR.parent / "compiler" / "compile-demo.ts"
COMPILER_DIR = COMPILER_SCRIPT.parent
logger = logging.getLogger("backend")


def _ensure_dirs() -> None:
    UNCOMPILED_DIR.mkdir(parents=True, exist_ok=True)
    COMPILED_DIR.mkdir(parents=True, exist_ok=True)


def _make_id(topic: str) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    slug = re.sub(r"[^a-z0-9]+", "_", topic.lower().strip()).strip("_")[:40]
    return f"{ts}_{slug}"


def save_uncompiled(raw_json: str, topic: str) -> tuple[str, Path]:
    """Persist the raw LLM JSON to outputs/uncompiled/ and return (id, path)."""
    _ensure_dirs()
    output_id = _make_id(topic)
    path = UNCOMPILED_DIR / f"{output_id}.json"
    path.write_text(raw_json, encoding="utf-8")
    logger.info("output_service:save_uncompiled id=%s path=%s", output_id, path)
    return output_id, path


def _run_compiler_sync(input_path: Path, output_path: Path) -> tuple[bool, str]:
    npx = shutil.which("npx") or "npx"
    try:
        proc = subprocess.run(
            [npx, "tsx", str(COMPILER_SCRIPT), str(input_path), str(output_path)],
            cwd=str(COMPILER_DIR),
            capture_output=True,
            text=True,
            timeout=60,
        )
        if proc.returncode != 0:
            return False, (proc.stderr or proc.stdout).strip()
        return True, ""
    except subprocess.TimeoutExpired:
        return False, "Compiler timed out after 60 seconds"
    except Exception as exc:
        return False, str(exc)


async def compile_output(output_id: str, input_path: Path) -> tuple[dict | None, str]:
    """
    Run the TS compiler on input_path, save to outputs/compiled/, and return
    (compiled_dict, error_message). compiled_dict is None on failure.
    """
    _ensure_dirs()
    compiled_path = COMPILED_DIR / f"{output_id}_compiled.json"

    loop = asyncio.get_event_loop()
    success, error = await loop.run_in_executor(
        None, _run_compiler_sync, input_path, compiled_path
    )

    if not success:
        logger.warning("output_service:compile_failed id=%s error=%s", output_id, error)
        return None, error

    try:
        compiled = json.loads(compiled_path.read_text(encoding="utf-8"))
        logger.info("output_service:compile_ok id=%s path=%s", output_id, compiled_path)
        return compiled, ""
    except Exception as exc:
        logger.error("output_service:compiled_unreadable id=%s error=%s", output_id, exc)
        return None, f"Compiled file unreadable: {exc}"


def list_outputs() -> list[dict]:
    """Return metadata for all saved outputs, newest first."""
    _ensure_dirs()
    results = []
    for unc_file in sorted(UNCOMPILED_DIR.glob("*.json"), reverse=True):
        output_id = unc_file.stem
        compiled_file = COMPILED_DIR / f"{output_id}_compiled.json"

        # Parse timestamp and topic from the ID (YYYYMMDD_HHMMSS_topic_slug)
        parts = output_id.split("_", 2)
        try:
            ts = datetime.strptime(f"{parts[0]}_{parts[1]}", "%Y%m%d_%H%M%S")
            created_at = ts.isoformat()
        except (ValueError, IndexError):
            created_at = None

        topic_slug = parts[2].replace("_", " ") if len(parts) > 2 else output_id

        results.append(
            {
                "id": output_id,
                "topic": topic_slug,
                "created_at": created_at,
                "has_compiled": compiled_file.exists(),
            }
        )
    return results


def get_uncompiled(output_id: str) -> dict | None:
    path = UNCOMPILED_DIR / f"{output_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def get_compiled(output_id: str) -> dict | None:
    path = COMPILED_DIR / f"{output_id}_compiled.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))
