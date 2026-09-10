import { NextRequest, NextResponse } from 'next/server';
import { StudentRepository } from '@/repositories';
import { db } from '@/lib/db';
import { canAccessClass, getAuthenticatedUser, getAuthorizedClassIds, rejectDemoMutation } from '@/lib/server-auth';

// Helper: Validate school access
async function validateSchoolAccess(userId: string, schoolId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  
  // Super admins can access any school
  if (user.role === 'SUPER_ADMIN') return true;
  
  // Other users can only access their own school
  return user.schoolId === schoolId;
}

// Required for static export

// Helper: Generate admission number prefix from class name
function getAdmissionPrefix(className: string): string {
  const name = className.trim().toUpperCase();

  // Match "STD X" or "STANDARD X" pattern (Primary)
  const stdMatch = name.match(/(?:STD|STANDARD)\s*(\d+)/);
  if (stdMatch) {
    return `STD${stdMatch[1]}`;
  }

  // Match "FORM X" pattern (Secondary)
  const formMatch = name.match(/FORM\s*(\d+)/);
  if (formMatch) {
    return `F${formMatch[1]}`;
  }

  // Fallback: extract any number from the name and combine with first letters
  const numMatch = name.match(/(\d+)/);
  const words = name.split(/\s+/).filter(Boolean);
  if (numMatch && words.length > 0) {
    const prefix = words.map(w => w.charAt(0)).join('').replace(/\d/g, '');
    return `${prefix}${numMatch[1]}`;
  }

  // Last fallback: use first 3 chars uppercase
  return name.substring(0, 3);
}

async function generateAdmissionNo(classId: string): Promise<string> {
  return StudentRepository.generateAdmissionNo(classId);
}

// GET: List students (optional filter by classId, search, schoolId)
// Also supports ?nextAdmissionNo=classId to get the next auto-generated admission number
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const schoolId = searchParams.get('schoolId');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const nextAdmissionNo = searchParams.get('nextAdmissionNo');
    const userId = searchParams.get('userId');
    const actor = await getAuthenticatedUser(request)
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (actor.role === 'SUPER_ADMIN') return NextResponse.json({ error: 'Platform accounts cannot access academic records' }, { status: 403 })
    const trustedSchoolId = actor.schoolId
    if (!trustedSchoolId || (schoolId && schoolId !== trustedSchoolId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Special endpoint: get next auto-generated admission number for a class
    if (nextAdmissionNo) {
      try {
        const admissionNo = await generateAdmissionNo(nextAdmissionNo);
        return NextResponse.json({ admissionNo });
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
      }
    }

    // Validate school access if userId is provided
    if (userId && trustedSchoolId) {
      const hasAccess = await validateSchoolAccess(userId, trustedSchoolId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied. You can only access your own school data.' }, { status: 403 });
      }
    }

    const authorizedClassIds = await getAuthorizedClassIds(actor, { allowSubjectAssignment: true })
    if (authorizedClassIds && classId && !authorizedClassIds.includes(classId)) {
      return NextResponse.json({ error: 'Teacher is not authorized for this class' }, { status: 403 })
    }
    if (authorizedClassIds && authorizedClassIds.length === 0) {
      return NextResponse.json({ students: [] })
    }

    const students = authorizedClassIds
      ? (await Promise.all(authorizedClassIds.map(authorizedId => StudentRepository.getAll({
          classId: authorizedId,
          schoolId: trustedSchoolId,
          search: search || undefined,
          status: status || undefined,
        })))).flat()
      : await StudentRepository.getAll({
          classId: classId || undefined,
          schoolId: trustedSchoolId,
          search: search || undefined,
          status: status || undefined,
        })

    const scopedStudents = authorizedClassIds
      ? students.filter(student => authorizedClassIds.includes(student.classId))
      : students

    return NextResponse.json({ students: scopedStudents });
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}

// POST: Create a student or bulk upload via CSV/XLSX
export async function POST(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const contentType = request.headers.get('content-type') || '';

    // Handle FormData (xlsx file upload)
    const actor = await getAuthenticatedUser(request)
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (actor.role === 'SUPER_ADMIN') return NextResponse.json({ error: 'Platform accounts cannot modify academic records' }, { status: 403 })

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const classId = String(formData.get('classId') || '')
      const requestedSchoolId = String(formData.get('schoolId') || '')
      if (actor.role !== 'SCHOOL_ADMIN' && actor.role !== 'TEACHER') {
        return NextResponse.json({ error: 'Academic account required' }, { status: 403 })
      }
      if (requestedSchoolId !== actor.schoolId) {
        return NextResponse.json({ error: 'Cross-school student registration denied' }, { status: 403 })
      }
      if (!(await canAccessClass(actor, classId))) {
        return NextResponse.json({ error: 'Teacher is not authorized to register students in this class' }, { status: 403 })
      }
      return await handleFileUpload(formData);
    }

    const body = await request.json();
    const { action } = body;
    if (body.schoolId !== actor.schoolId) {
      return NextResponse.json({ error: 'Cross-school student registration denied' }, { status: 403 })
    }

    if (typeof body.classId !== 'string' || !(await canAccessClass(actor, body.classId))) {
      return NextResponse.json({ error: 'Teacher is not authorized to register students in this class' }, { status: 403 })
    }

    if (action === 'csv-upload') {
      return await handleCsvUpload(body);
    }

    return await handleCreateStudent(body);
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 });
  }
}

// Handle xlsx/csv file upload via FormData
async function handleFileUpload(formData: FormData) {
  try {
    const file = formData.get('file') as File | null;
    const classId = formData.get('classId') as string;
    const schoolId = formData.get('schoolId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!classId || !schoolId) {
      return NextResponse.json({ error: 'Class ID and School ID are required' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      // Parse Excel file using xlsx library
      const XLSX = await import('xlsx');
      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (jsonData.length < 1) {
        return NextResponse.json({ error: 'Excel file is empty' }, { status: 400 });
      }

      const firstRow = jsonData[0] || [];
      const hasHeader = firstRow.some(isKnownHeader);
      const headerMap: Record<string, number> = hasHeader
        ? mapStudentHeaders(firstRow)
        : {
          fullname: 0,
          admissionno: 1,
          gender: 2,
          classname: 3,
          parentphone: 4,
        };
      const startRow = hasHeader ? 1 : 0;

      if (headerMap['fullname'] === undefined) {
        return NextResponse.json({
          error: `Missing required column: Student Name. Found headers: ${firstRow.map(normalizeHeader).join(', ')}`,
        }, { status: 400 });
      }
      const missingColumns = getMissingImportColumns(headerMap);
      if (missingColumns.length > 0) {
        return NextResponse.json({
          error: `Missing required column(s): ${missingColumns.join(', ')}`,
        }, { status: 400 });
      }

      const students: Array<{
        fullName: string;
        gender: string;
        admissionNo?: string;
        className?: string;
        parentPhone?: string;
      }> = [];
      const errors: string[] = [];

      for (let i = startRow; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0 || row.every(cell => !String(cell || '').trim())) continue;

        const fullName = String(row[headerMap['fullname']] || '').trim();
        const gender = String(row[headerMap['gender']] || '').toUpperCase().trim();

        if (!fullName) {
          errors.push(`Row ${i + 1}: Missing student name`);
          continue;
        }
        const providedAdmNo = headerMap['admissionno'] !== undefined ? String(row[headerMap['admissionno']] || '').trim() : '';
        const className = headerMap['classname'] !== undefined ? String(row[headerMap['classname']] || '').trim() : '';
        const parentPhone = headerMap['parentphone'] !== undefined ? String(row[headerMap['parentphone']] || '').trim() : '';
        if (!providedAdmNo) errors.push(`Row ${i + 1}: Missing admission number`);
        if (!className) errors.push(`Row ${i + 1}: Missing class`);
        if (!parentPhone) errors.push(`Row ${i + 1}: Missing parent phone number`);

        if (!['M', 'F', 'MALE', 'FEMALE'].includes(gender)) {
          errors.push(`Row ${i + 1}: Invalid gender "${gender}" (must be M or F)`);
          continue;
        }
        if (!providedAdmNo || !className || !parentPhone) continue;

        const normalizedGender = gender.startsWith('F') ? 'F' : 'M';

        students.push({
          fullName,
          gender: normalizedGender,
          admissionNo: providedAdmNo,
          className,
          parentPhone,
        });
      }

      if (errors.length > 0) {
        return NextResponse.json({
          error: `Import failed. Fix these issues first: ${errors.join('; ')}`,
          errors,
        }, { status: 400 });
      }

      if (students.length === 0) {
        return NextResponse.json({
          error: 'No valid student data found in Excel file',
          errors: errors.length > 0 ? errors : undefined,
        }, { status: 400 });
      }

      const validation = await validateImportAdmissionNumbers(students, schoolId);
      errors.push(...validation.errors);
      if (validation.validStudents.length === 0) {
        return NextResponse.json({
          error: 'No valid student data found after duplicate admission number checks',
          errors,
        }, { status: 400 });
      }

      // Create students in bulk with auto admission numbers
      const created = await StudentRepository.bulkCreate(validation.validStudents as Array<{
        fullName: string
        gender: 'M' | 'F'
        admissionNo?: string
        dob?: string
        parentName?: string
        parentPhone?: string
      }>, classId, schoolId);

      return NextResponse.json({
        message: `${created.length} students imported from Excel`,
        imported: created.length,
        errors: errors.length > 0 ? errors : undefined,
      }, { status: 201 });
    }

    // Handle CSV file via FormData
    const text = await file.text();
    return await handleCsvUpload({ csvData: text, classId, schoolId });
  } catch (error) {
    console.error('Error handling file upload:', error);
    return NextResponse.json({ error: 'Failed to process file upload' }, { status: 500 });
  }
}

async function handleCreateStudent(body: {
  fullName: string;
  gender: string;
  admissionNo?: string;
  dob?: string;
  parentName?: string;
  parentPhone?: string;
  classId: string;
  schoolId: string;
  status?: string;
  autoAdmissionNo?: boolean;
  userId?: string;
}) {
  const { fullName, gender, admissionNo, dob, parentName, parentPhone, classId, schoolId, status, autoAdmissionNo, userId } = body;

  if (!fullName || !gender || !classId || !schoolId) {
    return NextResponse.json(
      { error: 'Full name, gender, class ID, and school ID are required' },
      { status: 400 }
    );
  }

  // Validate school access if userId is provided
  if (userId) {
    const hasAccess = await validateSchoolAccess(userId, schoolId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied. You can only access your own school data.' }, { status: 403 });
    }
  }

  if (!['M', 'F'].includes(gender)) {
    return NextResponse.json({ error: 'Gender must be M or F' }, { status: 400 });
  }

  // Auto-generate admission number if not provided or if autoAdmissionNo flag is set
  let finalAdmissionNo = admissionNo?.trim() || null;
  if (!finalAdmissionNo || autoAdmissionNo) {
    finalAdmissionNo = await generateAdmissionNo(classId);
  }

  if (finalAdmissionNo) {
    const existingWithAdmissionNo = await StudentRepository.getAll({ schoolId });
    const duplicate = existingWithAdmissionNo.find(student =>
      (student.admissionNo || '').trim().toLowerCase() === finalAdmissionNo!.trim().toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json({ error: `Admission number "${finalAdmissionNo}" already exists` }, { status: 400 });
    }
  }

  const student = await StudentRepository.create({
    fullName,
    gender: gender as 'M' | 'F',
    admissionNo: finalAdmissionNo || undefined,
    dob,
    parentName,
    parentPhone,
    classId,
    schoolId,
    status: (status as 'ACTIVE' | 'TRANSFERRED' | 'GRADUATED' | undefined) || 'ACTIVE',
  });

  return NextResponse.json({
    message: 'Student created successfully',
    student,
  }, { status: 201 });
}

// Helper: Parse CSV line handling quoted values
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Helper: Detect CSV delimiter
function detectDelimiter(firstLine: string): string {
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
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
    'guardianphonenumber',
    'phonenumber',
    'phoneno',
    'phone',
    'tel',
    'mobile',
    'contact',
    'nambari',
    'simu',
    'nambayasim',
  ],
};

function normalizeHeader(value: unknown): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isKnownHeader(value: unknown): boolean {
  const header = normalizeHeader(value);
  return Object.values(headerAliases).some(aliases => aliases.includes(header)) || ['sn', 'sno', 'no', 'number'].includes(header);
}

function mapStudentHeaders(headers: unknown[]): Record<string, number> {
  const headerMap: Record<string, number> = {};

  headers.map(normalizeHeader).forEach((header, idx) => {
    if (headerAliases.fullname.includes(header)) headerMap.fullname = idx;
    else if (headerAliases.gender.includes(header)) headerMap.gender = idx;
    else if (headerAliases.admissionno.includes(header)) headerMap.admissionno = idx;
    else if (headerAliases.classname.includes(header)) headerMap.classname = idx;
    else if (headerAliases.parentphone.includes(header)) headerMap.parentphone = idx;
  });

  return headerMap;
}

function getMissingImportColumns(headerMap: Record<string, number>): string[] {
  return [
    ['admissionno', 'Admission Number'],
    ['gender', 'Gender'],
    ['classname', 'Class'],
    ['parentphone', 'Parent Phone Number'],
  ].filter(([key]) => headerMap[key] === undefined).map(([, label]) => label);
}

async function handleCsvUpload(body: {
  csvData: string;
  classId: string;
  schoolId: string;
}) {
  const { csvData, classId, schoolId } = body;

  if (!csvData || !classId || !schoolId) {
    return NextResponse.json(
      { error: 'CSV data, class ID, and school ID are required' },
      { status: 400 }
    );
  }

  // Remove BOM if present and trim
  const cleanData = csvData.replace(/^\uFEFF/, '').trim();

  // Check if this looks like headerless CSV (just fullName,gender per line)
  const lines = cleanData.split(/\r?\n/);
  if (lines.length < 1) {
    return NextResponse.json({ error: 'CSV data is empty' }, { status: 400 });
  }

  // Detect delimiter
  const delimiter = detectDelimiter(lines[0]);

  // Check if first line is a header or data
  const firstLineValues = parseCSVLine(lines[0], delimiter);
  const isFirstLineHeader = firstLineValues.some(isKnownHeader);

  let headerMap: Record<string, number> = {};
  let startRow = 1;

  if (isFirstLineHeader) {
    headerMap = mapStudentHeaders(firstLineValues);
  } else {
    // No header - assume the exact required template order.
    startRow = 0;
    headerMap = { fullname: 0, admissionno: 1, gender: 2, classname: 3, parentphone: 4 };
  }

  if (headerMap['fullname'] === undefined) {
    return NextResponse.json({
      error: 'Could not find Student Name column.',
    }, { status: 400 });
  }
  const missingColumns = getMissingImportColumns(headerMap);
  if (missingColumns.length > 0) {
    return NextResponse.json({
      error: `Missing required column(s): ${missingColumns.join(', ')}`,
    }, { status: 400 });
  }

  const students: Array<{
    fullName: string;
    gender: string;
    admissionNo?: string;
    className?: string;
    parentPhone?: string;
  }> = [];
  const errors: string[] = [];

  for (let i = startRow; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line, delimiter);

    const fullName = values[headerMap['fullname']] || '';
    const gender = headerMap['gender'] !== undefined ? (values[headerMap['gender']] || '').toUpperCase().trim() : 'M';

    if (!fullName) {
      errors.push(`Row ${i + 1}: Missing student name`);
      continue;
    }

    const providedAdmNo = headerMap['admissionno'] !== undefined ? (values[headerMap['admissionno']] || '').trim() : '';
    const className = headerMap['classname'] !== undefined ? (values[headerMap['classname']] || '').trim() : '';
    const parentPhone = headerMap['parentphone'] !== undefined ? (values[headerMap['parentphone']] || '').trim() : '';
    if (!providedAdmNo) errors.push(`Row ${i + 1}: Missing admission number`);
    if (!className) errors.push(`Row ${i + 1}: Missing class`);
    if (!parentPhone) errors.push(`Row ${i + 1}: Missing parent phone number`);

    if (!['M', 'F', 'MALE', 'FEMALE'].includes(gender)) {
      errors.push(`Row ${i + 1}: Invalid gender "${gender}" (must be M or F)`);
      continue;
    }
    if (!providedAdmNo || !className || !parentPhone) continue;

    const normalizedGender = gender.startsWith('F') ? 'F' : 'M';

    students.push({
      fullName,
      gender: normalizedGender,
      admissionNo: providedAdmNo,
      className,
      parentPhone,
    });
  }

  if (errors.length > 0) {
    return NextResponse.json({
      error: `Import failed. Fix these issues first: ${errors.join('; ')}`,
      errors,
    }, { status: 400 });
  }

  if (students.length === 0) {
    return NextResponse.json({
      error: 'No valid student data found in CSV',
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 400 });
  }

  const validation = await validateImportAdmissionNumbers(students, schoolId);
  errors.push(...validation.errors);
  if (validation.validStudents.length === 0) {
    return NextResponse.json({
      error: 'No valid student data found after duplicate admission number checks',
      errors,
    }, { status: 400 });
  }

  // Create students in bulk with auto admission numbers
  const created = await StudentRepository.bulkCreate(validation.validStudents as Array<{
    fullName: string
    gender: 'M' | 'F'
    admissionNo?: string
    dob?: string
    parentName?: string
    parentPhone?: string
  }>, classId, schoolId);

  return NextResponse.json({
    message: `${created.length} students imported successfully`,
    imported: created.length,
    errors: errors.length > 0 ? errors : undefined,
  }, { status: 201 });
}

async function validateImportAdmissionNumbers(students: Array<{
  fullName: string
  gender: string
  admissionNo?: string
  className?: string
  parentPhone?: string
}>, schoolId: string) {
  const existing = await StudentRepository.getAll({ schoolId });
  const existingAdmissionNos = new Set(
    existing
      .map(student => (student.admissionNo || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const seenAdmissionNos = new Set<string>();
  const errors: string[] = [];
  
  // Instead of rejecting students with existing admission numbers, 
  // we clear their admissionNo so batchCreate auto-generates new ones
  const validStudents = students.filter((student, index) => {
    const admissionNo = (student.admissionNo || '').trim();
    if (!admissionNo) return true;

    const normalized = admissionNo.toLowerCase();
    if (seenAdmissionNos.has(normalized)) {
      errors.push(`Row ${index + 1}: Duplicate admission number "${admissionNo}" inside uploaded file — will auto-generate new number`);
      student.admissionNo = '';
      return true;
    }
    if (existingAdmissionNos.has(normalized)) {
      errors.push(`Row ${index + 1}: Admission number "${admissionNo}" already exists — will auto-generate new number`);
      student.admissionNo = '';
      return true;
    }
    seenAdmissionNos.add(normalized);
    return true;
  });

  return { validStudents, errors };
}

// PUT: Update a student
export async function PUT(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const body = await request.json();
    const { id, fullName, gender, admissionNo, dob, parentName, parentPhone, classId, status, userId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    const existing = await StudentRepository.getById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const actor = await getAuthenticatedUser(request)
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (actor.role === 'SUPER_ADMIN' || !(await canAccessClass(actor, existing.classId))) {
      return NextResponse.json({ error: 'You are not authorized to manage this class' }, { status: 403 })
    }
    if (classId && !(await canAccessClass(actor, classId))) {
      return NextResponse.json({ error: 'You are not authorized to move a student into this class' }, { status: 403 })
    }

    // Validate school access if userId is provided
    if (userId && existing.schoolId) {
      const hasAccess = await validateSchoolAccess(userId, existing.schoolId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied. You can only access your own school data.' }, { status: 403 });
      }
    }

    if (admissionNo) {
      const schoolStudents = await StudentRepository.getAll({ schoolId: existing.schoolId });
      const duplicate = schoolStudents.find(student =>
        student.id !== id &&
        (student.admissionNo || '').trim().toLowerCase() === String(admissionNo).trim().toLowerCase()
      );
      if (duplicate) {
        return NextResponse.json({ error: `Admission number "${admissionNo}" already exists` }, { status: 400 });
      }
    }

    const student = await StudentRepository.update({
      id,
      fullName: fullName ?? undefined,
      gender: gender ?? undefined,
      admissionNo: admissionNo !== undefined ? admissionNo : undefined,
      dob: dob !== undefined ? dob : undefined,
      parentName: parentName !== undefined ? parentName : undefined,
      parentPhone: parentPhone !== undefined ? parentPhone : undefined,
      classId: classId ?? undefined,
      status: status ?? undefined,
    });

    return NextResponse.json({
      message: 'Student updated successfully',
      student,
    });
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 });
  }
}

// DELETE: Delete student(s)
// Supports: ?id=xxx (single delete) or ?classId=xxx (bulk delete by class)
export async function DELETE(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const classId = searchParams.get('classId');
    const userId = searchParams.get('userId');
    const actor = await getAuthenticatedUser(request)
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (actor.role === 'SUPER_ADMIN') return NextResponse.json({ error: 'Platform accounts cannot modify academic records' }, { status: 403 })

    // Bulk delete all students in a class
    if (classId && !id) {
      if (!(await canAccessClass(actor, classId))) {
        return NextResponse.json({ error: 'You are not authorized to manage this class' }, { status: 403 })
      }
      const classStudents = await StudentRepository.getAll({ classId });
      if (classStudents.length === 0) {
        return NextResponse.json({ error: 'No students found in this class' }, { status: 404 });
      }

      // Validate school access if userId is provided
      if (userId && classStudents.length > 0) {
        const hasAccess = await validateSchoolAccess(userId, classStudents[0].schoolId);
        if (!hasAccess) {
          return NextResponse.json({ error: 'Access denied. You can only access your own school data.' }, { status: 403 });
        }
      }
      
      for (const s of classStudents) {
        await StudentRepository.delete(s.id);
      }
      
      return NextResponse.json({ 
        message: `${classStudents.length} students deleted from this class`, 
        deleted: classStudents.length 
      });
    }

    if (!id) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    const existing = await StudentRepository.getById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    if (!(await canAccessClass(actor, existing.classId))) {
      return NextResponse.json({ error: 'You are not authorized to manage this class' }, { status: 403 })
    }

    // Validate school access if userId is provided
    if (userId) {
      const hasAccess = await validateSchoolAccess(userId, existing.schoolId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied. You can only access your own school data.' }, { status: 403 });
      }
    }

    await StudentRepository.delete(id);

    return NextResponse.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 });
  }
}
