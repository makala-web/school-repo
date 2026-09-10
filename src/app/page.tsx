'use client'

import { useAppStore } from '@/lib/store'
import { useMobileContext } from '@/components/MobileProvider'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import LoginScreen from '@/components/shulea/LoginScreen'
import AppLayout from '@/components/shulea/AppLayout'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 animate-pulse overflow-hidden">
            <img src="/shulea-logo.png" alt="Shulea" className="w-16 h-16 object-contain" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold text-emerald-700 tracking-tight">Shulea</h1>
          <p className="text-sm text-emerald-600/70">School Results & Reports</p>
        </div>
        <Loader2 className="w-5 h-5 text-emerald-500 animate-spin mt-4" />
      </div>
    </div>
  )
}

function InitializingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 animate-pulse overflow-hidden">
            <img src="/shulea-logo.png" alt="Shulea" className="w-16 h-16 object-contain" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold text-emerald-700 tracking-tight">Shulea</h1>
          <p className="text-sm text-emerald-600/70">Initializing database...</p>
        </div>
        <Loader2 className="w-5 h-5 text-emerald-500 animate-spin mt-4" />
      </div>
    </div>
  )
}

function ErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center shadow-lg">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Initialization Error</h1>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
        <Button 
          onClick={onRetry}
          className="mt-4 bg-emerald-600 hover:bg-emerald-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    </div>
  )
}

export default function ShuleaApp() {
  const { isAuthenticated } = useAppStore()
  const { isLoading, isInitialized, error, retry } = useMobileContext()

  // Show loading screen while initializing
  if (isLoading) return <InitializingScreen />
  
  // Show error screen if there's an error and not initialized
  if (error && !isInitialized) {
    return <ErrorScreen error={error} onRetry={retry} />
  }
  
  // Show initializing if not initialized yet
  if (!isInitialized) return <InitializingScreen />

  // After login, go directly to panel (AppLayout handles school setup within Settings)
  if (!isAuthenticated) return <LoginScreen />
  return <AppLayout />
}
