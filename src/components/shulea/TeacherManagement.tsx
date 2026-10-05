'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiCall } from '@/lib/utils'
import { toast } from 'sonner'
import { Users, Plus, Mail, UserPlus, Copy, Check, X, MoreVertical, Trash2, Shield, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'

interface Teacher {
  id: string
  name: string
  shortName?: string
  email?: string
  phone?: string
  userId?: string
  user?: {
    id: string
    email: string
    fullName: string
    role: string
    active: boolean
  }
  subjectClasses?: {
    id: string
    subjectId: string
    classId: string
    subject?: { name: string; shortName?: string | null }
    class?: { name: string; fullName: string }
  }[]
  classAssignments?: { id: string; name: string; fullName: string }[]
}

interface Invitation {
  id: string
  inviteCode: string
  email: string
  fullName?: string
  role: string
  status: string
  expiresAt: string
  acceptedAt?: string
  sender: {
    id: string
    fullName: string
  }
  receiver?: {
    id: string
    fullName: string
    email: string
  }
}

export default function TeacherManagement() {
  const { currentSchool, currentUser } = useAppStore()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteDialog, setInviteDialog] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [availableClasses, setAvailableClasses] = useState<{ id: string; fullName: string; name: string }[]>([])
  const [availableSubjects, setAvailableSubjects] = useState<{ id: string; name: string; shortName?: string | null }[]>([])
  const [subjectsByClass, setSubjectsByClass] = useState<Record<string, { id: string; name: string; shortName?: string | null }[]>>({})
  
  // Invite form
  const [inviteForm, setInviteForm] = useState({
    email: '',
    fullName: '',
    role: 'TEACHER',
    expiryDays: '7'
    , assignmentsByClass: {} as Record<string, string[]>
  })
  const [inviting, setInviting] = useState(false)
  const [assignmentDialog, setAssignmentDialog] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [assignmentClassId, setAssignmentClassId] = useState('')
  const [assignmentSubjectIds, setAssignmentSubjectIds] = useState<string[]>([])
  const [savingAssignments, setSavingAssignments] = useState(false)

  useEffect(() => {
    loadData()
  }, [currentSchool?.id, currentUser?.id])

  async function loadData() {
    if (!currentSchool?.id || !currentUser?.id) return

    setLoading(true)
    try {
      // Load teachers (using existing API)
      const teachersData = await apiCall(`/api/shulea/teachers?schoolId=${currentSchool.id}`)
      setTeachers(teachersData.teachers || [])

      // Load invitations
      const invitationsData = await apiCall(`/api/shulea/invitations?schoolId=${currentSchool.id}&userId=${currentUser.id}`)
      setInvitations(invitationsData.invitations || [])

      const [classesData, subjectsData] = await Promise.all([
        apiCall(`/api/shulea/classes?schoolId=${currentSchool.id}&schoolType=${currentSchool.schoolType}`),
        apiCall(`/api/shulea/subjects?schoolId=${currentSchool.id}&schoolType=${currentSchool.schoolType}`),
      ])
      setAvailableClasses((classesData.classes || []).map((item: any) => ({ id: item.id, name: item.name, fullName: item.fullName || item.name })))
      setAvailableSubjects((subjectsData.subjects || []).map((item: any) => ({ id: item.id, name: item.name, shortName: item.shortName })))
      const classSubjects = await Promise.all((classesData.classes || []).map(async (item: any) => {
        const response = await apiCall(`/api/shulea/subjects?action=class-subjects&classId=${item.id}`)
        return [item.id, (response.classSubjects || []).map((row: any) => ({ id: row.subjectId, name: row.subject?.name || row.name, shortName: row.subject?.shortName || row.shortName }))] as const
      }))
      setSubjectsByClass(Object.fromEntries(classSubjects))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load teachers')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateInvitation(e: React.FormEvent) {
    e.preventDefault()

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('Internet connection is required to send a new teacher invitation.')
      return
    }
    
    if (!inviteForm.email || !inviteForm.email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    setInviting(true)
    try {
      const data = await apiCall('/api/shulea/invitations', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-invitation',
          schoolId: currentSchool?.id,
          userId: currentUser?.id,
          email: inviteForm.email,
          fullName: inviteForm.fullName || undefined,
          role: inviteForm.role,
          expiryDays: parseInt(inviteForm.expiryDays),
          assignedTeacherSubjects: Object.entries(inviteForm.assignmentsByClass).flatMap(([classId, subjectIds]) => subjectIds.map(subjectId => ({ classId, subjectId }))),
        }),
      })

      const assignmentCount = Object.values(inviteForm.assignmentsByClass).reduce((count, ids) => count + ids.length, 0)
      toast.success(`Invitation saved with ${assignmentCount} class-subject assignment${assignmentCount === 1 ? '' : 's'}. They activate when the teacher accepts. Share code ${data.invitation?.inviteCode || ''}.`)
      setInviteDialog(false)
      setInviteForm({ email: '', fullName: '', role: 'TEACHER', expiryDays: '7', assignmentsByClass: {} })
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create invitation')
    } finally {
      setInviting(false)
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    try {
      await apiCall(`/api/shulea/invitations?invitationId=${invitationId}&userId=${currentUser?.id}`, {
        method: 'DELETE'
      })
      toast.success('Invitation revoked successfully')
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke invitation')
    }
  }

  function openAssignmentDialog(teacher: Teacher) {
    const classId = teacher.classAssignments?.[0]?.id || teacher.subjectClasses?.[0]?.classId || ''
    setSelectedTeacher(teacher)
    setAssignmentClassId(classId)
    setAssignmentSubjectIds((teacher.subjectClasses || [])
      .filter(assignment => assignment.classId === classId)
      .map(assignment => assignment.subjectId))
    setAssignmentDialog(true)
  }

  function changeAssignmentClass(classId: string) {
    setAssignmentClassId(classId)
    setAssignmentSubjectIds((selectedTeacher?.subjectClasses || [])
      .filter(assignment => assignment.classId === classId)
      .map(assignment => assignment.subjectId))
  }

  async function saveAssignments() {
    if (!selectedTeacher || !currentSchool?.id || !currentUser?.id || !assignmentClassId) {
      toast.error('Please select a class')
      return
    }
    setSavingAssignments(true)
    try {
      const existing = (selectedTeacher.subjectClasses || []).filter(a => a.classId === assignmentClassId)
      const selected = new Set(assignmentSubjectIds)
      await Promise.all([
        ...existing.filter(a => !selected.has(a.subjectId)).map(a => apiCall('/api/shulea/teachers', {
          method: 'POST', body: JSON.stringify({ action: 'remove-assignment', schoolId: currentSchool.id, assignmentId: a.id, actorUserId: currentUser.id }),
        })),
        ...assignmentSubjectIds.filter(id => !existing.some(a => a.subjectId === id)).map(subjectId => apiCall('/api/shulea/teachers', {
          method: 'POST', body: JSON.stringify({ action: 'assign-subject', schoolId: currentSchool.id, teacherId: selectedTeacher.id, subjectId, classId: assignmentClassId, actorUserId: currentUser.id }),
        })),
      ])
      toast.success('Teacher assignments updated successfully')
      setAssignmentDialog(false)
      await loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update teacher assignments')
    } finally {
      setSavingAssignments(false)
    }
  }

  function copyInviteCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    toast.success('Invite code copied to clipboard')
    setTimeout(() => setCopiedCode(null), 2000)
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-TZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  function getInvitationStatusBadge(status: string) {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>
      case 'ACCEPTED':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Accepted</Badge>
      case 'EXPIRED':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Expired</Badge>
      case 'REVOKED':
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200">Revoked</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  function getRoleBadge(role: string) {
    switch (role.toUpperCase()) {
      case 'SCHOOL_ADMIN':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200">School Admin</Badge>
      case 'TEACHER':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Teacher</Badge>
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-gray-200 rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Teachers Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Teachers</CardTitle>
              <CardDescription>
                Manage teachers in your school
              </CardDescription>
            </div>
            <Button onClick={() => setInviteDialog(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Teacher
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {teachers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No teachers yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Invite teachers to join your school
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{teacher.name}</p>
                          {teacher.shortName && (
                            <p className="text-xs text-gray-500">{teacher.shortName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {teacher.user?.email || teacher.email || '-'}
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(teacher.user?.role || 'TEACHER')}
                      </TableCell>
                      <TableCell>
                        {teacher.user?.active ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Active</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 border-red-200">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openAssignmentDialog(teacher)}>
                          <Settings2 className="mr-2 h-4 w-4" />
                          Manage
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

      {/* Invitations Section */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>
            Manage teacher invitations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No pending invitations</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invite Code</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                            {invitation.inviteCode}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInviteCode(invitation.inviteCode)}
                          >
                            {copiedCode === invitation.inviteCode ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{invitation.email}</TableCell>
                      <TableCell>{invitation.fullName || '-'}</TableCell>
                      <TableCell>{getRoleBadge(invitation.role)}</TableCell>
                      <TableCell>{getInvitationStatusBadge(invitation.status)}</TableCell>
                      <TableCell>{formatDate(invitation.expiresAt)}</TableCell>
                      <TableCell className="text-right">
                        {invitation.status === 'PENDING' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleRevokeInvitation(invitation.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Revoke Invitation
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={assignmentDialog} onOpenChange={setAssignmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Teacher Assignments</DialogTitle>
            <DialogDescription>Change the class and subjects assigned to {selectedTeacher?.name || 'this teacher'}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assignment-class">Class</Label>
              <select id="assignment-class" value={assignmentClassId} onChange={(event) => changeAssignmentClass(event.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2">
                <option value="">Select a class</option>
                {availableClasses.map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Subjects</Label>
              <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                {(subjectsByClass[assignmentClassId] || []).map(item => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={assignmentSubjectIds.includes(item.id)} onChange={(event) => setAssignmentSubjectIds(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />
                    {item.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignmentDialog(false)} disabled={savingAssignments}>Cancel</Button>
            <Button onClick={saveAssignments} disabled={savingAssignments || !assignmentClassId}>{savingAssignments ? 'Saving...' : 'Save Assignments'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Teacher</DialogTitle>
            <DialogDescription>
              Send an invitation to a teacher to join your school
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateInvitation} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address *</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teacher@example.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-name">Full Name</Label>
              <Input
                id="invite-name"
                placeholder="Teacher's full name"
                value={inviteForm.fullName}
                onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                value={inviteForm.role}
                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="TEACHER">Teacher</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Class and subject assignments</Label>
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border p-3">
                {availableClasses.map(item => {
                  const selected = Object.prototype.hasOwnProperty.call(inviteForm.assignmentsByClass, item.id)
                  const subjects = subjectsByClass[item.id] || []
                  return <section key={item.id} className="rounded border p-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input type="checkbox" checked={selected} onChange={event => setInviteForm(previous => {
                        const assignmentsByClass = { ...previous.assignmentsByClass }
                        if (event.target.checked) assignmentsByClass[item.id] = assignmentsByClass[item.id] || []
                        else delete assignmentsByClass[item.id]
                        return { ...previous, assignmentsByClass }
                      })} />
                      {item.fullName}
                    </label>
                    {selected && <div className="mt-2 grid grid-cols-1 gap-2 pl-6 sm:grid-cols-2">
                      {subjects.map(subject => <label key={subject.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={(inviteForm.assignmentsByClass[item.id] || []).includes(subject.id)} onChange={event => setInviteForm(previous => {
                          const current = previous.assignmentsByClass[item.id] || []
                          const next = event.target.checked ? [...current, subject.id] : current.filter(id => id !== subject.id)
                          return { ...previous, assignmentsByClass: { ...previous.assignmentsByClass, [item.id]: next } }
                        })} />
                        {subject.name}
                      </label>)}
                      {!subjects.length && <span className="text-xs text-muted-foreground">No subjects have been added to this class.</span>}
                    </div>}
                  </section>
                })}
              </div>
              <p className="text-xs text-muted-foreground">Each subject is linked to its selected class and becomes active as soon as the teacher accepts the invitation.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-expiry">Invitation Expires In</Label>
              <select
                id="invite-expiry"
                value={inviteForm.expiryDays}
                onChange={(e) => setInviteForm({ ...inviteForm, expiryDays: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>

            <Separator />

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900">How it works</p>
                  <p className="text-blue-700 mt-1">
                    After creating the invitation, share the invite code with the teacher. 
                    They can enter it during registration to join your school automatically.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteDialog(false)}
                disabled={inviting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting ? 'Creating...' : 'Create Invitation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
