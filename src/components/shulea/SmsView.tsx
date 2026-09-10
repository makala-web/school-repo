'use client'

import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, Send, Users, Loader2, AlertCircle, CheckCircle2, Download, Upload, History } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { apiCall } from '@/lib/utils'
import { normalizeTanzaniaPhoneNumber, SmsExcelBridge, SmsSender, type SmsMessagePreview } from '@/services/sms'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

interface ExamItem {
  id: string
  name: string
  term: string
  academicYear: string
  class?: { id: string; fullName: string; schoolType: string }
}

interface StudentItem {
  id: string
  fullName: string
  admissionNo?: string | null
  class?: { fullName: string }
  parentPhone: string | null
}

interface SmsHistoryItem {
  id: string
  recipient: string
  studentName: string
  message: string
  sentAt: string
  status: string
}


export default function SmsView() {
  const { currentSchool, schoolType } = useAppStore()
  const [exams, setExams] = useState<ExamItem[]>([])
  const [students, setStudents] = useState<StudentItem[]>([])
  const [selectedExam, setSelectedExam] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [preview, setPreview] = useState<SmsMessagePreview | null>(null)
  const [bulkPreviews, setBulkPreviews] = useState<SmsMessagePreview[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<SmsHistoryItem[]>([])
  const [historyStatus, setHistoryStatus] = useState('ALL')
  const [historyDate, setHistoryDate] = useState('')
  const [historyStudent, setHistoryStudent] = useState('')
  // Student search and fallback
  const [studentSearchQuery, setStudentSearchQuery] = useState('')
  const [allStudents, setAllStudents] = useState<StudentItem[]>([])
  // Platform detection
  const [isDesktop, setIsDesktop] = useState(false)

  const modeExams = useMemo(
    () => exams.filter(exam => !exam.class || exam.class.schoolType === schoolType),
    [exams, schoolType]
  )
  const readyBulk = bulkPreviews.filter(item => item.ready)
  const missingPhones = bulkPreviews.filter(item => !item.ready)
  const canOpenSmsComposer = !isDesktop || (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches)

  // Filtered students based on search
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return students
    const q = studentSearchQuery.toLowerCase().trim()
    return students.filter(s => 
      s.fullName.toLowerCase().includes(q) ||
      (s.admissionNo || '').toLowerCase().includes(q) ||
      (s.class?.fullName || '').toLowerCase().includes(q)
    )
  }, [students, studentSearchQuery])

  useEffect(() => {
    loadExams()
    loadAllStudents()
    loadHistory()
    // Detect platform
    setIsDesktop(typeof window !== 'undefined' && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
  }, [currentSchool])

  useEffect(() => {
    loadHistory()
  }, [historyStatus, historyDate, historyStudent])

  useEffect(() => {
    setPreview(null)
    setBulkPreviews([])
    setSelectedStudent('')
    loadStudentsForExam()
  }, [selectedExam])

  function normalizePreviewPhone(item: SmsMessagePreview): SmsMessagePreview {
    if (!item.phone?.trim()) {
      return { ...item, ready: false, reason: 'Parent phone number is missing' }
    }

    const normalized = normalizeTanzaniaPhoneNumber(item.phone)
    if (!normalized.valid) {
      return { ...item, ready: false, reason: normalized.error }
    }

    return {
      ...item,
      phone: normalized.phone!,
      ready: Boolean(item.message.trim()),
      reason: item.message.trim() ? undefined : 'SMS message is missing',
    }
  }

  function updatePreviewPhone(value: string) {
    if (!preview) return
    setPreview(normalizePreviewPhone({ ...preview, phone: value }))
  }

  function updateBulkPhone(studentId: string, value: string) {
    setBulkPreviews(prev => prev.map(item => (
      item.studentId === studentId ? normalizePreviewPhone({ ...item, phone: value }) : item
    )))
  }

  async function loadExams() {
    try {
      const data = await apiCall(`/api/shulea/exams?schoolId=${currentSchool?.id || ''}`)
      setExams(data.exams || [])
    } catch {
      toast.error('Failed to load exams')
    }
  }

  async function loadAllStudents() {
    try {
      const data = await apiCall(`/api/shulea/students?schoolId=${currentSchool?.id || ''}&status=ACTIVE`)
      setAllStudents(data.students || [])
    } catch {
      // Non-critical for initial load
    }
  }

  async function loadStudentsForExam() {
    const exam = exams.find(item => item.id === selectedExam)
    if (!exam?.class?.id) {
      // Fallback: use all active students
      setStudents(allStudents)
      return
    }

    try {
      const data = await apiCall(`/api/shulea/students?classId=${exam.class.id}&status=ACTIVE`)
      if (data.students && data.students.length > 0) {
        setStudents(data.students)
      } else {
        // Fallback: use all students if class-specific returns empty
        setStudents(allStudents)
      }
    } catch {
      // Fallback to all students on error
      setStudents(allStudents)
    }
  }

  async function prepareStudent() {
    if (!selectedExam || !selectedStudent) {
      toast.error('Select exam and student')
      return
    }

    setLoading(true)
    try {
      const data = await apiCall(`/api/shulea/sms?action=preview-student&examId=${selectedExam}&studentId=${selectedStudent}`)
      setPreview(data.preview)
      setBulkPreviews([])
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function saveHistory(item: SmsMessagePreview, status: 'SENT' | 'DELIVERED' | 'FAILED' | 'PENDING') {
    const exam = exams.find(examItem => examItem.id === selectedExam)
    try {
      await apiCall('/api/shulea/sms', {
        method: 'POST',
        body: JSON.stringify({
          recipient: item.phone,
          studentId: item.studentId,
          studentName: item.studentName,
          classId: exam?.class?.id || null,
          message: item.message,
          status,
        }),
      })
      loadHistory()
    } catch {
      // Do not block SMS sending if history persistence fails.
    }
  }

  async function loadHistory() {
    try {
      const params = new URLSearchParams({ action: 'history' })
      if (historyStatus !== 'ALL') params.set('status', historyStatus)
      if (historyDate) params.set('date', historyDate)
      if (historyStudent.trim()) params.set('student', historyStudent.trim())
      const data = await apiCall(`/api/shulea/sms?${params.toString()}`)
      setHistory(data.history || [])
    } catch {
      setHistory([])
    }
  }

  async function prepareBulk() {
    if (!selectedExam) {
      toast.error('Select exam')
      return
    }

    setLoading(true)
    try {
      const data = await apiCall(`/api/shulea/sms?action=preview-exam&examId=${selectedExam}`)
      setBulkPreviews(data.previews || [])
      setPreview(null)
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function sendOne() {
    if (!preview?.ready || !preview.phone) {
      toast.error(preview?.reason || 'Parent phone number is missing')
      return
    }

    if (!canOpenSmsComposer) {
      toast.error('SMS sending is available on phone PWA/APK. On desktop, export Excel or open this app on a phone.')
      return
    }

    setSending(true)
    try {
      const normalizedPreview = normalizePreviewPhone(preview)
      if (!normalizedPreview.ready || !normalizedPreview.phone) {
        throw new Error(normalizedPreview.reason || 'Invalid phone number')
      }
      await SmsSender.send(normalizedPreview.phone, normalizedPreview.message)
      setPreview(normalizedPreview)
      await saveHistory(normalizedPreview, 'SENT')
      toast.success('SMS sent successfully')
    } catch (error) {
      await saveHistory(preview, 'FAILED')
      toast.error(error instanceof Error ? error.message : 'SMS failed to send. Please check the phone number and try again.')
    } finally {
      setSending(false)
    }
  }

  async function sendBulk() {
    if (readyBulk.length === 0) {
      toast.error('No students with parent phone numbers')
      return
    }

    if (!canOpenSmsComposer) {
      toast.error('SMS sending is available on phone PWA/APK. On desktop, export Excel or open this app on a phone.')
      return
    }

    setSending(true)
    try {
      const normalizedReady = readyBulk.map(normalizePreviewPhone).filter(item => item.ready && item.phone)
      setBulkPreviews(prev => prev.map(item => normalizePreviewPhone(item)))
      const result = await SmsSender.sendMany(normalizedReady.map(item => ({ phone: item.phone!, message: item.message })))
      
      // Update history for successfully sent messages (change PENDING to SENT)
      const exam = exams.find(examItem => examItem.id === selectedExam)
      for (let i = 0; i < result.sent; i++) {
        await apiCall('/api/shulea/sms', {
          method: 'POST',
          body: JSON.stringify({
            recipient: normalizedReady[i].phone,
            studentId: normalizedReady[i].studentId,
            studentName: normalizedReady[i].studentName,
            classId: exam?.class?.id || null,
            message: normalizedReady[i].message,
            status: 'SENT',
          }),
        })
      }
      loadHistory()
      
      if (result.errors.length > 0) {
        toast.warning(`${result.sent} SMS sent, ${result.errors.length} failed. Some phone numbers may be invalid.`)
      } else {
        toast.success(`${result.sent} SMS sent successfully`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Some SMS failed to send. Please check phone numbers and try again.')
    } finally {
      setSending(false)
    }
  }


  async function exportCurrentToExcel() {
    const items = preview ? [preview] : bulkPreviews
    if (items.length === 0) {
      toast.error('Prepare SMS data first')
      return
    }

    try {
      const exam = exams.find(item => item.id === selectedExam)
      await SmsExcelBridge.export(items, `sms_${exam?.name || 'results'}_${exam?.class?.fullName || ''}`)
      toast.success('SMS Excel exported')
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  async function importSmsExcel(file: File | undefined) {
    if (!file) return
    setLoading(true)
    try {
      const previews = await SmsExcelBridge.import(file)
      setBulkPreviews(previews)
      setPreview(null)
      
      // Save imported items to history as PENDING
      const exam = exams.find(item => item.id === selectedExam)
      for (const item of previews) {
        await apiCall('/api/shulea/sms', {
          method: 'POST',
          body: JSON.stringify({
            recipient: item.phone,
            studentId: item.studentId,
            studentName: item.studentName,
            classId: exam?.class?.id || null,
            message: item.message,
            status: 'PENDING',
          }),
        })
      }
      loadHistory()
      
      toast.success(`${previews.length} SMS rows imported from Excel and saved as PENDING. Click send to deliver messages.`)
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">SMS Results</h2>
        <p className="text-sm text-muted-foreground">Send examination results to parents using saved phone numbers</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Examination</Label>
              <Select value={selectedExam} onValueChange={setSelectedExam}>
                <SelectTrigger>
                  <SelectValue placeholder="Select exam" />
                </SelectTrigger>
                <SelectContent>
                  {modeExams.map(exam => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.name} - {exam.class?.fullName || ''} ({exam.term})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Student</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={!selectedExam}>
                <SelectTrigger>
                  <SelectValue placeholder={students.length > 0 ? `Select student (${students.length})` : 'No students available'} />
                </SelectTrigger>
                <SelectContent className="max-h-[250px]">
                  <div className="sticky top-0 bg-white z-10 px-2 py-1.5 border-b">
                    <Input
                      placeholder="Search by name, admission no, or class..."
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  {filteredStudents.length === 0 ? (
                    <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                      {students.length === 0 ? 'No students found in this class' : 'No students match your search'}
                    </div>
                  ) : (
                    filteredStudents.map(student => (
                      <SelectItem key={student.id} value={student.id} className="text-xs sm:text-sm">
                        <div className="flex flex-col">
                          <span>{student.fullName}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {student.admissionNo && `${student.admissionNo} · `}{student.class?.fullName || ''}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {students.length === 0 && selectedExam && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  No students found for this exam's class. Make sure students are registered.
                </p>
              )}
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={prepareStudent} disabled={loading || !selectedExam || !selectedStudent} className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                Preview One
              </Button>
              <Button onClick={prepareBulk} disabled={loading || !selectedExam} variant="outline" className="flex-1 gap-2">
                <Users className="w-4 h-4" />
                Preview All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import/Export SMS Data</CardTitle>
          <CardDescription>Export SMS data, import saved rows, or send directly from a phone PWA/APK</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" onClick={exportCurrentToExcel} className="gap-2">
              <Download className="w-4 h-4" />
              Export SMS Excel
            </Button>
            <div>
              <Input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                id="sms-excel-import"
                onChange={(event) => importSmsExcel(event.target.files?.[0])}
              />
              <Button variant="outline" className="w-full gap-2" onClick={() => document.getElementById('sms-excel-import')?.click()}>
                <Upload className="w-4 h-4" />
                Import SMS Excel
              </Button>
            </div>
          </div>
          {isDesktop && (
            <p className="text-xs text-muted-foreground">
              Desktop can export/import SMS data. To send directly, open the installed PWA on a phone.
            </p>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              {preview.studentName}
            </CardTitle>
            <CardDescription>
              {preview.phone ? `Parent phone: ${preview.phone}` : preview.reason}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number (editable)</Label>
              <Input
                value={preview.phone || ''}
                onChange={(e) => updatePreviewPhone(e.target.value)}
                placeholder="0623424892 or 623424892"
                className="font-mono"
              />
              {preview.reason && !preview.ready && (
                <p className="text-xs text-red-600">{preview.reason}</p>
              )}
            </div>
            <Textarea value={preview.message} readOnly className="min-h-[280px] font-mono text-xs" />
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={sendOne} disabled={sending || !preview.ready} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send SMS
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {bulkPreviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              Bulk SMS Preview
            </CardTitle>
            <CardDescription>
              {readyBulk.length} ready, {missingPhones.length} missing phone numbers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-auto">
              {bulkPreviews.map(item => (
                <div key={item.studentId} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{item.studentName}</p>
                    <Badge variant="outline" className={item.ready ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-amber-700 border-amber-200 bg-amber-50'}>
                      {item.ready ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                      {item.ready ? 'Ready' : 'Missing'}
                    </Badge>
                  </div>
                  <Input
                    type="text"
                    value={item.phone || ''}
                    onChange={(e) => updateBulkPhone(item.studentId, e.target.value)}
                    placeholder="0623424892 or 623424892"
                    className="text-xs font-mono"
                  />
                  {item.reason && !item.ready && (
                    <p className="text-xs text-red-600">{item.reason}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={sendBulk} disabled={sending || readyBulk.length === 0} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send SMS to All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-600" />
            SMS History
          </CardTitle>
          <CardDescription>Review recipients, previews and delivery status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} />
            <Input
              placeholder="Search student"
              value={historyStudent}
              onChange={(event) => setHistoryStudent(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') loadHistory()
              }}
            />
            <Select value={historyStatus} onValueChange={setHistoryStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadHistory}>Filter</Button>
          </div>
          <div className="max-h-80 overflow-auto rounded-md border">
            {history.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No SMS history yet</div>
            ) : history.map(item => (
              <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_110px] gap-2 border-b p-3 last:border-b-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{item.studentName}</p>
                    <span className="text-xs text-muted-foreground">{item.recipient}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(item.sentAt).toLocaleString()}</p>
                <Badge variant="outline" className={
                  item.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  item.status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' :
                  item.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-blue-50 text-blue-700 border-blue-200'
                }>
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
