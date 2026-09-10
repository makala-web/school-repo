'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiCall } from '@/lib/utils'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface RequestAccessFormProps {
  onSuccess?: () => void
}

export default function RequestAccessForm({ onSuccess }: RequestAccessFormProps) {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    schoolName: '',
    schoolType: 'PRIMARY',
    contactPerson: '',
    phone: '',
    email: '',
    location: '',
    numberOfStudents: '',
    numberOfTeachers: '',
    requestedPlan: 'STANDARD',
    message: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.schoolName || !formData.contactPerson || !formData.phone || !formData.email) {
      toast.error('Please fill in all required fields')
      return
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address')
      return
    }

    // Validate phone (basic)
    if (formData.phone.length < 7) {
      toast.error('Please enter a valid phone number')
      return
    }

    setLoading(true)
    try {
      const response = await apiCall('/api/shulea/access-requests', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          ...formData,
          numberOfStudents: formData.numberOfStudents ? parseInt(formData.numberOfStudents) : null,
          numberOfTeachers: formData.numberOfTeachers ? parseInt(formData.numberOfTeachers) : null
        })
      })

      if (response.message) {
        toast.success('Access request submitted successfully!')
        setSubmitted(true)
        setFormData({
          schoolName: '',
          schoolType: 'PRIMARY',
          contactPerson: '',
          phone: '',
          email: '',
          location: '',
          numberOfStudents: '',
          numberOfTeachers: '',
          requestedPlan: 'STANDARD',
          message: ''
        })
        onSuccess?.()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit request'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted</h3>
          <p className="text-gray-600 mb-4">
            Thank you for your interest in Shulea. We have received your access request and will review it shortly.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            You will receive an email update at <strong>{formData.email}</strong> within 24 hours with information about your request.
          </p>
          <Button
            onClick={() => setSubmitted(false)}
            variant="outline"
          >
            Submit Another Request
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Request Access to Shulea</CardTitle>
        <CardDescription>
          Fill out this form to request access to the Shulea School Management System. Our team will review your request and contact you within 24 hours.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* School Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">School Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schoolName">School Name *</Label>
                <Input
                  id="schoolName"
                  name="schoolName"
                  placeholder="e.g., Al-Hikma Secondary School"
                  value={formData.schoolName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="schoolType">School Type *</Label>
                <Select value={formData.schoolType} onValueChange={(value) => handleSelectChange('schoolType', value)}>
                  <SelectTrigger id="schoolType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIMARY">Primary</SelectItem>
                    <SelectItem value="SECONDARY">Secondary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">School Location</Label>
              <Input
                id="location"
                name="location"
                placeholder="e.g., Dar es Salaam, Ilala"
                value={formData.location}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Contact Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person Name *</Label>
                <Input
                  id="contactPerson"
                  name="contactPerson"
                  placeholder="e.g., John Doe"
                  value={formData.contactPerson}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="e.g., +255712345678"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="e.g., admin@school.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* School Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">School Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numberOfStudents">Number of Students</Label>
                <Input
                  id="numberOfStudents"
                  name="numberOfStudents"
                  type="number"
                  placeholder="e.g., 500"
                  value={formData.numberOfStudents}
                  onChange={handleChange}
                  min="1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="numberOfTeachers">Number of Teachers</Label>
                <Input
                  id="numberOfTeachers"
                  name="numberOfTeachers"
                  type="number"
                  placeholder="e.g., 20"
                  value={formData.numberOfTeachers}
                  onChange={handleChange}
                  min="1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestedPlan">Requested Plan</Label>
              <Select value={formData.requestedPlan} onValueChange={(value) => handleSelectChange('requestedPlan', value)}>
                <SelectTrigger id="requestedPlan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEMO">Demo (30 days)</SelectItem>
                  <SelectItem value="STANDARD">Standard</SelectItem>
                  <SelectItem value="PREMIUM">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Additional Message</Label>
            <Textarea
              id="message"
              name="message"
              placeholder="Tell us about your school and any specific requirements..."
              value={formData.message}
              onChange={handleChange}
              rows={4}
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">What happens next?</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>We'll review your request within 24 hours</li>
                <li>Our team will contact you via email or phone</li>
                <li>Upon approval, we'll provide your unique school access code</li>
                <li>You can then set up your account and start using Shulea</li>
              </ul>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Access Request'
            )}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            * Required fields
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
