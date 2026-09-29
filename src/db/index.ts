import { open, type DB } from '@op-engineering/op-sqlite';
import { MIGRATIONS } from './schema';

const DB_NAME = 'bankspends.db';

let instance: DB | null = null;

export function db(): DB {
  if (!instance) {
    throw new Error('Database used before initDatabase() resolved');
  }
  return instance;
}

export async function initDatabase(): Promise<DB> {
  if (instance) return instance;

  const handle = open({ name: DB_NAME });
  await handle.execute('PRAGMA journal_mode = WAL');
  await handle.execute('PRAGMA foreign_keys = ON');

  const result = await handle.execute('PRAGMA user_version');
  const current = Number(result.rows[0]?.user_version ?? 0);

  for (let version = current; version < MIGRATIONS.length; version++) {
    await handle.execute('BEGIN');
    try {
      for (const statement of MIGRATIONS[version]) {
        await handle.execute(statement);
      }
      // PRAGMA does not accept bound parameters; the value is a loop index.
      await handle.execute(`PRAGMA user_version = ${version + 1}`);
      await handle.execute('COMMIT');
    } catch (error) {
      await handle.execute('ROLLBACK');
      throw error;
    }
  }

  instance = handle;
  return handle;
}

/** Tests and the "erase all data" action both need a clean slate. */
export async function resetDatabase(): Promise<void> {
  const handle = db();
  await handle.execute('DELETE FROM transactions');
  await handle.execute('DELETE FROM accounts');
  await handle.execute('DELETE FROM ingest_state');
  await handle.execute('DELETE FROM category_rules');
}

export async function getState(key: string): Promise<string | null> {
  const r = await db().execute('SELECT value FROM ingest_state WHERE key = ?', [key]);
  const value = r.rows[0]?.value;
  return value == null ? null : String(value);
}

export async function setState(key: string, value: string): Promise<void> {
  await db().execute(
    'INSERT INTO ingest_state (key, value) VALUES (?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}
