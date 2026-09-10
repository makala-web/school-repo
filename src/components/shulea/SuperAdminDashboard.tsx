'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiCall } from '@/lib/utils'
import { toast } from 'sonner'
import { 
  School, Users, Monitor, Key, Shield, Plus, Edit, Trash2, 
  RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock, Calendar,
  TrendingUp, BarChart3, UserCheck, Database, Activity, Copy
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface School {
  id: string
  name: string
  schoolType: string
  isDemo: boolean
  licenseType: string
  licenseStatus: string
  status: string
  expiryDate: string
  maxTeachers: number
  maxDevices: number
  teachers: number
  students: number
  classes: number
  devices: number
  schoolAdmins: number
  location: string
  lastActivity: string
  activationCode: string
  renewalRequestedAt?: string
}

interface SchoolStats {
  totalSchools: number
  activeSchools: number
  demoSchools: number
  totalTeachers: number
  totalStudents: number
  totalAdmins: number
  totalDevices: number
  activeLicenses: number
  pendingRequests: number
  expiringSoon: number
}

interface AccessRequest {
  id: string
  schoolName: string
  schoolType: string
  contactPerson: string
  email: string
  phone: string
  requestedPlan?: string | null
  status: string
  createdAt: string
}

interface ProvisionedAccess {
  schoolName: string
  schoolId: string
  adminEmail: string
  adminInviteCode: string
  activationCode: string
  licenseExpiryDate: string
}

interface ControlUser {
  id: string
  fullName: string
  email: string
  role: string
  active: boolean
  school?: { name: string } | null
}

export default function SuperAdminDashboard() {
  const { currentUser } = useAppStore()
  const [schools, setSchools] = useState<School[]>([])
  const [stats, setStats] = useState<SchoolStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null)
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
  const [controlUsers, setControlUsers] = useState<ControlUser[]>([])
  const [controlStats, setControlStats] = useState({ pendingInvitations: 0, activeSessions: 0 })
  
  // Dialog states
  const [createSchoolDialog, setCreateSchoolDialog] = useState(false)
  const [editLicenseDialog, setEditLicenseDialog] = useState(false)
  const [manageLicenseDialog, setManageLicenseDialog] = useState(false)
  const [provisionedAccess, setProvisionedAccess] = useState<ProvisionedAccess | null>(null)
  
  // Form states
  const [newSchoolForm, setNewSchoolForm] = useState({
    name: '',
    schoolType: 'PRIMARY',
    licenseType: 'STANDARD',
    maxTeachers: 20,
    maxDevices: 20,
    expiryDate: (() => { const date = new Date(); date.setFullYear(date.getFullYear() + 1); return date.toISOString().split('T')[0] })()
  })
  
  const [licenseForm, setLicenseForm] = useState({
    status: 'ACTIVE',
    licenseType: 'STANDARD',
    expiryDate: '',
    maxTeachers: 20,
    maxDevices: 20
  })

  const [processing, setProcessing] = useState(false)
  const [previewDialog, setPreviewDialog] = useState(false)
  const [changePasswordDialog, setChangePasswordDialog] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  useEffect(() => {
    if (currentUser?.role === 'SUPER_ADMIN') {
      loadSchools()
    }
  }, [currentUser?.id])

  async function loadSchools() {
    setLoading(true)
    try {
      const [data, requestData] = await Promise.all([
        apiCall(`/api/shulea/admin?actorUserId=${currentUser?.id}`),
        apiCall(`/api/shulea/access-requests?actorUserId=${currentUser?.id}&status=PENDING`),
      ])
      setSchools(data.schools || [])
      setControlUsers(data.control?.users || [])
      setControlStats({
        pendingInvitations: data.control?.pendingInvitations || 0,
        activeSessions: data.control?.activeSessions || 0,
      })
      setAccessRequests(requestData.requests || [])
      
      // Calculate stats
      const totalSchools = data.schools.length
      const activeSchools = data.schools.filter((s: School) => s.status === 'ACTIVE').length
      const demoSchools = data.schools.filter((s: School) => s.isDemo).length
      const totalTeachers = data.schools.reduce((sum: number, s: School) => sum + s.teachers, 0)
      const totalStudents = data.schools.reduce((sum: number, s: School) => sum + s.students, 0)
      const totalAdmins = data.schools.reduce((sum: number, s: School) => sum + s.schoolAdmins, 0)
      const totalDevices = data.schools.reduce((sum: number, s: School) => sum + s.devices, 0)
      const activeLicenses = data.schools.filter((s: School) => ['ACTIVE', 'LIFETIME'].includes(s.licenseStatus)).length
      
      // Calculate expiring soon (within 30 days)
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
      const expiringSoon = data.schools.filter((s: School) => {
        if (!s.expiryDate) return false
        const expiry = new Date(s.expiryDate)
        return expiry < thirtyDaysFromNow && expiry > new Date()
      }).length

      setStats({
        totalSchools,
        activeSchools,
        demoSchools,
        totalTeachers,
        totalStudents,
        totalAdmins,
        totalDevices,
        activeLicenses,
        pendingRequests: requestData.requests?.length || 0,
        expiringSoon
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load schools')
    } finally {
      setLoading(false)
    }
  }

  async function updateAccessRequest(request: AccessRequest, action: 'approve' | 'reject') {
    if (!currentUser?.id) return
    try {
      const result = await apiCall('/api/shulea/access-requests', {
        method: 'POST',
        body: JSON.stringify({
          action,
          actorUserId: currentUser.id,
          requestId: request.id,
          rejectionReason: action === 'reject' ? 'Request rejected by platform administrator.' : undefined,
        }),
      })
      if (action === 'approve' && result.adminInvitation && result.school) {
        setProvisionedAccess({
          schoolName: result.school.name,
          schoolId: result.school.id,
          adminEmail: result.adminInvitation.email,
          adminInviteCode: result.adminInvitation.inviteCode,
          activationCode: result.activationCode,
          licenseExpiryDate: result.licenseExpiryDate,
        })
      }
      toast.success(action === 'approve' ? 'School request approved.' : 'School request rejected.')
      await loadSchools()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update school request')
    }
  }

  async function handleCreateSchool(e: React.FormEvent) {
    e.preventDefault()
    setProcessing(true)
    try {
      // Generate activation code
      const activationCode = `SHL-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
      
      if (newSchoolForm.licenseType !== 'LIFETIME' && !newSchoolForm.expiryDate) {
        toast.error('Please enter a license expiry date')
        setProcessing(false)
        return
      }
      
      // Create school via school API
      const schoolData = await apiCall('/api/shulea/school', {
        method: 'POST',
        body: JSON.stringify({
          name: newSchoolForm.name,
          schoolType: newSchoolForm.schoolType,
          licenseType: newSchoolForm.licenseType,
          licenseStatus: 'ACTIVE',
          activationCode,
          expiryDate: newSchoolForm.licenseType === 'LIFETIME' ? null : newSchoolForm.expiryDate,
          maxTeachers: newSchoolForm.maxTeachers,
          maxDevices: newSchoolForm.maxDevices,
          isDemo: false,
        }),
      })

      toast.success('School created successfully!')
      setCreateSchoolDialog(false)
      setNewSchoolForm({
        name: '',
        schoolType: 'PRIMARY',
        licenseType: 'STANDARD',
        maxTeachers: 20,
        maxDevices: 20,
        expiryDate: (() => { const date = new Date(); date.setFullYear(date.getFullYear() + 1); return date.toISOString().split('T')[0] })()
      })
      loadSchools()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create school')
    } finally {
      setProcessing(false)
    }
  }

  async function handleUpdateLicense() {
    if (!selectedSchool) return

    setProcessing(true)
    try {
      await apiCall('/api/shulea/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update-license',
          schoolId: selectedSchool.id,
          actorUserId: currentUser?.id,
          status: licenseForm.status,
          licenseType: licenseForm.licenseType,
          expiryDate: licenseForm.expiryDate || null,
          maxTeachers: licenseForm.maxTeachers,
          maxDevices: licenseForm.maxDevices,
        }),
      })

      toast.success('License updated successfully!')
      setEditLicenseDialog(false)
      loadSchools()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update license')
    } finally {
      setProcessing(false)
    }
  }

  function reviewRenewal(school: School) {
    setSelectedSchool(school)
    setLicenseForm({
      status: school.licenseStatus || 'ACTIVE',
      licenseType: school.licenseType || 'STANDARD',
      expiryDate: school.expiryDate ? new Date(school.expiryDate).toISOString().slice(0, 10) : '',
      maxTeachers: school.maxTeachers || 20,
      maxDevices: school.maxDevices || 20,
    })
    setEditLicenseDialog(true)
  }

  async function handleDeleteSchool() {
    if (!selectedSchool) return
    const confirmation = window.prompt(`Type the school ID to delete ${selectedSchool.name}:`)
    if (confirmation !== selectedSchool.id) {
      if (confirmation !== null) toast.error('Deletion cancelled: school ID did not match.')
      return
    }
    setProcessing(true)
    try {
      await apiCall('/api/shulea/admin', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete-school', schoolId: selectedSchool.id, confirmation }),
      })
      toast.success('School deleted successfully.')
      setPreviewDialog(false)
      setSelectedSchool(null)
      await loadSchools()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'School could not be deleted')
    } finally {
      setProcessing(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (passwordForm.newPassword.length < 12) {
      toast.error('New password must be at least 12 characters.')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match.')
      return
    }
    setProcessing(true)
    try {
      await apiCall('/api/shulea/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'change-password',
          userId: currentUser?.id,
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })
      toast.success('Password changed successfully.')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setChangePasswordDialog(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Password change failed')
    } finally {
      setProcessing(false)
    }
  }

  function getStatusBadge(status: string) {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Active</Badge>
      case 'BLOCKED':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Blocked</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  function getLicenseTypeBadge(type: string) {
    switch (type.toUpperCase()) {
      case 'STANDARD':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Standard</Badge>
      case 'PREMIUM':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Premium</Badge>
      case 'DEMO':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Demo</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  function formatDate(dateString: string) {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-TZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  async function copyProvisioningValue(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Copy failed. Please select and copy the value.')
    }
  }

  if (currentUser?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600">
              You need Super Admin privileges to access this dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-8 bg-gray-200 rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-600">Platform control center</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Shulea Owner Dashboard</h1>
          <p className="text-sm text-slate-500">Monitor schools, access, licenses and account activity from one place.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="w-fit bg-emerald-50 text-emerald-700 border border-emerald-200">Platform secured</Badge>
          <Button variant="outline" size="sm" onClick={() => setChangePasswordDialog(true)}>
            <Key className="mr-2 h-4 w-4" /> Change Password
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Schools</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalSchools || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <School className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Schools</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.activeSchools || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Teachers</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalTeachers || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Devices</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalDevices || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-teal-100 flex items-center justify-center">
                <Monitor className="w-6 h-6 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalStudents || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">School Admins</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalAdmins || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-cyan-100 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-cyan-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Licenses</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.activeLicenses || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Key className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Requests</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.pendingRequests || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <Activity className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Platform Control</CardTitle>
              <CardDescription>Live account and session controls across all schools.</CardDescription>
            </div>
            <Shield className="h-5 w-5 text-emerald-700" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending invitations</p>
              <p className="mt-1 text-2xl font-bold">{controlStats.pendingInvitations}</p>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Active sessions</p>
              <p className="mt-1 text-2xl font-bold">{controlStats.activeSessions}</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border bg-white">
            <Table>
              <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>School</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {controlUsers.slice(0, 8).map((user) => (
                  <TableRow key={user.id}>
                    <TableCell><p className="font-medium">{user.fullName}</p><p className="text-xs text-muted-foreground">{user.email}</p></TableCell>
                    <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                    <TableCell>{user.school?.name || 'Platform'}</TableCell>
                    <TableCell>{user.active ? <Badge className="bg-emerald-100 text-emerald-700">Active</Badge> : <Badge variant="destructive">Suspended</Badge>}</TableCell>
                  </TableRow>
                ))}
                {controlUsers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No school users found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Warning Cards */}
      {(stats?.expiringSoon || 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">{stats?.expiringSoon || 0} Schools Expiring Soon</p>
                <p className="text-sm text-amber-700">
                  Licenses expiring within 30 days. Review and renew as needed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {schools.some((school) => school.renewalRequestedAt) && (
        <Card className="border-sky-200 bg-sky-50/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Renewal Requests</CardTitle>
                <CardDescription>Review requests submitted by school administrators.</CardDescription>
              </div>
              <Badge variant="outline">{schools.filter((school) => school.renewalRequestedAt).length} pending</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {schools.filter((school) => school.renewalRequestedAt).map((school) => (
              <div key={school.id} className="flex flex-col gap-3 rounded-md border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{school.name}</p>
                  <p className="text-xs text-muted-foreground">Requested {formatDate(school.renewalRequestedAt || '')}</p>
                </div>
                <Button size="sm" onClick={() => reviewRenewal(school)}>
                  <Calendar className="mr-2 h-4 w-4" /> Review renewal
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending Access Requests</CardTitle>
              <CardDescription>Review customer requests before provisioning a school.</CardDescription>
            </div>
            <Badge variant="outline">{accessRequests.length} pending</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {accessRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <p className="font-medium">{request.schoolName}</p>
                        <p className="text-xs text-muted-foreground">{request.email}</p>
                      </TableCell>
                      <TableCell><Badge variant="outline">{request.schoolType}</Badge></TableCell>
                      <TableCell>{request.contactPerson}<br /><span className="text-xs text-muted-foreground">{request.phone}</span></TableCell>
                      <TableCell>{request.requestedPlan || 'STANDARD'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => updateAccessRequest(request, 'approve')}>
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => updateAccessRequest(request, 'reject')}>
                            <XCircle className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>School Management</CardTitle>
              <CardDescription>
                Manage all schools and their licenses
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadSchools}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => setCreateSchoolDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create School
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[34rem] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Admins</TableHead>
                  <TableHead>Teachers</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Devices</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Activation Code</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{school.name}</p>
                        {school.isDemo && (
                          <Badge variant="outline" className="text-xs">Demo</Badge>
                        )}
                      </div>
                    </TableCell>
                  <TableCell>
                    <Badge variant="outline">{school.schoolType}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{school.location}</TableCell>
                  <TableCell>{getLicenseTypeBadge(school.licenseType)}</TableCell>
                  <TableCell>{getStatusBadge(school.status)}</TableCell>
                  <TableCell>{school.schoolAdmins}</TableCell>
                  <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{school.teachers}</span>
                        <span className="text-gray-400">/ {school.maxTeachers}</span>
                      </div>
                    </TableCell>
                    <TableCell>{school.students}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{school.devices}</span>
                        <span className="text-gray-400">/ {school.maxDevices}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {formatDate(school.expiryDate)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(school.lastActivity)}</TableCell>
                    <TableCell>
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                        {school.activationCode}
                      </code>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSchool(school)
                              setPreviewDialog(true)
                            }}
                          >
                            <School className="w-4 h-4 mr-2" />
                            Preview School
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSchool(school)
                              setLicenseForm({
                                status: school.licenseStatus,
                                licenseType: school.licenseType,
                                expiryDate: school.expiryDate || '',
                                maxTeachers: school.maxTeachers,
                                maxDevices: school.maxDevices,
                              })
                              setEditLicenseDialog(true)
                            }}
                          >
                            <Key className="w-4 h-4 mr-2" />
                            Manage License
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-700"
                            onClick={() => {
                              setSelectedSchool(school)
                              setPreviewDialog(true)
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete School
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Provisioning confirmation */}
      <Dialog open={Boolean(provisionedAccess)} onOpenChange={(open) => !open && setProvisionedAccess(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>School Provisioned Successfully</DialogTitle>
            <DialogDescription>
              Share the School Admin invitation details securely. No shared password was created.
            </DialogDescription>
          </DialogHeader>
          {provisionedAccess && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-900">{provisionedAccess.schoolName}</p>
                <p className="mt-1 text-sm text-emerald-800">The admin creates a private password during activation.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['School ID', provisionedAccess.schoolId],
                  ['Admin email', provisionedAccess.adminEmail],
                  ['Admin invite code', provisionedAccess.adminInviteCode],
                  ['License activation', provisionedAccess.activationCode],
                  ['License expiry', provisionedAccess.licenseExpiryDate],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border bg-slate-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <code className="break-all text-sm font-semibold text-slate-900">{value || '-'}</code>
                      {value && label !== 'License expiry' && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => copyProvisioningValue(value)} title={`Copy ${label}`}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <strong>Activation flow:</strong> Admin opens Shulea, chooses Accept Invitation, enters the admin invite code, then creates their own password. Teacher invitations are created later from the School Admin account and use separate teacher invite codes.
              </div>
              <DialogFooter>
                <Button onClick={() => setProvisionedAccess(null)}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create School Dialog */}
      <Dialog open={createSchoolDialog} onOpenChange={setCreateSchoolDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New School</DialogTitle>
            <DialogDescription>
              Create a new school and assign an activation license
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSchool} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="school-name">School Name *</Label>
              <Input
                id="school-name"
                placeholder="e.g. Al-Hikma Secondary School"
                value={newSchoolForm.name}
                onChange={(e) => setNewSchoolForm({ ...newSchoolForm, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="school-type">School Type *</Label>
              <Select
                value={newSchoolForm.schoolType}
                onValueChange={(value) => setNewSchoolForm({ ...newSchoolForm, schoolType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMARY">Primary School</SelectItem>
                  <SelectItem value="SECONDARY">Secondary School</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="license-type">License Type *</Label>
              <Select
                value={newSchoolForm.licenseType}
                onValueChange={(value) => setNewSchoolForm({ ...newSchoolForm, licenseType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANDARD">Standard License</SelectItem>
                  <SelectItem value="PREMIUM">Premium License</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max-teachers">Max Teachers</Label>
                <Input
                  id="max-teachers"
                  type="number"
                  value={newSchoolForm.maxTeachers}
                  onChange={(e) => setNewSchoolForm({ ...newSchoolForm, maxTeachers: Number(e.target.value) })}
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-devices">Max Devices</Label>
                <Input
                  id="max-devices"
                  type="number"
                  value={newSchoolForm.maxDevices}
                  onChange={(e) => setNewSchoolForm({ ...newSchoolForm, maxDevices: Number(e.target.value) })}
                  min="1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-expiry-date">License Expiry Date</Label>
              <Input
                id="new-expiry-date"
                type="date"
                value={newSchoolForm.expiryDate}
                onChange={(e) => setNewSchoolForm({ ...newSchoolForm, expiryDate: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateSchoolDialog(false)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={processing}>
                {processing ? 'Creating...' : 'Create School'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit License Dialog */}
      <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>School Preview</DialogTitle>
            <DialogDescription>Read-only platform overview for the selected school.</DialogDescription>
          </DialogHeader>
          {selectedSchool && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-lg font-semibold">{selectedSchool.name}</h3><p className="text-sm text-muted-foreground">{selectedSchool.id}</p></div>
                  <div className="flex gap-2">{selectedSchool.isDemo && <Badge variant="outline">Demo</Badge>}{getStatusBadge(selectedSchool.status)}</div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Type', selectedSchool.schoolType], ['Location', selectedSchool.location || '-'], ['License', selectedSchool.licenseType],
                  ['License status', selectedSchool.licenseStatus], ['Teachers', `${selectedSchool.teachers} / ${selectedSchool.maxTeachers}`],
                  ['Students', String(selectedSchool.students)], ['Classes', String(selectedSchool.classes)], ['Devices', `${selectedSchool.devices} / ${selectedSchool.maxDevices}`],
                  ['Admins', String(selectedSchool.schoolAdmins)], ['Expiry', formatDate(selectedSchool.expiryDate)], ['Activation code', selectedSchool.activationCode || '-'],
                ].map(([label, value]) => <div key={label} className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-words font-medium">{value}</p></div>)}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewDialog(false)}>Close</Button>
                <Button variant="destructive" onClick={handleDeleteSchool} disabled={processing}><Trash2 className="mr-2 h-4 w-4" /> Delete School</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={changePasswordDialog} onOpenChange={setChangePasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Change Owner Password</DialogTitle><DialogDescription>Update the password for the Super Admin account.</DialogDescription></DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="owner-current-password">Current password</Label><Input id="owner-current-password" type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required /></div>
            <div className="space-y-2"><Label htmlFor="owner-new-password">New password</Label><Input id="owner-new-password" type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} minLength={12} required /></div>
            <div className="space-y-2"><Label htmlFor="owner-confirm-password">Confirm new password</Label><Input id="owner-confirm-password" type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} minLength={12} required /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setChangePasswordDialog(false)}>Cancel</Button><Button type="submit" disabled={processing}>{processing ? 'Saving...' : 'Change Password'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editLicenseDialog} onOpenChange={setEditLicenseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage School License</DialogTitle>
            <DialogDescription>
              Update license settings for {selectedSchool?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="license-status">License Status</Label>
              <Select
                value={licenseForm.status}
                onValueChange={(value) => setLicenseForm({ ...licenseForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="REVOKED">Revoked</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="LIFETIME">Lifetime</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="license-type">License Type</Label>
              <Select
                value={licenseForm.licenseType}
                onValueChange={(value) => setLicenseForm({ ...licenseForm, licenseType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANDARD">Standard</SelectItem>
                  <SelectItem value="PREMIUM">Premium</SelectItem>
                  <SelectItem value="DEMO">Demo</SelectItem>
                  <SelectItem value="LIFETIME">Lifetime</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiry-date">Expiry Date</Label>
              <Input
                id="expiry-date"
                type="date"
                value={licenseForm.expiryDate}
                onChange={(e) => setLicenseForm({ ...licenseForm, expiryDate: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-max-teachers">Max Teachers</Label>
                <Input
                  id="edit-max-teachers"
                  type="number"
                  value={licenseForm.maxTeachers}
                  onChange={(e) => setLicenseForm({ ...licenseForm, maxTeachers: Number(e.target.value) })}
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-max-devices">Max Devices</Label>
                <Input
                  id="edit-max-devices"
                  type="number"
                  value={licenseForm.maxDevices}
                  onChange={(e) => setLicenseForm({ ...licenseForm, maxDevices: Number(e.target.value) })}
                  min="1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditLicenseDialog(false)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateLicense} disabled={processing}>
                {processing ? 'Updating...' : 'Update License'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
