/**
 * Migrations are an append-only list. Each entry runs once, in order, inside a
 * transaction, and `user_version` records how far we got. Never edit a
 * migration that has shipped — add another one.
 */
export const MIGRATIONS: string[][] = [
  // -- 1 ---------------------------------------------------------------------
  [
    `CREATE TABLE IF NOT EXISTS accounts (
       id               TEXT PRIMARY KEY NOT NULL,
       bank_id          TEXT NOT NULL,
       last4            TEXT,
       instrument       TEXT NOT NULL,
       label            TEXT NOT NULL,
       credit_limit     INTEGER,
       last_balance     INTEGER,
       last_balance_at  INTEGER,
       archived         INTEGER NOT NULL DEFAULT 0
     )`,

    `CREATE TABLE IF NOT EXISTS transactions (
       id               TEXT PRIMARY KEY NOT NULL,
       bank_id          TEXT NOT NULL,
       account_id       TEXT,
       last4            TEXT,
       instrument       TEXT NOT NULL,
       direction        TEXT NOT NULL,
       amount           INTEGER NOT NULL,
       currency         TEXT NOT NULL DEFAULT 'INR',
       occurred_at      INTEGER NOT NULL,
       merchant_raw     TEXT,
       merchant         TEXT,
       category         TEXT NOT NULL,
       channel          TEXT NOT NULL,
       ref_no           TEXT,
       balance_after    INTEGER,
       source           TEXT NOT NULL,
       source_id        TEXT NOT NULL,
       sender           TEXT NOT NULL,
       template_id      TEXT NOT NULL,
       confidence       REAL NOT NULL,
       category_locked  INTEGER NOT NULL DEFAULT 0,
       created_at       INTEGER NOT NULL
     )`,

    `CREATE INDEX IF NOT EXISTS idx_tx_occurred  ON transactions (occurred_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_bank_time ON transactions (bank_id, occurred_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_account   ON transactions (account_id, occurred_at DESC)`,
    // Supports the near-duplicate lookup, which probes by value then filters by time.
    `CREATE INDEX IF NOT EXISTS idx_tx_dedupe    ON transactions (bank_id, direction, amount, occurred_at)`,

    `CREATE TABLE IF NOT EXISTS ingest_state (
       key    TEXT PRIMARY KEY NOT NULL,
       value  TEXT NOT NULL
     )`,

    // User corrections. A rule outranks the keyword dictionary and is re-applied
    // to matching rows so one correction fixes the whole history.
    `CREATE TABLE IF NOT EXISTS category_rules (
       id          TEXT PRIMARY KEY NOT NULL,
       match_field TEXT NOT NULL,
       match_value TEXT NOT NULL,
       category    TEXT NOT NULL,
       created_at  INTEGER NOT NULL
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_rule_match ON category_rules (match_field, match_value)`,
  ],
];
