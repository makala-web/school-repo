import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
try {
  const schools = await db.school.findMany({
    where: { isDemo: true },
    include: { _count: { select: { classes: true, students: true, subjects: true, exams: true, teachers: true } } },
  })
  for (const school of schools) {
    const classes = await db.class.findMany({ where: { schoolId: school.id }, select: { id: true, name: true } })
    const students = await db.student.count({ where: { schoolId: school.id } })
    const marks = await db.marksEntry.count({ where: { student: { schoolId: school.id } } })
    const results = await db.studentResult.count({ where: { student: { schoolId: school.id } } })
    const attendance = await db.attendance.count({ where: { student: { schoolId: school.id } } })
    console.log(JSON.stringify({ school: school.name, type: school.schoolType, counts: school._count, classes, students, marks, results, attendance }))
  }
} finally {
  await db.$disconnect()
}
