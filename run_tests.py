#!/usr/bin/env python3
"""
Test runner for mitre-mcp tests.
"""
import argparse
import sys
import unittest
from pathlib import Path


def run_tests(test_path=None, pattern="test_*.py"):
    """Run tests with the specified test path and pattern.

    Args:
        test_path: Path to the test directory or file
        pattern: Test file pattern to match
    """
    # Default to the tests directory if no path is provided
    if test_path is None:
        test_path = str(Path(__file__).parent / "tests")

    # Discover and run tests
    loader = unittest.TestLoader()
    suite = loader.discover(test_path, pattern=pattern)

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Return non-zero exit code if tests failed
    sys.exit(not result.wasSuccessful())


def main():
    """Main entry point for the test runner."""
    parser = argparse.ArgumentParser(description="Run mitre-mcp tests")
    parser.add_argument("test_path", nargs="?", help="Path to test file or directory")
    parser.add_argument(
        "-p",
        "--pattern",
        default="test_*.py",
        help="Test file pattern to match (default: test_*.py)",
    )

    args = parser.parse_args()
    run_tests(args.test_path, args.pattern)


if __name__ == "__main__":
    main()
