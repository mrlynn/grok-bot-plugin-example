/**
 * Local smoke: two users register + check_in; list_room shows both user ids.
 *
 * Usage (from server/):
 *   npm start   # terminal 1
 *   npm run smoke
 *
 * Or let this script spawn the server itself:
 *   SMOKE_SPAWN=1 npm run smoke
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8787';
const TOKENS = {
  alice: 'smoke-alice-token',
  bob: 'smoke-bob-token',
  ops: 'smoke-ops-token',
};

async function main(): Promise<void> {
  let child: ChildProcess | undefined;
  if (process.env.SMOKE_SPAWN === '1') {
    child = spawnServer();
    await waitForHealth(`${BASE}/healthz`);
  }

  try {
    await runAsUser('alice', TOKENS.alice, [
      { id: 'alice-helper', name: 'Alice Helper' },
    ]);
    await runAsUser('bob', TOKENS.bob, [{ id: 'bob-helper', name: 'Bob Helper' }]);

    const room = await callTool(TOKENS.ops, 'list_room', {});
    const present = (room as { present?: Array<{ user_id: string }> }).present ?? [];
    const userIds = new Set(present.map((p) => p.user_id));

    console.log('list_room present:', JSON.stringify(present, null, 2));

    if (!userIds.has('alice') || !userIds.has('bob')) {
      throw new Error(
        `Expected user ids alice and bob in lobby; got: ${[...userIds].join(', ') || '(none)'}`,
      );
    }

    const registry = await callTool(TOKENS.ops, 'list_registry', {});
    console.log('list_registry:', JSON.stringify(registry, null, 2));

    console.log('SMOKE OK: lobby contains alice and bob');
  } finally {
    if (child?.pid) {
      child.kill('SIGTERM');
    }
  }
}

async function runAsUser(
  userId: string,
  token: string,
  assistants: Array<{ id: string; name: string }>,
): Promise<void> {
  await callTool(token, 'register_assistants', { assistants });
  await callTool(token, 'check_in', { assistant_id: assistants[0].id });
  console.log(`checked in ${userId}/${assistants[0].id}`);
}

async function callTool(
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  const client = new Client({ name: 'registry-smoke', version: '1.0.0' });
  try {
    await client.connect(transport);
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) {
      throw new Error(`Tool ${name} returned error: ${JSON.stringify(result)}`);
    }
    const text = result.content?.find((c) => c.type === 'text');
    if (text && text.type === 'text') {
      return JSON.parse(text.text);
    }
    return result.structuredContent ?? result;
  } finally {
    await client.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
  }
}

function spawnServer(): ChildProcess {
  const tokens = JSON.stringify({
    [TOKENS.alice]: { userId: 'alice', role: 'user' },
    [TOKENS.bob]: { userId: 'bob', role: 'user' },
    [TOKENS.ops]: { userId: 'operator', role: 'operator' },
  });
  const serverRoot = fileURLToPath(new URL('..', import.meta.url));
  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', 'src/index.ts'],
    {
      cwd: serverRoot,
      env: {
        ...process.env,
        PORT: '8787',
        HOST: '127.0.0.1',
        REGISTRY_DB_PATH: ':memory:',
        REGISTRY_TOKENS: tokens,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout?.on('data', (chunk) => process.stdout.write(`[server] ${chunk}`));
  child.stderr?.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));
  child.on('exit', (code, signal) => {
    if (code && code !== 0) {
      console.error(`server exited code=${code} signal=${signal}`);
    }
  });
  return child;
}

async function waitForHealth(url: string, attempts = 40): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(150);
  }
  throw new Error(`Server did not become healthy at ${url}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
