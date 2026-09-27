import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
let db;
let migrate;
let transaction;

if (databaseUrl) {
  const connection = new URL(databaseUrl);
  if (['require', 'prefer', 'verify-ca'].includes(connection.searchParams.get('sslmode'))) {
    connection.searchParams.set('sslmode', 'verify-full');
  }
  const pool = new pg.Pool({ connectionString: connection.toString(), max: 5 });
  const activeClient = new AsyncLocalStorage();
  pg.types.setTypeParser(20, Number);
  const query = (sql, args = []) => {
    let index = 0;
    const text = sql.replace(/\?/g, () => `$${++index}`);
    const statement = text.replace(/^\s*INSERT OR IGNORE INTO\s/i, 'INSERT INTO ');
    const finalSql = statement === text ? statement : `${statement} ON CONFLICT DO NOTHING`;
    return (activeClient.getStore() || pool).query(finalSql, args);
  };
  db = {
    prepare: (sql) => ({
      get: async (...args) => (await query(sql, args)).rows[0],
      all: async (...args) => (await query(sql, args)).rows,
      run: async (...args) => ({ changes: (await query(sql, args)).rowCount }),
    }),
  };
  migrate = async () => {
    await pool.query(readFileSync(new URL('./schema.pg.sql', import.meta.url), 'utf8'));
    await pool.query('INSERT INTO migrations(version) VALUES (1) ON CONFLICT DO NOTHING');
  };
  transaction = async (action) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await activeClient.run(client, action);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
} else {
  const path = resolve(process.env.DATABASE_PATH || './data/tantu.db');
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db = sqlite;
  migrate = async () => {
    sqlite.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
    sqlite.prepare('INSERT OR IGNORE INTO migrations(version) VALUES (1)').run();
  };
  transaction = async (action) => {
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const result = await action();
      sqlite.exec('COMMIT');
      return result;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  };
}

export { db, migrate, transaction };
