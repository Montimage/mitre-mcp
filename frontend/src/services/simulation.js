/**
 * Simulation mode — the scripted demo the chat falls back to when no
 * mitre-mcp server is reachable.
 *
 * The deployed landing page has no server and, for most visitors, no LLM
 * either, so the real agent can answer nothing. Rather than show a dead
 * chat, the box replays curated sample answers for the prompts the page
 * itself promotes: every "Ask" button in Playbooks and Quick Start sends
 * one of the strings keyed below.
 *
 * Two rules govern this file:
 *
 *  1. Matching is deterministic, never fuzzy. A closed set of prompts is
 *     matched exactly (after normalisation), plus one unambiguous extra
 *     tier for a bare ATT&CK technique ID. Anything else gets the fallback
 *     — an honest "this is a demo" with suggestions beats a confidently
 *     wrong answer scored out of a keyword bag.
 *  2. Every identifier here is real: technique, tactic, group, software and
 *     mitigation IDs match the published ATT&CK framework. The answers are
 *     abridged samples, not live framework data, and the UI says so.
 *
 * The `tools` lines are display-only traces of the calls the real agent
 * would make. They are rendered as plain system messages, never as tool
 * approval cards — a fake approval would need a resolver the simulated
 * path does not have.
 */

/** Prefix that marks a simulated tool trace so it can never read as real. */
export const SIMULATION_TOOL_PREFIX = 'Simulated';

/**
 * Normalise a prompt for matching: case, punctuation and whitespace are all
 * noise. Technique IDs survive as `t1059001`, which is stable on both sides
 * of the comparison.
 */
export const normalizePrompt = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Matches a bare ATT&CK technique ID, with or without a sub-technique. */
const TECHNIQUE_ID_PATTERN = /\bT\d{4}(?:\.\d{3})?\b/gi;

// Each entry answers one topic. `prompts` are the exact strings the landing
// page sends; `ids` let a question that names only a technique ID resolve
// here too.
const SCRIPT = [
  {
    prompts: [
      "Explain what 'Spearphishing Attachment' is in simple terms",
    ],
    tools: ['get_technique_by_id(technique_id="T1566.001")'],
    answer: `**T1566.001 — Phishing: Spearphishing Attachment** (Initial Access, TA0001)

An attacker emails a specific person a file — an invoice, a CV, a shipping notice — that carries malicious code. Opening it, or enabling macros when the document asks, runs the attacker's code on that machine.

"Spear" means it is targeted: the sender, the subject and the pretext are chosen for the recipient, which is why it gets past filters and past people.

- **Sibling techniques:** T1566.002 Spearphishing Link, T1566.003 Spearphishing via Service
- **Mitigations:** M1049 Antivirus/Antimalware, M1031 Network Intrusion Prevention, M1017 User Training, M1040 Behavior Prevention on Endpoint
- **Detection:** mail gateway logs, file creation in Outlook temp paths, and office applications spawning child processes such as \`cmd.exe\`, \`powershell.exe\` or \`wscript.exe\``,
  },
  {
    prompts: [
      'Show me real-world examples of APT29 attacks',
      'What techniques does APT29 use? Highlight the most critical ones for defense.',
      'Which techniques does APT29 use?',
    ],
    tools: [
      'get_groups(name="APT29")',
      'get_techniques_used_by_group(group_id="G0016")',
    ],
    answer: `**APT29 — G0016** (also tracked as Cozy Bear, The Dukes, Midnight Blizzard)

A long-running, patient espionage actor. Its defining trait is quiet access: valid credentials, trusted channels and slow collection rather than noisy tooling.

Most defence-relevant techniques:

| Technique | Why it matters |
| --- | --- |
| T1078 Valid Accounts | Access that looks like a normal login — no malware to catch |
| T1566 Phishing | Recurring first step, including targeted attachments and links |
| T1059.001 PowerShell | Execution that hides among legitimate administration |
| T1027 Obfuscated Files or Information | Defeats signature-based inspection |
| T1071.001 Application Layer Protocol: Web Protocols | C2 blended into ordinary HTTPS |
| T1195 Supply Chain Compromise | Reaches many victims through one trusted vendor |

**Where to spend effort first:** enforce MFA and monitor for impossible-travel and new-device sign-ins (T1078), then turn on PowerShell script-block logging (T1059.001). Those two cover the entry and the execution step.`,
  },
  {
    prompts: [
      'What are the common first steps attackers take in a cyber attack?',
      'List initial access techniques',
      'Build a threat hunt plan for Initial Access techniques - include hypotheses and log sources.',
    ],
    tools: ['get_techniques_by_tactic(tactic="initial-access", domain="enterprise")'],
    answer: `**Initial Access — TA0001**

How intruders get their first foothold. Nine techniques sit in this tactic; these are the ones that account for most real intrusions:

- **T1566 Phishing** — attachment, link, or via a third-party service
- **T1190 Exploit Public-Facing Application** — an unpatched web server, VPN or file-transfer appliance
- **T1133 External Remote Services** — RDP, VPN or Citrix exposed without MFA
- **T1078 Valid Accounts** — credentials bought, phished or reused
- **T1195 Supply Chain Compromise** — a trusted update or dependency
- **T1189 Drive-by Compromise** — a compromised site the user simply visits

**Hunt hypotheses**

1. An external-facing service was exploited → look for web-server processes spawning shells (\`w3wp.exe\` → \`cmd.exe\`).
2. A valid account is being used by someone else → first-seen device, ASN or country per user.
3. A phishing payload executed → office applications spawning script interpreters.

**Log sources:** mail gateway, web/WAF and VPN logs, endpoint process creation, and authentication logs for the identity provider.`,
  },
  {
    prompts: [
      'Show me techniques attackers use to stay hidden in a system',
      'What Defense Evasion techniques should I prioritize for alert tuning?',
    ],
    tools: ['get_techniques_by_tactic(tactic="defense-evasion", domain="enterprise")'],
    answer: `**Defense Evasion — TA0005**

The largest tactic in ATT&CK. For alert tuning, start with the techniques that are both common and cheap to detect:

1. **T1562.001 Impair Defenses: Disable or Modify Tools** — anyone stopping your EDR or AV is worth an immediate page. Very low false-positive rate.
2. **T1070.004 Indicator Removal: File Deletion** and **T1070.001 Clear Windows Event Logs** — log clearing (Event ID 1102) is near-binary evidence.
3. **T1055 Process Injection** — noisier to tune, but high value; Sysmon Event 8 (CreateRemoteThread) and 10 (ProcessAccess).
4. **T1036 Masquerading** — a binary named \`svchost.exe\` outside \`System32\` is a strong signal.
5. **T1027 Obfuscated Files or Information** — encoded PowerShell (\`-enc\`) is the classic form.
6. **T1218 System Binary Proxy Execution** — \`rundll32\`, \`regsvr32\`, \`mshta\` reaching the network.

**Tuning order:** 1 and 2 first — they are almost never legitimate. Leave 3 and 5 until you have a baseline, or they will bury the queue.`,
  },
  {
    prompts: [
      'What security controls can protect against password spraying?',
    ],
    tools: [
      'get_technique_by_id(technique_id="T1110.003")',
      'get_mitigations(domain="enterprise")',
    ],
    answer: `**T1110.003 — Brute Force: Password Spraying** (Credential Access, TA0006)

One common password tried against many accounts, slowly enough to stay under per-account lockout thresholds.

**Mitigations that actually work here**

- **M1032 Multi-factor Authentication** — the single highest-value control; a sprayed password alone stops being enough
- **M1027 Password Policies** — ban the passwords sprays use (\`Season+Year\`, \`Company123\`) with a breached-password list, not just complexity rules
- **M1036 Account Use Policies** — lockout thresholds tuned so a slow spray still trips them
- **M1018 User Account Management** — disable dormant and orphaned accounts; they are the usual way in

**The detection that matters:** alert on one source IP producing failed logons across *many distinct accounts* in a window. Per-account counters never see a spray — the pattern is horizontal, not vertical.`,
  },
  {
    prompts: [
      'How can I detect if someone is trying to brute force my passwords?',
    ],
    tools: ['get_technique_by_id(technique_id="T1110")'],
    answer: `**T1110 — Brute Force** (Credential Access, TA0006)

Four sub-techniques, and they look different in logs: .001 Password Guessing, .002 Password Cracking (offline — invisible to you), .003 Password Spraying, .004 Credential Stuffing.

**What to watch**

| Signal | Source |
| --- | --- |
| Failed logon bursts | Windows Security 4625; Linux \`auth.log\` |
| Kerberos pre-auth failures | Windows Security 4771 |
| Lockouts | Windows Security 4740 |
| Cloud sign-in failures | Identity-provider sign-in logs |

**Three rules worth writing**

1. Many failures for **one account** from one source → classic guessing.
2. Many failures across **many accounts** from one source → spraying (see T1110.003).
3. A failure burst **followed by a success** → the one to page on; the rest is background noise.

Count distinct accounts and distinct sources separately — that difference is what separates the sub-techniques.`,
  },
  {
    prompts: [
      'What are the top 5 security practices to prevent ransomware?',
    ],
    tools: [
      'get_technique_by_id(technique_id="T1486")',
      'get_techniques_mitigated_by_mitigation(mitigation_id="M1053")',
    ],
    answer: `**T1486 — Data Encrypted for Impact** (Impact, TA0040)

Ransomware is the last step of an intrusion, so four of these five controls are about everything that happens before the encryption.

1. **M1053 Data Backup** — offline or immutable copies, and a restore you have actually timed. Attackers target backups first (T1490 Inhibit System Recovery).
2. **M1032 Multi-factor Authentication** on every remote entry point — most incidents start at T1133 External Remote Services or T1078 Valid Accounts.
3. **M1051 Update Software** on internet-facing systems — T1190 Exploit Public-Facing Application is the other common front door.
4. **M1026 Privileged Account Management** — no shared local admin passwords, tiered accounts. This is what stops one host becoming the whole estate.
5. **M1040 Behavior Prevention on Endpoint** — block the tells: shadow-copy deletion (\`vssadmin delete shadows\`), \`bcdedit\` recovery changes, mass file renames.

**The detection worth having:** shadow-copy deletion. It is one command, it is almost never legitimate, and it happens minutes before encryption.`,
  },
  {
    prompts: [
      'I got an alert about unusual PowerShell activity. What could it mean?',
      'Give me details on T1059.001 including detection guidance.',
    ],
    ids: ['T1059.001'],
    tools: ['get_technique_by_id(technique_id="T1059.001")'],
    answer: `**T1059.001 — Command and Scripting Interpreter: PowerShell** (Execution, TA0002)

PowerShell is signed, built in, and legitimately used by administrators — which is exactly why attackers use it. The alert is not the finding; the *shape* of the command is.

**Triage, in order**

1. **Parent process.** \`winword.exe\` or \`outlook.exe\` spawning PowerShell is bad. \`explorer.exe\` on an admin's workstation usually is not.
2. **Encoding.** \`-enc\`, \`-EncodedCommand\`, \`FromBase64String\` — decode it before anything else.
3. **Download-and-run.** \`DownloadString\`, \`IEX\`, \`Invoke-WebRequest\` to an unfamiliar host.
4. **Hidden window.** \`-w hidden\`, \`-NoProfile\`, \`-ExecutionPolicy Bypass\` together are a strong combination.

**Detection sources**

- **Event ID 4104** — script block logging. The one to turn on; it records the deobfuscated script.
- **Event ID 4103** — module/pipeline logging
- **Event ID 4688** / Sysmon 1 — process creation with the full command line
- **AMSI** — catches in-memory content that never touches disk

**Mitigations:** M1045 Code Signing (Constrained Language Mode), M1042 Disable or Remove Feature or Program (remove PowerShell v2), M1038 Execution Prevention, M1026 Privileged Account Management.`,
  },
  {
    prompts: [
      'What should I do if I suspect a phishing attack?',
    ],
    tools: ['get_technique_by_id(technique_id="T1566")'],
    answer: `**T1566 — Phishing** (Initial Access, TA0001)

**First hour**

1. **Do not delete it.** Preserve the message with full headers — it is the only source for sender infrastructure and for finding everyone else who got it.
2. **Scope the delivery.** Search the mail gateway for the sender, subject and any attachment hash. Assume it went to more than one mailbox.
3. **Find out who acted.** Clicked the link, opened the attachment, or entered credentials — these are three different severities.
4. **Contain by what happened:**
   - Credentials entered → reset, revoke active sessions and tokens, check for new MFA registrations (T1098.005)
   - Attachment opened → isolate the host, look for office applications spawning script interpreters
   - Link only, nothing entered → block the domain, monitor, no isolation needed
5. **Block and sweep.** Sender domain, URL and file hash at the gateway and proxy; purge remaining copies.

**Then look past the email.** Phishing is step one. Check for T1059.001 PowerShell execution, T1547.001 Registry Run Key persistence and unexpected outbound connections from the affected hosts.`,
  },
  {
    prompts: [
      'What are the most important security logs I should be monitoring?',
      'Map my current SIEM use cases to ATT&CK tactics - identify gaps.',
    ],
    tools: ['get_tactics(domain="enterprise")'],
    answer: `**Coverage by tactic — the log sources that earn their keep**

| Tactic | Log source | Detects |
| --- | --- | --- |
| TA0001 Initial Access | Mail gateway, VPN, WAF | T1566, T1133, T1190 |
| TA0002 Execution | Process creation (4688 / Sysmon 1) with command line | T1059.\\* |
| TA0003 Persistence | Registry (Sysmon 12-14), scheduled tasks (4698), services (7045) | T1547, T1053, T1543 |
| TA0005 Defense Evasion | Log clearing (1102), EDR tamper events | T1070, T1562 |
| TA0006 Credential Access | LSASS access (Sysmon 10), 4625, 4771 | T1003, T1110 |
| TA0008 Lateral Movement | 4624 type 3/10, 5140, WinRM | T1021.\\* |
| TA0011 Command and Control | DNS, proxy, firewall egress | T1071, T1090, T1568 |

**If you only add one thing:** process creation with full command line. It is the backbone of Execution coverage and it feeds detections in five other tactics.

**The usual gaps:** Collection (TA0009) and Exfiltration (TA0010) are almost always the thinnest — most SIEMs watch what comes in far more closely than what leaves.`,
  },
  {
    prompts: [
      'Compare APT29 and APT28 techniques - what overlaps exist?',
    ],
    tools: [
      'get_techniques_used_by_group(group_id="G0016")',
      'get_techniques_used_by_group(group_id="G0007")',
    ],
    answer: `**APT29 (G0016)** vs **APT28 (G0007)**

Both are long-running espionage actors, and both start with people and credentials rather than exploits.

**Shared ground**

- T1566 Phishing — the common first step for both
- T1078 Valid Accounts — legitimate credentials over malware
- T1059.001 PowerShell — native execution
- T1071.001 Web Protocols — C2 hidden in ordinary web traffic

**Where they differ in character**

| | APT29 | APT28 |
| --- | --- | --- |
| Tempo | Slow, quiet, long dwell | Faster, broader, more opportunistic |
| Credential access | Token and session abuse | T1110.003 Password Spraying at scale |
| Notable reach | T1195 Supply Chain Compromise | Credential harvesting against many targets |

**What this means for defence:** the overlap is where to spend first. MFA plus sign-in anomaly detection (T1078) and PowerShell script-block logging (T1059.001) cover the entry and execution steps for both — the divergence only matters once those are in place.`,
  },
  {
    prompts: [
      'Analyze T1003 (Credential Dumping) - what log sources and detection logic should I implement?',
    ],
    ids: ['T1003'],
    tools: ['get_technique_by_id(technique_id="T1003")'],
    answer: `**T1003 — OS Credential Dumping** (Credential Access, TA0006)

Eight sub-techniques; each leaves a different trace, so detection has to be per sub-technique rather than per technique.

| Sub-technique | Detection logic |
| --- | --- |
| .001 LSASS Memory | Sysmon Event 10: any process opening \`lsass.exe\` with \`0x1010\`/\`0x1410\` access rights. The highest-value rule in this family. |
| .002 Security Account Manager | Access to \`\\SAM\` / \`\\SYSTEM\` registry hives; \`reg save hklm\\sam\` |
| .003 NTDS | \`ntdsutil\` or \`vssadmin\` on a domain controller; any read of \`ntds.dit\` |
| .006 DCSync | Event 4662 with the DS-Replication-Get-Changes property set, from a host that is **not** a domain controller |
| .008 /etc/passwd and /etc/shadow | Non-root reads of \`/etc/shadow\` |

**Log sources to enable:** Sysmon (Events 1, 10, 11), Windows Security 4688 with command line, 4662 with directory-service auditing on, and process creation on Linux via auditd.

**Mitigations:** M1043 Credential Access Protection (LSA Protection, Credential Guard), M1028 Operating System Configuration, M1026 Privileged Account Management, M1027 Password Policies.

**Tuning note:** legitimate EDR and backup agents open LSASS. Baseline them by signer, then alert on everything else — the allow-list is short and stable.`,
  },
  {
    prompts: [
      'What mitigations address the most common persistence techniques?',
      'What persistence techniques should I prioritize for a Windows environment?',
    ],
    tools: [
      'get_techniques_by_tactic(tactic="persistence", domain="enterprise")',
      'get_mitigations(domain="enterprise")',
    ],
    answer: `**Persistence — TA0003**, ranked for a Windows estate

1. **T1547.001 Registry Run Keys / Startup Folder** — the most common, and the cheapest to watch (Sysmon 12-14)
2. **T1053.005 Scheduled Task** — Event ID 4698 on creation
3. **T1543.003 Windows Service** — System Event ID 7045 on install
4. **T1078 Valid Accounts** — the hardest, because nothing about it is malicious
5. **T1505.003 Web Shell** — on any internet-facing IIS or Exchange host
6. **T1546.003 WMI Event Subscription** — rarer, but survives reboots and is easy to miss

**Mitigations that cover several at once**

- **M1018 User Account Management** and **M1026 Privileged Account Management** — most persistence needs privilege first; removing local admin removes 3, 5 and 6
- **M1047 Audit** — you cannot remediate autoruns you have never inventoried
- **M1028 Operating System Configuration** — service and task-creation hardening
- **M1022 Restrict File and Directory Permissions** — blocks web-shell writes into web roots

**The honest part:** T1078 has no clean preventive control. It is an identity problem — MFA, conditional access and sign-in monitoring, not endpoint hardening.`,
  },
  {
    prompts: [
      "Show me all techniques that 'Network Segmentation' mitigates.",
      "Assess my control coverage - what techniques does 'Network Segmentation' mitigate?",
    ],
    tools: ['get_techniques_mitigated_by_mitigation(mitigation_id="M1030")'],
    answer: `**M1030 — Network Segmentation**

Segmentation does not stop an intruder arriving. It limits how far they travel, so its coverage clusters in Discovery, Lateral Movement and Command and Control.

| Technique | Effect of segmentation |
| --- | --- |
| T1021 Remote Services | Blocks RDP/SMB/WinRM across zone boundaries |
| T1210 Exploitation of Remote Services | Removes reachability to the vulnerable service |
| T1570 Lateral Tool Transfer | Stops tooling being copied host to host |
| T1046 Network Service Discovery | Confines scanning to one segment |
| T1090 Proxy / T1071 Application Layer Protocol | Egress control forces C2 through inspected paths |
| T1133 External Remote Services | Limits what an exposed service can reach inward |
| T1199 Trusted Relationship | Contains a compromised third-party connection |

**Coverage assessment:** strong on lateral movement, near-zero on Initial Access, Execution and Credential Access. If segmentation is your main control, those three tactics are your gap — pair it with M1032 Multi-factor Authentication and M1043 Credential Access Protection.`,
  },
  {
    prompts: [
      'Generate hunting queries for lateral movement techniques used by APT groups.',
    ],
    tools: ['get_techniques_by_tactic(tactic="lateral-movement", domain="enterprise")'],
    answer: `**Lateral Movement — TA0008**, hunt starting points

| Technique | What to look for |
| --- | --- |
| T1021.001 Remote Desktop Protocol | 4624 logon type 10 to hosts a user has never touched |
| T1021.002 SMB/Windows Admin Shares | 5140 on \`ADMIN$\` / \`C$\`, paired with 7045 service install |
| T1021.006 Windows Remote Management | \`wsmprovhost.exe\` as a parent process |
| T1047 Windows Management Instrumentation | \`wmiprvse.exe\` spawning \`cmd.exe\` or \`powershell.exe\` |
| T1550.002 Pass the Hash | 4624 type 3, NTLM, with no matching 4768/4769 Kerberos activity |
| T1570 Lateral Tool Transfer | Executables written to \`ADMIN$\` shortly before a service install |

**The pattern that finds intrusions:** a *first-time* pairing. Not "RDP happened" but "this account has never authenticated to this host before". Build a 30-day baseline of account-to-host edges and alert on new ones from servers — user workstations are too noisy to start with.

**Chain to watch end to end:** 4624 type 3 → 5140 on \`ADMIN$\` → file written → 7045 service install. All four within a minute is rarely benign.`,
  },
  {
    prompts: [
      'Build a FIN7 emulation plan focused on lateral movement techniques.',
    ],
    tools: [
      'get_groups(name="FIN7")',
      'get_techniques_used_by_group(group_id="G0046")',
      'get_software(name="Carbanak")',
    ],
    answer: `**FIN7 — G0046**, lateral movement emulation outline

A financially motivated actor with a long history against retail and hospitality. Known software includes **Carbanak (S0030)** and **Cobalt Strike (S0154)**.

**Scenario, in order**

1. **Entry (context only)** — T1566.001 Spearphishing Attachment into T1204.002 Malicious File
2. **Execution** — T1059.001 PowerShell and T1059.003 Windows Command Shell
3. **Credential access** — T1003.001 LSASS Memory to obtain a reusable account
4. **Discovery** — T1018 Remote System Discovery, T1087.002 Domain Account Discovery
5. **Lateral movement** — T1021.002 SMB/Windows Admin Shares, then T1570 Lateral Tool Transfer
6. **Execution on target** — T1047 WMI or T1543.003 service creation
7. **Persistence** — T1053.005 Scheduled Task on each host reached

**Detection objectives to test:** does the SOC catch step 3 (LSASS access), step 5 (first-time admin-share write) and step 7 (4698 task creation)? Those three are the measurable outcomes; the rest is scaffolding.

**Rules of engagement:** agree the target scope, the account to be used and an abort signal in writing before execution, and log every action with timestamps for the purple-team debrief.`,
  },
  {
    prompts: [
      'What tools and malware should I use to emulate APT41 behavior?',
    ],
    tools: [
      'get_groups(name="APT41")',
      'get_software(name="PlugX")',
    ],
    answer: `**APT41 — G0096** (also tracked as Double Dragon, Wicked Panda)

Unusual in running espionage and financially motivated operations with the same tooling.

**Documented software**

| Software | ID | Role in an emulation |
| --- | --- | --- |
| China Chopper | S0020 | Web shell on an exposed server (T1505.003) |
| Cobalt Strike | S0154 | C2 and lateral movement |
| PlugX | S0013 | Persistent RAT, commonly DLL side-loaded (T1574.002) |
| ShadowPad | S0596 | Modular backdoor |
| Winnti for Windows | S0141 | Long-dwell implant |

**Behaviours worth reproducing**, which matter more than the binaries:

- T1190 Exploit Public-Facing Application as the entry point
- T1574.002 DLL Side-Loading — the APT41 hallmark: a signed, legitimate executable loading an attacker DLL
- T1195.002 Compromise Software Supply Chain
- T1071.001 Web Protocols for C2

**For a safe exercise:** emulate the *behaviour* with an atomic test or your C2 framework of choice rather than running real samples. DLL side-loading against a signed binary is the single most valuable detection to test here — it is what most tooling misses.`,
  },
  {
    prompts: [
      'Create a multi-stage attack chain using techniques from the Privilege Escalation tactic.',
    ],
    tools: ['get_techniques_by_tactic(tactic="privilege-escalation", domain="enterprise")'],
    answer: `**Privilege Escalation — TA0004**, a chain from user to domain

| Stage | Technique | Outcome |
| --- | --- | --- |
| 1 | T1078 Valid Accounts | Standard user foothold |
| 2 | T1548.002 Bypass User Account Control | Local admin on that host |
| 3 | T1003.001 LSASS Memory | Cached credentials of anyone logged on |
| 4 | T1134 Access Token Manipulation | Impersonate a privileged token |
| 5 | T1021.002 SMB/Windows Admin Shares | Move to a server with better credentials |
| 6 | T1053.005 Scheduled Task | SYSTEM execution and persistence |

**Alternative branches:** T1068 Exploitation for Privilege Escalation when a kernel or driver flaw is available, and T1574 Hijack Execution Flow where a writable path sits in a service's search order.

**Where to break the chain:** stage 2. Remove local administrator rights and steps 3 through 6 all become much harder — every later stage assumes the privilege that stage 2 provides. That is one control (M1026 Privileged Account Management) against five techniques.`,
  },
  {
    prompts: [
      'We observed scheduled task creation (T1053.005) - provide detection details and likely threat actors.',
    ],
    ids: ['T1053.005'],
    tools: ['get_technique_by_id(technique_id="T1053.005")'],
    answer: `**T1053.005 — Scheduled Task/Job: Scheduled Task**

Unusual in spanning three tactics at once: Execution (TA0002), Persistence (TA0003) and Privilege Escalation (TA0004) — a task can run as SYSTEM, survive reboots, and execute on a trigger.

**Detection**

- **Event ID 4698** — task created. The primary signal; capture the full XML, the action and the principal.
- **Microsoft-Windows-TaskScheduler/Operational** — Events 106 (registered), 140 (updated), 141 (deleted)
- **Event ID 4688 / Sysmon 1** — \`schtasks.exe\` or \`at.exe\` with a command line
- **Sysmon 11** — file creation under \`C:\\Windows\\System32\\Tasks\\\`

**What separates malicious from routine**

- Task runs as SYSTEM but was created by a user account
- Action points at \`powershell.exe\`, \`cmd.exe\`, \`rundll32\` or a binary in \`%TEMP%\` / \`%APPDATA%\`
- Name imitates a Microsoft task (\`GoogleUpdateTaskMachine\`, \`WindowsUpdate\`) but sits in the root task folder
- Created within minutes of a remote logon

**Documented users** include APT29 (G0016), APT32 (G0050) and FIN7 (G0046) — though scheduled tasks are near-universal, so this is weak attribution evidence on its own.`,
  },
  {
    prompts: [
      'What groups use these techniques: T1053.005, T1059.001, T1003? Help with attribution.',
    ],
    tools: [
      'get_technique_by_id(technique_id="T1053.005")',
      'get_technique_by_id(technique_id="T1059.001")',
      'get_technique_by_id(technique_id="T1003")',
    ],
    answer: `**Overlap across T1053.005, T1059.001 and T1003**

Groups documented as using all three include APT29 (G0016), APT32 (G0050), APT41 (G0096) and FIN7 (G0046).

**The problem with that list:** these three techniques are among the most widely used in the entire framework. Scheduled tasks, PowerShell and credential dumping appear in the majority of intrusions, criminal and state-sponsored alike. A set this common narrows almost nothing.

**What would actually discriminate**

| Evidence | Attribution value |
| --- | --- |
| Distinctive tooling (S-numbered software, custom loaders) | High |
| Infrastructure overlap (C2 domains, certificates, hosting) | High |
| Specific sub-technique variants (e.g. T1574.002 DLL side-loading) | Medium |
| Targeting and victimology | Medium |
| Common techniques like these three | Low |

**Recommendation:** record these as *behavioural* findings and drive containment from them, but do not name an actor on this basis. If attribution matters for your response, pivot to infrastructure and tooling and treat the technique overlap as corroboration at best.`,
  },
  {
    prompts: [
      'Generate an incident report template mapping these IOCs to ATT&CK techniques.',
    ],
    tools: ['get_tactics(domain="enterprise")'],
    answer: `**Incident report — ATT&CK-mapped template**

**1. Summary** — what happened, when it was detected, current status, business impact. Three sentences.

**2. Timeline** — one row per event, in UTC.

| Time (UTC) | Host / account | Observation | Technique |
| --- | --- | --- | --- |
| | | | T\\#### |

**3. Attack path by tactic** — the chain in order, so gaps are visible:

Initial Access (TA0001) → Execution (TA0002) → Persistence (TA0003) → Privilege Escalation (TA0004) → Credential Access (TA0006) → Lateral Movement (TA0008) → Impact (TA0040)

Mark each as *observed*, *suspected* or *not seen*. "Not seen" is a finding, not a blank.

**4. Indicators**

| Indicator | Type | Technique | Confidence |
| --- | --- | --- | --- |

**5. Detection assessment** — for each technique: did a control fire, fire late, or miss? This is the section that changes anything.

**6. Actions** — containment taken, remediation outstanding, owner and date per item.

**Guidance:** map to the most specific sub-technique the evidence supports, and no further. \`T1059\` when you cannot prove the interpreter is better than a wrong \`T1059.001\`.`,
  },
  {
    prompts: [
      'Generate a coverage heat map showing which mitigations address the most critical techniques.',
    ],
    tools: [
      'get_mitigations(domain="enterprise")',
      'get_techniques_mitigated_by_mitigation(mitigation_id="M1026")',
    ],
    answer: `**Mitigation coverage, ranked by breadth**

| Mitigation | Reach | Principal tactics covered |
| --- | --- | --- |
| M1026 Privileged Account Management | Very high | Privilege Escalation, Persistence, Lateral Movement, Credential Access |
| M1032 Multi-factor Authentication | High | Initial Access, Credential Access, Lateral Movement |
| M1051 Update Software | High | Initial Access, Privilege Escalation, Lateral Movement |
| M1030 Network Segmentation | Medium-high | Lateral Movement, Discovery, Command and Control |
| M1038 Execution Prevention | Medium-high | Execution, Defense Evasion, Persistence |
| M1017 User Training | Medium | Initial Access |
| M1053 Data Backup | Narrow but decisive | Impact |

**How to read this:** the top three are where a constrained programme should spend first — each one touches four or more tactics. M1053 is narrow, but it is the only control that changes the outcome of T1486 once encryption has run, so it is not optional.

**Caveat:** breadth is not depth. M1017 User Training touches one tactic and reduces, never eliminates, T1566. Treat this as a prioritisation aid, not a scorecard.`,
  },
  {
    prompts: [
      'What techniques are under-covered by standard enterprise mitigations?',
    ],
    tools: ['get_mitigations(domain="enterprise")'],
    answer: `**Techniques with weak preventive coverage**

Some techniques abuse features that cannot be removed without breaking legitimate use. ATT&CK is explicit about these — they carry little or no preventive mitigation.

| Technique | Why prevention fails |
| --- | --- |
| T1078 Valid Accounts | The activity *is* legitimate use of a real credential |
| T1199 Trusted Relationship | The access was deliberately granted to a third party |
| T1195 Supply Chain Compromise | The malicious content arrives signed and expected |
| T1110.002 Password Cracking | Offline against stolen material; nothing of yours is touched |
| T1036 Masquerading | Naming and paths are not privileged operations |
| T1204 User Execution | Requires a human decision, not a technical flaw |

**What to do instead:** these are detection and response problems, not hardening problems.

- T1078 → sign-in anomaly detection, conditional access, session revocation
- T1199 → scope and monitor third-party accounts as if they were external
- T1195 → software inventory plus egress monitoring for new outbound destinations after an update
- T1110.002 → assume the hash is already gone; length and uniqueness are the control

**The trap to avoid:** a coverage matrix that counts mitigations makes these look fine because a mitigation exists. Score by *residual* risk and they move to the top of the list, where they belong.`,
  },
  {
    prompts: [
      'Build a SOC runbook template for responding to Credential Access alerts.',
    ],
    tools: ['get_techniques_by_tactic(tactic="credential-access", domain="enterprise")'],
    answer: `**SOC runbook — Credential Access (TA0006)**

**Scope:** alerts mapping to T1003 OS Credential Dumping, T1110 Brute Force, T1555 Credentials from Password Stores, T1558 Steal or Forge Kerberos Tickets.

**Triage — 15 minutes**

1. Which sub-technique? T1003.001 (LSASS) and T1003.006 (DCSync) are severity-high by default.
2. Is the source process signed and expected? EDR and backup agents open LSASS legitimately — check the allow-list first.
3. Which identities were exposed on that host? That set defines the blast radius, not the host itself.

**Containment — 1 hour**

- Isolate the host at the network level; keep it powered on for memory evidence
- Reset every account exposed on it and revoke active sessions and Kerberos tickets
- If a DC or a domain admin is involved, escalate immediately — consider the \`krbtgt\` double reset

**Investigate**

- How did they get admin? Look back for T1548 or T1068 before the dump
- What did the credentials reach afterwards? 4624 type 3 from the host, forward in time
- Persistence left behind: 4698 tasks, 7045 services, Run-key writes

**Close**

- Did the control fire, fire late, or miss? Record which.
- One improvement item with an owner and a date. A runbook that closes without this produces the same incident again.`,
  },
  {
    prompts: [
      'Show me all tactics in the enterprise domain',
    ],
    tools: ['get_tactics(domain="enterprise")'],
    answer: `**Enterprise tactics — 14, in the order they typically occur**

| ID | Tactic | The adversary is trying to… |
| --- | --- | --- |
| TA0043 | Reconnaissance | gather information to plan the operation |
| TA0042 | Resource Development | establish infrastructure and capabilities |
| TA0001 | Initial Access | get into the network |
| TA0002 | Execution | run malicious code |
| TA0003 | Persistence | keep their foothold across reboots |
| TA0004 | Privilege Escalation | gain higher-level permissions |
| TA0005 | Defense Evasion | avoid being detected |
| TA0006 | Credential Access | steal account names and passwords |
| TA0007 | Discovery | learn about the environment |
| TA0008 | Lateral Movement | move through the environment |
| TA0009 | Collection | gather data of interest |
| TA0011 | Command and Control | communicate with compromised systems |
| TA0010 | Exfiltration | steal the data out |
| TA0040 | Impact | manipulate, interrupt or destroy |

The ordering is conventional, not required — real intrusions loop, skip and revisit. Mobile and ICS domains have their own tactic sets.`,
  },
  {
    prompts: [
      'What is technique T1059?',
    ],
    ids: ['T1059'],
    tools: ['get_technique_by_id(technique_id="T1059")'],
    answer: `**T1059 — Command and Scripting Interpreter** (Execution, TA0002)

Running commands and scripts through interpreters that are already on the system. It is one of the most frequently observed techniques in the framework, because every platform ships an interpreter and none of them can simply be removed.

**Sub-techniques**

| ID | Interpreter | Platform |
| --- | --- | --- |
| T1059.001 | PowerShell | Windows |
| T1059.002 | AppleScript | macOS |
| T1059.003 | Windows Command Shell | Windows |
| T1059.004 | Unix Shell | Linux, macOS |
| T1059.005 | Visual Basic | Windows |
| T1059.006 | Python | Cross-platform |
| T1059.007 | JavaScript | Cross-platform |
| T1059.008 | Network Device CLI | Network |
| T1059.009 | Cloud API | Cloud |

**Detection:** process creation with the **full command line** (Windows Event 4688 or Sysmon Event 1). Without the command line the event is near-useless — the interpreter name alone tells you nothing.

**Mitigations:** M1038 Execution Prevention, M1042 Disable or Remove Feature or Program, M1045 Code Signing, M1026 Privileged Account Management.`,
  },
  {
    prompts: [
      'What mitigations exist for privilege escalation?',
    ],
    tools: [
      'get_techniques_by_tactic(tactic="privilege-escalation", domain="enterprise")',
      'get_mitigations(domain="enterprise")',
    ],
    answer: `**Mitigations for Privilege Escalation (TA0004)**

- **M1026 Privileged Account Management** — the highest-value control here. Tiered accounts, no shared local admin passwords, just-in-time elevation.
- **M1052 User Account Control** — set to the highest enforcement; blocks T1548.002 Bypass User Account Control
- **M1018 User Account Management** — remove standing local administrator rights from workstations
- **M1051 Update Software** — closes T1068 Exploitation for Privilege Escalation
- **M1038 Execution Prevention** — application control stops the loaders that T1055 Process Injection and T1574 Hijack Execution Flow depend on
- **M1028 Operating System Configuration** — correct service permissions and search paths, which is what T1574.007/.008 abuse
- **M1047 Audit** — inventory unquoted service paths and writable service directories before an attacker finds them

**In practice:** removing local administrator rights is the single change with the broadest effect. Most escalation chains assume the user already has, or can trivially reach, local admin — take that away and the chain has to start with an exploit instead of a click.`,
  },
  {
    prompts: [
      'Show me techniques for the discovery tactic',
    ],
    tools: ['get_techniques_by_tactic(tactic="discovery", domain="enterprise")'],
    answer: `**Discovery — TA0007**

What an intruder does in the first minutes after landing, to work out where they are.

| Technique | Typical command |
| --- | --- |
| T1082 System Information Discovery | \`systeminfo\`, \`uname -a\` |
| T1033 System Owner/User Discovery | \`whoami\` |
| T1016 System Network Configuration Discovery | \`ipconfig /all\`, \`ip addr\` |
| T1087 Account Discovery | \`net user\`, \`net group /domain\` |
| T1018 Remote System Discovery | \`net view\`, \`nltest /dclist\` |
| T1057 Process Discovery | \`tasklist\`, \`ps aux\` |
| T1083 File and Directory Discovery | \`dir /s\`, \`find\` |
| T1046 Network Service Discovery | port scanning |
| T1069 Permission Groups Discovery | \`net localgroup administrators\` |

**Why this tactic is worth detecting:** individually these commands are unremarkable — administrators run them daily. In sequence, within a minute or two, from one process, they are one of the most reliable early intrusion signals there is.

**Write the rule on the burst, not the command.** Count distinct discovery commands per process per five minutes; three or more is worth a look.`,
  },
];

/** Prompts offered when nothing matched — all are scripted entries above. */
export const SIMULATION_SUGGESTIONS = [
  'What is technique T1059?',
  'Which techniques does APT29 use?',
  'Show me all tactics in the enterprise domain',
];

/** Opening message posted when the chat enters simulation mode. */
export const SIMULATION_WELCOME =
  'Simulation mode — no mitre-mcp server is connected, so the assistant is replaying curated sample answers instead of querying live ATT&CK data. ' +
  'Every "Ask" button in the Playbooks section below works here. Connect a real server through Settings for live results.';

// Built once: normalised prompt -> entry.
const BY_PROMPT = new Map();
// Built once: upper-case technique ID -> entry.
const BY_ID = new Map();

for (const entry of SCRIPT) {
  for (const prompt of entry.prompts) {
    BY_PROMPT.set(normalizePrompt(prompt), entry);
  }
  for (const id of entry.ids ?? []) {
    BY_ID.set(id.toUpperCase(), entry);
  }
}

/**
 * Resolve a prompt to a scripted answer.
 *
 * Two deterministic tiers, in order:
 *  1. exact match on the normalised prompt;
 *  2. a question naming exactly one scripted technique ID.
 *
 * Anything else returns `matched: false` with the fallback answer — the
 * demo says it does not know rather than guessing.
 *
 * @param {string} text - the user's prompt
 * @returns {{matched: boolean, tools: string[], answer: string}}
 */
export const getSimulatedAnswer = (text) => {
  const normalized = normalizePrompt(text);

  const exact = BY_PROMPT.get(normalized);
  if (exact) {
    return { matched: true, tools: exact.tools, answer: exact.answer };
  }

  // One unambiguous extra tier: a bare technique ID. Only fires when the
  // question names exactly one ID the script actually covers, so
  // "Compare T1003 and T1059" falls through to the fallback rather than
  // answering about whichever appeared first.
  const mentioned = [...new Set((String(text ?? '').match(TECHNIQUE_ID_PATTERN) || []).map((id) => id.toUpperCase()))];
  const known = mentioned.filter((id) => BY_ID.has(id));
  if (mentioned.length === 1 && known.length === 1) {
    const entry = BY_ID.get(known[0]);
    return { matched: true, tools: entry.tools, answer: entry.answer };
  }

  return {
    matched: false,
    tools: [],
    answer:
      'This is a simulation — no mitre-mcp server is connected, so only a curated set of sample questions has an answer here.\n\n' +
      'Try one of these:\n\n' +
      SIMULATION_SUGGESTIONS.map((s) => `- ${s}`).join('\n') +
      '\n\nEvery "Ask" button in the Playbooks section below sends a question this demo can answer. ' +
      'To ask anything at all, connect a mitre-mcp server through Settings.',
  };
};

/** Every scripted prompt — used by tests and useful for tooling. */
export const getScriptedPrompts = () => SCRIPT.flatMap((entry) => entry.prompts);
