# Troubleshooting MCP HTTP Integration

This document explains common issues when integrating with the mitre-mcp HTTP server and their solutions.

## Issue: 406 Not Acceptable Error

### Symptom

```
❌ HTTP Error: Client error '406 Not Acceptable' for url 'http://localhost:8090/mcp'
```

Server responds with:
```json
{
  "jsonrpc": "2.0",
  "id": "server-error",
  "error": {
    "code": -32600,
    "message": "Not Acceptable: Client must accept both application/json and text/event-stream"
  }
}
```

### Root Cause

The MCP HTTP server (using the streamable HTTP transport) requires the client to accept **both** MIME types:
- `application/json` - for JSON-RPC responses
- `text/event-stream` - for Server-Sent Events (SSE) support

This is a requirement of the MCP protocol's HTTP transport implementation, which supports both synchronous JSON-RPC responses and asynchronous streaming notifications.

### Solution

Include both MIME types in the `Accept` header:

```python
headers = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
}
```

### Correct Implementation

**❌ WRONG - Will fail with 406:**
```python
async with httpx.AsyncClient() as client:
    response = await client.post(
        "http://localhost:8000/mcp",
        json=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json"  # Missing text/event-stream
        }
    )
```

**✅ CORRECT:**
```python
async with httpx.AsyncClient() as client:
    response = await client.post(
        "http://localhost:8000/mcp",
        json=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream"  # Both types
        }
    )
```

## Why Both MIME Types?

The MCP protocol's streamable HTTP transport is designed to support:

1. **Synchronous Operations** (JSON-RPC)
   - Tool calls that return immediately
   - Response format: `application/json`

2. **Asynchronous Operations** (SSE)
   - Long-running operations
   - Progress notifications
   - Server-initiated messages
   - Response format: `text/event-stream`

By requiring both in the Accept header, the server ensures the client can handle both types of responses.

## Diagnostic Process

To diagnose MCP HTTP connection issues:

1. **Use the diagnostic script:**
   ```bash
   python test-mcp-connection.py localhost 8000
   ```

2. **Enable debug mode in the client:**
   ```bash
   python mini-mcp-client.py --debug --host localhost --port 8000 tactics
   ```

3. **Check the server logs:**
   ```bash
   # Start server with debug logging
   MITRE_LOG_LEVEL=DEBUG mitre-mcp --http --port 8000
   ```

## Other Common Issues

### 404 Not Found

**Symptom:** `GET /` returns 404

**Cause:** The MCP server only exposes the `/mcp` endpoint, not the root path.

**Solution:** Always use the `/mcp` endpoint for JSON-RPC calls.

### Connection Refused

**Symptom:** `ConnectError: [Errno 61] Connection refused`

**Cause:** Server is not running or is on a different port.

**Solution:**
1. Start the server: `mitre-mcp --http --port 8000`
2. Verify port matches your client configuration
3. Check firewall settings

### Timeout

**Symptom:** `TimeoutException`

**Cause:**
- Server is downloading data (first run)
- Network latency
- Server is processing a large request

**Solution:**
1. Wait for initial data download (check server logs)
2. Increase client timeout
3. Use pagination for large queries (`--limit`, `--offset`)

## MCP HTTP Protocol Reference

The MCP HTTP transport uses:
- **Endpoint:** `/mcp`
- **Method:** `POST`
- **Protocol:** JSON-RPC 2.0
- **Content-Type:** `application/json`
- **Accept:** `application/json, text/event-stream` (both required)

**Session Management:**
- Server assigns session IDs (visible in `mcp-session-id` header)
- Sessions are maintained per connection
- No manual session management needed for simple clients

## Testing Your Integration

### Minimal Test

```python
import httpx
import asyncio

async def test_mcp():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/mcp",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": "get_tactics",
                    "arguments": {"domain": "enterprise-attack"}
                }
            },
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream"
            }
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

asyncio.run(test_mcp())
```

### Expected Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "[JSON data with tactics]"
      }
    ]
  }
}
```

## Resources

- **MCP Specification:** https://spec.modelcontextprotocol.io/
- **mitre-mcp Server Code:** `mitre_mcp/mitre_mcp_server.py`
- **Diagnostic Script:** `test-mcp-connection.py`
- **Working Client:** `mini-mcp-client.py`

## Summary

The key takeaway: **Always include both `application/json` and `text/event-stream` in the Accept header** when making HTTP requests to an MCP server using streamable HTTP transport.

This requirement is part of the MCP protocol specification and ensures clients can handle both synchronous and asynchronous responses.
