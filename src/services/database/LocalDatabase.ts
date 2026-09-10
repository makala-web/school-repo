import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js'

export interface SQLiteChanges {
  changes: number
  lastId: number
}

const IDB_NAME = 'shulea-offline-db'
const IDB_STORE = 'sqlite'
const DB_RECORD_KEY = 'main'
const WASM_PATH = '/sql-wasm.wasm'

let sqlModulePromise: Promise<SqlJsStatic> | null = null

function toSqlValue(value: unknown): SqlValue {
  if (value === undefined) return null
  if (value === null) return null
  if (value instanceof Uint8Array) return value
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'))
  })
}

async function idbGet(): Promise<Uint8Array | null> {
  const idb = await openIndexedDb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly')
    const store = tx.objectStore(IDB_STORE)
    const request = store.get(DB_RECORD_KEY)

    request.onsuccess = () => {
      const value = request.result
      idb.close()
      if (!value) {
        resolve(null)
      } else if (value instanceof Uint8Array) {
        resolve(value)
      } else if (value instanceof ArrayBuffer) {
        resolve(new Uint8Array(value))
      } else {
        resolve(new Uint8Array(value as ArrayLike<number>))
      }
    }
    request.onerror = () => {
      idb.close()
      reject(request.error || new Error('Failed to read offline database'))
    }
  })
}

async function idbPut(data: Uint8Array): Promise<void> {
  const idb = await openIndexedDb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    store.put(data, DB_RECORD_KEY)
    tx.oncomplete = () => {
      idb.close()
      resolve()
    }
    tx.onerror = () => {
      idb.close()
      reject(tx.error || new Error('Failed to save offline database'))
    }
  })
}

async function loadSqlModule(): Promise<SqlJsStatic> {
  if (!sqlModulePromise) {
    sqlModulePromise = initSqlJs({
      locateFile: () => WASM_PATH,
    })
  }
  return sqlModulePromise
}

export class LocalDatabase {
  private db: Database | null = null
  private initialized = false
  private savePromise: Promise<void> = Promise.resolve()

  async initialize(): Promise<void> {
    if (this.initialized) return

    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      throw new Error('Offline database requires IndexedDB in the browser')
    }

    const SQL = await loadSqlModule()
    const saved = await idbGet()
    this.db = saved ? new SQL.Database(saved) : new SQL.Database()
    this.db.run('PRAGMA foreign_keys = ON')
    this.initialized = true
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    this.ensureInitialized()
    const db = this.getDb()
    const stmt = db.prepare(sql)
    const rows: T[] = []

    try {
      stmt.bind((params || []).map(toSqlValue))
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T)
      }
      return rows
    } finally {
      stmt.free()
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<SQLiteChanges> {
    this.ensureInitialized()
    const db = this.getDb()
    db.run(sql, (params || []).map(toSqlValue))
    const changes = db.getRowsModified()
    const lastIdRows = db.exec('SELECT last_insert_rowid() as lastId')
    const lastId = Number(lastIdRows[0]?.values?.[0]?.[0] || 0)
    await this.persist()
    return { changes, lastId }
  }

  async transaction(queries: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
    this.ensureInitialized()
    const db = this.getDb()

    try {
      db.run('BEGIN IMMEDIATE TRANSACTION')
      for (const query of queries) {
        db.run(query.sql, (query.params || []).map(toSqlValue))
      }
      db.run('COMMIT')
      await this.persist()
    } catch (error) {
      try {
        db.run('ROLLBACK')
      } catch {
        // Ignore rollback errors; original error is more useful.
      }
      throw error
    }
  }

  async close(): Promise<void> {
    if (!this.initialized) return
    await this.savePromise
    await this.persist()
    this.db?.close()
    this.db = null
    this.initialized = false
  }

  async isConnection(): Promise<boolean> {
    return this.initialized && !!this.db
  }

  async exportBytes(): Promise<Uint8Array> {
    this.ensureInitialized()
    return this.getDb().export()
  }

  private persist(): Promise<void> {
    const exported = this.getDb().export()
    this.savePromise = this.savePromise.then(() => idbPut(exported))
    return this.savePromise
  }

  private getDb(): Database {
    if (!this.db) {
      throw new Error('Offline database is not available')
    }
    return this.db
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error('LocalDatabase not initialized. Call initialize() first.')
    }
  }

  static isAvailable(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window
  }
}
