#!/usr/bin/env node
/**
 * Mini MCP Client - A Node.js client for interacting with mitre-mcp server via HTTP.
 *
 * Built on the official MCP TypeScript SDK (@modelcontextprotocol/client).
 * The SDK handles protocol-version negotiation, the initialize handshake,
 * SSE framing, the required Accept header, session-id propagation, and
 * per-request timeouts; this module only maps CLI commands to tools/call
 * invocations.
 *
 * Usage:
 *     node mini-mcp-client.js --help
 *     node mini-mcp-client.js techniques --tactic initial-access
 *     node mini-mcp-client.js technique --id T1059.001
 *     node mini-mcp-client.js group --name APT29
 *     node mini-mcp-client.js tactics
 *
 * Installation:
 *     npm install
 */

const { Command } = require('commander');
const { Client, StreamableHTTPClientTransport } = require('@modelcontextprotocol/client');

// Per-request timeout for tools/call (the SDK also applies its own default).
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Simple client for mitre-mcp server, built on the official MCP SDK.
 */
class MitreMCPClient {
  constructor(host = 'localhost', port = 8000, debug = false) {
    this.baseUrl = `http://${host}:${port}/mcp`;
    this.port = port;
    this.debug = debug;
    this.client = null;
    this.transport = null;
  }

  /**
   * Log debug message if debug mode is enabled.
   */
  log(message, data = null) {
    if (this.debug) {
      console.error(`🔍 Debug: ${message}`, data || '');
    }
  }

  /**
   * Initialize an MCP session with the server.
   *
   * The SDK transport performs protocol-version negotiation ('auto' probes
   * server/discover and falls back to the legacy initialize handshake),
   * sends notifications/initialized, and captures the session header
   * automatically.
   */
  async initializeSession() {
    this.log(`Initializing session against ${this.baseUrl} ...`);

    const transport = new StreamableHTTPClientTransport(new URL(this.baseUrl));
    const client = new Client(
      { name: 'mini-mcp-client-js', version: '1.0.0' },
      { versionNegotiation: { mode: 'auto' } }
    );
    await client.connect(transport);

    this.transport = transport;
    this.client = client;
    this.log('Session initialized', { sessionId: transport.sessionId || '(stateless)' });
  }

  /**
   * Whether an SDK error reports an expired/unknown session (HTTP 404).
   */
  isSessionExpiredError(error) {
    return (
      error?.status === 404 ||
      error?.code === 404 ||
      (typeof error?.message === 'string' && /session terminated/i.test(error.message))
    );
  }

  /**
   * Reset the client session — force a new session on the next request.
   */
  async resetSession() {
    const client = this.client;
    this.client = null;
    this.transport = null;
    if (client) {
      // Terminate the old session server-side if one exists
      await client.close().catch(() => {});
    }
  }

  /**
   * Call a mitre-mcp tool via the MCP SDK.
   *
   * @param {string} toolName - Name of the MCP tool to call
   * @param {Object} args - Tool arguments
   * @param {boolean} isRetry - Internal flag; true when this call is the
   *   single retry after an expired-session 404
   * @returns {Promise<{result: Object}>} Tool call result in the same
   *   `{ result: <CallToolResult> }` envelope the previous hand-rolled
   *   transport produced, so callers keep reading
   *   `result.result.structuredContent` / `result.result.isError`.
   */
  async callTool(toolName, args = {}, isRetry = false) {
    try {
      // Initialize session if not already done
      if (!this.client) {
        await this.initializeSession();
      }

      this.log(`Calling tool: ${toolName}`, args);

      const result = await this.client.callTool(
        { name: toolName, arguments: args },
        { timeout: REQUEST_TIMEOUT_MS }
      );
      this.log('Tool call completed', { isError: result.isError === true });
      return { result };
    } catch (error) {
      // HTTP 404 means the server forgot our session — clear it,
      // re-initialise, and retry exactly once
      if (!isRetry && this.isSessionExpiredError(error)) {
        this.log('Session expired (404), re-initialising and retrying once');
        await this.resetSession();
        await this.initializeSession();
        return this.callTool(toolName, args, true);
      }
      console.error(`❌ Error: ${error.message}`);
      console.error(`   Make sure mitre-mcp server is running: mitre-mcp --http --port ${this.port}`);
      throw error;
    }
  }

  /**
   * Close the client, terminating the server-side session if any.
   */
  async close() {
    await this.resetSession();
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
      // process.exit() below would skip finally, so close explicitly first
      await client.close().catch(() => {});
      process.exit(1);
    } finally {
      await client.close();
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
