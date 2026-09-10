'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiCall } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Search, Calendar, Loader2, Filter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

interface ExamItem {
  id: string
  name: string
  examType: string
  classId: string
  schoolId: string
  academicYear: string
  term: string
  examDate: string | null
  class?: { name: string; fullName: string; schoolType: string }
  marksCount?: number
  _count?: { marks?: number; results?: number }
}

interface ClassItem {
  id: string
  name: string
  fullName: string
  schoolType: string
}

const EXAM_TYPES = ['MIDTERM', 'MONTHLY', 'TERMINAL', 'ANNUAL'] as const
const TERMS = ['FIRST TERM', 'SECOND TERM', 'THIRD TERM'] as const

export default function ExamManagement() {
  const { currentSchool, schoolType } = useAppStore()
  const [exams, setExams] = useState<ExamItem[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState<string>('ALL')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExam, setEditingExam] = useState<ExamItem | null>(null)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [formName, setFormName] = useState('')
  const [formExamType, setFormExamType] = useState<string>('MIDTERM')
  const [formClassId, setFormClassId] = useState('')
  const [formTerm, setFormTerm] = useState<string>('FIRST TERM')
  const [formAcademicYear, setFormAcademicYear] = useState(new Date().getFullYear().toString())
  const [formExamDate, setFormExamDate] = useState('')

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<ExamItem | null>(null)

  useEffect(() => {
    loadData()
  }, [currentSchool])

  async function loadData() {
    setLoading(true)
    try {
      const [examData, classData] = await Promise.all([
        apiCall(`/api/shulea/exams?schoolId=${currentSchool?.id || ''}`),
        apiCall(`/api/shulea/classes?schoolId=${currentSchool?.id || ''}`),
      ])
      setExams(examData.exams || [])
      setClasses(classData.classes || [])
    } catch {
      toast.error('Failed to load exams')
    } finally {
      setLoading(false)
    }
  }

  function openAddDialog() {
    setEditingExam(null)
    setFormName('')
    setFormExamType('MIDTERM')
    setFormClassId(modeClasses[0]?.id || '')
    setFormTerm('FIRST TERM')
    setFormAcademicYear(new Date().getFullYear().toString())
    setFormExamDate('')
    setDialogOpen(true)
  }

  function openEditDialog(exam: ExamItem) {
    setEditingExam(exam)
    setFormName(exam.name)
    setFormExamType(exam.examType)
    setFormClassId(exam.classId)
    setFormTerm(exam.term)
    setFormAcademicYear(exam.academicYear)
    setFormExamDate(exam.examDate || '')
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error('Exam name is required')
      return
    }
    if (!formClassId) {
      toast.error('Class is required')
      return
    }

    setSaving(true)
    try {
      if (editingExam) {
        await apiCall('/api/shulea/exams', {
          method: 'PUT',
          body: JSON.stringify({
            id: editingExam.id,
            name: formName.trim(),
            examType: formExamType,
            academicYear: formAcademicYear,
            term: formTerm,
            examDate: formExamDate || null,
          }),
        })
        toast.success('Exam updated successfully')
      } else {
        await apiCall('/api/shulea/exams', {
          method: 'POST',
          body: JSON.stringify({
            name: formName.trim(),
            examType: formExamType,
            classId: formClassId,
            schoolId: currentSchool?.id,
            academicYear: formAcademicYear,
            term: formTerm,
            examDate: formExamDate || null,
          }),
        })
        toast.success('Exam created successfully')
      }
      setDialogOpen(false)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save exam')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await apiCall(`/api/shulea/exams?id=${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Exam deleted')
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete exam')
    } finally {
      setDeleteTarget(null)
    }
  }

  // Filter classes and exams by current school type
  const modeClasses = classes.filter(c => c.schoolType === schoolType)

  const filteredExams = exams.filter((exam) => {
    const classInfo = exam.class || classes.find(c => c.id === exam.classId)
    const matchesSearch = exam.name.toLowerCase().includes(search.toLowerCase()) ||
      exam.examType.toLowerCase().includes(search.toLowerCase()) ||
      (classInfo?.fullName || '').toLowerCase().includes(search.toLowerCase())
    const matchesClass = filterClass === 'ALL' || exam.classId === filterClass
    const matchesSchoolType = classInfo?.schoolType === schoolType
    return matchesSearch && matchesClass && matchesSchoolType
  })

  function examTypeBadge(type: string) {
    const colors: Record<string, string> = {
      MIDTERM: 'bg-amber-50 text-amber-700 border-amber-200',
      MONTHLY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      TERMINAL: 'bg-blue-50 text-blue-700 border-blue-200',
      ANNUAL: 'bg-purple-50 text-purple-700 border-purple-200',
    }
    return colors[type] || 'bg-gray-50 text-gray-700 border-gray-200'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Exams</h2>
          <p className="text-sm text-muted-foreground">{exams.length} exams registered</p>
        </div>
        <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="w-4 h-4" />
          Add Exam
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search exams..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-full sm:w-50">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Classes</SelectItem>
                {modeClasses.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Exams Table */}
      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <Table className="mobile-table">
              <TableHeader>
                <TableRow className="bg-linear-to-r from-emerald-50 to-emerald-25 border-b-2 border-emerald-200">
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Exam Name</TableHead>
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Type</TableHead>
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Class</TableHead>
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Term</TableHead>
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Year</TableHead>
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Date</TableHead>
                  <TableHead className="font-bold text-gray-800 text-center whitespace-nowrap min-w-max">Marks</TableHead>
                  <TableHead className="font-bold text-gray-800 text-right whitespace-nowrap min-w-max">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      {search || filterClass !== 'ALL'
                        ? 'No exams match your search'
                        : 'No exams yet. Click "Add Exam" to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExams.map((exam, idx) => (
                    <TableRow key={exam.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50 hover:bg-gray-100'}>
                      <TableCell className="font-semibold text-gray-900 whitespace-nowrap" data-label="Exam Name">{exam.name}</TableCell>
                      <TableCell className="whitespace-nowrap" data-label="Type">
                        <Badge variant="outline" className={examTypeBadge(exam.examType)}>
                          {exam.examType}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap" data-label="Class">{exam.class?.fullName || classes.find(c => c.id === exam.classId)?.fullName || '-'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap" data-label="Term">{exam.term}</TableCell>
                      <TableCell className="whitespace-nowrap" data-label="Year">{exam.academicYear}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap font-mono" data-label="Date">{exam.examDate || '-'}</TableCell>
                      <TableCell className="text-center whitespace-nowrap" data-label="Marks">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-300 font-medium">{exam._count?.marks ?? exam.marksCount ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap" data-label="Actions">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-emerald-100 hover:text-emerald-700"
                            onClick={() => openEditDialog(exam)}
                            title="Edit exam"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-red-100 text-red-500 hover:text-red-700"
                            onClick={() => setDeleteTarget(exam)}
                            title="Delete exam"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filteredExams.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t text-xs text-muted-foreground">
              Showing {filteredExams.length} of {exams.length} exams
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExam ? 'Edit Exam' : 'Add New Exam'}</DialogTitle>
            <DialogDescription>
              {editingExam ? 'Update exam information' : 'Create a new exam for a class'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Exam Name *</Label>
              <Input
                placeholder="e.g. Midterm Exam"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Exam Type *</Label>
                <Select value={formExamType} onValueChange={setFormExamType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXAM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Term *</Label>
                <Select value={formTerm} onValueChange={setFormTerm}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TERMS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Class *</Label>
                <Select value={formClassId} onValueChange={setFormClassId} disabled={!!editingExam}>
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
                <Label>Academic Year *</Label>
                <Input
                  placeholder="e.g. 2026"
                  value={formAcademicYear}
                  onChange={(e) => setFormAcademicYear(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Exam Date</Label>
              <Input
                type="date"
                value={formExamDate}
                onChange={(e) => setFormExamDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingExam ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This will also remove all associated marks and results. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
