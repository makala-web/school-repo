import { ConnectionManager } from './ConnectionManager'
import { SchemaManager } from './SchemaManager'
import type { User as StoreUser } from '@/lib/store'

const LOCAL_SCOPE_KEY = 'offline-local-scope'
const VERIFIER_PREFIX = 'offline-pbkdf2:v1'
const PBKDF2_ITERATIONS = 210_000

type OfflineUser = StoreUser & {
  username?: string
  active?: boolean
  isDemoUser?: boolean
  deviceId?: string | null
  createdAt?: string
  updatedAt?: string
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

async function derivePasswordKey(password: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Secure offline authentication requires Web Crypto support on this device.')
  }
  const passwordBytes = new TextEncoder().encode(password)
  const material = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(passwordBytes),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: toArrayBuffer(salt), iterations },
    material,
    256,
  )
  return new Uint8Array(bits)
}

export async function createOfflinePasswordVerifier(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivePasswordKey(password, salt)
  return `${VERIFIER_PREFIX}:${PBKDF2_ITERATIONS}:${bytesToBase64(salt)}:${bytesToBase64(hash)}`
}

export async function verifyOfflinePassword(password: string, verifier: string) {
  if (!verifier.startsWith(`${VERIFIER_PREFIX}:`)) return false
  const [, , iterationsRaw, saltRaw, hashRaw] = verifier.split(':')
  const iterations = Number(iterationsRaw)
  if (!Number.isInteger(iterations) || iterations < 100_000 || !saltRaw || !hashRaw) return false
  const expected = base64ToBytes(hashRaw)
  const actual = await derivePasswordKey(password, base64ToBytes(saltRaw), iterations)
  return timingSafeEqual(actual, expected)
}

async function prepareLocalScope(user: OfflineUser) {
  if (!user.id || !user.schoolId) throw new Error('Offline login requires a school-scoped user.')
  ConnectionManager.setMode('sqlite')
  await ConnectionManager.getSQLite()
  await SchemaManager.initialize()

  const expected = `${user.id}:${user.schoolId}`
  const current = await ConnectionManager.query<{ value: string }>(
    'SELECT value FROM AppSetting WHERE key = ? LIMIT 1',
    [LOCAL_SCOPE_KEY],
  )
  if (current[0]?.value && current[0].value !== expected) {
    await SchemaManager.reset()
    await SchemaManager.initialize()
  }
  await ConnectionManager.execute(
    'INSERT INTO AppSetting (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [LOCAL_SCOPE_KEY, LOCAL_SCOPE_KEY, expected],
  )
}

async function upsertOfflineUser(user: OfflineUser, passwordVerifier: string) {
  const now = new Date().toISOString()
  const school = user.school
  const schoolRecord = (school || {}) as Record<string, unknown>
  const schoolType = user.schoolType === 'SECONDARY' || school?.schoolType === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY'

  if (school?.id) {
    await ConnectionManager.execute(
      `INSERT INTO School (id, name, schoolType, logo, logo2, registrationNo, council, region, district, ward, phone, headTeacherName, licenseType, licenseStatus, expiryDate, isDemo, maxTeachers, maxDevices, maxStudents, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, schoolType = excluded.schoolType, logo = excluded.logo, logo2 = excluded.logo2, registrationNo = excluded.registrationNo, council = excluded.council, region = excluded.region, district = excluded.district, ward = excluded.ward, phone = excluded.phone, headTeacherName = excluded.headTeacherName, licenseType = excluded.licenseType, licenseStatus = excluded.licenseStatus, expiryDate = excluded.expiryDate, isDemo = excluded.isDemo, maxTeachers = excluded.maxTeachers, maxDevices = excluded.maxDevices, maxStudents = excluded.maxStudents, updatedAt = excluded.updatedAt`,
      [
        school.id,
        school.name || 'Shulea School',
        schoolType,
        school.logo || null,
        school.logo2 || null,
        school.registrationNo || null,
        school.council || null,
        school.region || null,
        school.district || null,
        school.ward || null,
        school.phone || null,
        school.headTeacherName || null,
        school.licenseType || null,
        school.licenseStatus || 'ACTIVE',
        school.expiryDate || null,
        school.isDemo ? 1 : 0,
        school.maxTeachers || null,
        school.maxDevices || null,
        typeof schoolRecord.maxStudents === 'number' ? schoolRecord.maxStudents : null,
        now,
        now,
      ],
    )
  }

  await ConnectionManager.execute(
    `INSERT INTO User (id, email, username, password, fullName, role, active, schoolId, schoolType, isDemoUser, deviceId, lastSchoolAccessAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email, username = excluded.username, password = excluded.password, fullName = excluded.fullName, role = excluded.role, active = excluded.active, schoolId = excluded.schoolId, schoolType = excluded.schoolType, isDemoUser = excluded.isDemoUser, deviceId = excluded.deviceId, lastSchoolAccessAt = excluded.lastSchoolAccessAt, updatedAt = excluded.updatedAt`,
    [
      user.id,
      user.email,
      user.username || user.email,
      passwordVerifier,
      user.fullName || user.email,
      user.role || 'TEACHER',
      user.active === false ? 0 : 1,
      user.schoolId || school?.id || null,
      schoolType,
      user.isDemoUser ? 1 : 0,
      user.deviceId || null,
      now,
      user.createdAt || now,
      user.updatedAt || now,
    ],
  )
}

export async function provisionOfflineLogin(user: OfflineUser, password: string) {
  await prepareLocalScope(user)
  await upsertOfflineUser(user, await createOfflinePasswordVerifier(password))
}

export async function provisionOfflineDemo(user: OfflineUser) {
  await prepareLocalScope({ ...user, isDemoUser: true })
  await upsertOfflineUser({ ...user, isDemoUser: true }, `${VERIFIER_PREFIX}:demo-disabled`)
}
