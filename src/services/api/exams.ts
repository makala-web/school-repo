// Exams API Service
import { ExamRepository, type CreateExamInput, type UpdateExamInput } from '@/repositories'
import { ApiClient, type ApiResponse } from './ApiClient'
import type { ExamWithDetails } from '@/types'

export interface ExamsListResponse {
  exams: ExamWithDetails[]
}

export interface ExamResponse {
  exam: ExamWithDetails
}

export interface AcademicYearsResponse {
  years: string[]
}

export interface TermsResponse {
  terms: string[]
}

export const ExamsApi = {
  // GET /api/shulea/exams
  async list(params?: { schoolId?: string; classId?: string; academicYear?: string; term?: string }): Promise<ApiResponse<ExamsListResponse>> {
    try {
      const exams = await ExamRepository.getAll(params)
      return ApiClient.success({ exams })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/exams/:id
  async getById(id: string): Promise<ApiResponse<ExamResponse>> {
    try {
      const exam = await ExamRepository.getById(id)
      if (!exam) {
        return ApiClient.error('Exam not found')
      }
      return ApiClient.success({ exam })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/exams
  async create(data: CreateExamInput): Promise<ApiResponse<ExamResponse>> {
    try {
      const exam = await ExamRepository.create(data)
      const examWithDetails = await ExamRepository.getById(exam.id)
      return ApiClient.success({ exam: examWithDetails! }, 'Exam created successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // PUT /api/shulea/exams
  async update(data: UpdateExamInput): Promise<ApiResponse<ExamResponse>> {
    try {
      const exam = await ExamRepository.update(data)
      const examWithDetails = await ExamRepository.getById(exam.id)
      return ApiClient.success({ exam: examWithDetails! }, 'Exam updated successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // DELETE /api/shulea/exams?id=:id
  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      await ExamRepository.delete(id)
      return ApiClient.success({ message: 'Exam deleted successfully' })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/exams/academic-years?schoolId=:schoolId
  async getAcademicYears(schoolId: string): Promise<ApiResponse<AcademicYearsResponse>> {
    try {
      const years = await ExamRepository.getAcademicYears(schoolId)
      return ApiClient.success({ years })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/exams/terms?schoolId=:schoolId&academicYear=:year
  async getTerms(schoolId: string, academicYear: string): Promise<ApiResponse<TermsResponse>> {
    try {
      const terms = await ExamRepository.getTerms(schoolId, academicYear)
      return ApiClient.success({ terms })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  }
}
