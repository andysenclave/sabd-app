/**
 * @sabd/storage — the SQL driver seam.
 *
 * The storage core (migrations, appendRound, replay, export) is pure logic written
 * against this minimal synchronous interface. The mobile app provides an expo-sqlite
 * adapter; tests provide a node:sqlite adapter. Keeping the seam tiny is what makes
 * the atomicity/idempotency/self-heal properties testable in CI without a device.
 *
 * Parameter values are the SQLite-representable primitives only — the row mapping
 * layer (rows.ts) converts booleans and arrays before they reach a driver.
 */

export type SqlValue = string | number | null;

export interface SqlDriver {
  /** Execute DDL / statements without params (may contain multiple statements). */
  exec(sql: string): void;
  /** Run one parameterized statement; returns the number of rows changed. */
  run(sql: string, params?: SqlValue[]): { changes: number };
  /** Fetch the first row or undefined. */
  get<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): T | undefined;
  /** Fetch all rows. */
  all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): T[];
  /**
   * Run `fn` inside ONE SQLite transaction. Commits on return, rolls back on throw.
   * appendRound's atomicity guarantee (event insert + cache update land together or
   * not at all) rests entirely on this.
   */
  transaction<T>(fn: () => T): T;
}
