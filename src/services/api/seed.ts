import { SchoolRepository } from '@/repositories/SchoolRepository'
import { SubjectRepository } from '@/repositories/SubjectRepository'
import { ClassRepository } from '@/repositories/ClassRepository'
import { UserRepository } from '@/repositories/UserRepository'
import { ApiClient, type ApiResponse } from './ApiClient'
import type { SchoolType } from '@/types'
import { getMasterSubjects } from '@/lib/subject-catalogue'

export const SeedApi = {
  // POST /api/shulea/seed
  async seedDefaults(params?: { schoolId?: string; schoolType?: SchoolType; includePP12?: boolean; userId?: string }): Promise<ApiResponse<{ message: string; results: Record<string, string | number> }>> {
    try {
      const results: Record<string, string | number> = {}

      // Get school info
      let schoolId = params?.schoolId
      let schoolType = params?.schoolType

      if (!schoolId) {
        const schools = await SchoolRepository.getAll()
        if (schools.length === 0) {
          return ApiClient.error('No school found. Please create a school first.')
        }
        schoolId = schools[0].id
        schoolType = schools[0].schoolType as SchoolType
      }

      if (!schoolType) {
        schoolType = 'PRIMARY'
      }
      const includePP12 = params?.includePP12 ?? true

      // 1. Seed default grading configs
      try {
        await SchoolRepository.seedGradingConfigs(schoolId, schoolType)
        results.gradingConfigs = 'Seeded successfully'
      } catch (error) {
        results.gradingConfigs = `Error: ${(error as Error).message}`
      }

      // 2. Seed default subjects
      const subjectsToSeed = getMasterSubjects(schoolType)
      let subjectsCreated = 0
      let subjectsSkipped = 0

      for (const subject of subjectsToSeed) {
        try {
          // Check if subject already exists
          const existing = await SubjectRepository.getAll({
            schoolId,
            schoolType,
          })
          const alreadyExists = existing.some(s => s.name === subject.name)
          
          if (!alreadyExists) {
            await SubjectRepository.create({
              name: subject.name,
              shortName: subject.shortName,
              schoolType,
              schoolId,
            })
            subjectsCreated++
          } else {
            subjectsSkipped++
          }
        } catch (error) {
          console.error(`Error seeding subject ${subject.name}:`, error)
        }
      }

      results.subjectsCreated = subjectsCreated
      results.subjectsSkipped = subjectsSkipped

      // 3. Seed default classes if the school has none
      const existingClasses = await ClassRepository.getAll({ schoolId })
      let classesCreated = 0
      if (existingClasses.length === 0) {
        const classNames = schoolType === 'PRIMARY'
          ? includePP12
            ? ['PP I', 'PP II', 'STD 1', 'STD 2', 'STD 3', 'STD 4', 'STD 5', 'STD 6', 'STD 7']
            : ['STD 1', 'STD 2', 'STD 3', 'STD 4', 'STD 5', 'STD 6', 'STD 7']
          : ['Form 1', 'Form 2', 'Form 3', 'Form 4']

        for (const className of classNames) {
          await ClassRepository.create({
            name: className,
            fullName: className,
            schoolType,
            schoolId,
            academicYear: new Date().getFullYear().toString(),
            term: 'FIRST TERM',
          })
          classesCreated++
        }
      }
      results.classesCreated = classesCreated

      // Class subjects are selected intentionally in the Subjects screen.
      const classSubjectsLinked = 0
      results.classSubjectsLinked = 'Assign subjects per class from Subjects'

      if (params?.userId) {
        const user = await UserRepository.getById(params.userId)
        if (user && !user.schoolId) {
          await UserRepository.update(params.userId, { schoolId, schoolType })
          results.userLinked = 'Linked current user to school'
        } else if (user?.schoolId) {
          results.userLinked = 'Current user already linked'
        }
      }

      return ApiClient.success({
        results,
        message: `Seed completed: ${subjectsCreated} subjects created, ${classesCreated} classes created, ${classSubjectsLinked} subject links added`,
      })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },
}
