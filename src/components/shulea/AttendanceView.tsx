'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, CalendarDays, Check, Loader2, Save, Users, X } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { apiCall } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Status = 'PRESENT' | 'ABSENT' | 'SICK' | 'PERMISSION'
type ClassItem = { id: string; name: string; fullName: string; studentCount?: number }
type StudentAttendance = { id: string; fullName: string; admissionNo?: string | null; gender?: string; status: Status | null }
type AttendanceReportRow = { id: string; fullName: string; admissionNo?: string | null; totalDays: number; recordedDays: number; present: number; absent: number; sick: number; permission: number; unmarked: number }

const STATUS_OPTIONS: Array<{ value: Status; label: string; className: string }> = [
  { value: 'PRESENT', label: 'Present', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'ABSENT', label: 'Absent', className: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'SICK', label: 'Sick', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'PERMISSION', label: 'Permission', className: 'bg-blue-100 text-blue-800 border-blue-200' },
]

export default function AttendanceView() {
  const { currentSchool, currentUser } = useAppStore()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [students, setStudents] = useState<StudentAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reportMode, setReportMode] = useState<'month' | 'range'>('month')
  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [reportFrom, setReportFrom] = useState(() => `${new Date().toISOString().slice(0, 7)}-01`)
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [reportRows, setReportRows] = useState<AttendanceReportRow[]>([])
  const [reportRange, setReportRange] = useState({ fromDate: '', toDate: '' })
  const [reportLoading, setReportLoading] = useState(false)
  const [showReport, setShowReport] = useState(false)

  useEffect(() => {
    if (!currentSchool?.id) return
    setLoading(true)
    apiCall(`/api/shulea/classes?schoolId=${encodeURIComponent(currentSchool.id)}`)
      .then(data => {
        const nextClasses = (data.classes || []) as ClassItem[]
        setClasses(nextClasses)
        setSelectedClass(previous => previous && nextClasses.some(item => item.id === previous) ? previous : nextClasses[0]?.id || '')
      })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Failed to load classes'))
      .finally(() => setLoading(false))
  }, [currentSchool?.id, currentUser?.id])

  useEffect(() => {
    if (!selectedClass || !date) return
    setLoading(true)
    apiCall(`/api/shulea/attendance?classId=${encodeURIComponent(selectedClass)}&date=${encodeURIComponent(date)}`)
      .then(data => setStudents((data.students || []) as StudentAttendance[]))
      .catch(error => toast.error(error instanceof Error ? error.message : 'Failed to load attendance'))
      .finally(() => setLoading(false))
  }, [selectedClass, date])

  const summary = useMemo(() => students.reduce((result, student) => {
    if (student.status) result[student.status] += 1
    return result
  }, { PRESENT: 0, ABSENT: 0, SICK: 0, PERMISSION: 0 }), [students])

  function setAll(status: Status) {
    setStudents(current => current.map(student => ({ ...student, status })))
  }

  async function saveAttendance() {
    if (!selectedClass || students.length === 0) return
    const incomplete = students.filter(student => !student.status)
    if (incomplete.length > 0) {
      toast.error(`Mark attendance for all ${incomplete.length} remaining student(s)`)
      return
    }
    setSaving(true)
    try {
      await apiCall('/api/shulea/attendance', {
        method: 'POST',
        body: JSON.stringify({ classId: selectedClass, date, records: students.map(student => ({ studentId: student.id, status: student.status })) }),
      })
      toast.success('Attendance saved successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  function getReportDates() {
    if (reportMode === 'range') return { fromDate: reportFrom, toDate: reportTo }
    const [year, month] = reportMonth.split('-').map(Number)
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    return { fromDate: `${reportMonth}-01`, toDate: `${reportMonth}-${String(lastDay).padStart(2, '0')}` }
  }

  async function loadAttendanceReport() {
    if (!selectedClass) return
    const { fromDate, toDate } = getReportDates()
    if (!fromDate || !toDate || fromDate > toDate) {
      toast.error('Select a valid attendance date range')
      return
    }
    setReportLoading(true)
    try {
      const data = await apiCall(`/api/shulea/attendance?action=report&classId=${encodeURIComponent(selectedClass)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`)
      setReportRows((data.students || []) as AttendanceReportRow[])
      setReportRange({ fromDate, toDate })
    } catch (error) {
      setReportRows([])
      toast.error(error instanceof Error ? error.message : 'Failed to load attendance report')
    } finally {
      setReportLoading(false)
    }
  }

  if (!currentSchool?.id) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Select a school before recording attendance.</CardContent></Card>

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold"><CalendarCheck className="h-5 w-5 text-emerald-600" />Attendance</h2>
          <p className="text-sm text-muted-foreground">Record student attendance for each authorized class.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="link" onClick={() => setShowReport(true)} disabled={!selectedClass} className="text-emerald-700">View attendance report</Button>
          <Button onClick={saveAttendance} disabled={saving || loading || students.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Attendance
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_180px_auto] md:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Class</label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map(item => <SelectItem key={item.id} value={item.id}>{item.fullName || item.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Date</label>
            <input type="date" value={date} onChange={event => setDate(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setAll('PRESENT')}><Check className="mr-2 h-4 w-4" />All present</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-6xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-emerald-600" />Attendance report</DialogTitle>
            <DialogDescription>Filter attendance by month or date range and review totals for every student.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[75vh] overflow-y-auto px-6 pb-6 pt-4">
          <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[180px_1fr_1fr_auto] md:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Report period</label>
              <Select value={reportMode} onValueChange={value => setReportMode(value as 'month' | 'range')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="range">From date to date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {reportMode === 'month' ? <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Month</label>
              <input type="month" value={reportMonth} onChange={event => setReportMonth(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div> : <>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">From date</label>
                <input type="date" value={reportFrom} onChange={event => setReportFrom(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">To date</label>
                <input type="date" value={reportTo} onChange={event => setReportTo(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
              </div>
            </>}
            <Button type="button" onClick={loadAttendanceReport} disabled={reportLoading || !selectedClass} className="bg-emerald-600 hover:bg-emerald-700">
              {reportLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}
              Get report
            </Button>
          </div>

          {reportRows.length > 0 && <div className="overflow-x-auto rounded-md border">
            <div className="border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">Period: {reportRange.fromDate} to {reportRange.toDate}</div>
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Days</th><th className="px-3 py-2">Present</th><th className="px-3 py-2">Absent</th><th className="px-3 py-2">Sick</th><th className="px-3 py-2">Permission</th><th className="px-3 py-2">Not marked</th></tr>
              </thead>
              <tbody className="divide-y">
                {reportRows.map(row => <tr key={row.id}>
                  <td className="px-3 py-2"><div className="font-medium">{row.fullName}</div><div className="text-xs text-muted-foreground">{row.admissionNo || 'No admission number'}</div></td>
                  <td className="px-3 py-2">{row.totalDays}</td><td className="px-3 py-2 font-medium text-emerald-700">{row.present}</td><td className="px-3 py-2 text-red-700">{row.absent}</td><td className="px-3 py-2 text-amber-700">{row.sick}</td><td className="px-3 py-2 text-blue-700">{row.permission}</td><td className="px-3 py-2 text-muted-foreground">{row.unmarked}</td>
                </tr>)}
              </tbody>
            </table>
          </div>}
          {!reportLoading && reportRange.fromDate && reportRows.length === 0 && <p className="text-sm text-muted-foreground">No attendance report data found for this period.</p>}
          </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STATUS_OPTIONS.map(option => <Badge key={option.value} variant="outline" className={`justify-center py-2 ${option.className}`}>{option.label}: {summary[option.value]}</Badge>)}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />{students.length} student(s)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="flex items-center justify-center p-10 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading attendance...</div> : students.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">No active students found for this class.</div> : <div className="divide-y">
            {students.map((student, index) => <div key={student.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3"><span className="w-6 text-xs text-muted-foreground">{index + 1}</span><div><p className="font-medium">{student.fullName}</p><p className="text-xs text-muted-foreground">{student.admissionNo || 'No admission number'}</p></div></div>
              <div className="grid grid-cols-2 gap-2 sm:flex">{STATUS_OPTIONS.map(option => <Button key={option.value} type="button" size="sm" variant={student.status === option.value ? 'default' : 'outline'} onClick={() => setStudents(current => current.map(item => item.id === student.id ? { ...item, status: option.value } : item))} className={student.status === option.value ? option.className : ''}>{option.value === 'PRESENT' ? <Check className="mr-1 h-3.5 w-3.5" /> : option.value === 'ABSENT' ? <X className="mr-1 h-3.5 w-3.5" /> : null}{option.label}</Button>)}</div>
            </div>)}
          </div>}
        </CardContent>
      </Card>
    </div>
  )
}
