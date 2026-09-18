# Migration: pytest 7 → 9

Task 5.2. Spike performed before any version edit, per acceptance
criteria. Two majors, moved one at a time inside the task: 7→8 green,
then 8→9 green (one commit per major).

## Sources consulted

- Upstream CHANGELOG (docs.pytest.org):
  <https://docs.pytest.org/en/stable/changelog.html>
- Deprecations and removals:
  <https://docs.pytest.org/en/stable/deprecations.html>
- pytest 8.0.0 release section (2024-01-27, incl. 8.0.0rc1/rc2 notes):
  <https://docs.pytest.org/en/stable/changelog.html#pytest-8-0-0-2024-01-27>
- pytest 9.0.0 release section (2025-11-05):
  <https://docs.pytest.org/en/stable/changelog.html#pytest-9-0-0-2025-11-05>
- Plugin requirement metadata (PyPI `requires_dist`):
  <https://pypi.org/pypi/pytest-asyncio/json>,
  <https://pypi.org/pypi/pytest-cov/json>,
  <https://pypi.org/pypi/pytest-mock/json>

## Breaking changes 7.x → 8.0.0

Per the 8.0.0 changelog (breaking items shipped in 8.0.0rc1):

- `PytestRemovedIn8Warning` deprecations became errors by default
  (#7363); the affected features were removed in 8.1.
- Python 3.7 support dropped; `pluggy>=1.3.0` required (#11151) —
  no impact: project floor is Python >= 3.11.
- Collection tree rework (#7777, #8976, #11137, #11676):
  - Files and directories are now collected in alphabetical order
    jointly (previously files before directories).
  - `pytest pkg/__init__.py` now collects only that module, not the
    whole package.
  - `pytest.Package` is no longer a `pytest.Module`/`pytest.File`;
    new `pytest.Directory`/`pytest.Dir` collector nodes; a `Package`
    now only collects files in its own directory.
  - `Node`, `Collector`, `Item`, `File`, `FSCollector` are now
    abstract classes.
- `parser.addini` `default` handling sanitized (#11282): unset
  options now return type-specific defaults; `default=None` is
  honoured.
- `pytest.warns()` re-emits unmatched warnings when the context
  closes (#9288) — suites erroring on warnings may newly fail.
- `setup.py` removed upstream (#11667) — install via pip only.
- Internal `FixtureManager.getfixtureclosure` signature changed.
- New deprecations: test functions returning a non-`None` value emit
  `PytestWarning` (#10465); marks applied to fixture functions warn
  and become an error in pytest 9.0 (#3664).

## Breaking changes 8.x → 9.0.0

Per the 9.0.0 changelog:

- `PytestRemovedIn9Warning` deprecation warnings are now errors by
  default (#13779); the affected features are removed in 9.1.
- Python 3.9 support dropped (#13719) — no impact: floor is >= 3.11.
- Overlapping/duplicate path arguments are deduplicated
  (#12083): `pytest a/ a/b` now equals `pytest a`; `pytest x.py x.py`
  runs the file once. `--keep-duplicates` retains the old behavior.
- CI-mode detection now requires `$CI`/`$BUILD_NUMBER` to be
  non-empty, not merely defined (#13766).
- Non-public `config.args` may now only contain `str`, never
  `pathlib.Path`.
- Minimum requirements bumped: `iniconfig>=1.0.1`,
  `packaging>=22.0.0` (#13791).
- New deprecations: `monkeypatch.syspath_prepend()` warns on legacy
  (`pkg_resources.declare_namespace`) namespace packages (#13807).
- Notable 8.x-era deprecations that are errors/removals by 9.x:
  marks on fixture functions (#3664, error since 9.0); old-style
  pluggy `hookwrapper=True` wrappers emit `PytestRemovedIn9Warning`
  (now errors) — relevant for pinned plugins, see below.

## Repository impact audit

- `tests/` uses only public pytest APIs: `@pytest.fixture`,
  `@pytest.mark.asyncio`, `@pytest.mark.parametrize`,
  `pytest.raises`, `pytest.approx`, `tmp_path`, `monkeypatch`,
  `pytest-mock`'s `mocker`. No custom collectors, no hooks, no
  `config.args`, no `warns()` reliance, no fixture marks, no
  non-`None` test returns.
- `pyproject.toml` `[tool.pytest.ini_options]` remains supported in
  pytest 9 (native `[tool.pytest]` TOML is optional).
- `asyncio_mode = "auto"` remains valid under pytest-asyncio 1.x.

## Plugin compatibility sweep

Declared dev pins (`pyproject.toml` `[project.optional-dependencies].dev`):

| Plugin          | Pin             | PyPI `pytest` bound        | pytest 9 OK? |
|-----------------|-----------------|----------------------------|--------------|
| pytest-asyncio  | `>=0.21,<1.0.0` | 0.x all `pytest<9`         | **No**       |
| pytest-cov      | `>=4.1,<5.0.0`  | `pytest>=4.6`              | Yes (resolver) |
| pytest-mock     | `>=3.11,<4.0.0` | `pytest>=6.2.5`            | Yes          |

- **pytest-asyncio**: every 0.x release (incl. 0.26.0, the last 0.x)
  declares `pytest<9`. pytest-asyncio 1.3.0 is the first release
  allowing `pytest<10` (1.4.0 requires `pytest>=8.4,<10`). Resolution
  therefore fails at pytest 9 with the `<1.0.0` cap — a minimal compat
  pin adjustment to `pytest-asyncio>=1.3.0,<2.0.0` is forced inside
  this task. The full pytest-asyncio upgrade scope (its own spike doc
  and AC) remains owned by the follow-up issue (#55); this change only
  unblocks resolution. pytest-asyncio 1.x removes the deprecated
  `event_loop` fixture — the suite does not use it (tests call
  `asyncio.new_event_loop()` directly, which is unaffected).
- **pytest-cov**: no upper bound; 4.1.0 resolves and loads under
  pytest 9. The dedicated upgrade to a newer pytest-cov stays with
  the follow-up issue (#56).
- **pytest-mock**: no upper bound; unchanged.

## Changes applied

- `docs/migrations/pytest-7-to-9.md`: this spike (committed before
  any version edit).
- `pyproject.toml`: `pytest>=7.4.0,<8.0.0` → `>=8.0.0,<9.0.0`
  (commit 1, suite green) → `>=9.0.0,<10.0.0` (commit 2, suite green).
- `pyproject.toml` (commit 2 only): `pytest-asyncio` cap raised to
  `>=1.3.0,<2.0.0` — minimal forced compat adjustment (see above).
- `uv.lock`: re-locked per major; `uv lock --check` exits 0.
