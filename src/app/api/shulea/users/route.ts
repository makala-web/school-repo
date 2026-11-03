import { NextRequest, NextResponse } from 'next/server'
import { UserRepository } from '@/repositories'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'


function sanitizeUser(user: Record<string, unknown>) {
  const { password: _password, securityAnswer: _securityAnswer, ...safeUser } = user
  return safeUser
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = searchParams.get('schoolId')
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }
    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role === 'TEACHER' || (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== schoolId)) {
      return NextResponse.json({ error: 'User access denied' }, { status: 403 })
    }
    const users = await UserRepository.getAll({ schoolId: schoolId || undefined })

    return NextResponse.json({
      users: users.map((user) => sanitizeUser(user as unknown as Record<string, unknown>)),
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role !== 'SCHOOL_ADMIN' || !actor.schoolId) {
      return NextResponse.json({ error: 'School administrator access required' }, { status: 403 })
    }
    const body = await request.json() as { id?: string; active?: boolean; action?: string; durationAmount?: number; durationUnit?: 'DAYS' | 'MONTHS'; expiryDate?: string }
    if (body.action === 'extend-teacher-activation') {
      if (!body.id) return NextResponse.json({ error: 'Teacher account is required' }, { status: 400 })
      const target = await db.user.findUnique({ where: { id: body.id } })
      if (!target || target.schoolId !== actor.schoolId || target.role !== 'TEACHER') return NextResponse.json({ error: 'Teacher account does not belong to your school' }, { status: 404 })
      const now = new Date()
      let expiry: Date
      if (body.expiryDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.expiryDate)) return NextResponse.json({ error: 'Enter a valid end date' }, { status: 400 })
        expiry = new Date(`${body.expiryDate}T23:59:59.999Z`)
        if (Number.isNaN(expiry.getTime()) || expiry.toISOString().slice(0, 10) !== body.expiryDate) return NextResponse.json({ error: 'Enter a valid end date' }, { status: 400 })
      } else {
        if (!Number.isInteger(body.durationAmount) || (body.durationAmount || 0) < 1 || !['DAYS', 'MONTHS'].includes(body.durationUnit || '')) return NextResponse.json({ error: 'Enter a positive number of days or months' }, { status: 400 })
        const base = target.activationExpiryDate && target.activationExpiryDate > now ? new Date(target.activationExpiryDate) : now
        expiry = new Date(base)
        if (body.durationUnit === 'MONTHS') expiry.setUTCMonth(expiry.getUTCMonth() + body.durationAmount!)
        else expiry.setUTCDate(expiry.getUTCDate() + body.durationAmount!)
        expiry.setUTCHours(23, 59, 59, 999)
      }
      if (expiry <= now) return NextResponse.json({ error: 'Activation end date must be in the future' }, { status: 400 })
      const start = target.activationStartDate || now
      if (expiry < start) return NextResponse.json({ error: 'Activation end date must be after its start date' }, { status: 400 })
      const updated = await db.$transaction(async tx => {
        const user = await tx.user.update({ where: { id: target.id }, data: { activationStartDate: start, activationExpiryDate: expiry } })
        await tx.auditLog.create({ data: { action: 'TEACHER_ACTIVATION_EXTENDED', entityType: 'USER', entityId: target.id, schoolId: actor.schoolId!, userId: actor.id, changes: JSON.stringify({ previousStart: target.activationStartDate, previousExpiry: target.activationExpiryDate, activationStartDate: start, activationExpiryDate: expiry }), details: `Teacher activation updated for ${target.fullName}` } })
        return user
      })
      return NextResponse.json({ message: 'Teacher activation updated successfully', user: sanitizeUser(updated as unknown as Record<string, unknown>) })
    }
    if (!body.id || typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'User ID and active status are required' }, { status: 400 })
    }
    if (body.id === actor.id) {
      return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 })
    }
    const target = await UserRepository.getById(body.id)
    if (!target || target.schoolId !== actor.schoolId) {
      return NextResponse.json({ error: 'User does not belong to your school' }, { status: 403 })
    }
    if (target.role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Platform administrator accounts cannot be changed here' }, { status: 403 })
    }
    const user = await UserRepository.update(target.id, { active: body.active })
    return NextResponse.json({ message: body.active ? 'User activated successfully' : 'User deactivated successfully', user: sanitizeUser(user as unknown as Record<string, unknown>) })
  } catch (error) {
    console.error('Error updating user status:', error)
    return NextResponse.json({ error: 'Failed to update user status' }, { status: 500 })
  }
}
