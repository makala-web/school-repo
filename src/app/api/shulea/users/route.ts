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
