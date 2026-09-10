import fs from 'node:fs'

const url = process.env.DATABASE_URL || ''
const schema = fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')
const isNetlifyProduction = process.env.CONTEXT === 'production' || (process.env.NETLIFY === 'true' && process.env.NODE_ENV === 'production')

if (!isNetlifyProduction) {
  console.log('Production storage check skipped outside Netlify production.')
  process.exit(0)
}

if (!url || url.startsWith('file:') || url.includes('custom.db')) {
  console.error('Production release blocked: DATABASE_URL must point to a durable managed database, not SQLite on the Netlify filesystem.')
  process.exit(1)
}

if (!/^postgres(ql)?:\/\//i.test(url)) {
  console.error('Production release blocked: DATABASE_URL must use a supported durable PostgreSQL connection.')
  process.exit(1)
}

if (!/provider\s*=\s*"postgresql"/.test(schema)) {
  console.error('Production release blocked: Prisma production schema still uses SQLite. Configure a PostgreSQL Prisma client/schema before setting a PostgreSQL DATABASE_URL.')
  process.exit(1)
}

console.log('Production storage check passed: durable PostgreSQL URL is configured server-side.')
