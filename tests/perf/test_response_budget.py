"""Response-budget tests against the full enterprise dataset.

Covers the paging/response-budget findings:

- F-PERF-002 (issue #83): the four list tools return bounded pages instead
  of every object with a full description — the largest default-argument
  response measured 371,135 B before paging (~93k tokens).
- F-PERF-006 (issue #84): the three relationship tools page too; their
  measured worst cases (215 items / 31,687 B; 120 items / ~17.7 KB) now
  fit the same budget.
- F-PERF-005 (issue #85): the page size is capped so a maximum-size
  ``get_techniques`` page stays within 135,000 B (662 B/item at cap 200).

Every test carries the ``fulldata`` marker: they are collected everywhere
but skip unless a full ``enterprise-attack.json`` bundle is on disk —
``tests/data/`` (populated by ``scripts/download_attack_data.py``) or the
package data dir — so CI without the dataset stays green.
"""

import json
import os
from unittest.mock import MagicMock

import pytest
from mitreattack.stix20 import MitreAttackData

from mitre_mcp.mitre_mcp_server import (
    AttackContext,
    Config,
    build_domain_lists,
    build_group_index,
    build_mitigation_index,
    build_technique_index,
    get_groups,
    get_mitigations,
    get_software,
    get_tactics,
    get_technique_by_id,
    get_techniques,
    get_techniques_by_tactic,
    get_techniques_mitigated_by_mitigation,
    get_techniques_used_by_group,
)

pytestmark = pytest.mark.fulldata

# Budget bounds, bound to the report's measurements.
DEFAULT_ARGUMENT_BUDGET = 25_000
MEASURED_CEILING = 371_135  # pre-paging get_software worst case
MAX_PAGE_BUDGET = 135_000  # ~662 B/item at the 200-item page cap

_TESTS_DATA = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "tests",
    "data",
    "enterprise-attack.json",
)
_CANDIDATE_BUNDLES = (
    _TESTS_DATA,
    os.path.join(Config.get_data_dir(), "enterprise-attack.json"),
)


def _full_bundle_path() -> str | None:
    for path in _CANDIDATE_BUNDLES:
        if os.path.exists(path):
            return path
    return None


@pytest.fixture(scope="module")
def enterprise_ctx():
    """Real AttackContext over the full enterprise bundle, or skip."""
    path = _full_bundle_path()
    if path is None:
        pytest.skip(
            "full enterprise dataset absent — run scripts/download_attack_data.py "
            "(or let the server populate its data dir) to enable fulldata tests"
        )
    data = MitreAttackData(path)
    domain_lists = build_domain_lists(data)
    ctx = MagicMock()
    ctx.request_context = MagicMock()
    ctx.request_context.lifespan_context = AttackContext(
        enterprise_attack=data,
        mobile_attack=data,
        ics_attack=data,
        groups_index=build_group_index(data),
        mitigations_index=build_mitigation_index(data),
        techniques_by_mitre_id=build_technique_index(data),
        domain_lists={
            "enterprise-attack": domain_lists,
            "mobile-attack": domain_lists,
            "ics-attack": domain_lists,
        },
    )
    return ctx


def _size(result) -> int:
    return len(json.dumps(result))


def test_all_tools_within_default_argument_budget(enterprise_ctx):
    """Every tool called with default arguments fits the 25,000 B budget
    and stays far below the measured 371,135 B ceiling (F-PERF-002)."""
    calls = {
        "get_techniques": lambda: get_techniques(enterprise_ctx),
        "get_tactics": lambda: get_tactics(enterprise_ctx),
        "get_groups": lambda: get_groups(enterprise_ctx),
        "get_software": lambda: get_software(enterprise_ctx),
        "get_mitigations": lambda: get_mitigations(enterprise_ctx),
        "get_technique_by_id": lambda: get_technique_by_id(enterprise_ctx, technique_id="T1055"),
        "get_techniques_by_tactic": lambda: get_techniques_by_tactic(
            enterprise_ctx, tactic_shortname="defense-evasion"
        ),
        "get_techniques_used_by_group": lambda: get_techniques_used_by_group(
            enterprise_ctx, group_name="APT29"
        ),
        "get_techniques_mitigated_by_mitigation": lambda: (
            get_techniques_mitigated_by_mitigation(
                enterprise_ctx, mitigation_name="User Account Management"
            )
        ),
    }
    assert len(calls) == 9
    for name, call in calls.items():
        size = _size(call())
        assert size <= MEASURED_CEILING, f"{name}: {size} B over the measured ceiling"
        assert (
            size <= DEFAULT_ARGUMENT_BUDGET
        ), f"{name}: {size} B over the {DEFAULT_ARGUMENT_BUDGET} B budget"


def test_relationship_tools_worst_cases_within_budget(enterprise_ctx):
    """The three relationship tools at their measured worst-case inputs
    fit the 25,000 B budget (F-PERF-006).

    The worst-case input is measured on the dataset under test — entity
    names differ between ATT&CK releases — rather than hardcoded.
    """
    lifespan = enterprise_ctx.request_context.lifespan_context
    data = lifespan.enterprise_attack
    lists = lifespan.domain_lists["enterprise-attack"]

    worst_tactic = max(
        lists.tactics,
        key=lambda t: len(
            list(
                data.get_techniques_by_tactic(
                    t.get("x_mitre_shortname", ""),
                    domain="enterprise-attack",
                    remove_revoked_deprecated=False,
                )
            )
        ),
    )["x_mitre_shortname"]
    worst_group = max(
        lists.groups,
        key=lambda g: len(data.get_techniques_used_by_group(g["id"])),
    )["name"]
    worst_mitigation = max(
        lists.mitigations,
        key=lambda m: len(data.get_techniques_mitigated_by_mitigation(m["id"])),
    )["name"]

    worst_cases = {
        "get_techniques_by_tactic": lambda: get_techniques_by_tactic(
            enterprise_ctx, tactic_shortname=worst_tactic
        ),
        "get_techniques_used_by_group": lambda: get_techniques_used_by_group(
            enterprise_ctx, group_name=worst_group
        ),
        "get_techniques_mitigated_by_mitigation": lambda: (
            get_techniques_mitigated_by_mitigation(enterprise_ctx, mitigation_name=worst_mitigation)
        ),
    }
    for name, call in worst_cases.items():
        result = call()
        size = _size(result)
        assert (
            size <= DEFAULT_ARGUMENT_BUDGET
        ), f"{name}: {size} B over the {DEFAULT_ARGUMENT_BUDGET} B budget"
        # The scan found a genuinely heavy mapping, not an empty page.
        assert result["pagination"]["total"] > 0, name


def test_get_techniques_max_page_within_budget(enterprise_ctx):
    """A get_techniques page at the maximum permitted size stays within
    135,000 B and never exceeds the 553,020 B ceiling (F-PERF-005)."""
    assert Config.MAX_PAGE_SIZE <= 200
    result = get_techniques(enterprise_ctx, limit=Config.MAX_PAGE_SIZE)
    assert result["pagination"]["limit"] == Config.MAX_PAGE_SIZE
    size = _size(result)
    assert size <= 553_020, f"{size} B over the measured ceiling"
    assert size <= MAX_PAGE_BUDGET, f"{size} B over the {MAX_PAGE_BUDGET} B max-page budget"
