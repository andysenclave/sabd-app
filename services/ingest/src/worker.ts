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
import { handleGetMe, handleUploadRounds, type HandlerResult } from './handlers.ts';
import { sortForReplay, type EventStore, type InsertOutcome } from './store.ts';

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
  constructor(db: D1Database) {
    this.db = db;
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
}

// ─── Routing ──────────────────────────────────────────────────────────────────

function toResponse<T>(result: HandlerResult<T>): Response {
  if (!result.ok) {
    return Response.json({ errors: result.error.errors }, { status: result.error.status });
  }
  return Response.json(result.body);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const store = new D1EventStore(env.DB);
    const now = Date.now();

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
      const installId = request.headers.get('X-Install-Id') ?? url.searchParams.get('installId') ?? '';
      const includeEvents = url.searchParams.get('includeEvents') === '1';
      return toResponse(await handleGetMe(store, installId, includeEvents, now));
    }

    return Response.json({ errors: ['not found'] }, { status: 404 });
  },
};
