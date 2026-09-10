const { PrismaClient } = require('@prisma/client')
const fetch = globalThis.fetch || require('node-fetch')

async function main() {
  const prisma = new PrismaClient()
  try {
    const cls = await prisma.class.findFirst()
    if (!cls) {
      console.error('No class found in DB')
      process.exit(1)
    }
    const subjects = await prisma.subject.findMany({ take: 2 })
    if (!subjects || subjects.length === 0) {
      console.error('No subjects found in DB')
      process.exit(1)
    }

    const subjectIds = subjects.map(s => s.id)

    const res = await fetch('http://localhost:3001/api/shulea/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign-to-class', classId: cls.id, subjectIds }),
    })

    const data = await res.json()
    console.log('Status:', res.status)
    console.log('Response:', JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('Test failed:', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
