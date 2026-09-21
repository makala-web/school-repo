'use client'

import { useAppStore, type AppView } from '@/lib/store'
import { getSchoolLicenseStatus } from '@/lib/access-control'
import {
  LayoutDashboard, School, Users, BookOpen, Calendar, CalendarCheck, PenTool,
  Heart, FileText, Settings, HardDrive,
  Menu, LogOut, X, GraduationCap, ChevronLeft, MessageSquare, UserCog, Monitor, Shield, WifiOff, CloudUpload, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState } from 'react'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { apiCall } from '@/lib/utils'
import { toast } from 'sonner'
import { getOfflineSyncStatus, retryDeadLetterMutations, type OfflineSyncStatus } from '@/services/database/OfflineSyncQueue'
import { runAuthorizedSyncCycle } from '@/services/database/CloudSyncHydrator'
import Dashboard from '@/components/shulea/Dashboard'
import ClassManagement from '@/components/shulea/ClassManagement'
import StudentManagement from '@/components/shulea/StudentManagement'
import SubjectManagement from '@/components/shulea/SubjectManagement'
import ExamManagement from '@/components/shulea/ExamManagement'
import MarksEntry from '@/components/shulea/MarksEntry'
import TabiaManagement from '@/components/shulea/TabiaManagement'
import ReportsView from '@/components/shulea/ReportsView'
import SmsView from '@/components/shulea/SmsView'
import SettingsView from '@/components/shulea/SettingsView'
import BackupView from '@/components/shulea/BackupView'
import TeacherManagement from '@/components/shulea/TeacherManagement'
import DeviceManagement from '@/components/shulea/DeviceManagement'
import SuperAdminDashboard from '@/components/shulea/SuperAdminDashboard'
import AttendanceView from '@/components/shulea/AttendanceView'

const MENU_ITEMS: { view: AppView; label: string; icon: React.ElementType; requiredRole?: string }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'classes', label: 'Classes', icon: School, requiredRole: 'TEACHER' },
  { view: 'students', label: 'Students', icon: Users, requiredRole: 'TEACHER' },
  { view: 'attendance', label: 'Attendance', icon: CalendarCheck, requiredRole: 'TEACHER' },
  { view: 'subjects', label: 'Subjects', icon: BookOpen, requiredRole: 'TEACHER' },
  { view: 'exams', label: 'Exams', icon: Calendar, requiredRole: 'TEACHER' },
  { view: 'marks', label: 'Marks', icon: PenTool, requiredRole: 'TEACHER' },
  { view: 'tabia', label: 'Tabia', icon: Heart, requiredRole: 'TEACHER' },
  { view: 'reports', label: 'Reports', icon: FileText, requiredRole: 'TEACHER' },
  { view: 'sms', label: 'SMS', icon: MessageSquare, requiredRole: 'TEACHER' },
  { view: 'teachers', label: 'Teachers', icon: UserCog, requiredRole: 'SCHOOL_ADMIN' },
  { view: 'devices', label: 'Devices', icon: Monitor, requiredRole: 'SCHOOL_ADMIN' },
  { view: 'settings', label: 'Settings', icon: Settings, requiredRole: 'SCHOOL_ADMIN' },
  { view: 'backup', label: 'Backup', icon: HardDrive, requiredRole: 'SCHOOL_ADMIN' },
  { view: 'super-admin', label: 'Admin Panel', icon: Shield, requiredRole: 'SUPER_ADMIN' },
]

/** Format a raw role string like "TEACHER" or "HEAD_TEACHER" into a readable label */
function formatRole(role?: string | null): string {
  const map: Record<string, string> = {
    ADMIN: 'Admin',
    TEACHER: 'Teacher',
    HEAD_TEACHER: 'Head Teacher',
  }
  if (!role) return 'User'
  return map[role] || role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function DiagnosticsPlaceholder() {
  return (
    <div className="rounded-lg border border-emerald-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Diagnostics</h2>
          <p className="text-sm text-muted-foreground">System diagnostics are available from the browser console for now.</p>
        </div>
      </div>
    </div>
  )
}

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  const { currentView, setView, currentSchool, currentUser, schoolType, setSidebarOpen } = useAppStore()

  // Filter menu items based on user role
  const visibleMenuItems = MENU_ITEMS.filter(item => {
    if (currentUser?.role === 'SUPER_ADMIN') {
      return item.view === 'super-admin'
    }
    if (!item.requiredRole) return true
    if (!currentUser?.role) return false
    // Check if user has the required role or higher
    const roleHierarchy: Record<string, number> = {
      'TEACHER': 1,
      'SCHOOL_ADMIN': 2,
      'SUPER_ADMIN': 3,
    }
    const userLevel = roleHierarchy[currentUser.role] || 0
    const requiredLevel = roleHierarchy[item.requiredRole] || 0
    return userLevel >= requiredLevel
  })

  return (
    <div className="flex flex-col h-full">
      {/* Logo Area */}
      <div className={`flex items-center gap-3 px-4 py-4 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img src="/shulea-logo.png" alt="Shulea" className="w-7 h-7 object-contain" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h2 className="text-base font-bold text-emerald-800 truncate">Shulea</h2>
            <p className="text-xs text-emerald-600/70 truncate">Results Manager</p>
          </div>
        )}
      </div>

      <Separator />

      {/* School Badge */}
      {!collapsed && currentSchool && (
        <div className="px-4 py-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
            <p className="text-xs font-semibold text-emerald-700 truncate">{currentSchool.name}</p>
            <Badge variant="outline" className="mt-1 text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
              {schoolType === 'PRIMARY' ? 'Primary' : 'Secondary'}
            </Badge>
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0 px-3 py-2 custom-scrollbar">
        <nav className="space-y-1">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.view
            return (
              <button
                key={item.view}
                onClick={() => {
                  setView(item.view)
                  setSidebarOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 min-h-11 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-emerald-600' : ''}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator />

      {/* User Info */}
      <div className={`px-3 py-3 ${collapsed ? 'flex justify-center' : ''}`}>
        {!collapsed && currentUser?.fullName && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <span className="text-xs font-bold text-emerald-700">
                {currentUser.fullName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{currentUser.fullName}</p>
              <p className="text-xs text-muted-foreground truncate">{formatRole(currentUser.role)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SchoolSetupBanner({ onDismiss, onGoToSettings }: { onDismiss: () => void; onGoToSettings: () => void }) {
  return (
    <div className="mx-4 md:mx-6 mt-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 p-4 md:p-5 text-white shadow-lg relative">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/20 transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <School className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-base">Welcome to Shulea!</h3>
          <p className="text-sm text-white/85 mt-1">Set up your school profile to get started.</p>
          <Button
            onClick={onGoToSettings}
            variant="secondary"
            size="sm"
            className="mt-3 bg-white text-emerald-700 hover:bg-white/90 font-medium"
          >
            Go to Settings
          </Button>
        </div>
      </div>
    </div>
  )
}

function renderView(view: AppView) {
  switch (view) {
    case 'dashboard': return <Dashboard />
    case 'classes': return <ClassManagement />
    case 'students': return <StudentManagement />
    case 'attendance': return <AttendanceView />
    case 'subjects': return <SubjectManagement />
    case 'exams': return <ExamManagement />
    case 'marks': return <MarksEntry />
    case 'tabia': return <TabiaManagement />
    case 'reports': return <ReportsView />
    case 'sms': return <SmsView />
    case 'diagnostics': return <DiagnosticsPlaceholder />
    case 'settings': return <SettingsView />
    case 'backup': return <BackupView />
    case 'teachers': return <TeacherManagement />
    case 'devices': return <DeviceManagement />
    case 'super-admin': return <SuperAdminDashboard />
    default: return <Dashboard />
  }
}

export default function AppLayout() {
  const { currentView, sidebarOpen, toggleSidebar, setSidebarOpen, currentSchool, currentUser, logout, setView } = useAppStore()
  const [isMobile, setIsMobile] = useState(false)
  const [schoolContextLoading, setSchoolContextLoading] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [renewalSaving, setRenewalSaving] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus>({ pending: 0, failed: 0, deadLetter: 0, nextRetryAt: null, lastError: null })
  const licenseStatus = getSchoolLicenseStatus({
    status: currentSchool?.licenseStatus || currentUser?.school?.licenseStatus || 'ACTIVE',
    expiryDate: currentSchool?.expiryDate || currentUser?.school?.expiryDate || undefined,
  })

  // Persisted sessions can be restored before the persisted school object has
  // hydrated. Keep all school menus behind one context gate so they never
  // issue requests with an empty schoolId during that short window.
  useEffect(() => {
    let cancelled = false

    async function restoreSchoolContext() {
      if (!currentUser || currentUser.role === 'SUPER_ADMIN' || currentSchool?.id) {
        setSchoolContextLoading(false)
        return
      }

      const embeddedSchool = currentUser.school
      if (embeddedSchool?.id) {
        useAppStore.getState().setSchool({
          id: embeddedSchool.id,
          name: embeddedSchool.name || '',
          schoolType: embeddedSchool.schoolType === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY',
          logo: embeddedSchool.logo || undefined,
          logo2: embeddedSchool.logo2 || undefined,
          council: embeddedSchool.council || undefined,
          region: embeddedSchool.region || undefined,
          district: embeddedSchool.district || undefined,
          ward: embeddedSchool.ward || undefined,
          headTeacherName: embeddedSchool.headTeacherName || undefined,
          registrationNo: embeddedSchool.registrationNo || undefined,
          phone: embeddedSchool.phone || undefined,
          licenseType: embeddedSchool.licenseType || undefined,
          licenseStatus: embeddedSchool.licenseStatus || 'ACTIVE',
          expiryDate: embeddedSchool.expiryDate || undefined,
          isDemo: Boolean(embeddedSchool.isDemo),
        })
        setSchoolContextLoading(false)
        return
      }

      if (!currentUser.schoolId) {
        setSchoolContextLoading(false)
        return
      }

      setSchoolContextLoading(true)
      try {
        const data = await apiCall(`/api/shulea/school?schoolId=${encodeURIComponent(currentUser.schoolId)}`)
        const school = data.schools?.[0]
        if (!cancelled && school?.id) {
          useAppStore.getState().setSchool(school)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[AppLayout] Failed to restore school context:', error)
          toast.error(error instanceof Error ? error.message : 'Failed to load school data')
        }
      } finally {
        if (!cancelled) setSchoolContextLoading(false)
      }
    }

    void restoreSchoolContext()
    return () => {
      cancelled = true
    }
  }, [currentUser?.id, currentUser?.schoolId, currentSchool?.id, currentUser?.role])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const updateConnection = async () => {
      const online = navigator.onLine
      setIsOnline(online)
      if (online && currentUser?.id && currentUser.schoolId) {
        await runAuthorizedSyncCycle({ userId: currentUser.id, schoolId: currentUser.schoolId })
      }
      if (currentUser?.id && currentUser.schoolId) {
        setSyncStatus(await getOfflineSyncStatus({ userId: currentUser.id, schoolId: currentUser.schoolId }))
      }
    }
    void updateConnection()
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    const timer = window.setInterval(updateConnection, 30000)
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
      window.clearInterval(timer)
    }
  }, [currentUser?.id, currentUser?.schoolId])

  async function handleLogout() {
    try {
      await fetch('/api/shulea/session', { method: 'POST', body: JSON.stringify({ action: 'logout' }), headers: { 'Content-Type': 'application/json' } })
    } finally {
      logout()
    }
  }

  async function retryDeadLetters() {
    if (!currentUser?.id || !currentUser.schoolId) return
    const retried = await retryDeadLetterMutations({ userId: currentUser.id, schoolId: currentUser.schoolId })
    if (retried > 0) {
      await runAuthorizedSyncCycle({ userId: currentUser.id, schoolId: currentUser.schoolId })
      setSyncStatus(await getOfflineSyncStatus({ userId: currentUser.id, schoolId: currentUser.schoolId }))
    }
  }

  async function requestRenewal() {
    if (!currentSchool?.id || !currentUser?.id) return
    setRenewalSaving(true)
    try {
      const result = await apiCall('/api/shulea/school', {
        method: 'POST',
        body: JSON.stringify({ action: 'request-renewal', id: currentSchool.id, userId: currentUser.id }),
      })
      toast.success(result.message || 'Renewal request submitted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit renewal request')
    } finally {
      setRenewalSaving(false)
    }
  }

  // Keep the platform account in its control plane without writing navigation
  // state during render/effect cycles.
  const effectiveView: AppView = currentUser?.role === 'SUPER_ADMIN' ? 'super-admin' : currentView

  if (schoolContextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="flex items-center gap-3 text-emerald-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Loading school data...</span>
        </div>
      </div>
    )
  }

  if (!licenseStatus.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-amber-50 p-6">
        <div className="max-w-lg w-full rounded-2xl border border-red-200 bg-white p-8 shadow-xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <School className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Access denied</h1>
          <p className="mt-3 text-slate-600">{licenseStatus.message}</p>
          <p className="mt-2 text-sm text-slate-500">Please contact the Shulea Administrator or renew the school license.</p>
          <Button onClick={requestRenewal} disabled={renewalSaving} variant="outline" className="mt-5 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            {renewalSaving ? 'Submitting...' : 'Request renewal'}
          </Button>
          <Button onClick={handleLogout} className="mt-6 bg-emerald-600 hover:bg-emerald-700">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside
          className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-30 transition-all duration-300 ${
            sidebarOpen ? 'w-64' : 'w-[68px]'
          }`}
        >
          <SidebarContent collapsed={!sidebarOpen} />
          <button
            onClick={toggleSidebar}
            className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className={`w-3.5 h-3.5 text-gray-500 transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
        </aside>
      )}

      {/* Mobile Sidebar */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SidebarContent collapsed={false} />
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content */}
      <main
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          !isMobile ? (sidebarOpen ? 'ml-64' : 'ml-[68px]') : 'ml-0'
        }`}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isMobile && (
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="shrink-0">
                  <Menu className="w-5 h-5" />
                </Button>
              )}
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {currentUser?.role === 'SUPER_ADMIN'
                    ? 'Admin Panel'
                    : MENU_ITEMS.find(m => m.view === effectiveView)?.label || 'Dashboard'}
                </h1>
                {currentSchool && (
                  <p className="text-xs text-muted-foreground hidden sm:block">{currentSchool.name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentUser?.fullName && (
                <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-emerald-700">
                      {currentUser.fullName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="max-w-32 truncate">{currentUser.fullName}</span>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 hover:text-red-600 gap-1.5">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </header>

        {/* School Setup Banner — below header, above content */}
         {!isOnline && (
           <div className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 md:mx-6">
             <WifiOff className="h-4 w-4 shrink-0" />
           <span>Offline mode: changes are saved locally on this device. They remain pending until synchronization succeeds.</span>
         </div>
       )}
         {isOnline && syncStatus.pending > 0 && (
           <div className={`mx-4 mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs md:mx-6 ${syncStatus.failed > 0 ? 'border-red-200 bg-red-50 text-red-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
             <CloudUpload className="h-4 w-4 shrink-0" />
             <span className="flex-1">{syncStatus.deadLetter > 0
               ? `${syncStatus.deadLetter} synchronization change(s) need attention. Your local data is preserved.`
               : syncStatus.failed > 0
               ? `${syncStatus.failed} synchronization attempt(s) failed. Your local data is preserved and will retry.`
               : `${syncStatus.pending} offline change(s) waiting to sync.`}</span>
             {syncStatus.deadLetter > 0 && (
               <Button type="button" variant="outline" size="sm" onClick={() => void retryDeadLetters()} className="shrink-0 border-red-300 bg-white text-red-900 hover:bg-red-100">
                 Retry
               </Button>
             )}
           </div>
         )}

         {currentSchool?.isDemo && (
           <div className="mx-4 md:mx-6 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
             <div>
               <p className="text-sm font-semibold">DEMO MODE - Sample Data</p>
               <p className="text-xs text-amber-800">This environment is isolated and read-only.</p>
             </div>
             <Button size="sm" variant="outline" onClick={() => setView('settings')} className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
               Request Access
             </Button>
           </div>
         )}
         {currentUser?.role !== 'SUPER_ADMIN' && !currentSchool && !bannerDismissed && (
          <SchoolSetupBanner
            onDismiss={() => setBannerDismissed(true)}
            onGoToSettings={() => setView('settings')}
          />
        )}

        {/* Page Content */}
        <div className={`flex-1 p-4 md:p-6 ${isMobile ? 'pb-20' : ''}`}>
          <ErrorBoundary key={effectiveView}>
            {currentUser?.role === 'SUPER_ADMIN'
              ? <SuperAdminDashboard />
              : renderView(effectiveView)}
          </ErrorBoundary>
        </div>

        {/* Footer — mt-auto pushes it to the bottom */}
        {!isMobile && (
          <footer className="mt-auto border-t border-gray-100 px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              Shulea v2.1 — Offline School Results Management System
            </p>
          </footer>
        )}

        {/* Mobile Bottom Navigation */}
        {isMobile && currentUser?.role !== 'SUPER_ADMIN' && <MobileBottomNav />}
      </main>
    </div>
  )
}
