/**
 * Event store (T11) — the only stateful thing in the service. Async so the same
 * interface fits Cloudflare D1, a node sqlite, or the in-memory test store.
 *
 * The store holds raw RoundEvents keyed by roundId, append-only, exactly as
 * uploaded (minus the client-local `syncedAt`, which is meaningless server-side
 * and stored as the ingest timestamp instead). Scores are NEVER stored — always
 * derived by replay (replay.ts).
 */

import type { RoundEvent } from '@sabd/contracts';

export interface InsertOutcome {
  /** roundIds stored by THIS call. */
  inserted: string[];
  /** roundIds that already existed — idempotency, not an error. */
  duplicates: string[];
}

export interface EventStore {
  /** Insert-or-ignore by roundId. Never updates an existing row (append-only). */
  insertEvents(events: readonly RoundEvent[], receivedAt: number): Promise<InsertOutcome>;
  /** Every stored event for an install, in a deterministic replay order (see replay.ts). */
  eventsForInstall(installId: string): Promise<RoundEvent[]>;
}

/** In-memory store — tests and local dev. Mirrors the D1 semantics exactly. */
export class MemoryEventStore implements EventStore {
  private readonly byRoundId = new Map<string, RoundEvent>();

  insertEvents(events: readonly RoundEvent[], receivedAt: number): Promise<InsertOutcome> {
    const outcome: InsertOutcome = { inserted: [], duplicates: [] };
    for (const e of events) {
      if (this.byRoundId.has(e.roundId)) {
        outcome.duplicates.push(e.roundId);
        continue;
      }
      // syncedAt is client-local bookkeeping; server-side it records ingest time.
      this.byRoundId.set(e.roundId, { ...e, syncedAt: receivedAt });
      outcome.inserted.push(e.roundId);
    }
    return Promise.resolve(outcome);
  }

  eventsForInstall(installId: string): Promise<RoundEvent[]> {
    const events = [...this.byRoundId.values()].filter((e) => e.installId === installId);
    return Promise.resolve(sortForReplay(events));
  }
}

/**
 * Deterministic replay order: playedAt, tiebroken by roundId. The client replays in
 * append (rowid) order; the server cannot see that order across out-of-order batch
 * uploads, so the played-at timeline is the canonical server order. Ties (same ms)
 * fall back to roundId so every replay of the same set is identical.
 */
export function sortForReplay(events: RoundEvent[]): RoundEvent[] {
  return events.sort((a, b) => a.playedAt - b.playedAt || (a.roundId < b.roundId ? -1 : 1));
}
