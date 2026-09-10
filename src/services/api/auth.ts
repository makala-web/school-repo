// Auth API Service
// Replaces /api/shulea/auth route - uses repositories directly
// Uses Web Crypto API for browser/mobile compatibility

import { SchoolRepository, SubjectRepository, UserRepository } from '@/repositories'
import { validateStrongPassword } from '@/modules/settings'
import { ApiClient, type ApiResponse } from './ApiClient'
import type { User } from '@/types'

// Browser-compatible SHA-256 hashing using Web Crypto API
// Falls back to simple hash for environments without crypto.subtle support
export async function sha256(message: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(message)
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    }
  } catch {
    // crypto.subtle not available, fall through to fallback
  }
  
  // Simple fallback hash for Capacitor/WebView environments
  // This is less secure but works everywhere
  let hash = 0
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(64, '0')
}

// Helper functions for password hashing
async function hashPassword(password: string): Promise<string> {
  return sha256(password)
}

async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  const hashedInput = await sha256(password)
  return hashedInput === hashed
}

// Sanitize user data (remove sensitive fields)
function sanitizeUser(user: User) {
  const { password, securityAnswer, ...userData } = user
  return userData
}

export const AuthApi = {
  // GET /api/shulea/auth - Check if any users exist
  async checkUsers(): Promise<ApiResponse<{ hasUsers: boolean; userCount: number }>> {
    try {
      const userCount = await UserRepository.count()
      return ApiClient.success({ hasUsers: userCount > 0, userCount })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/auth - Handle login
  async login(data: { 
    email: string
    password: string 
  }): Promise<ApiResponse<{ message: string; user: Omit<User, 'password' | 'securityAnswer'> }>> {
    try {
      const { email, password } = data

      if (!email || !password) {
        return ApiClient.error('Email and password are required')
      }

      // Find user by email
      const user = await UserRepository.getByEmail(email)

      if (!user) {
        return ApiClient.error('Account is not available in this offline database. Connect to the internet and try again, or use an invitation/request access.')
      }

      const isPasswordValid = await verifyPassword(password, user.password)
      if (!isPasswordValid) {
        return ApiClient.error('Incorrect password. Try again or reset your password.')
      }

      if (!user.active) {
        return ApiClient.error('Account is deactivated')
      }

      if (user.schoolId && (!user.school || !user.school.id)) {
        const school = await SchoolRepository.getById(user.schoolId)
        if (school) {
          user.school = school
        }
      }

      return ApiClient.success({
        message: 'Login successful',
        user: sanitizeUser(user)
      })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/auth - Handle register
  async register(data: {
    email: string
    username: string
    password: string
    fullName: string
    schoolType: 'PRIMARY' | 'SECONDARY'
    securityQuestion: string
    securityAnswer: string
    schoolId?: string
  }): Promise<ApiResponse<{ message: string; user: Omit<User, 'password' | 'securityAnswer'> }>> {
    try {
      const { email, username, password, fullName, schoolType, securityQuestion, securityAnswer, schoolId } = data

      if (!email || !username || !password || !fullName || !schoolType || !securityQuestion || !securityAnswer) {
        return ApiClient.error('All fields are required')
      }
      if (!['PRIMARY', 'SECONDARY'].includes(schoolType)) {
        return ApiClient.error('Invalid school type. Must be PRIMARY or SECONDARY')
      }

      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return ApiClient.error('Please enter a valid email address')
      }

      // Validate strong password
      const passwordCheck = validateStrongPassword(password)
      if (!passwordCheck.valid) {
        return ApiClient.error(passwordCheck.message)
      }

      // Check if email already exists
      const existingEmail = await UserRepository.getByEmail(email)
      if (existingEmail) {
        return ApiClient.error('An account with this email already exists')
      }

      // Check if username already exists
      const existingUsername = await UserRepository.getByUsername(username)
      if (existingUsername) {
        return ApiClient.error('Username already taken')
      }

      let schoolIdToUse = schoolId
      if (!schoolIdToUse) {
        const school = await SchoolRepository.create({
          name: `${fullName}'s School`,
          schoolType,
        })
        schoolIdToUse = school.id
        await SubjectRepository.seedSubjects(schoolIdToUse, schoolType)
        await SchoolRepository.seedGradingConfigs(schoolIdToUse, schoolType)
      }

      // Create user
      const user = await UserRepository.create({
        email,
        username,
        password: await hashPassword(password),
        fullName,
        role: 'TEACHER',
        schoolId: schoolIdToUse,
        schoolType,
        securityQuestion,
        securityAnswer: await hashPassword(securityAnswer.toLowerCase().trim())
      })

      return ApiClient.success({
        message: 'Registration successful! Please log in.',
        user: sanitizeUser(user)
      })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/auth - Handle change password
  async changePassword(data: {
    userId: string
    currentPassword: string
    newPassword: string
  }): Promise<ApiResponse<{ message: string }>> {
    try {
      const { userId, currentPassword, newPassword } = data

      if (!userId || !currentPassword || !newPassword) {
        return ApiClient.error('All fields are required')
      }

      // Validate strong password
      const passwordCheck = validateStrongPassword(newPassword)
      if (!passwordCheck.valid) {
        return ApiClient.error(passwordCheck.message)
      }

      const user = await UserRepository.getById(userId)
      if (!user) {
        return ApiClient.error('User not found')
      }

      const isCurrentValid = await verifyPassword(currentPassword, user.password)
      if (!isCurrentValid) {
        return ApiClient.error('Current password is incorrect')
      }

      await UserRepository.update(user.id, {
        password: await hashPassword(newPassword)
      })

      return ApiClient.success({
        message: 'Password changed successfully'
      })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  }
}
