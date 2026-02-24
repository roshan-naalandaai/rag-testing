"""
Logging setup.

- Global app logger  → logs/app.log  (rotating, all requests)
- Per-request logger → logs/requests/{req_id}.log  (one file per request)
"""

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

_LOGS_DIR = Path(__file__).parent / "logs"
_REQUESTS_DIR = _LOGS_DIR / "requests"

_FMT = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")
_VERBOSE_FMT = logging.Formatter(
    "%(asctime)s | %(levelname)s | %(name)s | %(funcName)s | %(message)s"
)


def setup_logging(verbose: bool = False) -> None:
    """Configure the root 'backend' logger with a rotating file + console handler."""
    logger = logging.getLogger("backend")
    if logger.handlers:
        return

    level = logging.DEBUG if verbose else logging.INFO
    fmt = _VERBOSE_FMT if verbose else _FMT
    logger.setLevel(level)

    _LOGS_DIR.mkdir(parents=True, exist_ok=True)

    fh = RotatingFileHandler(
        _LOGS_DIR / "app.log",
        maxBytes=5_000_000,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setLevel(level)
    fh.setFormatter(fmt)

    ch = logging.StreamHandler()
    ch.setLevel(level)
    ch.setFormatter(fmt)

    logger.addHandler(fh)
    logger.addHandler(ch)
    logger.propagate = False


def get_request_logger(req_id: str) -> logging.Logger:
    """
    Return a logger that writes exclusively to logs/requests/{req_id}.log.
    Each request gets its own isolated log file so you can inspect exactly
    what happened for a single call without sifting through app.log.
    """
    _REQUESTS_DIR.mkdir(parents=True, exist_ok=True)

    name = f"request.{req_id}"
    log = logging.getLogger(name)
    if log.handlers:
        return log

    log.setLevel(logging.DEBUG)
    log.propagate = False  # don't bubble up to 'backend' or root

    fh = logging.FileHandler(
        _REQUESTS_DIR / f"{req_id}.log", encoding="utf-8"
    )
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(
        logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")
    )
    log.addHandler(fh)
    return log
