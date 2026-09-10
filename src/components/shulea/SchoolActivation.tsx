'use client'

import { useState } from 'react'
import { apiCall } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2, Key, CheckCircle2, AlertCircle, School, Calendar, Users, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface SchoolData {
  id: string
  name: string
  schoolType: string
  licenseType?: string
  licenseStatus?: string
  activationCode?: string
  expiryDate?: string
  maxDevices?: number
  maxTeachers?: number
}

interface ActivationStatus {
  isActivated: boolean
  school: SchoolData | null
  currentDevices: number
  currentTeachers: number
}

export default function SchoolActivation({ onActivationComplete, onCancel }: { 
  onActivationComplete: (school: SchoolData) => void
  onCancel: () => void 
}) {
  const [activationCode, setActivationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [activationStatus, setActivationStatus] = useState<ActivationStatus | null>(null)
  const [error, setError] = useState('')

  async function checkActivationStatus() {
    // This would typically check the current school's activation status
    // For now, we'll assume we need to activate
    setCheckingStatus(true)
    try {
      // You would pass the actual school ID here
      const data = await apiCall('/api/shulea/activation?action=check-status&schoolId=demo-school')
      setActivationStatus(data.school)
    } catch (err) {
      // If checking fails, we'll show the activation form
      setActivationStatus({
        isActivated: false,
        school: null,
        currentDevices: 0,
        currentTeachers: 0
      })
    } finally {
      setCheckingStatus(false)
    }
  }

  async function handleActivation(e: React.FormEvent) {
    e.preventDefault()
    if (!activationCode.trim()) {
      toast.error('Please enter an activation code')
      return
    }

    setLoading(true)
    setError('')
    try {
      const data = await apiCall('/api/shulea/activation', {
        method: 'POST',
        body: JSON.stringify({
          action: 'activate-school',
          schoolId: 'demo-school', // This would be the actual school ID
          activationCode: activationCode.trim(),
        }),
      })

      toast.success('School activated successfully!')
      onActivationComplete(data.school)
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Activation failed'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-2xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4">
              <Key className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-emerald-800">School Activation</CardTitle>
            <CardDescription>
              Enter your activation code to unlock full features
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activationStatus?.isActivated ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">School Already Activated</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Your school is already activated with a valid license.
                </p>
                <Button onClick={() => onActivationComplete(activationStatus.school!)} className="w-full">
                  Continue to Dashboard
                </Button>
              </div>
            ) : (
              <form onSubmit={handleActivation} className="space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="activation-code">Activation Code</Label>
                  <Input
                    id="activation-code"
                    type="text"
                    placeholder="e.g. SHL-12345"
                    value={activationCode}
                    onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                    className="text-center text-lg tracking-wider font-mono"
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the activation code provided by Shulea Administrator
                  </p>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Monitor className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Device Authorization</p>
                      <p className="text-xs text-gray-600">Your device will be automatically authorized</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Teacher Management</p>
                      <p className="text-xs text-gray-600">Invite and manage teachers securely</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">License Validity</p>
                      <p className="text-xs text-gray-600">Full access until license expiry</p>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Activate School
                </Button>

                <div className="text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Continue with Demo Mode
                  </Button>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-center text-xs text-gray-500 mb-2">
                    Need an activation code?
                  </p>
                  <p className="text-center text-sm text-emerald-700 font-medium">
                    Contact: 0623424892 / 0658819275
                  </p>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}