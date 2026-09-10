'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiCall } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Plus, Edit, Trash2, Loader2, AlertCircle, CheckCircle2
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ClassTeacherAssignment {
  id: string
  class: { id: string; name: string; fullName: string }
  teacher: { id: string; name: string; shortName?: string }
  academicYear: string
  startDate: string
  endDate?: string
  status: string
}

interface Class {
  id: string
  name: string
  fullName: string
}

interface Teacher {
  id: string
  name: string
  shortName?: string
}

export default function ClassTeacherManagement() {
  const { currentUser } = useAppStore()
  const [assignments, setAssignments] = useState<ClassTeacherAssignment[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  // Dialog states
  const [assignDialog, setAssignDialog] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<ClassTeacherAssignment | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    classId: '',
    teacherId: '',
    academicYear: new Date().getFullYear().toString(),
    startDate: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (currentUser?.schoolId) {
      loadData()
    }
  }, [currentUser?.schoolId])

  async function loadData() {
    setLoading(true)
    try {
      // Load assignments
      const assignmentsData = await apiCall(
        `/api/shulea/class-teacher-assignments?schoolId=${currentUser?.schoolId}&actorUserId=${currentUser?.id}`
      )
      setAssignments(assignmentsData.assignments || [])

      // Load classes and teachers from school
      const schoolData = await apiCall(
        `/api/shulea/school?schoolId=${currentUser?.schoolId}&includeClasses=true&includeTeachers=true`
      )

      if (schoolData.school) {
        setClasses(schoolData.school.classes || [])
        setTeachers(schoolData.school.teachers || [])
      }
    } catch (error) {
      toast.error('Failed to load class teacher data')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.classId || !formData.teacherId) {
      toast.error('Please select a class and teacher')
      return
    }

    setProcessing(true)
    try {
      await apiCall('/api/shulea/class-teacher-assignments', {
        method: 'POST',
        body: JSON.stringify({
          action: 'assign',
          actorUserId: currentUser?.id,
          schoolId: currentUser?.schoolId,
          ...formData
        })
      })

      toast.success('Class teacher assigned successfully')
      setAssignDialog(false)
      setFormData({
        classId: '',
        teacherId: '',
        academicYear: new Date().getFullYear().toString(),
        startDate: new Date().toISOString().split('T')[0]
      })
      loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign class teacher')
    } finally {
      setProcessing(false)
    }
  }

  async function handleRemove(assignmentId: string) {
    if (!confirm('Are you sure you want to remove this assignment?')) return

    setProcessing(true)
    try {
      await apiCall('/api/shulea/class-teacher-assignments', {
        method: 'POST',
        body: JSON.stringify({
          action: 'remove',
          actorUserId: currentUser?.id,
          assignmentId
        })
      })

      toast.success('Assignment removed successfully')
      loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove assignment')
    } finally {
      setProcessing(false)
    }
  }

  const getTeacherName = (teacherId: string) => {
    return teachers.find(t => t.id === teacherId)?.name || 'Unknown'
  }

  const getClassName = (classId: string) => {
    return classes.find(c => c.id === classId)?.fullName || 'Unknown'
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Loading class teacher assignments...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Class Teacher Assignments</h3>
          <p className="text-sm text-gray-600">Manage class teacher assignments for your school</p>
        </div>
        <Button
          onClick={() => {
            setSelectedAssignment(null)
            setAssignDialog(true)
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Assign Class Teacher
        </Button>
      </div>

      {/* Info Box */}
      {assignments.length === 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">No class teacher assignments yet</p>
              <p>Assign class teachers to manage student groups and generate reports efficiently.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignments Table */}
      {assignments.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.class.fullName}</TableCell>
                    <TableCell>{assignment.teacher.name}</TableCell>
                    <TableCell>{assignment.academicYear}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(assignment.startDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={assignment.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className={assignment.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : ''}
                      >
                        {assignment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(assignment.id)}
                        disabled={processing}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Assignment Dialog */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedAssignment ? 'Update Class Teacher' : 'Assign Class Teacher'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAssign} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="classId">Class *</Label>
              <Select
                value={formData.classId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, classId: value }))}
              >
                <SelectTrigger id="classId">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teacherId">Teacher *</Label>
              <Select
                value={formData.teacherId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, teacherId: value }))}
              >
                <SelectTrigger id="teacherId">
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map(teacher => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="academicYear">Academic Year *</Label>
              <Input
                id="academicYear"
                value={formData.academicYear}
                onChange={(e) => setFormData(prev => ({ ...prev, academicYear: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignDialog(false)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={processing}>
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Assign'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
