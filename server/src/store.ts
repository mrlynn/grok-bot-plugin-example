import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const DEFAULT_ROOM = 'lobby';

export type Assistant = {
  id: string;
  name: string;
};

export type RegisteredAssistant = {
  user_id: string;
  assistant_id: string;
  name: string;
  registered_at: string;
};

export type PresenceRecord = {
  user_id: string;
  assistant_id: string;
  name: string;
  room_id: string;
  checked_in_at: string;
  last_seen: string;
};

/**
 * SQLite-backed registry. Path via REGISTRY_DB_PATH.
 * Swap this class later for Postgres/etc. without changing tool handlers.
 */
export class RegistryStore {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assistants (
        user_id TEXT NOT NULL,
        assistant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        registered_at TEXT NOT NULL,
        PRIMARY KEY (user_id, assistant_id)
      );

      CREATE TABLE IF NOT EXISTS presence (
        user_id TEXT NOT NULL,
        assistant_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        checked_in_at TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        PRIMARY KEY (user_id, assistant_id),
        FOREIGN KEY (user_id, assistant_id)
          REFERENCES assistants(user_id, assistant_id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_presence_room ON presence(room_id);
    `);
  }

  close(): void {
    this.db.close();
  }

  registerAssistants(userId: string, assistants: Assistant[]): {
    count: number;
    assistants: RegisteredAssistant[];
  } {
    const now = new Date().toISOString();
    const normalized = dedupeAssistants(assistants);

    this.db.exec('BEGIN');
    try {
      this.db
        .prepare('DELETE FROM presence WHERE user_id = ?')
        .run(userId);
      this.db.prepare('DELETE FROM assistants WHERE user_id = ?').run(userId);

      const insert = this.db.prepare(
        'INSERT INTO assistants (user_id, assistant_id, name, registered_at) VALUES (?, ?, ?, ?)',
      );
      for (const assistant of normalized) {
        insert.run(userId, assistant.id, assistant.name, now);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    return {
      count: normalized.length,
      assistants: this.listAssistantsForUser(userId),
    };
  }

  listAssistantsForUser(userId: string): RegisteredAssistant[] {
    return this.db
      .prepare(
        `SELECT user_id, assistant_id, name, registered_at
         FROM assistants
         WHERE user_id = ?
         ORDER BY assistant_id`,
      )
      .all(userId) as RegisteredAssistant[];
  }

  getAssistant(userId: string, assistantId: string): RegisteredAssistant | null {
    const row = this.db
      .prepare(
        `SELECT user_id, assistant_id, name, registered_at
         FROM assistants
         WHERE user_id = ? AND assistant_id = ?`,
      )
      .get(userId, assistantId) as RegisteredAssistant | undefined;
    return row ?? null;
  }

  checkIn(userId: string, assistantId: string, roomId: string = DEFAULT_ROOM): PresenceRecord {
    const assistant = this.getAssistant(userId, assistantId);
    if (!assistant) {
      throw new RegistryError(
        'assistant_not_registered',
        `Assistant "${assistantId}" is not on user "${userId}" allowlist. Call register_assistants first.`,
      );
    }

    const now = new Date().toISOString();
    const existing = this.db
      .prepare(
        `SELECT checked_in_at FROM presence WHERE user_id = ? AND assistant_id = ?`,
      )
      .get(userId, assistantId) as { checked_in_at: string } | undefined;

    if (existing) {
      this.db
        .prepare(
          `UPDATE presence
           SET room_id = ?, last_seen = ?
           WHERE user_id = ? AND assistant_id = ?`,
        )
        .run(roomId, now, userId, assistantId);
    } else {
      this.db
        .prepare(
          `INSERT INTO presence (user_id, assistant_id, room_id, checked_in_at, last_seen)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(userId, assistantId, roomId, now, now);
    }

    const presence = this.getPresence(userId, assistantId);
    if (!presence) {
      throw new RegistryError('internal', 'check_in succeeded but presence row missing');
    }
    return presence;
  }

  checkOut(userId: string, assistantId: string): { checked_out: boolean } {
    const result = this.db
      .prepare(`DELETE FROM presence WHERE user_id = ? AND assistant_id = ?`)
      .run(userId, assistantId);
    return { checked_out: Number(result.changes) > 0 };
  }

  getPresence(userId: string, assistantId: string): PresenceRecord | null {
    const row = this.db
      .prepare(
        `SELECT p.user_id, p.assistant_id, a.name, p.room_id, p.checked_in_at, p.last_seen
         FROM presence p
         JOIN assistants a
           ON a.user_id = p.user_id AND a.assistant_id = p.assistant_id
         WHERE p.user_id = ? AND p.assistant_id = ?`,
      )
      .get(userId, assistantId) as PresenceRecord | undefined;
    return row ?? null;
  }

  listRegistry(): {
    users: Array<{
      user_id: string;
      assistants: RegisteredAssistant[];
    }>;
  } {
    const rows = this.db
      .prepare(
        `SELECT user_id, assistant_id, name, registered_at
         FROM assistants
         ORDER BY user_id, assistant_id`,
      )
      .all() as RegisteredAssistant[];

    const byUser = new Map<string, RegisteredAssistant[]>();
    for (const row of rows) {
      const list = byUser.get(row.user_id) ?? [];
      list.push(row);
      byUser.set(row.user_id, list);
    }

    return {
      users: [...byUser.entries()].map(([user_id, assistants]) => ({
        user_id,
        assistants,
      })),
    };
  }

  listRoom(roomId: string = DEFAULT_ROOM): { room_id: string; present: PresenceRecord[] } {
    const present = this.db
      .prepare(
        `SELECT p.user_id, p.assistant_id, a.name, p.room_id, p.checked_in_at, p.last_seen
         FROM presence p
         JOIN assistants a
           ON a.user_id = p.user_id AND a.assistant_id = p.assistant_id
         WHERE p.room_id = ?
         ORDER BY p.user_id, p.assistant_id`,
      )
      .all(roomId) as PresenceRecord[];
    return { room_id: roomId, present };
  }
}

export class RegistryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'RegistryError';
  }
}

function dedupeAssistants(assistants: Assistant[]): Assistant[] {
  const seen = new Map<string, Assistant>();
  for (const assistant of assistants) {
    const id = assistant.id.trim();
    const name = assistant.name.trim();
    if (!id || !name) {
      throw new RegistryError('invalid_assistant', 'Each assistant needs non-empty id and name');
    }
    seen.set(id, { id, name });
  }
  return [...seen.values()];
}
