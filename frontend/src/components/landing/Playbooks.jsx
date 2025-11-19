/**
 * Playbooks Component
 *
 * Interactive scenarios and example queries from MITRE MCP Playbooks
 */
import { useState } from 'react';

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
      title: '🌟 Beginner Guide',
      description: 'New to MITRE ATT&CK? Start here with simple queries',
      icon: '🎯',
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
      title: '🔍 Threat Intelligence',
      description: 'Map threat actors to techniques and tactics',
      icon: '🎯',
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
      title: '🛡️ Detection Engineering',
      description: 'Build detections and mitigations for techniques',
      icon: '⚙️',
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
      title: '🔎 Threat Hunting',
      description: 'Build proactive hunt packages',
      icon: '🎯',
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
      title: '🔴 Red Teaming',
      description: 'Adversary emulation planning',
      icon: '⚔️',
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
      title: '🚨 Incident Response',
      description: 'Map behaviors to ATT&CK for investigations',
      icon: '📋',
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
      title: '📊 Security Assessment',
      description: 'Evaluate defenses and coverage',
      icon: '✅',
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
      title: '🖥️ Security Operations',
      description: 'SOC monitoring and runbooks',
      icon: '🎚️',
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
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Interactive Playbooks
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Try these pre-built scenarios and queries. Click on any scenario to explore example questions,
            then copy them to test with the chatbox below.
          </p>
        </div>

        {/* Scenario Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => setSelectedScenario(selectedScenario === scenario.id ? null : scenario.id)}
              className={`p-6 rounded-xl text-left transition-all duration-200 ${
                selectedScenario === scenario.id
                  ? 'bg-blue-600 text-white shadow-2xl scale-105'
                  : 'bg-white hover:bg-blue-50 shadow-lg hover:shadow-xl'
              }`}
            >
              <div className="text-4xl mb-3">{scenario.icon}</div>
              <h3 className={`text-lg font-bold mb-2 ${
                selectedScenario === scenario.id ? 'text-white' : 'text-gray-900'
              }`}>
                {scenario.title}
              </h3>
              <p className={`text-sm ${
                selectedScenario === scenario.id ? 'text-blue-100' : 'text-gray-600'
              }`}>
                {scenario.description}
              </p>
            </button>
          ))}
        </div>

        {/* Selected Scenario Details */}
        {selectedScenario && (
          <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 animate-fadeIn">
            {scenarios
              .filter(s => s.id === selectedScenario)
              .map((scenario) => (
                <div key={scenario.id}>
                  <div className="flex items-center mb-6">
                    <span className="text-5xl mr-4">{scenario.icon}</span>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        {scenario.title}
                      </h3>
                      <p className="text-gray-600 mt-1">
                        {scenario.description}
                      </p>
                    </div>
                  </div>

                  {scenario.queries.map((category, catIdx) => (
                    <div key={catIdx} className="mb-6 last:mb-0">
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">
                        {category.category}
                      </h4>
                      <div className="space-y-2">
                        {category.examples.map((query, queryIdx) => (
                          <div
                            key={queryIdx}
                            className="flex items-start justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                          >
                            <p className="text-sm text-gray-700 flex-1 pr-4">
                              💬 {query}
                            </p>
                            <button
                              onClick={() => copyToClipboard(query, `${catIdx}-${queryIdx}`)}
                              className="flex-shrink-0 px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              {copiedQuery === `${catIdx}-${queryIdx}` ? '✓ Copied!' : '📋 Copy'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>💡 Tip:</strong> Copy any query above and paste it into the chatbox below to see it in action!
                      Make sure your mitre-mcp server is running on localhost:8000.
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Quick Start Queries */}
        {!selectedScenario && (
          <div className="mt-12 bg-white rounded-xl shadow-lg p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              🚀 Quick Start Queries
            </h3>
            <p className="text-gray-600 mb-6">
              Not sure where to start? Try these popular queries:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "Show me all tactics in the enterprise domain",
                "What is technique T1059?",
                "Which techniques does APT29 use?",
                "List initial access techniques",
                "What mitigations exist for privilege escalation?",
                "Show me techniques for the discovery tactic"
              ].map((query, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 group hover:shadow-md transition-all"
                >
                  <span className="text-sm text-gray-700">💬 {query}</span>
                  <button
                    onClick={() => copyToClipboard(query, `quick-${idx}`)}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    {copiedQuery === `quick-${idx}` ? '✓' : '📋'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
