// Classes API Service
import { ClassRepository, type CreateClassInput, type UpdateClassInput } from '@/repositories'
import { ApiClient, type ApiResponse } from './ApiClient'
import type { ClassWithDetails, Student, Subject } from '@/types'

export interface ClassesListResponse {
  classes: ClassWithDetails[]
}

export interface ClassResponse {
  class: ClassWithDetails
}

export interface ClassStudentsResponse {
  students: Student[]
}

export interface ClassSubjectsResponse {
  subjects: Array<{ id: string; subjectId: string; name: string; shortName?: string | null }>
}

export const ClassesApi = {
  // GET /api/shulea/classes
  async list(params?: { schoolId?: string; schoolType?: 'PRIMARY' | 'SECONDARY' }): Promise<ApiResponse<ClassesListResponse>> {
    try {
      const classes = await ClassRepository.getAll(params)
      return ApiClient.success({ classes })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/classes/:id
  async getById(id: string): Promise<ApiResponse<ClassResponse>> {
    try {
      const cls = await ClassRepository.getById(id)
      if (!cls) {
        return ApiClient.error('Class not found')
      }
      return ApiClient.success({ class: cls })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/classes
  async create(data: CreateClassInput): Promise<ApiResponse<ClassResponse>> {
    try {
      const cls = await ClassRepository.create(data)
      const clsWithDetails = await ClassRepository.getById(cls.id)
      return ApiClient.success({ class: clsWithDetails! }, 'Class created successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // PUT /api/shulea/classes
  async update(data: UpdateClassInput): Promise<ApiResponse<ClassResponse>> {
    try {
      const cls = await ClassRepository.update(data)
      const clsWithDetails = await ClassRepository.getById(cls.id)
      return ApiClient.success({ class: clsWithDetails! }, 'Class updated successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // DELETE /api/shulea/classes?id=:id
  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      await ClassRepository.delete(id)
      return ApiClient.success({ message: 'Class deleted successfully' })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/classes/:id/students
  async getStudents(classId: string): Promise<ApiResponse<ClassStudentsResponse>> {
    try {
      const students = await ClassRepository.getStudents(classId)
      return ApiClient.success({ students })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/classes/:id/subjects
  async getSubjects(classId: string): Promise<ApiResponse<ClassSubjectsResponse>> {
    try {
      const subjects = await ClassRepository.getSubjects(classId)
      return ApiClient.success({ subjects })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/classes/:id/subjects
  async assignSubject(classId: string, subjectId: string): Promise<ApiResponse<{ message: string }>> {
    try {
      await ClassRepository.assignSubject(classId, subjectId)
      return ApiClient.success({ message: 'Subject assigned to class' })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // DELETE /api/shulea/classes/:id/subjects/:subjectId
  async removeSubject(classId: string, subjectId: string): Promise<ApiResponse<{ message: string }>> {
    try {
      await ClassRepository.removeSubject(classId, subjectId)
      return ApiClient.success({ message: 'Subject removed from class' })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  }
}
