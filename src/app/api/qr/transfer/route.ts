import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for transfer data (in production, use Redis or similar)
const transferStore = new Map<string, any>()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Cache-Control': 'no-store',
}

function json(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init?.headers || {}),
    },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, type, items, timestamp, sessionToken, deviceId } = body

    if (!id || !type || type !== 'SMS_DATA' || !Array.isArray(items)) {
      return json({ error: 'Invalid data format' }, { status: 400 })
    }

    // Store the transfer data with session info
    transferStore.set(id, {
      id,
      type,
      items,
      timestamp,
      sessionToken: sessionToken || crypto.randomUUID(),
      deviceId: deviceId || 'unknown',
      createdAt: Date.now()
    })

    // Clean up old transfers (older than 5 minutes)
    const now = Date.now()
    for (const [key, value] of transferStore.entries()) {
      if (now - value.createdAt > 5 * 60 * 1000) {
        transferStore.delete(key)
      }
    }

    return json({ 
      success: true, 
      id,
      message: 'Transfer data stored successfully',
      itemCount: items.length
    })
  } catch (error) {
    return json({ 
      error: error instanceof Error ? error.message : 'Failed to store transfer data' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const token = searchParams.get('token')

    if (!id) {
      return json({ error: 'Transfer ID is required' }, { status: 400 })
    }

    const data = transferStore.get(id)
    
    if (!data) {
      return json({ error: 'Transfer not found or expired' }, { status: 404 })
    }

    if (token && data.sessionToken && token !== data.sessionToken) {
      return json({ error: 'Wrong session token' }, { status: 403 })
    }

    // Check if transfer is expired (5 minutes)
    if (Date.now() - data.createdAt > 5 * 60 * 1000) {
      transferStore.delete(id)
      return json({ error: 'Transfer expired' }, { status: 410 })
    }

    // Return the transfer data
    return json(data)
  } catch (error) {
    return json({ 
      error: error instanceof Error ? error.message : 'Failed to retrieve transfer data' 
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return json({ error: 'Transfer ID is required' }, { status: 400 })
    }

    transferStore.delete(id)
    
    return json({ success: true, message: 'Transfer deleted' })
  } catch (error) {
    return json({ 
      error: error instanceof Error ? error.message : 'Failed to delete transfer' 
    }, { status: 500 })
  }
}
