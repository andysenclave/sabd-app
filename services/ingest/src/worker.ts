/**
 * Cloudflare Worker adapter (T11 deploy target) — parse/route/serialize only; all
 * logic lives in handlers.ts (node-tested). Deploy with `wrangler deploy` once the
 * owner's Cloudflare account + D1 database exist (see README).
 *
 * D1 schema (schema.sql): the round_event table mirrors the on-device schema
 * (event-log doc §4) so the aggregation SQL (T15) is copy-portable.
 *
 * This file is typechecked structurally (minimal local declarations for the CF
 * runtime types) so the repo needs no @cloudflare/workers-types dependency.
 */

import type { RoundEvent } from '@sabd/contracts';
import {
  handleClaim,
  handleCreateCode,
  handleDeleteAccount,
  handleGetMe,
  handleUploadRounds,
  type HandlerResult,
} from './handlers.ts';
import { sortForReplay, type ClaimOutcome, type EventStore, type InsertOutcome } from './store.ts';

// ─── Minimal structural types for the CF runtime (no dependency needed) ──────

interface D1Result<T> {
  results: T[];
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  all<T>(): Promise<D1Result<T>>;
}
interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}
export interface Env {
  DB: D1Database;
}

// ─── D1-backed EventStore ─────────────────────────────────────────────────────

interface EventRow {
  round_id: string;
  schema_version: number;
  install_id: string;
  played_at: number;
  word_id: string;
  word_rating_at_play: number;
  word_bank_version: string;
  topic: string;
  solved: number;
  time_limit_sec: number;
  time_used_sec: number;
  hints_used: string;
  mode: string;
  player_rating_before: number;
  engine_config_version: string;
  anomaly: number | null;
  received_at: number;
}

function rowToEvent(r: EventRow): RoundEvent {
  return {
    roundId: r.round_id,
    schemaVersion: r.schema_version,
    installId: r.install_id,
    playedAt: r.played_at,
    wordId: r.word_id,
    wordRatingAtPlay: r.word_rating_at_play,
    wordBankVersion: r.word_bank_version,
    topic: r.topic,
    solved: r.solved === 1,
    timeLimitSec: r.time_limit_sec,
    timeUsedSec: r.time_used_sec,
    hintsUsed: JSON.parse(r.hints_used) as RoundEvent['hintsUsed'],
    mode: r.mode as RoundEvent['mode'],
    playerRatingBefore: r.player_rating_before,
    engineConfigVersion: r.engine_config_version,
    ...(r.anomaly === null ? {} : { anomaly: r.anomaly === 1 }),
    syncedAt: r.received_at,
  };
}

const INSERT_SQL = `INSERT OR IGNORE INTO round_event (
  round_id, schema_version, install_id, played_at,
  word_id, word_rating_at_play, word_bank_version, topic,
  solved, time_limit_sec, time_used_sec, hints_used, mode,
  player_rating_before, engine_config_version, anomaly, received_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

class D1EventStore implements EventStore {
  private readonly db: D1Database;
  private readonly now: number;
  constructor(db: D1Database, now: number) {
    this.db = db;
    this.now = now;
  }

  async insertEvents(events: readonly RoundEvent[], receivedAt: number): Promise<InsertOutcome> {
    const outcome: InsertOutcome = { inserted: [], duplicates: [] };
    if (events.length === 0) return outcome;

    // Which ids already exist? (D1 batch is transactional per statement, and
    // INSERT OR IGNORE makes re-runs safe either way.)
    const existing = new Set(
      (
        await this.db
          .prepare(
            `SELECT round_id FROM round_event WHERE round_id IN (${events.map(() => '?').join(',')})`,
          )
          .bind(...events.map((e) => e.roundId))
          .all<{ round_id: string }>()
      ).results.map((r) => r.round_id),
    );

    const statements = events
      .filter((e) => !existing.has(e.roundId))
      .map((e) =>
        this.db
          .prepare(INSERT_SQL)
          .bind(
            e.roundId,
            e.schemaVersion,
            e.installId,
            e.playedAt,
            e.wordId,
            e.wordRatingAtPlay,
            e.wordBankVersion,
            e.topic,
            e.solved ? 1 : 0,
            e.timeLimitSec,
            e.timeUsedSec,
            JSON.stringify(e.hintsUsed),
            e.mode,
            e.playerRatingBefore,
            e.engineConfigVersion,
            e.anomaly === undefined ? null : e.anomaly ? 1 : 0,
            receivedAt,
          ),
      );
    if (statements.length > 0) await this.db.batch(statements);

    for (const e of events) {
      (existing.has(e.roundId) ? outcome.duplicates : outcome.inserted).push(e.roundId);
    }
    return outcome;
  }

  async eventsForInstall(installId: string): Promise<RoundEvent[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM round_event WHERE install_id = ?')
      .bind(installId)
      .all<EventRow>();
    return sortForReplay(results.map(rowToEvent));
  }

  // ─── Accounts (P4-T9) ────────────────────────────────────────────────────
  async accountForInstall(installId: string): Promise<string | null> {
    const { results } = await this.db
      .prepare('SELECT account_id FROM install_account WHERE install_id = ?')
      .bind(installId)
      .all<{ account_id: string }>();
    return results[0]?.account_id ?? null;
  }

  async ensureAccount(installId: string, mkId: () => string): Promise<{ accountId: string; created: boolean }> {
    const existing = await this.accountForInstall(installId);
    if (existing) return { accountId: existing, created: false };
    const accountId = mkId();
    await this.db
      .prepare('INSERT OR IGNORE INTO install_account (install_id, account_id, claimed_at) VALUES (?, ?, ?)')
      .bind(installId, accountId, this.now)
      .run();
    // Re-read in case of a concurrent bind (INSERT OR IGNORE lost the race).
    const settled = await this.accountForInstall(installId);
    return { accountId: settled ?? accountId, created: settled === accountId };
  }

  async eventsForAccount(accountId: string): Promise<RoundEvent[]> {
    const { results } = await this.db
      .prepare(
        `SELECT re.* FROM round_event re
         JOIN install_account ia ON ia.install_id = re.install_id
         WHERE ia.account_id = ?`,
      )
      .bind(accountId)
      .all<EventRow>();
    return sortForReplay(results.map(rowToEvent));
  }

  async putClaimCode(code: string, accountId: string, expiresAt: number): Promise<void> {
    await this.db
      .prepare('INSERT OR REPLACE INTO claim_code (code, account_id, expires_at, used_at) VALUES (?, ?, ?, NULL)')
      .bind(code, accountId, expiresAt)
      .run();
  }

  async redeemClaimCode(code: string, installId: string, now: number): Promise<ClaimOutcome> {
    const existing = await this.accountForInstall(installId);
    const { results } = await this.db
      .prepare('SELECT account_id, expires_at, used_at FROM claim_code WHERE code = ?')
      .bind(code)
      .all<{ account_id: string; expires_at: number; used_at: number | null }>();
    const row = results[0];

    if (row && existing === row.account_id) return { status: 'ok', accountId: existing };
    if (existing) return { status: 'already_claimed', accountId: existing };
    if (!row || row.used_at !== null || now > row.expires_at) return { status: 'unknown_code', accountId: null };

    // Consume the code atomically: the UPDATE only lands if still unused; if it
    // matched 0 rows, another device won the race — treat as spent.
    const upd = (await this.db
      .prepare('UPDATE claim_code SET used_at = ? WHERE code = ? AND used_at IS NULL')
      .bind(now, code)
      .run()) as { meta?: { changes?: number } };
    if ((upd.meta?.changes ?? 0) === 0) return { status: 'unknown_code', accountId: null };

    await this.db
      .prepare('INSERT OR IGNORE INTO install_account (install_id, account_id, claimed_at) VALUES (?, ?, ?)')
      .bind(installId, row.account_id, now)
      .run();
    return { status: 'ok', accountId: row.account_id };
  }

  async deleteAccount(accountId: string): Promise<{ deletedEvents: number; deletedInstalls: number }> {
    const { results } = await this.db
      .prepare('SELECT install_id FROM install_account WHERE account_id = ?')
      .bind(accountId)
      .all<{ install_id: string }>();
    const installs = results.map((r) => r.install_id);
    let deletedEvents = 0;
    for (const installId of installs) {
      const del = (await this.db
        .prepare('DELETE FROM round_event WHERE install_id = ?')
        .bind(installId)
        .run()) as { meta?: { changes?: number } };
      deletedEvents += del.meta?.changes ?? 0;
    }
    await this.db.prepare('DELETE FROM install_account WHERE account_id = ?').bind(accountId).run();
    await this.db.prepare('DELETE FROM claim_code WHERE account_id = ?').bind(accountId).run();
    return { deletedEvents, deletedInstalls: installs.length };
  }
}

// ─── Routing ──────────────────────────────────────────────────────────────────

function toResponse<T>(result: HandlerResult<T>): Response {
  if (!result.ok) {
    return Response.json({ errors: result.error.errors }, { status: result.error.status });
  }
  return Response.json(result.body);
}

/** A short, human-typeable transfer code — no ambiguous chars (0/O, 1/I). */
function mintCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const now = Date.now();
    const store = new D1EventStore(env.DB, now);
    const installOf = () =>
      request.headers.get('X-Install-Id') ?? url.searchParams.get('installId') ?? '';

    if (request.method === 'POST' && url.pathname === '/v1/rounds') {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json({ errors: ['body: invalid JSON'] }, { status: 400 });
      }
      return toResponse(await handleUploadRounds(store, body, now));
    }

    if (request.method === 'GET' && url.pathname === '/v1/me') {
      const includeEvents = url.searchParams.get('includeEvents') === '1';
      return toResponse(await handleGetMe(store, installOf(), includeEvents, now));
    }

    if (request.method === 'POST' && url.pathname === '/v1/account/code') {
      return toResponse(await handleCreateCode(store, installOf(), now, () => crypto.randomUUID(), mintCode));
    }

    if (request.method === 'POST' && url.pathname === '/v1/account/claim') {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json({ errors: ['body: invalid JSON'] }, { status: 400 });
      }
      return toResponse(await handleClaim(store, body, now));
    }

    if (request.method === 'DELETE' && url.pathname === '/v1/account') {
      return toResponse(await handleDeleteAccount(store, installOf()));
    }

    return Response.json({ errors: ['not found'] }, { status: 404 });
  },
};
