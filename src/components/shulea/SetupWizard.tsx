'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiCall } from '@/lib/utils'
import { toast } from 'sonner'
import {
  GraduationCap, School, CheckCircle2, Circle, ArrowLeft, ArrowRight, Loader2,
  Upload, Building2, User as UserIcon, Calendar, Image as ImageIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useRef } from 'react'

const STEPS = [
  { id: 1, title: 'School Type', icon: School },
  { id: 2, title: 'School Details', icon: Building2 },
  { id: 3, title: 'Head Teacher', icon: UserIcon },
  { id: 4, title: 'Academic Year', icon: Calendar },
  { id: 5, title: 'School Logo', icon: ImageIcon },
]

export default function SetupWizard() {
  const { setSchool, setSchoolType, setView, schoolType, currentUser } = useAppStore()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Form data
  const [selectedType, setSelectedType] = useState<'PRIMARY' | 'SECONDARY'>(() => (schoolType as 'PRIMARY' | 'SECONDARY') || 'PRIMARY')
  const [schoolName, setSchoolName] = useState('')
  const [council, setCouncil] = useState('')
  const [district, setDistrict] = useState('')
  const [region, setRegion] = useState('')
  const [ward, setWard] = useState('')
  const [registrationNo, setRegistrationNo] = useState('')
  const [phone, setPhone] = useState('')
  const [headTeacherName, setHeadTeacherName] = useState('')
  const [headTeacherSign, setHeadTeacherSign] = useState('')
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString())
  const [term, setTerm] = useState('FIRST TERM')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoBase64, setLogoBase64] = useState<string | null>(null)

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be less than 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setLogoPreview(reader.result as string)
      setLogoBase64(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  function nextStep() {
    if (currentStep === 1 && !selectedType) {
      toast.error('Please select school type')
      return
    }
    if (currentStep === 2 && !schoolName.trim()) {
      toast.error('School name is required')
      return
    }
    setCurrentStep(Math.min(currentStep + 1, 5))
  }

  function prevStep() {
    setCurrentStep(Math.max(currentStep - 1, 1))
  }

  async function handleComplete() {
    setLoading(true)
    try {
      // Create school
      const schoolData = await apiCall('/api/shulea/school', {
        method: 'POST',
        body: JSON.stringify({
          name: schoolName,
          schoolType: selectedType,
          council: council || undefined,
          district: district || undefined,
          region: region || undefined,
          ward: ward || undefined,
          registrationNo: registrationNo || undefined,
          phone: phone || undefined,
          headTeacherName: headTeacherName || undefined,
          headTeacherSign: headTeacherSign || undefined,
          academicYear: academicYear || undefined,
          term: term || undefined,
          logo: logoBase64 || undefined,
        }),
      })

      setSchool(schoolData.school)
      setSchoolType(selectedType)

      // Seed default data (subjects, grading)
      await apiCall('/api/shulea/seed', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: schoolData.school.id,
          schoolType: selectedType,
          includePP12: selectedType === 'PRIMARY',
          userId: currentUser?.id,
        }),
      })

      toast.success('School setup complete!')
      setView('dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save school')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-3 shadow-lg">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-emerald-800">School Setup</h1>
          <p className="text-sm text-emerald-600/70 mt-1">Let&apos;s configure your school in a few steps</p>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {STEPS.map((step) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => currentStep > step.id && setCurrentStep(step.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  currentStep === step.id
                    ? 'bg-emerald-600 text-white shadow-md'
                    : currentStep > step.id
                    ? 'bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {currentStep > step.id ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Circle className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{step.title}</span>
                <span className="sm:hidden">{step.id}</span>
              </button>
              {step.id < 5 && (
                <div className={`w-6 h-0.5 mx-1 ${currentStep > step.id ? 'bg-emerald-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-800">
              {(() => {
                const StepIcon = STEPS[currentStep - 1].icon
                return <StepIcon className="w-5 h-5" />
              })()}
              {STEPS[currentStep - 1].title}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && 'Select the type of school you are setting up'}
              {currentStep === 2 && 'Enter your school\'s basic information'}
              {currentStep === 3 && 'Provide head teacher details'}
              {currentStep === 4 && 'Set the current academic year and term'}
              {currentStep === 5 && 'Upload your school logo (optional)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step 1: School Type */}
            {currentStep === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedType('PRIMARY')}
                  className={`p-6 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
                    selectedType === 'PRIMARY'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-200 hover:bg-emerald-50/50'
                  }`}
                >
                  <School className="w-12 h-12" />
                  <div className="text-center">
                    <h3 className="font-bold text-lg">Primary School</h3>
                    <p className="text-sm opacity-70 mt-1">Standard 1 - 7</p>
                    <p className="text-xs opacity-50 mt-1">Grading out of 50</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType('SECONDARY')}
                  className={`p-6 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
                    selectedType === 'SECONDARY'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-200 hover:bg-emerald-50/50'
                  }`}
                >
                  <GraduationCap className="w-12 h-12" />
                  <div className="text-center">
                    <h3 className="font-bold text-lg">Secondary School</h3>
                    <p className="text-sm opacity-70 mt-1">Form 1 - 4</p>
                    <p className="text-xs opacity-50 mt-1">NECTA grading out of 100</p>
                  </div>
                </button>
              </div>
            )}

            {/* Step 2: School Details */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="schoolName">School Name *</Label>
                    <Input
                      id="schoolName"
                      placeholder="e.g. Shule ya Msingi Mlimani"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Region (Mkoa)</Label>
                    <Input
                      id="region"
                      placeholder="e.g. Dar es Salaam"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="district">District (Wilaya)</Label>
                    <Input
                      id="district"
                      placeholder="e.g. Ilala"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="council">Council (Halmashauri)</Label>
                    <Input
                      id="council"
                      placeholder="e.g. Ilala MC"
                      value={council}
                      onChange={(e) => setCouncil(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ward">Ward (Kata)</Label>
                    <Input
                      id="ward"
                      placeholder="e.g. Upanga"
                      value={ward}
                      onChange={(e) => setWard(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regNo">Registration No</Label>
                    <Input
                      id="regNo"
                      placeholder="e.g. S/01/001"
                      value={registrationNo}
                      onChange={(e) => setRegistrationNo(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      placeholder="e.g. 0221234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Head Teacher */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="headTeacher">Head Teacher Name</Label>
                  <Input
                    id="headTeacher"
                    placeholder="e.g. Mwl. Anna Mwangi"
                    value={headTeacherName}
                    onChange={(e) => setHeadTeacherName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headTeacherSign">Signature / Short Name</Label>
                  <Input
                    id="headTeacherSign"
                    placeholder="e.g. A.Mwangi"
                    value={headTeacherSign}
                    onChange={(e) => setHeadTeacherSign(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">This will appear as signature on report cards</p>
                </div>
              </div>
            )}

            {/* Step 4: Academic Year */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="academicYear">Academic Year</Label>
                  <Input
                    id="academicYear"
                    placeholder="e.g. 2026"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Term (Muhula)</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {['FIRST TERM', 'SECOND TERM', 'THIRD TERM'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTerm(t)}
                        className={`p-3 rounded-lg border-2 text-center text-sm font-medium transition-all ${
                          term === t
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-200'
                        }`}
                      >
                        {t.replace(' TERM', '')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Logo */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-4">
                  {logoPreview ? (
                    <div className="w-32 h-32 rounded-xl border-2 border-emerald-200 bg-white p-2 flex items-center justify-center">
                      <img
                        src={logoPreview}
                        alt="School logo preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-2">
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                      <span className="text-xs text-gray-400">No logo</span>
                    </div>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      if (logoInputRef.current) {
                        logoInputRef.current.value = ''
                        logoInputRef.current.click()
                      }
                    }}
                  >
                    <Upload className="w-4 h-4" />
                    Upload Logo
                  </Button>
                  <p className="text-xs text-muted-foreground">PNG or JPG, max 2MB. This is optional.</p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              {currentStep < 5 ? (
                <Button type="button" onClick={nextStep} className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                  Next
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleComplete}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Complete Setup
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
