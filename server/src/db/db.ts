import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { config } from '../config.ts'

const serverRoot = fileURLToPath(new URL('../..', import.meta.url))

export function openDatabase(path = config.DATABASE_PATH) {
  const file = path === ':memory:' || isAbsolute(path) ? path : resolve(serverRoot, path)
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })

  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
  return db
}

export const db = openDatabase()

/** Runs `fn` inside a transaction; rolls back if it throws. */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export type Row = Record<string, unknown>
