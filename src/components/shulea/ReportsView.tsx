'use client'

import { useEffect, useState, useMemo, useCallback, useRef, type CSSProperties } from 'react'
import { useAppStore } from '@/lib/store'
import { usePrint } from '@/hooks/usePrint'
import { apiCall, exportMarksToExcel } from '@/lib/utils'
import {
  generateReportCardHtml, generateOverallResultsHtml,
  generateSubjectAnalysisHtml, generateSubjectReportHtml,
  generateTopBottomStudentsHtml, generateClassSummaryHtml,
  getReportCardCompression, buildReportFooter, getLocalizedReportComments
} from '@/lib/print-templates'
import { toast } from 'sonner'
import {
  Loader2, Printer, BarChart3, Trophy, TrendingDown, FileText, Languages, Calendar, Save,
  Users, BookOpen, Download, Share2, FileSpreadsheet, Eye
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'

// Language translations
const translations = {
  en: {
    reportCard: 'Examination Report Card',
    studentName: 'Name',
    class: 'Class',
    classPrimary: 'Class',
    classSecondary: 'Form',
    admNo: 'Adm No',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    subject: 'Subject',
    marks: 'Marks',
    grade: 'Grade',
    remarks: 'Remarks',
    teacher: 'Teacher',
    total: 'Total',
    average: 'Average',
    position: 'Position',
    outOf: 'out of',
    points: 'Points',
    division: 'Division',
    character: 'Character & Conduct (Tabia)',
    discipline: 'Discipline',
    hygiene: 'Hygiene',
    hardWorking: 'Hard Working',
    cooperation: 'Cooperation',
    honesty: 'Honesty',
    leadership: 'Leadership',
    sports: 'Sports',
    attendance: 'Attendance Summary',
    totalDays: 'Total Days',
    present: 'Present',
    absent: 'Absent',
    sick: 'Sick',
    permission: 'Permission',
    classTeacherComment: 'Class Teacher Comment',
    headTeacherComment: 'Head Teacher Comment',
    classTeacherSign: 'Class Teacher Signature',
    headTeacherSign: 'Head Teacher Signature',
    closingDate: 'School Closing Date',
    openingDate: 'Next Term Opens',
    regNo: 'Reg. No',
    ward: 'Ward',
    sn: 'S/N',
    sex: 'Sex',
    allStudents: 'ALL Students',
    selectStudent: 'Select Student',
    printAll: 'Print All Reports',
    subjectReport: 'Subject Report',
    maxMarks: 'Max Marks',
    region: 'Region',
    district: 'District',
    examName: 'Examination',
    academicYear: 'Academic Year',
    term: 'Term',
    conduct: 'Conduct',
  },
  sw: {
    reportCard: 'Ripoti ya Mtihani',
    studentName: 'Jina',
    class: 'Darasa',
    classPrimary: 'Darasa',
    classSecondary: 'Kidato',
    admNo: 'Namba ya Adm',
    gender: 'Jinsia',
    male: 'Me',
    female: 'Ke',
    subject: 'Somo',
    marks: 'Alama',
    grade: 'Gredi',
    remarks: 'Maoni',
    teacher: 'Mwalimu',
    total: 'Jumla',
    average: 'Wastani',
    position: 'Nafasi',
    outOf: 'kati ya',
    points: 'Pointi',
    division: 'Daraja',
    character: 'Tabia na Maadili',
    discipline: 'Nidhamu',
    hygiene: 'Usafi',
    hardWorking: 'Bidii',
    cooperation: 'Ushirikiano',
    honesty: 'Uaminifu',
    leadership: 'Uongozi',
    sports: 'Michezo',
    attendance: 'Muhtasari wa Mahudhurio',
    totalDays: 'Siku Jumla',
    present: 'Alilihudhuria',
    absent: 'Hakuhudhuria',
    sick: 'Mgonjwa',
    permission: 'Ruhusa',
    classTeacherComment: 'Maoni ya Mwalimu wa Darasa',
    headTeacherComment: 'Maoni ya Mkuu wa Shule',
    classTeacherSign: 'Saini ya Mwalimu wa Darasa',
    headTeacherSign: 'Saini ya Mkuu wa Shule',
    closingDate: 'Tarehe ya Kufunga Shule',
    openingDate: 'Tarehe ya Kufungua Shule',
    regNo: 'Namba ya Usajili',
    ward: 'Kata',
    sn: 'Namba',
    sex: 'Jinsia',
    allStudents: 'WANAFUNZI WOTE',
    selectStudent: 'Chagua Mwanafunzi',
    printAll: 'Printa Ripoti Zote',
    subjectReport: 'Ripoti ya Somo',
    maxMarks: 'Alama Kuu',
    region: 'Mkoa',
    district: 'Wilaya',
    examName: 'Mtihani',
    academicYear: 'Mwaka wa Masomo',
    term: 'Muhula',
    conduct: 'Maadili',
  }
}

type LangKey = keyof typeof translations.en

interface ExamItem {
  id: string
  name: string
  examType: string
  term: string
  academicYear: string
  class: { id: string; name: string; fullName: string; schoolType: string }
}

interface ClassItem {
  id: string
  name: string
  fullName: string
  schoolType: string
}

interface StudentItem {
  id: string
  fullName: string
  gender: string
  admissionNo: string | null
  class: { id: string; name: string; fullName: string }
}

interface SubjectOption {
  id: string
  subjectId: string
  name: string
  shortName: string | null
}

interface RankedStudentItem {
  student: { fullName: string; gender: string } | null
  averageMarks: number | null
  grade: string | null
  division: string | null
  points: number | null
  rank: number | null
}

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    A: 'bg-green-100 text-green-700 border-green-300',
    B: 'bg-blue-100 text-blue-700 border-blue-300',
    C: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    D: 'bg-orange-100 text-orange-700 border-orange-300',
    E: 'bg-red-100 text-red-700 border-red-300',
    F: 'bg-red-100 text-red-700 border-red-300',
    I: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    II: 'bg-blue-100 text-blue-700 border-blue-300',
    III: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    IV: 'bg-orange-100 text-orange-700 border-orange-300',
    '0': 'bg-red-100 text-red-700 border-red-300',
  }
  return (
    <Badge variant="outline" className={`text-[10px] px-1 py-0 ${colors[grade] || 'bg-gray-100 text-gray-500 border-gray-300'}`}>
      {grade}
    </Badge>
  )
}

// Get ordinal suffix for position (1st, 2nd, 3rd, 4th...)
function getOrdinal(n: number, lang: 'en' | 'sw' = 'en'): string {
  if (lang === 'sw') return String(n)
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function ReportsView() {
  const { currentSchool, schoolType } = useAppStore()
  const { printPdf, sharePdf, isPrinting, language, setLanguage, toggleLanguage } = usePrint({ defaultLanguage: 'en' })
  const [exams, setExams] = useState<ExamItem[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [students, setStudents] = useState<StudentItem[]>([])
  const [selectedExam, setSelectedExam] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('summary')
  const [reportLang, setReportLang] = useState<'en' | 'sw'>('en')
  const [closingDate, setClosingDate] = useState('')
  const [openingDate, setOpeningDate] = useState('')

  // Fresh school identity for reports (fetched from API, then available from local app data/store offline)
  const [freshSchoolIdentity, setFreshSchoolIdentity] = useState<{ name: string | null; logo: string | null; logo2: string | null }>({ name: null, logo: null, logo2: null })
  const reportCardPreviewRef = useRef<HTMLDivElement | null>(null)
  const [measuredReportHeightPx, setMeasuredReportHeightPx] = useState<number | undefined>(undefined)
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false)
  const [printPreviewHtml, setPrintPreviewHtml] = useState('')
  const [printPreviewTitle, setPrintPreviewTitle] = useState('Print Preview')

  // Data states
  const [summary, setSummary] = useState<{
    totalStudents: number
    classAverage: number
    passRate: number
    gradeDistribution: Record<string, number>
    divisionDistribution: Record<string, number>
    genderBreakdown: { male: number; female: number }
    highestScore: number
    lowestScore: number
  } | null>(null)

  const [results, setResults] = useState<Array<{
    student: { fullName: string; admissionNo: string | null; gender: string }
    totalMarks: number | null
    averageMarks: number | null
    grade: string | null
    division: string | null
    points: number | null
    rank: number | null
    status: string
    subjectCount: number
  }>>([])

  // Overall results with subjects as columns
  const [overallData, setOverallData] = useState<{
    students: Array<{
      studentInfo: { id: string; fullName: string; gender: string; admissionNo: string | null }
      subjectMarks: Record<string, { marks: number | null; grade: string | null }>
      result: { average: number | null; grade: string | null; points: number | null; division: string | null; rank: number | null; status?: string; subjectCount?: number } | null
    }>
    subjects: Array<{ id: string; name: string; shortName: string | null }>
    totalStudents: number
  } | null>(null)

  const [topStudents, setTopStudents] = useState<RankedStudentItem[]>([])

  const [bottomStudents, setBottomStudents] = useState<RankedStudentItem[]>([])

  const [subjectAnalysis, setSubjectAnalysis] = useState<Array<{
    subjectName: string
    shortName: string | null
    totalStudents: number
    average: number
    highest: number
    lowest: number
    passRate: number
    gradeDistribution: Record<string, number>
  }>>([])

  const [reportCard, setReportCard] = useState<{
    student: { fullName: string; gender: string; admissionNo: string | null; dob: string | null }
    class: { name: string; fullName: string; schoolType: string; academicYear: string | null; term: string | null }
    school: { name: string; schoolType: string; registrationNo: string | null; council: string | null; region: string | null; district: string | null; ward: string | null; phone: string | null; email: string | null; logo: string | null; logo2: string | null; headTeacherName: string | null; headTeacherSign: string | null; headTeacherComments: string | null; classTeacherName: string | null; classTeacherShortName: string | null; classTeacherComments: string | null; ctGradeA_en: string | null; ctGradeB_en: string | null; ctGradeC_en: string | null; ctGradeD_en: string | null; ctGradeE_en: string | null; ctGradeA_sw: string | null; ctGradeB_sw: string | null; ctGradeC_sw: string | null; ctGradeD_sw: string | null; ctGradeE_sw: string | null; htGradeA_en: string | null; htGradeB_en: string | null; htGradeC_en: string | null; htGradeD_en: string | null; htGradeE_en: string | null; htGradeA_sw: string | null; htGradeB_sw: string | null; htGradeC_sw: string | null; htGradeD_sw: string | null; htGradeE_sw: string | null }
    exam: { name: string; examType: string; term: string; academicYear: string; examDate: string | null }
    marks: Array<{ subjectName: string; shortName: string | null; marks: number | null; grade: string | null; remarks: string | null; teacherName: string }>
    result: { totalMarks: number | null; averageMarks: number | null; grade: string | null; division: string | null; points: number | null; rank: number | null; classTeacherComment: string | null; headTeacherComment: string | null; closingDate: string | null; openingDate: string | null; status?: string; subjectCount?: number } | null
    totalStudents?: number
    tabia: { discipline: string | null; hygiene: string | null; hardWorking: string | null; cooperation: string | null; honesty: string | null; leadership: string | null; sports: string | null } | null
    classTeacher: { name: string; shortName: string | null; sign: string | null; comments?: string | null } | null
  } | null>(null)

  // Subject report dialog
  const [subjectReportOpen, setSubjectReportOpen] = useState(false)
  const [subjectReportSubjects, setSubjectReportSubjects] = useState<SubjectOption[]>([])
  const [subjectReportSubjectId, setSubjectReportSubjectId] = useState('')
  const [subjectReportMaxMarks, setSubjectReportMaxMarks] = useState('')
  const [subjectReportData, setSubjectReportData] = useState<Array<{
    studentId: string; studentName: string; gender: string; marks: number | null; grade: string | null
  }> | null>(null)

  // Translation helper - memoized
  const t = useCallback((key: LangKey): string => {
    return translations[reportLang][key] || translations.en[key]
  }, [reportLang])

  // Filter exams and classes by current school type - memoized
  const modeClasses = useMemo(() => classes.filter(c => c.schoolType === schoolType), [classes, schoolType])
  const modeExams = useMemo(() => exams.filter(e => {
    const examClass = e.class || classes.find(c => c.id === (e as unknown as { classId?: string }).classId)
    return examClass?.schoolType === schoolType
  }), [exams, classes, schoolType])

  const getExamClassId = useCallback((examId = selectedExam) => {
    const exam = exams.find(e => e.id === examId)
    return exam?.class?.id || (exam as unknown as { classId?: string } | undefined)?.classId || ''
  }, [exams, selectedExam])

  const getActiveClassId = useCallback(() => {
    return selectedClass || getExamClassId() || modeClasses[0]?.id || ''
  }, [getExamClassId, modeClasses, selectedClass])

  useEffect(() => {
    loadData()
  }, [currentSchool])

  async function loadData() {
    try {
      const [examData, classData, schoolData] = await Promise.all([
        apiCall(`/api/shulea/exams?schoolId=${currentSchool?.id || ''}`),
        apiCall(`/api/shulea/classes?schoolId=${currentSchool?.id || ''}`),
        apiCall(`/api/shulea/school?schoolId=${currentSchool?.id || ''}`),
      ])
      const loadedExams: ExamItem[] = examData.exams || []
      const loadedClasses: ClassItem[] = classData.classes || []
      setExams(loadedExams)
      setClasses(loadedClasses)

      const loadedModeClasses = loadedClasses.filter(c => c.schoolType === schoolType)
      const loadedModeExams = loadedExams.filter(e => {
        const examClass = e.class || loadedClasses.find(c => c.id === (e as unknown as { classId?: string }).classId)
        return examClass?.schoolType === schoolType
      })
      // Persisted navigation can contain an exam/class from a previous school
      // or mode. Keep both Select controls on valid options before rendering.
      const validExam = loadedModeExams.find(exam => exam.id === selectedExam)
      const nextExam = validExam?.id || loadedModeExams[0]?.id || ''
      const nextExamItem = validExam || loadedModeExams[0]
      const examClassId = nextExamItem?.class?.id || (nextExamItem as unknown as { classId?: string } | undefined)?.classId || ''
      const validClass = loadedModeClasses.find(cls => cls.id === selectedClass)
      const nextClass = validClass?.id || examClassId || loadedModeClasses[0]?.id || ''
      if (nextExam !== selectedExam) setSelectedExam(nextExam)
      if (nextClass !== selectedClass) setSelectedClass(nextClass)

      // Update fresh school identity from API
      const schools = schoolData.schools || []
      if (schools.length > 0) {
        setFreshSchoolIdentity({
          name: schools[0].name || null,
          logo: schools[0].logo || null,
          logo2: schools[0].logo2 || null,
        })
      }
    } catch {
      toast.error('Failed to load data')
    }
  }

  useEffect(() => {
    if (!selectedExam) return
    const examClassId = getExamClassId(selectedExam)
    if (examClassId && selectedClass !== examClassId) {
      setSelectedClass(examClassId)
    }
  }, [getExamClassId, selectedClass, selectedExam])

  // Load students for report card tab
  useEffect(() => {
    if (activeTab === 'report-card') {
      if (selectedClass && selectedExam && getExamClassId(selectedExam) !== selectedClass) return
      loadStudents()
    }
  }, [activeTab, selectedClass, selectedExam, getExamClassId])

  useEffect(() => {
    const classId = getActiveClassId()
    if (subjectReportOpen && classId) {
      loadSubjectReportSubjects()
      loadStudents()
    }
  }, [subjectReportOpen, selectedClass, selectedExam, getActiveClassId])

  useEffect(() => {
    if (!subjectReportOpen || subjectReportSubjectId) return
    const firstSubject = subjectReportSubjects[0] || overallData?.subjects[0]
    if (firstSubject) setSubjectReportSubjectId(firstSubject.id)
  }, [overallData, subjectReportOpen, subjectReportSubjectId, subjectReportSubjects])

  async function loadStudents() {
    try {
      const classToUse = getActiveClassId()
      if (!classToUse) {
        setStudents([])
        setSelectedStudent('')
        setReportCard(null)
        return
      }
      const data = await apiCall(`/api/shulea/students?classId=${classToUse}&status=ACTIVE`)
      const loadedStudents: StudentItem[] = data.students || []
      setStudents(loadedStudents)
      if ((!selectedStudent || selectedStudent === 'ALL') && loadedStudents.length > 0) {
        setSelectedStudent(loadedStudents[0].id)
        return
      }
      if (selectedStudent && selectedStudent !== 'ALL' && !loadedStudents.some(student => student.id === selectedStudent)) {
        setSelectedStudent(loadedStudents[0]?.id || '')
        setReportCard(null)
      }
    } catch {
      setStudents([])
      toast.error('Failed to load students')
    }
  }

  async function loadSubjectReportSubjects() {
    try {
      const classId = getActiveClassId()
      if (!classId) return
      const data = await apiCall(`/api/shulea/subjects?action=class-subjects&classId=${classId}`)
      const loadedSubjects = (data.classSubjects || [])
        .map(normalizeSubjectOption)
        .filter(Boolean) as SubjectOption[]
      setSubjectReportSubjects(loadedSubjects)
    } catch {
      setSubjectReportSubjects([])
      toast.error('Failed to load subjects')
    }
  }

  // Tab-specific data loading
  useEffect(() => {
    const classId = getActiveClassId()
    if (!selectedExam || !classId) return

    if (activeTab === 'summary') loadSummary()
    else if (activeTab === 'overall') loadOverallResults()
    else if (activeTab === 'top-bottom') loadTopBottom()
    else if (activeTab === 'subject-analysis') loadSubjectAnalysis()
  }, [selectedExam, selectedClass, activeTab, getActiveClassId])

  useEffect(() => {
    if (
      activeTab === 'report-card' &&
      selectedStudent &&
      selectedStudent !== 'ALL' &&
      selectedExam &&
      (!selectedClass || getExamClassId(selectedExam) === selectedClass)
    ) {
      loadReportCard()
    } else if (activeTab === 'report-card' && selectedStudent === 'ALL') {
      setReportCard(null) // Clear individual report when ALL is selected
    }
  }, [selectedStudent, selectedExam, selectedClass, activeTab, getExamClassId])

  useEffect(() => {
    if (activeTab !== 'report-card' || !reportCard) {
      setMeasuredReportHeightPx(undefined)
      return
    }

    const measure = () => {
      const el = reportCardPreviewRef.current
      if (!el) return
      const nextHeight = el.scrollHeight
      setMeasuredReportHeightPx(previousHeight => previousHeight === nextHeight ? previousHeight : nextHeight)
    }

    const frame = window.requestAnimationFrame(measure)
    const timer = window.setTimeout(measure, 250)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [activeTab, reportCard, reportLang, closingDate, openingDate])

  async function loadSummary() {
    setLoading(true)
    try {
      const classId = getActiveClassId()
      if (!classId) return
      const data = await apiCall(`/api/shulea/results?action=summary&examId=${selectedExam}&classId=${classId}`)
      setSummary(data.summary || null)
    } catch {
      toast.error('Failed to load summary')
    } finally {
      setLoading(false)
    }
  }

  async function loadOverallResults() {
    setLoading(true)
    try {
      const classId = getActiveClassId()
      if (!classId) return
      const data = await apiCall(`/api/shulea/results?action=overall-results&examId=${selectedExam}&classId=${classId}`)
      setOverallData(data)
      // Also load basic results for backward compat
      const basicData = await apiCall(`/api/shulea/results?examId=${selectedExam}&classId=${classId}`)
      setResults(basicData.results || [])
    } catch {
      toast.error('Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  async function loadTopBottom() {
    setLoading(true)
    try {
      const classId = getActiveClassId()
      const classParam = classId ? `&classId=${classId}` : ''
      const [topData, bottomData] = await Promise.all([
        apiCall(`/api/shulea/results?action=top-students&examId=${selectedExam}&limit=10${classParam}`),
        apiCall(`/api/shulea/results?action=bottom-students&examId=${selectedExam}&limit=10${classParam}`),
      ])
      setTopStudents(normalizeRankedStudents(topData.topStudents || []))
      setBottomStudents(normalizeRankedStudents(bottomData.bottomStudents || []))
    } catch {
      toast.error('Failed to load student rankings')
    } finally {
      setLoading(false)
    }
  }

  function normalizeRankedStudents(rows: RankedStudentItem[]): RankedStudentItem[] {
    return rows.filter(row => row.student?.fullName)
  }

  function printableRankedStudents(rows: RankedStudentItem[]) {
    return rows
      .filter(row => row.student?.fullName)
      .map(row => ({
        ...row,
        student: {
          fullName: row.student?.fullName || '',
          gender: row.student?.gender || '',
        },
      }))
  }

  async function loadSubjectAnalysis() {
    setLoading(true)
    try {
      const classId = getActiveClassId()
      if (!classId) return
      const data = await apiCall(`/api/shulea/results?action=subject-analysis&examId=${selectedExam}&classId=${classId}`)
      setSubjectAnalysis(data.analysis || [])
    } catch {
      toast.error('Failed to load subject analysis')
    } finally {
      setLoading(false)
    }
  }

  async function loadReportCard() {
    setLoading(true)
    try {
      const requestedClassId = getActiveClassId()
      const requestedExamClassId = getExamClassId(selectedExam)
      if (requestedClassId && requestedExamClassId && requestedClassId !== requestedExamClassId) {
        const matchingExam = modeExams.find(exam => getExamClassId(exam.id) === requestedClassId)
        if (matchingExam) setSelectedExam(matchingExam.id)
        setReportCard(null)
        return
      }
      const data = await apiCall(`/api/shulea/results?action=report-card&studentId=${selectedStudent}&examId=${selectedExam}`)
      let loadedReportCard = data.reportCard || null

      // A class and exam must always describe the same class. This can happen
      // briefly when an older selection is restored from the previous view.
      const selectedExamClassId = getExamClassId(selectedExam)
      if (loadedReportCard && selectedExamClassId && selectedExamClassId !== loadedReportCard.class.id) {
        const matchingExam = modeExams.find(exam => getExamClassId(exam.id) === loadedReportCard?.class.id)
        if (matchingExam) setSelectedExam(matchingExam.id)
        setReportCard(null)
        return
      }

      // Demo data is read-only but must still be complete. If an older local
      // state returns the student shell without marks, rehydrate the selected
      // class/exam before rendering or generating print/download output.
      if (loadedReportCard && loadedReportCard.marks.length === 0) {
        const marksData = await apiCall(
          `/api/shulea/marks?classId=${loadedReportCard.class.id}&examId=${selectedExam}`
        )
        const studentMarks = (marksData.marks || [])
          .filter((mark: { studentId?: string }) => mark.studentId === selectedStudent)
          .map((mark: {
            marks: number | null
            grade: string | null
            remarks?: string | null
            classSubject?: { subject?: { name?: string; shortName?: string | null } }
          }) => ({
            subjectName: mark.classSubject?.subject?.name || 'Subject',
            shortName: mark.classSubject?.subject?.shortName || null,
            marks: mark.marks,
            grade: mark.grade,
            remarks: mark.remarks || null,
            teacherName: '',
          }))
        if (studentMarks.length > 0) {
          loadedReportCard = { ...loadedReportCard, marks: studentMarks }
        }
      }

      // Keep the report card summary in sync with the same class/exam data
      // used by the Overall Results tab when the direct result row is stale.
      if (loadedReportCard && !loadedReportCard.result && loadedReportCard.marks.length > 0) {
        const overall = await apiCall(
          `/api/shulea/results?action=overall-results&examId=${selectedExam}&classId=${loadedReportCard.class.id}`
        )
        const row = (overall.students || []).find((item: { studentInfo?: { id?: string } }) => item.studentInfo?.id === selectedStudent)
        if (row?.result) {
          loadedReportCard = {
            ...loadedReportCard,
            result: {
              totalMarks: loadedReportCard.marks.reduce((sum: number, mark: { marks: number | null }) => sum + (mark.marks || 0), 0),
              averageMarks: row.result.average,
              grade: row.result.grade,
              division: row.result.division,
              points: row.result.points,
              rank: row.result.rank,
              status: row.result.status,
              subjectCount: row.result.subjectCount,
              classTeacherComment: null,
              headTeacherComment: null,
              closingDate: null,
              openingDate: null,
            },
          }
        }
      }

      setReportCard(loadedReportCard)
      if (loadedReportCard?.result?.closingDate) {
        setClosingDate(loadedReportCard.result.closingDate)
      }
      if (loadedReportCard?.result?.openingDate) {
        setOpeningDate(loadedReportCard.result.openingDate)
      }
    } catch {
      toast.error('Failed to load report card')
    } finally {
      setLoading(false)
    }
  }

  async function saveReportDates() {
    if (!selectedExam || !selectedClass) return
    if (currentSchool?.isDemo) {
      toast.info('Demo Mode: Editing is disabled.')
      return
    }
    try {
      await apiCall('/api/shulea/results', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update-dates',
          examId: selectedExam,
          classId: selectedClass,
          closingDate: closingDate || null,
          openingDate: openingDate || null,
        }),
      })
      toast.success('Dates saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save dates')
    }
  }

  // Load subject report data for subject teacher print
  async function loadSubjectReport() {
    const classId = getActiveClassId()
    if (!subjectReportSubjectId || !selectedExam || !classId) {
      toast.error('Please select subject, exam and class')
      return
    }
    try {
      const selectedSubjectInfo = getSubjectReportSubject()
      const subjectIdToUse = selectedSubjectInfo?.subjectId || subjectReportSubjectId
      const data = await apiCall(`/api/shulea/marks?classId=${classId}&examId=${selectedExam}&subjectId=${subjectIdToUse}`)
      
      const marks: Array<{
        studentId: string; student?: { fullName: string; gender: string }; marks: number | null; grade: string | null
      }> = data.marks || []
      const fetchedStudents: StudentItem[] = data.students || []
      if (fetchedStudents.length > 0) setStudents(fetchedStudents)

      const studentMap = new Map(fetchedStudents.map(student => [student.id, student]))
      setSubjectReportData(marks.map(m => {
        const student = m.student || studentMap.get(m.studentId)
        return {
          studentId: m.studentId,
          studentName: student?.fullName || '',
          gender: student?.gender || '',
          marks: m.marks,
          grade: m.grade,
        }
      }))
      
      if (marks.length === 0 && fetchedStudents.length > 0) {
        toast.info('No marks found for this subject yet')
      }
    } catch (error) {
      console.error('[loadSubjectReport] Error:', error)
      toast.error('Failed to load subject data')
    }
  }

  function normalizeSubjectOption(cs: {
    id?: string
    subjectId?: string
    subjectName?: string
    name?: string
    shortName?: string | null
    subject?: { id?: string; name?: string; shortName?: string | null }
  }): SubjectOption | null {
    const id = cs.id || ''
    const subjectId = cs.subject?.id || cs.subjectId || ''
    const name = cs.subject?.name || cs.subjectName || cs.name || ''
    const shortName = cs.subject?.shortName || cs.shortName || null
    if (!id || !subjectId || !name) return null
    return { id, subjectId, name, shortName }
  }

  function getSubjectReportSubject(): SubjectOption | null {
    const loadedSubject = subjectReportSubjects.find(s => s.id === subjectReportSubjectId || s.subjectId === subjectReportSubjectId)
    if (loadedSubject) return loadedSubject

    const overallSubject = overallData?.subjects.find(s => s.id === subjectReportSubjectId)
    return overallSubject
      ? { id: overallSubject.id, subjectId: overallSubject.id, name: overallSubject.name, shortName: overallSubject.shortName }
      : null
  }

  function getSchoolTemplateData() {
    // Priority: use report card school data (which includes logo from API), then fresh logos from API, then store
    const rcSchoolData = reportCard?.school
    return {
      name: rcSchoolData?.name || freshSchoolIdentity.name || currentSchool?.name || '',
      schoolType: schoolType,
      registrationNo: rcSchoolData?.registrationNo || currentSchool?.registrationNo || null,
      region: rcSchoolData?.region || currentSchool?.region || null,
      district: rcSchoolData?.district || currentSchool?.district || null,
      ward: rcSchoolData?.ward || currentSchool?.ward || null,
      logo: rcSchoolData?.logo || freshSchoolIdentity.logo || currentSchool?.logo || null,
      logo2: rcSchoolData?.logo2 || freshSchoolIdentity.logo2 || currentSchool?.logo2 || null,
      headTeacherName: rcSchoolData?.headTeacherName || null,
      headTeacherSign: rcSchoolData?.headTeacherSign || null,
      headTeacherComments: rcSchoolData?.headTeacherComments || null,
      classTeacherName: rcSchoolData?.classTeacherName || null,
      classTeacherShortName: rcSchoolData?.classTeacherShortName || null,
      classTeacherComments: rcSchoolData?.classTeacherComments || null,
    }
  }

  async function handlePrint(htmlContent: string, title: string = 'Print Report') {
    // Check if running in Capacitor (mobile app)
    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor

    if (isCapacitor) {
      try {
        const { PrintService } = await import('@/services/print/PrintService')
        toast.loading('Preparing print...', { id: 'print-loading' })
        const result = await PrintService.directPrint(htmlContent, title)
        toast.dismiss('print-loading')
        if (result.success) {
          toast.success('Print dialog opened')
        } else {
          toast.error(result.error || 'Failed to open print dialog')
        }
      } catch (error) {
        console.error('Capacitor print error:', error)
        toast.dismiss('print-loading')
        // Fallback to browser print
        fallbackPrint(htmlContent)
      }
    } else {
      setPrintPreviewTitle(title)
      setPrintPreviewHtml(htmlContent)
      setPrintPreviewOpen(true)
    }
  }
  
  function fallbackPrint(htmlContent: string) {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Please allow popups to print')
      return
    }
    
    // Add back button and close button to the print window
    const backButtonHtml = `
      <div style="position: fixed; top: 10px; right: 10px; z-index: 9999; display: flex; gap: 10px; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <button onclick="window.close()" style="padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">Close</button>
        <button onclick="window.__shuleaFitReports && window.__shuleaFitReports(); window.print()" style="padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">Print</button>
      </div>
      <style>
        @media print {
          div[style*="position: fixed"] { display: none !important; }
        }
      </style>
    `
    
    // Insert the back button after the opening body tag
    const modifiedHtml = htmlContent.replace('<body>', '<body>' + backButtonHtml)
    
    printWindow.document.write(modifiedHtml)
    printWindow.document.close()
    printWindow.focus()
  }

  async function handleDownloadReport(htmlContent: string, filename: string) {
    // Check if running in Capacitor (mobile app)
    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor

    if (isCapacitor) {
      try {
        const { PrintService } = await import('@/services/print/PrintService')
        toast.loading('Generating PDF...', { id: 'download-loading' })
        const result = await PrintService.generatePdfFromHtml(htmlContent, {
          filename,
          title: filename,
          language: reportLang,
          saveToDevice: true,
          share: false,
        })
        toast.dismiss('download-loading')
        if (result.success) {
          toast.success('Report saved to device', { 
            description: 'Check your Downloads folder',
            duration: 5000 
          })
        } else {
          toast.error(result.error || 'Failed to save report')
        }
      } catch (error) {
        console.error('Capacitor download error:', error)
        toast.dismiss('download-loading')
        // Fallback to browser download as PDF
        fallbackDownloadPdf(htmlContent, filename)
      }
    } else {
      // On web, generate PDF and download
      fallbackDownloadPdf(htmlContent, filename)
    }
  }

  async function handleShareReport(htmlContent: string, filename: string, title: string) {
    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor

    if (!isCapacitor) {
      await handleDownloadReport(htmlContent, filename)
      return
    }

    try {
      const { PrintService } = await import('@/services/print/PrintService')
      toast.loading('Preparing report...', { id: 'share-loading' })
      const result = await PrintService.generatePdfFromHtml(htmlContent, {
        filename,
        title,
        language: reportLang,
        saveToDevice: true,
        share: true,
      })
      toast.dismiss('share-loading')
      if (result.success) {
        toast.success('Report ready to share')
      } else {
        toast.error(result.error || 'Failed to share report')
      }
    } catch (error) {
      console.error('Capacitor share error:', error)
      toast.dismiss('share-loading')
      await handleDownloadReport(htmlContent, filename)
    }
  }

  function buildCurrentReport() {
    const classInfo = classes.find(c => c.id === selectedClass)
    const examInfo = exams.find(e => e.id === selectedExam)

    if (!selectedExam || !classInfo || !examInfo) {
      toast.error('Select exam and class first')
      return null
    }

    if (activeTab === 'summary') {
      if (!summary) {
        toast.error('Summary is not ready yet')
        return null
      }
      return {
        title: 'Class Summary',
        filename: 'class-summary',
        html: generateClassSummaryHtml({
          school: getSchoolTemplateData(),
          class: { fullName: classInfo.fullName, schoolType: classInfo.schoolType },
          exam: { name: examInfo.name, term: examInfo.term, academicYear: examInfo.academicYear },
          summary,
          lang: reportLang,
        }),
      }
    }

    if (activeTab === 'overall') {
      if (!overallData) {
        toast.error('Overall results are not ready yet')
        return null
      }
      return {
        title: 'Overall Results',
        filename: 'overall-results',
        html: generateOverallResultsHtml({
          school: getSchoolTemplateData(),
          class: { fullName: classInfo.fullName, schoolType: classInfo.schoolType },
          exam: { name: examInfo.name, term: examInfo.term, academicYear: examInfo.academicYear },
          students: overallData.students,
          subjects: overallData.subjects,
          totalStudents: overallData.totalStudents,
          lang: reportLang,
        }),
      }
    }

    if (activeTab === 'top-bottom') {
      const printableTopStudents = printableRankedStudents(topStudents)
      const printableBottomStudents = printableRankedStudents(bottomStudents)
      if (printableTopStudents.length === 0 && printableBottomStudents.length === 0) {
        toast.error('Top/bottom report is not ready yet')
        return null
      }
      return {
        title: 'Top/Bottom Students',
        filename: 'top-bottom-students',
        html: generateTopBottomStudentsHtml({
          school: getSchoolTemplateData(),
          exam: { name: examInfo.name, term: examInfo.term, academicYear: examInfo.academicYear },
          topStudents: printableTopStudents,
          bottomStudents: printableBottomStudents,
          isSecondary: schoolType === 'SECONDARY',
          lang: reportLang,
        }),
      }
    }

    if (activeTab === 'subject-analysis') {
      if (subjectAnalysis.length === 0) {
        toast.error('Subject analysis is not ready yet')
        return null
      }
      return {
        title: 'Subject Analysis',
        filename: 'subject-analysis',
        html: generateSubjectAnalysisHtml({
          school: getSchoolTemplateData(),
          class: { fullName: classInfo.fullName, schoolType: classInfo.schoolType },
          exam: { name: examInfo.name, term: examInfo.term, academicYear: examInfo.academicYear },
          analysis: subjectAnalysis,
          lang: reportLang,
        }),
      }
    }

    toast.info('Use the report card buttons below for student reports')
    return null
  }

  function handleCurrentReportPrint() {
    const report = buildCurrentReport()
    if (report) handlePrint(report.html, report.title)
  }

  function handleCurrentReportDownload() {
    const report = buildCurrentReport()
    if (report) handleDownloadReport(report.html, report.filename)
  }

  function handleCurrentReportShare() {
    const report = buildCurrentReport()
    if (report) handleShareReport(report.html, report.filename, report.title)
  }
  
  async function fallbackDownloadPdf(htmlContent: string, filename: string) {
    try {
      const jsPDF = await import('jspdf')
      const html2canvas = await import('html2canvas')
      
      // Create a temporary container for rendering
      const container = document.createElement('div')
      container.innerHTML = htmlContent
      container.style.position = 'absolute'
      container.style.left = '-9999px'
      container.style.width = '210mm'
      container.style.minHeight = '297mm'
      document.body.appendChild(container)

      // Convert to canvas with higher quality
      const canvas = await html2canvas.default(container, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        windowHeight: 1123,
        allowTaint: true,
      })

      // Calculate dimensions for A4
      const imgData = canvas.toDataURL('image/png', 1.0)
      const pdf = new jsPDF.default({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      
      // Calculate ratio to fit A4 while maintaining aspect ratio
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
      const finalWidth = imgWidth * ratio
      const finalHeight = imgHeight * ratio

      const imgX = (pdfWidth - finalWidth) / 2
      const imgY = 0

      pdf.addImage(imgData, 'PNG', imgX, imgY, finalWidth, finalHeight)
      document.body.removeChild(container)

      // Save PDF
      pdf.save(`${filename}.pdf`)
      toast.success('PDF downloaded successfully')
    } catch (error) {
      console.error('PDF generation error:', error)
      toast.error('Failed to generate PDF')
    }
  }

  // Print all report cards for class
  function handlePrintAllReports() {
    if (!selectedExam || !selectedClass) {
      toast.error('Select exam and class first')
      return
    }
    fetchAllReportCards()
  }

  async function fetchAllReportCards() {
    if (!selectedExam || !selectedClass) {
      toast.error('Select exam and class first')
      return
    }
    
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    try {
      let allHtml = ''
      const schoolData = getSchoolTemplateData()
      const classInfo = classes.find(c => c.id === selectedClass)
      const examInfo = exams.find(e => e.id === selectedExam)

      for (let i = 0; i < students.length; i++) {
        const s = students[i]
        try {
          const data = await apiCall(`/api/shulea/results?action=report-card&studentId=${s.id}&examId=${selectedExam}`)
          const rc = data.reportCard
          if (!rc) continue

          // Pre-generate comments for each student
          const localizedComments = getLocalizedReportComments(rc.school, rc.result, reportLang)
          const printClassTeacherComment = localizedComments.classTeacherComment
          const printHeadTeacherComment = localizedComments.headTeacherComment

          const html = generateReportCardHtml({
            school: {
              ...schoolData,
              name: rc.school.name || schoolData.name,
              logo: rc.school.logo || schoolData.logo,
              logo2: rc.school.logo2 || schoolData.logo2,
              headTeacherName: rc.school.headTeacherName,
              headTeacherSign: rc.school.headTeacherSign,
            },
            student: rc.student,
            class: rc.class,
            exam: rc.exam,
            marks: rc.marks,
            result: rc.result ? { 
              ...rc.result, 
              closingDate, 
              openingDate,
              classTeacherComment: printClassTeacherComment || rc.result.classTeacherComment,
              headTeacherComment: printHeadTeacherComment || rc.result.headTeacherComment,
            } : rc.result,
            tabia: rc.tabia,
            classTeacher: rc.classTeacher,
            totalStudents: rc.totalStudents || students.filter(student => student.id !== s.id || rc.result?.status === 'COMPLETE').length,
            lang: reportLang,
          })

          // Extract just the body content (between <body> tags)
          const bodyContent = html.match(/<body>([\s\S]*)<\/body>/)?.[1] || ''
          allHtml += `<div class="report-page${i < students.length - 1 ? ' page-break-after' : ''}">${bodyContent}</div>`
        } catch {
          // Skip student if error
        }
      }

      // Write combined HTML with styles - extract styles from a single template
      const sampleHtml = generateReportCardHtml({
        school: schoolData,
        student: { fullName: '', gender: '', admissionNo: null, dob: null },
        class: { name: '', fullName: '', schoolType: schoolType, academicYear: null, term: null },
        exam: { name: '', examType: '', term: '', academicYear: '' },
        marks: [],
        result: null,
        tabia: null,
        classTeacher: null,
        totalStudents: 0,
        lang: reportLang,
      })
      const styleContent = sampleHtml.match(/<style>([\s\S]*)<\/style>/)?.[1] || ''
      
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report Cards</title>
        <style>
          ${styleContent}
          .page-break { page-break-before: always; }
          .page-break-after { page-break-after: always; break-after: page; }
          .report-page { padding: 0; page-break-inside: avoid; break-inside: avoid; overflow: hidden; }
        </style>
      </head>
      <body>${allHtml}</body></html>`
      
      printWindow.document.write(fullHtml)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        ;(printWindow as Window & { __shuleaFitReports?: () => void }).__shuleaFitReports?.()
        printWindow.print()
      }, 500)
    } catch {
      toast.error('Failed to generate reports')
    }
  }

  // Summary Tab
  function renderSummary() {
    if (loading) return <LoaderSpinner />
    if (!summary) return <EmptyState message="Select an exam to view summary" />

    const isSecondary = schoolType === 'SECONDARY'
    const distribution = isSecondary ? summary.divisionDistribution : summary.gradeDistribution
    const distKeys = isSecondary ? ['I', 'II', 'III', 'IV', '0'] : ['A', 'B', 'C', 'D', 'E']

    return (
      <div className="w-full min-w-0 space-y-5 sm:space-y-4">
        <div className="flex flex-wrap justify-end gap-2 print-hide">
          <Button variant="outline" onClick={() => {
            const classInfo = classes.find(c => c.id === selectedClass)
            const examInfo = exams.find(e => e.id === selectedExam)
            if (!summary || !classInfo || !examInfo) return
            const html = generateClassSummaryHtml({
              school: getSchoolTemplateData(),
              class: { fullName: classInfo.fullName, schoolType: classInfo.schoolType },
              exam: { name: examInfo.name, term: examInfo.term, academicYear: examInfo.academicYear },
              summary,
              lang: reportLang,
            })
            handlePrint(html, 'Class Summary')
          }} className="gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button variant="outline" onClick={() => {
            const classInfo = classes.find(c => c.id === selectedClass)
            const examInfo = exams.find(e => e.id === selectedExam)
            if (!summary || !classInfo || !examInfo) return
            const html = generateClassSummaryHtml({
              school: getSchoolTemplateData(),
              class: { fullName: classInfo.fullName, schoolType: classInfo.schoolType },
              exam: { name: examInfo.name, term: examInfo.term, academicYear: examInfo.academicYear },
              summary,
              lang: reportLang,
            })
            handleDownloadReport(html, 'class-summary')
          }} className="gap-2">
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm">
            <CardContent className="p-5 text-center sm:p-4">
              <p className="text-2xl font-bold text-emerald-600">{summary.totalStudents}</p>
              <p className="text-xs text-muted-foreground">Total Students</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-5 text-center sm:p-4">
              <p className="text-2xl font-bold text-blue-600">{summary.classAverage}</p>
              <p className="text-xs text-muted-foreground">Class Average</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-5 text-center sm:p-4">
              <p className="text-2xl font-bold text-green-600">{summary.passRate}%</p>
              <p className="text-xs text-muted-foreground">Pass Rate</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-5 text-center sm:p-4">
              <p className="text-2xl font-bold text-purple-600">
                {summary.genderBreakdown.male}M / {summary.genderBreakdown.female}F
              </p>
              <p className="text-xs text-muted-foreground">Gender Split</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">
              {isSecondary ? 'Division Distribution' : 'Grade Distribution'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="mobile-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{isSecondary ? 'Division' : 'Grade'}</TableHead>
                  <TableHead className="text-center">Count</TableHead>
                  <TableHead className="text-center">Percentage</TableHead>
                  <TableHead>Distribution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distKeys.map((key) => {
                  const count = distribution[key] || 0
                  const pct = summary.totalStudents > 0 ? Math.round((count / summary.totalStudents) * 100) : 0
                  return (
                    <TableRow key={key}>
                      <TableCell data-label={isSecondary ? 'Division' : 'Grade'}><GradeBadge grade={key} /></TableCell>
                      <TableCell className="text-center font-medium" data-label="Count">{count}</TableCell>
                      <TableCell className="text-center" data-label="Percentage">{pct}%</TableCell>
                      <TableCell data-label="Distribution">
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div className="bg-emerald-500 h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="shadow-sm">
            <CardContent className="p-5 text-center sm:p-4">
              <p className="text-2xl font-bold text-green-600">{summary.highestScore}</p>
              <p className="text-xs text-muted-foreground">Highest Average</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-5 text-center sm:p-4">
              <p className="text-2xl font-bold text-red-600">{summary.lowestScore}</p>
              <p className="text-xs text-muted-foreground">Lowest Average</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Overall Results Tab - Wide table with subjects as columns
  function renderOverallResults() {
    if (loading) return <LoaderSpinner />
    if (!overallData || !overallData.students || overallData.students.length === 0)
      return <EmptyState message="No results computed yet. Compute results first from Marks Entry." />

    const { students: rawStudents, subjects: overallSubjects, totalStudents } = overallData
    const isSecondary = schoolType === 'SECONDARY'

    // Sort: COMPLETE students first, then INCOMPLETE
    const overallStudents = [...rawStudents].sort((a, b) => {
      const aIncomplete = a.result?.status === 'INCOMPLETE'
      const bIncomplete = b.result?.status === 'INCOMPLETE'
      if (aIncomplete && !bIncomplete) return 1
      if (!aIncomplete && bIncomplete) return -1
      return 0
    })

    return (
      <div className="w-full min-w-0 space-y-5 sm:space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              {totalStudents} Students
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setSubjectReportOpen(true)
              setSubjectReportSubjectId(subjectReportSubjects[0]?.id || overallData?.subjects[0]?.id || '')
              setSubjectReportData(null)
              setSubjectReportMaxMarks(isSecondary ? '100' : '50')
            }} className="gap-2">
              <BookOpen className="w-4 h-4" />
              Subject Report
            </Button>
            <Button variant="outline" onClick={() => {
              if (!overallData) return
              const classInfo = classes.find(c => c.id === selectedClass)
              const examInfo = exams.find(e => e.id === selectedExam)
              if (!classInfo || !examInfo) return
              const html = generateOverallResultsHtml({
                school: getSchoolTemplateData(),
                class: { fullName: classInfo.fullName, schoolType: classInfo.schoolType },
                exam: { name: examInfo.name, term: examInfo.term, academicYear: examInfo.academicYear },
                students: overallData.students,
                subjects: overallData.subjects,
                totalStudents: overallData.totalStudents,
                lang: reportLang,
              })
              handlePrint(html, 'Overall Results')
            }} className="gap-2">
              <Printer className="w-4 h-4" />
              Print
            </Button>
            <Button variant="outline" onClick={() => {
              if (!overallData) return
              const classInfo = classes.find(c => c.id === selectedClass)
              const examInfo = exams.find(e => e.id === selectedExam)
              if (!classInfo || !examInfo) return
              const html = generateOverallResultsHtml({
                school: getSchoolTemplateData(),
                class: { fullName: classInfo.fullName, schoolType: classInfo.schoolType },
                exam: { name: examInfo.name, term: examInfo.term, academicYear: examInfo.academicYear },
                students: overallData.students,
                subjects: overallData.subjects,
                totalStudents: overallData.totalStudents,
                lang: reportLang,
              })
              handleDownloadReport(html, 'overall-results')
            }} className="gap-2">
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="report-preview-scroll max-w-full" id="overall-wide-table">
              <table className="w-full border-collapse text-[10px] no-mobile-cards" style={{ minWidth: `${overallSubjects.length * 68 + 430}px` }}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-100">
                    <th className="border border-gray-400 px-1 py-1 text-center w-8">{t('sn')}</th>
                    <th className="border border-gray-400 px-1 py-1 text-left min-w-[120px]">{t('studentName')}</th>
                    <th className="border border-gray-400 px-1 py-1 text-center w-8">{t('sex')}</th>
                    {overallSubjects.map(subj => (
                      <th key={subj.id} className="border border-gray-400 px-0.5 py-1 text-center min-w-[50px]">
                        <div className="text-[8px] leading-tight">{subj.shortName || subj.name}</div>
                      </th>
                    ))}
                    <th className="border border-gray-400 px-1 py-1 text-center w-14 bg-blue-50">{t('average')}</th>
                    <th className="border border-gray-400 px-1 py-1 text-center w-10 bg-green-50">{t('grade')}</th>
                    {isSecondary && (
                      <>
                        <th className="border border-gray-400 px-1 py-1 text-center w-10 bg-purple-50">{t('points')}</th>
                        <th className="border border-gray-400 px-1 py-1 text-center w-10 bg-orange-50">{t('division')}</th>
                      </>
                    )}
                    <th className="border border-gray-400 px-1 py-1 text-center w-14 bg-amber-50">{t('position')}</th>
                    <th className="border border-gray-400 px-1 py-1 text-center w-20 bg-gray-50">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overallStudents.map((s, idx) => {
                    const isIncomplete = s.result?.status === 'INCOMPLETE'
                    const avg = isIncomplete ? null : s.result?.average
                    const gradeVal = isIncomplete ? null : s.result?.grade
                    const pointsVal = isIncomplete ? null : s.result?.points
                    const divVal = isIncomplete ? null : s.result?.division
                    const rankVal = isIncomplete ? null : s.result?.rank
                    const dash = '\u2014'

                    return (
                      <tr key={s.studentInfo.id} className={isIncomplete ? 'bg-red-50/40' : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                        <td className="border border-gray-300 px-1 py-0.5 text-center" data-label={t('sn')}>{idx + 1}</td>
                        <td className="border border-gray-300 px-1 py-0.5 font-medium" data-label={t('studentName')}>
                          <div className="flex items-center gap-1">
                            {s.studentInfo.fullName}
                            {isIncomplete && (
                              <span className="inline-block text-[7px] font-bold px-1 py-0 rounded bg-red-100 text-red-600 border border-red-200 leading-tight">INCOMPLETE</span>
                            )}
                          </div>
                        </td>
                        <td className="border border-gray-300 px-1 py-0.5 text-center" data-label={t('sex')}>{s.studentInfo.gender}</td>
                        {overallSubjects.map(subj => {
                          const sm = s.subjectMarks[subj.id]
                          const markVal = sm?.marks
                          const gradeS = sm?.grade
                          const hasMark = markVal != null
                          return (
                            <td key={subj.id} className={`border border-gray-300 px-0.5 py-0.5 text-center ${!hasMark ? 'text-gray-300' : ''}`} data-label={subj.shortName || subj.name}>
                              <div className="font-medium">{hasMark ? Math.round(markVal!) : '-'}</div>
                              {hasMark && gradeS && <div className="text-[8px] font-bold leading-none">{gradeS}</div>}
                            </td>
                          )
                        })}
                        <td className="border border-gray-300 px-1 py-0.5 text-center font-bold bg-blue-50" data-label={t('average')}>
                          {avg != null ? Math.round(avg * 100) / 100 : dash}
                        </td>
                        <td className="border border-gray-300 px-1 py-0.5 text-center bg-green-50" data-label={t('grade')}>
                          {gradeVal ? <GradeBadge grade={gradeVal} /> : dash}
                        </td>
                        {isSecondary && (
                          <>
                            <td className="border border-gray-300 px-1 py-0.5 text-center font-bold bg-purple-50" data-label={t('points')}>
                              {pointsVal != null ? pointsVal : dash}
                            </td>
                            <td className="border border-gray-300 px-1 py-0.5 text-center bg-orange-50" data-label={t('division')}>
                              {divVal ? <GradeBadge grade={divVal} /> : dash}
                            </td>
                          </>
                        )}
                        <td className="border border-gray-300 px-1 py-0.5 text-center font-bold bg-amber-50" data-label={t('position')}>
                          {rankVal ? `${rankVal}/${totalStudents}` : dash}
                        </td>
                        <td className="border border-gray-300 px-1 py-0.5 text-center bg-gray-50" data-label="Status">
                          {isIncomplete ? (
                            <span className="inline-block text-[8px] font-bold px-1.5 py-0 rounded bg-red-100 text-red-600 border border-red-200">INCOMPLETE</span>
                          ) : (
                            <span className="inline-block text-[8px] font-bold px-1.5 py-0 rounded bg-green-100 text-green-600 border border-green-200">COMPLETE</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Top/Bottom Tab
  function renderTopBottom() {
    if (loading) return <LoaderSpinner />
    const safeTopStudents = printableRankedStudents(topStudents)
    const safeBottomStudents = printableRankedStudents(bottomStudents)

    if (safeTopStudents.length === 0 && safeBottomStudents.length === 0)
      return <EmptyState message="No ranking data found for this exam. Open Marks Entry and click Compute Results, then return here." />

    return (
      <div className="w-full min-w-0 space-y-5 sm:space-y-4">
        <div className="flex flex-wrap justify-end gap-2 print-hide">
          <Button variant="outline" onClick={() => {
            const examInfo = exams.find(e => e.id === selectedExam)
            if (!examInfo) return
            const html = generateTopBottomStudentsHtml({
              school: getSchoolTemplateData(),
              exam: { name: examInfo.name, term: examInfo.term, academicYear: examInfo.academicYear },
              topStudents: safeTopStudents,
              bottomStudents: safeBottomStudents,
              isSecondary: schoolType === 'SECONDARY',
              lang: reportLang,
            })
            handlePrint(html, 'Top/Bottom Students')
          }} className="gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button variant="outline" onClick={() => {
            const examInfo = exams.find(e => e.id === selectedExam)
            if (!examInfo) return
            const html = generateTopBottomStudentsHtml({
              school: getSchoolTemplateData(),
              exam: { name: examInfo.name, term: examInfo.term, academicYear: examInfo.academicYear },
              topStudents: safeTopStudents,
              bottomStudents: safeBottomStudents,
              isSecondary: schoolType === 'SECONDARY',
              lang: reportLang,
            })
            handleDownloadReport(html, 'top-bottom-students')
          }} className="gap-2">
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
        <div id="top-bottom-content" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Top 10 Students
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="mobile-table text-xs sm:text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-center">Average</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                    {schoolType === 'SECONDARY' && <TableHead className="text-center">Div</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {safeTopStudents.map((s, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-center font-medium text-amber-600" data-label="#">{idx + 1}</TableCell>
                      <TableCell className="font-medium" data-label="Name">{s.student.fullName}</TableCell>
                      <TableCell className="text-center" data-label="Average">{s.averageMarks != null ? Math.round(s.averageMarks * 100) / 100 : '-'}</TableCell>
                      <TableCell className="text-center" data-label="Grade">{s.grade ? <GradeBadge grade={s.grade} /> : '-'}</TableCell>
                      {schoolType === 'SECONDARY' && <TableCell className="text-center" data-label="Div">{s.division || '-'}</TableCell>}
                    </TableRow>
                  ))}
                  {safeTopStudents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={schoolType === 'SECONDARY' ? 5 : 4} className="text-center py-6 text-muted-foreground">No data</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                Bottom 10 Students
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="mobile-table text-xs sm:text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-center">Average</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                    {schoolType === 'SECONDARY' && <TableHead className="text-center">Div</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {safeBottomStudents.map((s, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-center font-medium text-red-600" data-label="#">{idx + 1}</TableCell>
                      <TableCell className="font-medium" data-label="Name">{s.student.fullName}</TableCell>
                      <TableCell className="text-center" data-label="Average">{s.averageMarks != null ? Math.round(s.averageMarks * 100) / 100 : '-'}</TableCell>
                      <TableCell className="text-center" data-label="Grade">{s.grade ? <GradeBadge grade={s.grade} /> : '-'}</TableCell>
                      {schoolType === 'SECONDARY' && <TableCell className="text-center" data-label="Div">{s.division || '-'}</TableCell>}
                    </TableRow>
                  ))}
                  {safeBottomStudents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={schoolType === 'SECONDARY' ? 5 : 4} className="text-center py-6 text-muted-foreground">No data</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Subject Analysis Tab
  function renderSubjectAnalysis() {
    if (loading) return <LoaderSpinner />
    if (subjectAnalysis.length === 0)
      return <EmptyState message="No subject analysis available. Enter marks and compute results first." />

    return (
      <div className="w-full min-w-0 space-y-5 sm:space-y-4">
        <div className="flex flex-wrap justify-end gap-2 print-hide">
          <Button variant="outline" onClick={() => {
            const classInfo = classes.find(c => c.id === selectedClass)
            const examInfo = exams.find(e => e.id === selectedExam)
            if (!classInfo || !examInfo) return
            const html = generateSubjectAnalysisHtml({
              school: getSchoolTemplateData(),
              class: { fullName: classInfo.fullName, schoolType: classInfo.schoolType },
              exam: { name: examInfo.name, term: examInfo.term, academicYear: examInfo.academicYear },
              analysis: subjectAnalysis,
              lang: reportLang,
            })
            handlePrint(html, 'Subject Analysis')
          }} className="gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button variant="outline" onClick={() => {
            const classInfo = classes.find(c => c.id === selectedClass)
            const examInfo = exams.find(e => e.id === selectedExam)
            if (!classInfo || !examInfo) return
            const html = generateSubjectAnalysisHtml({
              school: getSchoolTemplateData(),
              class: { fullName: classInfo.fullName, schoolType: classInfo.schoolType },
              exam: { name: examInfo.name, term: examInfo.term, academicYear: examInfo.academicYear },
              analysis: subjectAnalysis,
              lang: reportLang,
            })
            handleDownloadReport(html, 'subject-analysis')
          }} className="gap-2">
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
        <div id="subject-analysis-content">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="report-preview-scroll max-w-full">
                <Table className="no-mobile-cards min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-center">Students</TableHead>
                      <TableHead className="text-center">Average</TableHead>
                      <TableHead className="text-center">Highest</TableHead>
                      <TableHead className="text-center">Lowest</TableHead>
                      <TableHead className="text-center">Pass Rate</TableHead>
                      <TableHead className="text-center">A</TableHead>
                      <TableHead className="text-center">B</TableHead>
                      <TableHead className="text-center">C</TableHead>
                      <TableHead className="text-center">D</TableHead>
                      <TableHead className="text-center">E/F</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subjectAnalysis.map((s, idx) => {
                      const gd = s.gradeDistribution
                      const failKey = schoolType === 'SECONDARY' ? 'F' : 'E'
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium" data-label="Subject">{s.subjectName}</TableCell>
                          <TableCell className="text-center" data-label="Students">{s.totalStudents}</TableCell>
                          <TableCell className="text-center font-medium" data-label="Average">{s.average}</TableCell>
                          <TableCell className="text-center text-green-600" data-label="Highest">{s.highest}</TableCell>
                          <TableCell className="text-center text-red-600" data-label="Lowest">{s.lowest}</TableCell>
                          <TableCell className="text-center" data-label="Pass Rate">{s.passRate}%</TableCell>
                          <TableCell className="text-center" data-label="A">{gd['A'] || 0}</TableCell>
                          <TableCell className="text-center" data-label="B">{gd['B'] || 0}</TableCell>
                          <TableCell className="text-center" data-label="C">{gd['C'] || 0}</TableCell>
                          <TableCell className="text-center" data-label="D">{gd['D'] || 0}</TableCell>
                          <TableCell className="text-center" data-label="E/F">{gd[failKey] || 0}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                Subject Performance Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {subjectAnalysis.map((s, idx) => {
                  const maxAvg = schoolType === 'SECONDARY' ? 100 : 50
                  const pct = maxAvg > 0 ? (s.average / maxAvg) * 100 : 0
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-28 truncate">{s.shortName || s.subjectName}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                        <div
                          className="h-6 rounded-full transition-all flex items-center justify-end pr-2"
                          style={{
                            width: `${Math.max(pct, 8)}%`,
                            backgroundColor: pct >= 70 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626',
                          }}
                        >
                          <span className="text-xs font-bold text-white">{s.average}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Get auto signature from name
  function getAutoSignature(name: string | null, shortName: string | null, sign: string | null): string {
    if (sign) return sign
    if (shortName) return shortName
    if (!name) return '_____________'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return parts.map(p => p.charAt(0).toUpperCase()).join('.').slice(0, -1) + '.' + parts[parts.length - 1].charAt(0).toUpperCase() + '.'
    }
    return name.charAt(0).toUpperCase() + '.'
  }

  // Report Card Tab
  function renderReportCard() {
    if (!selectedStudent || !selectedExam) {
      return <EmptyState message={reportLang === 'sw' ? 'Chagua mwanafunzi na mtihani ili kuona ripoti' : 'Select a student and exam to view report card'} />
    }
    
    // ALL students mode - show print all button
    if (selectedStudent === 'ALL') {
      return (
        <div className="w-full min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2 items-center print-hide">
            <Button onClick={handlePrintAllReports} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Users className="w-4 h-4" />
              {t('printAll')} ({students.length} {reportLang === 'sw' ? 'Wanafunzi' : 'Students'})
            </Button>
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-muted-foreground" />
              <Select value={reportLang} onValueChange={(v) => setReportLang(v as 'en' | 'sw')}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="sw">Kiswahili</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Card className="shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-16 h-16 text-emerald-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{reportLang === 'sw' ? 'Chapisha Ripoti Zote' : 'Print All Report Cards'}</h3>
              <p className="text-muted-foreground max-w-md mb-4">
                {reportLang === 'sw'
                  ? `Hii itatengeneza na kuchapisha ripoti za wanafunzi wote ${students.length} katika darasa lililochaguliwa. Kila mwanafunzi atapata ukurasa wake.`
                  : `This will generate and print report cards for all ${students.length} students in the selected class. Each student will get their own page.`}
              </p>
              <Button onClick={handlePrintAllReports} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Printer className="w-4 h-4" />
                {reportLang === 'sw' ? `Chapisha Ripoti ${students.length}` : `Print All ${students.length} Report Cards`}
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }
    
    if (loading) return <LoaderSpinner />
    if (!reportCard) return <EmptyState message={reportLang === 'sw' ? 'Taarifa za ripoti hazipatikani' : 'Report card data not available'} />

    const { student: rcStudent, class: rcClass, school: rcSchool, exam: rcExam, marks: rcMarks, result: rcResult, tabia: rcTabia, classTeacher: rcClassTeacher } = reportCard
    const maxMarks = rcClass.schoolType === 'PRIMARY' ? 50 : 100
    const totalStudentsInClass = reportCard.totalStudents || students.length
    const isIncomplete = rcResult?.status === 'INCOMPLETE'
    const dash = '\u2014'

    // Resolve logos with fresh API data as fallback
    const resolvedLogo = rcSchool.logo || freshSchoolIdentity.logo || currentSchool?.logo || null
    const resolvedLogo2 = rcSchool.logo2 || freshSchoolIdentity.logo2 || currentSchool?.logo2 || null

    const gradeColor = (g: string | null) => {
      if (!g) return 'text-gray-400'
      const c: Record<string, string> = { A: 'text-green-600', B: 'text-blue-600', C: 'text-yellow-600', D: 'text-orange-600', E: 'text-red-600', F: 'text-red-600' }
      return c[g] || 'text-gray-500'
    }

    const gradeBg = (g: string | null) => {
      if (!g) return 'bg-gray-50'
      const c: Record<string, string> = { A: 'bg-green-50', B: 'bg-blue-50', C: 'bg-yellow-50', D: 'bg-orange-50', E: 'bg-red-50', F: 'bg-red-50' }
      return c[g] || 'bg-gray-50'
    }

    // Helper: Get auto-filled class teacher comments based on student grade and language
    const getClassTeacherComments = (lang: 'en' | 'sw' = 'en'): string => {
      return getLocalizedReportComments(rcSchool, rcResult, lang).classTeacherComment || rcClassTeacher?.comments || ''
    }

    // Helper: Get auto-filled head teacher comments based on student grade and language
    const getHeadTeacherComments = (lang: 'en' | 'sw' = 'en'): string => {
      const localized = getLocalizedReportComments(rcSchool, rcResult, lang).headTeacherComment
      if (localized) return localized
      const template = rcSchool.headTeacherComments || ''
      if (!template) return ''
      
      // Replace placeholders with actual values
      return template
        .replace(/\{absent\}/g, '')
        .replace(/\{permission\}/g, '')
        .replace(/\{sick\}/g, '')
    }

    // Helper: Get class teacher signature
    const getClassTeacherSignature = (): string => {
      // Priority: class teacher short name > Settings short name > auto-generated from name
      if (rcClassTeacher?.shortName) return rcClassTeacher.shortName
      if (rcClassTeacher?.sign) return rcClassTeacher.sign
      if (rcSchool.classTeacherShortName) return rcSchool.classTeacherShortName
      if (rcSchool.classTeacherName) {
        // Auto-generate from name: "Ramadhan Aweso" -> "R. Aweso"
        const parts = rcSchool.classTeacherName.trim().split(/\s+/)
        if (parts.length >= 2) {
          return `${parts[0].charAt(0).toUpperCase()}. ${parts[parts.length - 1]}`
        }
        return rcSchool.classTeacherName
      }
      return '________________'
    }

    // Translate grade descriptions for Remarks column
    const gradeDescription = (grade: string | null): string => {
      if (!grade) return ''
      const descriptions: Record<string, { en: string; sw: string }> = {
        A: { en: 'Excellent', sw: 'Bora Sana' },
        B: { en: 'Very Good', sw: 'Vizuri Sana' },
        C: { en: 'Good', sw: 'Vizuri' },
        D: { en: 'Satisfactory', sw: 'Inaridhisha' },
        E: { en: 'Poor', sw: 'Hairidhishi' },
        F: { en: 'Fail', sw: 'Hairishidhi' },
      }
      const desc = descriptions[grade]
      return desc ? desc[reportLang] : ''
    }

    // Translate remarks: if the stored remark matches a known English grade description,
    // translate it to the selected language. Custom remarks stay as-is.
    const translateRemark = (remark: string | null, grade: string | null): string => {
      if (!remark && !grade) return '-'
      if (!remark) return gradeDescription(grade) || '-'
      
      // Known English grade descriptions that should be translated
      const enToSw: Record<string, string> = {
        'Excellent': 'Bora Sana',
        'Very Good': 'Vizuri Sana',
        'Good': 'Vizuri',
        'Satisfactory': 'Inaridhisha',
        'Poor': 'Hairidhishi',
        'Fail': 'Hairishidhi',
        'Improve': 'Kuboreshwa',
      }
      const swToEn: Record<string, string> = {
        'Bora Sana': 'Excellent',
        'Vizuri Sana': 'Very Good',
        'Vizuri': 'Good',
        'Inaridhisha': 'Satisfactory',
        'Hairidhishi': 'Poor',
        'Hairishidhi': 'Fail',
        'Hajaridhisha': 'Fail',
        'Kuboreshwa': 'Improve',
      }

      if (reportLang === 'sw') {
        // Translate English grade descriptions to Kiswahili
        return enToSw[remark] || remark
      } else {
        // Translate Kiswahili grade descriptions to English
        return swToEn[remark] || remark
      }
    }

    const tabiaTraits = rcTabia ? [
      { label: t('discipline'), value: rcTabia.discipline },
      { label: t('hygiene'), value: rcTabia.hygiene },
      { label: t('hardWorking'), value: rcTabia.hardWorking },
      { label: t('cooperation'), value: rcTabia.cooperation },
      { label: t('honesty'), value: rcTabia.honesty },
      { label: t('leadership'), value: rcTabia.leadership },
      { label: t('sports'), value: rcTabia.sports },
    ] : []
    const previewCompression = getReportCardCompression({
      isSecondary: rcClass.schoolType === 'SECONDARY',
      subjectCount: rcMarks.length,
      longestSubjectLength: Math.max(0, ...rcMarks.map(mark => (mark.subjectName || '').length)),
      commentLength: `${getClassTeacherComments(reportLang)} ${getHeadTeacherComments(reportLang)}`.length,
      hasTabia: Boolean(rcTabia),
      hasDates: Boolean(rcResult?.closingDate || rcResult?.openingDate),
      measuredHeightPx: measuredReportHeightPx,
    })
    const previewCompressionStyle = previewCompression.styleVars as CSSProperties

    return (
      <div className="w-full min-w-0 space-y-5 sm:space-y-4">
        {/* Controls: Print, Download, Language, Dates */}
        <div className="flex flex-wrap gap-2 items-center print-hide">
          <Button variant="ghost" size="sm" onClick={() => setSelectedStudent('')} className="md:hidden">
            ← Back
          </Button>
          <Button variant="outline" onClick={() => {
            if (!reportCard) return
            // Pre-generate comments so they appear in print/PDF (same as preview)
            const printClassTeacherComment = getClassTeacherComments(reportLang)
            const printHeadTeacherComment = getHeadTeacherComments(reportLang)
            const html = generateReportCardHtml({
              school: { ...getSchoolTemplateData(), headTeacherName: reportCard.school.headTeacherName, headTeacherSign: reportCard.school.headTeacherSign },
              student: reportCard.student,
              class: reportCard.class,
              exam: reportCard.exam,
              marks: reportCard.marks,
              result: reportCard.result ? { 
                ...reportCard.result, 
                closingDate, 
                openingDate,
                classTeacherComment: printClassTeacherComment || reportCard.result.classTeacherComment,
                headTeacherComment: printHeadTeacherComment || reportCard.result.headTeacherComment,
              } : reportCard.result,
              tabia: reportCard.tabia,
              classTeacher: reportCard.classTeacher,
              totalStudents: reportCard.totalStudents || students.length,
              lang: reportLang,
            })
            handlePrint(html, reportLang === 'sw' ? 'Ripoti ya Mwanafunzi' : 'Report Card')
          }} className="gap-2">
            <Printer className="w-4 h-4" />
            {reportLang === 'sw' ? 'Chapisha' : 'Print'}
          </Button>
          <Button variant="outline" onClick={() => {
            if (!reportCard) return
            const printClassTeacherComment = getClassTeacherComments(reportLang)
            const printHeadTeacherComment = getHeadTeacherComments(reportLang)
            const html = generateReportCardHtml({
              school: { ...getSchoolTemplateData(), headTeacherName: reportCard.school.headTeacherName, headTeacherSign: reportCard.school.headTeacherSign },
              student: reportCard.student,
              class: reportCard.class,
              exam: reportCard.exam,
              marks: reportCard.marks,
              result: reportCard.result ? { 
                ...reportCard.result, 
                closingDate, 
                openingDate,
                classTeacherComment: printClassTeacherComment || reportCard.result.classTeacherComment,
                headTeacherComment: printHeadTeacherComment || reportCard.result.headTeacherComment,
              } : reportCard.result,
              tabia: reportCard.tabia,
              classTeacher: reportCard.classTeacher,
              totalStudents: reportCard.totalStudents || students.length,
              lang: reportLang,
            })
            handleDownloadReport(html, `report-card-${rcStudent.fullName.replace(/\s+/g, '-')}`)
          }} className="gap-2">
            <Download className="w-4 h-4" />
            {reportLang === 'sw' ? 'Pakua' : 'Download'}
          </Button>
          <Button variant="outline" onClick={handlePrintAllReports} className="gap-2">
            <Users className="w-4 h-4" />
            {reportLang === 'sw' ? 'Chapisha Zote' : 'Print All'}
          </Button>
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-muted-foreground" />
            <Select value={reportLang} onValueChange={(v) => setReportLang(v as 'en' | 'sw')}>
              <SelectTrigger className="w-[110px] sm:w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="sw">Kiswahili</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Professional Report Card - DARK TEXT for photocopy compatibility */}
        <div className="report-preview-scroll w-full">
          <div
            ref={reportCardPreviewRef}
            id="report-card"
            className={`report-mobile-paper report-card ${previewCompression.className} w-full max-w-4xl mx-auto bg-white border-2 border-gray-800 rounded-lg shadow-sm p-4 sm:p-6 print-area`}
            style={{ ...previewCompressionStyle, fontSize: '12px', lineHeight: '1.5', color: '#000' }}
          >
            {/* HEADER SECTION with optional logos */}
          <div className={`report-header flex flex-col gap-3 sm:flex-row sm:items-center border-b-3 border-black pb-3 mb-3${resolvedLogo || resolvedLogo2 ? ' sm:justify-between' : ' sm:justify-center'}`} style={{borderBottomWidth: '3px'}}>
            {resolvedLogo && (
              <div className="flex-shrink-0 self-center sm:self-auto">
                <img src={resolvedLogo} alt="School Logo" className="header-logo w-14 h-14 object-contain" />
              </div>
            )}
            <div className="text-center flex-1 px-3">
              <h1 className="school-name text-base sm:text-lg font-black uppercase tracking-wide text-black break-words">{rcSchool.name}</h1>
              <div className="school-info text-[10px] text-gray-800 mt-0.5 font-semibold">
                {rcSchool.region && <span>{t('region')}: {rcSchool.region}</span>}
                {rcSchool.district && <span>{rcSchool.region ? ' · ' : ''}{t('district')}: {rcSchool.district}</span>}
                {rcSchool.ward && <span>{(rcSchool.region || rcSchool.district) ? ' · ' : ''}{t('ward')}: {rcSchool.ward}</span>}
                {rcSchool.registrationNo && <span>{(rcSchool.region || rcSchool.district || rcSchool.ward) ? ' · ' : ''}{t('regNo')}: {rcSchool.registrationNo}</span>}
              </div>
            </div>
            {resolvedLogo2 && (
              <div className="flex-shrink-0 self-center sm:self-auto">
                <img src={resolvedLogo2} alt="Logo 2" className="header-logo w-14 h-14 object-contain" />
              </div>
            )}
          </div>

          {/* Exam Info + Title - DARK */}
          <div className="report-title text-center mb-3">
            <h2 className="text-base font-black uppercase text-black tracking-wide underline">
              {t('reportCard')}
              {isIncomplete && (
                <span className="inline-block ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-black border-2 border-gray-800 align-middle">{reportLang === 'sw' ? 'HAIKAMILIKI' : 'INCOMPLETE'}</span>
              )}
            </h2>
            <div className="text-[11px] text-black mt-0.5 font-semibold">
              {t('examName')}: {rcExam.name} &nbsp;|&nbsp; {t('term')}: {rcExam.term} &nbsp;|&nbsp; {t('academicYear')}: {rcExam.academicYear}
            </div>
          </div>

          {/* STUDENT INFO SECTION - DARK */}
          <div className="student-info-bar grid grid-cols-1 gap-0 mb-3 border-2 border-gray-800 rounded overflow-hidden bg-gray-100 sm:grid-cols-2 lg:grid-cols-4">
            <div className="student-info-item p-2 border-b border-gray-600 sm:border-b-0 sm:border-r">
              <div className="student-info-label text-[9px] text-black font-bold uppercase">{t('studentName')}</div>
              <div className="student-info-value text-[12px] font-bold text-black truncate">{rcStudent.fullName}</div>
            </div>
            <div className="student-info-item p-2 border-r border-gray-600">
              <div className="student-info-label text-[9px] text-black font-bold uppercase">
                {rcClass.schoolType === 'SECONDARY' ? t('classSecondary') : t('classPrimary')}
              </div>
              <div className="student-info-value text-[12px] font-bold text-black">{rcClass.fullName}</div>
            </div>
            <div className="student-info-item p-2 border-r border-gray-600">
              <div className="student-info-label text-[9px] text-black font-bold uppercase">{t('admNo')}</div>
              <div className="student-info-value text-[12px] font-bold text-black">{rcStudent.admissionNo || '-'}</div>
            </div>
            <div className="student-info-item p-2">
              <div className="student-info-label text-[9px] text-black font-bold uppercase">{t('gender')}</div>
              <div className="student-info-value text-[12px] font-bold text-black">{rcStudent.gender === 'M' ? t('male') : t('female')}</div>
            </div>
          </div>

          {/* SUBJECT MARKS TABLE - DARK */}
          <div className="overflow-x-auto">
            <table className="marks-table w-full min-w-[280px] border-collapse mb-3 text-[10px] sm:text-[11px]">
            <thead>
              <tr className="bg-gray-700 text-white">
                <th className="border border-gray-800 px-2 py-1 text-left w-8 text-white">{t('sn')}</th>
                <th className="border border-gray-800 px-2 py-1 text-left text-white">{t('subject')}</th>
                <th className="border border-gray-800 px-2 py-1 text-center w-16 text-white">{t('marks')} (/{maxMarks})</th>
                <th className="border border-gray-800 px-2 py-1 text-center w-12 text-white">{t('grade')}</th>
                {rcClass.schoolType === 'SECONDARY' && (
                  <th className="border border-gray-800 px-2 py-1 text-center w-10 text-white">Pts</th>
                )}
                <th className="border border-gray-800 px-2 py-1 text-left text-white">{t('remarks')}</th>
              </tr>
            </thead>
            <tbody>
              {rcMarks.map((m, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-400 px-2 py-0.5 text-center font-semibold text-black">{idx + 1}</td>
                  <td className="subject-cell border border-gray-400 px-2 py-0.5 font-semibold text-black">{m.subjectName}</td>
                  <td className="border border-gray-400 px-2 py-0.5 text-center font-bold text-black">{m.marks ?? '-'}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-center">
                    {m.grade ? (
                      <span className={`inline-block px-2 py-0 rounded text-[11px] font-extrabold ${gradeBg(m.grade)} text-black border border-gray-500`}>
                        {m.grade}
                      </span>
                    ) : '-'}
                  </td>
                  {rcClass.schoolType === 'SECONDARY' && (
                    <td className="border border-gray-400 px-2 py-0.5 text-center font-bold text-black">
                      {m.grade ? (m.grade === 'A' ? '1' : m.grade === 'B' ? '2' : m.grade === 'C' ? '3' : m.grade === 'D' ? '4' : '5') : '-'}
                    </td>
                  )}
                  <td className="remarks-cell border border-gray-400 px-2 py-0.5 text-[10px] text-black font-medium">{translateRemark(m.remarks, m.grade)}</td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-gray-200 font-bold">
                <td className="border border-gray-800 px-2 py-0.5 text-center text-black" colSpan={2}>{t('total')}</td>
                <td className="border border-gray-800 px-2 py-0.5 text-center font-extrabold text-black">{rcResult?.totalMarks ?? '-'}</td>
                <td className="border border-gray-800 px-1 py-0.5 text-center">
                  {rcResult?.grade ? (
                    <span className={`inline-block px-2 py-0 rounded text-[11px] font-extrabold ${gradeBg(rcResult.grade)} text-black border border-gray-500`}>
                      {rcResult.grade}
                    </span>
                  ) : '-'}
                </td>
                {rcClass.schoolType === 'SECONDARY' && (
                  <td className="border border-gray-800 px-2 py-0.5 text-center font-extrabold text-black">{rcResult?.points ?? '-'}</td>
                )}
                <td className="border border-gray-800 px-2 py-0.5" />
              </tr>
            </tbody>
            </table>
          </div>

          {/* RESULTS SUMMARY SECTION - DARK */}
          {rcResult && (
            <div className={`results-summary grid gap-2 mb-3 ${rcClass.schoolType === 'SECONDARY' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4'}`}>
              <div className="summary-item border-2 border-gray-800 rounded p-2 text-center bg-gray-100">
                <div className="summary-label text-[9px] text-black font-bold uppercase">{t('total')}</div>
                <div className="summary-value text-base font-extrabold text-black">{isIncomplete ? dash : (rcResult.totalMarks ?? dash)}</div>
              </div>
              <div className="summary-item border-2 border-gray-800 rounded p-2 text-center bg-gray-100">
                <div className="summary-label text-[9px] text-black font-bold uppercase">{t('average')}</div>
                <div className="summary-value text-base font-extrabold text-black">{isIncomplete ? dash : (rcResult.averageMarks != null ? Math.round(rcResult.averageMarks * 100) / 100 : dash)}</div>
              </div>
              <div className={`summary-item border-2 border-gray-800 rounded p-2 text-center ${isIncomplete ? 'bg-gray-100' : gradeBg(rcResult.grade)}`}>
                <div className="summary-label text-[9px] text-black font-bold uppercase">{t('grade')}</div>
                <div className="summary-value text-2xl font-black text-black">{isIncomplete ? dash : (rcResult.grade || dash)}</div>
              </div>
              {rcClass.schoolType === 'SECONDARY' && (
                <>
                  <div className="summary-item border-2 border-gray-800 rounded p-2 text-center bg-gray-100">
                    <div className="summary-label text-[9px] text-black font-bold uppercase">{t('points')}</div>
                    <div className="summary-value text-base font-extrabold text-black">{isIncomplete ? dash : (rcResult.points ?? dash)}</div>
                  </div>
                  <div className="summary-item border-2 border-gray-800 rounded p-2 text-center bg-gray-100">
                    <div className="summary-label text-[9px] text-black font-bold uppercase">{t('division')}</div>
                    <div className="summary-value text-xl font-black text-black">{isIncomplete ? dash : (rcResult.division || dash)}</div>
                  </div>
                </>
              )}
              <div className="summary-item border-2 border-gray-800 rounded p-2 text-center bg-gray-100">
                <div className="summary-label text-[9px] text-black font-bold uppercase">{t('position')}</div>
                <div className="summary-value text-base font-extrabold text-black">
                  {isIncomplete ? dash : (rcResult.rank ? `${getOrdinal(rcResult.rank, reportLang)}` : dash)}
                  <span className="text-[10px] font-semibold text-black"> {t('outOf')} {totalStudentsInClass}</span>
                </div>
              </div>
            </div>
          )}

          {/* CHARACTER/CONDUCT SECTION - DARK */}
          {rcTabia && (
            <div className="character-section mb-3 border-2 border-gray-800 rounded overflow-hidden">
              <div className="section-header bg-gray-700 text-white text-[10px] font-bold px-3 py-1 uppercase">{t('character')}</div>
              <div className="traits-grid p-2">
                <table className="w-full border-collapse mobile-table">
                  <tbody>
                    {tabiaTraits.map((trait, idx) => (
                      <tr key={idx}>
                        <td data-label={trait.label} className="trait-item border border-gray-500 px-2 py-1 text-[10px] sm:text-[11px]">
                          <span className="trait-label font-semibold text-black">{trait.label}</span>
                        </td>
                        <td data-label="Grade" className="trait-value border border-gray-500 px-2 py-1 text-[11px] font-extrabold text-black text-center">
                          {trait.value || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* COMMENTS SECTION - DARK */}
          <div className="comments-grid grid grid-cols-1 gap-3 mb-3 md:grid-cols-2">
            <div className="comment-box border-2 border-gray-800 rounded p-2">
              <div className="comment-label text-[9px] text-black font-bold uppercase mb-0.5">
                {reportLang === 'sw' ? 'Maoni ya Mwalimu wa Darasa' : 'Class Teacher Comment'}
              </div>
              <p className="comment-text text-[11px] text-black font-semibold min-h-[40px]">
                {getClassTeacherComments(reportLang) || <span className="text-gray-400">____________________________________</span>}
              </p>
            </div>
            <div className="comment-box border-2 border-gray-800 rounded p-2">
              <div className="comment-label text-[9px] text-black font-bold uppercase mb-0.5">
                {reportLang === 'sw' ? 'Maoni ya Mkuu wa Shule' : 'Head Teacher Comment'}
              </div>
              <p className="comment-text text-[11px] text-black font-semibold min-h-[40px]">
                {getHeadTeacherComments(reportLang) || <span className="text-gray-400">____________________________________</span>}
              </p>
            </div>
          </div>

          {/* SIGNATURES - DARK */}
          <div className="mt-2">
            <div className="signatures-grid grid grid-cols-1 gap-6 sm:grid-cols-2 text-[11px]">
              <div className="signature-box text-center">
                <div className="signature-line border-t-2 border-black pt-1 font-bold text-black min-h-[20px]">
                  {getClassTeacherSignature()}
                </div>
                <div className="signature-label text-[9px] text-black mt-0.5 font-semibold">
                  {reportLang === 'sw' ? 'Saini ya Mwalimu wa Darasa' : 'Class Teacher Signature'}
                </div>
              </div>
              <div className="signature-box text-center">
                <div className="signature-line border-t-2 border-black pt-1 font-bold text-black min-h-[20px]">
                  {rcSchool.headTeacherSign || rcSchool.headTeacherName || '________________'}
                </div>
                <div className="signature-label text-[9px] text-black mt-0.5 font-semibold">
                  {reportLang === 'sw' ? 'Saini ya Mkuu wa Shule' : 'Head Teacher Signature'}
                </div>
              </div>
            </div>
          </div>

          {/* DATES - Above Parent section */}
          {(rcResult?.closingDate || rcResult?.openingDate) && (
            <div className="dates-grid grid grid-cols-2 gap-4 mt-3 text-[10px] border-t border-gray-300 pt-2">
              {rcResult?.closingDate && (
                <div className="text-center font-bold text-black">
                  {t('closingDate')}: <span className="font-extrabold">{rcResult.closingDate}</span>
                </div>
              )}
              {rcResult?.openingDate && (
                <div className="text-center font-bold text-black">
                  {t('openingDate')}: <span className="font-extrabold">{rcResult.openingDate}</span>
                </div>
              )}
            </div>
          )}

          {/* PARENT/GUARDIAN SECTION - AT THE VERY BOTTOM */}
          <div className="parent-section mt-3 border-2 border-gray-800 rounded p-3 bg-gray-100">
            <div className="parent-title text-[10px] text-black font-extrabold uppercase mb-2 pb-1 border-b-2 border-gray-800">{reportLang === 'sw' ? 'MZAZI / MLEZI' : 'PARENT / GUARDIAN'}</div>
            <div className="parent-fields grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="parent-field">
                <div className="parent-field-label text-[9px] text-black font-bold">{reportLang === 'sw' ? 'Maoni' : 'Comment'}</div>
                <div className="parent-field-line border-b-2 border-gray-800 min-h-[22px] mt-1"></div>
              </div>
              <div className="parent-field">
                <div className="parent-field-label text-[9px] text-black font-bold">{reportLang === 'sw' ? 'Jina' : 'Name'}</div>
                <div className="parent-field-line border-b-2 border-gray-800 min-h-[22px] mt-1"></div>
              </div>
              <div className="parent-field">
                <div className="parent-field-label text-[9px] text-black font-bold">{reportLang === 'sw' ? 'Saini' : 'Signature'}</div>
                <div className="parent-field-line border-b-2 border-gray-800 min-h-[22px] mt-1"></div>
              </div>
              <div className="parent-field">
                <div className="parent-field-label text-[9px] text-black font-bold">{reportLang === 'sw' ? 'Tarehe' : 'Date'}</div>
                <div className="parent-field-line border-b-2 border-gray-800 min-h-[22px] mt-1"></div>
              </div>
            </div>
            </div>
          </div>

          {/* Footer - school name from settings */}
          <div
            className="report-footer text-center text-[9px] text-gray-600 mt-3 pt-1 border-t border-gray-400"
            dangerouslySetInnerHTML={{
              __html: buildReportFooter(rcSchool.name || currentSchool?.name || '', reportLang),
            }}
          />
        </div>
      </div>
    )
  }

  // Subject Report Dialog
  function renderSubjectReportDialog() {
    const activeReportClassId = getActiveClassId()
    const classSubjects = subjectReportSubjects.length > 0
      ? subjectReportSubjects
      : (overallData?.subjects || []).map(s => ({ id: s.id, subjectId: s.id, name: s.name, shortName: s.shortName }))
    const selectedSubjectInfo = getSubjectReportSubject()

    return (
      <Dialog open={subjectReportOpen} onOpenChange={setSubjectReportOpen}>
        <DialogContent className="top-[50%] max-h-[90dvh] w-[95vw] max-w-2xl translate-y-[-50%] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden rounded-lg p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:max-h-[90vh] sm:p-6">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              Subject Teacher Report
            </DialogTitle>
            <DialogDescription>
              Print marks for a specific subject to give to the class teacher for filling in
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain py-2 pr-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={subjectReportSubjectId} onValueChange={(v) => {
                  setSubjectReportSubjectId(v)
                  setSubjectReportData(null)
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {classSubjects.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Max Marks</Label>
                <Input
                  type="number"
                  value={subjectReportMaxMarks}
                  onChange={(e) => setSubjectReportMaxMarks(e.target.value)}
                  placeholder={schoolType === 'SECONDARY' ? '100' : '50'}
                />
              </div>
            </div>

            <Button
              onClick={loadSubjectReport}
              disabled={!subjectReportSubjectId}
              className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              Load Subject Data
            </Button>

            {subjectReportData && (
              <div id="subject-report-table" className="report-preview-scroll max-w-full">
                <div className="text-center mb-2">
                  <h3 className="font-bold text-sm">{currentSchool?.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    Subject Report: {selectedSubjectInfo?.name}
                    {' | '}Max: {subjectReportMaxMarks}
                    {' | '}{exams.find(e => e.id === selectedExam)?.name || ''}
                  </p>
                </div>
                <Table className="no-mobile-cards min-w-[520px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">S/N</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead className="w-12 text-center">Sex</TableHead>
                      <TableHead className="w-20 text-center">Marks (/{subjectReportMaxMarks})</TableHead>
                      <TableHead className="w-16 text-center">Grade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s, idx) => {
                      const data = subjectReportData.find(d => d.studentId === s.id)
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-center" data-label="S/N">{idx + 1}</TableCell>
                          <TableCell className="font-medium" data-label="Student Name">{s.fullName}</TableCell>
                          <TableCell className="text-center" data-label="Sex">{s.gender}</TableCell>
                          <TableCell className="text-center" data-label="Marks">
                            {data?.marks != null ? Math.round(data.marks) : ''}
                          </TableCell>
                          <TableCell className="text-center font-bold" data-label="Grade">
                            {data?.grade || ''}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter className="border-t bg-background pt-3 flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setSubjectReportOpen(false)} className="w-full sm:w-auto">Close</Button>
            {subjectReportData && (
              <>
                <Button onClick={() => {
                  const classInfo = classes.find(c => c.id === activeReportClassId)
                  const examInfo = exams.find(e => e.id === selectedExam)
                  const subjectInfo = getSubjectReportSubject()
                  if (!classInfo || !examInfo || !subjectInfo || !subjectReportData) return
                  const html = generateSubjectReportHtml({
                    school: getSchoolTemplateData(),
                    class: { fullName: classInfo.fullName, schoolType: classInfo.schoolType },
                    exam: { name: examInfo.name, term: examInfo.term, academicYear: examInfo.academicYear },
                    subjectName: subjectInfo.name,
                    maxMarks: parseInt(subjectReportMaxMarks) || (schoolType === 'SECONDARY' ? 100 : 50),
                    data: subjectReportData,
                    lang: reportLang,
                  })
                  handlePrint(html, 'Subject Report')
                }} className="bg-emerald-600 hover:bg-emerald-700 gap-2 w-full sm:w-auto">
                  <Printer className="w-4 h-4" />
                  Print Subject Report
                </Button>
                <Button onClick={() => {
                  const classInfo = classes.find(c => c.id === activeReportClassId)
                  const examInfo = exams.find(e => e.id === selectedExam)
                  const subjectInfo = getSubjectReportSubject()
                  if (!classInfo || !examInfo || !subjectInfo || !subjectReportData) return
                  const html = generateSubjectReportHtml({
                    school: getSchoolTemplateData(),
                    class: { fullName: classInfo.fullName, schoolType: classInfo.schoolType },
                    exam: { name: examInfo.name, term: examInfo.term, academicYear: examInfo.academicYear },
                    subjectName: subjectInfo.name,
                    maxMarks: parseInt(subjectReportMaxMarks) || (schoolType === 'SECONDARY' ? 100 : 50),
                    data: subjectReportData,
                    lang: reportLang,
                  })
                  handleDownloadReport(html, 'subject-report')
                }} variant="outline" className="gap-2 w-full sm:w-auto">
                  <Download className="w-4 h-4" />
                  Download
                </Button>
                <Button onClick={async () => {
                  // Download as Excel
                  const subjectInfo = getSubjectReportSubject()
                  const classInfo = classes.find(c => c.id === activeReportClassId)
                  const examInfo = exams.find(e => e.id === selectedExam)
                  
                  if (!subjectReportData || !subjectInfo) {
                    toast.error('Please load subject data first')
                    return
                  }
                  
                  if (students.length === 0) {
                    toast.error('No students found')
                    return
                  }
                  
                  try {
                    toast.loading('Generating Excel file...', { id: 'excel-loading' })
                    
                    // Prepare data for Excel export
                    const excelData = students.map((s, idx) => {
                      const data = subjectReportData.find(d => d.studentId === s.id)
                      const maxMarks = parseInt(subjectReportMaxMarks) || (schoolType === 'SECONDARY' ? 100 : 50)
                      const marks = data?.marks != null ? Math.round(data.marks) : 0
                      const grade = data?.grade || ''
                      
                      return {
                        sn: idx + 1,
                        studentName: s.fullName,
                        marks: marks,
                        grade: grade,
                      }
                    }).filter(row => row.studentName) // Filter out empty rows
                    
                    const filename = `${subjectInfo.name}_${classInfo?.fullName || 'Class'}_${examInfo?.name || 'Exam'}`
                    
                    exportMarksToExcel(excelData, filename, {
                      examName: examInfo?.name,
                      className: classInfo?.fullName,
                      subjectName: subjectInfo.name,
                    })
                    
                    toast.dismiss('excel-loading')
                    toast.success('Excel file downloaded successfully')
                  } catch (error) {
                    toast.dismiss('excel-loading')
                    console.error('Excel download error:', error)
                    toast.error('Failed to download Excel file')
                  }
                }} variant="outline" className="gap-2 border-green-300 text-green-700 hover:bg-green-50 w-full sm:w-auto">
                  <FileSpreadsheet className="w-4 h-4" />
                  Download as Excel
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const selectedExamInfo = useMemo(() => exams.find(e => e.id === selectedExam), [exams, selectedExam])
  const selectedClassInfo = useMemo(() => classes.find(c => c.id === selectedClass), [classes, selectedClass])
  const canUseToolbar = useMemo(() => Boolean(selectedExam && selectedClass && activeTab !== 'report-card'), [selectedExam, selectedClass, activeTab])

  return (
    <div className="w-full min-w-0 h-[calc(100dvh-8.75rem)] md:h-[calc(100vh-9rem)] flex flex-col overflow-hidden">
      {/* Filters */}
      <div className="flex-shrink-0">
        <Card className="rounded-lg">
          <CardContent className="p-3 sm:p-6">
            <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-12 gap-3 sm:gap-6 items-end">
              <div className="space-y-2 xl:col-span-3 min-w-0">
                <Label className="text-sm font-medium">Exam</Label>
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                  <SelectTrigger className="min-w-0 h-10 text-sm">
                    <SelectValue placeholder="Select exam" className="truncate" />
                  </SelectTrigger>
                  <SelectContent>
                    {modeExams.map((exam) => (
                      <SelectItem key={exam.id} value={exam.id} className="text-sm">
                        {exam.name} - {exam.class?.fullName} ({exam.term})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 xl:col-span-2 min-w-0">
                <Label className="text-sm font-medium">Class</Label>
                <Select
                  value={selectedClass}
                  onValueChange={(classId) => {
                    setSelectedClass(classId)
                    const classExam = modeExams.find(exam => getExamClassId(exam.id) === classId)
                    if (classExam && classExam.id !== selectedExam) setSelectedExam(classExam.id)
                    setSelectedStudent('')
                    setReportCard(null)
                  }}
                >
                  <SelectTrigger className="min-w-0 h-10 text-sm">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {modeClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id} className="text-sm">{cls.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {activeTab === 'report-card' && (
                <div className="space-y-2 col-span-2 xl:col-span-2 min-w-0">
                  <Label className="text-sm font-medium">Student</Label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger className="min-w-0 h-10 text-sm">
                      <SelectValue placeholder={t('selectStudent')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t('allStudents')}</SelectItem>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-sm">{s.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2 xl:col-span-2 min-w-0">
                <Label className="text-sm font-medium">{t('closingDate')}</Label>
                <Input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} className="h-10 text-sm" />
              </div>
              <div className="space-y-2 xl:col-span-2 min-w-0">
                <Label className="text-sm font-medium">{t('openingDate')}</Label>
                <Input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} className="h-10 text-sm" />
              </div>
              <div className="space-y-2 xl:col-span-1 min-w-0">
                <Label className="invisible">Save dates</Label>
                <Button variant="outline" onClick={saveReportDates} disabled={!selectedExam || !selectedClass} className="w-full gap-2 h-10 text-sm">
                  <Save className="w-4 h-4" />
                  Save
                </Button>
              </div>
              <div className="space-y-2 xl:col-span-2 min-w-0">
                <Label className="text-sm font-medium">Language</Label>
                <div className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2.5 shadow-sm">
                  <Languages className="h-4 w-4 text-emerald-600" />
                  <Select value={reportLang} onValueChange={(v) => setReportLang(v as 'en' | 'sw')}>
                    <SelectTrigger className="h-10 w-[140px] border-0 px-0 shadow-none focus:ring-0 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sw">Kiswahili</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        {/* Tabs */}
        <div className="flex-shrink-0 bg-background pt-3">
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <TabsList className="inline-grid h-auto min-h-10 w-max min-w-full grid-cols-5 gap-1">
              <TabsTrigger value="summary" className="min-w-[96px] px-2 py-2 text-[11px] sm:text-sm">
                <span className="hidden sm:inline">Class </span>Summary
              </TabsTrigger>
              <TabsTrigger value="overall" className="min-w-[96px] px-2 py-2 text-[11px] sm:text-sm">
                <span className="hidden sm:inline">Overall </span>Results
              </TabsTrigger>
              <TabsTrigger value="top-bottom" className="min-w-[96px] px-2 py-2 text-[11px] sm:text-sm">
                Top/Bottom
              </TabsTrigger>
              <TabsTrigger value="subject-analysis" className="min-w-[96px] px-2 py-2 text-[11px] sm:text-sm">
                <span className="hidden sm:inline">Subject </span>Analysis
              </TabsTrigger>
              <TabsTrigger value="report-card" className="min-w-[96px] px-2 py-2 text-[11px] sm:text-sm">
                Report<span className="hidden sm:inline"> Card</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Report Content - Scrollable */}
        <div className="reports-content-scroll flex-1 min-h-0 overflow-y-auto overflow-x-auto overscroll-contain px-1 pb-8 pr-2 sm:px-0 sm:pb-2">
          <TabsContent value="summary" className="mt-4 w-full min-w-0">
            {renderSummary()}
          </TabsContent>
          <TabsContent value="overall" className="mt-4 w-full min-w-0">
            {renderOverallResults()}
          </TabsContent>
          <TabsContent value="top-bottom" className="mt-4 w-full min-w-0">
            {renderTopBottom()}
          </TabsContent>
          <TabsContent value="subject-analysis" className="mt-4 w-full min-w-0">
            {renderSubjectAnalysis()}
          </TabsContent>
          <TabsContent value="report-card" className="mt-4 w-full min-w-0">
            {renderReportCard()}
          </TabsContent>
        </div>
      </Tabs>

      {/* Subject Report Dialog */}
      {renderSubjectReportDialog()}

      {/* Browser print preview: review the exact generated document before opening the system print dialog. */}
      <Dialog open={printPreviewOpen} onOpenChange={setPrintPreviewOpen}>
        <DialogContent className="top-[50%] flex h-[94dvh] w-[98vw] max-w-6xl translate-y-[-50%] flex-col gap-3 overflow-hidden p-3 sm:h-[92vh] sm:p-5">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-emerald-600" />
              {printPreviewTitle}
            </DialogTitle>
            <DialogDescription>
              Review the report layout, school details and page breaks before printing.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-slate-100 p-1 sm:p-3">
            {printPreviewHtml ? (
              <iframe
                title={`${printPreviewTitle} preview`}
                srcDoc={printPreviewHtml}
                className="h-full w-full rounded border-0 bg-white"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No report preview is ready.</div>
            )}
          </div>
          <DialogFooter className="shrink-0 flex-col gap-2 sm:flex-row sm:justify-between">
            <p className="text-left text-xs text-muted-foreground sm:mr-auto">
              Print Preview: generated from the selected school, class and exam.
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button variant="outline" onClick={() => setPrintPreviewOpen(false)} className="flex-1 sm:flex-none">Close</Button>
              <Button
                onClick={() => {
                  setPrintPreviewOpen(false)
                  window.setTimeout(() => fallbackPrint(printPreviewHtml), 0)
                }}
                disabled={!printPreviewHtml}
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 sm:flex-none"
              >
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LoaderSpinner() {
  return (
    <div className="flex items-center justify-center h-40">
      <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-12 h-12 text-emerald-300 mb-3" />
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}
