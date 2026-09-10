import { PrismaClient } from '@prisma/client'

// Netlify Database integrations can expose the connection under a provider
// variable. Resolve it only on the server, before PrismaClient is created.
// Never expose these values to browser bundles or logs.
if (!process.env.DATABASE_URL) {
  const providerDatabaseUrl = process.env.NETLIFY_DB_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL_UNPOOLED
  if (providerDatabaseUrl) process.env.DATABASE_URL = providerDatabaseUrl
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
