# MITRE MCP Server Tests

This directory contains the test suite for the MITRE MCP Server.

## Test Structure

- `unit/`: Unit tests for individual components
  - `test_mitre_mcp_server.py`: Tests for core server functionality
  - `test_*`: Other unit test files

- `integration/`: Integration tests that verify the interaction between components
  - `test_mcp_tools.py`: Tests for MCP tools with real MITRE ATT&CK data

- `fixtures/`: Test data and fixtures

## Running Tests

### Prerequisites

- Python 3.8+
- Dependencies installed with test extras:
  ```bash
  pip install -e ".[test]"
  ```

### Running All Tests

```bash
# Using pytest directly
pytest

# Using the test runner script
python run_tests.py
```

### Running Specific Tests

```bash
# Run a specific test file
pytest tests/unit/test_mitre_mcp_server.py

# Run a specific test class
pytest tests/unit/test_mitre_mcp_server.py::TestMitreMcpServer

# Run a specific test method
pytest tests/unit/test_mitre_mcp_server.py::TestMitreMcpServer::test_health_check

# Run tests with coverage report
pytest --cov=mitre_mcp
```

### Test Coverage

To generate a coverage report:

```bash
pytest --cov=mitre_mcp --cov-report=html
open htmlcov/index.html  # View the coverage report
```

## Writing Tests

1. **Unit Tests**: Test individual functions and classes in isolation using mocks.
2. **Integration Tests**: Test the interaction between components with real data.
3. **Fixtures**: Use pytest fixtures for common test data and setup.

Follow these conventions:

- Test files should be named `test_*.py`
- Test classes should be named `Test*`
- Test methods should be named `test_*`
- Use descriptive test names that explain what is being tested

## Continuous Integration

The test suite is automatically run on pull requests and commits to the main branch. Ensure all tests pass before merging code changes.

## Debugging Tests

To debug a failing test:

```bash
# Run pytest with the --pdb flag to drop into the debugger on failure
pytest --pdb tests/unit/test_mitre_mcp_server.py::TestMitreMcpServer::test_failing_test

# Use logging for more detailed output
pytest -s -v  # Disable output capturing
```
