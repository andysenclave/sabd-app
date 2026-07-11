/**
 * sessions.ts — group a player's rounds into sessions (playtest doc §3.1, §4 req. 3).
 * Gap rule: >10 minutes since the previous round starts a NEW session. A gap of
 * exactly 10:00 does NOT start a new session — only strictly more.
 */

import type { RoundEvent } from '@sabd/contracts';

/** The gap threshold is a constant on purpose — you'll want to tune it (doc §6.3). */
export const SESSION_GAP_MS = 10 * 60 * 1000;

export type Session = readonly RoundEvent[];

/** Rounds MUST already belong to a single player, chronologically sorted by playedAt. */
export function groupIntoSessions(playerRounds: readonly RoundEvent[]): Session[] {
  if (playerRounds.length === 0) return [];
  const sessions: RoundEvent[][] = [[playerRounds[0]!]];

  for (let i = 1; i < playerRounds.length; i++) {
    const prev = playerRounds[i - 1]!;
    const cur = playerRounds[i]!;
    const gap = cur.playedAt - prev.playedAt;
    if (gap > SESSION_GAP_MS) {
      sessions.push([cur]);
    } else {
      sessions[sessions.length - 1]!.push(cur);
    }
  }
  return sessions;
}

/** Group ALL rounds (any players) into per-player session lists. */
export function sessionsByPlayer(
  rounds: readonly RoundEvent[],
  pseudonyms: ReadonlyMap<string, string>,
): Map<string, Session[]> {
  const byPlayer = new Map<string, RoundEvent[]>();
  for (const r of rounds) {
    const pid = pseudonyms.get(r.installId) ?? r.installId;
    const list = byPlayer.get(pid) ?? [];
    list.push(r);
    byPlayer.set(pid, list);
  }
  const out = new Map<string, Session[]>();
  for (const [pid, playerRounds] of byPlayer) {
    out.set(
      pid,
      groupIntoSessions([...playerRounds].sort((a, b) => a.playedAt - b.playedAt)),
    );
  }
  return out;
}
