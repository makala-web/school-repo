// School API Service
import { SchoolRepository, type CreateSchoolInput, type UpdateSchoolInput } from '@/repositories'
import { ApiClient, type ApiResponse } from './ApiClient'
import type { School, SchoolWithCounts, GradingConfig, SchoolType } from '@/types'

export interface SchoolListResponse {
  schools: School[]
}

export interface SchoolResponse {
  school: SchoolWithCounts
}

export interface GradingConfigsResponse {
  gradingConfigs: GradingConfig[]
}

export const SchoolApi = {
  // GET /api/shulea/school
  async list(): Promise<ApiResponse<SchoolListResponse>> {
    try {
      const schools = await SchoolRepository.getAll()
      return ApiClient.success({ schools })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/school/:id
  async getById(id: string): Promise<ApiResponse<SchoolResponse>> {
    try {
      const school = await SchoolRepository.getWithCounts(id)
      if (!school) {
        return ApiClient.error('School not found')
      }
      return ApiClient.success({ school })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/school
  async create(data: CreateSchoolInput): Promise<ApiResponse<SchoolResponse>> {
    try {
      const school = await SchoolRepository.create(data)
      const schoolWithCounts = await SchoolRepository.getWithCounts(school.id)
      
      // Seed default grading configs
      await SchoolRepository.seedGradingConfigs(school.id, school.schoolType as SchoolType)
      
      return ApiClient.success({ school: schoolWithCounts! }, 'School created successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // PUT /api/shulea/school
  async update(data: UpdateSchoolInput): Promise<ApiResponse<SchoolResponse>> {
    try {
      const school = await SchoolRepository.update(data)
      const schoolWithCounts = await SchoolRepository.getWithCounts(school.id)
      return ApiClient.success({ school: schoolWithCounts! }, 'School updated successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // DELETE /api/shulea/school?id=:id
  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      await SchoolRepository.delete(id)
      return ApiClient.success({ message: 'School deleted successfully' })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/school/:id/grading
  async getGradingConfigs(schoolId: string, schoolType?: 'PRIMARY' | 'SECONDARY'): Promise<ApiResponse<GradingConfigsResponse>> {
    try {
      const gradingConfigs = await SchoolRepository.getGradingConfigs(schoolId, schoolType)
      return ApiClient.success({ gradingConfigs })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/school/:id/grading
  async createGradingConfig(
    schoolId: string,
    data: Omit<GradingConfig, 'id' | 'schoolId' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<{ config: GradingConfig }>> {
    try {
      const config = await SchoolRepository.createGradingConfig({
        schoolType: data.schoolType,
        grade: data.grade,
        minMark: data.minMark,
        maxMark: data.maxMark,
        remarks: data.remarks,
        points: data.points ?? undefined,
        division: data.division ?? undefined,
        schoolId
      })
      return ApiClient.success({ config })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async initGrading(schoolId: string, schoolType: SchoolType): Promise<ApiResponse<{ message: string }>> {
    try {
      await SchoolRepository.seedGradingConfigs(schoolId, schoolType)
      return ApiClient.success({ message: `Default grading configuration created for ${schoolType}` })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async updateGradingConfig(data: {
    id: string
    grade?: string
    minMark?: number
    maxMark?: number
    remarks?: string
    points?: number | null
    division?: string | null
  }): Promise<ApiResponse<{ gradingConfig: GradingConfig }>> {
    try {
      const gradingConfig = await SchoolRepository.updateGradingConfig(data)
      return ApiClient.success({ gradingConfig }, 'Grading config updated successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/school/:id/seed
  async seedDefaults(schoolId: string, schoolType: 'PRIMARY' | 'SECONDARY'): Promise<ApiResponse<{ message: string }>> {
    try {
      await SchoolRepository.seedGradingConfigs(schoolId, schoolType)
      return ApiClient.success({ message: 'Default grading configurations seeded' })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  }
}
