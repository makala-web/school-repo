import type { PrismaClient } from '@prisma/client'
import { LocalDatabase } from './LocalDatabase'

export type DatabaseMode = 'prisma' | 'sqlite' | 'auto'

class ConnectionManagerClass {
  private mode: DatabaseMode = 'auto'
  private sqliteDb: LocalDatabase | null = null
  private initPromise: Promise<LocalDatabase> | null = null

  setMode(mode: DatabaseMode): void {
    this.mode = mode
  }

  getMode(): DatabaseMode {
    return this.mode
  }

  isMobile(): boolean {
    return this.mode === 'sqlite'
  }

  async getSQLite(): Promise<LocalDatabase> {
    // This accessor is explicitly for the device-local database. Keeping the
    // mode aligned here prevents a preceding API call from routing local
    // schema/query work to Prisma in the browser.
    this.mode = 'sqlite'
    // If already initialized, return immediately
    if (this.sqliteDb) {
      return this.sqliteDb
    }

    // If initialization is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise
    }

    // Start new initialization
    this.initPromise = this.initializeSQLite()
    return this.initPromise
  }

  private async initializeSQLite(): Promise<LocalDatabase> {
    const db = new LocalDatabase()
    await db.initialize()
    this.sqliteDb = db
    return db
  }

  async getPrisma(): Promise<PrismaClient> {
    const { db } = await import('@/lib/db')
    return db
  }

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    try {
      const isMobileEnv = this.isMobile()
      if (this.mode === 'prisma' || (this.mode === 'auto' && !isMobileEnv)) {
        const prisma = await this.getPrisma()
        // Prisma supports raw queries; use the unsafe variant to pass raw SQL and params.
        // Caller should ensure SQL is safe when using user input.
        return (await (prisma as any).$queryRawUnsafe(sql, ...(params || []))) as T[]
      }

      const sqlite = await this.getSQLite()
      if (!sqlite) {
        throw new Error('Database not initialized. Please restart the app.')
      }
      return sqlite.query<T>(sql, params)
    } catch (error) {
      throw new Error('Failed to execute query: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<void> {
    try {
      const isMobileEnv = this.isMobile()
      if (this.mode === 'prisma' || (this.mode === 'auto' && !isMobileEnv)) {
        const prisma = await this.getPrisma()
        await (prisma as any).$executeRawUnsafe(sql, ...(params || []))
        return
      }

      const sqlite = await this.getSQLite()
      if (!sqlite) {
        throw new Error('Database not initialized. Please restart the app.')
      }
      await sqlite.execute(sql, params)
    } catch (error) {
      throw new Error('Failed to execute SQL: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  async close(): Promise<void> {
    try {
      if (this.sqliteDb) {
        await this.sqliteDb.close()
        this.sqliteDb = null
      }
      this.initPromise = null
    } catch (error) {
      throw new Error('Failed to close database: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  async transaction(queries: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
    try {
      const isMobileEnv = this.isMobile()
      if (this.mode === 'prisma' || (this.mode === 'auto' && !isMobileEnv)) {
        throw new Error('Transaction not supported in Prisma mode via ConnectionManager. Use Prisma transactions directly.')
      }
      const sqlite = await this.getSQLite()
      if (!sqlite) {
        throw new Error('Database not initialized. Please restart the app.')
      }
      await sqlite.transaction(queries)
    } catch (error) {
      throw new Error('Failed to execute transaction: ' + (error instanceof Error ? error.message : String(error)))
    }
  }
}

export const ConnectionManager = new ConnectionManagerClass()
