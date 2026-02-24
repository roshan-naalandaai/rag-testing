import os


class Settings:
    """
    Application settings read from environment variables.
    All keys are sourced from .env (loaded by app.py via python-dotenv).
    """
    app_name: str = "Naalanda Backend"
    debug: bool = os.getenv("DEBUG", "").lower() in {"1", "true", "yes"}
    log_verbose: bool = os.getenv("LOG_VERBOSE", "").lower() in {"1", "true", "yes"}


settings = Settings()
