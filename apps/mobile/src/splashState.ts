/**
 * Cold-start-only gate for the splash flip (T21). A module-scoped flag — reset on
 * every JS reload (cold start / dev refresh), stable across in-session navigation —
 * which is exactly "plays once at launch, not on later foregrounds."
 */
let played = false;

export function hasSplashPlayed(): boolean {
  return played;
}

export function markSplashPlayed(): void {
  played = true;
}
