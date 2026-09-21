import { ConnectionManager } from './ConnectionManager'

export interface OfflineMutation {
  id?: number
  operationId: string
  operationKey?: string
  endpoint: string
  method: string
  body: string
  userId: string
  schoolId: string
  createdAt: string
  attempts: number
  lastAttemptAt?: string
  nextAttemptAt?: string
  lastError?: string
  baseVersion?: number
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'DEAD_LETTER'
}

export interface OfflineSyncStatus {
  pending: number
  failed: number
  deadLetter: number
  nextRetryAt: string | null
  lastError: string | null
}

const DB_NAME = 'shulea-offline-sync'
const STORE_NAME = 'mutations'
const MAX_RETRY_ATTEMPTS = 8
const SYNC_PRIORITY: Record<string, number> = {
  '/api/shulea/classes': 10,
  '/api/shulea/subjects': 20,
  '/api/shulea/teachers': 30,
  '/api/shulea/class-teacher-assignments': 40,
  '/api/shulea/students': 50,
  '/api/shulea/exams': 60,
  '/api/shulea/attendance': 70,
  '/api/shulea/marks': 80,
  '/api/shulea/results': 90,
  '/api/shulea/tabia': 95,
  '/api/shulea/grading': 100,
}
let activeFlush: Promise<{ synced: number; pending: number }> | null = null

function buildOperationKey(mutation: Pick<OfflineMutation, 'userId' | 'schoolId' | 'endpoint' | 'method' | 'body'>): string {
  const value = `${mutation.userId}:${mutation.schoolId}:${mutation.endpoint}:${mutation.method}:${mutation.body}`
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `op-${(hash >>> 0).toString(16)}`
}

function sortQueuedMutations(items: OfflineMutation[]) {
  return [...items].sort((a, b) => {
    const aPriority = SYNC_PRIORITY[a.endpoint.split('?')[0]] ?? 999
    const bPriority = SYNC_PRIORITY[b.endpoint.split('?')[0]] ?? 999
    if (aPriority !== bPriority) return aPriority - bPriority
    return (a.createdAt || '').localeCompare(b.createdAt || '') || (a.id ?? 0) - (b.id ?? 0)
  })
}

async function dependencyReadyForItem(item: OfflineMutation): Promise<boolean> {
  if (typeof window === 'undefined') return true
  const payload = (() => {
    try { return JSON.parse(item.body) as Record<string, unknown> } catch { return {} as Record<string, unknown> }
  })()
  const path = item.endpoint.split('?')[0]

  if (path === '/api/shulea/subjects' && payload.action === 'assign-to-class' && typeof payload.classId === 'string') {
    const rows = await ConnectionManager.query<{ id: string }>('SELECT id FROM Class WHERE id = ? AND schoolId = ? LIMIT 1', [payload.classId, item.schoolId])
    return rows.length > 0
  }

  if (path === '/api/shulea/class-teacher-assignments') {
    if (typeof payload.classId === 'string') {
      const classRows = await ConnectionManager.query<{ id: string }>('SELECT id FROM Class WHERE id = ? AND schoolId = ? LIMIT 1', [payload.classId, item.schoolId])
      if (classRows.length === 0) return false
    }
    if (typeof payload.teacherId === 'string') {
      const teacherRows = await ConnectionManager.query<{ id: string }>('SELECT id FROM Teacher WHERE id = ? AND schoolId = ? LIMIT 1', [payload.teacherId, item.schoolId])
      if (teacherRows.length === 0) return false
    }
    return true
  }

  if (path === '/api/shulea/attendance' && typeof payload.classId === 'string') {
    const rows = await ConnectionManager.query<{ id: string }>('SELECT id FROM Class WHERE id = ? AND schoolId = ? LIMIT 1', [payload.classId, item.schoolId])
    return rows.length > 0
  }

  if (path === '/api/shulea/marks' && (typeof payload.examId === 'string' || typeof payload.classSubjectId === 'string')) {
    if (typeof payload.examId === 'string') {
      const examRows = await ConnectionManager.query<{ id: string }>('SELECT id FROM Exam WHERE id = ? AND schoolId = ? LIMIT 1', [payload.examId, item.schoolId])
      if (examRows.length === 0) return false
    }
    if (typeof payload.classSubjectId === 'string') {
      const classSubjectRows = await ConnectionManager.query<{ id: string }>('SELECT id FROM ClassSubject WHERE id = ? LIMIT 1', [payload.classSubjectId])
      if (classSubjectRows.length === 0) return false
    }
    return true
  }

  if (path === '/api/shulea/exams' && typeof payload.classId === 'string') {
    const rows = await ConnectionManager.query<{ id: string }>('SELECT id FROM Class WHERE id = ? AND schoolId = ? LIMIT 1', [payload.classId, item.schoolId])
    return rows.length > 0
  }

  return true
}

function openQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
      const store = request.transaction?.objectStore(STORE_NAME)
      if (store && !store.indexNames.contains('operationId')) store.createIndex('operationId', 'operationId')
      if (store && !store.indexNames.contains('scope')) store.createIndex('scope', ['userId', 'schoolId'])
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Failed to open offline sync queue'))
  })
}

async function readQueue(): Promise<OfflineMutation[]> {
  const db = await openQueueDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
      request.onsuccess = () => {
        db.close()
        resolve((request.result as Array<Partial<OfflineMutation>>).map(item => ({
          ...item,
          operationKey: item.operationKey || buildOperationKey({
            userId: item.userId || '',
            schoolId: item.schoolId || '',
            endpoint: item.endpoint || '',
            method: item.method || 'POST',
            body: item.body || '',
          }),
          operationId: item.operationId || `legacy-${item.id}`,
          attempts: item.attempts || 0,
          status: item.status || 'PENDING',
        })) as OfflineMutation[])
      }
    request.onerror = () => { db.close(); reject(request.error || new Error('Failed to read offline sync queue')) }
  })
}

export async function enqueueOfflineMutation(mutation: Omit<OfflineMutation, 'id' | 'createdAt' | 'operationId' | 'attempts' | 'lastAttemptAt' | 'nextAttemptAt' | 'lastError' | 'status'>) {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return
  const operationKey = buildOperationKey(mutation)
  const existing = (await readQueue()).find(item =>
    item.userId === mutation.userId &&
    item.schoolId === mutation.schoolId &&
    item.operationKey === operationKey &&
    (item.status === 'PENDING' || item.status === 'FAILED'),
  )
  if (existing) return existing.operationId
  const db = await openQueueDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).add({
      ...mutation,
      operationId: operationKey,
      operationKey,
      attempts: 0,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error || new Error('Failed to queue offline change'))
  })
  db.close()
}

async function updateMutation(mutation: OfflineMutation) {
  const db = await openQueueDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(mutation)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error || new Error('Failed to update offline sync state'))
  })
  db.close()
}

function retryDelay(attempts: number) {
  return Math.min(15 * 60 * 1000, 1000 * 2 ** Math.min(attempts, 10))
}

function isPermanentFailure(status: number) {
  return status === 400 || status === 401 || status === 403 || status === 404 || status === 409 || status === 422 || status === 413
}

async function removeMutation(id: number) {
  const db = await openQueueDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error || new Error('Failed to remove synced change'))
  })
  db.close()
}

async function flushOfflineMutationsOnce(scope: { userId?: string | null; schoolId?: string | null }) {
  if (typeof window === 'undefined' || navigator.onLine === false || !scope.userId || !scope.schoolId) return { synced: 0, pending: 0 }
  const queued = sortQueuedMutations((await readQueue())
    .filter(item => item.userId === scope.userId && item.schoolId === scope.schoolId)
    .filter(item => item.status !== 'DEAD_LETTER'))
  let synced = 0

  for (const item of queued) {
    if (item.nextAttemptAt && new Date(item.nextAttemptAt).getTime() > Date.now()) continue
    const dependencyReady = await dependencyReadyForItem(item)
    if (!dependencyReady) {
      item.status = 'FAILED'
      item.lastError = 'Waiting for parent record to exist before synchronization.'
      item.nextAttemptAt = new Date(Date.now() + retryDelay(item.attempts || 1)).toISOString()
      await updateMutation(item)
      break
    }
    try {
      const attemptAt = new Date().toISOString()
      item.attempts += 1
      item.lastAttemptAt = attemptAt
      item.status = 'SYNCING'
      await updateMutation(item)
      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shulea-Operation-Id': item.operationId },
        credentials: 'same-origin',
        body: JSON.stringify({
          endpoint: item.endpoint,
          method: item.method,
          body: item.body,
          ...(item.baseVersion === undefined ? {} : { baseVersion: item.baseVersion }),
        }),
        cache: 'no-store',
      })
      // Keep rejected mutations queued. A 401/403/422 must not silently delete
      // a user's offline change before the session or validation problem is fixed.
      if (response.ok) {
        await removeMutation(item.id!)
        synced++
      } else {
        item.lastError = `Sync rejected (${response.status})`
        if (isPermanentFailure(response.status) || item.attempts >= MAX_RETRY_ATTEMPTS) {
          item.status = 'DEAD_LETTER'
          item.nextAttemptAt = undefined
        } else {
          item.status = 'FAILED'
          item.nextAttemptAt = new Date(Date.now() + retryDelay(item.attempts)).toISOString()
        }
        await updateMutation(item)
        if (item.status === 'FAILED') break
      }
    } catch (error) {
      item.status = 'FAILED'
      item.lastError = error instanceof Error ? error.message.slice(0, 500) : 'Network unavailable or request timed out'
      if (item.attempts >= MAX_RETRY_ATTEMPTS) {
        item.status = 'DEAD_LETTER'
        item.nextAttemptAt = undefined
      } else {
        item.nextAttemptAt = new Date(Date.now() + retryDelay(item.attempts)).toISOString()
      }
      await updateMutation(item)
      break
    }
  }

  const remaining = (await readQueue()).filter(item => item.userId === scope.userId && item.schoolId === scope.schoolId).length
  return { synced, pending: remaining }
}

export function flushOfflineMutations(scope: { userId?: string | null; schoolId?: string | null }) {
  if (activeFlush) return activeFlush
  activeFlush = flushOfflineMutationsOnce(scope).finally(() => {
    activeFlush = null
  })
  return activeFlush
}

export async function getPendingOfflineMutationCount(scope: { userId?: string | null; schoolId?: string | null }) {
  if (typeof window === 'undefined' || !scope.userId || !scope.schoolId) return 0
  const queued = await readQueue()
  return queued.filter(item => item.userId === scope.userId && item.schoolId === scope.schoolId).length
}

export async function getOfflineSyncStatus(scope: { userId?: string | null; schoolId?: string | null }): Promise<OfflineSyncStatus> {
  if (typeof window === 'undefined' || !scope.userId || !scope.schoolId) {
    return { pending: 0, failed: 0, deadLetter: 0, nextRetryAt: null, lastError: null }
  }
  const queued = (await readQueue()).filter(item => item.userId === scope.userId && item.schoolId === scope.schoolId)
  const retryTimes = queued.map(item => item.nextAttemptAt).filter(Boolean).sort()
  return {
    pending: queued.length,
    failed: queued.filter(item => item.status === 'FAILED').length,
    deadLetter: queued.filter(item => item.status === 'DEAD_LETTER').length,
    nextRetryAt: retryTimes[0] || null,
    lastError: queued.find(item => item.lastError)?.lastError || null,
  }
}

export async function retryDeadLetterMutations(scope: { userId?: string | null; schoolId?: string | null }) {
  if (typeof window === 'undefined' || !scope.userId || !scope.schoolId) return 0
  const queued = await readQueue()
  const candidates = queued.filter(item => item.userId === scope.userId && item.schoolId === scope.schoolId && item.status === 'DEAD_LETTER')
  for (const item of candidates) {
    item.status = 'PENDING'
    item.attempts = 0
    item.nextAttemptAt = undefined
    item.lastError = undefined
    await updateMutation(item)
  }
  return candidates.length
}

export async function discardDeadLetterMutation(id: number, scope: { userId?: string | null; schoolId?: string | null }) {
  if (typeof window === 'undefined' || !scope.userId || !scope.schoolId) return false
  const mutation = (await readQueue()).find(item => item.id === id && item.userId === scope.userId && item.schoolId === scope.schoolId && item.status === 'DEAD_LETTER')
  if (!mutation) return false
  await removeMutation(id)
  return true
}
