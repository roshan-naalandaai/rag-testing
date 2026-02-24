import os
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from constants.app_constants import CORS_ORIGINS
from logging_config import setup_logging
from routes.generate import router as generate_router
from routes.outputs import router as outputs_router

load_dotenv()

_VERBOSE = os.getenv("LOG_VERBOSE", "").strip().lower() in {"1", "true", "yes", "on"}
setup_logging(verbose=_VERBOSE)
logger = logging.getLogger("backend")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate_router)
app.include_router(outputs_router)


@app.get("/")
async def root():
    return {"status": "ok"}
