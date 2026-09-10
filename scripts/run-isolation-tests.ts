const base = 'http://localhost:3000'

async function api(path: string, opts: any = {}) {
  const res = await fetch(base + path, opts)
  const txt = await res.text()
  try { return JSON.parse(txt) } catch { return txt }
}

async function registerUser(email: string, username: string, password: string, fullName: string, schoolType: string, schoolId?: string) {
  return api('/api/shulea/auth', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'register', email, username, password, fullName, schoolType, securityQuestion: 'What is your tribe?', securityAnswer: 'x', schoolId }) })
}

async function login(email: string, password: string) {
  return api('/api/shulea/auth', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'login', email, password }) })
}

async function createSchool(name: string, schoolType: string) {
  return api('/api/shulea/school', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, schoolType }) })
}

async function addStudent(token: any, student: any) {
  // mobile mode calls apiCallMobile; web uses fetch to /api/shulea/students
  return api('/api/shulea/students', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(student) })
}

async function listStudents(params?: any) {
  const qs = params ? '?' + new URLSearchParams(params as any).toString() : ''
  return api('/api/shulea/students' + qs)
}

async function run() {
  console.log('Creating School A')
  const schoolA = await createSchool('Test School A', 'PRIMARY')
  console.log('School A:', schoolA)
  const schoolB = await createSchool('Test School B', 'PRIMARY')
  console.log('School B:', schoolB)

  // Register two users
  console.log('Register Account A')
  const a = await registerUser('a@example.com','usera','Passw0rd!','User A','PRIMARY', schoolA?.school?.id || schoolA?.id || undefined)
  console.log('Register A:', a)

  console.log('Register Account B')
  const b = await registerUser('b@example.com','userb','Passw0rd!','User B','PRIMARY', schoolB?.school?.id || schoolB?.id || undefined)
  console.log('Register B:', b)

  console.log('Login A')
  const la = await login('a@example.com','Passw0rd!')
  console.log('Login A result:', la)

  // Create class for A
  console.log('Create class for A')
  const classA = await api('/api/shulea/classes', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: 'Class One', schoolId: schoolA?.school?.id || schoolA?.id }) })
  console.log('Class A:', classA)

  // Add a student under A
  console.log('Add student under A')
  const studentA = await addStudent(null, { fullName: 'Student A1', gender: 'M', classId: classA?.id || classA?.class?.id, schoolId: schoolA?.school?.id || schoolA?.id })
  console.log('Student A created:', studentA)

  // Logout simulation by not using cookies

  // Login B and list students in Primary
  console.log('Login B')
  const lb = await login('b@example.com','Passw0rd!')
  console.log('Login B result:', lb)

  console.log('List students without filters (should not return A students)')
  const studentsNoFilter = await listStudents()
  console.log('Students no filter:', studentsNoFilter)

  console.log('List students for school B')
  const studentsB = await listStudents({ schoolId: schoolB?.school?.id || schoolB?.id })
  console.log('Students for B:', studentsB)

  console.log('List students for school A (as B)')
  const studentsA = await listStudents({ schoolId: schoolA?.school?.id || schoolA?.id })
  console.log('Students for A:', studentsA)
}

run().catch(err=>{ console.error(err); process.exit(1) })
