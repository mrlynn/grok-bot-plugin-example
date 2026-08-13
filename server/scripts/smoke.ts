/**
 * Local smoke:
 * 1) fresh user (no check-in) /rooms → at least lobby
 * 2) first-run welcome path: register one → check_in lobby → hello → /whos-here
 * 3) /join lobby → presence + hello + listing; /leave lobby → removed
 * 4) /who alias: same participants as /whos-here; unknown errors; no check-in errors
 * 5) two users register + assistant check_in to lobby; list_room shows both
 * 6) operator create_room(game); user + assistant participants; /rooms + list_rooms include both
 *
 * Usage (from server/):
 *   npm run smoke
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
    // Brand-new install: /rooms with no prior check-in / register
    await runRoomsSlashPath(TOKENS.alice, { expectIds: ['lobby'] });

    await runFirstRunWelcomePath('alice', TOKENS.alice, {
      id: 'alice-helper',
      name: 'Alice Helper',
    });

    // Clear alice helper presence so /join can re-check-in cleanly
    await callTool(TOKENS.alice, 'check_out', { assistant_id: 'alice-helper' });
    await runJoinLeaveSlashPath('alice', TOKENS.alice, {
      id: 'alice-helper',
      name: 'Alice Helper',
    });

    await runWhoAliasSlashPath('alice', TOKENS.alice, {
      id: 'alice-helper',
      name: 'Alice Helper',
    });

    await runAsUser('bob', TOKENS.bob, [{ id: 'bob-helper', name: 'Bob Helper' }]);
    // Re-join alice so lobby still has both owners for the cross-user assertion
    await callTool(TOKENS.alice, 'register_assistants', {
      assistants: [{ id: 'alice-helper', name: 'Alice Helper' }],
      mode: 'merge',
    });
    await callTool(TOKENS.alice, 'check_in', { assistant_id: 'alice-helper' });

    const lobby = await callTool(TOKENS.ops, 'list_room', {});
    const lobbyParticipants =
      (lobby as { participants?: Array<{ user_id: string; participant_kind: string }> })
        .participants ?? [];
    const lobbyUserIds = new Set(
      lobbyParticipants
        .filter((p) => p.participant_kind === 'assistant')
        .map((p) => p.user_id),
    );

    console.log('list_room lobby:', JSON.stringify(lobby, null, 2));

    if (!lobbyUserIds.has('alice') || !lobbyUserIds.has('bob')) {
      throw new Error(
        `Expected assistant owners alice and bob in lobby; got: ${[...lobbyUserIds].join(', ') || '(none)'}`,
      );
    }

    const roomsBefore = await callTool(TOKENS.ops, 'list_rooms', {});
    console.log('list_rooms:', JSON.stringify(roomsBefore, null, 2));
    const roomIds = new Set(
      ((roomsBefore as { rooms?: Array<{ id: string }> }).rooms ?? []).map((r) => r.id),
    );
    if (!roomIds.has('lobby')) {
      throw new Error('Expected default lobby room from boot');
    }

    const created = await callTool(TOKENS.ops, 'create_room', {
      id: 'arena-1',
      type: 'game',
      title: 'Arena One',
    });
    console.log('create_room:', JSON.stringify(created, null, 2));

    // After create_room: /rooms (still no need for presence) includes lobby + game room
    await runRoomsSlashPath(TOKENS.bob, {
      expectIds: ['lobby', 'arena-1'],
      alsoAlias: true,
    });

    // Game rooms: user participant (alice) + assistant participant (bob's helper)
    await callTool(TOKENS.alice, 'check_in', {
      room: 'arena-1',
      participant_kind: 'user',
    });
    await callTool(TOKENS.bob, 'check_in', {
      room: 'arena-1',
      assistant_id: 'bob-helper',
    });

    const arena = await callTool(TOKENS.ops, 'list_room', { room: 'arena-1' });
    console.log('list_room arena-1:', JSON.stringify(arena, null, 2));
    const kinds = new Set(
      ((arena as { participants?: Array<{ participant_kind: string }> }).participants ?? []).map(
        (p) => p.participant_kind,
      ),
    );
    if (!kinds.has('user') || !kinds.has('assistant')) {
      throw new Error(`Expected user and assistant participants in game room; got: ${[...kinds]}`);
    }
    const game = (arena as { game?: { status?: string } }).game;
    if (game?.status !== 'stub') {
      throw new Error(`Expected game metadata stub, got: ${JSON.stringify(game)}`);
    }

    // General rooms reject user participants
    const rejected = await callToolRaw(TOKENS.alice, 'check_in', {
      room: 'lobby',
      participant_kind: 'user',
    });
    if (!rejected.isError) {
      throw new Error('Expected user check_in to general lobby to fail');
    }

    const registry = await callTool(TOKENS.ops, 'list_registry', {});
    console.log('list_registry:', JSON.stringify(registry, null, 2));

    console.log(
      'SMOKE OK: /rooms + first-run welcome + /join|/leave + /who alias + lobby + game room',
    );
  } finally {
    if (child?.pid) {
      child.kill('SIGTERM');
    }
  }
}

/**
 * Fresh install: /rooms with no check-in. Expects command_result.rooms to include
 * every id in expectIds (at least lobby). Optionally also try /list-rooms alias.
 */
async function runRoomsSlashPath(
  token: string,
  opts: { expectIds: string[]; alsoAlias?: boolean },
): Promise<void> {
  const roomsResult = await callTool(token, 'post_message', { body: '/rooms' });
  assertRoomsCommandResult(roomsResult, opts.expectIds, '/rooms');

  if (opts.alsoAlias) {
    const aliasResult = await callTool(token, 'post_message', { body: '/list-rooms' });
    assertRoomsCommandResult(aliasResult, opts.expectIds, '/list-rooms');
  }

  console.log(`rooms slash OK (expect ${opts.expectIds.join(', ')})`);
}

function assertRoomsCommandResult(
  payload: unknown,
  expectIds: string[],
  label: string,
): void {
  const result = payload as {
    message?: unknown;
    command_result?: {
      command?: string;
      rooms?: Array<{ id: string; type?: string; title?: string; created_by?: string }>;
      participants?: unknown;
    };
  };
  if (result.message != null) {
    throw new Error(`Expected ${label} not to write a room log message; got: ${JSON.stringify(payload)}`);
  }
  if (result.command_result?.command !== 'rooms') {
    throw new Error(`Expected ${label} command_result.command=rooms; got: ${JSON.stringify(payload)}`);
  }
  if (result.command_result.participants !== undefined) {
    throw new Error(`Expected ${label} not to dump participants/roster; got: ${JSON.stringify(payload)}`);
  }
  const rooms = result.command_result.rooms ?? [];
  const ids = new Set(rooms.map((r) => r.id));
  for (const id of expectIds) {
    if (!ids.has(id)) {
      throw new Error(`Expected ${label} to include room "${id}"; got: ${JSON.stringify(rooms)}`);
    }
  }
  const lobby = rooms.find((r) => r.id === 'lobby');
  if (lobby && (lobby.type !== 'general' || !lobby.title)) {
    throw new Error(`Expected lobby type/title on ${label}; got: ${JSON.stringify(lobby)}`);
  }
}

/**
 * Mirrors skills/welcome-to-lobby: register one (merge if needed) → check_in lobby
 * → post hello → /whos-here → assert presence + message log.
 */
async function runFirstRunWelcomePath(
  userId: string,
  token: string,
  assistant: { id: string; name: string },
): Promise<void> {
  await callTool(token, 'register_assistants', {
    assistants: [assistant],
    mode: 'merge',
  });
  await callTool(token, 'check_in', { assistant_id: assistant.id });

  const helloBody = `Hello, ${assistant.name} here.`;
  const hello = await callTool(token, 'post_message', {
    assistant_id: assistant.id,
    body: helloBody,
  });
  const helloMessage = (hello as { message?: { body?: string; kind?: string } }).message;
  if (helloMessage?.body !== helloBody || helloMessage?.kind !== 'message') {
    throw new Error(`Expected hello message post; got: ${JSON.stringify(hello)}`);
  }

  const whosHere = await callTool(token, 'post_message', {
    assistant_id: assistant.id,
    body: '/whos-here',
  });
  const command = (whosHere as {
    message?: { kind?: string; command?: string; body?: string };
    command_result?: {
      command?: string;
      participants?: Array<{ user_id: string; assistant_id: string | null; display_name: string }>;
    };
  }).message;
  const commandResult = (whosHere as {
    command_result?: {
      command?: string;
      participants?: Array<{ user_id: string; assistant_id: string | null; display_name: string }>;
    };
  }).command_result;

  if (command?.kind !== 'command' || command?.command !== 'whos-here') {
    throw new Error(`Expected /whos-here recorded as command; got: ${JSON.stringify(whosHere)}`);
  }
  if (commandResult?.command !== 'whos-here') {
    throw new Error(`Expected /whos-here command_result; got: ${JSON.stringify(whosHere)}`);
  }
  const present = (commandResult.participants ?? []).some(
    (p) => p.user_id === userId && p.assistant_id === assistant.id,
  );
  if (!present) {
    throw new Error(
      `Expected ${userId}/${assistant.id} in /whos-here listing; got: ${JSON.stringify(commandResult.participants)}`,
    );
  }

  const messages = await callTool(token, 'list_messages', { room: 'lobby' });
  const bodies = new Set(
    ((messages as { messages?: Array<{ body: string; kind: string }> }).messages ?? []).map(
      (m) => `${m.kind}:${m.body}`,
    ),
  );
  if (!bodies.has(`message:${helloBody}`)) {
    throw new Error(`Expected hello in list_messages; got: ${JSON.stringify(messages)}`);
  }
  if (!bodies.has('command:/whos-here')) {
    throw new Error(`Expected /whos-here in list_messages; got: ${JSON.stringify(messages)}`);
  }

  console.log(`first-run welcome OK for ${userId}/${assistant.id}`);
}

/**
 * Mirrors skills/rooms-slash-commands: merge-register → /join lobby → assert
 * presence + hello + listing; /leave lobby → assert checked out + goodbye.
 */
async function runJoinLeaveSlashPath(
  userId: string,
  token: string,
  assistant: { id: string; name: string },
): Promise<void> {
  await callTool(token, 'register_assistants', {
    assistants: [assistant],
    mode: 'merge',
  });

  const join = await callTool(token, 'post_message', {
    assistant_id: assistant.id,
    body: '/join lobby',
  });
  const joinPayload = join as {
    message?: { kind?: string; command?: string; body?: string };
    command_result?: {
      command?: string;
      hello?: { body?: string; kind?: string };
      participants?: Array<{ user_id: string; assistant_id: string | null }>;
    };
  };
  if (joinPayload.message?.kind !== 'command' || joinPayload.message?.command !== 'join') {
    throw new Error(`Expected /join recorded as command; got: ${JSON.stringify(join)}`);
  }
  if (joinPayload.command_result?.command !== 'join') {
    throw new Error(`Expected /join command_result; got: ${JSON.stringify(join)}`);
  }
  const helloBody = `Hello, ${assistant.name} here.`;
  if (joinPayload.command_result.hello?.body !== helloBody) {
    throw new Error(`Expected auto hello from /join; got: ${JSON.stringify(join)}`);
  }
  const joined = (joinPayload.command_result.participants ?? []).some(
    (p) => p.user_id === userId && p.assistant_id === assistant.id,
  );
  if (!joined) {
    throw new Error(
      `Expected ${userId}/${assistant.id} in /join listing; got: ${JSON.stringify(joinPayload.command_result.participants)}`,
    );
  }

  const lobbyAfterJoin = await callTool(token, 'list_room', { room: 'lobby' });
  const presentAfterJoin = (
    (lobbyAfterJoin as { participants?: Array<{ user_id: string; assistant_id: string | null }> })
      .participants ?? []
  ).some((p) => p.user_id === userId && p.assistant_id === assistant.id);
  if (!presentAfterJoin) {
    throw new Error(`Expected list_room lobby to include ${userId}/${assistant.id} after /join`);
  }

  const leave = await callTool(token, 'post_message', {
    assistant_id: assistant.id,
    body: '/leave lobby',
  });
  const leavePayload = leave as {
    message?: { kind?: string; command?: string };
    command_result?: {
      command?: string;
      checked_out?: boolean;
      goodbye?: { body?: string; kind?: string };
      participants?: unknown;
    };
  };
  if (leavePayload.message?.kind !== 'command' || leavePayload.message?.command !== 'leave') {
    throw new Error(`Expected /leave recorded as command; got: ${JSON.stringify(leave)}`);
  }
  if (
    leavePayload.command_result?.command !== 'leave' ||
    leavePayload.command_result.checked_out !== true
  ) {
    throw new Error(`Expected /leave checked_out; got: ${JSON.stringify(leave)}`);
  }
  if (leavePayload.command_result.participants !== undefined) {
    throw new Error(`Expected /leave not to dump participants; got: ${JSON.stringify(leave)}`);
  }
  const goodbyeBody = `Goodbye, ${assistant.name} leaving.`;
  if (leavePayload.command_result.goodbye?.body !== goodbyeBody) {
    throw new Error(`Expected goodbye from /leave; got: ${JSON.stringify(leave)}`);
  }

  const lobbyAfterLeave = await callTool(token, 'list_room', { room: 'lobby' });
  const stillPresent = (
    (lobbyAfterLeave as { participants?: Array<{ user_id: string; assistant_id: string | null }> })
      .participants ?? []
  ).some((p) => p.user_id === userId && p.assistant_id === assistant.id);
  if (stillPresent) {
    throw new Error(`Expected ${userId}/${assistant.id} gone from lobby after /leave`);
  }

  const missingRoom = await callToolRaw(token, 'post_message', {
    assistant_id: assistant.id,
    body: '/join no-such-room',
  });
  if (!missingRoom.isError) {
    throw new Error('Expected /join no-such-room to fail');
  }

  console.log(`join/leave slash OK for ${userId}/${assistant.id}`);
}

type PresenceParticipant = {
  user_id: string;
  assistant_id: string | null;
  display_name: string;
};

function participantKey(p: PresenceParticipant): string {
  return `${p.user_id}\0${p.assistant_id ?? ''}\0${p.display_name}`;
}

function assertSameParticipants(
  left: PresenceParticipant[],
  right: PresenceParticipant[],
  label: string,
): void {
  const leftKeys = [...left.map(participantKey)].sort();
  const rightKeys = [...right.map(participantKey)].sort();
  if (leftKeys.length !== rightKeys.length || leftKeys.some((k, i) => k !== rightKeys[i])) {
    throw new Error(
      `Expected ${label} participants to match; left=${JSON.stringify(left)} right=${JSON.stringify(right)}`,
    );
  }
}

/**
 * /who is a hard alias of /whos-here: same presence listing when checked in;
 * unknown commands still error; no check-in still errors like /whos-here.
 */
async function runWhoAliasSlashPath(
  userId: string,
  token: string,
  assistant: { id: string; name: string },
): Promise<void> {
  await callTool(token, 'register_assistants', {
    assistants: [assistant],
    mode: 'merge',
  });
  await callTool(token, 'check_in', { assistant_id: assistant.id });

  const whosHere = await callTool(token, 'post_message', {
    assistant_id: assistant.id,
    body: '/whos-here',
  });
  const who = await callTool(token, 'post_message', {
    assistant_id: assistant.id,
    body: '/who',
  });

  const whosHerePayload = whosHere as {
    message?: { kind?: string; command?: string; body?: string };
    command_result?: { command?: string; participants?: PresenceParticipant[] };
  };
  const whoPayload = who as {
    message?: { kind?: string; command?: string; body?: string };
    command_result?: { command?: string; participants?: PresenceParticipant[] };
  };

  if (whosHerePayload.message?.kind !== 'command' || whosHerePayload.message.command !== 'whos-here') {
    throw new Error(`Expected /whos-here recorded as command; got: ${JSON.stringify(whosHere)}`);
  }
  if (whoPayload.message?.kind !== 'command' || whoPayload.message.command !== 'who') {
    throw new Error(`Expected /who recorded as command "who"; got: ${JSON.stringify(who)}`);
  }
  // Canonical command_result name (same pattern as /list-rooms → rooms)
  if (whosHerePayload.command_result?.command !== 'whos-here') {
    throw new Error(`Expected /whos-here command_result; got: ${JSON.stringify(whosHere)}`);
  }
  if (whoPayload.command_result?.command !== 'whos-here') {
    throw new Error(
      `Expected /who command_result.command=whos-here (canonical); got: ${JSON.stringify(who)}`,
    );
  }

  const whosHereParticipants = whosHerePayload.command_result.participants ?? [];
  const whoParticipants = whoPayload.command_result.participants ?? [];
  assertSameParticipants(whosHereParticipants, whoParticipants, '/who vs /whos-here');

  const selfPresent = whoParticipants.some(
    (p) => p.user_id === userId && p.assistant_id === assistant.id,
  );
  if (!selfPresent) {
    throw new Error(
      `Expected ${userId}/${assistant.id} in /who listing; got: ${JSON.stringify(whoParticipants)}`,
    );
  }

  const messages = await callTool(token, 'list_messages', { room: 'lobby' });
  const bodies = new Set(
    ((messages as { messages?: Array<{ body: string; kind: string }> }).messages ?? []).map(
      (m) => `${m.kind}:${m.body}`,
    ),
  );
  if (!bodies.has('command:/who')) {
    throw new Error(`Expected /who in list_messages; got: ${JSON.stringify(messages)}`);
  }

  const unknown = await callToolRaw(token, 'post_message', {
    assistant_id: assistant.id,
    body: '/say hi',
  });
  if (!unknown.isError) {
    throw new Error('Expected unknown /say to error');
  }
  const unknownPayload = unknown.payload as { error?: string; message?: string };
  if (unknownPayload.error !== 'unknown_command') {
    throw new Error(`Expected unknown_command for /say; got: ${JSON.stringify(unknown.payload)}`);
  }

  await callTool(token, 'check_out', { assistant_id: assistant.id });

  const whoWithoutCheckIn = await callToolRaw(token, 'post_message', {
    assistant_id: assistant.id,
    body: '/who',
  });
  const whosHereWithoutCheckIn = await callToolRaw(token, 'post_message', {
    assistant_id: assistant.id,
    body: '/whos-here',
  });
  if (!whoWithoutCheckIn.isError || !whosHereWithoutCheckIn.isError) {
    throw new Error('Expected /who and /whos-here without check-in to error');
  }
  const whoErr = whoWithoutCheckIn.payload as { error?: string };
  const whosHereErr = whosHereWithoutCheckIn.payload as { error?: string };
  if (whoErr.error !== whosHereErr.error) {
    throw new Error(
      `Expected /who and /whos-here no-check-in errors to match; /who=${JSON.stringify(whoWithoutCheckIn.payload)} /whos-here=${JSON.stringify(whosHereWithoutCheckIn.payload)}`,
    );
  }
  if (whoErr.error !== 'not_in_room') {
    throw new Error(
      `Expected not_in_room without check-in; got: ${JSON.stringify(whoWithoutCheckIn.payload)}`,
    );
  }

  console.log(`who alias slash OK for ${userId}/${assistant.id}`);
}

async function runAsUser(
  userId: string,
  token: string,
  assistants: Array<{ id: string; name: string }>,
): Promise<void> {
  await callTool(token, 'register_assistants', { assistants });
  await callTool(token, 'check_in', { assistant_id: assistants[0].id });
  console.log(`checked in ${userId}/${assistants[0].id} -> lobby`);
}

async function callTool(
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await callToolRaw(token, name, args);
  if (result.isError) {
    throw new Error(`Tool ${name} returned error: ${JSON.stringify(result.payload)}`);
  }
  return result.payload;
}

async function callToolRaw(
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ isError: boolean; payload: unknown }> {
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
    const text = result.content?.find((c) => c.type === 'text');
    const payload =
      text && text.type === 'text'
        ? JSON.parse(text.text)
        : (result.structuredContent ?? result);
    return { isError: Boolean(result.isError), payload };
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
