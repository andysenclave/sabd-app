/**
 * Game config — the tunables the playtest loop adjusts (hint economy §3.2 of the
 * playtest doc, timeLimitSec §3.3). Ships as JS so a change deploys via `eas update`
 * without a rebuild (T27 proves that loop with exactly one of these values).
 */

import type { PaidHint } from '@sabd/contracts';

export interface GameConfig {
  timeLimitSec: number;
  /** Seconds burned off the clock when a hint is taken. */
  hintCostSec: Record<PaidHint, number>;
  /** Wall-vs-monotonic disagreement (sec) beyond which the event is flagged anomalous. */
  anomalyToleranceSec: number;
}

export const gameConfig: GameConfig = {
  timeLimitSec: 60,
  hintCostSec: {
    position: 8,
    letters: 5,
  },
  anomalyToleranceSec: 5,
};
