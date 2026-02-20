from pydantic import BaseSettings

class Settings(BaseSettings):
    """Configuration settings for the application."""
    # TODO: Add configuration variables
    app_name: str = "FastAPI Backend"
    debug: bool = False

    class Config:
        env_file = ".env"

settings = Settings()