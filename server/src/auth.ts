import type { AuthInfo } from '@modelcontextprotocol/server';
import type { Request, Response, NextFunction } from 'express';

export type RegistryRole = 'user' | 'operator';

export type TokenEntry = {
  userId: string;
  role: RegistryRole;
};

export type AuthPrincipal = {
  userId: string;
  role: RegistryRole;
  token: string;
};

/**
 * Auth for v1:
 * - Preferred: REGISTRY_TOKENS JSON map binding bearer token -> { userId, role }.
 * - Fallback: single REGISTRY_TOKEN plus X-Grok-User header (forgeable; document the limit).
 */
export function loadTokenMap(env: NodeJS.ProcessEnv = process.env): Map<string, TokenEntry> {
  const map = new Map<string, TokenEntry>();
  const raw = env.REGISTRY_TOKENS?.trim();
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('REGISTRY_TOKENS must be valid JSON');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('REGISTRY_TOKENS must be a JSON object map of token -> { userId, role }');
    }
    for (const [token, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!token) continue;
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`REGISTRY_TOKENS entry for "${token}" must be an object`);
      }
      const entry = value as { userId?: unknown; role?: unknown };
      if (typeof entry.userId !== 'string' || !entry.userId.trim()) {
        throw new Error(`REGISTRY_TOKENS entry for "${token}" needs a non-empty string userId`);
      }
      const role = entry.role === 'operator' ? 'operator' : entry.role === 'user' ? 'user' : null;
      if (!role) {
        throw new Error(`REGISTRY_TOKENS entry for "${token}" role must be "user" or "operator"`);
      }
      map.set(token, { userId: entry.userId.trim(), role });
    }
  }
  return map;
}

export function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || null;
}

export function resolvePrincipal(opts: {
  authorization?: string;
  grokUserHeader?: string;
  tokenMap: Map<string, TokenEntry>;
  sharedToken?: string;
}): AuthPrincipal | null {
  const token = extractBearerToken(opts.authorization);
  if (!token) return null;

  const mapped = opts.tokenMap.get(token);
  if (mapped) {
    return { userId: mapped.userId, role: mapped.role, token };
  }

  const shared = opts.sharedToken?.trim();
  if (shared && token === shared) {
    const userId = opts.grokUserHeader?.trim();
    if (!userId) return null;
    // Shared-token mode: any caller can claim any user id (documented forgeability).
    // Treat ids ending in ":operator" or header role is not used; role stays user unless
    // X-Grok-Role: operator is present — keep simple: shared token + X-Grok-User is user,
    // shared token + X-Grok-User + X-Grok-Role: operator is operator.
    return { userId, role: 'user', token };
  }

  return null;
}

export function toAuthInfo(principal: AuthPrincipal): AuthInfo {
  const scopes = principal.role === 'operator' ? ['registry', 'list'] : ['registry'];
  return {
    token: principal.token,
    clientId: principal.userId,
    scopes,
    extra: {
      userId: principal.userId,
      role: principal.role,
    },
  };
}

export function createAuthMiddleware(opts: {
  tokenMap: Map<string, TokenEntry>;
  sharedToken?: string;
  allowSharedOperatorRole?: boolean;
}) {
  return function registryAuth(req: Request, res: Response, next: NextFunction): void {
    const token = extractBearerToken(req.header('authorization') ?? undefined);
    if (!token) {
      res.status(401).json({ error: 'missing_bearer_token' });
      return;
    }

    const mapped = opts.tokenMap.get(token);
    if (mapped) {
      req.auth = toAuthInfo({ userId: mapped.userId, role: mapped.role, token });
      next();
      return;
    }

    const shared = opts.sharedToken?.trim();
    if (shared && token === shared) {
      const userId = (req.header('x-grok-user') ?? '').trim();
      if (!userId) {
        res.status(401).json({
          error: 'missing_x_grok_user',
          message:
            'Shared REGISTRY_TOKEN mode requires X-Grok-User. Prefer REGISTRY_TOKENS map in production.',
        });
        return;
      }
      const roleHeader = (req.header('x-grok-role') ?? 'user').trim().toLowerCase();
      const role: RegistryRole =
        opts.allowSharedOperatorRole !== false && roleHeader === 'operator' ? 'operator' : 'user';
      req.auth = toAuthInfo({ userId, role, token });
      next();
      return;
    }

    res.status(401).json({ error: 'invalid_token' });
  };
}

export function principalFromAuthInfo(authInfo: AuthInfo | undefined): AuthPrincipal | null {
  if (!authInfo) return null;
  const userId =
    (typeof authInfo.extra?.userId === 'string' && authInfo.extra.userId) || authInfo.clientId;
  const role: RegistryRole =
    authInfo.extra?.role === 'operator' || authInfo.scopes.includes('list') ? 'operator' : 'user';
  if (!userId) return null;
  return { userId, role, token: authInfo.token };
}
