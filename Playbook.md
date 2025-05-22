# MITRE MCP Playbook

This playbook provides practical examples of how to use mitre-mcp for various security use cases based on the MITRE ATT&CK framework.

## 1. Threat Intelligence
**Objective:** Map real-world threats to the ATT&CK framework to understand adversary behaviors.

**Example Prompts:**
```
# Find all techniques associated with APT29
mitre-mcp search "APT29" --tactics

# Get details of a specific technique
mitre-mcp technique T1059.001

# List all known threat groups using a specific technique
mitre-mcp techniques --used-by "T1059"
```

**Expected Results:**
- Mappings of threat actors to techniques
- Detailed information about specific attack patterns
- Context about how techniques are used in real attacks

## 2. Detection Engineering
**Objective:** Develop and improve security detections based on known adversary techniques.

**Example Prompts:**
```
# Find detection rules for credential dumping
mitre-mcp detections --technique T1003

# List all techniques with available Sigma rules
mitre-mcp techniques --has-detection

# Get mitigations for a specific technique
mitre-mcp mitigations --technique T1055
```

**Expected Results:**
- Relevant detection rules for specific techniques
- Coverage analysis of existing detections
- Gaps in detection coverage

## 3. Threat Hunting
**Objective:** Proactively search for signs of malicious activity using ATT&CK techniques.

**Example Prompts:**
```
# List all techniques in the Initial Access tactic
mitre-mcp techniques --tactic "initial-access"

# Find techniques commonly used in the first 24 hours of a breach
mitre-mcp techniques --time-to-value "rapid"

# Get hunting queries for persistence techniques
mitre-mcp hunting --tactic "persistence"
```

**Expected Results:**
- Hunting hypotheses based on ATT&CK techniques
- Relevant data sources for investigation
- Time-based analysis of attack patterns

## 4. Red Teaming
**Objective:** Simulate adversary attacks to test defenses.

**Example Prompts:**
```
# Get atomic red team tests for a specific technique
mitre-mcp atomic --technique T1059.001

# List all techniques with available simulation tools
mitre-mcp techniques --has-simulation

# Find techniques commonly used by APT groups in our industry
mitre-mcp search "financial" --groups
```

**Expected Results:**
- Test cases mapped to ATT&CK techniques
- Simulation commands and tools
- Industry-specific attack scenarios

## 5. Security Assessment
**Objective:** Evaluate security controls against the ATT&CK matrix.

**Example Prompts:**
```
# List all techniques with mitigations
mitre-mcp mitigations --list

# Find techniques that lack mitigations in our environment
mitre-mcp techniques --no-mitigations

# Get coverage report of our security controls
mitre-mcp coverage --controls
```

**Expected Results:**
- Control coverage analysis
- Security gaps and recommendations
- Prioritized remediation actions

## 6. Incident Response
**Objective:** Understand and document attack patterns during security incidents.

**Example Prompts:**
```
# Find related techniques to observed IOCs
mitre-mcp ioc "powershell -nop -w hidden -c"

# Get forensic artifacts for a specific technique
mitre-mcp forensics --technique T1053.005

# Map detection events to ATT&CK techniques
mitre-mcp map-events events.json
```

**Expected Results:**
- Context about observed attack patterns
- Relevant forensic artifacts to examine
- Timeline of potential attack progression

## 7. Security Operations
**Objective:** Enhance SOC operations with ATT&CK-aligned monitoring.

**Example Prompts:**
```
# List all techniques with data sources
mitre-mcp techniques --data-sources

# Find techniques that use specific event logs
mitre-mcp techniques --data-source "process monitoring"

# Get detection rules for high-priority techniques
mitre-mcp detections --priority high
```

**Expected Results:**
- Data source coverage analysis
- Alert enrichment information
- Detection tuning recommendations

## 8. Security Training
**Objective:** Train teams on adversary tactics and techniques.

**Example Prompts:**
```
# Get training materials for a specific technique
mitre-mcp training --technique T1059.001

# List all techniques with available training
mitre-mcp techniques --has-training

# Generate quiz questions for a specific tactic
mitre-mcp quiz --tactic "lateral-movement"
```

**Expected Results:**
- Training modules by technique
- Knowledge assessment tools
- Scenario-based learning materials

## 9. Vendor Evaluation
**Objective:** Compare security tools based on ATT&CK coverage.

**Example Prompts:**
```
# Compare coverage between two tools
mitre-mcp compare --tools "CrowdStrike,Microsoft"

# List all techniques detected by a specific vendor
mitre-mcp coverage --vendor "Palo Alto"

# Find gaps in our current tooling
mitre-mcp coverage --gaps
```

**Expected Results:**
- Vendor coverage reports
- Gap analysis
- Procurement recommendations

## 10. Risk Management
**Objective:** Prioritize security investments based on threat relevance.

**Example Prompts:**
```
# List techniques by risk score
mitre-mcp techniques --sort-by risk

# Find techniques relevant to our industry
mitre-mcp search "financial" --techniques

# Get risk assessment for our environment
mitre-mcp risk-assessment --profile finance
```

**Expected Results:**
- Risk-scored technique list
- Industry-specific threat profiles
- Investment prioritization matrix

## Usage Notes
- Replace example parameters with your specific values
- Combine flags for more specific queries (e.g., `--tactic discovery --platform windows`)
- Use `--help` for full command reference and available options
- Results may vary based on your mitre-mcp version and data sources

## Contributing
Feel free to submit pull requests with additional examples or improvements to this playbook.
