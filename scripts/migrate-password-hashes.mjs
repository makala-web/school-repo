import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

try {
  const users = await db.user.findMany({
    where: { passwordHash: null },
    select: { id: true, password: true },
  })

  for (const user of users) {
    if (user.password) await db.user.update({ where: { id: user.id }, data: { passwordHash: user.password } })
  }

  console.log(`Password hash migration complete. Backfilled ${users.filter((user) => Boolean(user.password)).length} users.`)
} finally {
  await db.$disconnect()
}
