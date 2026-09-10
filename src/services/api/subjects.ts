// Subjects API Service
import { SubjectRepository, type CreateSubjectInput, type UpdateSubjectInput } from '@/repositories'
import { ApiClient, type ApiResponse } from './ApiClient'
import type { SubjectWithClasses, SchoolType } from '@/types'

export interface SubjectsListResponse {
  subjects: SubjectWithClasses[]
}

export interface SubjectResponse {
  subject: SubjectWithClasses
}

export const SubjectsApi = {
  // GET /api/shulea/subjects
  async list(params?: { schoolId?: string; schoolType?: SchoolType }): Promise<ApiResponse<SubjectsListResponse>> {
    try {
      const subjects = await SubjectRepository.getAll(params)
      return ApiClient.success({ subjects })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/subjects/:id
  async getById(id: string): Promise<ApiResponse<SubjectResponse>> {
    try {
      const subject = await SubjectRepository.getById(id)
      if (!subject) {
        return ApiClient.error('Subject not found')
      }
      return ApiClient.success({ subject })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/subjects
  async create(data: CreateSubjectInput): Promise<ApiResponse<SubjectResponse>> {
    try {
      const subject = await SubjectRepository.create(data)
      const subjectWithClasses = await SubjectRepository.getById(subject.id)
      return ApiClient.success({ subject: subjectWithClasses! }, 'Subject created successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // PUT /api/shulea/subjects
  async update(data: UpdateSubjectInput): Promise<ApiResponse<SubjectResponse>> {
    try {
      const subject = await SubjectRepository.update(data)
      const subjectWithClasses = await SubjectRepository.getById(subject.id)
      return ApiClient.success({ subject: subjectWithClasses! }, 'Subject updated successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // DELETE /api/shulea/subjects?id=:id
  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      await SubjectRepository.delete(id)
      return ApiClient.success({ message: 'Subject deleted successfully' })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/subjects/seed
  async seedDefaults(schoolId: string, schoolType: SchoolType): Promise<ApiResponse<{ message: string }>> {
    try {
      await SubjectRepository.seedSubjects(schoolId, schoolType)
      return ApiClient.success({ message: 'Default subjects seeded' })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  }
}
