import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createAuthMiddleware, loadTokenMap } from './auth.ts';
import { createRegistryMcpServer } from './mcp.ts';
import { RegistryStore } from './store.ts';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const DB_PATH = process.env.REGISTRY_DB_PATH ?? './data/registry.sqlite';

const tokenMap = loadTokenMap();
const sharedToken = process.env.REGISTRY_TOKEN?.trim() || undefined;

if (tokenMap.size === 0 && !sharedToken) {
  console.error(
    'Set REGISTRY_TOKENS (preferred JSON map) and/or REGISTRY_TOKEN (shared + X-Grok-User) before starting.',
  );
  process.exit(1);
}

const store = new RegistryStore(DB_PATH);

const mcpHandler = createMcpHandler(
  (ctx) => createRegistryMcpServer(store, ctx.authInfo),
  {
    // Keep 2025-era clients working for Inspector / simple curl smoke tests.
    legacy: 'stateless',
  },
);

const app = createMcpExpressApp({
  host: HOST,
  // When binding beyond localhost, pass explicit hosts via ALLOWED_HOSTS.
  allowedHosts: parseCsv(process.env.ALLOWED_HOSTS),
  allowedOrigins: parseCsv(process.env.ALLOWED_ORIGINS),
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'grok-bot-registry' });
});

app.use(
  '/mcp',
  createAuthMiddleware({
    tokenMap,
    sharedToken,
  }),
);

app.all('/mcp', (req, res) => {
  const nodeHandler = toNodeHandler(mcpHandler);
  return nodeHandler(req, res, req.body);
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Grok Bot registry MCP listening on http://${HOST}:${PORT}/mcp`);
  console.log(`SQLite: ${DB_PATH}`);
  console.log(
    tokenMap.size > 0
      ? `Auth: REGISTRY_TOKENS map (${tokenMap.size} token(s))`
      : 'Auth: shared REGISTRY_TOKEN + X-Grok-User (forgeable; prefer REGISTRY_TOKENS)',
  );
});

function shutdown() {
  server.close(() => {
    store.close();
    void mcpHandler.close().finally(() => process.exit(0));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function parseCsv(value: string | undefined): string[] | undefined {
  if (!value?.trim()) return undefined;
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
