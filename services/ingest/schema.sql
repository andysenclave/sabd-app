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

-- Accounts & transfer-code claim (P4-T9). An account owns the merged history of one
-- or more installs; a device mints a single-use code that another device claims.
-- Anonymous play needs no row here — an install is only recorded once it binds.
CREATE TABLE IF NOT EXISTS install_account (
  install_id  TEXT PRIMARY KEY,          -- one install binds to at most one account (F12)
  account_id  TEXT NOT NULL,
  claimed_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_install_account ON install_account(account_id);

CREATE TABLE IF NOT EXISTS claim_code (
  code        TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER                    -- NULL until redeemed; single-use
);
