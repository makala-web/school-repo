const base = 'http://localhost:3000'

async function api(path, opts = {}) {
  const res = await fetch(base + path, opts)
  const txt = await res.text()
  try { return JSON.parse(txt) } catch { return txt }
}

async function registerUser(email, username, password, fullName, schoolType, schoolId) {
  return api('/api/shulea/auth', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'register', email, username, password, fullName, schoolType, securityQuestion: 'What is your tribe?', securityAnswer: 'x', schoolId }) })
}

async function login(email, password) {
  return api('/api/shulea/auth', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'login', email, password }) })
}

async function createSchool(name, schoolType) {
  return api('/api/shulea/school', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, schoolType }) })
}

async function addStudent(student) {
  return api('/api/shulea/students', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(student) })
}

async function listStudents(params) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return api('/api/shulea/students' + qs)
}

async function run() {
  console.log('Creating School A')
  const schoolA = await createSchool('Test School A', 'PRIMARY')
  console.log('School A:', schoolA)
  const schoolB = await createSchool('Test School B', 'PRIMARY')
  console.log('School B:', schoolB)

  console.log('Register Account A')
  const a = await registerUser('a@example.com','usera','Passw0rd!','User A','PRIMARY', schoolA?.school?.id || schoolA?.id)
  console.log('Register A:', a)

  console.log('Register Account B')
  const b = await registerUser('b@example.com','userb','Passw0rd!','User B','PRIMARY', schoolB?.school?.id || schoolB?.id)
  console.log('Register B:', b)

  console.log('Login A')
  const la = await login('a@example.com','Passw0rd!')
  console.log('Login A result:', la)

  console.log('Create class for A')
  const classA = await api('/api/shulea/classes', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: 'Class One', fullName: 'Class One A', schoolType: 'PRIMARY', schoolId: schoolA?.school?.id || schoolA?.id }) })
  console.log('Class A:', classA)

  console.log('Add student under A')
  const studentA = await addStudent({ fullName: 'Student A1', gender: 'M', classId: classA?.id || classA?.class?.id, schoolId: schoolA?.school?.id || schoolA?.id })
  console.log('Student A created:', studentA)

  // Create an exam and a result for Student A
  console.log('Create exam for A')
  const examA = await api('/api/shulea/exams', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: 'Midterm', examType: 'MIDTERM', classId: classA?.id || classA?.class?.id, schoolId: schoolA?.school?.id || schoolA?.id, academicYear: '2026', term: 'FIRST TERM' }) })
  console.log('Exam A:', examA)

  console.log('Create result for Student A')
  const resultA = await api('/api/shulea/results', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ studentId: studentA?.student?.id || studentA?.id, examId: examA?.exam?.id || examA?.id, classId: classA?.id || classA?.class?.id, totalMarks: 300, averageMarks: 75, status: 'COMPLETE' }) })
  console.log('Result A:', resultA)

  console.log('Login B')
  const lb = await login('b@example.com','Passw0rd!')
  console.log('Login B result:', lb)

  console.log('List students without filters (should not return A students)')
  const studentsNoFilter = await listStudents()
  console.log('Students no filter:', studentsNoFilter)

  console.log('List students for school B')
  const studentsB = await listStudents({ schoolId: schoolB?.school?.id || schoolB?.id })
  console.log('Students for B:', studentsB)

  console.log('List students for school A')
  const studentsA = await listStudents({ schoolId: schoolA?.school?.id || schoolA?.id })
  console.log('Students for A:', studentsA)

  // Scenario 2: backup/export from School A and attempt to restore into School B
  console.log('\n--- Scenario 2: Backup/Restore isolation check ---')
  console.log('Export backup for School A')
  const backupA = await api('/api/shulea/backup', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action: 'export', schoolId: schoolA?.school?.id || schoolA?.id }) })
  console.log('Backup A length:', JSON.stringify(backupA).length)

  console.log('Attempt restore into School B')
  const restoreToB = await api('/api/shulea/backup', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action: 'restore', schoolId: schoolB?.school?.id || schoolB?.id, backup: backupA }) })
  console.log('Restore result into B:', restoreToB)

  console.log('List students for school B after restore')
  const studentsBAfter = await listStudents({ schoolId: schoolB?.school?.id || schoolB?.id })
  console.log('Students for B after restore:', studentsBAfter)

  // Scenario 3: simulate mobile (sqlite) mode via test API and re-run basic create/list
  console.log('\n--- Scenario 3: Simulated mobile/SQLite mode ---')
  console.log('Switching server to sqlite mode')
  const setMode = await api('/api/_test/set-mode', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ mode: 'sqlite' }) })
  console.log('Set mode response:', setMode)

  console.log('Create School A (mobile mode)')
  const mSchoolA = await createSchool('Mobile School A', 'PRIMARY')
  console.log('Mobile School A:', mSchoolA)

  console.log('Create class in mobile mode')
  const mClass = await api('/api/shulea/classes', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: 'MClass', fullName: 'Mobile Class', schoolType: 'PRIMARY', schoolId: mSchoolA?.school?.id || mSchoolA?.id }) })
  console.log('Mobile class:', mClass)

  console.log('List students (mobile mode) for mobile school')
  const mStudents = await listStudents({ schoolId: mSchoolA?.school?.id || mSchoolA?.id })
  console.log('Mobile students:', mStudents)

  // Revert mode to auto/prisma
  console.log('Reverting server mode to auto')
  await api('/api/_test/set-mode', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ mode: 'auto' }) })
}

run().catch(err=>{ console.error(err); process.exit(1) })
