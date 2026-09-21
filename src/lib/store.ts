import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const STORAGE_PREFIX = 'shulea-storage'
const ACTIVE_STORAGE_KEY = 'shulea-active-storage-key'
let currentPersistKey = STORAGE_PREFIX

export function getScopedStorageKey(user?: Pick<User, 'id' | 'schoolId'> | null) {
  const userId = user?.id || 'guest'
  const schoolId = user?.schoolId || 'no-school'
  return `${STORAGE_PREFIX}:${userId}:${schoolId}`
}

export function getActiveDataScope() {
  const state = useAppStore.getState()
  return {
    userId: state.currentUser?.id || null,
    schoolId: state.currentUser?.schoolId || state.currentSchool?.id || null,
    schoolType: state.currentUser?.schoolType || state.currentSchool?.schoolType || state.schoolType,
  }
}

const persistStorage = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null
    // Prefer an explicitly active key (set during login) over the static store name
    const activeKey = window.localStorage.getItem(ACTIVE_STORAGE_KEY) || currentPersistKey
    const effectiveKey = activeKey || name || currentPersistKey
    return window.localStorage.getItem(effectiveKey)
  },
  setItem: (name: string, value: string) => {
    if (typeof window === 'undefined') return
    // When persisting, prefer the explicitly active key if set; fall back to provided name
    const activeKey = window.localStorage.getItem(ACTIVE_STORAGE_KEY) || name || currentPersistKey
    window.localStorage.setItem(activeKey, value)
    // Ensure ACTIVE_STORAGE_KEY points to the key we used
    window.localStorage.setItem(ACTIVE_STORAGE_KEY, activeKey)
  },
  removeItem: (name: string) => {
    if (typeof window === 'undefined') return
    // Remove the specified key or the currently active key
    const activeKey = window.localStorage.getItem(ACTIVE_STORAGE_KEY) || name || currentPersistKey
    window.localStorage.removeItem(activeKey)
    if (window.localStorage.getItem(ACTIVE_STORAGE_KEY) === activeKey) {
      window.localStorage.removeItem(ACTIVE_STORAGE_KEY)
    }
  },
  // Clear all user-scoped storage keys
  clearAllUserStorage: () => {
    if (typeof window === 'undefined') return
    console.log('[STORAGE] Clearing all user storage')
    // Remove all shulea-storage keys
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key)
        console.log('[STORAGE] Removing key:', key)
      }
    }
    keysToRemove.forEach(key => window.localStorage.removeItem(key))
    // Also remove the active storage key
    window.localStorage.removeItem(ACTIVE_STORAGE_KEY)
    console.log('[STORAGE] Cleared', keysToRemove.length, 'storage keys')
  },
}

export function setPersistenceKeyForUser(user?: Pick<User, 'id' | 'schoolId'> | null) {
  const nextKey = getScopedStorageKey(user)
  if (currentPersistKey === nextKey) return nextKey

  if (typeof window !== 'undefined') {
    // Do NOT remove previous keys - keep per-user persistence intact
    window.localStorage.setItem(ACTIVE_STORAGE_KEY, nextKey)
  }

  currentPersistKey = nextKey
  return nextKey
}

export function getStoredOfflineSessions(): User[] {
  if (typeof window === 'undefined') return []

  const sessions: User[] = []
  const seen = new Set<string>()

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (!key || !key.startsWith(`${STORAGE_PREFIX}:`) || key.includes(':guest:')) continue

    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as { state?: Partial<AppState> }
      const user = parsed.state?.currentUser
      if (!parsed.state?.isAuthenticated || !user?.id || !user.schoolId || seen.has(user.id)) continue
      seen.add(user.id)
      sessions.push(user)
    } catch {
      // Ignore malformed legacy storage entries.
    }
  }

  return sessions
}

export type SchoolType = 'PRIMARY' | 'SECONDARY'
export type AppView = 
  | 'login'
  | 'dashboard'
  | 'classes'
  | 'students'
  | 'attendance'
  | 'subjects'
  | 'exams'
  | 'marks'
  | 'tabia'
  | 'reports'
  | 'sms'
  | 'diagnostics'
  | 'settings'
  | 'backup'
  | 'teachers'
  | 'devices'
  | 'super-admin'

export interface User {
  id: string
  email: string
  username: string
  fullName: string
  role: string
  schoolId?: string
  schoolType?: SchoolType | string | null
  isDemoUser?: boolean
  school?: Partial<SchoolInfo> | null
}

export interface SchoolInfo {
  id: string
  name: string
  schoolType: SchoolType
  logo?: string
  logo2?: string
  council?: string
  region?: string
  district?: string
  ward?: string
  headTeacherName?: string
  registrationNo?: string
  phone?: string
  licenseType?: string
  licenseStatus?: string
  expiryDate?: string
  isDemo?: boolean
  maxDevices?: number
  maxTeachers?: number
}

interface AppState {
  // Auth
  currentUser: User | null
  isAuthenticated: boolean
  sessionVersion: number // Increments on login to force data reload

  // School
  currentSchool: SchoolInfo | null
  schoolType: SchoolType
  schoolTypePreference: SchoolType | null

  // Navigation
  currentView: AppView
  sidebarOpen: boolean

  // Actions
  login: (user: User) => void
  logout: () => void
  setSchool: (school: SchoolInfo) => void
  setSchoolType: (type: SchoolType) => void
  setSchoolTypePreference: (type: SchoolType | null) => void
  setView: (view: AppView) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      isAuthenticated: false,
      sessionVersion: 0,
      currentSchool: null,
      schoolType: 'PRIMARY',
      schoolTypePreference: null,
      currentView: 'dashboard',
      sidebarOpen: true,
      
      login: (user) => {
        console.log('[STORE] ===== LOGIN START =====')
        console.log('[STORE] User ID:', user.id)
        console.log('[STORE] User schoolType from API:', user.schoolType)
        console.log('[STORE] User schoolId:', user.schoolId)
        console.log('[STORE] User school object:', user.school)
        console.log('[STORE] School schoolType:', user.school?.schoolType)

        if (typeof window !== 'undefined') {
          window.sessionStorage.clear()
        }

        // Clear all state first to prevent data leakage from previous user
        set({
          currentUser: null,
          isAuthenticated: false,
          currentSchool: null,
          schoolType: 'PRIMARY',
          schoolTypePreference: null,
          currentView: user.role === 'SUPER_ADMIN' ? 'super-admin' : 'dashboard',
          sessionVersion: 0,
        })
        console.log('[STORE] State cleared')

        // Then set persistence key and load new user data
        const persistKey = setPersistenceKeyForUser(user)
        console.log('[STORE] Persistence key set to:', persistKey)

        // School Type MUST come from user profile (user.schoolType), never from school object or cache
        const userSchoolType = (user.schoolType === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY') as SchoolType
        console.log('[STORE] Determined schoolType from user profile:', userSchoolType)

        set({
          currentUser: user,
          isAuthenticated: true,
          currentSchool: user.school && user.school.id ? {
          id: user.school.id,
          name: user.school.name || '',
          schoolType: userSchoolType, // Always use user's schoolType from profile
          logo: user.school.logo || undefined,
          logo2: user.school.logo2 || undefined,
          council: user.school.council || undefined,
          region: user.school.region || undefined,
          district: user.school.district || undefined,
          ward: user.school.ward || undefined,
          headTeacherName: user.school.headTeacherName || undefined,
          registrationNo: user.school.registrationNo || undefined,
          phone: user.school.phone || undefined,
          licenseType: user.school.licenseType || undefined,
          licenseStatus: user.school.licenseStatus || 'ACTIVE',
          expiryDate: user.school.expiryDate || undefined,
          isDemo: Boolean(user.school.isDemo),
        } : null,
          schoolType: userSchoolType,
          schoolTypePreference: null,
          currentView: user.role === 'SUPER_ADMIN' ? 'super-admin' : 'dashboard',
          sessionVersion: Date.now(), // Increment to force data reload in components
        })
        console.log('[STORE] State set for user. Final schoolType:', userSchoolType)
        console.log('[STORE] ===== LOGIN END =====')
      },
      logout: () => {
        console.log('[STORE] Logout - clearing all session data')
        // Clear all user-scoped storage to prevent account isolation issues
        persistStorage.clearAllUserStorage()
        // Clear session storage
        if (typeof window !== 'undefined') {
          window.sessionStorage.clear()
        }
        setPersistenceKeyForUser(null)
        set({
          currentUser: null,
          isAuthenticated: false,
          currentView: 'dashboard',
          currentSchool: null,
          schoolType: 'PRIMARY',
          schoolTypePreference: null,
        })
      },
      setSchool: (school) => set((state) => {
        const userSchoolType = state.currentUser?.schoolType === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY'
        return { currentSchool: { ...school, schoolType: userSchoolType }, schoolType: userSchoolType }
      }),
      setSchoolType: (type) => set({ schoolType: type }),
      setSchoolTypePreference: (type) => set({ schoolTypePreference: type }),
      setView: (view) => set({ currentView: view }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: currentPersistKey,
      storage: createJSONStorage(() => persistStorage),
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
        currentSchool: state.currentSchool,
        schoolType: state.schoolType,
        schoolTypePreference: state.schoolTypePreference,
        currentView: state.currentView,
      }) as AppState,
    }
  )
)
