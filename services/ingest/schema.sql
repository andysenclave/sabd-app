-- Sabd ingest — D1 schema (T11). Mirrors the on-device round_event table
-- (docs/sabd-event-log-and-sync.md §4) so aggregation SQL (T15) is copy-portable.
-- Append-only: never UPDATE, never DELETE.

CREATE TABLE IF NOT EXISTS round_event (
  round_id              TEXT PRIMARY KEY,
  schema_version        INTEGER NOT NULL,
  install_id            TEXT NOT NULL,
  played_at             INTEGER NOT NULL,

  word_id               TEXT NOT NULL,
  word_rating_at_play   INTEGER NOT NULL,
  word_bank_version     TEXT NOT NULL,
  topic                 TEXT NOT NULL,

  solved                INTEGER NOT NULL,
  time_limit_sec        REAL    NOT NULL,
  time_used_sec         REAL    NOT NULL,
  hints_used            TEXT    NOT NULL,
  mode                  TEXT    NOT NULL,

  player_rating_before  INTEGER NOT NULL,
  engine_config_version TEXT    NOT NULL,
  anomaly               INTEGER,

  -- Server-side: when this event was ingested (client syncedAt is meaningless here).
  received_at           INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ingest_install ON round_event(install_id);
CREATE INDEX IF NOT EXISTS idx_ingest_word    ON round_event(word_id);
