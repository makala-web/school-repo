import fs from 'node:fs'
import path from 'node:path'

// Load the local .env without printing secrets or requiring a dotenv package.
const envFile = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.SUPER_ADMIN_PASSWORD
const fullName = process.env.SUPER_ADMIN_NAME?.trim() || 'Shulea System Owner'

if (!email || !password) {
  console.error('Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD before running this command.')
  process.exit(1)
}
if (password.length < 12) {
  console.error('SUPER_ADMIN_PASSWORD must be at least 12 characters long.')
  process.exit(1)
}
if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) {
  console.error('SUPER_ADMIN_PASSWORD must include uppercase, lowercase, number, and special character.')
  process.exit(1)
}

const { PrismaClient } = await import('@prisma/client')
const argon2 = await import('argon2')
const db = new PrismaClient()

try {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19 * 1024, timeCost: 2, parallelism: 1 })
  const existing = await db.user.findUnique({ where: { email } })
  const username = existing?.username || `owner_${email.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 24)}`
  const user = await db.user.upsert({
    where: { email },
    update: { password: passwordHash, passwordHash, fullName, role: 'SUPER_ADMIN', active: true, schoolId: null, schoolType: null, isDemoUser: false },
    create: { email, username, password: passwordHash, passwordHash, fullName, role: 'SUPER_ADMIN', active: true, isDemoUser: false },
  })
  console.log(`Super Admin ready: ${user.email}`)
  console.log(`Username: ${user.username}`)
  console.log('Password was hashed with Argon2id and was not printed.')
} finally {
  await db.$disconnect()
}
