import { NextRequest, NextResponse } from 'next/server'
import { UserRepository } from '@/repositories'
import { getAuthenticatedUser } from '@/lib/server-auth'


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
    const body = await request.json() as { id?: string; active?: boolean }
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
