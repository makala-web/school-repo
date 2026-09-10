'use client'

import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { apiCall } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Loader2, Download, Upload, Database, AlertTriangle, CheckCircle2,
  HardDrive, Clock, Settings2, Trash2, Printer, Smartphone,
  School, Users, BookOpen, FileText,
  ClipboardCheck, User, GraduationCap, Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StorageMonitor, AutoBackup, type BackupInfo, type BackupConfig } from '@/services/device'

interface BackupStats {
  schools: number
  classes: number
  students: number
  subjects: number
  exams: number
  marksEntries: number
  studentResults: number
  users: number
  tabia: number
  gradingConfigs: number
}

export default function BackupView() {
  const { currentSchool, schoolType } = useAppStore()
  const [stats, setStats] = useState<BackupStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [pendingRestoreData, setPendingRestoreData] = useState<unknown>(null)
  const [importResults, setImportResults] = useState<Record<string, number> | null>(null)
  const [resultDialogOpen, setResultDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Storage Monitor State
  const [storageInfo, setStorageInfo] = useState<{
    total: string
    used: string
    free: string
    percentUsed: number
    isHealthy: boolean
  } | null>(null)
  const [checkingStorage, setCheckingStorage] = useState(false)
  
  // Auto-Backup State
  const [backupConfig, setBackupConfig] = useState<BackupConfig>({
    enabled: true,
    intervalDays: 7,
    keepCount: 5,
    includeReports: true,
    autoShare: false
  })
  const [backupHistory, setBackupHistory] = useState<BackupInfo[]>([])
  const [configLoading, setConfigLoading] = useState(false)
  const [nextBackupTime, setNextBackupTime] = useState<Date | null>(null)
  
  // UI State
  const [activeTab, setActiveTab] = useState<'overview' | 'auto' | 'history'>('overview')

  useEffect(() => {
    loadStats()
    loadStorageInfo()
    loadBackupConfig()
    loadBackupHistory()
  }, [currentSchool])

  // Load storage information
  async function loadStorageInfo() {
    setCheckingStorage(true)
    try {
      const info = await StorageMonitor.getFormattedStorageInfo()
      setStorageInfo(info)
    } catch (error) {
      console.error('Failed to load storage info:', error)
    } finally {
      setCheckingStorage(false)
    }
  }

  // Load backup configuration
  async function loadBackupConfig() {
    try {
      const config = await AutoBackup.getConfig()
      setBackupConfig(config)
      const nextTime = await AutoBackup.getNextBackupTime()
      setNextBackupTime(nextTime)
    } catch (error) {
      console.error('Failed to load backup config:', error)
    }
  }

  // Load backup history
  async function loadBackupHistory() {
    try {
      const history = await AutoBackup.getBackupHistory()
      setBackupHistory(history)
    } catch (error) {
      console.error('Failed to load backup history:', error)
    }
  }

  // Handle auto-backup config change
  async function handleConfigChange(updates: Partial<BackupConfig>) {
    setConfigLoading(true)
    try {
      const newConfig = { ...backupConfig, ...updates }
      await AutoBackup.saveConfig(newConfig)
      setBackupConfig(newConfig)
      toast.success('Backup settings saved')
      
      // Update next backup time
      const nextTime = await AutoBackup.getNextBackupTime()
      setNextBackupTime(nextTime)
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setConfigLoading(false)
    }
  }

  // Create backup using new service
  async function handleCreateBackup() {
    setExporting(true)
    try {
      const result = await AutoBackup.createBackup('manual', 'User created backup')
      if (result.success) {
        await loadBackupHistory()
      } else {
        toast.error(result.error || 'Backup failed')
      }
    } catch (error) {
      toast.error('Failed to create backup')
    } finally {
      setExporting(false)
    }
  }

  async function loadStats() {
    setLoading(true)
    try {
      if (!currentSchool?.id) {
        setStats(null)
        return
      }
      const schoolIdParam = `&schoolId=${encodeURIComponent(currentSchool.id)}`
      const schoolTypeParam = schoolType ? `&schoolType=${schoolType}` : ''
      const data = await apiCall(`/api/shulea/backup?action=stats${schoolIdParam}${schoolTypeParam}`)
      setStats(data.stats || null)
    } catch {
      toast.error('Failed to load database stats')
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      if (!currentSchool?.id) {
        throw new Error('Please set up or select a school before creating a backup')
      }
      const data = await apiCall(`/api/shulea/backup?schoolId=${encodeURIComponent(currentSchool.id)}&schoolType=${schoolType}`)
      const backup = data.backup
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shulea-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Backup downloaded successfully')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to export backup')
    } finally {
      setExporting(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        if (!data.exportedAt && !data.schools) {
          toast.error('Invalid backup file format')
          return
        }
        setPendingRestoreData(data)
        setRestoreDialogOpen(true)
      } catch {
        toast.error('Failed to parse backup file. Make sure it is a valid JSON file.')
      }
    }
    reader.readAsText(file)
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleRestore() {
    if (!pendingRestoreData) return
    setImporting(true)
    try {
      const result = await apiCall('/api/shulea/backup', {
        method: 'POST',
        body: JSON.stringify({ backup: pendingRestoreData, schoolId: currentSchool?.id, schoolType }),
      })
      setImportResults(result.importResults || null)
      setResultDialogOpen(true)
      toast.success(result.message || 'Backup restored successfully')
      loadStats()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to restore backup')
    } finally {
      setImporting(false)
      setRestoreDialogOpen(false)
      setPendingRestoreData(null)
    }
  }

  const statEntries = stats ? [
    { label: 'Schools', value: stats.schools ?? 0, icon: <School className="w-full h-full" /> },
    { label: 'Classes', value: stats.classes ?? 0, icon: <BookOpen className="w-full h-full" /> },
    { label: 'Students', value: stats.students ?? 0, icon: <Users className="w-full h-full" /> },
    { label: 'Subjects', value: stats.subjects ?? 0, icon: <FileText className="w-full h-full" /> },
    { label: 'Exams', value: stats.exams ?? 0, icon: <ClipboardCheck className="w-full h-full" /> },
    { label: 'Marks Entries', value: stats.marksEntries ?? 0, icon: <FileText className="w-full h-full" /> },
    { label: 'Results', value: stats.studentResults ?? 0, icon: <GraduationCap className="w-full h-full" /> },
    { label: 'Tabia Records', value: stats.tabia ?? 0, icon: <User className="w-full h-full" /> },
    { label: 'Users', value: stats.users ?? 0, icon: <User className="w-full h-full" /> },
    { label: 'Grading Configs', value: stats.gradingConfigs ?? 0, icon: <Settings className="w-full h-full" /> },
  ] : []

  const totalRecords = stats ? Object.values(stats).reduce((sum, v) => sum + (Number(v) || 0), 0) : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Backup & Restore</h2>
        <p className="text-sm text-muted-foreground">Export and import your school data</p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="w-5 h-5 text-emerald-600" />
              Create Backup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Download a complete backup of all your school data as a JSON file. This includes students, marks, tabia, and all other records.
            </p>
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2 w-full"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? 'Exporting...' : 'Download Backup'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="w-5 h-5 text-amber-600" />
              Restore Backup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload a previously exported JSON backup file to restore all data. <span className="text-red-600 font-medium">This will overwrite existing data.</span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-2 w-full"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Restoring...' : 'Upload & Restore'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Database Statistics */}
      <Card className="border-emerald-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
          <CardTitle className="flex items-center gap-2 text-lg text-emerald-800">
            <Database className="w-6 h-6 text-emerald-600" />
            Database Statistics
            {totalRecords > 0 && (
              <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 ml-2">
                {totalRecords} total records
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {statEntries.map((entry) => (
                <div key={entry.label} className="group relative overflow-hidden rounded-xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-5 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-100/50 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="relative flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-2xl text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                      {entry.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-2xl font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">{entry.value}</p>
                      <p className="text-sm font-medium text-gray-600 group-hover:text-emerald-600 transition-colors">{entry.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-muted-foreground">Failed to load statistics</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Warning Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Restore Backup
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite your existing data with the backup file data. This action cannot be undone. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRestoreDialogOpen(false); setPendingRestoreData(null) }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} className="bg-amber-600 hover:bg-amber-700">
              Yes, Restore Backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Results Dialog */}
      <AlertDialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Restore Complete
            </AlertDialogTitle>
            <AlertDialogDescription>
              The backup has been restored. Here are the imported record counts:
            </AlertDialogDescription>
          </AlertDialogHeader>
          {importResults && (
            <div className="max-h-60 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead className="text-right">Records Imported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(importResults).map(([key, count]) => (
                    <TableRow key={key}>
                      <TableCell className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</TableCell>
                      <TableCell className="text-right font-medium">{count as number}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setResultDialogOpen(false)} className="bg-emerald-600 hover:bg-emerald-700">
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
