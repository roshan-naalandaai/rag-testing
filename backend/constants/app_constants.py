# ── HTTP / CORS ────────────────────────────────────────────────────────────────
CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]

# ── Generation defaults ────────────────────────────────────────────────────────
DEFAULT_PROVIDER = "openai"
DEFAULT_CHAPTER = "chapter2"
DEFAULT_ROADMAP_FILE = "u2.json"
RAG_TOP_K = 8

# ── LLM provider models ────────────────────────────────────────────────────────
CLAUDE_MODEL = "claude-sonnet-4-6"
CLAUDE_MAX_TOKENS = 8096
OPENAI_MODEL = "gpt-4o"
GEMINI_MODEL = "gemini-2.0-flash"

# ── Timing / animation ────────────────────────────────────────────────────────
ELEMENT_TIMING_BUFFER = 0.3   # seconds of slack required after the last element
MIN_ELEMENT_DURATION = 0.1    # floor when scaling element durations

# ── Output / compiler ─────────────────────────────────────────────────────────
COMPILER_TIMEOUT_SECONDS = 60

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_MAX_BYTES = 5_000_000
LOG_BACKUP_COUNT = 5
