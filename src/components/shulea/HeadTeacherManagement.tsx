'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiCall } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, UserCog, X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface TeacherOption {
  id: string
  name: string
  shortName?: string | null
  sign?: string | null
}

export default function HeadTeacherManagement() {
  const { currentSchool, currentUser } = useAppStore()
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [currentHeadTeacherId, setCurrentHeadTeacherId] = useState<string | null>(null)
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentSchool?.id && currentUser?.id) {
      void loadData()
    }
  }, [currentSchool?.id, currentUser?.id])

  async function loadData() {
    setLoading(true)
    try {
      const [teachersData, leadershipData] = await Promise.all([
        apiCall(`/api/shulea/teachers?schoolId=${currentSchool?.id}`),
        apiCall(`/api/shulea/school-leadership?schoolId=${currentSchool?.id}&actorUserId=${currentUser?.id}`)
      ])

      const teacherList = (teachersData.teachers || []).map((teacher: any) => ({
        id: teacher.id,
        name: teacher.name,
        shortName: teacher.shortName,
        sign: teacher.sign,
      }))

      setTeachers(teacherList)
      setCurrentHeadTeacherId(leadershipData.currentHeadTeacherId || null)
      setSelectedTeacherId(leadershipData.currentHeadTeacherId || '')
    } catch (error) {
      console.error('Failed to load head teacher data', error)
      toast.error('Failed to load head teacher data')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!currentSchool?.id || !currentUser?.id) return
    if (!selectedTeacherId) {
      toast.error('Please select a teacher to assign as head teacher')
      return
    }

    setSaving(true)
    try {
      await apiCall('/api/shulea/school-leadership', {
        method: 'POST',
        body: JSON.stringify({
          action: 'assign',
          actorUserId: currentUser.id,
          schoolId: currentSchool.id,
          teacherId: selectedTeacherId,
        })
      })

      toast.success('Head teacher assigned successfully')
      setCurrentHeadTeacherId(selectedTeacherId)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign head teacher')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    if (!currentSchool?.id || !currentUser?.id) return

    setSaving(true)
    try {
      await apiCall('/api/shulea/school-leadership', {
        method: 'POST',
        body: JSON.stringify({
          action: 'clear',
          actorUserId: currentUser.id,
          schoolId: currentSchool.id,
        })
      })

      toast.success('Head teacher assignment cleared')
      setSelectedTeacherId('')
      setCurrentHeadTeacherId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to clear head teacher')
    } finally {
      setSaving(false)
    }
  }

  const currentTeacher = teachers.find((teacher) => teacher.id === currentHeadTeacherId)

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm text-slate-600">Loading head teacher assignment...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Head Teacher Assignment
            </CardTitle>
            <CardDescription>Set a single active head teacher for this school.</CardDescription>
          </div>
          {currentTeacher && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Active head teacher
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Only one head teacher can be active per school. This assignment also updates the school report card defaults.
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Select head teacher</label>
          <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose teacher" />
            </SelectTrigger>
            <SelectContent>
              {teachers.map((teacher) => (
                <SelectItem key={teacher.id} value={teacher.id}>
                  {teacher.name}{teacher.shortName ? ` (${teacher.shortName})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {currentTeacher && (
          <div className="rounded-md border bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-800">Current head teacher</p>
            <p className="mt-1 text-slate-600">{currentTeacher.name}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving || !selectedTeacherId} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCog className="mr-2 h-4 w-4" />}
            Save head teacher
          </Button>
          <Button variant="outline" onClick={handleClear} disabled={saving || !currentHeadTeacherId} className="border-red-200 text-red-700 hover:bg-red-50">
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
