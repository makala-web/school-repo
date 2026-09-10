// Validation utilities for repository operations
// Ensures data integrity before database operations

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

// Validate required fields
export function validateRequired(data: Record<string, unknown>, fields: string[]): void {
  const missing = fields.filter(field => {
    const value = data[field]
    return value === undefined || value === null || value === ''
  })
  
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`)
  }
}

// Validate string length
export function validateLength(value: string, field: string, min: number, max: number): void {
  if (value.length < min || value.length > max) {
    throw new ValidationError(`${field} must be between ${min} and ${max} characters`)
  }
}

// Validate email format
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format')
  }
}

// Validate enum value
export function validateEnum<T extends string>(value: string, validValues: T[], field: string): void {
  if (!validValues.includes(value as T)) {
    throw new ValidationError(`${field} must be one of: ${validValues.join(', ')}`)
  }
}

// Sanitize string input
export function sanitizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return String(value).trim()
}

// Safe UUID generation with fallback
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
