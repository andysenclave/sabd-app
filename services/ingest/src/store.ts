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

/** Result of redeeming a transfer code (P4-T9). */
export interface ClaimOutcome {
  /** `ok` bound the install; `unknown_code` = missing/expired/spent; `already_claimed` = F12. */
  status: 'ok' | 'unknown_code' | 'already_claimed';
  /** The account bound on success, or the install's EXISTING account on `already_claimed`. */
  accountId: string | null;
}

export interface EventStore {
  /** Insert-or-ignore by roundId. Never updates an existing row (append-only). */
  insertEvents(events: readonly RoundEvent[], receivedAt: number): Promise<InsertOutcome>;
  /** Every stored event for an install, in a deterministic replay order (see replay.ts). */
  eventsForInstall(installId: string): Promise<RoundEvent[]>;

  // ─── Accounts & transfer-code claim (P4-T9) ────────────────────────────────
  /** The account an install is bound to, or null for a pure-anonymous install. */
  accountForInstall(installId: string): Promise<string | null>;
  /** Bind the install to a new or existing account; idempotent. `mkId` mints a fresh id. */
  ensureAccount(installId: string, mkId: () => string): Promise<{ accountId: string; created: boolean }>;
  /** Every stored event across ALL installs bound to the account, in replay order. */
  eventsForAccount(accountId: string): Promise<RoundEvent[]>;
  /** Store a single-use transfer code for an account. */
  putClaimCode(code: string, accountId: string, expiresAt: number): Promise<void>;
  /** Redeem a code: bind `installId` to its account. Atomic, single-use (F12 guards). */
  redeemClaimCode(code: string, installId: string, now: number): Promise<ClaimOutcome>;
  /** F14 — erase an account: all its installs' events, bindings, and codes. */
  deleteAccount(accountId: string): Promise<{ deletedEvents: number; deletedInstalls: number }>;
}

/** In-memory store — tests and local dev. Mirrors the D1 semantics exactly. */
export class MemoryEventStore implements EventStore {
  private readonly byRoundId = new Map<string, RoundEvent>();
  private readonly installToAccount = new Map<string, string>();
  private readonly codes = new Map<string, { accountId: string; expiresAt: number; usedAt: number | null }>();

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

  accountForInstall(installId: string): Promise<string | null> {
    return Promise.resolve(this.installToAccount.get(installId) ?? null);
  }

  ensureAccount(installId: string, mkId: () => string): Promise<{ accountId: string; created: boolean }> {
    const existing = this.installToAccount.get(installId);
    if (existing) return Promise.resolve({ accountId: existing, created: false });
    const accountId = mkId();
    this.installToAccount.set(installId, accountId);
    return Promise.resolve({ accountId, created: true });
  }

  eventsForAccount(accountId: string): Promise<RoundEvent[]> {
    const installs = new Set(
      [...this.installToAccount.entries()].filter(([, a]) => a === accountId).map(([i]) => i),
    );
    const events = [...this.byRoundId.values()].filter((e) => installs.has(e.installId));
    return Promise.resolve(sortForReplay(events));
  }

  putClaimCode(code: string, accountId: string, expiresAt: number): Promise<void> {
    this.codes.set(code, { accountId, expiresAt, usedAt: null });
    return Promise.resolve();
  }

  redeemClaimCode(code: string, installId: string, now: number): Promise<ClaimOutcome> {
    const row = this.codes.get(code);
    const existing = this.installToAccount.get(installId) ?? null;

    // Idempotent: the install already belongs to this code's account — success, no
    // state change (even if the code is spent or expired).
    if (row && existing === row.accountId) return Promise.resolve({ status: 'ok', accountId: existing });
    // The install already belongs to a DIFFERENT account (F12) — never rebind.
    if (existing) return Promise.resolve({ status: 'already_claimed', accountId: existing });
    // No such code, already spent, or expired.
    if (!row || row.usedAt !== null || now > row.expiresAt) {
      return Promise.resolve({ status: 'unknown_code', accountId: null });
    }
    // Bind and consume.
    this.installToAccount.set(installId, row.accountId);
    row.usedAt = now;
    return Promise.resolve({ status: 'ok', accountId: row.accountId });
  }

  deleteAccount(accountId: string): Promise<{ deletedEvents: number; deletedInstalls: number }> {
    const installs = [...this.installToAccount.entries()].filter(([, a]) => a === accountId).map(([i]) => i);
    const installSet = new Set(installs);
    let deletedEvents = 0;
    for (const [rid, e] of this.byRoundId) {
      if (installSet.has(e.installId)) {
        this.byRoundId.delete(rid);
        deletedEvents++;
      }
    }
    for (const i of installs) this.installToAccount.delete(i);
    for (const [code, row] of this.codes) if (row.accountId === accountId) this.codes.delete(code);
    return Promise.resolve({ deletedEvents, deletedInstalls: installs.length });
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
