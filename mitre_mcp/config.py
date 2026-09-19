"""Configuration for MITRE MCP Server."""

import logging
import os


def _env_int(name: str, default: int) -> int:
    """Read an integer environment variable.

    A malformed value exits with a one-line error naming the variable
    instead of a raw traceback (F-BUG-030).
    """
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        raise SystemExit(f"error: {name} must be an integer, got {raw!r}") from None


def _env_log_level(name: str, default: str) -> str:
    """Read a logging-level environment variable.

    The value is validated against the standard logging level names; an
    unknown name exits with a one-line error naming the variable instead of
    a raw ``AttributeError`` traceback (F-BUG-030).
    """
    raw = os.getenv(name, default)
    if raw.upper() not in logging.getLevelNamesMapping():
        valid = ", ".join(sorted(logging.getLevelNamesMapping()))
        raise SystemExit(f"error: {name} must be a logging level ({valid}), got {raw!r}")
    return raw


class Config:
    """Configuration management for MITRE MCP Server."""

    # Data source URLs
    ENTERPRISE_ATTACK_URL = os.getenv(
        "MITRE_ENTERPRISE_URL",
        "https://raw.githubusercontent.com/mitre/cti/master/"
        "enterprise-attack/enterprise-attack.json",
    )

    MOBILE_ATTACK_URL = os.getenv(
        "MITRE_MOBILE_URL",
        "https://raw.githubusercontent.com/mitre/cti/master/mobile-attack/mobile-attack.json",
    )

    ICS_ATTACK_URL = os.getenv(
        "MITRE_ICS_URL",
        "https://raw.githubusercontent.com/mitre/cti/master/ics-attack/ics-attack.json",
    )

    # Timeouts and limits
    DOWNLOAD_TIMEOUT_SECONDS = _env_int("MITRE_DOWNLOAD_TIMEOUT", 30)
    CACHE_EXPIRY_DAYS = _env_int("MITRE_CACHE_EXPIRY_DAYS", 1)
    REQUIRED_DISK_SPACE_MB = _env_int("MITRE_REQUIRED_SPACE_MB", 200)

    # Pagination
    DEFAULT_PAGE_SIZE = _env_int("MITRE_DEFAULT_PAGE_SIZE", 20)
    MAX_PAGE_SIZE = _env_int("MITRE_MAX_PAGE_SIZE", 1000)

    # Formatting
    MAX_DESCRIPTION_LENGTH = _env_int("MITRE_MAX_DESC_LENGTH", 500)

    # Data directory
    DATA_DIR = os.getenv("MITRE_DATA_DIR", None)  # None = auto

    # Logging
    LOG_LEVEL = _env_log_level("MITRE_LOG_LEVEL", "INFO")

    # CORS configuration (HTTP mode only)
    # Comma-separated origins; defaults to localhost development origins.
    # To allow a hosted UI, set MITRE_CORS_ORIGINS explicitly, e.g.
    # "https://mitre-mcp.netlify.app,http://localhost:5173"
    CORS_ORIGINS = os.getenv(
        "MITRE_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
    )

    @classmethod
    def get_data_urls(cls) -> dict[str, str]:
        """Get all data source URLs."""
        return {
            "enterprise": cls.ENTERPRISE_ATTACK_URL,
            "mobile": cls.MOBILE_ATTACK_URL,
            "ics": cls.ICS_ATTACK_URL,
        }

    @classmethod
    def get_data_dir(cls) -> str:
        """Get data directory path."""
        if cls.DATA_DIR:
            return cls.DATA_DIR

        # Default: relative to package
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

    @classmethod
    def validate(cls) -> None:
        """Validate configuration.

        Failures exit with a one-line error naming the environment
        variable instead of a raw traceback (F-BUG-030).
        """
        if cls.DOWNLOAD_TIMEOUT_SECONDS < 1:
            raise SystemExit("error: MITRE_DOWNLOAD_TIMEOUT must be a positive integer")

        if cls.CACHE_EXPIRY_DAYS < 0:
            raise SystemExit("error: MITRE_CACHE_EXPIRY_DAYS must be a non-negative integer")

        if cls.DEFAULT_PAGE_SIZE < 1 or cls.DEFAULT_PAGE_SIZE > cls.MAX_PAGE_SIZE:
            raise SystemExit(
                "error: MITRE_DEFAULT_PAGE_SIZE must be between 1 and "
                f"MITRE_MAX_PAGE_SIZE ({cls.MAX_PAGE_SIZE})"
            )


# Validate on import
Config.validate()
