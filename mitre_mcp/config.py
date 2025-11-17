"""Configuration for MITRE MCP Server."""

import os


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
    DOWNLOAD_TIMEOUT_SECONDS = int(os.getenv("MITRE_DOWNLOAD_TIMEOUT", "30"))
    CACHE_EXPIRY_DAYS = int(os.getenv("MITRE_CACHE_EXPIRY_DAYS", "1"))
    REQUIRED_DISK_SPACE_MB = int(os.getenv("MITRE_REQUIRED_SPACE_MB", "200"))

    # Pagination
    DEFAULT_PAGE_SIZE = int(os.getenv("MITRE_DEFAULT_PAGE_SIZE", "20"))
    MAX_PAGE_SIZE = int(os.getenv("MITRE_MAX_PAGE_SIZE", "1000"))

    # Formatting
    MAX_DESCRIPTION_LENGTH = int(os.getenv("MITRE_MAX_DESC_LENGTH", "500"))

    # Data directory
    DATA_DIR = os.getenv("MITRE_DATA_DIR", None)  # None = auto

    # Logging
    LOG_LEVEL = os.getenv("MITRE_LOG_LEVEL", "INFO")

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
        """Validate configuration."""
        if cls.DOWNLOAD_TIMEOUT_SECONDS < 1:
            raise ValueError("DOWNLOAD_TIMEOUT_SECONDS must be positive")

        if cls.CACHE_EXPIRY_DAYS < 0:
            raise ValueError("CACHE_EXPIRY_DAYS must be non-negative")

        if cls.DEFAULT_PAGE_SIZE < 1 or cls.DEFAULT_PAGE_SIZE > cls.MAX_PAGE_SIZE:
            raise ValueError(f"DEFAULT_PAGE_SIZE must be between 1 and {cls.MAX_PAGE_SIZE}")


# Validate on import
Config.validate()
