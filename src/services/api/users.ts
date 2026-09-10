import { UserRepository } from '@/repositories'
import { ApiClient, type ApiResponse } from './ApiClient'
import type { User } from '@/types'

type SafeUser = Omit<User, 'password' | 'securityAnswer'>

function sanitizeUser(user: User): SafeUser {
  const { password, securityAnswer, ...safeUser } = user
  return safeUser
}

export interface UsersListResponse {
  users: SafeUser[]
}

export const UsersApi = {
  async list(params?: { schoolId?: string }): Promise<ApiResponse<UsersListResponse>> {
    try {
      const users = await UserRepository.getAll({ schoolId: params?.schoolId })
      return ApiClient.success({ users: users.map(sanitizeUser) })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },
}
