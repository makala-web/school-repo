'use client'

import { useEffect, useState, useRef } from 'react'
import { useAppStore, type SchoolType } from '@/lib/store'
import { validateStrongPassword } from '@/modules/settings'
import { DEFAULT_REPORT_COMMENTS } from '@/modules/settings/default-comments'
import { apiCall, resizeImageFile } from '@/lib/utils'
import { DEMO_ACCESS_DETAILS, getSchoolLicenseStatus } from '@/lib/access-control'
import { toast } from 'sonner'
import {
  Loader2, Save, School, BookOpen, Users, Key, Pencil, Upload, GraduationCap, Sparkles, ShieldCheck, RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import TeacherManagement from '@/components/shulea/TeacherManagement'
import HeadTeacherManagement from '@/components/shulea/HeadTeacherManagement'
import DeviceManagement from '@/components/shulea/DeviceManagement'

interface SchoolData {
  id: string
  name: string
  schoolType: string
  registrationNo: string | null
  council: string | null
  region: string | null
  district: string | null
  ward: string | null
  phone: string | null
  email: string | null
  headTeacherName: string | null
  headTeacherSign: string | null
  headTeacherComments: string | null
  classTeacherName: string | null
  classTeacherShortName: string | null
  classTeacherComments: string | null
  // Auto-generated comment templates by grade - English (Class Teacher)
  ctGradeA_en: string | null
  ctGradeB_en: string | null
  ctGradeC_en: string | null
  ctGradeD_en: string | null
  ctGradeE_en: string | null
  // Auto-generated comment templates by grade - Swahili (Class Teacher)
  ctGradeA_sw: string | null
  ctGradeB_sw: string | null
  ctGradeC_sw: string | null
  ctGradeD_sw: string | null
  ctGradeE_sw: string | null
  // Auto-generated comment templates by grade - English (Head Teacher)
  htGradeA_en: string | null
  htGradeB_en: string | null
  htGradeC_en: string | null
  htGradeD_en: string | null
  htGradeE_en: string | null
  // Auto-generated comment templates by grade - Swahili (Head Teacher)
  htGradeA_sw: string | null
  htGradeB_sw: string | null
  htGradeC_sw: string | null
  htGradeD_sw: string | null
  htGradeE_sw: string | null
  logo: string | null
  logo2: string | null
  academicYear?: string | null
  term?: string | null
  isDemo?: boolean | null
  licenseType?: string | null
  licenseStatus?: string | null
  activationCode?: string | null
  startDate?: string | null
  expiryDate?: string | null
  maxTeachers?: number | null
  maxDevices?: number | null
  maxStudents?: number | null
  renewalRequestedAt?: string | null
}

interface GradingConfigItem {
  id: string
  schoolType: string
  grade: string
  minMark: number
  maxMark: number
  remarks: string
  points: number | null
  division: string | null
}

interface UserData {
  id: string
  username: string
  fullName: string
  email: string
  role: string
  active: boolean
  schoolId: string | null
}

export default function SettingsView() {
  const { currentSchool, schoolType, currentUser, setSchool, setSchoolType } = useAppStore()
  const [activeTab, setActiveTab] = useState('school')

  // School Profile
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null)
  const [schoolLoading, setSchoolLoading] = useState(true)
  const [schoolSaving, setSchoolSaving] = useState(false)
  const [schoolForm, setSchoolForm] = useState({
    name: '', schoolType: 'PRIMARY' as string, registrationNo: '', council: '', region: '', district: '', ward: '', phone: '', email: '',
    headTeacherName: '', headTeacherSign: '', headTeacherComments: DEFAULT_REPORT_COMMENTS.headTeacherComments,
    classTeacherName: '', classTeacherShortName: '', classTeacherComments: DEFAULT_REPORT_COMMENTS.classTeacherComments,
    // Auto-generated comment templates by grade - English (Class Teacher)
    ctGradeA_en: DEFAULT_REPORT_COMMENTS.ctGradeA_en, ctGradeB_en: DEFAULT_REPORT_COMMENTS.ctGradeB_en, ctGradeC_en: DEFAULT_REPORT_COMMENTS.ctGradeC_en, ctGradeD_en: DEFAULT_REPORT_COMMENTS.ctGradeD_en, ctGradeE_en: DEFAULT_REPORT_COMMENTS.ctGradeE_en,
    // Auto-generated comment templates by grade - Swahili (Class Teacher)
    ctGradeA_sw: DEFAULT_REPORT_COMMENTS.ctGradeA_sw, ctGradeB_sw: DEFAULT_REPORT_COMMENTS.ctGradeB_sw, ctGradeC_sw: DEFAULT_REPORT_COMMENTS.ctGradeC_sw, ctGradeD_sw: DEFAULT_REPORT_COMMENTS.ctGradeD_sw, ctGradeE_sw: DEFAULT_REPORT_COMMENTS.ctGradeE_sw,
    // Auto-generated comment templates by grade - English (Head Teacher)
    htGradeA_en: DEFAULT_REPORT_COMMENTS.htGradeA_en, htGradeB_en: DEFAULT_REPORT_COMMENTS.htGradeB_en, htGradeC_en: DEFAULT_REPORT_COMMENTS.htGradeC_en, htGradeD_en: DEFAULT_REPORT_COMMENTS.htGradeD_en, htGradeE_en: DEFAULT_REPORT_COMMENTS.htGradeE_en,
    // Auto-generated comment templates by grade - Swahili (Head Teacher)
    htGradeA_sw: DEFAULT_REPORT_COMMENTS.htGradeA_sw, htGradeB_sw: DEFAULT_REPORT_COMMENTS.htGradeB_sw, htGradeC_sw: DEFAULT_REPORT_COMMENTS.htGradeC_sw, htGradeD_sw: DEFAULT_REPORT_COMMENTS.htGradeD_sw, htGradeE_sw: DEFAULT_REPORT_COMMENTS.htGradeE_sw,
    academicYear: new Date().getFullYear().toString(), term: 'FIRST TERM',
  })
  const [includePP12, setIncludePP12] = useState(true)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logo2InputRef = useRef<HTMLInputElement>(null)
  const [logo2Uploading, setLogo2Uploading] = useState(false)

  // Grading
  const [gradingConfigs, setGradingConfigs] = useState<GradingConfigItem[]>([])
  const [gradingLoading, setGradingLoading] = useState(false)
  const [editingGrading, setEditingGrading] = useState<GradingConfigItem | null>(null)
  const [gradingForm, setGradingForm] = useState({ grade: '', minMark: 0, maxMark: 0, remarks: '', points: '', division: '' })
  const [gradingSaving, setGradingSaving] = useState(false)

  // Users
  const [users, setUsers] = useState<UserData[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [userForm, setUserForm] = useState({ username: '', fullName: '', email: '', password: '', securityQuestion: '', securityAnswer: '' })
  const [userSaving, setUserSaving] = useState(false)

  // Change Password
  const [changePassOpen, setChangePassOpen] = useState(false)
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passSaving, setPassSaving] = useState(false)
  const [renewalSaving, setRenewalSaving] = useState(false)

  useEffect(() => {
    // Reset schoolData when user changes to prevent showing wrong user data
    setSchoolData(null)
    setSchoolForm({
      name: '', schoolType: 'PRIMARY' as string, registrationNo: '', council: '', region: '', district: '', ward: '', phone: '', email: '',
      headTeacherName: '', headTeacherSign: '', headTeacherComments: DEFAULT_REPORT_COMMENTS.headTeacherComments,
      classTeacherName: '', classTeacherShortName: '', classTeacherComments: DEFAULT_REPORT_COMMENTS.classTeacherComments,
      // Auto-generated comment templates by grade - English (Class Teacher)
      ctGradeA_en: DEFAULT_REPORT_COMMENTS.ctGradeA_en, ctGradeB_en: DEFAULT_REPORT_COMMENTS.ctGradeB_en, ctGradeC_en: DEFAULT_REPORT_COMMENTS.ctGradeC_en, ctGradeD_en: DEFAULT_REPORT_COMMENTS.ctGradeD_en, ctGradeE_en: DEFAULT_REPORT_COMMENTS.ctGradeE_en,
      // Auto-generated comment templates by grade - Swahili (Class Teacher)
      ctGradeA_sw: DEFAULT_REPORT_COMMENTS.ctGradeA_sw, ctGradeB_sw: DEFAULT_REPORT_COMMENTS.ctGradeB_sw, ctGradeC_sw: DEFAULT_REPORT_COMMENTS.ctGradeC_sw, ctGradeD_sw: DEFAULT_REPORT_COMMENTS.ctGradeD_sw, ctGradeE_sw: DEFAULT_REPORT_COMMENTS.ctGradeE_sw,
      // Auto-generated comment templates by grade - English (Head Teacher)
      htGradeA_en: DEFAULT_REPORT_COMMENTS.htGradeA_en, htGradeB_en: DEFAULT_REPORT_COMMENTS.htGradeB_en, htGradeC_en: DEFAULT_REPORT_COMMENTS.htGradeC_en, htGradeD_en: DEFAULT_REPORT_COMMENTS.htGradeD_en, htGradeE_en: DEFAULT_REPORT_COMMENTS.htGradeE_en,
      // Auto-generated comment templates by grade - Swahili (Head Teacher)
      htGradeA_sw: DEFAULT_REPORT_COMMENTS.htGradeA_sw, htGradeB_sw: DEFAULT_REPORT_COMMENTS.htGradeB_sw, htGradeC_sw: DEFAULT_REPORT_COMMENTS.htGradeC_sw, htGradeD_sw: DEFAULT_REPORT_COMMENTS.htGradeD_sw, htGradeE_sw: DEFAULT_REPORT_COMMENTS.htGradeE_sw,
      academicYear: new Date().getFullYear().toString(), term: 'FIRST TERM',
    })
    loadSchoolData()
  }, [currentSchool?.id, currentUser?.id])

  useEffect(() => {
    loadGradingConfigs()
    loadUsers()
  }, [currentSchool?.id, schoolType, currentUser?.id])

  // Dynamic placeholders based on school type
  const schoolNamePlaceholder = schoolForm.schoolType === 'SECONDARY'
    ? 'e.g. Mwananyamala Secondary School'
    : 'e.g. Mwananyamala Primary School'
  const regNoPlaceholder = schoolForm.schoolType === 'SECONDARY'
    ? 'e.g. S.4056'
    : 'e.g. P.1205'

  async function loadSchoolData() {
    console.log('[SETTINGS] Loading school data. Current school:', currentSchool?.id, 'Type:', currentSchool?.schoolType, 'User:', currentUser?.id)
    setSchoolLoading(true)
    try {
      const schoolIdParam = currentSchool?.id ? `?schoolId=${currentSchool.id}` : ''
      const data = await apiCall(`/api/shulea/school${schoolIdParam}`)
      const schools = data.schools || []
      console.log('[SETTINGS] API returned schools:', schools.length, schools.map((s: any) => ({ id: s.id, name: s.name, schoolType: s.schoolType })))
      if (schools.length > 0) {
        const s = schools[0]
        setSchoolData(s)
        setSchoolForm({
          name: s.name || '',
          schoolType: s.schoolType || 'PRIMARY',
          registrationNo: s.registrationNo || '',
          council: s.council || '',
          region: s.region || '',
          district: s.district || '',
          ward: s.ward || '',
          phone: s.phone || '',
          email: s.email || '',
          headTeacherName: s.headTeacherName || '',
          headTeacherSign: (s as Record<string, unknown>).headTeacherSign as string || '',
          headTeacherComments: (s as Record<string, unknown>).headTeacherComments as string || DEFAULT_REPORT_COMMENTS.headTeacherComments,
          classTeacherName: (s as Record<string, unknown>).classTeacherName as string || '',
          classTeacherShortName: (s as Record<string, unknown>).classTeacherShortName as string || '',
          classTeacherComments: (s as Record<string, unknown>).classTeacherComments as string || DEFAULT_REPORT_COMMENTS.classTeacherComments,
          // Auto-generated comment templates by grade - English (Class Teacher)
          ctGradeA_en: (s as Record<string, unknown>).ctGradeA_en as string || DEFAULT_REPORT_COMMENTS.ctGradeA_en,
          ctGradeB_en: (s as Record<string, unknown>).ctGradeB_en as string || DEFAULT_REPORT_COMMENTS.ctGradeB_en,
          ctGradeC_en: (s as Record<string, unknown>).ctGradeC_en as string || DEFAULT_REPORT_COMMENTS.ctGradeC_en,
          ctGradeD_en: (s as Record<string, unknown>).ctGradeD_en as string || DEFAULT_REPORT_COMMENTS.ctGradeD_en,
          ctGradeE_en: (s as Record<string, unknown>).ctGradeE_en as string || DEFAULT_REPORT_COMMENTS.ctGradeE_en,
          // Auto-generated comment templates by grade - Swahili (Class Teacher)
          ctGradeA_sw: (s as Record<string, unknown>).ctGradeA_sw as string || DEFAULT_REPORT_COMMENTS.ctGradeA_sw,
          ctGradeB_sw: (s as Record<string, unknown>).ctGradeB_sw as string || DEFAULT_REPORT_COMMENTS.ctGradeB_sw,
          ctGradeC_sw: (s as Record<string, unknown>).ctGradeC_sw as string || DEFAULT_REPORT_COMMENTS.ctGradeC_sw,
          ctGradeD_sw: (s as Record<string, unknown>).ctGradeD_sw as string || DEFAULT_REPORT_COMMENTS.ctGradeD_sw,
          ctGradeE_sw: (s as Record<string, unknown>).ctGradeE_sw as string || DEFAULT_REPORT_COMMENTS.ctGradeE_sw,
          // Auto-generated comment templates by grade - English (Head Teacher)
          htGradeA_en: (s as Record<string, unknown>).htGradeA_en as string || DEFAULT_REPORT_COMMENTS.htGradeA_en,
          htGradeB_en: (s as Record<string, unknown>).htGradeB_en as string || DEFAULT_REPORT_COMMENTS.htGradeB_en,
          htGradeC_en: (s as Record<string, unknown>).htGradeC_en as string || DEFAULT_REPORT_COMMENTS.htGradeC_en,
          htGradeD_en: (s as Record<string, unknown>).htGradeD_en as string || DEFAULT_REPORT_COMMENTS.htGradeD_en,
          htGradeE_en: (s as Record<string, unknown>).htGradeE_en as string || DEFAULT_REPORT_COMMENTS.htGradeE_en,
          // Auto-generated comment templates by grade - Swahili (Head Teacher)
          htGradeA_sw: (s as Record<string, unknown>).htGradeA_sw as string || DEFAULT_REPORT_COMMENTS.htGradeA_sw,
          htGradeB_sw: (s as Record<string, unknown>).htGradeB_sw as string || DEFAULT_REPORT_COMMENTS.htGradeB_sw,
          htGradeC_sw: (s as Record<string, unknown>).htGradeC_sw as string || DEFAULT_REPORT_COMMENTS.htGradeC_sw,
          htGradeD_sw: (s as Record<string, unknown>).htGradeD_sw as string || DEFAULT_REPORT_COMMENTS.htGradeD_sw,
          htGradeE_sw: (s as Record<string, unknown>).htGradeE_sw as string || DEFAULT_REPORT_COMMENTS.htGradeE_sw,
          academicYear: (s as Record<string, unknown>).academicYear as string || new Date().getFullYear().toString(),
          term: (s as Record<string, unknown>).term as string || 'FIRST TERM',
        })
        // Update store with full school data including logos
        setSchool({
          id: s.id,
          name: s.name,
          schoolType: s.schoolType as SchoolType,
          registrationNo: s.registrationNo,
          council: s.council,
          region: s.region,
          district: s.district,
          ward: s.ward,
          headTeacherName: s.headTeacherName,
          phone: s.phone,
          logo: s.logo || undefined,
          logo2: s.logo2 || undefined,
        })
        // Don't override schoolType from login - it should come from user profile
        // if (s.schoolType) {
        //   setSchoolType(s.schoolType as SchoolType)
        // }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load school data')
    } finally {
      setSchoolLoading(false)
    }
  }

  async function saveSchoolData() {
    if (!schoolForm.name.trim()) {
      toast.error('School name is required')
      return
    }

    setSchoolSaving(true)
    try {
      const isNewSchool = !schoolData?.id

      // Step 1: Save the school
      const result = await apiCall('/api/shulea/school', {
        method: 'POST',
        body: JSON.stringify({
          id: schoolData?.id,
          name: schoolForm.name,
          schoolType: schoolForm.schoolType,
          registrationNo: schoolForm.registrationNo || null,
          council: schoolForm.council || null,
          region: schoolForm.region || null,
          district: schoolForm.district || null,
          ward: schoolForm.ward || null,
          phone: schoolForm.phone || null,
          email: schoolForm.email || null,
          headTeacherName: schoolForm.headTeacherName || null,
          headTeacherSign: schoolForm.headTeacherSign || null,
          headTeacherComments: schoolForm.headTeacherComments || null,
          classTeacherName: schoolForm.classTeacherName || null,
          classTeacherShortName: schoolForm.classTeacherShortName || null,
          classTeacherComments: schoolForm.classTeacherComments || null,
          // Auto-generated comment templates by grade - English (Class Teacher)
          ctGradeA_en: schoolForm.ctGradeA_en || null,
          ctGradeB_en: schoolForm.ctGradeB_en || null,
          ctGradeC_en: schoolForm.ctGradeC_en || null,
          ctGradeD_en: schoolForm.ctGradeD_en || null,
          ctGradeE_en: schoolForm.ctGradeE_en || null,
          // Auto-generated comment templates by grade - Swahili (Class Teacher)
          ctGradeA_sw: schoolForm.ctGradeA_sw || null,
          ctGradeB_sw: schoolForm.ctGradeB_sw || null,
          ctGradeC_sw: schoolForm.ctGradeC_sw || null,
          ctGradeD_sw: schoolForm.ctGradeD_sw || null,
          ctGradeE_sw: schoolForm.ctGradeE_sw || null,
          // Auto-generated comment templates by grade - English (Head Teacher)
          htGradeA_en: schoolForm.htGradeA_en || null,
          htGradeB_en: schoolForm.htGradeB_en || null,
          htGradeC_en: schoolForm.htGradeC_en || null,
          htGradeD_en: schoolForm.htGradeD_en || null,
          htGradeE_en: schoolForm.htGradeE_en || null,
          // Auto-generated comment templates by grade - Swahili (Head Teacher)
          htGradeA_sw: schoolForm.htGradeA_sw || null,
          htGradeB_sw: schoolForm.htGradeB_sw || null,
          htGradeC_sw: schoolForm.htGradeC_sw || null,
          htGradeD_sw: schoolForm.htGradeD_sw || null,
          htGradeE_sw: schoolForm.htGradeE_sw || null,
          academicYear: schoolForm.academicYear || null,
          term: schoolForm.term || null,
        }),
      })

      const savedSchool = result.school

      if (isNewSchool && savedSchool) {
        // Step 2: Seed data for new school
        try {
          await apiCall('/api/shulea/seed', {
            method: 'POST',
            body: JSON.stringify({
              schoolId: savedSchool.id,
              schoolType: schoolForm.schoolType,
              includePP12: schoolForm.schoolType === 'PRIMARY' ? includePP12 : false,
              userId: currentUser?.id,
            }),
          })
          toast.success('School setup complete! Subjects, classes, and grading have been initialized.')
        } catch {
          toast.warning('School saved, but initial data setup failed. You can initialize grading and classes separately.')
        }
      } else {
        toast.success(result.message || 'School info saved')
      }

      if (savedSchool) {
        setSchoolData(savedSchool)
        setSchool({
          id: savedSchool.id,
          name: savedSchool.name,
          schoolType: savedSchool.schoolType as SchoolType,
          registrationNo: savedSchool.registrationNo,
          council: savedSchool.council,
          region: savedSchool.region,
          district: savedSchool.district,
          ward: savedSchool.ward,
          headTeacherName: savedSchool.headTeacherName,
          phone: savedSchool.phone,
          logo: savedSchool.logo || undefined,
          logo2: savedSchool.logo2 || undefined,
        })
        // Update store schoolType
        setSchoolType(savedSchool.schoolType as SchoolType)
      }

      // Refresh grading configs using the saved school id when available
      if (savedSchool?.id) {
        void loadGradingConfigs(savedSchool.id)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save school data')
    } finally {
      setSchoolSaving(false)
    }
  }

  async function loadGradingConfigs(schoolId = currentSchool?.id) {
    setGradingLoading(true)
    try {
      if (!schoolId) {
        setGradingConfigs([])
        return
      }
      const data = await apiCall(`/api/shulea/grading?schoolId=${schoolId}&schoolType=${schoolType}`)
      setGradingConfigs(data.gradingConfigs || [])
    } catch {
      // If no configs, that's fine
      setGradingConfigs([])
    } finally {
      setGradingLoading(false)
    }
  }

  async function initGrading() {
    try {
      const result = await apiCall('/api/shulea/grading', {
        method: 'POST',
        body: JSON.stringify({ schoolId: currentSchool?.id, schoolType }),
      })
      toast.success(result.message || 'Grading initialized')
      loadGradingConfigs()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to initialize grading')
    }
  }

  function openEditGrading(config: GradingConfigItem) {
    setEditingGrading(config)
    setGradingForm({
      grade: config.grade,
      minMark: config.minMark,
      maxMark: config.maxMark,
      remarks: config.remarks,
      points: config.points != null ? String(config.points) : '',
      division: config.division || '',
    })
  }

  async function saveGradingConfig() {
    if (!editingGrading) return
    setGradingSaving(true)
    try {
      await apiCall('/api/shulea/grading', {
        method: 'PUT',
        body: JSON.stringify({
          id: editingGrading.id,
          grade: gradingForm.grade,
          minMark: parseInt(String(gradingForm.minMark)),
          maxMark: parseInt(String(gradingForm.maxMark)),
          remarks: gradingForm.remarks,
          points: gradingForm.points ? parseInt(gradingForm.points) : null,
          division: gradingForm.division || null,
        }),
      })
      toast.success('Grading config updated')
      setEditingGrading(null)
      loadGradingConfigs()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update grading')
    } finally {
      setGradingSaving(false)
    }
  }

  async function loadUsers() {
    setUsersLoading(true)
    try {
      if (!currentSchool?.id) {
        setUsers(currentUser ? [currentUser as unknown as UserData] : [])
        return
      }
      const data = await apiCall(`/api/shulea/users?schoolId=${currentSchool.id}`)
      setUsers(data.users || [])
    } catch {
      setUsers(currentUser ? [currentUser as unknown as UserData] : [])
    } finally {
      setUsersLoading(false)
    }
  }

  async function handleAddUser() {
    if (!userForm.username || !userForm.fullName || !userForm.password || !userForm.email || !userForm.securityQuestion || !userForm.securityAnswer) {
      toast.error('All fields are required')
      return
    }
    // Validate password strength
    const passwordCheck = validateStrongPassword(userForm.password)
    if (!passwordCheck.valid) {
      toast.error(passwordCheck.message)
      return
    }
    setUserSaving(true)
    try {
      const result = await apiCall('/api/shulea/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'register',
          username: userForm.username,
          fullName: userForm.fullName,
          email: userForm.email,
          password: userForm.password,
          securityQuestion: userForm.securityQuestion,
          securityAnswer: userForm.securityAnswer,
          schoolId: currentSchool?.id,
        }),
      })
      toast.success(result.message || 'User created')
      setAddUserOpen(false)
      setUserForm({ username: '', fullName: '', email: '', password: '', securityQuestion: '', securityAnswer: '' })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setUserSaving(false)
    }
  }

  async function handleChangePassword() {
    if (!passForm.currentPassword || !passForm.newPassword || !passForm.confirmPassword) {
      toast.error('All fields are required')
      return
    }
    if (passForm.newPassword !== passForm.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    const passwordCheck = validateStrongPassword(passForm.newPassword)
    if (!passwordCheck.valid) {
      toast.error(passwordCheck.message)
      return
    }
    setPassSaving(true)
    try {
      const result = await apiCall('/api/shulea/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'change-password',
          userId: currentUser?.id,
          currentPassword: passForm.currentPassword,
          newPassword: passForm.newPassword,
        }),
      })
      toast.success(result.message || 'Password changed')
      setChangePassOpen(false)
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setPassSaving(false)
    }
  }

  async function requestRenewal() {
    if (!schoolData?.id || !currentUser?.id) return
    setRenewalSaving(true)
    try {
      const result = await apiCall('/api/shulea/school', {
        method: 'POST',
        body: JSON.stringify({ action: 'request-renewal', id: schoolData.id, userId: currentUser.id }),
      })
      setSchoolData(result.school)
      toast.success(result.message || 'Renewal request submitted')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit renewal request')
    } finally {
      setRenewalSaving(false)
    }
  }

  const license = getSchoolLicenseStatus({
    status: schoolData?.licenseStatus || currentSchool?.licenseStatus || 'ACTIVE',
    expiryDate: schoolData?.expiryDate || currentSchool?.expiryDate || undefined,
  })
  const expiry = schoolData?.expiryDate ? new Date(schoolData.expiryDate) : null
  const daysRemaining = expiry && !Number.isNaN(expiry.getTime())
    ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000))
    : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage school settings, grading, and users</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${currentUser?.role === 'SCHOOL_ADMIN' || currentUser?.role === 'SUPER_ADMIN' ? 'grid-cols-8 max-w-4xl' : 'grid-cols-5 max-w-2xl'}`}>
          <TabsTrigger value="school" className="text-xs sm:text-sm">School</TabsTrigger>
          <TabsTrigger value="license" className="text-xs sm:text-sm">License</TabsTrigger>
          <TabsTrigger value="grading" className="text-xs sm:text-sm">Grading</TabsTrigger>
          <TabsTrigger value="users" className="text-xs sm:text-sm">Users</TabsTrigger>
          <TabsTrigger value="password" className="text-xs sm:text-sm">Password</TabsTrigger>
          {(currentUser?.role === 'SCHOOL_ADMIN' || currentUser?.role === 'SUPER_ADMIN') && (
            <TabsTrigger value="teachers" className="text-xs sm:text-sm">Teachers</TabsTrigger>
          )}
          {(currentUser?.role === 'SCHOOL_ADMIN' || currentUser?.role === 'SUPER_ADMIN') && (
            <TabsTrigger value="head-teacher" className="text-xs sm:text-sm">Head Teacher</TabsTrigger>
          )}
          {(currentUser?.role === 'SCHOOL_ADMIN' || currentUser?.role === 'SUPER_ADMIN') && (
            <TabsTrigger value="devices" className="text-xs sm:text-sm">Devices</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="license" className="mt-4 space-y-4">
          <Card className="border-emerald-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                School License
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-700">Current plan</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-950">
                    {schoolData?.isDemo ? '30-day Demo' : schoolData?.licenseType || 'Standard'}
                  </p>
                </div>
                <Badge className={license.isActive ? 'bg-emerald-600' : 'bg-red-600'}>
                  {license.isActive ? 'Active' : license.reason}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Expires</p><p className="mt-1 font-medium">{schoolData?.expiryDate || 'Not set'}</p></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Days remaining</p><p className="mt-1 font-medium">{daysRemaining ?? 'Unlimited'}</p></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Activation code</p><p className="mt-1 break-all font-medium">{schoolData?.activationCode || 'Pending activation'}</p></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Capacity</p><p className="mt-1 font-medium">{schoolData?.maxTeachers ?? 'Unlimited'} teachers</p></div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Renew or activate Shulea</p>
                <p className="mt-1">Primary plans start at TSh {DEMO_ACCESS_DETAILS.primaryPrice.toLocaleString()} and secondary plans at TSh {DEMO_ACCESS_DETAILS.secondaryPrice.toLocaleString()}.</p>
                <p className="mt-1">Contact {DEMO_ACCESS_DETAILS.supportPhone} with your school name and activation code.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={requestRenewal} disabled={renewalSaving || Boolean(schoolData?.renewalRequestedAt)} className="bg-emerald-600 hover:bg-emerald-700">
                  {renewalSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  {schoolData?.renewalRequestedAt ? 'Renewal requested' : 'Request renewal'}
                </Button>
                <a href={`tel:${DEMO_ACCESS_DETAILS.supportPhone.split(' / ')[0]}`} className="text-sm font-medium text-emerald-700 hover:underline">Call Shulea support</a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* School Profile Tab - FIRST and most prominent */}
        <TabsContent value="school" className="mt-4">
          {/* Welcome Banner - shown when no school exists */}
          {!schoolLoading && !schoolData?.id && (
            <div className="mb-4 rounded-lg border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <GraduationCap className="w-8 h-8 text-emerald-600" />
                <Sparkles className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-emerald-800 mb-1">Welcome to Shulea!</h3>
              <p className="text-emerald-700 text-sm">Set up your school profile to get started.</p>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <School className="w-5 h-5 text-emerald-600" />
                School Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {schoolLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                </div>
              ) : (
                <>
                  {/* School Name & Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>School Name *</Label>
                      <Input
                        value={schoolForm.name}
                        onChange={(e) => setSchoolForm(p => ({ ...p, name: e.target.value }))}
                        placeholder={schoolNamePlaceholder}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>School Type</Label>
                      <div className="p-3 bg-gray-50 rounded-md border">
                        <p className="font-medium text-sm">
                          {schoolForm.schoolType === 'PRIMARY' ? 'Primary School' : 'Secondary School'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          School type is set during registration and cannot be changed.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Include PP1 & PP2 checkbox - only for PRIMARY */}
                  {schoolForm.schoolType === 'PRIMARY' && (
                    <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                      <Checkbox
                        id="includePP12"
                        checked={includePP12}
                        onCheckedChange={(checked) => setIncludePP12(checked === true)}
                      />
                      <div className="grid gap-0.5">
                        <Label htmlFor="includePP12" className="text-sm font-medium cursor-pointer">
                          Include PP I &amp; PP II (Pre-Primary)
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Check this if your school has pre-primary classes. Uncheck for STD 1-7 only.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Registration No */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Registration No</Label>
                      <Input
                        value={schoolForm.registrationNo}
                        onChange={(e) => setSchoolForm(p => ({ ...p, registrationNo: e.target.value }))}
                        placeholder={regNoPlaceholder}
                      />
                    </div>
                  </div>

                  {/* Head Teacher Sign */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Head Teacher Signature / Initials</Label>
                      <Input value={schoolForm.headTeacherSign} onChange={(e) => setSchoolForm(p => ({ ...p, headTeacherSign: e.target.value }))} placeholder="e.g. A.Mwangi" />
                      <p className="text-xs text-muted-foreground">This appears as auto-signature on report cards</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-4 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-800">Report Card Teachers & Comments</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Head Teacher details and grade-based comments are used automatically on report cards.
                        Class Teacher details come from the Class Teacher Register and accepted invitations.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Head Teacher Name</Label>
                        <Input
                          value={schoolForm.headTeacherName}
                          onChange={(e) => setSchoolForm(p => ({ ...p, headTeacherName: e.target.value }))}
                          placeholder="e.g. Asha Mwangi"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Default Class Teacher Comment</Label>
                        <Textarea
                          value={schoolForm.classTeacherComments}
                          onChange={(e) => setSchoolForm(p => ({ ...p, classTeacherComments: e.target.value }))}
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Default Head Teacher Comment</Label>
                        <Textarea
                          value={schoolForm.headTeacherComments}
                          onChange={(e) => setSchoolForm(p => ({ ...p, headTeacherComments: e.target.value }))}
                          rows={3}
                        />
                      </div>
                    </div>

                    <details className="rounded-md border bg-white p-3">
                      <summary className="cursor-pointer text-sm font-medium text-gray-800">Grade-based comment templates</summary>
                      <div className="mt-4 space-y-5">
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Class Teacher - English</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(['A', 'B', 'C', 'D', 'E'] as const).map((grade) => {
                              const key = `ctGrade${grade}_en` as keyof typeof schoolForm
                              return (
                                <div key={key} className="space-y-1.5">
                                  <Label>Grade {grade}</Label>
                                  <Textarea value={String(schoolForm[key] || '')} onChange={(e) => setSchoolForm(p => ({ ...p, [key]: e.target.value }))} rows={2} />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Class Teacher - Swahili</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(['A', 'B', 'C', 'D', 'E'] as const).map((grade) => {
                              const key = `ctGrade${grade}_sw` as keyof typeof schoolForm
                              return (
                                <div key={key} className="space-y-1.5">
                                  <Label>Grade {grade}</Label>
                                  <Textarea value={String(schoolForm[key] || '')} onChange={(e) => setSchoolForm(p => ({ ...p, [key]: e.target.value }))} rows={2} />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Head Teacher - English</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(['A', 'B', 'C', 'D', 'E'] as const).map((grade) => {
                              const key = `htGrade${grade}_en` as keyof typeof schoolForm
                              return (
                                <div key={key} className="space-y-1.5">
                                  <Label>Grade {grade}</Label>
                                  <Textarea value={String(schoolForm[key] || '')} onChange={(e) => setSchoolForm(p => ({ ...p, [key]: e.target.value }))} rows={2} />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Head Teacher - Swahili</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(['A', 'B', 'C', 'D', 'E'] as const).map((grade) => {
                              const key = `htGrade${grade}_sw` as keyof typeof schoolForm
                              return (
                                <div key={key} className="space-y-1.5">
                                  <Label>Grade {grade}</Label>
                                  <Textarea value={String(schoolForm[key] || '')} onChange={(e) => setSchoolForm(p => ({ ...p, [key]: e.target.value }))} rows={2} />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>

                  {/* School Logos - Side by side */}
                  <div className="space-y-2">
                    <Label>School Logos</Label>
                    <p className="text-xs text-muted-foreground">
                      Logos appear on all report (Logo 1 on left, Logo 2 on right).
                    </p>
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                      <strong>Image Guidelines:</strong> Use square images (e.g. school crest/badge). Max 200×200px, JPG or PNG format, under 200KB recommended. Large images will be auto-resized.
                    </div>
                    {!schoolData?.id && (
                      <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                        <strong>Please save school info first</strong> before uploading logos. Click "Save School Info" above, then upload your logos.
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Logo 1 (Left) */}
                      <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Logo 1 (Left)</p>
                        {schoolData?.logo ? (
                          <img src={schoolData.logo} alt="Logo 1" className="w-16 h-16 object-contain mx-auto border rounded" />
                        ) : (
                          <div className="w-16 h-16 mx-auto border rounded bg-gray-50 flex items-center justify-center">
                            <Upload className="w-5 h-5 text-gray-300" />
                          </div>
                        )}
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            if (!schoolData?.id) {
                              toast.error('Please save school info first before uploading logos.')
                              return
                            }
                            if (file.size > 20 * 1024 * 1024) {
                              toast.error('This image is too large to process. Please choose an image under 20MB.')
                              return
                            }
                            setLogoUploading(true)
                            try {
                              const resizedBase64 = await resizeImageFile(file, 200, 0.8)
                              await apiCall('/api/shulea/school', {
                                method: 'POST',
                                body: JSON.stringify({ id: schoolData.id, logo: resizedBase64 }),
                              })
                              toast.success('Logo 1 updated successfully')
                              loadSchoolData()
                            } catch (err) {
                              const message = err instanceof Error ? err.message : ''
                              if (message.toLowerCase().includes('read-only')) {
                                toast.info('Demo mode is read-only. Logo upload is disabled for sample data.')
                              } else {
                                console.error('Logo upload error:', err)
                                toast.error(message || 'Failed to upload logo. The image was prepared but could not be saved.')
                              }
                            } finally {
                              setLogoUploading(false)
                            }
                          }}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={logoUploading || !schoolData?.id}
                          onClick={() => {
                            if (logoInputRef.current) {
                              logoInputRef.current.value = ''
                              logoInputRef.current.click()
                            }
                          }}
                          className="gap-1"
                        >
                          {logoUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          Upload Logo 1
                        </Button>
                      </div>
                      {/* Logo 2 (Right) */}
                      <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Logo 2 (Right) — Optional</p>
                        {schoolData?.logo2 ? (
                          <img src={schoolData.logo2} alt="Logo 2" className="w-16 h-16 object-contain mx-auto border rounded" />
                        ) : (
                          <div className="w-16 h-16 mx-auto border rounded bg-gray-50 flex items-center justify-center">
                            <Upload className="w-5 h-5 text-gray-300" />
                          </div>
                        )}
                        <input
                          ref={logo2InputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            if (!schoolData?.id) {
                              toast.error('Please save school info first before uploading logos.')
                              return
                            }
                            if (file.size > 20 * 1024 * 1024) {
                              toast.error('This image is too large to process. Please choose an image under 20MB.')
                              return
                            }
                            setLogo2Uploading(true)
                            try {
                              const resizedBase64 = await resizeImageFile(file, 200, 0.8)
                              await apiCall('/api/shulea/school', {
                                method: 'POST',
                                body: JSON.stringify({ id: schoolData.id, logo2: resizedBase64 }),
                              })
                              toast.success('Logo 2 updated successfully')
                              loadSchoolData()
                            } catch (err) {
                              const message = err instanceof Error ? err.message : ''
                              if (message.toLowerCase().includes('read-only')) {
                                toast.info('Demo mode is read-only. Logo upload is disabled for sample data.')
                              } else {
                                console.error('Logo 2 upload error:', err)
                                toast.error(message || 'Failed to upload logo 2. The image was prepared but could not be saved.')
                              }
                            } finally {
                              setLogo2Uploading(false)
                            }
                          }}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={logo2Uploading || !schoolData?.id}
                          onClick={() => {
                            if (logo2InputRef.current) {
                              logo2InputRef.current.value = ''
                              logo2InputRef.current.click()
                            }
                          }}
                          className="gap-1"
                        >
                          {logo2Uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          Upload Logo 2
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Academic Year & Term */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Academic Year</Label>
                      <Select
                        value={schoolForm.academicYear || new Date().getFullYear().toString()}
                        onValueChange={(v) => setSchoolForm(p => ({ ...p, academicYear: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 11 }, (_, i) => {
                            const year = new Date().getFullYear() - 5 + i
                            return (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Auto-filled. Select from dropdown (last 5 years + next 5 years)</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Term</Label>
                      <Select
                        value={schoolForm.term || 'FIRST TERM'}
                        onValueChange={(v) => setSchoolForm(p => ({ ...p, term: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FIRST TERM">First Term</SelectItem>
                          <SelectItem value="SECOND TERM">Second Term</SelectItem>
                          <SelectItem value="THIRD TERM">Third Term</SelectItem>
                          <SelectItem value="FOURTH TERM">Fourth Term</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  {/* Council, Region, District */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Council (Halmashauri)</Label>
                      <Input value={schoolForm.council} onChange={(e) => setSchoolForm(p => ({ ...p, council: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Region</Label>
                      <Input value={schoolForm.region} onChange={(e) => setSchoolForm(p => ({ ...p, region: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>District</Label>
                      <Input value={schoolForm.district} onChange={(e) => setSchoolForm(p => ({ ...p, district: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Ward (Kata)</Label>
                      <Input value={schoolForm.ward} onChange={(e) => setSchoolForm(p => ({ ...p, ward: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={schoolForm.phone} onChange={(e) => setSchoolForm(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={schoolForm.email} onChange={(e) => setSchoolForm(p => ({ ...p, email: e.target.value }))} />
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={saveSchoolData}
                      disabled={schoolSaving}
                      className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                    >
                      {schoolSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {!schoolData?.id ? 'Save & Initialize School' : 'Save School Info'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Grading Configuration Tab */}
        <TabsContent value="grading" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="w-5 h-5 text-emerald-600" />
                  Grading Configuration ({schoolType})
                </CardTitle>
                {gradingConfigs.length === 0 && (
                  <Button onClick={initGrading} variant="outline" className="gap-2 border-emerald-300 text-emerald-700">
                    Initialize Defaults
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {gradingLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                </div>
              ) : gradingConfigs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-3">No grading configuration found.</p>
                  <Button onClick={initGrading} className="bg-emerald-600 hover:bg-emerald-700">
                    Initialize Default Grading
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Grade</TableHead>
                        <TableHead className="text-center">Min Mark</TableHead>
                        <TableHead className="text-center">Max Mark</TableHead>
                        <TableHead>Remarks</TableHead>
                        {schoolType === 'SECONDARY' && (
                          <>
                            <TableHead className="text-center">Points</TableHead>
                            <TableHead className="text-center">Division</TableHead>
                          </>
                        )}
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gradingConfigs.map((gc) => (
                        <TableRow key={gc.id}>
                          <TableCell>
                            <Badge variant="outline" className={
                              gc.grade === 'A' ? 'bg-green-50 text-green-700 border-green-200' :
                              gc.grade === 'B' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              gc.grade === 'C' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              gc.grade === 'D' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }>
                              {gc.grade}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{gc.minMark}</TableCell>
                          <TableCell className="text-center">{gc.maxMark}</TableCell>
                          <TableCell>{gc.remarks}</TableCell>
                          {schoolType === 'SECONDARY' && (
                            <>
                              <TableCell className="text-center">{gc.points ?? '-'}</TableCell>
                              <TableCell className="text-center">{gc.division ?? '-'}</TableCell>
                            </>
                          )}
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEditGrading(gc)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab - No admin checks */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="w-5 h-5 text-emerald-600" />
                  User Management
                </CardTitle>
                <Button onClick={() => setAddUserOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentUser && (
                        users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.username}</TableCell>
                            <TableCell>{user.fullName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                {user.role.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={user.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                {user.active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Change Password Tab - Strong password validation */}
        <TabsContent value="password" className="mt-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="w-5 h-5 text-emerald-600" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={passForm.currentPassword}
                  onChange={(e) => setPassForm(p => ({ ...p, currentPassword: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={passForm.newPassword}
                  onChange={(e) => setPassForm(p => ({ ...p, newPassword: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={passForm.confirmPassword}
                  onChange={(e) => setPassForm(p => ({ ...p, confirmPassword: e.target.value }))}
                />
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
                Password must contain uppercase, lowercase, number, and special character (minimum 8 characters).
              </p>
              <Button
                onClick={handleChangePassword}
                disabled={passSaving}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2 w-full"
              >
                {passSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                Change Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teachers Management Tab - School Admin only */}
        {(currentUser?.role === 'SCHOOL_ADMIN' || currentUser?.role === 'SUPER_ADMIN') && (
          <TabsContent value="teachers" className="mt-4">
            <TeacherManagement />
          </TabsContent>
        )}

        {(currentUser?.role === 'SCHOOL_ADMIN' || currentUser?.role === 'SUPER_ADMIN') && (
          <TabsContent value="head-teacher" className="mt-4">
            <HeadTeacherManagement />
          </TabsContent>
        )}

        {/* Device Management Tab - School Admin only */}
        {(currentUser?.role === 'SCHOOL_ADMIN' || currentUser?.role === 'SUPER_ADMIN') && (
          <TabsContent value="devices" className="mt-4">
            <DeviceManagement />
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Grading Dialog */}
      <Dialog open={!!editingGrading} onOpenChange={() => setEditingGrading(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Grading - {editingGrading?.grade}</DialogTitle>
            <DialogDescription>Update the grading range and remarks</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Grade</Label>
                <Input value={gradingForm.grade} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Min Mark</Label>
                <Input
                  type="number"
                  value={gradingForm.minMark}
                  onChange={(e) => setGradingForm(p => ({ ...p, minMark: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Mark</Label>
                <Input
                  type="number"
                  value={gradingForm.maxMark}
                  onChange={(e) => setGradingForm(p => ({ ...p, maxMark: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Input
                value={gradingForm.remarks}
                onChange={(e) => setGradingForm(p => ({ ...p, remarks: e.target.value }))}
              />
            </div>
            {schoolType === 'SECONDARY' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>NECTA Points</Label>
                  <Input
                    type="number"
                    value={gradingForm.points}
                    onChange={(e) => setGradingForm(p => ({ ...p, points: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Division</Label>
                  <Input
                    value={gradingForm.division}
                    onChange={(e) => setGradingForm(p => ({ ...p, division: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGrading(null)}>Cancel</Button>
            <Button onClick={saveGradingConfig} disabled={gradingSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {gradingSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog - With email, security question/answer, no role selector */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new teacher account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={userForm.fullName}
                onChange={(e) => setUserForm(p => ({ ...p, fullName: e.target.value }))}
                placeholder="e.g. Juma Hamisi"
              />
            </div>
            <div className="space-y-2">
              <Label>Username *</Label>
              <Input
                value={userForm.username}
                onChange={(e) => setUserForm(p => ({ ...p, username: e.target.value }))}
                placeholder="e.g. juma.hamisi"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm(p => ({ ...p, email: e.target.value }))}
                placeholder="e.g. juma@school.ac.tz"
              />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Min 8 chars, uppercase, lowercase, number, special"
              />
              <p className="text-xs text-muted-foreground">Must contain uppercase, lowercase, number, and special character (min 8 chars)</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Security Question *</Label>
              <Select
                value={userForm.securityQuestion}
                onValueChange={(v) => setUserForm(p => ({ ...p, securityQuestion: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a security question" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="What is your nickname?">What is your nickname?</SelectItem>
                  <SelectItem value="What is the name of your primary school?">What is the name of your primary school?</SelectItem>
                  <SelectItem value="What is your mother's maiden name?">What is your mother&apos;s maiden name?</SelectItem>
                  <SelectItem value="What is your favorite food?">What is your favorite food?</SelectItem>
                  <SelectItem value="What city were you born in?">What city were you born in?</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Security Answer *</Label>
              <Input
                value={userForm.securityAnswer}
                onChange={(e) => setUserForm(p => ({ ...p, securityAnswer: e.target.value }))}
                placeholder="Your answer"
              />
              <p className="text-xs text-muted-foreground">Used for password recovery</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={userSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {userSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
