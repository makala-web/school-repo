 'use client'

import { useEffect, useState } from 'react'
import { useAppStore, type SchoolType } from '@/lib/store'
import { apiCall } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Search, Loader2, Filter, BookOpenCheck
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
import { Checkbox } from '@/components/ui/checkbox'

interface Subject {
  id: string
  name: string
  shortName: string | null
  schoolType: string
  schoolId: string
  _count?: { classSubjects?: number; teacherSubjects?: number }
  classCount?: number
  teacherCount?: number
  source?: 'MASTER' | 'CUSTOM'
}

interface ClassItem {
  id: string
  name: string
  fullName: string
  schoolType: string
}

interface ClassSubject {
  id: string
  subjectId: string
  classId: string
  subject: { id: string; name: string; shortName: string | null }
}

export default function SubjectManagement() {
  const { currentSchool, schoolType, currentUser } = useAppStore()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>(schoolType)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [formName, setFormName] = useState('')
  const [formShortName, setFormShortName] = useState('')
  const [formSchoolType, setFormSchoolType] = useState<string>(schoolType)

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null)

  // Assign subjects dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignClassId, setAssignClassId] = useState<string>('')
  const [assignedSubjectIds, setAssignedSubjectIds] = useState<Set<string>>(new Set())
  const [assigning, setAssigning] = useState(false)
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([])

  useEffect(() => {
    loadData()
  }, [currentSchool, currentUser?.id])

  async function loadData() {
    setLoading(true)
    try {
      const [subjectsData, classesData] = await Promise.all([
        apiCall(`/api/shulea/subjects?schoolId=${currentSchool?.id || ''}`),
        apiCall(`/api/shulea/classes?schoolId=${currentSchool?.id || ''}`),
      ])
      setSubjects(subjectsData?.subjects || [])
      setClasses(classesData?.classes || [])
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  function openAddDialog() {
    setEditingSubject(null)
    setFormName('')
    setFormShortName('')
    setFormSchoolType(schoolType)
    setDialogOpen(true)
  }

  function openEditDialog(subject: Subject) {
    setEditingSubject(subject)
    setFormName(subject.name)
    setFormShortName(subject.shortName || '')
    setFormSchoolType(subject.schoolType)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error('Subject name is required')
      return
    }

    setSaving(true)
    try {
      if (editingSubject) {
        await apiCall('/api/shulea/subjects', {
          method: 'PUT',
          body: JSON.stringify({
            id: editingSubject.id,
            name: formName.trim(),
            shortName: formShortName.trim() || null,
            schoolType: formSchoolType,
          }),
        })
        toast.success('Subject updated successfully')
      } else {
        await apiCall('/api/shulea/subjects', {
          method: 'POST',
          body: JSON.stringify({
            name: formName.trim(),
            shortName: formShortName.trim() || null,
            schoolType: formSchoolType,
            schoolId: currentSchool?.id,
          }),
        })
        toast.success('Subject created successfully')
      }
      setDialogOpen(false)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save subject')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await apiCall(`/api/shulea/subjects?id=${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Subject deleted')
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete subject')
    } finally {
      setDeleteTarget(null)
    }
  }

  async function openAssignDialog() {
    const modeClasses = (classes || []).filter(c => c.schoolType === schoolType)
    const firstClassId = modeClasses[0]?.id || ''
    setAssignDialogOpen(true)
    setAssignClassId(firstClassId)
    setAssignedSubjectIds(new Set())
    setClassSubjects([])
    if (firstClassId) {
      loadClassSubjects(firstClassId)
    }
  }

  async function loadClassSubjects(classId: string) {
    try {
      const data = await apiCall(`/api/shulea/subjects?action=class-subjects&classId=${classId}`)
      const cs = data.classSubjects || []
      setClassSubjects(cs)
      setAssignedSubjectIds(new Set(cs.map((c: ClassSubject) => c.subjectId)))
    } catch {
      setAssignedSubjectIds(new Set())
    }
  }

  async function handleAssignSave() {
    if (!assignClassId) {
      toast.error('Please select a class')
      return
    }

    setAssigning(true)
    try {
      await apiCall('/api/shulea/subjects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'assign-to-class',
          schoolId: currentSchool?.id,
          classId: assignClassId,
          subjectIds: Array.from(assignedSubjectIds),
        }),
      })
      toast.success('Subjects assigned successfully')
      setAssignDialogOpen(false)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign subjects')
    } finally {
      setAssigning(false)
    }
  }

  function toggleSubjectAssignment(subjectId: string) {
    setAssignedSubjectIds(prev => {
      const next = new Set(prev)
      if (next.has(subjectId)) {
        next.delete(subjectId)
      } else {
        next.add(subjectId)
      }
      return next
    })
  }

  function getClassSubjectCount(subject: Subject): number {
    return subject._count?.classSubjects ?? subject.classCount ?? 0
  }

  function getTeacherSubjectCount(subject: Subject): number {
    return subject._count?.teacherSubjects ?? subject.teacherCount ?? 0
  }

  const filteredSubjects = (subjects || []).filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.shortName || '').toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'ALL' || s.schoolType === filterType || s.schoolType === 'BOTH'
    return matchesSearch && matchesType
  })

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
          <h2 className="text-xl font-bold text-gray-900">Subjects</h2>
          <p className="text-sm text-muted-foreground">
            {(subjects || []).filter(s => s.schoolType === schoolType || s.schoolType === 'BOTH').length} {schoolType === 'PRIMARY' ? 'Primary' : 'Secondary'} subjects
            {(subjects || []).some(s => s.schoolType !== schoolType && s.schoolType !== 'BOTH') && (
              <span className="text-amber-600 ml-1">{(subjects || []).filter(s => s.schoolType !== schoolType && s.schoolType !== 'BOTH').length} other</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openAssignDialog} className="gap-2">
            <BookOpenCheck className="w-4 h-4" />
            Assign to Class
          </Button>
          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Plus className="w-4 h-4" />
            Add Subject
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search subjects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="PRIMARY">Primary</SelectItem>
                <SelectItem value="SECONDARY">Secondary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Subjects Table */}
      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <Table className="mobile-table">
              <TableHeader>
                <TableRow className="bg-linear-to-r from-emerald-50 to-emerald-25 border-b-2 border-emerald-200">
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Subject Name</TableHead>
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Short Name</TableHead>
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Type</TableHead>
                  <TableHead className="font-bold text-gray-800 text-center whitespace-nowrap min-w-max">Classes</TableHead>
                  <TableHead className="font-bold text-gray-800 text-center whitespace-nowrap min-w-max">Teachers</TableHead>
                  <TableHead className="font-bold text-gray-800 text-right whitespace-nowrap min-w-max">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {search || filterType !== 'ALL'
                        ? 'No subjects match your search'
                        : 'No subjects yet. Click "Add Subject" to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubjects.map((subject, idx) => (
                    <TableRow key={subject.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50 hover:bg-gray-100'}>
                      <TableCell className="font-semibold text-gray-900 whitespace-nowrap" data-label="Subject Name">
                        <div className="flex items-center gap-2">
                          <span>{subject.name}</span>
                          <Badge variant="outline" className={subject.source === 'CUSTOM'
                            ? 'border-slate-300 bg-slate-50 text-slate-600'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                            {subject.source === 'CUSTOM' ? 'Custom' : 'System'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap" data-label="Short Name">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{subject.shortName || '-'}</code>
                      </TableCell>
                      <TableCell className="whitespace-nowrap" data-label="Type">
                        <Badge variant="outline" className={
                          subject.schoolType === 'PRIMARY'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300 font-medium'
                            : subject.schoolType === 'SECONDARY'
                            ? 'bg-teal-100 text-teal-700 border-teal-300 font-medium'
                            : 'bg-purple-100 text-purple-700 border-purple-300 font-medium'
                        }>
                          {subject.schoolType === 'BOTH' ? 'Both' : subject.schoolType === 'PRIMARY' ? 'Primary' : 'Secondary'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap" data-label="Classes">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-300 font-medium">{getClassSubjectCount(subject)}</Badge>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap" data-label="Teachers">
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-300 font-medium">{getTeacherSubjectCount(subject)}</Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap" data-label="Actions">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-emerald-100 hover:text-emerald-700"
                            onClick={() => openEditDialog(subject)}
                            title="Edit subject"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-red-100 text-red-500 hover:text-red-700"
                            onClick={() => setDeleteTarget(subject)}
                            title="Delete subject"
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
          {filteredSubjects.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t text-xs text-muted-foreground">
              Showing {filteredSubjects.length} of {subjects.length} subjects
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
            <DialogDescription>
              {editingSubject ? 'Update subject information' : 'Create a new subject'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            <div className="space-y-2">
              <Label>Subject Name *</Label>
              <Input
                placeholder="e.g. Mathematics"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Short Name</Label>
                <Input
                  placeholder="e.g. MATH"
                  value={formShortName}
                  onChange={(e) => setFormShortName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>School Type</Label>
                <Select value={formSchoolType} onValueChange={setFormSchoolType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIMARY">Primary</SelectItem>
                    <SelectItem value="SECONDARY">Secondary</SelectItem>
                    <SelectItem value="BOTH">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingSubject ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Subjects to Class Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5 text-emerald-600" />
              Assign Subjects to Class
            </DialogTitle>
            <DialogDescription>Select which subjects should be assigned to a class</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            <div className="space-y-2">
              <Label>Select Class</Label>
              <Select
                value={assignClassId}
                onValueChange={(v) => {
                  setAssignClassId(v)
                  loadClassSubjects(v)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose class" />
                </SelectTrigger>
                <SelectContent>
                  {(classes || []).filter(c => c.schoolType === schoolType).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {assignClassId && (
              <div className="space-y-2">
                <Label>Subjects</Label>
                <div className="border rounded-lg p-3 max-h-64 overflow-y-auto custom-scrollbar space-y-2">
                  {(subjects || [])
                    .filter(s => s.schoolType === (classes || []).find(c => c.id === assignClassId)?.schoolType || s.schoolType === 'BOTH')
                    .map((subject) => (
                      <label
                        key={subject.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={assignedSubjectIds.has(subject.id)}
                          onCheckedChange={() => toggleSubjectAssignment(subject.id)}
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium">{subject.name}</span>
                          {subject.shortName && (
                            <span className="text-xs text-muted-foreground ml-2">({subject.shortName})</span>
                          )}
                        </div>
                      </label>
                    ))}
                  {subjects.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No subjects available</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {assignedSubjectIds.size} of {subjects.length} subjects selected
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignSave} disabled={assigning} className="bg-emerald-600 hover:bg-emerald-700">
              {assigning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subject</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This will also remove all associated class assignments and marks.
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
