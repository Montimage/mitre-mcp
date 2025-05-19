# Publishing to PyPI

This document explains how to publish the mitre-mcp package to PyPI.

## Prerequisites

1. Create an account on [PyPI](https://pypi.org/)
2. Install the required tools:
   ```bash
   pip install build twine
   ```

## Building the Package

1. Make sure your working directory is clean and contains only the files you want to include in the package
2. Build the package:
   ```bash
   python -m build
   ```
   This will create a `dist` directory with the source distribution and wheel.

## Testing the Package

Before uploading to PyPI, you can test the package on TestPyPI:

1. Register an account on [TestPyPI](https://test.pypi.org/)
2. Upload to TestPyPI:
   ```bash
   python -m twine upload --repository testpypi dist/*
   ```
3. Install from TestPyPI to test:
   ```bash
   pip install --index-url https://test.pypi.org/simple/ mitre-mcp
   ```

## Publishing to PyPI

When you're ready to publish to the real PyPI:

```bash
python -m twine upload dist/*
```

You'll be prompted for your PyPI username and password.

## Updating the Package

To update the package:

1. Update the version number in `mitre_mcp/__init__.py`
2. Rebuild the package:
   ```bash
   python -m build
   ```
3. Upload to PyPI:
   ```bash
   python -m twine upload dist/*
   ```

## Security Note

Never commit your PyPI API tokens or credentials to Git. Use environment variables or the `.pypirc` file in your home directory to store credentials securely.
