// Shared TypeScript types for Shulea
// These types mirror the persisted data model used by both Prisma and local SQLite.

export type SchoolType = 'PRIMARY' | 'SECONDARY'
export type TimestampValue = string | Date
export type UserRole = 'TEACHER' | 'ADMIN' | 'HEAD_TEACHER' | string
export type StudentGender = 'M' | 'F' | string
export type StudentStatus = 'ACTIVE' | 'TRANSFERRED' | 'GRADUATED' | string
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'SICK' | 'PERMISSION' | string
export type ResultStatus = 'COMPLETE' | 'INCOMPLETE' | string
export type ExamType = 'MIDTERM' | 'MONTHLY' | 'TERMINAL' | 'ANNUAL' | string

export interface School {
  id: string
  name: string
  schoolType: SchoolType | string
  logo?: string | null
  logo2?: string | null
  registrationNo?: string | null
  council?: string | null
  region?: string | null
  district?: string | null
  ward?: string | null
  phone?: string | null
  email?: string | null
  headTeacherName?: string | null
  headTeacherSign?: string | null
  headTeacherComments?: string | null
  classTeacherName?: string | null
  classTeacherShortName?: string | null
  classTeacherComments?: string | null
  isDemo?: boolean | null
  licenseType?: string | null
  licenseStatus?: string | null
  activationCode?: string | null
  startDate?: string | null
  expiryDate?: string | null
  maxTeachers?: number | null
  maxDevices?: number | null
  maxStudents?: number | null
  lastValidatedAt?: TimestampValue | null
  renewalRequestedAt?: TimestampValue | null
  renewalRequestedBy?: string | null
  ctGradeA_en?: string | null
  ctGradeB_en?: string | null
  ctGradeC_en?: string | null
  ctGradeD_en?: string | null
  ctGradeE_en?: string | null
  ctGradeA_sw?: string | null
  ctGradeB_sw?: string | null
  ctGradeC_sw?: string | null
  ctGradeD_sw?: string | null
  ctGradeE_sw?: string | null
  htGradeA_en?: string | null
  htGradeB_en?: string | null
  htGradeC_en?: string | null
  htGradeD_en?: string | null
  htGradeE_en?: string | null
  htGradeA_sw?: string | null
  htGradeB_sw?: string | null
  htGradeC_sw?: string | null
  htGradeD_sw?: string | null
  htGradeE_sw?: string | null
  academicYear?: string | null
  term?: string | null
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export interface User {
  id: string
  email: string
  username: string
  password: string
  fullName: string
  role: UserRole
  active: boolean
  schoolId?: string | null
  schoolType?: SchoolType | string | null
  securityQuestion?: string | null
  securityAnswer?: string | null
  isDemoUser?: boolean | null
  deviceId?: string | null
  lastSchoolAccessAt?: TimestampValue | null
  createdAt: TimestampValue
  updatedAt: TimestampValue
  school?: Partial<School> | null
  teacher?: Partial<Teacher> | null
}

export interface Teacher {
  id: string
  name: string
  shortName?: string | null
  sign?: string | null
  phone?: string | null
  schoolId: string
  userId?: string | null
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export interface Class {
  id: string
  name: string
  stream?: string | null
  fullName: string
  schoolType: SchoolType | string
  classTeacherId?: string | null
  schoolId: string
  academicYear?: string | null
  term?: string | null
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export interface Student {
  id: string
  admissionNo?: string | null
  fullName: string
  gender: StudentGender
  dob?: string | null
  parentName?: string | null
  parentPhone?: string | null
  status: StudentStatus
  classId: string
  schoolId: string
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export interface Subject {
  id: string
  name: string
  shortName?: string | null
  schoolType: SchoolType | 'BOTH' | string
  schoolId: string
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export interface ClassSubject {
  id: string
  classId: string
  subjectId: string
  createdAt: TimestampValue
  subject?: Subject
}

export interface TeacherSubject {
  id: string
  teacherId: string
  subjectId: string
  classId: string
  createdAt: TimestampValue
}
export interface Exam {
  id: string
  name: string
  examType: ExamType
  classId: string
  schoolId: string
  academicYear: string
  term: string
  examDate?: string | null
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export interface MarksEntry {
  id: string
  studentId: string
  classSubjectId: string
  examId: string
  marks?: number | null
  grade?: string | null
  remarks?: string | null
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export interface StudentResult {
  id: string
  studentId: string
  examId: string
  classId: string
  totalMarks?: number | null
  averageMarks?: number | null
  grade?: string | null
  division?: string | null
  points?: number | null
  rank?: number | null
  status: ResultStatus
  subjectCount: number
  classTeacherComment?: string | null
  headTeacherComment?: string | null
  closingDate?: string | null
  openingDate?: string | null
  classTeacherSign?: string | null
  headTeacherSign?: string | null
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export interface GradingConfig {
  id: string
  schoolType: SchoolType
  grade: string
  minMark: number
  maxMark: number
  remarks: string
  points?: number | null
  division?: string | null
  schoolId: string
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export interface Attendance {
  id: string
  studentId: string
  classId: string
  date: string
  status: AttendanceStatus
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export interface Tabia {
  id: string
  studentId: string
  classId: string
  examId?: string | null
  discipline?: string | null
  hygiene?: string | null
  hardWorking?: string | null
  cooperation?: string | null
  honesty?: string | null
  leadership?: string | null
  sports?: string | null
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export interface BackupLog {
  id: string
  fileName: string
  backupType: 'FULL' | 'STUDENTS' | 'MARKS'
  fileSize?: string | null
  createdAt: TimestampValue
}

export interface AppSetting {
  id: string
  key: string
  value: string
}

// Extended types with relations for queries
export interface StudentWithClass extends Student {
  class: {
    name: string
    fullName: string
    schoolType: SchoolType
  }
  school?: {
    name: string
  }
}

export interface MarksEntryWithRelations extends MarksEntry {
  student: Student
  classSubject: ClassSubject & { subject: Subject }
  exam: Exam
}

export interface StudentResultWithRelations extends StudentResult {
  student: Student
  exam: Exam
  class: Class
}

export interface ClassWithDetails extends Class {
  teacher?: {
    id: string
    name: string
    shortName?: string | null
  } | null
  studentCount?: number
}

export interface SchoolWithCounts extends School {
  studentCount: number
  classCount: number
  teacherCount: number
}

export interface SubjectWithClasses extends Subject {
  classCount?: number
  classes?: Array<{
    id: string
    name: string
    fullName: string
  }>
}

export interface TeacherWithDetails extends Teacher {
  assignedClasses?: Array<{
    id: string
    name: string
    fullName: string
    schoolType: string
  }>
  assignedSubjects?: Array<{
    id: string
    subjectId: string
    subjectName: string
    classId: string
    className: string
  }>
}

export interface ExamWithDetails extends Exam {
  class?: {
    id: string
    name: string
    fullName: string
    schoolType: string
  }
  marksCount?: number
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
