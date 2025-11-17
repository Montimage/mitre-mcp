# MITRE MCP Playbook

Practical workflows for analysts, hunters, and engineers who pair `mitre-mcp` with MCP-aware clients to interrogate the MITRE ATT&CK knowledge base.

## Prerequisites

- Python 3.10–3.14 with `pip`.
- `mitre-mcp>=0.2.1` installed in a virtual environment.
- ATT&CK data cached locally (run `mitre-mcp --force-download` once if needed).
- The [`mcp` CLI](https://pypi.org/project/mcp/) available (installed automatically via `pip install "mitre-mcp[dev]"` or `pip install mcp[cli]`).
- A minimal MCP client config such as:
  ```json
  {
    "mcpServers": {
      "mitreattack": {
        "command": "/absolute/path/to/.venv/bin/python",
        "args": ["-m", "mitre_mcp.mitre_mcp_server"]
      }
    }
  }
  ```
  Save it to `~/.config/mcp/config.json` (or the equivalent path on your OS).

## Quality Assurance

This MCP server is built with rigorous quality standards:

- **114 comprehensive tests** (66% code coverage)
- **Pre-commit hooks** ensuring code quality before every commit
- **Automated CI/CD** with linting, type checking, and security scanning
- **Cross-platform support** tested on Ubuntu, macOS, and Windows
- **Performance optimized** with O(1) lookups using pre-built indices (80-95% faster)

## Transport Modes

### Standard Mode (stdio)

The default mode for local MCP clients like Claude Desktop:

```bash
mitre-mcp
```

### HTTP Mode

For web-based integrations and async notifications:

```bash
# Start HTTP server (default port 8000)
mitre-mcp --http

# Custom port and host
mitre-mcp --http --host 0.0.0.0 --port 8080
```

**Features:**

- CORS-enabled for cross-origin requests
- Streamable HTTP transport for async updates
- Environment variables: `MITRE_HTTP_HOST`, `MITRE_HTTP_PORT`, `MITRE_ENABLE_CORS`

**MCP Client Configuration (HTTP):**

```json
{
  "mcpServers": {
    "mitreattack": {
      "url": "http://0.0.0.0:8080/mcp"
    }
  }
}
```

## Command Pattern

1. **Start the server** (Terminal A) and leave it running:
   ```bash
   mitre-mcp               # optional: --http or --force-download
   ```
2. **Issue tool calls** from another terminal using the `mcp` CLI:
   ```bash
   mcp tools call mitreattack <tool_name> '<json payload>'
   ```
   Replace `<tool_name>` with values like `get_techniques_by_tactic`, and pass only the parameters accepted by that tool (see `mitre_mcp/mitre_mcp_server.py` or `mitre-attack://info`).
3. **Feed responses into your LLM** or automation pipeline. Because the server stays up, each call returns immediately without re-downloading data.

The CLI snippets below all follow this pattern (`mcp` commands assume the server is running and registered under the name `mitreattack`).

## Scenario Catalog

### 1. Threat Intelligence

**Goal:** Map real-world groups to techniques/tactics for reporting and briefings.
**Ideal for:** CTI analysts, exec updates.

**LLM prompt starter:** `Summarize the dominant ATT&CK techniques for APT29 using the mitre-mcp responses above and highlight defensive gaps.`
**CLI workflow**

```bash
# Enumerate all named groups (filter revoked items later)
mcp tools call mitreattack get_groups '{
  "domain": "enterprise-attack",
  "remove_revoked_deprecated": true
}'

# Pull the ATT&CK techniques attributed to APT29
mcp tools call mitreattack get_techniques_used_by_group '{
  "group_name": "APT29",
  "domain": "enterprise-attack"
}'

# Deep dive on a specific sub-technique for narrative context
mcp tools call mitreattack get_technique_by_id '{
  "technique_id": "T1059.001",
  "domain": "enterprise-attack"
}'
```

**Capture:** actor-to-technique mappings, aliases, mitigation angles.

### 2. Detection Engineering

**Goal:** Translate high-value techniques into detections and mitigations.
**Ideal for:** Detection engineers, SOC engineers, purple teams.

**LLM prompt starter:** `Use the mitre-mcp outputs to recommend log sources, analytic logic, and mitigations for T1003.`
**CLI workflow**

```bash
# Inspect technique metadata, platforms, and detection notes
mcp tools call mitreattack get_technique_by_id '{
  "technique_id": "T1003",
  "domain": "enterprise-attack"
}'

# List all published mitigations (triage which ones you already cover)
mcp tools call mitreattack get_mitigations '{
  "domain": "enterprise-attack",
  "remove_revoked_deprecated": true
}'

# Pivot from a mitigation name to see all covered techniques
mcp tools call mitreattack get_techniques_mitigated_by_mitigation '{
  "mitigation_name": "Account Use Policies",
  "domain": "enterprise-attack"
}'
```

**Capture:** telemetry priorities, policy changes, backlog candidates.

### 3. Threat Hunting

**Goal:** Build proactive hunt packages tied to ATT&CK hypotheses.
**Ideal for:** Threat hunters, DFIR engineers.

**LLM prompt starter:** `Generate hunting hypotheses, log sources, and pivot queries for the Initial Access techniques returned by mitre-mcp.`
**CLI workflow**

```bash
# Techniques associated with the Initial Access tactic
mcp tools call mitreattack get_techniques_by_tactic '{
  "tactic_shortname": "initial-access",
  "domain": "enterprise-attack"
}'

# Persistence techniques (excluding revoked items)
mcp tools call mitreattack get_techniques_by_tactic '{
  "tactic_shortname": "persistence",
  "domain": "enterprise-attack",
  "remove_revoked_deprecated": true
}'

# Pull a broader set of enterprise techniques with descriptions included
mcp tools call mitreattack get_techniques '{
  "domain": "enterprise-attack",
  "include_subtechniques": true,
  "include_descriptions": true,
  "limit": 50
}'
```

**Capture:** prioritized hunts, telemetry to collect, follow-up pivots.

### 4. Red Teaming

**Goal:** Craft adversary emulation plans aligned to credible threat activity.
**Ideal for:** Red/purple teams, adversary simulation vendors.

**LLM prompt starter:** `Use these mitre-mcp outputs to assemble a FIN7-themed exercise with lateral-movement focus.`
**CLI workflow**

```bash
# Profile an adversary's preferred techniques
mcp tools call mitreattack get_techniques_used_by_group '{
  "group_name": "FIN7",
  "domain": "enterprise-attack"
}'

# Focus on lateral movement stages for chaining exercises
mcp tools call mitreattack get_techniques_by_tactic '{
  "tactic_shortname": "lateral-movement",
  "domain": "enterprise-attack"
}'

# Inventory available tools (vs. malware) to emulate behavior
mcp tools call mitreattack get_software '{
  "domain": "enterprise-attack",
  "software_types": ["tool"]
}'
```

**Capture:** phase ordering, emulation commands, validation checkpoints.

### 5. Security Assessment

**Goal:** Evaluate defenses and mitigations against ATT&CK coverage.
**Ideal for:** Security architects, GRC teams.

**LLM prompt starter:** `Summarize which mitigations address the retrieved techniques and highlight uncovered areas.`
**CLI workflow**

```bash
# Export the mitigation catalog for enterprise domain
mcp tools call mitreattack get_mitigations '{
  "domain": "enterprise-attack"
}'

# Determine which techniques a key mitigation defends
mcp tools call mitreattack get_techniques_mitigated_by_mitigation '{
  "mitigation_name": "Network Segmentation",
  "domain": "enterprise-attack"
}'

# Pull descriptions for the first 30 techniques (great for control mapping)
mcp tools call mitreattack get_techniques '{
  "domain": "enterprise-attack",
  "include_descriptions": true,
  "limit": 30
}'
```

**Capture:** control coverage matrix, remediation backlog, policy gaps.

### 6. Incident Response

**Goal:** Map observed behaviors to ATT&CK and document cases quickly.
**Ideal for:** DFIR responders, incident commanders.

**LLM prompt starter:** `Combine the mitre-mcp responses to draft an incident summary, likely attribution, and next investigative steps.`
**CLI workflow**

```bash
# Lookup a specific sub-technique seen during triage
mcp tools call mitreattack get_technique_by_id '{
  "technique_id": "T1053.005",
  "domain": "enterprise-attack"
}'

# Identify groups known to employ the same TTPs for attribution hints
mcp tools call mitreattack get_techniques_used_by_group '{
  "group_name": "APT41",
  "domain": "enterprise-attack"
}'

# List malware families tied to the enterprise domain
mcp tools call mitreattack get_software '{
  "domain": "enterprise-attack",
  "software_types": ["malware"]
}'
```

**Capture:** narrative timeline, impacted stages, candidate threat actors.

### 7. Security Operations

**Goal:** Align SOC monitoring and runbooks with ATT&CK coverage.
**Ideal for:** SOC leads, Tier 2 analysts, automation engineers.

**LLM prompt starter:** `Use the mitre-mcp outputs to propose detection tuning and runbook updates for Defense Evasion.`
**CLI workflow**

```bash
# Quick view of tactics available in the enterprise matrix
mcp tools call mitreattack get_tactics '{
  "domain": "enterprise-attack"
}'

# Pull techniques for Defense Evasion to enrich alerting guidelines
mcp tools call mitreattack get_techniques_by_tactic '{
  "tactic_shortname": "defense-evasion",
  "domain": "enterprise-attack"
}'

# Paginate through the enterprise technique list to avoid large payloads
mcp tools call mitreattack get_techniques '{
  "domain": "enterprise-attack",
  "limit": 25,
  "offset": 25
}'
```

**Capture:** alert priorities, log coverage, SOP improvements.

### 8. Security Training

**Goal:** Build educational content that mirrors adversary behaviors.
**Ideal for:** Enablement teams, security champions.

**LLM prompt starter:** `Convert these mitre-mcp responses into a hands-on lab outline and quiz questions.`
**CLI workflow**

```bash
# Pick a technique/sub-technique to anchor a workshop
mcp tools call mitreattack get_technique_by_id '{
  "technique_id": "T1059.001",
  "domain": "enterprise-attack"
}'

# Show students which adversary groups leverage the same tactic
mcp tools call mitreattack get_techniques_used_by_group '{
  "group_name": "Lazarus Group",
  "domain": "enterprise-attack"
}'

# Surface tools participants should recognize during tabletop exercises
mcp tools call mitreattack get_software '{
  "domain": "enterprise-attack",
  "software_types": ["tool"]
}'
```

**Capture:** lesson plans, quiz items, scenario prompts.

### 9. Vendor Evaluation

**Goal:** Compare tooling claims against the ATT&CK landscape.
**Ideal for:** Procurement teams, platform owners.

**LLM prompt starter:** `Using the mitre-mcp datasets, outline validation scenarios to verify a vendor’s coverage claims for privilege escalation.`
**CLI workflow**

```bash
# Baseline the full set of enterprise techniques to understand scope
mcp tools call mitreattack get_techniques '{
  "domain": "enterprise-attack",
  "include_subtechniques": false,
  "limit": 100
}'

# Focus on a specific tactic that a vendor claims to cover
mcp tools call mitreattack get_techniques_by_tactic '{
  "tactic_shortname": "privilege-escalation",
  "domain": "enterprise-attack"
}'

# Examine relevant groups to build evaluation scenarios
mcp tools call mitreattack get_groups '{
  "domain": "enterprise-attack",
  "remove_revoked_deprecated": true
}'
```

**Capture:** evaluation matrices, must-have detections, scenario seeds.

### 10. Risk Management

**Goal:** Prioritize investments against the most relevant techniques.
**Ideal for:** CISOs, risk committees, roadmap planners.

**LLM prompt starter:** `Turn these mitre-mcp outputs into a risk register with top investments and owners.`
**CLI workflow**

```bash
# Pull the first 50 techniques (include descriptions for rich context)
mcp tools call mitreattack get_techniques '{
  "domain": "enterprise-attack",
  "include_descriptions": true,
  "limit": 50
}'

# Focus on Discovery tactics impacting asset inventories
mcp tools call mitreattack get_techniques_by_tactic '{
  "tactic_shortname": "discovery",
  "domain": "enterprise-attack"
}'

# Review mitigations to align with investment themes
mcp tools call mitreattack get_mitigations '{
  "domain": "enterprise-attack"
}'
```

**Capture:** prioritized threats, recommended mitigations, roadmap actions.

## Operational Tips

- Customize JSON payloads with your own limits, offsets, and domains to control token usage.
- `include_descriptions` dramatically increases the response size—enable it only when the downstream LLM needs narrative context.
- Cache warms automatically each day; set `MITRE_CACHE_EXPIRY_DAYS` if you need longer retention or call `mitre-mcp --force-download` to refresh before major reviews.
- Use `MITRE_LOG_LEVEL=DEBUG mitre-mcp` when troubleshooting to see transport- and cache-level logs.

## Contributing

Have a repeatable workflow that uses the existing MCP tools in a clever way? Open an issue or submit a PR so others can benefit from your scenario design.
