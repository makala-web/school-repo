import { TabiaRepository, type CreateTabiaInput, type UpdateTabiaInput } from '@/repositories/TabiaRepository'
import { ApiClient, type ApiResponse } from './ApiClient'
import type { Tabia } from '@/types'

export interface TabiaListResponse {
  records: Tabia[]
}

export interface TabiaResponse {
  record: Tabia
}

export const TabiaApi = {
  // GET /api/shulea/tabia
  async list(params?: { studentId?: string; classId?: string; examId?: string }): Promise<ApiResponse<TabiaListResponse>> {
    try {
      const records = await TabiaRepository.getAll(params)
      return ApiClient.success({ records })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/tabia/:id
  async getById(id: string): Promise<ApiResponse<TabiaResponse>> {
    try {
      const record = await TabiaRepository.getById(id)
      if (!record) {
        return ApiClient.error('Tabia record not found')
      }
      return ApiClient.success({ record })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/tabia
  async create(data: CreateTabiaInput): Promise<ApiResponse<TabiaResponse>> {
    try {
      const record = await TabiaRepository.create(data)
      return ApiClient.success({ record }, 'Tabia recorded successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // PUT /api/shulea/tabia
  async update(data: UpdateTabiaInput): Promise<ApiResponse<TabiaResponse>> {
    try {
      const record = await TabiaRepository.update(data)
      return ApiClient.success({ record }, 'Tabia updated successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // DELETE /api/shulea/tabia?id=:id
  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      await TabiaRepository.delete(id)
      return ApiClient.success({ message: 'Tabia record deleted successfully' })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/tabia/bulk-save
  async bulkSave(
    classId: string,
    examId: string,
    records: Array<{
      studentId: string
      discipline?: string
      hygiene?: string
      hardWorking?: string
      cooperation?: string
      honesty?: string
      leadership?: string
      sports?: string
    }>
  ): Promise<ApiResponse<{ records: Tabia[]; message: string }>> {
    try {
      const saved = await TabiaRepository.bulkSaveForExam(classId, examId, records)
      return ApiClient.success({ records: saved, message: `${saved.length} tabia records saved` })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },
}
