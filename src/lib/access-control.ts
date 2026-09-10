export type LicenseStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED' | 'CANCELLED' | 'LIFETIME'
export type UserRole = 'TEACHER' | 'SCHOOL_ADMIN' | 'SUPER_ADMIN'
export type DeviceStatus = 'ACTIVE' | 'REVOKED' | 'SUSPENDED'
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'

export interface SchoolLicenseLike {
  status?: string | null
  licenseType?: string | null
  expiryDate?: string | null
  startDate?: string | null
  maxTeachers?: number | null
  maxDevices?: number | null
  maxStudents?: number | null
}

export interface DeviceLike {
  deviceId: string
  schoolId: string
  userId: string
  status?: string | null
  activatedAt?: string | null
  lastSeenAt?: string | null
}

export const DEMO_ACCESS_DETAILS = {
  demoDays: 30,
  primaryPrice: 200000,
  secondaryPrice: 250000,
  supportPhone: '0623424892 / 0658819275',
  demoMessage: 'Demo environment is isolated from production school data.',
}

export const DEMO_SCHOOL_ID = 'demo-school'

export function calculateDemoEndDate(fromDate: Date = new Date()): Date {
  const next = new Date(fromDate)
  next.setDate(next.getDate() + DEMO_ACCESS_DETAILS.demoDays)
  return next
}

export function getSchoolLicenseStatus(license: Partial<SchoolLicenseLike> = {}) {
  const status = (license.status || 'ACTIVE').toUpperCase()
  const licenseType = (license.licenseType || '').toUpperCase()
  if (status === 'LIFETIME' || licenseType === 'LIFETIME') {
    return { isActive: true, reason: 'LIFETIME', message: 'Lifetime license is active and authorized for this school.' }
  }
  const expiryDate = license.expiryDate ? new Date(license.expiryDate) : null
  const now = new Date()
  const expired = expiryDate && !Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() < now.getTime()

  if (status === 'REVOKED') {
    return { isActive: false, reason: 'REVOKED', message: 'This school has been revoked. Please contact Shulea Administrator.' }
  }

  if (status === 'SUSPENDED') {
    return { isActive: false, reason: 'SUSPENDED', message: 'This school license is suspended. Please contact Shulea Administrator.' }
  }

  if (status === 'CANCELLED') {
    return { isActive: false, reason: 'CANCELLED', message: 'This school license has been cancelled. Please contact Shulea Administrator.' }
  }

  if (status === 'EXPIRED' || expired) {
    return { isActive: false, reason: 'EXPIRED', message: 'This school license has expired. Please renew the license to continue.' }
  }

  if (status === 'ACTIVE') {
    return { isActive: true, reason: 'ACTIVE', message: 'License is active and authorized for this school.' }
  }

  return { isActive: false, reason: status || 'UNKNOWN', message: 'School access is not authorized.' }
}

export function isLicenseActiveForSchool(license: Partial<SchoolLicenseLike> = {}): boolean {
  return getSchoolLicenseStatus(license).isActive
}

// Device Management Functions
export function generateDeviceId(): string {
  // Generate a unique device identifier based on browser fingerprint
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let fingerprint = ''
  
  if (ctx) {
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillText('Shulea Device Fingerprint', 2, 2)
    fingerprint = canvas.toDataURL().slice(-20)
  }
  
  // Add additional browser-specific data
  const browserData = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage,
  ].join('|')
  
  // Simple hash of the combined data
  let hash = 0
  const data = fingerprint + browserData
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  return 'DEV-' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')
}

export function getDeviceInfo() {
  return {
    deviceId: generateDeviceId(),
    platform: getPlatform(),
    userAgent: navigator.userAgent,
    deviceName: getDeviceName(),
  }
}

function getPlatform(): string {
  const ua = navigator.userAgent
  if (ua.includes('Win')) return 'Windows'
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'
  return 'Unknown'
}

function getDeviceName(): string {
  const platform = getPlatform()
  const ua = navigator.userAgent
  if (platform === 'Android') {
    const match = ua.match(/Android\s([0-9\.]+)/)
    return match ? `Android ${match[1]}` : 'Android Device'
  }
  if (platform === 'iOS') {
    const match = ua.match(/OS\s([0-9_]+)/)
    return match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS Device'
  }
  return platform
}

export function checkDeviceAuthorization(
  device: Partial<DeviceLike> = {},
  maxDevices: number = 20,
  currentDeviceCount: number = 0
) {
  const status = (device.status || 'ACTIVE').toUpperCase()
  
  if (status === 'REVOKED') {
    return { isAuthorized: false, reason: 'REVOKED', message: 'This device has been revoked. Please contact your school administrator.' }
  }
  
  if (status === 'SUSPENDED') {
    return { isAuthorized: false, reason: 'SUSPENDED', message: 'This device has been suspended. Please contact your school administrator.' }
  }
  
  if (currentDeviceCount >= maxDevices) {
    return { isAuthorized: false, reason: 'LIMIT_REACHED', message: `Device limit reached (${maxDevices}). Please contact your school administrator to authorize this device.` }
  }
  
  if (status === 'ACTIVE') {
    return { isAuthorized: true, reason: 'ACTIVE', message: 'Device is authorized.' }
  }
  
  return { isAuthorized: false, reason: status || 'UNKNOWN', message: 'Device authorization status unknown.' }
}

export function isDeviceAuthorized(device: Partial<DeviceLike> = {}, maxDevices: number = 20, currentDeviceCount: number = 0): boolean {
  return checkDeviceAuthorization(device, maxDevices, currentDeviceCount).isAuthorized
}

// Role-Based Access Control
export function hasPermission(userRole: string, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    'TEACHER': 1,
    'SCHOOL_ADMIN': 2,
    'SUPER_ADMIN': 3,
  }
  
  const userLevel = roleHierarchy[userRole as UserRole] || 0
  const requiredLevel = roleHierarchy[requiredRole] || 0
  
  return userLevel >= requiredLevel
}

export function canManageSchool(userRole: string): boolean {
  return hasPermission(userRole, 'SCHOOL_ADMIN')
}

export function canManagePlatform(userRole: string): boolean {
  return userRole === 'SUPER_ADMIN'
}

export function canManageTeachers(userRole: string): boolean {
  return hasPermission(userRole, 'SCHOOL_ADMIN')
}

export function canManageDevices(userRole: string): boolean {
  return hasPermission(userRole, 'SCHOOL_ADMIN')
}

export function canInviteTeachers(userRole: string): boolean {
  return hasPermission(userRole, 'SCHOOL_ADMIN')
}

// School Isolation
export function canAccessSchool(userSchoolId: string | null, targetSchoolId: string): boolean {
  if (!userSchoolId) return false
  return userSchoolId === targetSchoolId
}

export function validateSchoolAccess(userSchoolId: string | null, targetSchoolId: string, userRole: string): boolean {
  // Super admins can access any school
  if (userRole === 'SUPER_ADMIN') return true
  
  // Other users can only access their own school
  return canAccessSchool(userSchoolId, targetSchoolId)
}

// Invitation Management
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No I, O, 0, 1 to avoid confusion
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export function generateActivationCode(): string {
  const prefix = 'SHL-'
  const chars = '0123456789'
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return prefix + code
}

export function isInvitationValid(invitation: { status: string; expiresAt: string }): boolean {
  const status = invitation.status.toUpperCase()
  if (status !== 'PENDING') return false
  
  const expiryDate = new Date(invitation.expiresAt)
  const now = new Date()
  return expiryDate > now
}

export function createDemoUser() {
  return {
    id: 'demo-user',
    email: 'demo@shulea.app',
    username: 'demo-user',
    fullName: 'Demo Teacher',
    role: 'TEACHER',
    active: true,
    schoolId: DEMO_SCHOOL_ID,
    schoolType: 'PRIMARY',
    school: {
      id: DEMO_SCHOOL_ID,
      name: 'Muzdalifah Islamic Primary School',
      schoolType: 'PRIMARY',
      registrationNo: 'DEMO-30',
      phone: DEMO_ACCESS_DETAILS.supportPhone,
    },
  }
}
