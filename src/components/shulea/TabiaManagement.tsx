'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiCall } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Save, Loader2, Heart
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

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
}

interface StudentItem {
  id: string
  fullName: string
  gender: string
  admissionNo: string | null
}

const TRAIT_OPTIONS = ['A', 'B', 'C', 'D', 'E'] as const
const TRAITS = [
  { key: 'discipline', label: 'Discipline & Respect' },
  { key: 'hygiene', label: 'Personal Hygiene' },
  { key: 'hardWorking', label: 'Hard Working' },
  { key: 'cooperation', label: 'Cooperation' },
  { key: 'honesty', label: 'Honesty & Responsibility' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'sports', label: 'Sports Participation' },
] as const

type TraitKey = typeof TRAITS[number]['key']

interface TabiaRow {
  studentId: string
  classId: string
  examId: string
  discipline: string
  hygiene: string
  hardWorking: string
  cooperation: string
  honesty: string
  leadership: string
  sports: string
}

export default function TabiaManagement() {
  const { currentSchool, schoolType } = useAppStore()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [exams, setExams] = useState<ExamItem[]>([])
  const [students, setStudents] = useState<StudentItem[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedExam, setSelectedExam] = useState('')
  const [rows, setRows] = useState<TabiaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

  // Filter classes and exams by current school type
  const modeClasses = (classes || []).filter(c => c.schoolType === schoolType)

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
    if (selectedClass) {
      loadExams()
    } else {
      setExams([])
    }
    setSelectedExam('')
    setStudents([])
    setRows([])
    setDataLoaded(false)
  }, [selectedClass])

  async function loadExams() {
    try {
      const data = await apiCall(`/api/shulea/exams?classId=${selectedClass}`)
      setExams(data.exams || [])
    } catch {
      toast.error('Failed to load exams')
    }
  }

  useEffect(() => {
    if (selectedClass && selectedExam) {
      loadTabia()
    } else {
      setRows([])
      setDataLoaded(false)
    }
  }, [selectedClass, selectedExam])

  useEffect(() => {
    const handleDataChanged = () => {
      if (selectedClass && selectedExam) {
        void loadTabia()
      } else {
        setRows([])
        setDataLoaded(false)
      }
    }

    window.addEventListener('shulea:data-changed', handleDataChanged)
    return () => window.removeEventListener('shulea:data-changed', handleDataChanged)
  }, [selectedClass, selectedExam])

  async function loadTabia() {
    setLoading(true)
    setDataLoaded(false)
    setStudents([])
    setRows([])
    try {
      const data = await apiCall(
        `/api/shulea/tabia?classId=${selectedClass}&examId=${selectedExam}`
      )
      const fetchedStudents: StudentItem[] = data.students || []
      const fetchedTabia: Array<{
        studentId: string
        discipline: string | null
        hygiene: string | null
        hardWorking: string | null
        cooperation: string | null
        honesty: string | null
        leadership: string | null
        sports: string | null
      }> = data.tabia || []

      const tabiaMap = new Map<string, Record<string, string>>()
      for (const t of fetchedTabia) {
        tabiaMap.set(t.studentId, {
          discipline: t.discipline || '',
          hygiene: t.hygiene || '',
          hardWorking: t.hardWorking || '',
          cooperation: t.cooperation || '',
          honesty: t.honesty || '',
          leadership: t.leadership || '',
          sports: t.sports || '',
        })
      }

      const tabiaRows: TabiaRow[] = fetchedStudents.map((s) => {
        const existing = tabiaMap.get(s.id) || {}
        return {
          studentId: s.id,
          classId: selectedClass,
          examId: selectedExam,
          discipline: existing.discipline || '',
          hygiene: existing.hygiene || '',
          hardWorking: existing.hardWorking || '',
          cooperation: existing.cooperation || '',
          honesty: existing.honesty || '',
          leadership: existing.leadership || '',
          sports: existing.sports || '',
        }
      })

      setStudents(fetchedStudents)
      setRows(tabiaRows)
      setDataLoaded(true)
    } catch {
      toast.error('Failed to load tabia records')
    } finally {
      setLoading(false)
    }
  }

  function handleTraitChange(index: number, trait: TraitKey, value: string) {
    setRows(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [trait]: value === 'NONE' ? '' : value }
      return updated
    })
  }

  async function handleSaveAll() {
    if (rows.length === 0) {
      toast.error('No tabia data to save')
      return
    }

    setSaving(true)
    try {
      const records = rows.map((r) => ({
        studentId: r.studentId,
        classId: r.classId,
        examId: r.examId,
        discipline: r.discipline || null,
        hygiene: r.hygiene || null,
        hardWorking: r.hardWorking || null,
        cooperation: r.cooperation || null,
        honesty: r.honesty || null,
        leadership: r.leadership || null,
        sports: r.sports || null,
      }))

      const result = await apiCall('/api/shulea/tabia', {
        method: 'POST',
        body: JSON.stringify({
          action: 'bulk-save',
          records,
        }),
      })
      toast.success(result.message || `Saved ${rows.length} tabia records`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save tabia records')
    } finally {
      setSaving(false)
    }
  }

  function gradeColor(grade: string): string {
    switch (grade) {
      case 'A': return 'bg-green-50 text-green-700 border-green-200'
      case 'B': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'C': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'D': return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'E': return 'bg-red-50 text-red-700 border-red-200'
      default: return ''
    }
  }

  // Compute how many rows have at least one trait filled
  const filledCount = rows.filter(r => TRAITS.some(t => r[t.key])).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tabia (Character Assessment)</h2>
          <p className="text-sm text-muted-foreground">Evaluate student character and conduct traits</p>
        </div>
        {dataLoaded && (
          <Button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All ({filledCount}/{rows.length})
          </Button>
        )}
      </div>

      {/* Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Select Class & Exam</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>
        </CardContent>
      </Card>

      {/* Trait Legend */}
      {dataLoaded && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Grading Scale:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { grade: 'A', desc: 'Excellent' },
                { grade: 'B', desc: 'Very Good' },
                { grade: 'C', desc: 'Good' },
                { grade: 'D', desc: 'Satisfactory' },
                { grade: 'E', desc: 'Poor' },
              ].map((g) => (
                <span key={g.grade} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${gradeColor(g.grade)}`}>
                  {g.grade} - {g.desc}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !dataLoaded && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Select Class & Exam</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Choose a class and exam above to manage student character assessments.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabia Table */}
      {dataLoaded && rows.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto max-w-full">
              <Table className="mobile-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center sticky left-0 bg-white z-10">S/N</TableHead>
                    <TableHead className="sticky left-12 bg-white z-10 min-w-[150px]">Student Name</TableHead>
                    {TRAITS.map((trait) => (
                      <TableHead key={trait.key} className="text-center min-w-[90px] text-xs">
                        {trait.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={row.studentId}>
                      <TableCell className="text-center text-muted-foreground sticky left-0 bg-white z-10" data-label="S/N">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="sticky left-12 bg-white z-10" data-label="Student Name">
                        <div className="font-medium text-sm">{students[idx]?.fullName}</div>
                      </TableCell>
                      {TRAITS.map((trait) => (
                        <TableCell key={trait.key} className="text-center" data-label={trait.label}>
                          <Select
                            value={row[trait.key]}
                            onValueChange={(v) => handleTraitChange(idx, trait.key, v)}
                          >
                            <SelectTrigger className="w-16 mx-auto h-8 text-center">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NONE">-</SelectItem>
                              {TRAIT_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {dataLoaded && rows.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No students found in this class. Add students first.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
