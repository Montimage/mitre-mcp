# MITRE MCP Playbook

Practical workflows for analysts, hunters, and engineers who pair `mitre-mcp` with MCP-aware clients to interrogate the MITRE ATT&CK knowledge base.

## Prerequisites

- Python 3.10–3.14 with `pip`.
- `mitre-mcp>=0.3.1` installed in a virtual environment.
- ATT&CK data cached locally (run `mitre-mcp --force-download` once if needed).
- An MCP client to interact with the server:
  - **Claude Desktop** ([Download](https://claude.ai/download)) for conversational access
  - **or any MCP Client** such as: VSCode Studio, Cursor, Windsurf, etc.


### Configuration

**Step 1:** Start the mitre-mcp server in HTTP mode (recommended):

```bash
mitre-mcp --http
```

**Step 2:** Add `mitre-mcp` to your MCP client configuration:

**Claude Desktop / VSCode** (`claude_desktop_config.json` or MCP settings):
```json
{
  "mcpServers": {
    "mitreattack": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

**Configuration file locations:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**Step 3:** Restart your MCP client to load the configuration

## Transport Modes

### HTTP Mode (Recommended)

The recommended mode for all MCP clients, offering better concurrency and easier debugging:

```bash
# Start HTTP server (default: localhost:8000)
mitre-mcp --http

# Custom host and port
mitre-mcp --http --host 0.0.0.0 --port 8080
```

**Benefits:**

- Better concurrency - multiple clients can connect simultaneously
- Easier debugging - inspect requests with standard HTTP tools
- CORS-enabled for cross-origin requests
- Streamable HTTP transport for async updates
- No path configuration needed - just a URL

**MCP Client Configuration:**

```json
{
  "mcpServers": {
    "mitreattack": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

**Environment variables:**
- `MITRE_HTTP_HOST` - Override default host
- `MITRE_HTTP_PORT` - Override default port (8000)
- `MITRE_ENABLE_CORS` - Enable/disable CORS (default: enabled)

### stdio Mode (Alternative)

For local-only clients that require stdio transport:

```bash
mitre-mcp
```

**MCP Client Configuration:**

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

**Note:** stdio mode is limited to single client connections and requires absolute path configuration.

## How to Use This Playbook

### Step 1: Install and Configure mitre-mcp

Choose your preferred MCP client and configure `mitre-mcp`:

#### Claude Desktop

**Best for:** Interactive analysis, threat intelligence, and ad-hoc queries.

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "mitreattack": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

Then start the server:
```bash
mitre-mcp --http
```

#### VSCode (with Cline/Roo-Cline/Continue)

**Best for:** Development workflows and embedded security analysis.

1. Install an MCP-compatible VSCode extension (Cline, Roo-Cline, or Continue)
2. Configure the extension with the mitre-mcp server URL
3. Start the server: `mitre-mcp --http`

#### Other MCP Clients

**mitre-mcp** works with any MCP-compatible client:
- **Cursor** - AI-powered code editor
- **Windsurf** - Collaborative development environment
- **Zed** - High-performance code editor
- Any other MCP-compatible tool

See [README.md](README.md) for detailed configuration instructions.

### Step 2: Use the Chatbox for Your Scenario

Once configured, simply open your MCP client's chatbox and ask natural language questions. The client will automatically invoke the appropriate mitre-mcp tools to answer your queries.

**Example interaction:**
```
You: What techniques does APT29 use? Highlight the most critical ones for defense.

AI: [Automatically calls get_techniques_used_by_group and presents the results]
```

**Available MCP Tools:**
The following tools are automatically available to your AI assistant:
- `get_tactics` - List all tactics
- `get_techniques` - List techniques with filtering
- `get_technique_by_id` - Get specific technique details
- `get_techniques_by_tactic` - Filter by tactic
- `get_groups` - List threat actor groups
- `get_techniques_used_by_group` - Map groups to techniques
- `get_software` - List malware and tools
- `get_mitigations` - List mitigations
- `get_techniques_mitigated_by_mitigation` - Map mitigations to techniques

You don't need to memorize these tools - just ask questions naturally, and your AI assistant will use the right tools automatically.

---

**For programmatic API integration (automation, custom scripts, batch processing):**
See [API-INTEGRATION.md](API-INTEGRATION.md) for complete guide with Python and Node.js examples.

---

## Scenario Catalog

The following scenarios provide ready-to-use prompts for common security workflows. Simply copy the prompts into your MCP client's chatbox and execute them step-by-step.

### 1. Threat Intelligence

**Goal:** Map real-world groups to techniques/tactics for reporting and briefings.
**Ideal for:** CTI analysts, executive updates, threat reports.

**Claude Desktop workflow:**

**Step 1:** Ask about a threat group's techniques
```
What techniques does APT29 use? Highlight the most critical ones for defense.
```

**Step 2:** Compare multiple threat actors
```
Compare APT29 and APT28 techniques - what overlaps exist?
```

**Step 3:** Get detailed technique information
```
Give me details on T1059.001 including detection guidance.
```

**Capture:** Actor-to-technique mappings, aliases, mitigation angles, defensive gaps.

### 2. Detection Engineering

**Goal:** Translate high-value techniques into detections and mitigations.
**Ideal for:** Detection engineers, SOC engineers, purple teams.

**Claude Desktop workflow:**

**Step 1:** Analyze a specific technique for detection
```
Analyze T1003 (Credential Dumping) - what log sources and detection logic should I implement?
```

**Step 2:** Find mitigations for a tactic
```
What mitigations address the most common persistence techniques?
```

**Step 3:** Explore mitigation coverage
```
Show me all techniques that 'Network Segmentation' mitigates.
```

**Capture:** Telemetry priorities, log sources, analytic logic, policy changes, mitigation backlog.

### 3. Threat Hunting

**Goal:** Build proactive hunt packages tied to ATT&CK hypotheses.
**Ideal for:** Threat hunters, DFIR engineers.

**Claude Desktop workflow:**

**Step 1:** Create a hunt plan for a tactic
```
Build a threat hunt plan for Initial Access techniques - include hypotheses and log sources.
```

**Step 2:** Prioritize techniques for an environment
```
What persistence techniques should I prioritize for a Windows environment?
```

**Step 3:** Generate hunting queries for threat actors
```
Generate hunting queries for lateral movement techniques used by APT groups.
```

**Capture:** Prioritized hunts, hypotheses, telemetry sources, pivot queries, detection gaps.

### 4. Red Teaming

**Goal:** Craft adversary emulation plans aligned to credible threat activity.
**Ideal for:** Red/purple teams, adversary simulation, emulation planning.

**Claude Desktop workflow:**

**Step 1:** Build an emulation plan for a threat group
```
Build a FIN7 emulation plan focused on lateral movement techniques.
```

**Step 2:** Identify tools and malware for emulation
```
What tools and malware should I use to emulate APT41 behavior?
```

**Step 3:** Create an attack chain for a tactic
```
Create a multi-stage attack chain using techniques from the Privilege Escalation tactic.
```

**Capture:** Phase ordering, emulation commands, validation checkpoints, tool selection.

### 5. Security Assessment

**Goal:** Evaluate defenses and mitigations against ATT&CK coverage.
**Ideal for:** Security architects, GRC teams, control mapping.

**Claude Desktop workflow:**

**Step 1:** Assess control coverage for a mitigation
```
Assess my control coverage - what techniques does 'Network Segmentation' mitigate?
```

**Step 2:** Generate a coverage heat map
```
Generate a coverage heat map showing which mitigations address the most critical techniques.
```

**Step 3:** Identify coverage gaps
```
What techniques are under-covered by standard enterprise mitigations?
```

**Capture:** Control coverage matrix, remediation backlog, policy gaps, compliance mappings.

### 6. Incident Response

**Goal:** Map observed behaviors to ATT&CK and document cases quickly.
**Ideal for:** DFIR responders, incident commanders, SOC analysts.

**Claude Desktop workflow:**

**Step 1:** Get detection details for observed technique
```
We observed scheduled task creation (T1053.005) - provide detection details and likely threat actors.
```

**Step 2:** Perform attribution with multiple techniques
```
What groups use these techniques: T1053.005, T1059.001, T1003? Help with attribution.
```

**Step 3:** Generate incident report
```
Generate an incident report template mapping these IOCs to ATT&CK techniques.
```

**Capture:** Narrative timeline, impacted stages, candidate threat actors, IOC mappings.

### 7. Security Operations

**Goal:** Align SOC monitoring and runbooks with ATT&CK coverage.
**Ideal for:** SOC leads, Tier 2 analysts, automation engineers.

**Claude Desktop workflow:**

**Step 1:** Prioritize techniques for alert tuning
```
What Defense Evasion techniques should I prioritize for alert tuning?
```

**Step 2:** Build runbook templates
```
Build a SOC runbook template for responding to Credential Access alerts.
```

**Step 3:** Map SIEM coverage to ATT&CK
```
Map my current SIEM use cases to ATT&CK tactics - identify gaps.
```

**Capture:** Alert priorities, log coverage, SOP improvements, runbook templates.

### 8. Security Training

**Goal:** Build educational content that mirrors adversary behaviors.
**Ideal for:** Enablement teams, security champions, trainers.

**Claude Desktop workflow:**

**Step 1:** Create hands-on lab content
```
Create a hands-on lab for teaching T1059.001 (PowerShell) - include learning objectives and exercises.
```

**Step 2:** Build tabletop exercise scenarios
```
Build a tabletop exercise scenario using Lazarus Group techniques.
```

**Step 3:** Generate quiz questions
```
Generate quiz questions covering Initial Access and Persistence tactics.
```

**Capture:** Lesson plans, quiz items, scenario prompts, lab exercises, assessment criteria.

### 9. Vendor Evaluation

**Goal:** Compare tooling claims against the ATT&CK landscape.
**Ideal for:** Procurement teams, platform owners, security architects.

**Claude Desktop workflow:**

**Step 1:** Validate vendor coverage claims
```
A vendor claims 80% coverage of Privilege Escalation techniques - build test scenarios to validate this.
```

**Step 2:** Compare detection capabilities
```
Compare vendor detection coverage against the top 20 most common enterprise techniques.
```

**Step 3:** Prioritize evaluation criteria
```
What techniques should I prioritize when evaluating EDR solutions?
```

**Capture:** Evaluation matrices, must-have detections, test scenarios, coverage benchmarks.

### 10. Risk Management

**Goal:** Prioritize investments against the most relevant techniques.
**Ideal for:** CISOs, risk committees, roadmap planners.

**Claude Desktop workflow:**

**Step 1:** Create a risk register
```
Create a risk register prioritizing the top 50 enterprise techniques by severity and prevalence.
```

**Step 2:** Identify mitigation investments
```
What mitigations should we invest in to address Discovery and Collection tactics?
```

**Step 3:** Build a security roadmap
```
Build a security roadmap addressing gaps in our coverage of APT-commonly-used techniques.
```

**Capture:** Prioritized threats, recommended mitigations, roadmap actions, investment themes.

## Operational Tips

### Best Practices for MCP Clients

- **Start simple**: Ask natural questions and let your AI assistant invoke the right tools automatically
- **Be specific**: Include technique IDs, group names, or tactic names when you know them
- **Iterate**: Build on previous responses to drill deeper into the data
- **Context matters**: Your AI can combine multiple tool calls to answer complex questions
- **Use the scenarios**: The Scenario Catalog provides proven prompts for common workflows

### Server Performance

- **HTTP mode**: Use `--http` for better concurrency and easier debugging
- **Debug logging**: Set `MITRE_LOG_LEVEL=DEBUG` for troubleshooting
- **Force refresh**: Run `mitre-mcp --force-download` before critical analyses to ensure latest data
- **Cache settings**: Data refreshes automatically based on `MITRE_CACHE_EXPIRY_DAYS` (default: 1 day)

### Integration Tips

- **Claude Desktop**: Best for interactive analysis and threat intelligence
- **VSCode/IDE**: Ideal for embedding ATT&CK context in code reviews and threat modeling
- **Programmatic API**: See [API-INTEGRATION.md](API-INTEGRATION.md) for automation and custom integrations

## Contributing

Have a repeatable workflow that uses the existing MCP tools in a clever way? Open an issue or submit a PR so others can benefit from your scenario design.
