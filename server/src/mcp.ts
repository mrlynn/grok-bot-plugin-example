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

function requireOperator(principal: AuthPrincipal): void {
  if (principal.role !== 'operator') {
    throw new RegistryError(
      'forbidden',
      'list_registry requires an operator token (role "operator" or list scope)',
    );
  }
}

export function createRegistryMcpServer(store: RegistryStore, authInfo?: AuthInfo): McpServer {
  const server = new McpServer({
    name: 'grok-bot-registry',
    version: '1.0.0',
  });

  server.registerTool(
    'register_assistants',
    {
      title: 'Register assistants',
      description:
        'Replace the authenticated user allowlist of approved assistants { id, name }[]. Does not check them into a room.',
      inputSchema: z.object({
        assistants: z
          .array(
            z.object({
              id: z.string().min(1).describe('Stable assistant id'),
              name: z.string().min(1).describe('Display name'),
            }),
          )
          .describe('Full replacement allowlist for this user'),
      }),
    },
    async ({ assistants }) => {
      try {
        const principal = requirePrincipal(authInfo);
        const result = store.registerAssistants(principal.userId, assistants);
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
    'check_in',
    {
      title: 'Check in to a room',
      description:
        'Check an allowlisted assistant into a room (default: lobby). Updates last_seen.',
      inputSchema: z.object({
        assistant_id: z.string().min(1),
        room: z.string().min(1).optional().describe(`Room id; defaults to "${DEFAULT_ROOM}"`),
      }),
    },
    async ({ assistant_id, room }) => {
      try {
        const principal = requirePrincipal(authInfo);
        const presence = store.checkIn(principal.userId, assistant_id, room ?? DEFAULT_ROOM);
        return textResult({ ok: true, presence });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'check_out',
    {
      title: 'Check out of a room',
      description: 'Remove an assistant from whatever room it is currently checked into.',
      inputSchema: z.object({
        assistant_id: z.string().min(1),
      }),
    },
    async ({ assistant_id }) => {
      try {
        const principal = requirePrincipal(authInfo);
        const result = store.checkOut(principal.userId, assistant_id);
        return textResult({
          ok: true,
          user_id: principal.userId,
          assistant_id,
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
        requireOperator(principal);
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
      description: `List assistants currently checked into a room (default: ${DEFAULT_ROOM}).`,
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

  return server;
}

function toolError(error: unknown) {
  if (error instanceof RegistryError) {
    return textResult({ ok: false, error: error.code, message: error.message }, true);
  }
  const message = error instanceof Error ? error.message : String(error);
  return textResult({ ok: false, error: 'internal', message }, true);
}
