/**
 * Playbooks Component
 *
 * Interactive scenarios and example queries from MITRE MCP Playbooks
 *
 * Design: a card catalogue. Scenarios are ruled tiles that fill with ink
 * when filed open; queries are ruled rows, each a line of the dossier with
 * its two actions set flush right. Action buttons stay visible at all times
 * — never hover-revealed (F-UX-011).
 */
import { useState } from 'react';
import { askChat } from '../../services/askChat.js';
import { getMcpServerAddress } from '../../services/mcpConfig.js';

/**
 * One ruled query row, shared by the scenario detail and the quick-start
 * list so both carry identical affordances. The query text sits directly
 * inside the row element — Playbooks.test.jsx reaches the two actions
 * through that text node's parentElement. Defined at module scope so state
 * changes in Playbooks do not remount every row.
 */
function QueryRow({ query, copyKey, copiedQuery, onCopy }) {
  return (
    <div className="flex flex-col gap-3 border-b border-rule px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper-sunk/70 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p className="text-sm leading-relaxed text-gray-700">{query}</p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => askChat(query)}
          className="bg-black px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-gray-800"
          title="Place this query in the chat input"
        >
          Ask
        </button>
        <button
          onClick={() => onCopy(query, copyKey)}
          className="border border-rule-strong px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-600 transition-colors hover:border-ink hover:text-ink"
        >
          {copiedQuery === copyKey ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

export default function Playbooks() {
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [copiedQuery, setCopiedQuery] = useState(null);

  const copyToClipboard = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedQuery(index);
      setTimeout(() => setCopiedQuery(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const scenarios = [
    {
      id: 'beginner',
      title: 'Beginner Guide',
      description: 'New to MITRE ATT&CK? Start here with simple queries',
      queries: [
        {
          category: 'Basic Information',
          examples: [
            "Explain what 'Spearphishing Attachment' is in simple terms",
            "Show me real-world examples of APT29 attacks",
            "What are the common first steps attackers take in a cyber attack?",
            "Show me techniques attackers use to stay hidden in a system"
          ]
        },
        {
          category: 'Protecting Systems',
          examples: [
            "What security controls can protect against password spraying?",
            "How can I detect if someone is trying to brute force my passwords?",
            "What are the top 5 security practices to prevent ransomware?"
          ]
        },
        {
          category: 'Investigating Issues',
          examples: [
            "I got an alert about unusual PowerShell activity. What could it mean?",
            "What should I do if I suspect a phishing attack?",
            "What are the most important security logs I should be monitoring?"
          ]
        }
      ]
    },
    {
      id: 'threat-intel',
      title: 'Threat Intelligence',
      description: 'Map threat actors to techniques and tactics',
      queries: [
        {
          category: 'Threat Actor Analysis',
          examples: [
            "What techniques does APT29 use? Highlight the most critical ones for defense.",
            "Compare APT29 and APT28 techniques - what overlaps exist?",
            "Give me details on T1059.001 including detection guidance."
          ]
        }
      ]
    },
    {
      id: 'detection',
      title: 'Detection Engineering',
      description: 'Build detections and mitigations for techniques',
      queries: [
        {
          category: 'Detection Strategy',
          examples: [
            "Analyze T1003 (Credential Dumping) - what log sources and detection logic should I implement?",
            "What mitigations address the most common persistence techniques?",
            "Show me all techniques that 'Network Segmentation' mitigates."
          ]
        }
      ]
    },
    {
      id: 'hunting',
      title: 'Threat Hunting',
      description: 'Build proactive hunt packages',
      queries: [
        {
          category: 'Hunt Planning',
          examples: [
            "Build a threat hunt plan for Initial Access techniques - include hypotheses and log sources.",
            "What persistence techniques should I prioritize for a Windows environment?",
            "Generate hunting queries for lateral movement techniques used by APT groups."
          ]
        }
      ]
    },
    {
      id: 'red-team',
      title: 'Red Teaming',
      description: 'Adversary emulation planning',
      queries: [
        {
          category: 'Emulation Plans',
          examples: [
            "Build a FIN7 emulation plan focused on lateral movement techniques.",
            "What tools and malware should I use to emulate APT41 behavior?",
            "Create a multi-stage attack chain using techniques from the Privilege Escalation tactic."
          ]
        }
      ]
    },
    {
      id: 'incident-response',
      title: 'Incident Response',
      description: 'Map behaviors to ATT&CK for investigations',
      queries: [
        {
          category: 'Investigation',
          examples: [
            "We observed scheduled task creation (T1053.005) - provide detection details and likely threat actors.",
            "What groups use these techniques: T1053.005, T1059.001, T1003? Help with attribution.",
            "Generate an incident report template mapping these IOCs to ATT&CK techniques."
          ]
        }
      ]
    },
    {
      id: 'assessment',
      title: 'Security Assessment',
      description: 'Evaluate defenses and coverage',
      queries: [
        {
          category: 'Coverage Analysis',
          examples: [
            "Assess my control coverage - what techniques does 'Network Segmentation' mitigate?",
            "Generate a coverage heat map showing which mitigations address the most critical techniques.",
            "What techniques are under-covered by standard enterprise mitigations?"
          ]
        }
      ]
    },
    {
      id: 'soc-ops',
      title: 'Security Operations',
      description: 'SOC monitoring and runbooks',
      queries: [
        {
          category: 'SOC Workflows',
          examples: [
            "What Defense Evasion techniques should I prioritize for alert tuning?",
            "Build a SOC runbook template for responding to Credential Access alerts.",
            "Map my current SIEM use cases to ATT&CK tactics - identify gaps."
          ]
        }
      ]
    }
  ];

  return (
    <section className="border-b border-rule bg-paper-sunk px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="max-w-2xl">
          <p className="dossier-eyebrow mb-5">03 — Playbooks</p>
          <h2 className="font-display text-4xl sm:text-5xl font-semibold text-ink">
            Interactive Playbooks
          </h2>
          <div className="dossier-rule mt-6 mb-6" />
          <p className="text-lg leading-relaxed text-gray-600">
            Try these pre-built scenarios and queries. Select a scenario to explore example questions,
            then send them straight to the chat above or copy them.
          </p>
        </div>

        {/* Scenario Catalogue — ruled tiles; the open one fills with ink and
            keeps a brass rule along its top edge. */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-rule">
          {scenarios.map((scenario) => {
            const isOpen = selectedScenario === scenario.id;
            return (
              <button
                key={scenario.id}
                onClick={() => setSelectedScenario(isOpen ? null : scenario.id)}
                aria-pressed={isOpen}
                className={`relative border-b border-r border-rule p-6 text-left transition-colors duration-300 ${
                  isOpen ? 'bg-black' : 'bg-paper-card hover:bg-paper'
                }`}
              >
                {/* Brass edge marks the open drawer. */}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 top-0 h-0.5 bg-brass transition-opacity duration-300 ${
                    isOpen ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <h3
                  className={`font-display text-lg font-semibold ${isOpen ? 'text-white' : 'text-ink'}`}
                >
                  {scenario.title}
                </h3>
                <p className={`mt-2 text-sm leading-relaxed ${isOpen ? 'text-gray-300' : 'text-gray-500'}`}>
                  {scenario.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Selected Scenario Details */}
        {selectedScenario && (
          <div className="mt-10 border border-rule bg-paper-card shadow-sheet animate-fadeIn">
            {scenarios
              .filter(s => s.id === selectedScenario)
              .map((scenario) => (
                <div key={scenario.id}>
                  <div className="border-b border-rule px-6 py-6 sm:px-8">
                    <h3 className="font-display text-2xl font-semibold text-ink">
                      {scenario.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-gray-500">
                      {scenario.description}
                    </p>
                  </div>

                  <div className="px-2 py-2 sm:px-4 sm:py-4">
                    {scenario.queries.map((category, catIdx) => (
                      <div key={category.category} className="mb-6 last:mb-2">
                        <h4 className="dossier-eyebrow px-4 py-3">
                          {category.category}
                        </h4>
                        <div className="border-t border-rule">
                          {category.examples.map((query, queryIdx) => (
                            <QueryRow
                              key={query}
                              query={query}
                              copyKey={`${catIdx}-${queryIdx}`}
                              copiedQuery={copiedQuery}
                              onCopy={copyToClipboard}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-rule bg-paper px-6 py-5 sm:px-8">
                    <p className="text-xs leading-relaxed text-gray-600">
                      <strong className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass-700">Tip</strong>
                      {' — '}Click <strong className="font-medium text-ink">Ask</strong> to place a query in the chat above,
                      or copy it to paste yourself. Make sure your mitre-mcp server is running on{' '}
                      <span className="font-mono text-ink">{getMcpServerAddress()}</span>.
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Quick Start Queries */}
        {!selectedScenario && (
          <div className="mt-10 border border-rule bg-paper-card shadow-sheet">
            <div className="border-b border-rule px-6 py-6 sm:px-8">
              <h3 className="font-display text-2xl font-semibold text-ink">
                Quick Start Queries
              </h3>
              <p className="mt-1.5 text-sm text-gray-500">
                Not sure where to start? Try these popular queries:
              </p>
            </div>
            <div className="px-2 py-2 sm:px-4 sm:py-2">
              {[
                "Show me all tactics in the enterprise domain",
                "What is technique T1059?",
                "Which techniques does APT29 use?",
                "List initial access techniques",
                "What mitigations exist for privilege escalation?",
                "Show me techniques for the discovery tactic"
              ].map((query, idx) => (
                <QueryRow
                  key={query}
                  query={query}
                  copyKey={`quick-${idx}`}
                  copiedQuery={copiedQuery}
                  onCopy={copyToClipboard}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
