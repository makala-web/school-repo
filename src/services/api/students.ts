// Student API Service
// Replaces /api/shulea/students route - uses repositories directly

import { StudentRepository, type CreateStudentInput, type UpdateStudentInput } from '@/repositories'
import { ApiClient, type ApiResponse } from './ApiClient'
import type { Student, StudentWithClass } from '@/types'

export interface StudentsListResponse {
  students: StudentWithClass[]
}

export interface StudentResponse {
  student: StudentWithClass
}

export interface BulkImportResponse {
  message: string
  imported: number
  errors?: string[]
}

export const StudentsApi = {
  // GET /api/shulea/students
  async list(params?: { classId?: string; schoolId?: string; search?: string; status?: string }): Promise<ApiResponse<StudentsListResponse>> {
    try {
      const students = await StudentRepository.getAll(params)
      return ApiClient.success({ students })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/students?nextAdmissionNo=classId
  async getNextAdmissionNo(classId: string): Promise<ApiResponse<{ admissionNo: string }>> {
    try {
      const admissionNo = await StudentRepository.generateAdmissionNo(classId)
      return ApiClient.success({ admissionNo })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/students/:id
  async getById(id: string): Promise<ApiResponse<StudentResponse>> {
    try {
      const student = await StudentRepository.getById(id)
      if (!student) {
        return ApiClient.error('Student not found')
      }
      return ApiClient.success({ student })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/students
  async create(data: CreateStudentInput & { autoAdmissionNo?: boolean }): Promise<ApiResponse<StudentResponse>> {
    try {
      const student = await StudentRepository.create(data, data.autoAdmissionNo)
      const studentWithClass = await StudentRepository.getById(student.id)
      return ApiClient.success({ student: studentWithClass! }, 'Student created successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // PUT /api/shulea/students
  async update(data: UpdateStudentInput): Promise<ApiResponse<StudentResponse>> {
    try {
      const student = await StudentRepository.update(data)
      const studentWithClass = await StudentRepository.getById(student.id)
      return ApiClient.success({ student: studentWithClass! }, 'Student updated successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // DELETE /api/shulea/students?id=:id
  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      await StudentRepository.delete(id)
      return ApiClient.success({ message: 'Student deleted successfully' })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/students (bulk import)
  async bulkImport(
    students: Array<{
      fullName: string
      gender: 'M' | 'F'
      admissionNo?: string
      dob?: string
      parentName?: string
      parentPhone?: string
    }>,
    classId: string,
    schoolId: string
  ): Promise<ApiResponse<BulkImportResponse>> {
    try {
      const errors: string[] = []
      const validStudents = students.filter((s, index) => {
        if (!s.fullName?.trim()) {
          errors.push(`Row ${index + 1}: Missing student name`)
          return false
        }
        if (!s.admissionNo?.trim()) {
          errors.push(`Row ${index + 1}: Missing admission number`)
          return false
        }
        if (!['M', 'F'].includes(s.gender)) {
          errors.push(`Row ${index + 1}: Invalid gender "${s.gender}" (must be M or F)`)
          return false
        }
        if (!s.parentPhone?.trim()) {
          errors.push(`Row ${index + 1}: Missing parent phone number`)
          return false
        }
        return true
      })

      if (errors.length > 0) {
        return ApiClient.error(`Import failed. Fix these issues first: ${errors.join('; ')}`)
      }

      const created = await StudentRepository.bulkCreate(validStudents, classId, schoolId)

      return ApiClient.success({
        message: `${created.length} students imported successfully`,
        imported: created.length,
        errors: errors.length > 0 ? errors : undefined
      })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  }
}

type ImportStudentRow = {
  fullName: string
  gender: 'M' | 'F'
  admissionNo?: string
  className?: string
  parentPhone?: string
}

function normalizeHeader(value: unknown): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

const headerAliases = {
  fullname: [
    'fullname',
    'name',
    'studentname',
    'student',
    'names',
    'jinalakamili',
    'jinalamwanafunzi',
    'mwanafunzi',
    'wanafunzi',
    'jina',
    'majina',
  ],
  gender: ['gender', 'sex', 'jinsia'],
  admissionno: ['admissionno', 'admissionnumber', 'admno', 'admnumber', 'adm', 'admission', 'nambayaadm', 'nambayakuandikishwa'],
  classname: ['class', 'classname', 'darasa'],
  parentphone: [
    'parentnumber',
    'parentno',
    'parentphone',
    'parentphoneno',
    'parentphonenumber',
    'parentcontact',
    'parentcontactnumber',
    'parentmobile',
    'parentmobilenumber',
    'guardianphone',
    'guardianphone number',
    'phonenumber',
    'phoneno',
    'phone',
    'tel',
    'mobile',
    'contact',
    'nambari',
    'simu',
    'nambayasim',
  ].map(normalizeHeader),

}

function isKnownHeader(value: unknown): boolean {
  const header = normalizeHeader(value)
  return Object.values(headerAliases).some(aliases => aliases.includes(header)) || ['sn', 'sno', 'no', 'number'].includes(header)
}

function mapHeaders(headers: unknown[]): Record<string, number> {
  const headerMap: Record<string, number> = {}

  headers.map(normalizeHeader).forEach((header, index) => {
    if (headerAliases.fullname.includes(header)) headerMap.fullname = index
    else if (headerAliases.gender.includes(header)) headerMap.gender = index
    else if (headerAliases.admissionno.includes(header)) headerMap.admissionno = index
    else if (headerAliases.classname.includes(header)) headerMap.classname = index
    else if (headerAliases.parentphone.includes(header)) headerMap.parentphone = index
  })

  return headerMap
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

function detectDelimiter(firstLine: string): string {
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
  const tabCount = (firstLine.match(/\t/g) || []).length

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t'
  if (semicolonCount > commaCount) return ';'
  return ','
}

function rowsToStudents(
  rows: unknown[][],
  defaultHeaderMap?: Record<string, number>,
  startRowOverride?: number
): { students: ImportStudentRow[]; errors: string[] } {
  const errors: string[] = []
  const students: ImportStudentRow[] = []

  if (rows.length === 0) {
    return { students, errors: ['No data rows found'] }
  }

  const firstRow = rows[0] || []
  const hasHeader = firstRow.some(isKnownHeader)
  const headerMap = defaultHeaderMap || (hasHeader
    ? mapHeaders(firstRow)
    : {
        fullname: 0,
        admissionno: 1,
        gender: 2,
        classname: 3,
        parentphone: 4,
      })
  const startRow = startRowOverride ?? (hasHeader ? 1 : 0)

  if (headerMap.fullname === undefined) {
    return { students, errors: ['Missing required column: Student Name'] }
  }
  const missingColumns = [
    ['admissionno', 'Admission Number'],
    ['gender', 'Gender'],
    ['classname', 'Class'],
    ['parentphone', 'Parent Phone Number'],
  ].filter(([key]) => headerMap[key] === undefined).map(([, label]) => label)

  if (missingColumns.length > 0) {
    return { students, errors: [`Missing required column(s): ${missingColumns.join(', ')}`] }
  }

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(cell => !String(cell || '').trim())) continue

    const fullName = String(row[headerMap.fullname] || '').trim()
    const rawGender = headerMap.gender !== undefined
      ? String(row[headerMap.gender] || '').toUpperCase().trim()
      : 'M'

    if (!fullName) {
      errors.push(`Row ${i + 1}: Missing student name`)
      continue
    }
    const admissionNo = String(row[headerMap.admissionno] || '').trim()
    const className = String(row[headerMap.classname] || '').trim()
    const parentPhone = String(row[headerMap.parentphone] || '').trim()

    if (!admissionNo) errors.push(`Row ${i + 1}: Missing admission number`)
    if (!className) errors.push(`Row ${i + 1}: Missing class`)
    if (!parentPhone) errors.push(`Row ${i + 1}: Missing parent phone number`)

    if (rawGender && !['M', 'F', 'MALE', 'FEMALE'].includes(rawGender)) {
      errors.push(`Row ${i + 1}: Invalid gender "${rawGender}" (must be M or F)`)
      continue
    }

    if (!admissionNo || !className || !parentPhone) continue

    students.push({
      fullName,
      gender: rawGender.startsWith('F') ? 'F' : 'M',
      admissionNo,
      className,
      parentPhone,
    })
  }

  return { students, errors }
}

export async function importStudentsFromCsv(
  csvData: string,
  classId: string,
  schoolId: string
): Promise<ApiResponse<BulkImportResponse>> {
  if (!csvData?.trim() || !classId || !schoolId) {
    return ApiClient.error('CSV data, class ID, and school ID are required')
  }

  const cleanData = csvData.replace(/^\uFEFF/, '').trim()
  const lines = cleanData.split(/\r?\n/)
  const delimiter = detectDelimiter(lines[0] || '')
  const rows = lines.map(line => parseCSVLine(line, delimiter))
  const parsed = rowsToStudents(rows)

  if (parsed.errors.length > 0) {
    return ApiClient.error(`Import failed. Fix these issues first: ${parsed.errors.join('; ')}`)
  }

  const result = await StudentsApi.bulkImport(parsed.students, classId, schoolId)
  if (result.success && result.data && parsed.errors.length > 0) {
    result.data.errors = [...(result.data.errors || []), ...parsed.errors]
  }
  return result
}

export async function importStudentsFromFile(
  file: File,
  classId: string,
  schoolId: string
): Promise<ApiResponse<BulkImportResponse>> {
  if (!file || !classId || !schoolId) {
    return ApiClient.error('File, class ID, and school ID are required')
  }

  const fileName = file.name.toLowerCase()
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
      const parsed = rowsToStudents(rows)

      if (parsed.errors.length > 0) {
        return ApiClient.error(`Import failed. Fix these issues first: ${parsed.errors.join('; ')}`)
      }

      const result = await StudentsApi.bulkImport(parsed.students, classId, schoolId)
      if (result.success && result.data && parsed.errors.length > 0) {
        result.data.errors = [...(result.data.errors || []), ...parsed.errors]
      }
      return result
    } catch (error) {
      return ApiClient.error(`Failed to parse Excel file: ${(error as Error).message}`)
    }
  }

  return importStudentsFromCsv(await file.text(), classId, schoolId)
}
