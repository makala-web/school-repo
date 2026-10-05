import { NextRequest, NextResponse } from 'next/server'
import { ConnectionManager } from '@/services/database/ConnectionManager'

function rejectProductionAccess() {
  return process.env.NODE_ENV === 'production'
    ? NextResponse.json({ error: 'Not found' }, { status: 404 })
    : null
}

export async function POST(request: NextRequest) {
  const blocked = rejectProductionAccess()
  if (blocked) return blocked
  try {
    const body = await request.json()
    const mode = body?.mode as 'prisma' | 'sqlite' | 'auto' | undefined
    if (!mode) return NextResponse.json({ error: 'mode is required' }, { status: 400 })
    ConnectionManager.setMode(mode)
    return NextResponse.json({ message: 'mode set', mode: ConnectionManager.getMode() })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function GET() {
  const blocked = rejectProductionAccess()
  if (blocked) return blocked
  return NextResponse.json({ mode: ConnectionManager.getMode() })
}
