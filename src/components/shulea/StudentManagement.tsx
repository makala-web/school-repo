'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { apiCall, downloadExcel } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Search, Upload, Download, Loader2, Filter, X, FileSpreadsheet, AlertCircle, CheckCircle2, UserPlus
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
import { Textarea } from '@/components/ui/textarea'

interface Student {
  id: string
  admissionNo: string | null
  fullName: string
  gender: string
  parentPhone: string | null
  status: string
  classId: string
  schoolId: string
  class: { name: string; fullName: string; schoolType: string }
}

interface ClassItem {
  id: string
  name: string
  fullName: string
  schoolType: string
}

export default function StudentManagement() {
  const { currentSchool, schoolType, currentUser } = useAppStore()
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [saving, setSaving] = useState(false)

  // Form fields - Required
  const [formName, setFormName] = useState('')
  const [formGender, setFormGender] = useState<string>('M')
  const [formClassId, setFormClassId] = useState<string>('')
  const [formAdmissionNo, setFormAdmissionNo] = useState('')
  const [autoAdmissionNo, setAutoAdmissionNo] = useState(true)

  // Parent phone is required for student records and SMS.
  const [formParentPhone, setFormParentPhone] = useState('')

  // Form fields - Status (edit only)
  const [formStatus, setFormStatus] = useState<string>('ACTIVE')

  // Auto admission number preview
  const [previewAdmNo, setPreviewAdmNo] = useState('')
  const [loadingAdmNo, setLoadingAdmNo] = useState(false)

  // Delete dialogs
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [bulkDeleteClassId, setBulkDeleteClassId] = useState<string>('')
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // CSV Upload
  const [csvDialogOpen, setCsvDialogOpen] = useState(false)
  const [csvData, setCsvData] = useState('')
  const [csvClassId, setCsvClassId] = useState<string>('')
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResult, setCsvResult] = useState<{ imported: number; errors?: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  }, [currentSchool, currentUser?.id])

  const notifyDataChanged = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('shulea:data-changed'))
    }
  }

  // Auto-generate admission number preview when class changes
  useEffect(() => {
    if (autoAdmissionNo && formClassId && !editingStudent) {
      fetchPreviewAdmissionNo(formClassId)
    }
  }, [formClassId, autoAdmissionNo, editingStudent])

  async function fetchPreviewAdmissionNo(classId: string) {
    setLoadingAdmNo(true)
    try {
      const data = await apiCall(`/api/shulea/students?nextAdmissionNo=${classId}`)
      setPreviewAdmNo(data.admissionNo || '')
    } catch {
      setPreviewAdmNo('')
    } finally {
      setLoadingAdmNo(false)
    }
  }

  async function loadData() {
    setLoading(true)
    try {
      const [studentsData, classesData] = await Promise.all([
        apiCall(`/api/shulea/students?schoolId=${currentSchool?.id || ''}`),
        apiCall(`/api/shulea/classes?schoolId=${currentSchool?.id || ''}`),
      ])
      setStudents(studentsData.students || [])
      setClasses(classesData.classes || [])
      const loadedClasses: ClassItem[] = classesData.classes || []
      const modeClassesFromLoad = loadedClasses.filter(c => c.schoolType === schoolType)
      if (modeClassesFromLoad.length > 0 && !formClassId) {
        setFormClassId(modeClassesFromLoad[0].id)
      }
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  function openAddDialog() {
    setEditingStudent(null)
    setFormName('')
    setFormGender('M')
    setFormClassId(modeClasses[0]?.id || '')
    setFormAdmissionNo('')
    setAutoAdmissionNo(true)
    setFormParentPhone('')
    setFormStatus('ACTIVE')
    setDialogOpen(true)
  }

  function openEditDialog(student: Student) {
    setEditingStudent(student)
    setFormName(student.fullName)
    setFormGender(student.gender)
    setFormClassId(student.classId)
    setFormAdmissionNo(student.admissionNo || '')
    setAutoAdmissionNo(!student.admissionNo)
    setFormParentPhone(student.parentPhone || '')
    setFormStatus(student.status)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error('Student name is required')
      return
    }
    if (!formClassId) {
      toast.error('Please select a class')
      return
    }
    if (!formParentPhone.trim()) {
      toast.error('Parent phone number is required')
      return
    }

    setSaving(true)
    try {
      if (editingStudent) {
        await apiCall('/api/shulea/students', {
          method: 'PUT',
          body: JSON.stringify({
            id: editingStudent.id,
            fullName: formName.trim(),
            admissionNo: autoAdmissionNo ? null : formAdmissionNo.trim() || null,
            gender: formGender,
            parentPhone: formParentPhone.trim() || null,
            classId: formClassId,
            status: formStatus,
          }),
        })
        toast.success('Student updated successfully')
      } else {
        await apiCall('/api/shulea/students', {
          method: 'POST',
          body: JSON.stringify({
            fullName: formName.trim(),
            admissionNo: autoAdmissionNo ? '' : formAdmissionNo.trim(),
            gender: formGender,
            parentPhone: formParentPhone.trim() || null,
            classId: formClassId,
            schoolId: currentSchool?.id,
            status: formStatus,
            autoAdmissionNo,
          }),
        })
        toast.success('Student added successfully')
      }
      setDialogOpen(false)
      await loadData()
      notifyDataChanged()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save student')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await apiCall(`/api/shulea/students?id=${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Student deleted')
      await loadData()
      notifyDataChanged()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete student')
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleCsvUpload() {
    if (!csvData.trim() || !csvClassId) {
      toast.error('Please provide CSV data and select a class')
      return
    }
    setCsvUploading(true)
    setCsvResult(null)
    try {
      const data = await apiCall('/api/shulea/students', {
        method: 'POST',
        body: JSON.stringify({
          action: 'csv-upload',
          csvData,
          classId: csvClassId,
          schoolId: currentSchool?.id,
        }),
      })
      setCsvResult({ imported: data.imported, errors: data.errors })
      toast.success(`${data.imported} students imported!`)
      await loadData()
      notifyDataChanged()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'CSV upload failed')
    } finally {
      setCsvUploading(false)
    }
  }

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

    if (isXlsx) {
      if (!csvClassId || !currentSchool?.id) {
        toast.error('Please select a class before uploading')
        e.target.value = ''
        return
      }

      // For xlsx files, send to backend for parsing via FormData
      const formData = new FormData()
      formData.append('file', file)
      formData.append('classId', csvClassId)
      formData.append('schoolId', currentSchool?.id || '')

      setCsvUploading(true)
      setCsvResult(null)
      apiCall('/api/shulea/students', {
        method: 'POST',
        body: formData,
      })
        .then(data => {
          if (data.error) {
            toast.error(data.error)
          } else {
            setCsvResult({ imported: data.imported, errors: data.errors })
            toast.success(`${data.imported} students imported!`)
            loadData().then(notifyDataChanged)
          }
        })
        .catch((err: unknown) => {
          toast.error(err instanceof Error ? err.message : 'Failed to upload Excel file')
        })
        .finally(() => {
          setCsvUploading(false)
        })
      return
    }

    // For CSV files, read locally and populate textarea
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      setCsvData(text)
      toast.success(`File "${file.name}" loaded (${(file.size / 1024).toFixed(1)}KB)`)
    }
    reader.onerror = () => {
      toast.error('Failed to read file. Try pasting data manually.')
    }
    reader.readAsText(file, 'utf-8')
  }, [csvClassId, currentSchool])

  // Reset file input value so the same file can be re-uploaded
  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  // Filter classes to only show current school type
  const modeClasses = classes.filter(c => c.schoolType === schoolType)

  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (s.admissionNo || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.parentPhone || '').toLowerCase().includes(search.toLowerCase())
    const matchesClass = filterClass === 'ALL' || s.classId === filterClass
    const matchesStatus = filterStatus === 'ALL' || s.status === filterStatus
    const matchesSchoolType = s.class?.schoolType === schoolType
    return matchesSearch && matchesClass && matchesStatus && matchesSchoolType
  })

  const statusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'TRANSFERRED': return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'GRADUATED': return 'bg-blue-50 text-blue-700 border-blue-200'
      default: return ''
    }
  }

  async function downloadStudentTemplate() {
    const XLSX = await import('xlsx')
    const templateClass = schoolType === 'SECONDARY' ? 'F1' : modeClasses[0]?.fullName || 'STD 1'
    const firstAdmission = schoolType === 'SECONDARY' ? 'F-001' : 'STD1-001'
    const secondAdmission = schoolType === 'SECONDARY' ? 'F-002' : 'STD1-002'
    const ws = XLSX.utils.aoa_to_sheet([
      ['Student Name', 'Admission Number', 'Gender', 'Class', 'Parent Number'],
      ['Juma Hamisi', firstAdmission, 'M', templateClass, '0712345678'],
      ['Amina Salim', secondAdmission, 'F', templateClass, '0755123456'],
    ])
    ws['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 22 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Students')
    const output = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    downloadExcel(new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'student-import-template')
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
          <h2 className="text-xl font-bold text-gray-900">Students</h2>
          <p className="text-sm text-muted-foreground">{students.length} students registered</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            setCsvDialogOpen(true)
            setCsvResult(null)
            setCsvData('')
            setCsvClassId(modeClasses[0]?.id || '')
          }} className="gap-2">
            <Upload className="w-4 h-4" />
            Import
          </Button>
          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <UserPlus className="w-4 h-4" />
            Add Student
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
                placeholder="Search by name, admission no, or parent..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Filter class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Classes</SelectItem>
                {modeClasses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="TRANSFERRED">Transferred</SelectItem>
                <SelectItem value="GRADUATED">Graduated</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 gap-1 shrink-0"
              onClick={() => {
                const classId = filterClass !== 'ALL' ? filterClass : ''
                if (!classId) { toast.error('Please filter by a specific class first'); return }
                setBulkDeleteClassId(classId)
                setBulkDeleteDialogOpen(true)
              }}
              disabled={filterClass === 'ALL'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Class
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <Table className="mobile-table">
              <TableHeader>
                <TableRow className="bg-linear-to-r from-emerald-50 to-emerald-25 border-b-2 border-emerald-200">
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Name</TableHead>
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Adm No</TableHead>
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Gender</TableHead>
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Class</TableHead>
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Parent Phone</TableHead>
                  <TableHead className="font-bold text-gray-800 whitespace-nowrap min-w-max">Status</TableHead>
                  <TableHead className="font-bold text-gray-800 text-right whitespace-nowrap min-w-max">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      {search || filterClass !== 'ALL' || filterStatus !== 'ALL'
                        ? 'No students match your filters'
                        : 'No students yet. Click "Add Student" to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student, idx) => (
                    <TableRow key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50 hover:bg-gray-100'}>
                      <TableCell className="font-semibold text-gray-900 whitespace-nowrap" data-label="Name">{student.fullName}</TableCell>
                      <TableCell className="whitespace-nowrap" data-label="Adm No"><span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{student.admissionNo || '-'}</span></TableCell>
                      <TableCell className="whitespace-nowrap" data-label="Gender">
                        <Badge variant="outline" className={
                          student.gender === 'M'
                            ? 'bg-blue-100 text-blue-700 border-blue-300 font-medium'
                            : 'bg-pink-100 text-pink-700 border-pink-300 font-medium'
                        }>
                          {student.gender === 'M' ? 'Male' : 'Female'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap" data-label="Class">{student.class?.fullName || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-sm" data-label="Parent Phone">{student.parentPhone || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap" data-label="Status">
                        <Badge variant="outline" className={statusColor(student.status) + ' font-medium'}>
                          {student.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap" data-label="Actions">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 hover:bg-emerald-100 hover:text-emerald-700"
                            onClick={() => openEditDialog(student)}
                            title="Edit student"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-red-100 text-red-500 hover:text-red-700"
                            onClick={() => setDeleteTarget(student)}
                            title="Delete student"
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
          {filteredStudents.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t text-xs text-muted-foreground">
              Showing {filteredStudents.length} of {students.length} students
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              {editingStudent ? 'Edit Student' : 'Add New Student'}
            </DialogTitle>
            <DialogDescription>
              {editingStudent ? 'Update student information' : 'Register a new student — admission number is auto-generated'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            {/* Required Fields */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Required Information</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="formName">Full Name *</Label>
                  <Input
                    id="formName"
                    placeholder="e.g. Juma Hamisi"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Gender *</Label>
                  <Select value={formGender} onValueChange={setFormGender}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Male</SelectItem>
                      <SelectItem value="F">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Class *</Label>
                  <Select value={formClassId} onValueChange={setFormClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {modeClasses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Admission No</Label>
                  {autoAdmissionNo && !editingStudent ? (
                    <div className="flex items-center h-9 px-3 rounded-md border bg-muted/50">
                      {loadingAdmNo ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <span className="text-sm font-mono font-medium text-emerald-700">{previewAdmNo || '—'}</span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">auto</span>
                    </div>
                  ) : (
                    <Input
                      placeholder="e.g. STD1-001"
                      value={formAdmissionNo}
                      onChange={(e) => setFormAdmissionNo(e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Parent Phone Number *</Label>
                <Input
                  placeholder="e.g. 0712345678"
                  value={formParentPhone}
                  onChange={(e) => setFormParentPhone(e.target.value)}
                />
              </div>

              {/* Toggle auto/manual admission number */}
              {!editingStudent && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={autoAdmissionNo ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setAutoAdmissionNo(true)
                      setFormAdmissionNo('')
                    }}
                    className={autoAdmissionNo ? 'bg-emerald-600 hover:bg-emerald-700 text-xs h-7' : 'text-xs h-7'}
                  >
                    Auto-generate
                  </Button>
                  <Button
                    type="button"
                    variant={!autoAdmissionNo ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAutoAdmissionNo(false)}
                    className={!autoAdmissionNo ? 'bg-emerald-600 hover:bg-emerald-700 text-xs h-7' : 'text-xs h-7'}
                  >
                    Enter manually
                  </Button>
                </div>
              )}
            </div>

            {/* Status (edit only) */}
            {editingStudent && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="TRANSFERRED">Transferred</SelectItem>
                    <SelectItem value="GRADUATED">Graduated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingStudent ? 'Update' : 'Add Student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Import Students
            </DialogTitle>
            <DialogDescription>Import students from a CSV or Excel (.xlsx) file</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            {/* Format Info */}
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm">
              <p className="font-medium text-emerald-800 mb-1">Expected Format:</p>
              <p className="text-xs text-emerald-700 mb-1">Required: <code className="bg-white/60 px-1 rounded">Student Name, Admission Number, Gender, Class, Parent Number</code></p>
              <p className="text-xs text-emerald-600 mt-2">All fields are mandatory. Gender must be M or F. The selected class below is used for the import.</p>
              <Button type="button" variant="outline" size="sm" onClick={downloadStudentTemplate} className="mt-2 gap-2">
                <Download className="w-4 h-4" />
                Download Template
              </Button>
            </div>

            {/* Class Selection */}
            <div className="space-y-2">
              <Label>Import to Class *</Label>
              <Select value={csvClassId} onValueChange={setCsvClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {modeClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>Upload File</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleFileButtonClick}
                  className="flex-1 gap-2"
                  disabled={!csvClassId}
                >
                  <Upload className="w-4 h-4" />
                  Choose CSV / Excel File
                </Button>
              </div>
              {!csvClassId && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Select a class first before uploading
                </p>
              )}
            </div>

            {/* Or paste CSV */}
            <div className="space-y-2">
              <Label>Or paste CSV data:</Label>
              <Textarea
                placeholder="Student Name,Admission Number,Gender,Class,Parent Number&#10;Juma Hamisi,STD1-001,M,STD 1,0712345678&#10;Amina Salim,STD1-002,F,STD 1,0755123456"
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                rows={5}
                className="font-mono text-xs"
              />
            </div>

            {/* Results */}
            {csvResult && (
              <div className="p-3 rounded-lg border space-y-1">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium text-sm">{csvResult.imported} students imported successfully</span>
                </div>
                {csvResult.errors && csvResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {csvResult.errors.length} errors:
                    </p>
                    <div className="max-h-24 overflow-y-auto custom-scrollbar mt-1">
                      {csvResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-amber-600">{err}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCsvDialogOpen(false)}>Close</Button>
            <Button
              onClick={handleCsvUpload}
              disabled={csvUploading || !csvData.trim() || !csvClassId}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {csvUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.fullName}"? This will also remove all their marks, attendance, and results. This action cannot be undone.
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

      {/* Bulk Delete by Class Confirmation */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete All Students in Class
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete ALL students in the selected class? This will also remove all their marks, attendance, tabia, and results. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!bulkDeleteClassId) return
                setBulkDeleting(true)
                try {
                  const result = await apiCall(`/api/shulea/students?classId=${bulkDeleteClassId}`, { method: 'DELETE' })
                  toast.success(result.message || 'Students deleted')
                  setBulkDeleteDialogOpen(false)
                  loadData()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed to delete students')
                } finally {
                  setBulkDeleting(false)
                }
              }}
              disabled={bulkDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete All Students
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
