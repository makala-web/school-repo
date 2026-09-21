'use client'

import { useState, useEffect } from 'react'
import { getStoredOfflineSessions, useAppStore, type User as StoreUser } from '@/lib/store'
import { apiCall } from '@/lib/utils'
import { getDeviceInfo } from '@/lib/access-control'
import { toast } from 'sonner'
import { GraduationCap, Eye, EyeOff, Mail, Lock, Loader2, School, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import RequestAccessForm from '@/components/shulea/RequestAccessForm'

type AuthView = 'login' | 'accept-invitation' | 'demo-choice' | 'request-access'

type DemoSchoolType = 'PRIMARY' | 'SECONDARY'

export default function LoginScreen() {
  const { login } = useAppStore()
  const [view, setView] = useState<AuthView>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingUsers, setCheckingUsers] = useState(true)
  const [hasUsers, setHasUsers] = useState(true)
  const [loginError, setLoginError] = useState('')
  const [isOffline, setIsOffline] = useState(false)
  const [offlineSessions, setOfflineSessions] = useState<StoreUser[]>([])

  // Login form
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Invitation acceptance form
  const [inviteCode, setInviteCode] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteConfirmPassword, setInviteConfirmPassword] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [demoType, setDemoType] = useState<DemoSchoolType>('PRIMARY')

  useEffect(() => {
    checkUsers()
  }, [])

  useEffect(() => {
    function refreshOfflineState() {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      setIsOffline(offline)
      setOfflineSessions(offline ? getStoredOfflineSessions() : [])
    }

    refreshOfflineState()
    window.addEventListener('online', refreshOfflineState)
    window.addEventListener('offline', refreshOfflineState)
    return () => {
      window.removeEventListener('online', refreshOfflineState)
      window.removeEventListener('offline', refreshOfflineState)
    }
  }, [])

  // Safe toast wrapper to prevent undefined errors
  const safeToast = {
    error: (message: string) => {
      try {
        toast.error(message)
      } catch (e) {
        console.error('Toast error:', message)
        alert(message)
      }
    },
    success: (message: string) => {
      try {
        toast.success(message)
      } catch (e) {
        console.log('Toast success:', message)
      }
    },
    info: (message: string) => {
      try {
        toast.info(message)
      } catch (e) {
        console.log('Toast info:', message)
      }
    }
  }

  async function checkUsers() {
    try {
      const data = await apiCall('/api/shulea/auth')
      setHasUsers(data.hasUsers)
      // Always start on login screen - user can switch to register if needed
    } catch {
      setHasUsers(true)
    } finally {
      setCheckingUsers(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!loginEmail || !loginPassword) {
      toast.error('Please enter email and password')
      return
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const savedSession = offlineSessions.find(session => session.email.toLowerCase() === loginEmail.trim().toLowerCase())
      if (savedSession) {
        login(savedSession)
        toast.success('Continuing with the previously synchronized offline session.')
        return
      }
      const message = 'Internet is required to sign in. If this account was already opened on this device and you did not log out, use the offline session option below.'
      setLoginError(message)
      toast.error(message)
      return
    }
    setLoginError('')
    setLoading(true)
    try {
      // Get device information for authorization
      const deviceInfo = getDeviceInfo()
      
      const data = await apiCall('/api/shulea/auth', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'login', 
          email: loginEmail, 
          password: loginPassword,
          deviceInfo: deviceInfo
        }),
      })

      // Login and redirect to dashboard - login() will handle schoolType properly
      login(data.user)
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : 'Login failed'
      const networkLoginFailed = /failed to fetch|network|offline/i.test(rawMessage)
      const errorMsg = networkLoginFailed
        ? 'Internet is required to sign in. Previously opened accounts can continue offline only if an offline session is available on this device.'
        : rawMessage
      setLoginError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  function continueOffline(user: StoreUser) {
    login(user)
    toast.success('Continuing with the previously synchronized offline session.')
  }

  async function handleAcceptInvitation(e: React.FormEvent) {
    e.preventDefault()
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('Internet connection is required to activate an invitation.')
      return
    }
    if (!inviteCode || !invitePassword) {
      toast.error('Please fill in all fields')
      return
    }
    if (invitePassword !== inviteConfirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setInviteLoading(true)
    try {
      // First check if invitation is valid
      const inviteData = await apiCall(`/api/shulea/invitations?inviteCode=${inviteCode}`)
      
      if (!inviteData.success || !inviteData.invitation.isValid) {
        toast.error('Invalid or expired invitation code')
        return
      }

      // Create user account with invitation details
      const userData = await apiCall('/api/shulea/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'register-with-invitation',
          inviteCode,
          email: inviteData.invitation.email,
          password: invitePassword,
          fullName: inviteData.invitation.fullName || 'Teacher',
          schoolId: inviteData.invitation.school.id,
          schoolType: inviteData.invitation.school.schoolType,
          role: inviteData.invitation.role,
        }),
      })

      toast.success('Account created successfully! Please log in.')
      setView('login')
      setLoginEmail(inviteData.invitation.email)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept invitation')
    } finally {
      setInviteLoading(false)
    }
  }

  if (checkingUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    )
  }

  // Determine if custom question input should show
  // Not needed anymore since registration is removed

  return (
    <div className="min-h-screen flex flex-col items-center justify-start sm:justify-center p-4 py-6 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 relative overflow-y-auto overflow-x-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-teal-300 rounded-full translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-emerald-300 rounded-full -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="relative z-10 w-full max-w-md min-w-0">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 shadow-lg border border-white/30 overflow-hidden">
            <img src="/shulea-logo.png" alt="Shulea" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Shulea</h1>
          <p className="text-emerald-100 text-sm mt-1">School Results & Reports</p>
        </div>

        <Card className="border-0 shadow-2xl overflow-hidden max-h-[calc(100vh-180px)]">
          <div className="overflow-y-auto max-h-[calc(100vh-180px)] custom-scrollbar">
          <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Demo environment</p>
            <p className="mt-1 text-xs text-slate-600">
              Explore sample students, marks and reports in read-only mode.
            </p>
          </div>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl text-emerald-800">
              {view === 'login' ? 'Welcome Back' : view === 'accept-invitation' ? 'Accept Invitation' : view === 'demo-choice' ? 'Choose Demo Type' : view === 'request-access' ? 'Request Access' : ''}
            </CardTitle>
            <CardDescription>
              {view === 'login'
                ? 'Sign in to manage your school'
                : view === 'demo-choice'
                ? 'Choose whether to explore a primary or secondary demo school.'
                : view === 'request-access'
                ? 'Submit your school details for administrator review.'
                : 'Enter your invitation code to join your school'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 min-w-0">
            {/* LOGIN FORM */}
            {view === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Error message */}
                {loginError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <p className="font-medium">{loginError}</p>
                  </div>
                )}
                {isOffline && offlineSessions.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-medium">Internet is unavailable. Continue with a previously opened account on this device.</p>
                    {offlineSessions.map(session => (
                      <Button
                        key={session.id}
                        type="button"
                        variant="outline"
                        className="w-full justify-start bg-white"
                        onClick={() => continueOffline(session)}
                      >
                        {session.fullName || session.email}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => { setLoginEmail(e.target.value); setLoginError('') }}
                      className="pl-10"
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      value={loginPassword}
                      onChange={(e) => { setLoginPassword(e.target.value); setLoginError('') }}
                      className="pl-10 pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Sign In
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  onClick={() => setView('demo-choice')}
                  disabled={loading}
                >
                  Try Shulea Demo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-emerald-700 hover:bg-emerald-50"
                  onClick={() => setView('request-access')}
                  disabled={loading}
                >
                  Request Access
                </Button>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setView('accept-invitation')}
                    className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline py-2 px-1 min-h-11"
                  >
                    Accept invitation
                  </button>
                </div>
              </form>
            )}

            {view === 'request-access' && (
              <RequestAccessForm onSuccess={() => setView('login')} />
            )}

            {/* DEMO CHOICE FORM */}
            {view === 'demo-choice' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Demo schools are isolated from production data and are intended for evaluation only.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="demo-type">Select demo school type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDemoType('PRIMARY')}
                      className={`rounded-xl border p-3 text-left transition ${demoType === 'PRIMARY' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="text-sm font-semibold text-slate-800">Primary</div>
                      <div className="text-xs text-slate-500">STD 1-7 demo</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDemoType('SECONDARY')}
                      className={`rounded-xl border p-3 text-left transition ${demoType === 'SECONDARY' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="text-sm font-semibold text-slate-800">Secondary</div>
                      <div className="text-xs text-slate-500">Form I-IV demo</div>
                    </button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setView('login')}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={async () => {
                      setLoading(true)
                      try {
                        const data = await apiCall('/api/shulea/auth', {
                          method: 'POST',
                          body: JSON.stringify({ action: 'demo-login', schoolType: demoType }),
                        })
                        login(data.user)
                      } catch (err: unknown) {
                        const rawMessage = err instanceof Error ? err.message : 'Demo login failed'
                        const message = (typeof navigator !== 'undefined' && !navigator.onLine) || /failed to fetch|network|offline/i.test(rawMessage)
                          ? 'Internet is required to start the demo. If you already opened the demo on this device, use the offline session option on the login screen.'
                          : rawMessage
                        toast.error(message)
                      } finally {
                        setLoading(false)
                      }
                    }}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* INVITATION ACCEPTANCE FORM */}
            {view === 'accept-invitation' && (
              <form onSubmit={handleAcceptInvitation} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-code">Invitation Code *</Label>
                  <Input
                    id="invite-code"
                    placeholder="Enter your invitation code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-password">Create Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="invite-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      value={invitePassword}
                      onChange={(e) => setInvitePassword(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-confirm">Confirm Password *</Label>
                  <Input
                    id="invite-confirm"
                    type="password"
                    placeholder="Confirm your password"
                    value={inviteConfirmPassword}
                    onChange={(e) => setInviteConfirmPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={inviteLoading}>
                  {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Accept Invitation & Create Account
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Need access? Contact your School Administrator
                </p>
              </form>
            )}

            {/* Navigation links */}
            <div className="mt-4 text-center">
              {view !== 'login' && (
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="text-sm text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back to Sign In
                </button>
              )}
            </div>
          </CardContent>
          </div> {/* Close overflow-y-auto div */}
        </Card>

        <p className="text-center text-emerald-200/60 text-xs mt-6">
          Shulea — Offline School Results Management
        </p>
      </div>
    </div>
  )
}
