/**
 * expo-sqlite adapter for the @sabd/storage SqlDriver seam. Thin on purpose —
 * every property that matters (atomicity, idempotency, replay) lives in the
 * package and is tested there against the same SQLite engine via node:sqlite.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import type { SqlDriver, SqlValue } from '@sabd/storage';

export class ExpoSqliteDriver implements SqlDriver {
  constructor(private readonly db: SQLiteDatabase) {}

  exec(sql: string): void {
    this.db.execSync(sql);
  }

  run(sql: string, params: SqlValue[] = []): { changes: number } {
    const r = this.db.runSync(sql, params);
    return { changes: r.changes };
  }

  get<T>(sql: string, params: SqlValue[] = []): T | undefined {
    return (this.db.getFirstSync<T>(sql, params) ?? undefined) as T | undefined;
  }

  all<T>(sql: string, params: SqlValue[] = []): T[] {
    return this.db.getAllSync<T>(sql, params);
  }

  transaction<T>(fn: () => T): T {
    let out!: T;
    // withTransactionSync commits on return, rolls back when fn throws.
    this.db.withTransactionSync(() => {
      out = fn();
    });
    return out;
  }
}
