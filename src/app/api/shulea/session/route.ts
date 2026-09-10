import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthenticatedUser, revokeAuthSession } from '@/lib/server-auth'

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 })
  return NextResponse.json({ authenticated: true, user: { id: user.id, email: user.email, role: user.role, schoolId: user.schoolId, isDemoUser: user.isDemoUser } })
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const response = NextResponse.json({ message: 'Signed out' })
  if (body.action === 'logout-all') {
    await db.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
    response.cookies.set('shulea_session', '', { httpOnly: true, expires: new Date(0), path: '/' })
    return response
  }
  await revokeAuthSession(request, response)
  return response
}
