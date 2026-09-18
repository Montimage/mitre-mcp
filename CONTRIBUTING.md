# Contributing to MITRE MCP Server

Thank you for your interest in contributing to the MITRE MCP Server! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Development Setup](#development-setup)
- [Agent-runnable environment](#agent-runnable-environment)
- [Code Quality Standards](#code-quality-standards)
- [Testing](#testing)
- [Pre-commit Hooks](#pre-commit-hooks)
- [CI/CD Pipeline](#cicd-pipeline)
- [Pull Request Process](#pull-request-process)
- [Security](#security)

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Montimage/mitre-mcp.git
cd mitre-mcp
```

### 2. Create a Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies

```bash
# Locked install from uv.lock (recommended — reproduces the committed resolution)
uv sync --locked --extra dev

# Or install package in editable mode with dev dependencies
pip install -e ".[dev]"

# Or install from requirements files
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

### 4. Install Pre-commit Hooks

```bash
pre-commit install
```

## Agent-runnable environment

This section consolidates everything an agent needs to install, configure, build, and test this repository from project files alone.

### Python environment

Create a Python >= 3.11 virtual environment at `.venv`:

```bash
uv venv --python 3.11 .venv
```

Activate it before every Python command:

```bash
source .venv/bin/activate
```

Install the package with dev dependencies from the committed lockfile (`uv.lock`) — this creates `.venv` without re-resolving:

```bash
uv sync --locked --extra dev
```

The editable fallback `pip install -e ".[dev]"` re-resolves open ranges; prefer the locked command for reproducibility.

### Frontend

The `frontend/` app requires Node 24:

```bash
cd frontend
npm ci
npm run build
npm run lint
```

### Environment variables

`mitre_mcp/config.py` reads twelve `MITRE_*` variables:

| Variable                  | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `MITRE_ENTERPRISE_URL`    | Enterprise ATT&CK STIX bundle download URL         |
| `MITRE_MOBILE_URL`        | Mobile ATT&CK STIX bundle download URL             |
| `MITRE_ICS_URL`           | ICS ATT&CK STIX bundle download URL                |
| `MITRE_DOWNLOAD_TIMEOUT`  | Download timeout in seconds                        |
| `MITRE_CACHE_EXPIRY_DAYS` | Days before the data cache is considered stale     |
| `MITRE_REQUIRED_SPACE_MB` | Free disk space required before downloading data   |
| `MITRE_DEFAULT_PAGE_SIZE` | Default page size for tool results                 |
| `MITRE_MAX_PAGE_SIZE`     | Maximum page size for tool results                 |
| `MITRE_MAX_DESC_LENGTH`   | Maximum description length returned by tools       |
| `MITRE_DATA_DIR`          | Data directory override (unset means auto-detect)  |
| `MITRE_LOG_LEVEL`         | Logging level                                      |
| `MITRE_CORS_ORIGINS`      | Comma-separated allowed CORS origins for HTTP mode (defaults to localhost dev origins; add a hosted UI origin explicitly; credentials never allowed) |

`mitre_mcp/mitre_mcp_server.py` additionally reads `FASTMCP_SERVER_HOST` (HTTP bind host) and `FASTMCP_SERVER_PORT` (HTTP port).

The frontend reads the `VITE_*` names listed in `frontend/.env.example` — names only; never copy values from `.env` or the `.mcpregistry_*token` files:

| Variable                  | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `VITE_MCP_DEFAULT_HOST`   | Default MCP server host shown in the settings dialog |
| `VITE_MCP_DEFAULT_PORT`   | Default MCP server port shown in the settings dialog |

LLM API keys (Gemini, OpenRouter, OpenAI) are entered at runtime via the
settings dialog and stored in browser IndexedDB — there is no build-time
`VITE_*_API_KEY` path.

### Commands of record

- Build check: `python -c "import mitre_mcp.mitre_mcp_server"`
- Test suite: `pytest -q -p no:cacheprovider -o addopts=""`

These commands may still be RED — restoring green is P0 work.

### Repository etiquette

- You must never commit or push without being asked.
- Never add a `Co-Authored-By: Claude` line to a commit.

## Code Quality Standards

This project maintains high code quality standards through automated checks:

### Code Formatting

- **Black**: Code formatter with 100-character line length

  ```bash
  black mitre_mcp/ tests/
  ```

- **isort**: Import statement organizer
  ```bash
  isort mitre_mcp/ tests/
  ```

### Linting

- **flake8**: Style guide enforcement
  ```bash
  flake8 mitre_mcp/ tests/
  ```

### Type Checking

- **mypy**: Static type checking
  ```bash
  mypy mitre_mcp/
  ```

### Security Scanning

- **bandit**: Security issue detection

  ```bash
  bandit -r mitre_mcp/ -c pyproject.toml
  ```

- **safety**: Dependency vulnerability checking
  ```bash
  safety check
  ```

### Code Complexity

- **radon**: Cyclomatic complexity and maintainability analysis
  ```bash
  radon cc mitre_mcp/ -a -nb
  radon mi mitre_mcp/ -nb
  ```

## Testing

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=mitre_mcp --cov-report=html

# Run specific test file
pytest tests/test_validators.py

# Run with verbose output
pytest -v
```

### Test Requirements

- Minimum 80% code coverage required
- All tests must pass before merging
- Add tests for new features and bug fixes
- Use pytest fixtures for common test data

### Test Structure

```
tests/
├── conftest.py           # Shared fixtures
├── test_validators.py    # Input validation tests
├── test_config.py        # Configuration tests
├── test_tools.py         # MCP tool tests
├── test_download.py      # Download/caching tests
└── test_formatting.py    # Formatting function tests
```

## Pre-commit Hooks

Pre-commit hooks automatically run code quality checks before each commit.

### Setup

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install
```

### Running Hooks Manually

```bash
# Run on all files
pre-commit run --all-files

# Run specific hook
pre-commit run black --all-files
```

### Hooks Included

1. **Code Formatting**: Black, isort
2. **Linting**: flake8 with plugins
3. **Type Checking**: mypy
4. **Security**: bandit
5. **General Checks**: trailing whitespace, YAML/JSON validation, etc.
6. **Python Upgrades**: pyupgrade for Python 3.11+ syntax
7. **Docstrings**: pydocstyle (Google style)

### Bypassing Hooks

Only in exceptional cases:

```bash
git commit --no-verify
```

## CI/CD Pipeline

### GitHub Actions Workflows

The project uses three main workflows:

#### 1. Tests (`test.yml`)

**Triggers**: Push to main/develop/claude/\*, pull requests

**Matrix Testing**:

- Python versions: 3.11, 3.12, 3.13, 3.14
- Operating systems: Ubuntu, macOS, Windows

**Steps**:

1. Set up Python environment
2. Install dependencies
3. Run pytest with coverage
4. Upload coverage to Codecov (Ubuntu + Python 3.12 only)

**Local Equivalent**:

```bash
pytest --cov=mitre_mcp --cov-report=xml
```

#### 2. Lint (`lint.yml`)

**Triggers**: Push to main/develop/claude/\*, pull requests

**Checks**:

1. Black formatting
2. isort import sorting
3. flake8 linting
4. mypy type checking
5. pydocstyle docstring style
6. Radon code complexity

**Local Equivalent**:

```bash
black --check mitre_mcp/ tests/
isort --check-only mitre_mcp/ tests/
flake8 mitre_mcp/ tests/
mypy mitre_mcp/
pydocstyle mitre_mcp/
radon cc mitre_mcp/ -a -nb
```

#### 3. Security (`security.yml`)

**Triggers**:

- Push to main/develop/claude/\*
- Pull requests
- Daily at 2 AM UTC
- Manual workflow dispatch

**Scans**:

1. **Bandit**: Python security linter
2. **Safety**: Dependency vulnerability checker
3. **CodeQL**: GitHub's code analysis
4. **Dependency Review**: PR dependency changes

**Local Equivalent**:

```bash
bandit -r mitre_mcp/ -c pyproject.toml
safety check
```

#### 4. PyPI Publish (`pypi-publish.yml`)

**Trigger**: GitHub release published

The package is published to PyPI with **OIDC Trusted Publishing** — no
long-lived API token is stored as a repository secret. The job runs in the
`release` environment and requests `id-token: write`, which lets
`pypa/gh-action-pypi-publish` mint a short-lived token per run.

One-time platform setup (repository owner, not version-controlled):

1. On PyPI → project `mitre-mcp` → **Publishing** → add a trusted publisher:
   owner `Montimage`, repository `mitre-mcp`, workflow
   `pypi-publish.yml`, environment `release`.
2. After the first successful trusted publish, delete the legacy
   `PYPI_API_TOKEN` repository secret (`gh secret delete PYPI_API_TOKEN`).

### Status Badges

Add these to your fork's README:

```markdown
![Tests](https://github.com/Montimage/mitre-mcp/workflows/Tests/badge.svg)
![Lint](https://github.com/Montimage/mitre-mcp/workflows/Lint/badge.svg)
![Security](https://github.com/Montimage/mitre-mcp/workflows/Security/badge.svg)
[![codecov](https://codecov.io/gh/Montimage/mitre-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/Montimage/mitre-mcp)
```

## Pull Request Process

### Before Submitting

1. **Run all quality checks**:

   ```bash
   # Run pre-commit hooks
   pre-commit run --all-files

   # Run tests
   pytest --cov=mitre_mcp
   ```

2. **Ensure tests pass**:
   - All existing tests pass
   - New tests added for new features
   - Code coverage ≥ 80%

3. **Update documentation**:
   - Update README.md if needed
   - Add docstrings to new functions/classes
   - Update CHANGELOG.md

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] Pre-commit hooks pass
- [ ] Added tests for new features
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] No security vulnerabilities introduced
- [ ] Type hints added for new code

### PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

Describe testing performed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] No new warnings
```

### Review Process

1. Automated checks must pass
2. At least one maintainer approval required
3. No unresolved conversations
4. Branch must be up to date with base

## Security

### Reporting Vulnerabilities

Please report security vulnerabilities to the project maintainers privately. Do not open public issues for security concerns.

### Security Best Practices

1. **Input Validation**: All user inputs validated
2. **Dependencies**: Regularly updated and scanned
3. **Secrets**: Never commit secrets/credentials
4. **HTTPS**: All external requests use HTTPS with verification
5. **Timeouts**: All network requests have timeouts

### Security Scanning in CI/CD

- **Bandit**: Scans for common security issues
- **Safety**: Checks for vulnerable dependencies
- **CodeQL**: Advanced semantic code analysis
- **Dependency Review**: Reviews PR dependency changes

## Code Style Guide

### Python Version

- Minimum: Python 3.11
- Target: Python 3.11-3.14

### Naming Conventions

- **Functions/Variables**: `snake_case`
- **Classes**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Private**: Prefix with `_`

### Docstrings

Use Google-style docstrings:

```python
def function_name(param1: str, param2: int) -> bool:
    """Brief description.

    Longer description if needed.

    Args:
        param1: Description of param1.
        param2: Description of param2.

    Returns:
        Description of return value.

    Raises:
        ValueError: When invalid input provided.
    """
    pass
```

### Type Hints

Always use type hints:

```python
from typing import Dict, List, Optional, Any

def process_data(
    data: Dict[str, Any],
    limit: Optional[int] = None
) -> List[str]:
    """Process data with type hints."""
    pass
```

### Imports

Organize imports:

```python
# Standard library
import os
import sys
from datetime import datetime

# Third-party
import httpx
from mcp import FastMCP

# Local
from mitre_mcp.config import Config
from mitre_mcp.validators import validate_technique_id
```

## Development Workflow

### Feature Development

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "Add feature description"

# Run tests and quality checks
pre-commit run --all-files
pytest --cov=mitre_mcp

# Push and create PR
git push origin feature/your-feature-name
```

### Bug Fixes

```bash
# Create bugfix branch
git checkout -b fix/bug-description

# Fix bug and add test
# Commit changes
git commit -m "Fix: bug description"

# Push and create PR
git push origin fix/bug-description
```

## Questions?

If you have questions about contributing, please:

1. Check existing documentation
2. Search closed issues and PRs
3. Open a discussion on GitHub
4. Contact maintainers

Thank you for contributing to MITRE MCP Server!
