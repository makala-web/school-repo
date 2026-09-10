'use client'

import { useEffect, useState } from 'react'
import { useAppStore, type SchoolType } from '@/lib/store'
import { apiCall } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Search, School, Loader2, Users, Filter, Sparkles
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

interface ClassItem {
  id: string
  name: string
  stream: string | null
  fullName: string
  schoolType: string
  classTeacherId: string | null
  schoolId: string
  academicYear: string | null
  term: string | null
  school?: { name: string; schoolType: string }
  classTeacher?: { name: string; shortName: string | null } | null
  teacher?: { name: string; shortName: string | null } | null
  studentCount?: number
  subjectCount?: number
  _count?: { students?: number; subjects?: number; exams?: number }
}

// Default classes for each school type
const PRIMARY_DEFAULT_CLASSES = ['PP I', 'PP II', 'STD 1', 'STD 2', 'STD 3', 'STD 4', 'STD 5', 'STD 6', 'STD 7']
const SECONDARY_DEFAULT_CLASSES = ['Form 1', 'Form 2', 'Form 3', 'Form 4']

function getDefaultClasses(schoolType: SchoolType): string[] {
  return schoolType === 'PRIMARY' ? PRIMARY_DEFAULT_CLASSES : SECONDARY_DEFAULT_CLASSES
}

function getClassPlaceholder(schoolType: SchoolType): string {
  return schoolType === 'PRIMARY' ? 'e.g. PP I, STD 1, STD 7' : 'e.g. Form 1, Form 4'
}

export default function ClassManagement() {
  const { currentSchool, schoolType, currentUser } = useAppStore()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>(schoolType)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [formName, setFormName] = useState('')
  const [formStream, setFormStream] = useState('')
  const [formSchoolType, setFormSchoolType] = useState<SchoolType>(schoolType)

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<ClassItem | null>(null)

  // Generate defaults state
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadClasses()
  }, [currentSchool, currentUser?.id])

  async function loadClasses() {
    setLoading(true)
    try {
      const data = await apiCall(`/api/shulea/classes?schoolId=${currentSchool?.id || ''}`)
      setClasses(data.classes || [])
    } catch {
      toast.error('Failed to load classes')
    } finally {
      setLoading(false)
    }
  }

  function openAddDialog() {
    setEditingClass(null)
    setFormName('')
    setFormStream('')
    setFormSchoolType(schoolType)
    setDialogOpen(true)
  }

  function openEditDialog(cls: ClassItem) {
    setEditingClass(cls)
    setFormName(cls.name)
    setFormStream(cls.stream || '')
    setFormSchoolType(cls.schoolType as SchoolType)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error('Class name is required')
      return
    }

    setSaving(true)
    try {
      const fullName = formStream.trim()
        ? `${formName.trim()} ${formStream.trim()}`
        : formName.trim()

      if (editingClass) {
        await apiCall('/api/shulea/classes', {
          method: 'PUT',
          body: JSON.stringify({
            id: editingClass.id,
            name: formName.trim(),
            stream: formStream.trim() || null,
            fullName,
            schoolType: formSchoolType,
          }),
        })
        toast.success('Class updated successfully')
      } else {
        await apiCall('/api/shulea/classes', {
          method: 'POST',
          body: JSON.stringify({
            name: formName.trim(),
            stream: formStream.trim() || null,
            fullName,
            schoolType: formSchoolType,
            schoolId: currentSchool?.id,
          }),
        })
        toast.success('Class created successfully')
      }
      setDialogOpen(false)
      loadClasses()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save class')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await apiCall(`/api/shulea/classes?id=${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Class deleted')
      loadClasses()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete class')
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleGenerateDefaults() {
    if (!currentSchool?.id) {
      toast.error('No school selected')
      return
    }

    const defaultNames = getDefaultClasses(schoolType)
    const existingNames = new Set(classes.map((c) => c.name))
    const toCreate = defaultNames.filter((name) => !existingNames.has(name))

    if (toCreate.length === 0) {
      toast.info('All default classes already exist')
      return
    }

    setGenerating(true)
    let created = 0
    let failed = 0

    try {
      for (const name of toCreate) {
        try {
          await apiCall('/api/shulea/classes', {
            method: 'POST',
            body: JSON.stringify({
              name,
              stream: null,
              fullName: name,
              schoolType,
              classTeacherId: null,
              schoolId: currentSchool.id,
            }),
          })
          created++
        } catch {
          failed++
        }
      }

      if (created > 0) {
        toast.success(`Generated ${created} default class${created > 1 ? 'es' : ''}${failed > 0 ? ` (${failed} failed)` : ''}`)
      } else if (failed > 0) {
        toast.error('Failed to generate default classes')
      }

      loadClasses()
    } catch {
      toast.error('Failed to generate default classes')
    } finally {
      setGenerating(false)
    }
  }

  const filteredClasses = classes.filter((cls) => {
    const matchesSearch = cls.fullName.toLowerCase().includes(search.toLowerCase()) ||
      cls.name.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'ALL' || cls.schoolType === filterType
    return matchesSearch && matchesType
  })

  // Determine how many default classes are missing
  const defaultClassNames = getDefaultClasses(schoolType)
  const existingNames = new Set(classes.map((c) => c.name))
  const missingDefaults = defaultClassNames.filter((name) => !existingNames.has(name))

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
          <h2 className="text-xl font-bold text-gray-900">Classes</h2>
          <p className="text-sm text-muted-foreground">
            {classes.filter(c => c.schoolType === schoolType).length} {schoolType === 'PRIMARY' ? 'Primary' : 'Secondary'} classes
            {classes.some(c => c.schoolType !== schoolType) && (
              <span className="text-amber-600 ml-1">({classes.filter(c => c.schoolType !== schoolType).length} other)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleGenerateDefaults}
            disabled={generating || missingDefaults.length === 0}
            variant="outline"
            className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate Default Classes
          </Button>
          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Plus className="w-4 h-4" />
            Add Class
          </Button>
        </div>
      </div>

      {/* Default Classes Info Banner */}
      {missingDefaults.length > 0 && classes.length === 0 && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <School className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-emerald-800">
                  {schoolType === 'PRIMARY' ? 'Primary' : 'Secondary'} School Default Classes
                </p>
                <p className="text-xs text-emerald-600">
                  {schoolType === 'PRIMARY'
                    ? 'Primary schools typically have PP I, PP II (Pre-Primary), and STD 1 through STD 7. PP I & PP II are optional for schools without pre-primary.'
                    : 'Secondary schools typically have Form 1 through Form 4 (O-Level).'
                  }
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {defaultClassNames.map((name) => (
                    <Badge
                      key={name}
                      variant="outline"
                      className={`text-xs ${
                        existingNames.has(name)
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                          : 'bg-white text-gray-500 border-gray-200'
                      }`}
                    >
                      {existingNames.has(name) ? '✓ ' : ''}{name}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-emerald-600 pt-1">
                  Click &quot;Generate Default Classes&quot; to create all missing classes at once.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search classes..."
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

      {/* Classes Table */}
      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <Table className="mobile-table">
              <TableHeader>
                <TableRow className="bg-linear-to-r from-emerald-50 to-emerald-25 border-b-2 border-emerald-200">
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Class Name</TableHead>
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Stream</TableHead>
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Type</TableHead>
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Class Teacher</TableHead>
                  <TableHead className="font-bold text-gray-800 text-center whitespace-nowrap min-w-max">Students</TableHead>
                  <TableHead className="font-bold text-gray-800 text-center whitespace-nowrap min-w-max">Subjects</TableHead>
                  <TableHead className="font-bold text-gray-800 text-right whitespace-nowrap min-w-max">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      {search || filterType !== 'ALL'
                        ? 'No classes match your search'
                        : 'No classes yet. Click "Generate Default Classes" or "Add Class" to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClasses.map((cls, idx) => (
                    <TableRow key={cls.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50 hover:bg-gray-100'}>
                      <TableCell className="font-semibold text-gray-900 whitespace-nowrap" data-label="Class Name">{cls.fullName}</TableCell>
                      <TableCell className="whitespace-nowrap" data-label="Stream">{cls.stream || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap" data-label="Type">
                        <Badge variant="outline" className={
                          cls.schoolType === 'PRIMARY'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300 font-medium'
                            : 'bg-teal-100 text-teal-700 border-teal-300 font-medium'
                        }>
                          {cls.schoolType === 'PRIMARY' ? 'Primary' : 'Secondary'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap" data-label="Class Teacher">{cls.classTeacher?.name || cls.teacher?.name || '-'}</TableCell>
                      <TableCell className="text-center whitespace-nowrap" data-label="Students">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-300 font-medium">{cls._count?.students ?? cls.studentCount ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap" data-label="Subjects">
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-300 font-medium">{cls._count?.subjects ?? cls.subjectCount ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap" data-label="Actions">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-emerald-100 hover:text-emerald-700"
                            onClick={() => openEditDialog(cls)}
                            title="Edit class"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-red-100 text-red-500 hover:text-red-700"
                            onClick={() => setDeleteTarget(cls)}
                            title="Delete class"
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
          {filteredClasses.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t text-xs text-muted-foreground">
              Showing {filteredClasses.length} of {classes.length} classes
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingClass ? 'Edit Class' : 'Add New Class'}</DialogTitle>
            <DialogDescription>
              {editingClass ? 'Update class information' : 'Create a new class for your school'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            <div className="space-y-2">
              <Label>Class Name *</Label>
              <Input
                placeholder={getClassPlaceholder(formSchoolType)}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {formSchoolType === 'PRIMARY'
                  ? 'Use PP I, PP II for Pre-Primary; STD 1–STD 7 for Standard classes'
                  : 'Use Form 1–Form 4 for O-Level classes'}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stream</Label>
                <Input
                  placeholder="e.g. A, B"
                  value={formStream}
                  onChange={(e) => setFormStream(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>School Type</Label>
                <Select value={formSchoolType} onValueChange={(v) => setFormSchoolType(v as SchoolType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIMARY">Primary</SelectItem>
                    <SelectItem value="SECONDARY">Secondary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingClass ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.fullName}&quot;? This will also remove all associated students, marks, and results. This action cannot be undone.
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
