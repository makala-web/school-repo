'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiCall } from '@/lib/utils'
import {
  Users, School, BookOpen, UserCog, PenTool, FileText, TrendingUp, Award, MessageSquare, ShieldCheck, HardDrive
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

interface Stats {
  schools: number
  classes: number
  students: number
  teachers: number
  subjects: number
  exams: number
  marksEntries: number
  studentResults: number
  users: number
  tabia: number
  gradingConfigs: number
}

interface TeacherWorkspace {
  classes: { id: string; name: string; fullName?: string; studentCount: number; role: string; subject?: string }[]
  students: { id: string; fullName: string; class?: { fullName?: string } }[]
  isHeadTeacher: boolean
}

const GRADE_COLORS: Record<string, string> = {
  A: '#059669',
  B: '#10b981',
  C: '#f59e0b',
  D: '#f97316',
  E: '#ef4444',
  F: '#dc2626',
}

function buildGradeDistribution(results: any[], includeF: boolean) {
  const grades = includeF ? ['A', 'B', 'C', 'D', 'E', 'F'] : ['A', 'B', 'C', 'D', 'E']
  const counts = new Map(grades.map(grade => [grade, 0]))
  results.forEach(result => {
    const grade = result.grade
    if (grade && counts.has(grade)) counts.set(grade, (counts.get(grade) || 0) + 1)
  })
  return grades.map(name => ({ name, value: counts.get(name) || 0, color: GRADE_COLORS[name] }))
}

function buildTopStudents(results: any[], students: any[]) {
  const names = new Map(students.map(student => [student.id, student.fullName]))
  return results
    .filter(result => result.averageMarks !== null && result.averageMarks !== undefined)
    .sort((a, b) => Number(b.averageMarks || 0) - Number(a.averageMarks || 0))
    .slice(0, 5)
    .map(result => ({
      name: result.student?.fullName || names.get(result.studentId) || 'Student',
      average: Number(result.averageMarks || 0),
      grade: result.grade || 'N/A',
    }))
}

export default function Dashboard() {
  const { currentSchool, setView, schoolType, currentUser } = useAppStore()
  const isSchoolAdmin = currentUser?.role === 'SCHOOL_ADMIN'
  const [stats, setStats] = useState<Stats | null>(null)
  const [gradeDistribution, setGradeDistribution] = useState<{ name: string; value: number; color: string }[]>([])
  const [topStudents, setTopStudents] = useState<{ name: string; average: number; grade: string }[]>([])
  const [teacherWorkspace, setTeacherWorkspace] = useState<TeacherWorkspace | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Reset stats when user changes to prevent showing cached data
    setStats(null)
    setGradeDistribution([])
    setTopStudents([])
    setTeacherWorkspace(null)
    loadDashboard()
  }, [schoolType, currentSchool?.id, currentUser?.id])

  async function loadDashboard() {
    console.log('[DASHBOARD] Loading dashboard. School:', currentSchool?.id, 'Type:', schoolType, 'User:', currentUser?.id)
    setLoading(true)
    try {
      const schoolIdParam = currentSchool?.id ? `&schoolId=${currentSchool.id}` : ''
      const schoolTypeParam = schoolType ? `&schoolType=${schoolType}` : ''
      const data = await apiCall(`/api/shulea/backup?action=stats${schoolIdParam}${schoolTypeParam}`)
      console.log('[DASHBOARD] Stats loaded:', data.stats)
      setStats(data.stats)

      if (currentUser?.role === 'TEACHER' && currentSchool?.id) {
        const teacherData = await apiCall(`/api/shulea/teachers?schoolId=${currentSchool.id}`)
        const teacher = (teacherData.teachers || []).find((item: any) => item.userId === currentUser.id || item.user?.id === currentUser.id)
        if (teacher) {
          const [classData, studentData] = await Promise.all([
            apiCall(`/api/shulea/teacher-classes?teacherId=${teacher.id}&schoolId=${currentSchool.id}&actorUserId=${currentUser.id}`),
            apiCall(`/api/shulea/teacher-students?teacherId=${teacher.id}&schoolId=${currentSchool.id}&actorUserId=${currentUser.id}`),
          ])
          setTeacherWorkspace({
            classes: [...(classData.classTeacherAssignments || []), ...(classData.subjectOnlyAssignments || [])],
            students: studentData.students || [],
            isHeadTeacher: Boolean(classData.teacher?.isHeadTeacher),
          })

          const teacherResults = (studentData.students || []).flatMap((student: any) => student.results || [])
          setGradeDistribution(buildGradeDistribution(teacherResults, schoolType === 'SECONDARY'))
          setTopStudents(buildTopStudents(teacherResults, studentData.students || []))
        }
      } else if (currentSchool?.id && data.stats?.studentResults > 0) {
        const examsData = await apiCall(`/api/shulea/exams?schoolId=${currentSchool.id}`)
        const latestExam = (examsData.exams || []).sort((a: any, b: any) => String(b.examDate || b.createdAt || '').localeCompare(String(a.examDate || a.createdAt || '')))[0]
        if (latestExam) {
          const resultsData = await apiCall(`/api/shulea/results?examId=${latestExam.id}`)
          const latestResults = resultsData.results || []
          setGradeDistribution(buildGradeDistribution(latestResults, schoolType === 'SECONDARY'))
          setTopStudents(latestResults.slice(0, 5).map((result: any) => ({
            name: result.student?.fullName || 'Student',
            average: Number(result.averageMarks || 0),
            grade: result.grade || 'N/A',
          })))
        }
      }
    } catch {
      // Stats may not be available
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { label: 'Total Students', value: stats?.students ?? 0, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Classes', value: stats?.classes ?? 0, icon: School, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Total Subjects', value: stats?.subjects ?? 0, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Teachers', value: stats?.teachers ?? 0, icon: UserCog, color: 'text-violet-600', bg: 'bg-violet-50' },
  ]

  const quickActions = isSchoolAdmin
    ? [
        { label: 'Manage Students', icon: Users, view: 'students' as const },
        { label: 'Manage Teachers', icon: UserCog, view: 'teachers' as const },
        { label: 'Academic Setup', icon: BookOpen, view: 'settings' as const },
        { label: 'Authorize Devices', icon: ShieldCheck, view: 'devices' as const },
        { label: 'View Reports', icon: FileText, view: 'reports' as const },
        { label: 'Backup Data', icon: HardDrive, view: 'backup' as const },
      ]
    : [
        { label: 'Enter Marks', icon: PenTool, view: 'marks' as const },
        { label: 'View Reports', icon: FileText, view: 'reports' as const },
        { label: 'Send SMS', icon: MessageSquare, view: 'sms' as const },
        { label: 'Manage Students', icon: Users, view: 'students' as const },
      ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-gray-100 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="border-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white overflow-hidden relative">
        <CardContent className="p-6">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold">{isSchoolAdmin ? 'Welcome, School Administrator' : currentUser?.role === 'TEACHER' ? `Welcome, ${currentUser.fullName}` : 'Welcome to Shulea!'}</h2>
            <p className="text-emerald-100 mt-1 max-w-lg">
              {currentSchool
                ? isSchoolAdmin
                  ? `Manage ${currentSchool.name}, its users, academics and school operations.`
                  : `Managing results for ${currentSchool.name}`
                : 'Your school results management system'}
            </p>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10">
            <School className="w-32 h-32" />
          </div>
        </CardContent>
      </Card>

      {isSchoolAdmin && currentSchool && (
        <Card className="border-emerald-100 bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  School Administration Overview
                </CardTitle>
                <CardDescription>Current school identity, license and leadership status.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setView('settings')}>
                Open Settings
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">School</p>
                <p className="mt-1 font-semibold text-slate-900">{currentSchool.name}</p>
                <p className="text-xs text-muted-foreground">{currentSchool.schoolType === 'PRIMARY' ? 'Primary School' : 'Secondary School'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Location</p>
                <p className="mt-1 font-semibold text-slate-900">{[currentSchool.region, currentSchool.district].filter(Boolean).join(', ') || 'Not configured'}</p>
                <p className="text-xs text-muted-foreground">{currentSchool.phone || currentSchool.registrationNo || 'School contact not configured'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">License</p>
                <p className="mt-1 font-semibold text-slate-900">{currentSchool.licenseType || 'Standard'}</p>
                <Badge className="mt-1 bg-emerald-50 text-emerald-700 border-emerald-200">{currentSchool.licenseStatus || 'ACTIVE'}</Badge>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">School Head</p>
                <p className="mt-1 font-semibold text-slate-900">{currentSchool.headTeacherName || 'Not configured'}</p>
                <p className="text-xs text-muted-foreground">Expiry: {currentSchool.expiryDate || 'No expiry set'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {currentUser?.role === 'TEACHER' && teacherWorkspace && (
        <Card className="border-blue-100 bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <School className="w-4 h-4 text-blue-600" />
                  My Teacher Workspace
                </CardTitle>
                <CardDescription>
                  Authorized classes, students and reporting access for {currentSchool?.name || 'your school'}.
                </CardDescription>
              </div>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                {teacherWorkspace.isHeadTeacher ? 'Head Teacher' : 'Teacher'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-blue-50 p-3"><p className="text-xs text-blue-700">My Classes</p><p className="text-2xl font-bold text-blue-900">{teacherWorkspace.classes.length}</p></div>
              <div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Authorized Students</p><p className="text-2xl font-bold text-emerald-900">{teacherWorkspace.students.length}</p></div>
              <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs text-amber-700">Class Teacher</p><p className="text-sm font-semibold text-amber-900">{teacherWorkspace.classes.filter(item => item.role === 'CLASS_TEACHER').length > 0 ? 'Yes' : 'Subject access'}</p></div>
              <div className="rounded-lg bg-violet-50 p-3"><p className="text-xs text-violet-700">School</p><p className="truncate text-sm font-semibold text-violet-900">{currentSchool?.name || 'Assigned school'}</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {teacherWorkspace.classes.map((item) => (
                <Badge key={`${item.id}-${item.role}-${item.subject || ''}`} variant="outline" className="border-blue-200 bg-blue-50/50 text-blue-800">
                  {item.fullName || item.name}{item.subject ? ` - ${item.subject}` : ''}
                </Badge>
              ))}
              {teacherWorkspace.classes.length === 0 && <p className="text-sm text-muted-foreground">No class or subject assignment has been linked to your account yet.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setView('students')}><Users className="mr-2 h-4 w-4" />My Students</Button>
              <Button size="sm" variant="outline" onClick={() => setView('marks')}><PenTool className="mr-2 h-4 w-4" />Enter Marks</Button>
              <Button size="sm" variant="outline" onClick={() => setView('reports')}><FileText className="mr-2 h-4 w-4" />Student Reports</Button>
              <Button size="sm" variant="outline" onClick={() => setView('sms')}><MessageSquare className="mr-2 h-4 w-4" />SMS / Excel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-bold">{card.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              {currentUser?.role === 'TEACHER' ? 'My Grade Distribution' : 'Latest Exam Grade Distribution'}
            </CardTitle>
            <CardDescription>{currentUser?.role === 'TEACHER' ? 'Based on results from your authorized students' : 'Based on the latest available exam results'}</CardDescription>
          </CardHeader>
          <CardContent>
            {gradeDistribution.some(g => g.value > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={gradeDistribution.filter(g => g.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {gradeDistribution.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">No exam data yet</p>
                <p className="text-xs">Grade distribution will appear after entering marks</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions + Top Students */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Button
                      key={action.label}
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all"
                      onClick={() => setView(action.view)}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{action.label}</span>
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Top Students
              </CardTitle>
              <CardDescription>Best performing students</CardDescription>
            </CardHeader>
            <CardContent>
              {topStudents.length > 0 ? (
                <div className="space-y-3">
                  {topStudents.slice(0, 5).map((student, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-amber-100 text-amber-700' :
                          i === 1 ? 'bg-gray-100 text-gray-700' :
                          i === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-emerald-50 text-emerald-700'
                        }`}>
                          {i + 1}
                        </div>
                        <span className="text-sm font-medium">{student.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{student.average}%</span>
                        <Badge variant="outline" className="text-xs">{student.grade}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Award className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No results yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Exams', value: stats?.exams ?? 0 },
          { label: 'Marks Entries', value: stats?.marksEntries ?? 0 },
          { label: 'Character Records', value: stats?.tabia ?? 0 },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
