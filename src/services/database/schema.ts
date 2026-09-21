// SQLite Database Schema
// Matches Prisma schema exactly for compatibility

export const TABLES = {
  School: `
    CREATE TABLE IF NOT EXISTS School (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      schoolType TEXT NOT NULL,
      logo TEXT,
      logo2 TEXT,
      registrationNo TEXT,
      council TEXT,
      region TEXT,
      district TEXT,
      ward TEXT,
      phone TEXT,
      email TEXT,
      headTeacherName TEXT,
      headTeacherSign TEXT,
      headTeacherComments TEXT,
      classTeacherName TEXT,
      classTeacherShortName TEXT,
      classTeacherComments TEXT,
      ctGradeA_en TEXT,
      ctGradeB_en TEXT,
      ctGradeC_en TEXT,
      ctGradeD_en TEXT,
      ctGradeE_en TEXT,
      ctGradeA_sw TEXT,
      ctGradeB_sw TEXT,
      ctGradeC_sw TEXT,
      ctGradeD_sw TEXT,
      ctGradeE_sw TEXT,
      htGradeA_en TEXT,
      htGradeB_en TEXT,
      htGradeC_en TEXT,
      htGradeD_en TEXT,
      htGradeE_en TEXT,
      htGradeA_sw TEXT,
      htGradeB_sw TEXT,
      htGradeC_sw TEXT,
      htGradeD_sw TEXT,
      htGradeE_sw TEXT,
      academicYear TEXT,
      term TEXT,
      isDemo INTEGER NOT NULL DEFAULT 0,
      licenseType TEXT,
      licenseStatus TEXT,
      activationCode TEXT,
      startDate TEXT,
      expiryDate TEXT,
      maxTeachers INTEGER,
      maxDevices INTEGER,
      maxStudents INTEGER,
      lastValidatedAt TEXT,
      renewalRequestedAt TEXT,
      renewalRequestedBy TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `,

  User: `
    CREATE TABLE IF NOT EXISTS User (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      fullName TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'TEACHER',
      active INTEGER NOT NULL DEFAULT 1,
      schoolId TEXT,
      schoolType TEXT,
      securityQuestion TEXT,
      securityAnswer TEXT,
      isDemoUser INTEGER NOT NULL DEFAULT 0,
      deviceId TEXT,
      lastSchoolAccessAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (schoolId) REFERENCES School(id) ON DELETE SET NULL
    )
  `,

  Device: `
    CREATE TABLE IF NOT EXISTS Device (
      id TEXT PRIMARY KEY,
      deviceId TEXT NOT NULL,
      deviceName TEXT,
      platform TEXT,
      userAgent TEXT,
      schoolId TEXT NOT NULL,
      userId TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      activatedAt TEXT NOT NULL,
      lastSeenAt TEXT NOT NULL,
      deactivatedAt TEXT,
      deactivatedBy TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (schoolId) REFERENCES School(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
      UNIQUE(deviceId, userId)
    )
  `,

  Invitation: `
    CREATE TABLE IF NOT EXISTS Invitation (
      id TEXT PRIMARY KEY,
      inviteCode TEXT NOT NULL UNIQUE,
      schoolId TEXT NOT NULL,
      senderId TEXT NOT NULL,
      receiverId TEXT UNIQUE,
      email TEXT NOT NULL,
      fullName TEXT,
      role TEXT NOT NULL DEFAULT 'TEACHER',
      assignedClasses TEXT, -- JSON string of class IDs
      assignedSubjects TEXT, -- JSON string of subject IDs
      status TEXT NOT NULL DEFAULT 'PENDING',
      expiresAt TEXT NOT NULL,
      acceptedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (schoolId) REFERENCES School(id) ON DELETE CASCADE,
      FOREIGN KEY (senderId) REFERENCES User(id) ON DELETE CASCADE,
      FOREIGN KEY (receiverId) REFERENCES User(id) ON DELETE SET NULL
    )
  `,

  Teacher: `
    CREATE TABLE IF NOT EXISTS Teacher (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      shortName TEXT,
      sign TEXT,
      phone TEXT,
      schoolId TEXT NOT NULL,
      userId TEXT UNIQUE,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (schoolId) REFERENCES School(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE SET NULL
    )
  `,

  Class: `
    CREATE TABLE IF NOT EXISTS Class (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      stream TEXT,
      fullName TEXT NOT NULL,
      schoolType TEXT NOT NULL,
      classTeacherId TEXT,
      schoolId TEXT NOT NULL,
      academicYear TEXT,
      term TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (schoolId) REFERENCES School(id) ON DELETE CASCADE,
      FOREIGN KEY (classTeacherId) REFERENCES Teacher(id) ON DELETE SET NULL
    )
  `,

  ClassTeacherAssignment: `
    CREATE TABLE IF NOT EXISTS ClassTeacherAssignment (
      id TEXT PRIMARY KEY,
      schoolId TEXT NOT NULL,
      classId TEXT NOT NULL,
      teacherId TEXT NOT NULL,
      academicYear TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (schoolId) REFERENCES School(id) ON DELETE CASCADE,
      FOREIGN KEY (classId) REFERENCES Class(id) ON DELETE CASCADE,
      FOREIGN KEY (teacherId) REFERENCES Teacher(id) ON DELETE CASCADE
    )
  `,

  Student: `
    CREATE TABLE IF NOT EXISTS Student (
      id TEXT PRIMARY KEY,
      admissionNo TEXT,
      fullName TEXT NOT NULL,
      gender TEXT NOT NULL,
      dob TEXT,
      parentName TEXT,
      parentPhone TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      classId TEXT NOT NULL,
      schoolId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (classId) REFERENCES Class(id) ON DELETE CASCADE,
      FOREIGN KEY (schoolId) REFERENCES School(id) ON DELETE CASCADE
    )
  `,

  Subject: `
    CREATE TABLE IF NOT EXISTS Subject (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      shortName TEXT,
      schoolType TEXT NOT NULL,
      schoolId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (schoolId) REFERENCES School(id) ON DELETE CASCADE
    )
  `,

  ClassSubject: `
    CREATE TABLE IF NOT EXISTS ClassSubject (
      id TEXT PRIMARY KEY,
      classId TEXT NOT NULL,
      subjectId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (classId) REFERENCES Class(id) ON DELETE CASCADE,
      FOREIGN KEY (subjectId) REFERENCES Subject(id) ON DELETE CASCADE,
      UNIQUE(classId, subjectId)
    )
  `,

  TeacherSubject: `
    CREATE TABLE IF NOT EXISTS TeacherSubject (
      id TEXT PRIMARY KEY,
      teacherId TEXT NOT NULL,
      subjectId TEXT NOT NULL,
      classId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (teacherId) REFERENCES Teacher(id) ON DELETE CASCADE,
      FOREIGN KEY (subjectId) REFERENCES Subject(id) ON DELETE CASCADE,
      FOREIGN KEY (classId) REFERENCES Class(id) ON DELETE CASCADE,
      UNIQUE(teacherId, subjectId, classId)
    )
  `,

  Exam: `
    CREATE TABLE IF NOT EXISTS Exam (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      examType TEXT NOT NULL,
      classId TEXT NOT NULL,
      schoolId TEXT NOT NULL,
      academicYear TEXT NOT NULL,
      term TEXT NOT NULL,
      examDate TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (classId) REFERENCES Class(id) ON DELETE CASCADE,
      FOREIGN KEY (schoolId) REFERENCES School(id) ON DELETE CASCADE
    )
  `,

  MarksEntry: `
    CREATE TABLE IF NOT EXISTS MarksEntry (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      classSubjectId TEXT NOT NULL,
      examId TEXT NOT NULL,
      marks REAL,
      grade TEXT,
      remarks TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (studentId) REFERENCES Student(id) ON DELETE CASCADE,
      FOREIGN KEY (classSubjectId) REFERENCES ClassSubject(id) ON DELETE CASCADE,
      FOREIGN KEY (examId) REFERENCES Exam(id) ON DELETE CASCADE,
      UNIQUE(studentId, classSubjectId, examId)
    )
  `,

  Attendance: `
    CREATE TABLE IF NOT EXISTS Attendance (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      classId TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (studentId) REFERENCES Student(id) ON DELETE CASCADE,
      FOREIGN KEY (classId) REFERENCES Class(id) ON DELETE CASCADE,
      UNIQUE(studentId, classId, date)
    )
  `,

  Tabia: `
    CREATE TABLE IF NOT EXISTS Tabia (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      classId TEXT NOT NULL,
      examId TEXT,
      discipline TEXT,
      hygiene TEXT,
      hardWorking TEXT,
      cooperation TEXT,
      honesty TEXT,
      leadership TEXT,
      sports TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (studentId) REFERENCES Student(id) ON DELETE CASCADE,
      FOREIGN KEY (classId) REFERENCES Class(id) ON DELETE CASCADE,
      FOREIGN KEY (examId) REFERENCES Exam(id) ON DELETE SET NULL,
      UNIQUE(studentId, classId, examId)
    )
  `,

  StudentResult: `
    CREATE TABLE IF NOT EXISTS StudentResult (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      examId TEXT NOT NULL,
      classId TEXT NOT NULL,
      totalMarks REAL,
      averageMarks REAL,
      grade TEXT,
      division TEXT,
      points INTEGER,
      rank INTEGER,
      status TEXT NOT NULL DEFAULT 'INCOMPLETE',
      subjectCount INTEGER NOT NULL DEFAULT 0,
      classTeacherComment TEXT,
      headTeacherComment TEXT,
      closingDate TEXT,
      openingDate TEXT,
      classTeacherSign TEXT,
      headTeacherSign TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (studentId) REFERENCES Student(id) ON DELETE CASCADE,
      FOREIGN KEY (examId) REFERENCES Exam(id) ON DELETE CASCADE,
      FOREIGN KEY (classId) REFERENCES Class(id) ON DELETE CASCADE,
      UNIQUE(studentId, examId)
    )
  `,

  GradingConfig: `
    CREATE TABLE IF NOT EXISTS GradingConfig (
      id TEXT PRIMARY KEY,
      schoolType TEXT NOT NULL,
      grade TEXT NOT NULL,
      minMark INTEGER NOT NULL,
      maxMark INTEGER NOT NULL,
      remarks TEXT NOT NULL,
      points INTEGER,
      division TEXT,
      schoolId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (schoolId) REFERENCES School(id) ON DELETE CASCADE
    )
  `,

  BackupLog: `
    CREATE TABLE IF NOT EXISTS BackupLog (
      id TEXT PRIMARY KEY,
      fileName TEXT NOT NULL,
      backupType TEXT NOT NULL,
      fileSize TEXT,
      createdAt TEXT NOT NULL
    )
  `,

  AppSetting: `
    CREATE TABLE IF NOT EXISTS AppSetting (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL
    )
  `,

  SmsHistory: `
    CREATE TABLE IF NOT EXISTS SmsHistory (
      id TEXT PRIMARY KEY,
      recipient TEXT NOT NULL,
      studentId TEXT,
      studentName TEXT NOT NULL,
      classId TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      sentAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `
}

// Create all tables
export const CREATE_ALL_TABLES = Object.values(TABLES).join(';\n')

// Create indexes for performance
export const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_student_class ON Student(classId)',
  'CREATE INDEX IF NOT EXISTS idx_student_school ON Student(schoolId)',
  'CREATE INDEX IF NOT EXISTS idx_student_status ON Student(status)',
  'CREATE INDEX IF NOT EXISTS idx_student_name ON Student(fullName)',
  'CREATE INDEX IF NOT EXISTS idx_class_school ON Class(schoolId)',
  'CREATE INDEX IF NOT EXISTS idx_class_teacher ON Class(classTeacherId)',
  'CREATE INDEX IF NOT EXISTS idx_class_teacher_assignment_school ON ClassTeacherAssignment(schoolId)',
  'CREATE INDEX IF NOT EXISTS idx_class_teacher_assignment_class ON ClassTeacherAssignment(classId)',
  'CREATE INDEX IF NOT EXISTS idx_class_teacher_assignment_teacher ON ClassTeacherAssignment(teacherId)',
  'CREATE INDEX IF NOT EXISTS idx_class_teacher_assignment_status ON ClassTeacherAssignment(status)',
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_class_teacher_assignment_one_active ON ClassTeacherAssignment(schoolId, classId, academicYear) WHERE status = 'ACTIVE'",
  'CREATE INDEX IF NOT EXISTS idx_subject_school ON Subject(schoolId)',
  'CREATE INDEX IF NOT EXISTS idx_teacher_school ON Teacher(schoolId)',
  'CREATE INDEX IF NOT EXISTS idx_exam_class ON Exam(classId)',
  'CREATE INDEX IF NOT EXISTS idx_exam_school ON Exam(schoolId)',
  'CREATE INDEX IF NOT EXISTS idx_exam_year_term ON Exam(academicYear, term)',
  'CREATE INDEX IF NOT EXISTS idx_marks_student ON MarksEntry(studentId)',
  'CREATE INDEX IF NOT EXISTS idx_marks_exam ON MarksEntry(examId)',
  'CREATE INDEX IF NOT EXISTS idx_marks_classSubject ON MarksEntry(classSubjectId)',
  'CREATE INDEX IF NOT EXISTS idx_attendance_student ON Attendance(studentId)',
  'CREATE INDEX IF NOT EXISTS idx_attendance_date ON Attendance(date)',
  'CREATE INDEX IF NOT EXISTS idx_result_student ON StudentResult(studentId)',
  'CREATE INDEX IF NOT EXISTS idx_result_exam ON StudentResult(examId)',
  'CREATE INDEX IF NOT EXISTS idx_grading_school ON GradingConfig(schoolId)',
  'CREATE INDEX IF NOT EXISTS idx_sms_history_sentAt ON SmsHistory(sentAt)',
  'CREATE INDEX IF NOT EXISTS idx_sms_history_status ON SmsHistory(status)',
  'CREATE INDEX IF NOT EXISTS idx_sms_history_student ON SmsHistory(studentId)',
  'CREATE INDEX IF NOT EXISTS idx_device_school ON Device(schoolId)',
  'CREATE INDEX IF NOT EXISTS idx_device_user ON Device(userId)',
  'CREATE INDEX IF NOT EXISTS idx_device_deviceId ON Device(deviceId)',
  'CREATE INDEX IF NOT EXISTS idx_invitation_school ON Invitation(schoolId)',
  'CREATE INDEX IF NOT EXISTS idx_invitation_sender ON Invitation(senderId)',
  'CREATE INDEX IF NOT EXISTS idx_invitation_code ON Invitation(inviteCode)',
  'CREATE INDEX IF NOT EXISTS idx_invitation_status ON Invitation(status)',
]

export const CREATE_ALL_INDEXES = INDEXES.join(';\n')
