/**
 * Test driver — node:sqlite (built into Node ≥ 23.4). Same SQLite engine and SQL
 * dialect as expo-sqlite on device, so the schema, transactions, and conflict
 * behavior exercised here are exactly what ships.
 */

import { DatabaseSync } from 'node:sqlite';
import type { SqlDriver, SqlValue } from '../src/driver.ts';

export class NodeSqliteDriver implements SqlDriver {
  readonly db: DatabaseSync;

  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  run(sql: string, params: SqlValue[] = []): { changes: number } {
    const r = this.db.prepare(sql).run(...params);
    return { changes: Number(r.changes) };
  }

  get<T>(sql: string, params: SqlValue[] = []): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  all<T>(sql: string, params: SqlValue[] = []): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
}

/**
 * A driver wrapper that throws on the Nth run() call — used to simulate a crash
 * mid-transaction and prove appendRound leaves no half-state.
 */
export class FailingDriver implements SqlDriver {
  private runCount = 0;
  private readonly inner: SqlDriver;
  private readonly failOnRunNumber: number;

  constructor(inner: SqlDriver, failOnRunNumber: number) {
    this.inner = inner;
    this.failOnRunNumber = failOnRunNumber;
  }

  exec(sql: string): void {
    this.inner.exec(sql);
  }

  run(sql: string, params: SqlValue[] = []): { changes: number } {
    this.runCount += 1;
    if (this.runCount === this.failOnRunNumber) {
      throw new Error(`FailingDriver: simulated crash on run #${this.runCount}`);
    }
    return this.inner.run(sql, params);
  }

  get<T>(sql: string, params: SqlValue[] = []): T | undefined {
    return this.inner.get<T>(sql, params);
  }

  all<T>(sql: string, params: SqlValue[] = []): T[] {
    return this.inner.all<T>(sql, params);
  }

  transaction<T>(fn: () => T): T {
    return this.inner.transaction(fn);
  }
}
