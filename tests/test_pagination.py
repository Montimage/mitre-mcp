"""Unit tests for the shared paging contract (issues #83, #84) and the
precomputed per-domain lists (issue #85).

These run on mocks only — the response-size budgets against the real
dataset live in ``tests/perf/test_response_budget.py`` (``fulldata``).
"""

from unittest.mock import MagicMock

import pytest
from mcp.server.mcpserver.exceptions import ToolError
from mitreattack.stix20 import MitreAttackData

from mitre_mcp.config import Config
from mitre_mcp.data import AttackContext, DomainLists
from mitre_mcp.mitre_mcp_server import (
    get_groups,
    get_mitigations,
    get_software,
    get_tactics,
    get_techniques,
    get_techniques_by_tactic,
    get_techniques_mitigated_by_mitigation,
    get_techniques_used_by_group,
)
from mitre_mcp.validators import ValidationError, validate_limit

PAGINATION_KEYS = {"total", "offset", "limit", "has_more"}


def _ctx_with_lists(domain_lists, attack=None):
    """Context whose lifespan carries a real AttackContext + domain_lists."""
    attack = attack if attack is not None else MagicMock(spec=MitreAttackData)
    ctx = MagicMock()
    ctx.request_context = MagicMock()
    ctx.request_context.lifespan_context = AttackContext(
        enterprise_attack=attack,
        mobile_attack=attack,
        ics_attack=attack,
        domain_indices={},
        domain_lists=domain_lists,
    )
    return ctx, attack


def _sample_lists():
    """Small precomputed snapshot standing in for a loaded domain."""
    techniques = tuple(
        {
            "id": f"attack-pattern--{i:04d}",
            "type": "attack-pattern",
            "name": f"Technique {i}",
            "external_references": [{"source_name": "mitre-attack", "external_id": f"T{i:04d}"}],
        }
        for i in range(30)
    )
    return DomainLists(
        techniques=techniques,
        tactics=(
            {
                "id": "x-mitre-tactic--1",
                "name": "Persistence",
                "x_mitre_shortname": "persistence",
                "description": "persist",
            },
        ),
        groups=(
            {
                "id": "intrusion-set--1",
                "name": "APT Demo",
                "description": "demo group",
                "aliases": ["DEMO"],
            },
        ),
        software=(
            {
                "id": "malware--1",
                "name": "DemoWare",
                "type": "malware",
                "description": "demo malware",
            },
            {
                "id": "tool--1",
                "name": "DemoTool",
                "type": "tool",
                "description": "demo tool",
            },
        ),
        mitigations=(
            {
                "id": "course-of-action--1",
                "name": "Demo Mitigation",
                "description": "demo mitigation",
            },
        ),
    )


class TestListToolPagination:
    """The four list tools share the get_techniques paging contract."""

    def test_pagination_block_present(self, mock_context):
        for call in (get_tactics, get_groups, get_software, get_mitigations):
            result = call(mock_context)
            assert "pagination" in result, call.__name__
            assert set(result["pagination"]) == PAGINATION_KEYS

    def test_default_limit_applied(self, mock_context):
        result = get_groups(mock_context)
        assert result["pagination"]["limit"] == Config.DEFAULT_PAGE_SIZE
        assert result["pagination"]["offset"] == 0
        assert result["pagination"]["has_more"] is False

    def test_offset_beyond_total_returns_empty_page(self, mock_context):
        result = get_groups(mock_context, offset=999)
        assert result["groups"] == []
        assert result["pagination"]["total"] == 1
        assert result["pagination"]["has_more"] is False

    def test_limit_and_offset_slice(self, mock_context):
        # mock_context has exactly one group; a zero-page limit of 1 still
        # returns it, while offset=1 pages past the end.
        assert len(get_groups(mock_context, limit=1)["groups"]) == 1
        assert get_groups(mock_context, limit=1, offset=1)["groups"] == []

    def test_invalid_limit(self, mock_context):
        with pytest.raises(ToolError, match="must be positive"):
            get_tactics(mock_context, limit=0)

    def test_limit_over_cap(self, mock_context):
        with pytest.raises(ToolError, match="Limit too large"):
            get_tactics(mock_context, limit=Config.MAX_PAGE_SIZE + 1)

    def test_invalid_offset(self, mock_context):
        with pytest.raises(ToolError, match="must be non-negative"):
            get_mitigations(mock_context, offset=-1)


class TestRelationshipToolPagination:
    """The three relationship tools share the same paging contract."""

    def test_pagination_block_present(self, mock_context):
        result = get_techniques_by_tactic(mock_context, tactic_shortname="defense-evasion")
        assert "pagination" in result
        assert set(result["pagination"]) == PAGINATION_KEYS

        result = get_techniques_used_by_group(mock_context, group_name="APT28")
        assert "pagination" in result
        assert result["pagination"]["total"] == 1  # one mapped technique in the mock

        result = get_techniques_mitigated_by_mitigation(
            mock_context, mitigation_name="Application Isolation and Sandboxing"
        )
        assert "pagination" in result
        assert result["pagination"]["total"] == 1

    def test_limit_slice(self, mock_context):
        result = get_techniques_used_by_group(mock_context, group_name="APT28", limit=1, offset=1)
        assert result["techniques"] == []
        assert result["pagination"]["total"] == 1
        assert result["group"]["name"] == "APT28"

    def test_invalid_limit(self, mock_context):
        with pytest.raises(ToolError, match="must be positive"):
            get_techniques_by_tactic(mock_context, tactic_shortname="defense-evasion", limit=0)

    def test_invalid_offset(self, mock_context):
        with pytest.raises(ToolError, match="must be non-negative"):
            get_techniques_used_by_group(mock_context, group_name="APT28", offset=-2)


class TestPrecomputedLists:
    """Issue #85: paged default-argument calls slice the precomputed lists."""

    def test_paged_calls_do_not_invoke_store_queries(self):
        ctx, attack = _ctx_with_lists({"enterprise-attack": _sample_lists()})

        result = get_techniques(ctx, domain="enterprise-attack", limit=5, offset=0)
        attack.get_techniques.assert_not_called()
        assert len(result["techniques"]) == 5
        assert result["pagination"]["total"] == 30
        assert result["pagination"]["has_more"] is True
        assert result["techniques"][0]["name"] == "Technique 0"

        result = get_tactics(ctx)
        attack.get_tactics.assert_not_called()
        assert result["tactics"][0]["name"] == "Persistence"

        result = get_groups(ctx)
        attack.get_groups.assert_not_called()
        assert result["groups"][0]["name"] == "APT Demo"

        result = get_software(ctx)
        attack.get_software.assert_not_called()
        assert len(result["software"]) == 2

        result = get_mitigations(ctx)
        attack.get_mitigations.assert_not_called()
        assert result["mitigations"][0]["name"] == "Demo Mitigation"

    def test_offset_pages_the_snapshot(self):
        ctx, attack = _ctx_with_lists({"enterprise-attack": _sample_lists()})
        result = get_techniques(ctx, limit=10, offset=25)
        attack.get_techniques.assert_not_called()
        assert len(result["techniques"]) == 5
        assert result["pagination"]["has_more"] is False

    def test_non_default_args_fall_back_to_store(self):
        ctx, attack = _ctx_with_lists({"enterprise-attack": _sample_lists()})

        get_techniques(ctx, include_subtechniques=False)
        attack.get_techniques.assert_called_once_with(
            include_subtechniques=False, remove_revoked_deprecated=False
        )

        attack.reset_mock()
        get_techniques(ctx, remove_revoked_deprecated=True)
        attack.get_techniques.assert_called_once_with(
            include_subtechniques=True, remove_revoked_deprecated=True
        )

        get_tactics(ctx, remove_revoked_deprecated=True)
        attack.get_tactics.assert_called_once_with(remove_revoked_deprecated=True)

        get_groups(ctx, remove_revoked_deprecated=True)
        attack.get_groups.assert_called_once_with(remove_revoked_deprecated=True)

        get_software(ctx, remove_revoked_deprecated=True)
        attack.get_software.assert_called_once_with(remove_revoked_deprecated=True)

        get_mitigations(ctx, remove_revoked_deprecated=True)
        attack.get_mitigations.assert_called_once_with(remove_revoked_deprecated=True)

    def test_software_types_filter_applies_to_snapshot(self):
        ctx, attack = _ctx_with_lists({"enterprise-attack": _sample_lists()})
        result = get_software(ctx, software_types=["malware"])
        attack.get_software.assert_not_called()
        assert result["pagination"]["total"] == 1
        assert result["software"][0]["type"] == "malware"

    def test_missing_domain_lists_falls_back(self, mock_context):
        """Contexts without domain_lists keep the old store-query path."""
        result = get_groups(mock_context)
        assert len(result["groups"]) == 1  # served by the mock store

    def test_other_domains_have_own_snapshots(self):
        attack = MagicMock(spec=MitreAttackData)
        ctx, _ = _ctx_with_lists({"mobile-attack": _sample_lists()}, attack=attack)

        get_techniques(ctx, domain="mobile-attack", limit=3)
        attack.get_techniques.assert_not_called()

        # enterprise has no snapshot -> store query
        get_techniques(ctx, domain="enterprise-attack")
        attack.get_techniques.assert_called()


class TestPageSizeCap:
    """Issue #85: the default page-size cap is 200 and is enforced."""

    def test_default_max_page_size_is_200(self):
        assert Config.MAX_PAGE_SIZE == 200

    def test_cap_enforced_by_validate_limit(self):
        with pytest.raises(ValidationError, match="Limit too large"):
            validate_limit(Config.MAX_PAGE_SIZE + 1, Config.MAX_PAGE_SIZE)

    def test_descriptions_truncated_in_list_tools(self, mock_context):
        long_desc = "x" * (Config.MAX_DESCRIPTION_LENGTH + 100)
        group = dict(
            mock_context.request_context.lifespan_context.domain_indices[
                "enterprise-attack"
            ].groups["apt28"]
        )
        group["description"] = long_desc
        mock_context.request_context.lifespan_context.domain_indices["enterprise-attack"].groups[
            "apt28"
        ] = group
        mock_context.request_context.lifespan_context.enterprise_attack.get_groups.return_value = [
            group
        ]
        result = get_groups(mock_context)
        assert len(result["groups"][0]["description"]) == Config.MAX_DESCRIPTION_LENGTH
        assert result["groups"][0]["description"].endswith("...")
