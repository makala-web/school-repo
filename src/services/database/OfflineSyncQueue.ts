export interface OfflineMutation {
  id?: number
  operationId: string
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
  status: 'PENDING' | 'FAILED'
}

export interface OfflineSyncStatus {
  pending: number
  failed: number
  nextRetryAt: string | null
  lastError: string | null
}

const DB_NAME = 'shulea-offline-sync'
const STORE_NAME = 'mutations'

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
  const db = await openQueueDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).add({
      ...mutation,
      operationId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

async function removeMutation(id: number) {
  const db = await openQueueDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error || new Error('Failed to remove synced change'))
  })
  db.close()
}

export async function flushOfflineMutations(scope: { userId?: string | null; schoolId?: string | null }) {
  if (typeof window === 'undefined' || navigator.onLine === false || !scope.userId || !scope.schoolId) return { synced: 0, pending: 0 }
  const queued = (await readQueue())
    .filter(item => item.userId === scope.userId && item.schoolId === scope.schoolId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  let synced = 0

  for (const item of queued) {
    if (item.nextAttemptAt && new Date(item.nextAttemptAt).getTime() > Date.now()) continue
    try {
      const attemptAt = new Date().toISOString()
      item.attempts += 1
      item.lastAttemptAt = attemptAt
      await updateMutation(item)
      const response = await fetch(item.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shulea-Operation-Id': item.operationId },
        credentials: 'same-origin',
        body: JSON.stringify({
          endpoint: item.endpoint,
          method: item.method,
          body: item.body,
        }),
        cache: 'no-store',
      })
      // Keep rejected mutations queued. A 401/403/422 must not silently delete
      // a user's offline change before the session or validation problem is fixed.
      if (response.ok) {
        await removeMutation(item.id!)
        synced++
      } else {
        item.status = 'FAILED'
        item.lastError = `Sync rejected (${response.status})`
        item.nextAttemptAt = new Date(Date.now() + retryDelay(item.attempts)).toISOString()
        await updateMutation(item)
        break
      }
    } catch {
      item.status = 'FAILED'
      item.lastError = 'Network unavailable or request timed out'
      item.nextAttemptAt = new Date(Date.now() + retryDelay(item.attempts)).toISOString()
      await updateMutation(item)
      break
    }
  }

  const remaining = (await readQueue()).filter(item => item.userId === scope.userId && item.schoolId === scope.schoolId).length
  return { synced, pending: remaining }
}

export async function getPendingOfflineMutationCount(scope: { userId?: string | null; schoolId?: string | null }) {
  if (typeof window === 'undefined' || !scope.userId || !scope.schoolId) return 0
  const queued = await readQueue()
  return queued.filter(item => item.userId === scope.userId && item.schoolId === scope.schoolId).length
}

export async function getOfflineSyncStatus(scope: { userId?: string | null; schoolId?: string | null }): Promise<OfflineSyncStatus> {
  if (typeof window === 'undefined' || !scope.userId || !scope.schoolId) {
    return { pending: 0, failed: 0, nextRetryAt: null, lastError: null }
  }
  const queued = (await readQueue()).filter(item => item.userId === scope.userId && item.schoolId === scope.schoolId)
  const retryTimes = queued.map(item => item.nextAttemptAt).filter(Boolean).sort()
  return {
    pending: queued.length,
    failed: queued.filter(item => item.status === 'FAILED').length,
    nextRetryAt: retryTimes[0] || null,
    lastError: queued.find(item => item.lastError)?.lastError || null,
  }
}
