import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateDemoEndDate, getSchoolLicenseStatus, isLicenseActiveForSchool, DEMO_ACCESS_DETAILS } from './access-control'

test('demo access stays valid for 30 days from creation', () => {
  const createdAt = new Date('2026-09-01T00:00:00.000Z')
  const expiry = calculateDemoEndDate(createdAt)
  assert.equal(expiry.toISOString(), '2026-10-01T00:00:00.000Z')
})

test('license status correctly blocks expired access', () => {
  const result = getSchoolLicenseStatus({
    status: 'EXPIRED',
    expiryDate: '2026-01-01',
    startDate: '2025-12-01',
  })

  assert.equal(result.isActive, false)
  assert.equal(result.reason, 'EXPIRED')
})

test('demo pricing metadata remains available for sales flow', () => {
  assert.equal(DEMO_ACCESS_DETAILS.primaryPrice, 200000)
  assert.equal(DEMO_ACCESS_DETAILS.secondaryPrice, 250000)
  assert.equal(DEMO_ACCESS_DETAILS.supportPhone, '0623424892 / 0658819275')
})

test('license validation respects a valid active status', () => {
  const result = isLicenseActiveForSchool({
    status: 'ACTIVE',
    expiryDate: '2099-12-31',
    startDate: '2026-01-01',
  })

  assert.equal(result, true)
})
