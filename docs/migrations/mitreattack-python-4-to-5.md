# Migration: mitreattack-python 4 → 5

Spike performed before the version edit, per Task 3.4 acceptance criteria.

## Sources consulted

- Upstream CHANGELOG:
  <https://raw.githubusercontent.com/mitre-attack/mitreattack-python/master/CHANGELOG.md>
- Release index:
  <https://github.com/mitre-attack/mitreattack-python/releases>
  (the `v5.0.0` tag carries no release body; the CHANGELOG is authoritative)

## Breaking changes 4.x → 5.0.0

The `v5.0.0` entry (1 August 2025) lists exactly one breaking-relevant change:

- **Minimum Python version raised to 3.11** for type hinting
  (GitHub Actions updated to Python 3.11 in the same release).

No `MitreAttackData` API changes, no removed functions, no renamed modules.
`v4.0.3` (same day) had already added type hints to the `MitreAttackData`
class; v5.0.0 made Python 3.11 the floor to use them.

## Compatibility check against this codebase

The project uses only `mitreattack.stix20.MitreAttackData` — constructor with
a STIX file path plus eight query methods, all stable public API present
since v2.x and unchanged in v5:

`get_groups`, `get_mitigations`, `get_software`, `get_tactics`,
`get_techniques`, `get_techniques_by_tactic`,
`get_techniques_mitigated_by_mitigation`, `get_techniques_used_by_group`

Call sites: `mitre_mcp/mitre_mcp_server.py` (`MitreAttackData` import at
module level; instances in `attack_lifespan`), `tests/conftest.py`,
`tests/integration/test_mcp_tools.py`.

Prerequisite already satisfied: the project Python floor was raised to 3.11
in the preceding task (#39), so the only 5.0.0 breaking change is a no-op
here.

## Changes applied

- `pyproject.toml`: `mitreattack-python>=4.0.2,<5.0.0` → `>=5,<6`
- `uv.lock`: re-locked (also picks up v5.x transitive additions such as
  `typing-extensions` and the poetry-era packaging metadata)

## Later 5.x features (informational, no action)

v5.1.0 switches upstream packaging to poetry and adds ATT&CK-versioned
downloads; v5.2.x adds ATT&CK spec 3.3.0 objects (detection strategies,
analytics, log sources); v5.3.0 updates to ATT&CK v18.1; v5.5.0 adds
ATT&CK v19; v5.7.0 adds the `attack_changelog` CLI. None of these touch the
`MitreAttackData` surface this project consumes.
