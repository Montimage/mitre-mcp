# Migration: mitreattack-python 5 → 6

Second of the two majors (Task 3.5). Spike performed before the version
edit, per acceptance criteria.

## Sources consulted

- Upstream release notes `v6.0.0` (2026-05-07):
  <https://github.com/mitre-attack/mitreattack-python/releases/tag/v6.0.0>
- Upstream CHANGELOG:
  <https://raw.githubusercontent.com/mitre-attack/mitreattack-python/master/CHANGELOG.md>

## Breaking changes 5.x → 6.0.0

Per the v6.0.0 release notes, the breaking change is **CLI-only**:

- Console script `attackToExcel_cli` renamed to `attack-to-excel`
- Console script `attack_changelog` renamed to `attack-changelog`
- `attack-to-excel` now uses Typer subcommands `from-stix` and
  `from-release` instead of positional flags

Additionally, v6 requires Python ≥ 3.11 — already satisfied: the project
floor was raised in #39 and `requires-python` is `>=3.11`.

No `MitreAttackData` API changes.

## Console-script reference sweep

Searched for `attackToExcel_cli`, `attack_changelog`, `attackToExcel`,
`attack-to-excel`, `attack-changelog` (case-insensitive) in:

- `scripts/`
- `.github/workflows/`
- `README.md`
- `CONTRIBUTING.md`

**Result: 0 references found, 0 references updated.** The project consumes
`mitreattack.stix20.MitreAttackData` as a library only; it never invokes the
upstream console scripts. The only match in the repository is an
informational mention inside `docs/migrations/` itself.

## Compatibility check

Same eight `MitreAttackData` methods audited in
`docs/migrations/mitreattack-python-4-to-5.md` — unchanged in v6
(`get_groups`, `get_mitigations`, `get_software`, `get_tactics`,
`get_techniques`, `get_techniques_by_tactic`,
`get_techniques_mitigated_by_mitigation`, `get_techniques_used_by_group`).

## Changes applied

- `pyproject.toml`: `mitreattack-python>=5,<6` → `>=6,<7`
- `uv.lock`: re-locked; resolves to latest 6.x

## Later 6.x releases (informational, no action)

v6.0.1 adds an `--overwrite` flag fix for Excel generation; v6.1.0 adds
ATT&CK v19.1 data; v6.2.0 adds ATT&CK v19.2 data. None affect the library
surface this project consumes.
