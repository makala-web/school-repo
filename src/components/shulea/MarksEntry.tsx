'use client'

import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import type { SchoolType } from '@/types'
import { apiCall, downloadExcel, getGrade, parseExcelMarks, matchExcelWithStudents } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Save, Loader2, PenTool, Calculator, AlertTriangle, CheckCircle2,
  Upload, Download, FileSpreadsheet, X, Eye, CheckCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'

interface ClassItem {
  id: string
  name: string
  fullName: string
  schoolType: string
}

interface ExamItem {
  id: string
  name: string
  examType: string
  term: string
  academicYear: string
  class: { name: string; schoolType: string }
}

interface SubjectItem {
  id: string
  subjectId: string
  subjectName: string
  shortName: string
}

interface StudentItem {
  id: string
  fullName: string
  gender: string
  admissionNo: string | null
}

interface MarkRow {
  studentId: string
  classSubjectId: string
  examId: string
  marks: string
  grade: string
  remarks: string
  points: string
}

export default function MarksEntry() {
  const { currentSchool, schoolType } = useAppStore()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [exams, setExams] = useState<ExamItem[]>([])
  const [subjects, setSubjects] = useState<SubjectItem[]>([])
  const [students, setStudents] = useState<StudentItem[]>([])

  const [selectedClass, setSelectedClass] = useState('')
  const [selectedExam, setSelectedExam] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')

  const [markRows, setMarkRows] = useState<MarkRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

  // Excel upload mode
  const [entryMode, setEntryMode] = useState<'manual' | 'upload'>('manual')
  const [uploadPreview, setUploadPreview] = useState<Array<{
    sn: number
    studentName: string
    marks: number
    grade: string
    matchedStudentId: string
    matchedStudentName: string
    status: 'matched' | 'unmatched'
  }> | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [parsingExcel, setParsingExcel] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Compute dialog
  const [computeDialogOpen, setComputeDialogOpen] = useState(false)
  const [computing, setComputing] = useState(false)
  const [computeResult, setComputeResult] = useState<{
    totalStudents: number
    completeCount: number
    incompleteCount: number
    minSubjectsRequired: number
    schoolType: string
    results: Array<{
      studentName: string
      averageMarks: number | null
      grade: string | null
      division?: string | null
      points?: number | null
      rank: number | null
      status: string
      subjectCount: number
    }>
  } | null>(null)

  useEffect(() => {
    loadClasses()
  }, [currentSchool])

  async function loadClasses() {
    try {
      const data = await apiCall(`/api/shulea/classes?schoolId=${currentSchool?.id || ''}`)
      const loadedClasses: ClassItem[] = data.classes || []
      setClasses(loadedClasses)

      const availableClasses = loadedClasses.filter(c => c.schoolType === schoolType)
      if (!selectedClass || !availableClasses.some(c => c.id === selectedClass)) {
        setSelectedClass(availableClasses[0]?.id || '')
      }
    } catch {
      toast.error('Failed to load classes')
    }
  }

  useEffect(() => {
    setSelectedExam('')
    setSelectedSubject('')
    setMarkRows([])
    setDataLoaded(false)

    if (selectedClass) {
      loadExams()
      loadSubjects()
    } else {
      setExams([])
      setSubjects([])
    }
  }, [selectedClass])

  async function loadExams() {
    try {
      const data = await apiCall(`/api/shulea/exams?classId=${selectedClass}`)
      const examsData = data.exams || []
      setExams(examsData)
      if (examsData.length >= 1) {
        setSelectedExam(examsData[0].id)
      }
    } catch {
      toast.error('Failed to load exams')
    }
  }

  async function loadSubjects() {
    if (!selectedClass) {
      console.log('[MarksEntry] No class selected, skipping subjects load')
      setSubjects([])
      setSelectedSubject('')
      return
    }
    
    setLoading(true)
    try {
      console.log('[MarksEntry] Loading subjects for class:', selectedClass)
      const data = await apiCall(`/api/shulea/subjects?action=class-subjects&classId=${selectedClass}`)
      console.log('[MarksEntry] Subjects API response:', data)
      
      // Check if API returned an error
      if (data.error) {
        console.error('[MarksEntry] API returned error:', data.error)
        toast.error(`Failed to load subjects: ${data.error}`)
        setSubjects([])
        setSelectedSubject('')
        return
      }
      
      const classSubjects = (data.classSubjects || []).map(normalizeClassSubject).filter(Boolean) as SubjectItem[]
      console.log('[MarksEntry] Normalized subjects:', classSubjects)
      setSubjects(classSubjects)
      if (classSubjects.length >= 1) {
        setSelectedSubject(classSubjects[0].id)
      } else {
        setSelectedSubject('')
      }
    } catch (error) {
      console.error('[MarksEntry] Failed to load subjects:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to load subjects'
      toast.error(errorMessage)
      setSubjects([])
      setSelectedSubject('')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedClass && selectedExam && selectedSubject) {
      loadMarks()
    } else {
      setMarkRows([])
      setDataLoaded(false)
    }
  }, [selectedClass, selectedExam, selectedSubject])

  async function loadMarks() {
    setLoading(true)
    setDataLoaded(false)
    setStudents([])
    setMarkRows([])
    try {
      const subject = subjects.find(s => s.id === selectedSubject)
      const data = await apiCall(
        `/api/shulea/marks?classId=${selectedClass}&examId=${selectedExam}&subjectId=${subject?.subjectId || selectedSubject}`
      )
      const fetchedStudents: StudentItem[] = data.students || []
      const fetchedMarks: Array<{
        studentId: string
        classSubjectId: string
        examId: string
        marks: number | null
        grade: string | null
        remarks: string | null
      }> = data.marks || []
      const classSubjectId = selectedSubject
      const examId = selectedExam

      // Build a map of existing marks
      const marksMap = new Map<string, { marks: number | null; grade: string | null; remarks: string | null }>()
      for (const m of fetchedMarks) {
        marksMap.set(m.studentId, { marks: m.marks, grade: m.grade, remarks: m.remarks })
      }

      const rows: MarkRow[] = fetchedStudents.map((s) => {
        const existing = marksMap.get(s.id)
        const marksVal = existing?.marks != null ? String(existing.marks) : ''
        const computed = marksVal ? getGrade(parseFloat(marksVal), schoolType as SchoolType) : null
        return {
          studentId: s.id,
          classSubjectId,
          examId,
          marks: marksVal,
          grade: existing?.grade || computed?.grade || '',
          remarks: existing?.remarks || computed?.remarks || '',
          points: computed?.points != null ? String(computed.points) : '',
        }
      })
      setStudents(fetchedStudents)
      setMarkRows(rows)
      setDataLoaded(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load marks')
    } finally {
      setLoading(false)
    }
  }

  const [markErrors, setMarkErrors] = useState<Set<number>>(new Set())

  function handleMarkChange(index: number, value: string) {
    const maxMarks = schoolType === 'PRIMARY' ? 50 : 100

    setMarkRows(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], marks: value }

      if (value !== '') {
        const numVal = parseFloat(value)
        if (isNaN(numVal)) {
          updated[index].grade = ''
          updated[index].remarks = ''
          updated[index].points = ''
          return updated
        }
        if (numVal < 0) {
          toast.error(`Invalid mark. ${schoolType === 'PRIMARY' ? 'Primary' : 'Secondary'} school marks must be between 0 and ${maxMarks}.`)
          updated[index].marks = ''
          updated[index].grade = ''
          updated[index].remarks = ''
          updated[index].points = ''
          setMarkErrors(prev => new Set(prev).add(index))
          setTimeout(() => setMarkErrors(prev => { const s = new Set(prev); s.delete(index); return s }), 2000)
          return updated
        }
        if (numVal > maxMarks) {
          toast.error(`Invalid mark. ${schoolType === 'PRIMARY' ? 'Primary' : 'Secondary'} school marks must be between 0 and ${maxMarks}.`)
          updated[index].marks = ''
          updated[index].grade = ''
          updated[index].remarks = ''
          updated[index].points = ''
          setMarkErrors(prev => new Set(prev).add(index))
          setTimeout(() => setMarkErrors(prev => { const s = new Set(prev); s.delete(index); return s }), 2000)
          return updated
        }
        const computed = getGrade(numVal, schoolType as SchoolType)
        updated[index].grade = computed.grade || ''
        updated[index].remarks = computed.remarks || ''
        updated[index].points = computed.points != null ? String(computed.points) : ''
      } else {
        updated[index].grade = ''
        updated[index].remarks = ''
        updated[index].points = ''
      }
      return updated
    })
  }

  async function handleSaveAll() {
    const marksToSave = markRows
      .filter(r => r.marks !== '')
      .map(r => ({
        studentId: r.studentId,
        classSubjectId: r.classSubjectId,
        examId: r.examId,
        marks: parseFloat(r.marks),
      }))

    if (marksToSave.length === 0) {
      toast.error('No marks to save. Enter marks first.')
      return
    }

    setSaving(true)
    try {
      const result = await apiCall('/api/shulea/marks', {
        method: 'POST',
        body: JSON.stringify({
          action: 'bulk-save',
          classId: selectedClass,
          marks: marksToSave,
        }),
      })
      toast.success(result.message || `Saved ${marksToSave.length} marks`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save marks')
    } finally {
      setSaving(false)
    }
  }

  async function handleComputeResults() {
    setComputing(true)
    setComputeResult(null)
    try {
      const result = await apiCall('/api/shulea/marks', {
        method: 'POST',
        body: JSON.stringify({
          action: 'compute-results',
          classId: selectedClass,
          examId: selectedExam,
        }),
      })
      setComputeResult(result)
      toast.success('Results computed successfully!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to compute results')
    } finally {
      setComputing(false)
    }
  }

  function gradeColor(grade: string): string {
    switch (grade) {
      case 'A': return 'bg-green-100 text-green-700 border-green-300'
      case 'B': return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'C': return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'D': return 'bg-orange-100 text-orange-700 border-orange-300'
      case 'E':
      case 'F': return 'bg-red-100 text-red-700 border-red-300'
      default: return 'bg-gray-100 text-gray-500 border-gray-300'
    }
  }

  // Handle Excel file upload
  async function handleExcelUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setParsingExcel(true)
    try {
      const rows = await parseExcelMarks(file)
      
      if (rows.length === 0) {
        toast.error('No valid data found in Excel file')
        return
      }

      // Match with students
      const { matched, unmatched } = matchExcelWithStudents(rows, students)

      // Create preview
      const preview = [
        ...matched.map(m => ({
          sn: m.sn,
          studentName: m.studentName,
          marks: m.marks,
          grade: m.grade,
          matchedStudentId: m.studentId,
          matchedStudentName: m.matchedName,
          status: 'matched' as const,
        })),
        ...unmatched.map(u => ({
          sn: u.sn,
          studentName: u.studentName,
          marks: u.marks,
          grade: u.grade,
          matchedStudentId: '',
          matchedStudentName: '',
          status: 'unmatched' as const,
        })),
      ].sort((a, b) => a.sn - b.sn)

      setUploadPreview(preview)
      setUploadDialogOpen(true)

      toast.success(`Found ${matched.length} matching students (${unmatched.length} unmatched)`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to parse Excel file')
    } finally {
      setParsingExcel(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function downloadMarksTemplate() {
    const XLSX = await import('xlsx')
    const selectedClassInfo = modeClasses.find(c => c.id === selectedClass)
    const selectedSubjectInfo = subjects.find(s => s.id === selectedSubject)
    const sampleRows = students.length > 0
      ? students.map((student, index) => [index + 1, student.fullName, '', ''])
      : [
          [1, schoolType === 'SECONDARY' ? 'Asha Ally' : 'Juma Hamisi', '', ''],
          [2, schoolType === 'SECONDARY' ? 'Baraka John' : 'Amina Salim', '', ''],
        ]

    const ws = XLSX.utils.aoa_to_sheet([
      ['S/N', 'STUDENT NAME', 'MARKS', 'GRADE'],
      ...sampleRows,
    ])
    ws['!cols'] = [{ wch: 6 }, { wch: 32 }, { wch: 12 }, { wch: 10 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Marks')
    const output = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const className = selectedClassInfo?.fullName || selectedClassInfo?.name || (schoolType === 'SECONDARY' ? 'F1' : 'STD 1')
    const subjectName = selectedSubjectInfo?.shortName || selectedSubjectInfo?.subjectName || 'Subject'
    downloadExcel(
      new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${className}_${subjectName}_marks_template`
    )
  }

  // Apply uploaded marks to markRows
  function applyUploadedMarks() {
    if (!uploadPreview) return

    const matchedRows = uploadPreview.filter(p => p.status === 'matched')
    
    setMarkRows(prev => {
      const updated = [...prev]
      
      for (const uploadRow of matchedRows) {
        const index = updated.findIndex(r => r.studentId === uploadRow.matchedStudentId)
        if (index !== -1) {
          const marksStr = String(uploadRow.marks)
          const computed = getGrade(uploadRow.marks, schoolType as SchoolType)
          
          updated[index] = {
            ...updated[index],
            marks: marksStr,
            grade: uploadRow.grade || computed.grade || '',
            remarks: computed.remarks || '',
            points: computed.points != null ? String(computed.points) : '',
          }
        }
      }
      
      return updated
    })

    setUploadDialogOpen(false)
    setUploadPreview(null)
    toast.success(`Applied ${matchedRows.length} marks from Excel`)
  }

  const filledCount = markRows.filter(r => r.marks !== '').length
  const maxMarks = schoolType === 'PRIMARY' ? 50 : 100

  // Filter classes by current school type
  const modeClasses = classes.filter(c => c.schoolType === schoolType)

  function normalizeClassSubject(cs: {
    id?: string
    subjectId?: string
    subjectName?: string
    shortName?: string | null
    name?: string
    subject?: { id?: string; name?: string; shortName?: string | null }
  }): SubjectItem | null {
    const id = cs.id || ''
    const subjectId = cs.subject?.id || cs.subjectId || ''
    const subjectName = cs.subject?.name || cs.subjectName || cs.name || ''
    const shortName = cs.subject?.shortName || cs.shortName || subjectName

    if (!id || !subjectId || !subjectName) return null

    return {
      id,
      subjectId,
      subjectName,
      shortName,
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Marks Entry</h2>
          <p className="text-sm text-muted-foreground">Enter and manage student exam marks</p>
        </div>
        {dataLoaded && (
          <div className="flex gap-2">
            <Button
              onClick={handleSaveAll}
              disabled={saving || filledCount === 0}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save All ({filledCount})
            </Button>
            <Button
              onClick={() => setComputeDialogOpen(true)}
              variant="outline"
              className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <Calculator className="w-4 h-4" />
              Compute Results
            </Button>
          </div>
        )}
      </div>

      {/* Selection Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Select Class, Exam & Subject</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {modeClasses.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Exam</Label>
              <Select value={selectedExam} onValueChange={setSelectedExam} disabled={!selectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select exam" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.name} ({exam.examType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!selectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
              <SelectContent>
                {subjects.map((subj) => (
                  <SelectItem key={subj.id} value={subj.id}>{subj.subjectName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClass && subjects.length === 0 && (
              <p className="mt-2 text-sm text-amber-700">
                No subjects have been assigned to this class yet. Please contact the School Admin.
              </p>
            )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mode Switch & Upload (shown when class/exam/subject selected) */}
      {selectedClass && selectedExam && selectedSubject && (
        <Card className="bg-gradient-to-r from-blue-50 to-emerald-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Entry Mode:</span>
                <div className="flex bg-white rounded-lg p-1 border border-gray-200">
                  <button
                    onClick={() => setEntryMode('manual')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      entryMode === 'manual'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <PenTool className="w-4 h-4" />
                      Fill Manually
                    </span>
                  </button>
                  <button
                    onClick={() => setEntryMode('upload')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      entryMode === 'upload'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Upload Excel
                    </span>
                  </button>
                </div>
              </div>
              
              {entryMode === 'upload' && (
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelUpload}
                    className="hidden"
                  />
                  <Button
                    onClick={downloadMarksTemplate}
                    variant="outline"
                    className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Download className="w-4 h-4" />
                    Download Template
                  </Button>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parsingExcel}
                    variant="outline"
                    className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    {parsingExcel ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                    {parsingExcel ? 'Parsing...' : 'Select Excel File'}
                  </Button>
                  <div className="text-xs text-muted-foreground hidden sm:block">
                    Expected: S/N | STUDENT NAME | MARKS | GRADE
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {dataLoaded && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{markRows.length}</p>
              <p className="text-xs text-muted-foreground">Total Students</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{filledCount}</p>
              <p className="text-xs text-muted-foreground">Marks Filled</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{markRows.length - filledCount}</p>
              <p className="text-xs text-muted-foreground">Missing Marks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-gray-600">{maxMarks}</p>
              <p className="text-xs text-muted-foreground">Max Marks</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Marks Entry Table */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      )}

      {!loading && !dataLoaded && selectedClass && selectedExam && selectedSubject && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      )}

      {!loading && !dataLoaded && (!selectedClass || !selectedExam || !selectedSubject) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
              <PenTool className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Select Class, Exam & Subject</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Choose a class, exam, and subject above to start entering marks for students.
            </p>
          </CardContent>
        </Card>
      )}

      {dataLoaded && markRows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="mobile-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">S/N</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="w-24 text-center">Marks (/{maxMarks})</TableHead>
                    <TableHead className="w-20 text-center">Grade</TableHead>
                    {schoolType === 'SECONDARY' && (
                      <TableHead className="w-20 text-center">Points</TableHead>
                    )}
                    <TableHead className="w-28">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {markRows.map((row, idx) => (
                    <TableRow key={row.studentId}>
                      <TableCell className="text-center text-muted-foreground" data-label="S/N">{idx + 1}</TableCell>
                      <TableCell data-label="Student Name">
                        <div className="font-medium">{students[idx]?.fullName}</div>
                        {students[idx]?.admissionNo && (
                          <div className="text-xs text-muted-foreground">{students[idx].admissionNo}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center" data-label="Marks">
                        <Input
                          type="number"
                          min={0}
                          max={maxMarks}
                          value={row.marks}
                          onChange={(e) => handleMarkChange(idx, e.target.value)}
                          className={`w-20 text-center mx-auto ${markErrors.has(idx) ? 'border-red-500 ring-2 ring-red-200' : ''}`}
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-center" data-label="Grade">
                        {row.grade ? (
                          <Badge variant="outline" className={gradeColor(row.grade)}>
                            {row.grade}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {schoolType === 'SECONDARY' && (
                        <TableCell className="text-center" data-label="Points">
                          {row.points ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              {row.points}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell data-label="Remarks">
                        <span className="text-xs text-muted-foreground">{row.remarks || '-'}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {dataLoaded && markRows.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No students found in this class. Add students first.</p>
          </CardContent>
        </Card>
      )}

      {/* Compute Results Confirmation Dialog */}
      <AlertDialog open={computeDialogOpen} onOpenChange={setComputeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Compute Results
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will calculate totals, averages, grades, ranks, and divisions for all students in the selected class and exam. Any previously computed results will be overwritten. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setComputeDialogOpen(false)
                handleComputeResults()
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Compute Results
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Compute Result Summary Dialog */}
      <Dialog open={!!computeResult} onOpenChange={() => setComputeResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Results Computed Successfully
            </DialogTitle>
            <DialogDescription>
              {computeResult?.totalStudents} students processed — {computeResult?.completeCount || 0} complete, {computeResult?.incompleteCount || 0} incomplete (need {computeResult?.minSubjectsRequired || 7}+ subjects)
            </DialogDescription>
          </DialogHeader>
          {computeResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-emerald-600">{computeResult.completeCount}</p>
                    <p className="text-xs text-muted-foreground">Complete</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-red-600">{computeResult.incompleteCount}</p>
                    <p className="text-xs text-muted-foreground">Incomplete</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-blue-600">
                      {computeResult.minSubjectsRequired}+
                    </p>
                    <p className="text-xs text-muted-foreground">Min Subjects</p>
                  </CardContent>
                </Card>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <Table className="mobile-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Subj</TableHead>
                      <TableHead className="text-center">Avg</TableHead>
                      <TableHead className="text-center">Grade</TableHead>
                      {computeResult.schoolType === 'SECONDARY' && (
                        <TableHead className="text-center">Div</TableHead>
                      )}
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {computeResult.results.map((r, i) => (
                      <TableRow key={i} className={r.status === 'INCOMPLETE' ? 'bg-red-50/50' : ''}>
                        <TableCell className="text-muted-foreground" data-label="#">{r.rank ?? '—'}</TableCell>
                        <TableCell className="font-medium" data-label="Name">{r.studentName}</TableCell>
                        <TableCell className="text-center text-xs" data-label="Subj">{r.subjectCount}</TableCell>
                        <TableCell className="text-center" data-label="Avg">{r.averageMarks != null ? Math.round(r.averageMarks * 100) / 100 : '—'}</TableCell>
                        <TableCell className="text-center" data-label="Grade">
                          {r.grade ? <Badge variant="outline" className={gradeColor(r.grade)}>{r.grade}</Badge> : <span className="text-gray-400">—</span>}
                        </TableCell>
                        {computeResult.schoolType === 'SECONDARY' && (
                          <TableCell className="text-center" data-label="Div">{r.division || '—'}</TableCell>
                        )}
                        <TableCell className="text-center" data-label="Status">
                          {r.status === 'COMPLETE' ? (
                            <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-[9px]">Complete</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[9px]">Incomplete</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setComputeResult(null)} className="bg-emerald-600 hover:bg-emerald-700">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Upload Preview Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Excel Upload Preview
            </DialogTitle>
            <DialogDescription>
              Review the imported marks before applying. Matched students will be highlighted.
            </DialogDescription>
          </DialogHeader>
          
          {uploadPreview && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-blue-600">{uploadPreview.length}</p>
                    <p className="text-xs text-muted-foreground">Total Rows</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-emerald-600">
                      {uploadPreview.filter(p => p.status === 'matched').length}
                    </p>
                    <p className="text-xs text-muted-foreground">Matched</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-red-600">
                      {uploadPreview.filter(p => p.status === 'unmatched').length}
                    </p>
                    <p className="text-xs text-muted-foreground">Unmatched</p>
                  </CardContent>
                </Card>
              </div>

              {/* Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table className="mobile-table">
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-12 text-center">S/N</TableHead>
                      <TableHead>Excel Name</TableHead>
                      <TableHead className="w-24 text-center">Marks</TableHead>
                      <TableHead className="w-20 text-center">Grade</TableHead>
                      <TableHead>Matched Student</TableHead>
                      <TableHead className="w-24 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadPreview.map((row, idx) => (
                      <TableRow 
                        key={idx} 
                        className={row.status === 'matched' ? 'bg-emerald-50/50' : 'bg-red-50/50'}
                      >
                        <TableCell className="text-center text-muted-foreground" data-label="S/N">{row.sn}</TableCell>
                        <TableCell className="font-medium" data-label="Excel Name">{row.studentName}</TableCell>
                        <TableCell className="text-center font-bold" data-label="Marks">{row.marks}</TableCell>
                        <TableCell className="text-center" data-label="Grade">
                          {row.grade ? (
                            <Badge variant="outline" className={gradeColor(row.grade)}>
                              {row.grade}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell data-label="Matched Student">
                          {row.status === 'matched' ? (
                            <span className="text-emerald-700 font-medium flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              {row.matchedStudentName}
                            </span>
                          ) : (
                            <span className="text-red-500 flex items-center gap-1">
                              <X className="w-4 h-4" />
                              Not found
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center" data-label="Status">
                          {row.status === 'matched' ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[9px]">
                              Matched
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[9px]">
                              Unmatched
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={applyUploadedMarks}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              disabled={!uploadPreview || uploadPreview.filter(p => p.status === 'matched').length === 0}
            >
              <CheckCircle2 className="w-4 h-4" />
              Apply {uploadPreview?.filter(p => p.status === 'matched').length || 0} Marks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
