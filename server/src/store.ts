import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const DEFAULT_ROOM = 'lobby';
export const ROOM_TYPES = ['general', 'game'] as const;
export type RoomType = (typeof ROOM_TYPES)[number];
export type ParticipantKind = 'user' | 'assistant';

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

export type Room = {
  id: string;
  type: RoomType;
  title: string;
  created_by: string;
  created_at: string;
};

export type GameMetadataStub = {
  status: 'stub';
  prizes: null;
  compensation: null;
};

export type Participant = {
  participant_kind: ParticipantKind;
  user_id: string;
  assistant_id: string | null;
  display_name: string;
  room_id: string;
  checked_in_at: string;
  last_seen: string;
};

export type MessageKind = 'message' | 'command';

export type RoomMessage = {
  id: number;
  room_id: string;
  user_id: string;
  assistant_id: string | null;
  display_name: string;
  body: string;
  kind: MessageKind;
  command: string | null;
  created_at: string;
};

export type PostMessageResult = {
  message: RoomMessage;
  command_result: {
    command: string;
    room: Room;
    participants: Participant[];
    game: GameMetadataStub | null;
  } | null;
  /** Set when kind is command but the slash name is not supported. */
  command_error?: {
    code: 'unknown_command';
    message: string;
  };
};

/**
 * SQLite-backed registry. Path via REGISTRY_DB_PATH.
 * Swap this class later for Postgres/etc. without changing tool handlers.
 *
 * Rooms are common areas in this MCP (not Slack, not Grok Bot group chats).
 * - general: assistants only
 * - game: users and assistants (game metadata is a stub; no prizes/payouts)
 */
export class RegistryStore {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.migrateAndInit();
    this.ensureDefaultLobby();
  }

  close(): void {
    this.db.close();
  }

  registerAssistants(
    userId: string,
    assistants: Assistant[],
    mode: 'replace' | 'merge' = 'replace',
  ): {
    count: number;
    mode: 'replace' | 'merge';
    assistants: RegisteredAssistant[];
  } {
    const now = new Date().toISOString();
    const normalized = dedupeAssistants(assistants);

    this.db.exec('BEGIN');
    try {
      if (mode === 'replace') {
        this.db
          .prepare(
            `DELETE FROM participants
             WHERE user_id = ? AND participant_kind = 'assistant'`,
          )
          .run(userId);
        this.db.prepare('DELETE FROM assistants WHERE user_id = ?').run(userId);

        const insert = this.db.prepare(
          'INSERT INTO assistants (user_id, assistant_id, name, registered_at) VALUES (?, ?, ?, ?)',
        );
        for (const assistant of normalized) {
          insert.run(userId, assistant.id, assistant.name, now);
        }
      } else {
        const upsert = this.db.prepare(
          `INSERT INTO assistants (user_id, assistant_id, name, registered_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id, assistant_id) DO UPDATE SET name = excluded.name`,
        );
        for (const assistant of normalized) {
          upsert.run(userId, assistant.id, assistant.name, now);
        }
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    return {
      count: normalized.length,
      mode,
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

  createRoom(input: {
    id: string;
    type: string;
    title: string;
    createdBy: string;
  }): Room {
    const id = input.id.trim();
    const title = input.title.trim();
    if (!id || !title) {
      throw new RegistryError('invalid_room', 'Room id and title are required');
    }
    const type = parseRoomType(input.type);
    const now = new Date().toISOString();

    try {
      this.db
        .prepare(
          `INSERT INTO rooms (id, type, title, created_by, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(id, type, title, input.createdBy, now);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new RegistryError('room_exists', `Room "${id}" already exists`);
      }
      throw error;
    }

    const room = this.getRoom(id);
    if (!room) {
      throw new RegistryError('internal', 'create_room succeeded but room row missing');
    }
    return room;
  }

  getRoom(roomId: string): Room | null {
    const row = this.db
      .prepare(
        `SELECT id, type, title, created_by, created_at
         FROM rooms WHERE id = ?`,
      )
      .get(roomId) as Room | undefined;
    return row ?? null;
  }

  listRooms(): { rooms: Room[] } {
    const rooms = this.db
      .prepare(
        `SELECT id, type, title, created_by, created_at
         FROM rooms
         ORDER BY id`,
      )
      .all() as Room[];
    return { rooms };
  }

  checkIn(opts: {
    userId: string;
    roomId?: string;
    participantKind?: ParticipantKind;
    assistantId?: string;
  }): Participant {
    const roomId = opts.roomId?.trim() || DEFAULT_ROOM;
    const room = this.getRoom(roomId);
    if (!room) {
      throw new RegistryError('room_not_found', `Room "${roomId}" does not exist`);
    }

    const kind: ParticipantKind = opts.participantKind ?? 'assistant';

    if (kind === 'user') {
      if (room.type !== 'game') {
        throw new RegistryError(
          'user_not_allowed',
          `General rooms are assistants-only. User participants are allowed in game rooms only.`,
        );
      }
      if (opts.assistantId) {
        throw new RegistryError(
          'invalid_participant',
          'Do not pass assistant_id when participant_kind is user',
        );
      }
      return this.upsertParticipant({
        kind: 'user',
        userId: opts.userId,
        assistantId: null,
        displayName: opts.userId,
        roomId,
      });
    }

    const assistantId = opts.assistantId?.trim();
    if (!assistantId) {
      throw new RegistryError(
        'invalid_participant',
        'assistant_id is required when checking in as an assistant',
      );
    }
    const assistant = this.getAssistant(opts.userId, assistantId);
    if (!assistant) {
      throw new RegistryError(
        'assistant_not_registered',
        `Assistant "${assistantId}" is not on user "${opts.userId}" allowlist. Call register_assistants first.`,
      );
    }

    return this.upsertParticipant({
      kind: 'assistant',
      userId: opts.userId,
      assistantId,
      displayName: assistant.name,
      roomId,
    });
  }

  checkOut(opts: {
    userId: string;
    participantKind?: ParticipantKind;
    assistantId?: string;
  }): { checked_out: boolean } {
    const kind: ParticipantKind = opts.participantKind ?? 'assistant';

    if (kind === 'user') {
      const result = this.db
        .prepare(
          `DELETE FROM participants
           WHERE participant_kind = 'user' AND user_id = ? AND assistant_id = ''`,
        )
        .run(opts.userId);
      return { checked_out: Number(result.changes) > 0 };
    }

    const assistantId = opts.assistantId?.trim();
    if (!assistantId) {
      throw new RegistryError(
        'invalid_participant',
        'assistant_id is required when checking out an assistant',
      );
    }
    const result = this.db
      .prepare(
        `DELETE FROM participants
         WHERE participant_kind = 'assistant' AND user_id = ? AND assistant_id = ?`,
      )
      .run(opts.userId, assistantId);
    return { checked_out: Number(result.changes) > 0 };
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

  listRoom(roomId: string = DEFAULT_ROOM): {
    room: Room;
    participants: Participant[];
    game: GameMetadataStub | null;
  } {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new RegistryError('room_not_found', `Room "${roomId}" does not exist`);
    }

    return {
      room,
      participants: this.listParticipants(roomId),
      game: room.type === 'game' ? gameMetadataStub() : null,
    };
  }

  /**
   * Post a room message. Bodies starting with `/` are slash commands recorded in the log.
   * `/whos-here` returns the same presence listing as `list_room`.
   * Poster must already be checked into the target room.
   */
  postMessage(opts: {
    userId: string;
    roomId?: string;
    participantKind?: ParticipantKind;
    assistantId?: string;
    body: string;
  }): PostMessageResult {
    const roomId = opts.roomId?.trim() || DEFAULT_ROOM;
    const room = this.getRoom(roomId);
    if (!room) {
      throw new RegistryError('room_not_found', `Room "${roomId}" does not exist`);
    }

    const body = opts.body.trim();
    if (!body) {
      throw new RegistryError('invalid_message', 'Message body is required');
    }

    const kind: ParticipantKind = opts.participantKind ?? (opts.assistantId ? 'assistant' : 'user');
    const assistantKey =
      kind === 'assistant' ? (opts.assistantId?.trim() ?? '') : '';
    if (kind === 'assistant' && !assistantKey) {
      throw new RegistryError(
        'invalid_participant',
        'assistant_id is required when posting as an assistant',
      );
    }
    if (kind === 'user' && opts.assistantId) {
      throw new RegistryError(
        'invalid_participant',
        'Do not pass assistant_id when participant_kind is user',
      );
    }

    const participant = this.getParticipant(kind, opts.userId, assistantKey);
    if (!participant || participant.room_id !== roomId) {
      throw new RegistryError(
        'not_in_room',
        `Check into room "${roomId}" before posting a message`,
      );
    }

    const parsed = parseSlashCommand(body);
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO messages
           (room_id, user_id, assistant_id, display_name, body, kind, command, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        roomId,
        opts.userId,
        assistantKey,
        participant.display_name,
        body,
        parsed.kind,
        parsed.command,
        now,
      );

    const message = this.getMessage(Number(result.lastInsertRowid));
    if (!message) {
      throw new RegistryError('internal', 'post_message succeeded but message row missing');
    }

    if (parsed.kind === 'command' && parsed.command === 'whos-here') {
      const listing = this.listRoom(roomId);
      return {
        message,
        command_result: {
          command: 'whos-here',
          room: listing.room,
          participants: listing.participants,
          game: listing.game,
        },
      };
    }

    if (parsed.kind === 'command' && parsed.command) {
      return {
        message,
        command_result: null,
        command_error: {
          code: 'unknown_command',
          message: `Unknown room command "/${parsed.command}". Supported: /whos-here`,
        },
      };
    }

    return { message, command_result: null };
  }

  listMessages(opts: {
    roomId?: string;
    limit?: number;
  } = {}): { room: Room; messages: RoomMessage[] } {
    const roomId = opts.roomId?.trim() || DEFAULT_ROOM;
    const room = this.getRoom(roomId);
    if (!room) {
      throw new RegistryError('room_not_found', `Room "${roomId}" does not exist`);
    }

    const limit = clampLimit(opts.limit);
    const rows = this.db
      .prepare(
        `SELECT id, room_id, user_id, assistant_id, display_name, body, kind, command, created_at
         FROM messages
         WHERE room_id = ?
         ORDER BY id ASC
         LIMIT ?`,
      )
      .all(roomId, limit) as Array<{
      id: number;
      room_id: string;
      user_id: string;
      assistant_id: string;
      display_name: string;
      body: string;
      kind: MessageKind;
      command: string | null;
      created_at: string;
    }>;

    return {
      room,
      messages: rows.map((row) => ({
        id: row.id,
        room_id: row.room_id,
        user_id: row.user_id,
        assistant_id: row.assistant_id === '' ? null : row.assistant_id,
        display_name: row.display_name,
        body: row.body,
        kind: row.kind,
        command: row.command,
        created_at: row.created_at,
      })),
    };
  }

  private listParticipants(roomId: string): Participant[] {
    const rows = this.db
      .prepare(
        `SELECT participant_kind, user_id, assistant_id, display_name, room_id, checked_in_at, last_seen
         FROM participants
         WHERE room_id = ?
         ORDER BY participant_kind, user_id, assistant_id`,
      )
      .all(roomId) as Array<{
      participant_kind: ParticipantKind;
      user_id: string;
      assistant_id: string;
      display_name: string;
      room_id: string;
      checked_in_at: string;
      last_seen: string;
    }>;

    return rows.map((row) => ({
      participant_kind: row.participant_kind,
      user_id: row.user_id,
      assistant_id: row.assistant_id === '' ? null : row.assistant_id,
      display_name: row.display_name,
      room_id: row.room_id,
      checked_in_at: row.checked_in_at,
      last_seen: row.last_seen,
    }));
  }

  private getMessage(id: number): RoomMessage | null {
    const row = this.db
      .prepare(
        `SELECT id, room_id, user_id, assistant_id, display_name, body, kind, command, created_at
         FROM messages WHERE id = ?`,
      )
      .get(id) as
      | {
          id: number;
          room_id: string;
          user_id: string;
          assistant_id: string;
          display_name: string;
          body: string;
          kind: MessageKind;
          command: string | null;
          created_at: string;
        }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      room_id: row.room_id,
      user_id: row.user_id,
      assistant_id: row.assistant_id === '' ? null : row.assistant_id,
      display_name: row.display_name,
      body: row.body,
      kind: row.kind,
      command: row.command,
      created_at: row.created_at,
    };
  }

  private upsertParticipant(input: {
    kind: ParticipantKind;
    userId: string;
    assistantId: string | null;
    displayName: string;
    roomId: string;
  }): Participant {
    const now = new Date().toISOString();
    const assistantKey = input.assistantId ?? '';
    const existing = this.db
      .prepare(
        `SELECT checked_in_at FROM participants
         WHERE participant_kind = ? AND user_id = ? AND assistant_id = ?`,
      )
      .get(input.kind, input.userId, assistantKey) as { checked_in_at: string } | undefined;

    if (existing) {
      this.db
        .prepare(
          `UPDATE participants
           SET room_id = ?, display_name = ?, last_seen = ?
           WHERE participant_kind = ? AND user_id = ? AND assistant_id = ?`,
        )
        .run(
          input.roomId,
          input.displayName,
          now,
          input.kind,
          input.userId,
          assistantKey,
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO participants
             (participant_kind, user_id, assistant_id, display_name, room_id, checked_in_at, last_seen)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.kind,
          input.userId,
          assistantKey,
          input.displayName,
          input.roomId,
          now,
          now,
        );
    }

    const participant = this.getParticipant(input.kind, input.userId, assistantKey);
    if (!participant) {
      throw new RegistryError('internal', 'check_in succeeded but participant row missing');
    }
    return participant;
  }

  private getParticipant(
    kind: ParticipantKind,
    userId: string,
    assistantKey: string,
  ): Participant | null {
    const row = this.db
      .prepare(
        `SELECT participant_kind, user_id, assistant_id, display_name, room_id, checked_in_at, last_seen
         FROM participants
         WHERE participant_kind = ? AND user_id = ? AND assistant_id = ?`,
      )
      .get(kind, userId, assistantKey) as
      | {
          participant_kind: ParticipantKind;
          user_id: string;
          assistant_id: string;
          display_name: string;
          room_id: string;
          checked_in_at: string;
          last_seen: string;
        }
      | undefined;
    if (!row) return null;
    return {
      participant_kind: row.participant_kind,
      user_id: row.user_id,
      assistant_id: row.assistant_id === '' ? null : row.assistant_id,
      display_name: row.display_name,
      room_id: row.room_id,
      checked_in_at: row.checked_in_at,
      last_seen: row.last_seen,
    };
  }

  private migrateAndInit(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assistants (
        user_id TEXT NOT NULL,
        assistant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        registered_at TEXT NOT NULL,
        PRIMARY KEY (user_id, assistant_id)
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS participants (
        participant_kind TEXT NOT NULL,
        user_id TEXT NOT NULL,
        assistant_id TEXT NOT NULL DEFAULT '',
        display_name TEXT NOT NULL,
        room_id TEXT NOT NULL,
        checked_in_at TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        PRIMARY KEY (participant_kind, user_id, assistant_id),
        FOREIGN KEY (room_id) REFERENCES rooms(id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        assistant_id TEXT NOT NULL DEFAULT '',
        display_name TEXT NOT NULL,
        body TEXT NOT NULL,
        kind TEXT NOT NULL,
        command TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (room_id) REFERENCES rooms(id)
      );

      CREATE INDEX IF NOT EXISTS idx_participants_room ON participants(room_id);
      CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, id);
    `);

    // Migrate v1 lobby-only `presence` table if present.
    const hasPresence = this.db
      .prepare(
        `SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'presence'`,
      )
      .get() as { ok: number } | undefined;
    if (!hasPresence) return;

    this.ensureDefaultLobby();
    const rows = this.db
      .prepare(
        `SELECT p.user_id, p.assistant_id, a.name, p.room_id, p.checked_in_at, p.last_seen
         FROM presence p
         LEFT JOIN assistants a
           ON a.user_id = p.user_id AND a.assistant_id = p.assistant_id`,
      )
      .all() as Array<{
      user_id: string;
      assistant_id: string;
      name: string | null;
      room_id: string;
      checked_in_at: string;
      last_seen: string;
    }>;

    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO participants
         (participant_kind, user_id, assistant_id, display_name, room_id, checked_in_at, last_seen)
       VALUES ('assistant', ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of rows) {
      // Ensure target room exists (default unknown rooms to general titled by id).
      if (!this.getRoom(row.room_id)) {
        this.db
          .prepare(
            `INSERT OR IGNORE INTO rooms (id, type, title, created_by, created_at)
             VALUES (?, 'general', ?, 'system', ?)`,
          )
          .run(row.room_id, row.room_id, row.checked_in_at);
      }
      insert.run(
        row.user_id,
        row.assistant_id,
        row.name ?? row.assistant_id,
        row.room_id,
        row.checked_in_at,
        row.last_seen,
      );
    }
    this.db.exec('DROP TABLE presence');
  }

  private ensureDefaultLobby(): void {
    const existing = this.getRoom(DEFAULT_ROOM);
    if (existing) return;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO rooms (id, type, title, created_by, created_at)
         VALUES (?, 'general', ?, 'system', ?)`,
      )
      .run(DEFAULT_ROOM, 'Lobby', now);
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

export function parseRoomType(type: string): RoomType {
  const normalized = type.trim().toLowerCase();
  if (normalized === 'general' || normalized === 'game') {
    return normalized;
  }
  throw new RegistryError(
    'unknown_room_type',
    `Unknown room type "${type}". Allowed: general, game`,
  );
}

export function gameMetadataStub(): GameMetadataStub {
  return { status: 'stub', prizes: null, compensation: null };
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

function parseSlashCommand(body: string): { kind: MessageKind; command: string | null } {
  if (!body.startsWith('/')) {
    return { kind: 'message', command: null };
  }
  const token = body.slice(1).split(/\s+/, 1)[0] ?? '';
  const command = token.trim().toLowerCase();
  if (!command) {
    throw new RegistryError('invalid_command', 'Slash command name is required after "/"');
  }
  return { kind: 'command', command };
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) return 100;
  return Math.min(500, Math.max(1, Math.floor(limit)));
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}
