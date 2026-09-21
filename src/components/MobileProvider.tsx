'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ConnectionManager } from '@/services/database/ConnectionManager'
import { SchemaManager } from '@/services/database/SchemaManager'
import { ensureAuthorizedLocalScope, hydrateAuthorizedDevice, runAuthorizedSyncCycle } from '@/services/database/CloudSyncHydrator'
import { useAppStore } from '@/lib/store'
import { getUserFriendlyError } from '@/lib/user-friendly-errors'
import { toast } from 'sonner'

interface MobileContextType {
  isMobile: boolean
  isInitialized: boolean
  isLoading: boolean
  error: string | null
  retry: () => void
}

const MobileContext = createContext<MobileContextType>({
  isMobile: false,
  isInitialized: false,
  isLoading: true,
  error: null,
  retry: () => {}
})

export function useMobileContext() {
  return useContext(MobileContext)
}

interface MobileProviderProps {
  children: ReactNode
}

export function MobileProvider({ children }: MobileProviderProps) {
  const currentUser = useAppStore(state => state.currentUser)
  const [state, setState] = useState<MobileContextType>({
    isMobile: false,
    isInitialized: false,
    isLoading: true,
    error: null,
    retry: () => {}
  })

  useEffect(() => {
    let mounted = true

    async function initializeOfflineDatabase() {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }))
        ConnectionManager.setMode('sqlite')
        await ConnectionManager.getSQLite()
        await SchemaManager.initialize()

        if (!mounted) return
        setState({
          isMobile: true,
          isInitialized: true,
          isLoading: false,
          error: null,
          retry: initializeOfflineDatabase
        })
      } catch (error) {
        if (!mounted) return
        setState({
          isMobile: false,
          isInitialized: false,
          isLoading: false,
          error: getUserFriendlyError(error, 'Offline storage could not be initialized.'),
          retry: initializeOfflineDatabase
        })
      }
    }

    initializeOfflineDatabase()

    const syncWhenOnline = async (showError = false) => {
      const user = useAppStore.getState().currentUser
      if (navigator.onLine && user?.id && user.schoolId) {
        try {
          await runAuthorizedSyncCycle({ userId: user.id, schoolId: user.schoolId })
        } catch (error) {
          if (showError) toast.error(getUserFriendlyError(error, 'Pending changes could not be synchronized.'))
        }
      }
    }
    const handleOnline = () => { void syncWhenOnline(true) }
    window.addEventListener('online', handleOnline)
    const syncTimer = window.setInterval(() => syncWhenOnline(false), 30000)

    return () => {
      mounted = false
      window.removeEventListener('online', handleOnline)
      window.clearInterval(syncTimer)
    }
  }, [])

  useEffect(() => {
    if (!currentUser?.id || !currentUser.schoolId || currentUser.isDemoUser) return
    void ensureAuthorizedLocalScope()
      .then(() => hydrateAuthorizedDevice())
      .then(() => runAuthorizedSyncCycle({ userId: currentUser.id, schoolId: currentUser.schoolId }))
      .catch(error => {
        toast.error(getUserFriendlyError(error, 'Your device data could not be synchronized yet.'))
      })
  }, [currentUser?.id, currentUser?.schoolId, currentUser?.isDemoUser])

  return (
    <MobileContext.Provider value={state}>
      {children}
    </MobileContext.Provider>
  )
}
