import test from 'node:test'
import assert from 'node:assert/strict'
import { getScopedStorageKey, getActiveDataScope, useAppStore } from './store'

test('getScopedStorageKey creates distinct keys for different accounts', () => {
  const keyA = getScopedStorageKey({ id: 'user-1', schoolId: 'school-1' })
  const keyB = getScopedStorageKey({ id: 'user-2', schoolId: 'school-1' })
  const keyC = getScopedStorageKey({ id: 'user-1', schoolId: 'school-2' })

  assert.notEqual(keyA, keyB)
  assert.notEqual(keyA, keyC)
  assert.equal(keyA, getScopedStorageKey({ id: 'user-1', schoolId: 'school-1' }))
})

test('getActiveDataScope resolves the logged-in user context', () => {
  useAppStore.setState({
    currentUser: {
      id: 'user-1',
      email: 'a@example.com',
      username: 'teacher-a',
      fullName: 'Teacher A',
      role: 'TEACHER',
      schoolId: 'school-1',
      schoolType: 'PRIMARY',
    },
    currentSchool: {
      id: 'school-1',
      name: 'Bright School',
      schoolType: 'PRIMARY',
    },
    schoolType: 'PRIMARY',
  })

  const scope = getActiveDataScope()

  assert.equal(scope.userId, 'user-1')
  assert.equal(scope.schoolId, 'school-1')
  assert.equal(scope.schoolType, 'PRIMARY')
})
