'use strict';
/**
 * fake-concat-mcp — tiruan kecil `concat --mcp` (MCP stdio) untuk menguji
 * kra-concat-bridge dan workflow n100n tanpa binary Concat asli.
 *
 * Pakai:  CONCAT_BIN="node /path/fake-concat-mcp.js" tidak bisa (spawn satu
 * binary) — jalankan lewat wrapper: salin file ini, atau set
 *   CONCAT_BIN=node, dan beri argumen lewat env di bridge? Bridge selalu
 *   memanggil `<bin> --mcp <mode>`. Untuk uji lokal paling mudah:
 *
 *   # buat shim sekali pakai
 *   printf '#!/bin/sh\nexec node /path/fake-concat-mcp.js "$@"\n' > /tmp/fake-concat && chmod +x /tmp/fake-concat
 *   CONCAT_BIN=/tmp/fake-concat node tools/kra-concat-bridge/server.js
 *
 * File ini mengabaikan argumen CLI dan berbicara JSON-RPC baris-per-baris di
 * stdio persis seperti server MCP Concat (lihat docs/MCP.md di repo Concat).
 */

let buffer = '';
const projects = new Map();
let exportOutput = '';

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function toolResult(id, structured) {
  send({
    jsonrpc: '2.0',
    id,
    result: {
      isError: false,
      structuredContent: structured,
      content: [{ type: 'text', text: JSON.stringify(structured) }],
    },
  });
}

function toolError(id, message) {
  send({
    jsonrpc: '2.0',
    id,
    result: { isError: true, content: [{ type: 'text', text: message }] },
  });
}

const TOOLS = [
  'concat_version', 'project_create', 'project_save', 'media_import',
  'clips_add_sequence', 'title_add', 'captions_add', 'timeline_read',
  'export_start', 'export_status', 'export_wait',
];

function handle(message) {
  const { id, method, params } = message;
  if (method === 'initialize') {
    return send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'concat (fake for KRA tests)', version: '0.0.0' },
        instructions: 'Fake Concat MCP server used by KRA bridge tests.',
      },
    });
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return;
  if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
  if (method === 'tools/list') {
    return send({
      jsonrpc: '2.0', id,
      result: { tools: TOOLS.map((name) => ({ name, description: `fake ${name}`, inputSchema: { type: 'object' } })) },
    });
  }
  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments || {};
    switch (name) {
      case 'concat_version':
        return toolResult(id, { version: '0.0.0-fake', mcp: { mode: 'headless' } });
      case 'project_create': {
        if (!args.location || !args.name) return toolError(id, 'location and name are required');
        const path = `${String(args.location).replace(/\/+$/, '')}/${args.name}`;
        projects.set(path, { name: args.name, clips: [] });
        return toolResult(id, { project: { name: args.name, path, video: args.video || null } });
      }
      case 'media_import':
        if (!projects.has(args.path)) return toolError(id, `project not open: ${args.path}`);
        return toolResult(id, { media: { id: 'm1', file: args.file } });
      case 'clips_add_sequence':
        return toolResult(id, { createdIds: (args.mediaIds || []).map((_, i) => `c${i + 1}`) });
      case 'title_add':
        return toolResult(id, { createdId: 't1' });
      case 'captions_add':
        return toolResult(id, { canUndo: true, added: (args.captions || []).length });
      case 'timeline_read':
        return toolResult(id, { timeline: { clips: [{ id: 'c1' }, { id: 't1' }] } });
      case 'project_save':
        return toolResult(id, { saved: true, path: args.path });
      case 'export_start':
        exportOutput = args.output || '';
        return toolResult(id, { job: 'j1' });
      case 'export_status':
        return toolResult(id, { state: 'done', output: exportOutput });
      case 'export_wait': {
        const token = params?._meta?.progressToken;
        if (token) {
          send({ jsonrpc: '2.0', method: 'notifications/progress', params: { progressToken: token, progress: 0.5, total: 1 } });
        }
        return toolResult(id, { state: 'done', output: exportOutput });
      }
      default:
        return send({ jsonrpc: '2.0', id, error: { code: -32602, message: `unknown tool: ${name}` } });
    }
  }
  if (id !== undefined) {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `unknown method: ${method}` } });
  }
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); } catch (error) { console.error('[fake-concat]', error.message); }
  }
});
process.stdin.on('end', () => process.exit(0));
