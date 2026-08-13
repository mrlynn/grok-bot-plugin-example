import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { principalFromAuthInfo, type AuthPrincipal } from './auth.ts';
import {
  DEFAULT_ROOM,
  RegistryError,
  type RegistryStore,
} from './store.ts';

function textResult(payload: unknown, isError = false) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
    isError,
  };
}

function requirePrincipal(authInfo: AuthInfo | undefined): AuthPrincipal {
  const principal = principalFromAuthInfo(authInfo);
  if (!principal) {
    throw new RegistryError('unauthorized', 'Authenticated principal required');
  }
  return principal;
}

function requireOperator(principal: AuthPrincipal, action: string): void {
  if (principal.role !== 'operator') {
    throw new RegistryError(
      'forbidden',
      `${action} requires an operator token (role "operator" or list scope)`,
    );
  }
}

export function createRegistryMcpServer(store: RegistryStore, authInfo?: AuthInfo): McpServer {
  const server = new McpServer({
    name: 'grok-bot-registry',
    version: '1.2.0',
  });

  server.registerTool(
    'register_assistants',
    {
      title: 'Register assistants',
      description:
        'Update the authenticated user allowlist of approved assistants { id, name }[]. Default mode "replace" replaces the whole allowlist. Mode "merge" upserts the given assistants without removing others. Does not check them into a room.',
      inputSchema: z.object({
        assistants: z
          .array(
            z.object({
              id: z.string().min(1).describe('Stable assistant id'),
              name: z.string().min(1).describe('Display name'),
            }),
          )
          .describe('Assistants to register (replace = full allowlist; merge = upsert these)'),
        mode: z
          .enum(['replace', 'merge'])
          .optional()
          .describe('replace (default) or merge (upsert without wiping others)'),
      }),
    },
    async ({ assistants, mode }) => {
      try {
        const principal = requirePrincipal(authInfo);
        const result = store.registerAssistants(principal.userId, assistants, mode ?? 'replace');
        return textResult({
          ok: true,
          user_id: principal.userId,
          ...result,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'create_room',
    {
      title: 'Create room',
      description:
        'Operator-only. Create a room { id, type, title }. Types: general | game. Rooms are MCP common areas (not Slack / not Grok Bot chats).',
      inputSchema: z.object({
        id: z.string().min(1).describe('Stable room id'),
        type: z.enum(['general', 'game']).describe('general = assistants only; game = users + assistants'),
        title: z.string().min(1).describe('Human-readable title'),
      }),
    },
    async ({ id, type, title }) => {
      try {
        const principal = requirePrincipal(authInfo);
        requireOperator(principal, 'create_room');
        const room = store.createRoom({
          id,
          type,
          title,
          createdBy: principal.userId,
        });
        return textResult({
          ok: true,
          room,
          game: type === 'game' ? { status: 'stub', prizes: null, compensation: null } : null,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'list_rooms',
    {
      title: 'List rooms',
      description: 'List all rooms in the registry ({ id, type, title, created_by }).',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        requirePrincipal(authInfo);
        return textResult({ ok: true, ...store.listRooms() });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'check_in',
    {
      title: 'Check in to a room',
      description:
        'Check into a room (default: lobby). Assistants need assistant_id and must be allowlisted. Users may check in only to game rooms (participant_kind=user). General rooms are assistants-only.',
      inputSchema: z.object({
        room: z.string().min(1).optional().describe(`Room id; defaults to "${DEFAULT_ROOM}"`),
        participant_kind: z
          .enum(['user', 'assistant'])
          .optional()
          .describe('Defaults to assistant when assistant_id is used'),
        assistant_id: z
          .string()
          .min(1)
          .optional()
          .describe('Required for assistant participants'),
      }),
    },
    async ({ room, participant_kind, assistant_id }) => {
      try {
        const principal = requirePrincipal(authInfo);
        const kind = participant_kind ?? (assistant_id ? 'assistant' : undefined);
        const participant = store.checkIn({
          userId: principal.userId,
          roomId: room ?? DEFAULT_ROOM,
          participantKind: kind,
          assistantId: assistant_id,
        });
        return textResult({ ok: true, participant });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'check_out',
    {
      title: 'Check out of a room',
      description:
        'Remove this user or assistant from whatever room they are currently checked into.',
      inputSchema: z.object({
        participant_kind: z.enum(['user', 'assistant']).optional(),
        assistant_id: z
          .string()
          .min(1)
          .optional()
          .describe('Required when checking out an assistant'),
      }),
    },
    async ({ participant_kind, assistant_id }) => {
      try {
        const principal = requirePrincipal(authInfo);
        const kind = participant_kind ?? (assistant_id ? 'assistant' : undefined);
        const result = store.checkOut({
          userId: principal.userId,
          participantKind: kind,
          assistantId: assistant_id,
        });
        return textResult({
          ok: true,
          user_id: principal.userId,
          participant_kind: kind ?? 'assistant',
          assistant_id: assistant_id ?? null,
          ...result,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'list_registry',
    {
      title: 'List registry',
      description:
        'Operator-only. List every registered user and their approved assistants (and when they registered).',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const principal = requirePrincipal(authInfo);
        requireOperator(principal, 'list_registry');
        return textResult({ ok: true, ...store.listRegistry() });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'list_room',
    {
      title: 'List room presence',
      description: `List participants currently checked into a room (default: ${DEFAULT_ROOM}). Includes room record; game rooms also return stub game metadata (no prizes/payouts). Same listing as the /whos-here room slash command.`,
      inputSchema: z.object({
        room: z.string().min(1).optional().describe(`Room id; defaults to "${DEFAULT_ROOM}"`),
      }),
    },
    async ({ room }) => {
      try {
        requirePrincipal(authInfo);
        return textResult({ ok: true, ...store.listRoom(room ?? DEFAULT_ROOM) });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'post_message',
    {
      title: 'Post room message',
      description:
        'Post a message into a room log (default: lobby). Poster must already be checked into that room. Bodies starting with "/" are slash commands recorded in the log; /whos-here returns current presence (same as list_room). Not Slack.',
      inputSchema: z.object({
        room: z.string().min(1).optional().describe(`Room id; defaults to "${DEFAULT_ROOM}"`),
        participant_kind: z
          .enum(['user', 'assistant'])
          .optional()
          .describe('Defaults to assistant when assistant_id is used'),
        assistant_id: z
          .string()
          .min(1)
          .optional()
          .describe('Required when posting as an assistant'),
        body: z
          .string()
          .min(1)
          .describe('Message text, or a slash command such as /whos-here'),
      }),
    },
    async ({ room, participant_kind, assistant_id, body }) => {
      try {
        const principal = requirePrincipal(authInfo);
        const kind = participant_kind ?? (assistant_id ? 'assistant' : undefined);
        const result = store.postMessage({
          userId: principal.userId,
          roomId: room ?? DEFAULT_ROOM,
          participantKind: kind,
          assistantId: assistant_id,
          body,
        });
        if (result.command_error) {
          return textResult(
            {
              ok: false,
              error: result.command_error.code,
              message: result.command_error.message,
              posted: result.message,
            },
            true,
          );
        }
        return textResult({ ok: true, ...result });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'list_messages',
    {
      title: 'List room messages',
      description: `List the message log for a room (default: ${DEFAULT_ROOM}), including chat posts and recorded slash commands such as /whos-here.`,
      inputSchema: z.object({
        room: z.string().min(1).optional().describe(`Room id; defaults to "${DEFAULT_ROOM}"`),
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe('Max messages to return (default 100, max 500)'),
      }),
    },
    async ({ room, limit }) => {
      try {
        requirePrincipal(authInfo);
        return textResult({
          ok: true,
          ...store.listMessages({ roomId: room ?? DEFAULT_ROOM, limit }),
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  return server;
}

function toolError(error: unknown) {
  if (error instanceof RegistryError) {
    return textResult({ ok: false, error: error.code, message: error.message }, true);
  }
  const message = error instanceof Error ? error.message : String(error);
  return textResult({ ok: false, error: 'internal', message }, true);
}
