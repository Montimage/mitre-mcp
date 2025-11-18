#!/usr/bin/env node
/**
 * Mini MCP Client - A Node.js client for interacting with mitre-mcp server via HTTP.
 *
 * This demonstrates how to integrate mitre-mcp into your Node.js applications.
 * For production use, consider adding proper error handling, logging, and retries.
 *
 * Usage:
 *     node mini-mcp-client.js --help
 *     node mini-mcp-client.js techniques --tactic initial-access
 *     node mini-mcp-client.js technique --id T1059.001
 *     node mini-mcp-client.js group --name APT29
 *     node mini-mcp-client.js tactics
 *
 * Installation:
 *     npm install node-fetch commander
 */

const { Command } = require('commander');
const fetch = require('node-fetch');

/**
 * Simple HTTP client for mitre-mcp server.
 */
class MitreMCPClient {
  constructor(host = 'localhost', port = 8000, debug = false) {
    this.baseUrl = `http://${host}:${port}/mcp`;
    this.sessionId = null;
    this.requestId = 0;
    this.debug = debug;
  }

  /**
   * Initialize an MCP session with the server.
   */
  async initializeSession() {
    this.requestId++;

    const initPayload = {
      jsonrpc: '2.0',
      id: this.requestId,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'mini-mcp-client-js',
          version: '1.0.0'
        }
      }
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    };

    if (this.debug) {
      console.error('🔍 Debug: Initializing session...');
      console.error('🔍 Debug: Init payload:', JSON.stringify(initPayload, null, 2));
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(initPayload)
    });

    // Extract session ID from response headers
    this.sessionId = response.headers.get('mcp-session-id');

    if (this.debug) {
      console.error('🔍 Debug: Session initialized');
      console.error('🔍 Debug: Session ID:', this.sessionId);
      const text = await response.text();
      console.error('🔍 Debug: Init response:', text.substring(0, 500));
    }

    if (!response.ok) {
      throw new Error(`Session initialization failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Parse Server-Sent Events (SSE) response format.
   *
   * SSE format:
   *     event: message
   *     data: {"jsonrpc":"2.0","id":1,"result":{...}}
   */
  parseSSEResponse(sseText) {
    const lines = sseText.trim().split('\n');
    const dataLines = [];

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        dataLines.push(line.substring(6)); // Skip "data: " prefix
      }
    }

    const jsonData = dataLines.join('');

    if (this.debug) {
      console.error('🔍 Debug: Extracted SSE data:', jsonData.substring(0, 500));
    }

    return JSON.parse(jsonData);
  }

  /**
   * Call a mitre-mcp tool via HTTP/JSON-RPC.
   *
   * Important: The MCP HTTP server requires the Accept header to include
   * both "application/json" and "text/event-stream" for proper protocol support.
   */
  async callTool(toolName, args = {}) {
    // Initialize session if not already done
    if (!this.sessionId) {
      await this.initializeSession();
    }

    this.requestId++;

    const payload = {
      jsonrpc: '2.0',
      id: this.requestId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'mcp-session-id': this.sessionId
    };

    if (this.debug) {
      console.error('🔍 Debug: Sending request to', this.baseUrl);
      console.error('🔍 Debug: Payload:', JSON.stringify(payload, null, 2));
      console.error('🔍 Debug: Headers:', JSON.stringify(headers, null, 2));
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    if (this.debug) {
      console.error('🔍 Debug: Response status:', response.status);
      console.error('🔍 Debug: Response headers:', Object.fromEntries(response.headers));
      console.error('🔍 Debug: Response body:', text.substring(0, 500));
    }

    if (!response.ok) {
      const error = `HTTP Error: ${response.status} ${response.statusText}`;
      console.error(`❌ ${error}`);
      console.error(`   Make sure mitre-mcp server is running: mitre-mcp --http --port ${this.baseUrl.split(':')[2].split('/')[0]}`);
      throw new Error(error);
    }

    // Check if response is SSE format (text/event-stream)
    const contentType = response.headers.get('content-type') || '';
    let result;
    if (contentType.includes('text/event-stream')) {
      result = this.parseSSEResponse(text);
    } else {
      result = JSON.parse(text);
    }

    // Check for JSON-RPC errors
    if (result.error) {
      const error = result.error;
      throw new Error(`JSON-RPC Error ${error.code}: ${error.message}`);
    }

    return result;
  }

  /**
   * Format the result for display.
   */
  formatOutput(result, pretty = true) {
    return pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);
  }
}

// Command implementations

async function cmdTechniques(client, options) {
  if (options.tactic) {
    return await client.callTool('get_techniques_by_tactic', {
      tactic_shortname: options.tactic,
      domain: options.domain,
      remove_revoked_deprecated: options.noRevoked
    });
  } else {
    return await client.callTool('get_techniques', {
      domain: options.domain,
      include_subtechniques: options.subtechniques,
      include_descriptions: options.descriptions,
      remove_revoked_deprecated: options.noRevoked,
      limit: options.limit,
      offset: options.offset
    });
  }
}

async function cmdTechnique(client, options) {
  return await client.callTool('get_technique_by_id', {
    technique_id: options.id,
    domain: options.domain
  });
}

async function cmdTactics(client, options) {
  return await client.callTool('get_tactics', {
    domain: options.domain
  });
}

async function cmdGroups(client, options) {
  return await client.callTool('get_groups', {
    domain: options.domain,
    remove_revoked_deprecated: options.noRevoked
  });
}

async function cmdGroup(client, options) {
  return await client.callTool('get_techniques_used_by_group', {
    group_name: options.name,
    domain: options.domain
  });
}

async function cmdSoftware(client, options) {
  const softwareTypes = [];
  if (options.malware) softwareTypes.push('malware');
  if (options.tools) softwareTypes.push('tool');
  if (softwareTypes.length === 0) {
    softwareTypes.push('malware', 'tool');
  }

  return await client.callTool('get_software', {
    domain: options.domain,
    software_types: softwareTypes,
    remove_revoked_deprecated: options.noRevoked
  });
}

async function cmdMitigations(client, options) {
  if (options.name) {
    return await client.callTool('get_techniques_mitigated_by_mitigation', {
      mitigation_name: options.name,
      domain: options.domain
    });
  } else {
    return await client.callTool('get_mitigations', {
      domain: options.domain,
      remove_revoked_deprecated: options.noRevoked
    });
  }
}

// Main CLI setup

async function main() {
  const program = new Command();

  program
    .name('mini-mcp-client')
    .description('Mini MCP Client - Simple client for mitre-mcp server')
    .version('1.0.0')
    .option('--host <host>', 'mitre-mcp server host', 'localhost')
    .option('--port <port>', 'mitre-mcp server port', '8000')
    .option('--no-pretty', 'Disable pretty printing')
    .option('--debug', 'Enable debug output');

  // Common options function
  function addCommonOptions(cmd) {
    return cmd
      .option('--domain <domain>', 'ATT&CK domain', 'enterprise-attack')
      .option('--no-revoked', 'Exclude revoked/deprecated items');
  }

  // Techniques command
  const techniquesCmd = program
    .command('techniques')
    .description('Get techniques (all or by tactic)')
    .option('--tactic <tactic>', 'Filter by tactic shortname')
    .option('--subtechniques', 'Include sub-techniques')
    .option('--descriptions', 'Include descriptions')
    .option('--limit <limit>', 'Limit results', '20')
    .option('--offset <offset>', 'Offset for pagination', '0')
    .action(async (options) => {
      await executeCommand(cmdTechniques, options);
    });
  addCommonOptions(techniquesCmd);

  // Technique command
  const techniqueCmd = program
    .command('technique')
    .description('Get details for a specific technique')
    .requiredOption('--id <id>', 'Technique ID (e.g., T1059.001)')
    .action(async (options) => {
      await executeCommand(cmdTechnique, options);
    });
  addCommonOptions(techniqueCmd);

  // Tactics command
  const tacticsCmd = program
    .command('tactics')
    .description('Get all tactics')
    .action(async (options) => {
      await executeCommand(cmdTactics, options);
    });
  addCommonOptions(tacticsCmd);

  // Groups command
  const groupsCmd = program
    .command('groups')
    .description('Get all threat groups')
    .action(async (options) => {
      await executeCommand(cmdGroups, options);
    });
  addCommonOptions(groupsCmd);

  // Group command
  const groupCmd = program
    .command('group')
    .description('Get techniques used by a threat group')
    .requiredOption('--name <name>', 'Group name (e.g., APT29)')
    .action(async (options) => {
      await executeCommand(cmdGroup, options);
    });
  addCommonOptions(groupCmd);

  // Software command
  const softwareCmd = program
    .command('software')
    .description('Get software (malware/tools)')
    .option('--malware', 'Include only malware')
    .option('--tools', 'Include only tools')
    .action(async (options) => {
      await executeCommand(cmdSoftware, options);
    });
  addCommonOptions(softwareCmd);

  // Mitigations command
  const mitigationsCmd = program
    .command('mitigations')
    .description('Get mitigations')
    .option('--name <name>', 'Get techniques mitigated by this mitigation')
    .action(async (options) => {
      await executeCommand(cmdMitigations, options);
    });
  addCommonOptions(mitigationsCmd);

  // Add examples to help
  program.addHelpText('after', `

Examples:
  # Get all tactics
  $ node mini-mcp-client.js tactics

  # Get techniques for initial-access tactic
  $ node mini-mcp-client.js techniques --tactic initial-access

  # Get details for a specific technique
  $ node mini-mcp-client.js technique --id T1059.001

  # Get techniques used by APT29
  $ node mini-mcp-client.js group --name APT29

  # Get all threat groups
  $ node mini-mcp-client.js groups

  # Get software (malware and tools)
  $ node mini-mcp-client.js software --malware

  # Get mitigations
  $ node mini-mcp-client.js mitigations

  # Get techniques mitigated by a specific mitigation
  $ node mini-mcp-client.js mitigations --name "Multi-factor Authentication"

Make sure the mitre-mcp server is running:
  mitre-mcp --http --port 8000
`);

  async function executeCommand(cmdFunc, cmdOptions) {
    const globalOptions = program.opts();
    const client = new MitreMCPClient(
      globalOptions.host,
      parseInt(globalOptions.port),
      globalOptions.debug
    );

    try {
      // Merge global and command options
      const options = { ...cmdOptions, ...globalOptions };
      const result = await cmdFunc(client, options);
      console.log(client.formatOutput(result, globalOptions.pretty));
    } catch (error) {
      console.error(`\n❌ Failed to execute command: ${error.message}`);
      process.exit(1);
    }
  }

  await program.parseAsync(process.argv);

  if (process.argv.length === 2) {
    program.help();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for use as a module
module.exports = { MitreMCPClient };
