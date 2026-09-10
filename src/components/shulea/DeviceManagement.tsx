'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiCall } from '@/lib/utils'
import { toast } from 'sonner'
import { Monitor, Smartphone, Laptop, MoreVertical, Trash2, RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

interface Device {
  id: string
  deviceId: string
  deviceName: string
  platform: string
  status: string
  activatedAt: string
  lastSeenAt: string
  user: {
    id: string
    fullName: string
    email: string
  }
}

interface DeviceStats {
  totalDevices: number
  activeDevices: number
  maxDevices: number
  utilization: number
}

export default function DeviceManagement() {
  const { currentSchool, currentUser } = useAppStore()
  const [devices, setDevices] = useState<Device[]>([])
  const [stats, setStats] = useState<DeviceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [revokeDialog, setRevokeDialog] = useState<{ open: boolean; device: Device | null }>({ open: false, device: null })
  const [revoking, setRevoking] = useState(false)

  useEffect(() => {
    loadDevices()
  }, [currentSchool?.id, currentUser?.id])

  async function loadDevices() {
    if (!currentSchool?.id || !currentUser?.id) return

    setLoading(true)
    try {
      const data = await apiCall(`/api/shulea/devices?schoolId=${currentSchool.id}&userId=${currentUser.id}`)
      setDevices(data.devices || [])
      
      // Calculate stats
      const totalDevices = data.devices.length
      const activeDevices = data.devices.filter((d: Device) => d.status === 'ACTIVE').length
      const maxDevices = currentSchool.maxDevices || 20
      
      setStats({
        totalDevices,
        activeDevices,
        maxDevices,
        utilization: (activeDevices / maxDevices) * 100
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load devices')
    } finally {
      setLoading(false)
    }
  }

  function getPlatformIcon(platform: string) {
    switch (platform.toLowerCase()) {
      case 'windows':
        return <Monitor className="w-4 h-4" />
      case 'android':
        return <Smartphone className="w-4 h-4" />
      case 'ios':
        return <Smartphone className="w-4 h-4" />
      case 'macos':
      case 'linux':
        return <Laptop className="w-4 h-4" />
      default:
        return <Monitor className="w-4 h-4" />
    }
  }

  function getStatusBadge(status: string) {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Active</Badge>
      case 'REVOKED':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Revoked</Badge>
      case 'SUSPENDED':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Suspended</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-TZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getTimeAgo(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  async function handleRevokeDevice() {
    if (!revokeDialog.device) return

    setRevoking(true)
    try {
      await apiCall(`/api/shulea/devices?deviceId=${revokeDialog.device.deviceId}&actorUserId=${currentUser?.id}`, {
        method: 'DELETE'
      })
      toast.success('Device revoked successfully')
      setRevokeDialog({ open: false, device: null })
      loadDevices()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke device')
    } finally {
      setRevoking(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-8 bg-gray-200 rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Devices</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.activeDevices || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Monitor className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Device Limit</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.maxDevices || 20}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Monitor className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Utilization</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.utilization.toFixed(0) || 0}%</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Monitor className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Device Limit Warning */}
      {stats && stats.activeDevices >= stats.maxDevices && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">Device Limit Reached</p>
                <p className="text-sm text-amber-700">
                  Your school has reached the maximum number of authorized devices. Revoke unused devices to authorize new ones.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Devices Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Authorized Devices</CardTitle>
              <CardDescription>
                Manage devices authorized to access your school
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadDevices}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="text-center py-8">
              <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No devices authorized yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Devices will be automatically authorized when users log in
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>Activated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(device.platform)}
                          <div>
                            <p className="font-medium">{device.deviceName}</p>
                            <p className="text-xs text-gray-500 font-mono">{device.deviceId.slice(0, 12)}...</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{device.user.fullName}</p>
                          <p className="text-xs text-gray-500">{device.user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {device.platform}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(device.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Clock className="w-3 h-3" />
                          {getTimeAgo(device.lastSeenAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(device.activatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {device.status === 'ACTIVE' && (
                              <DropdownMenuItem
                                onClick={() => setRevokeDialog({ open: true, device })}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Revoke Device
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={revokeDialog.open} onOpenChange={(open) => setRevokeDialog({ open, device: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Device Authorization</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke authorization for this device? The user will need to re-authorize their device to continue accessing the system.
            </DialogDescription>
          </DialogHeader>
          {revokeDialog.device && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-gray-600" />
                <span className="font-medium">{revokeDialog.device.deviceName}</span>
              </div>
              <div className="text-sm text-gray-600">
                <p>User: {revokeDialog.device.user.fullName}</p>
                <p>Email: {revokeDialog.device.user.email}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeDialog({ open: false, device: null })}
              disabled={revoking}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeDevice}
              disabled={revoking}
            >
              {revoking ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              Revoke Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}