import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDeviceInfo, checkDeviceAuthorization, canManageDevices } from '@/lib/access-control'
import { getAuthenticatedUser, rejectDemoMutation } from '@/lib/server-auth'

// GET: List devices for a school
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser(request)
    if (!sessionUser) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    const searchParams = request.nextUrl.searchParams
    const schoolId = searchParams.get('schoolId')
    const userId = searchParams.get('userId')
    const deviceId = searchParams.get('deviceId')

    if (deviceId && userId) {
      // Check specific device authorization
      const device = await db.device.findFirst({
        where: { deviceId, userId },
        include: { school: true }
      })

      if (!device) {
        return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 })
      }
      if (sessionUser.role !== 'SUPER_ADMIN' && (sessionUser.id !== userId || sessionUser.schoolId !== device.schoolId)) {
        return NextResponse.json({ success: false, error: 'Device access denied' }, { status: 403 })
      }

      const school = await db.school.findUnique({ where: { id: device.schoolId } })
      const deviceCount = await db.device.count({
        where: { schoolId: device.schoolId, status: 'ACTIVE' }
      })

      const authCheck = checkDeviceAuthorization(
        {
          deviceId: device.deviceId,
          schoolId: device.schoolId,
          userId: device.userId,
          status: device.status,
          activatedAt: device.activatedAt.toISOString(),
          lastSeenAt: device.lastSeenAt.toISOString(),
        },
        school?.maxDevices || 20,
        deviceCount
      )

      return NextResponse.json({
        success: true,
        device: {
          id: device.id,
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          platform: device.platform,
          status: device.status,
          activatedAt: device.activatedAt,
          lastSeenAt: device.lastSeenAt,
        },
        authorization: authCheck
      })
    }

    if (schoolId) {
      // List devices for a school
      if (sessionUser.role !== 'SCHOOL_ADMIN' || sessionUser.schoolId !== schoolId || !canManageDevices(sessionUser.role)) {
        return NextResponse.json({ success: false, error: 'School administrator access is required' }, { status: 403 })
      }

      const devices = await db.device.findMany({
        where: { schoolId },
        include: {
          user: { select: { id: true, fullName: true, email: true } }
        },
        orderBy: { lastSeenAt: 'desc' }
      })

      return NextResponse.json({
        success: true,
        devices: devices.map(device => ({
          id: device.id,
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          platform: device.platform,
          status: device.status,
          activatedAt: device.activatedAt,
          lastSeenAt: device.lastSeenAt,
          user: device.user,
        }))
      })
    }

    return NextResponse.json({ success: false, error: 'School ID or device ID is required' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch devices'
    }, { status: 500 })
  }
}

// POST: Authorize or update device
export async function POST(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const actor = await getAuthenticatedUser(request)
    if (!actor) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    const body = await request.json()
    const { action, schoolId, userId, deviceId, deviceName, platform, userAgent } = body

    if (action === 'authorize-device') {
      // Authorize a new device for a user
      if (!schoolId || !userId || !deviceId) {
        return NextResponse.json({ success: false, error: 'School ID, user ID, and device ID are required' }, { status: 400 })
      }

      const user = await db.user.findUnique({ where: { id: userId } })
      if (!user) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      }
      if (actor.role !== 'SUPER_ADMIN' && (actor.schoolId !== schoolId || (actor.role !== 'SCHOOL_ADMIN' && actor.id !== userId))) {
        return NextResponse.json({ success: false, error: 'Device authorization denied' }, { status: 403 })
      }

      const school = await db.school.findUnique({ where: { id: schoolId } })
      if (!school) {
        return NextResponse.json({ success: false, error: 'School not found' }, { status: 404 })
      }

      // Check device limit
      const currentDeviceCount = await db.device.count({
        where: { schoolId, status: 'ACTIVE' }
      })

      const maxDevices = school.maxDevices || 20
      if (currentDeviceCount >= maxDevices) {
        return NextResponse.json({
          success: false,
          error: `Device limit reached (${maxDevices}). Please contact your school administrator.`
        }, { status: 403 })
      }

      // Check if device already exists for this user
      const existingDevice = await db.device.findFirst({
        where: { deviceId, userId }
      })

      if (existingDevice) {
        // Update last seen time
        const updatedDevice = await db.device.update({
          where: { id: existingDevice.id },
          data: {
            lastSeenAt: new Date().toISOString(),
            status: existingDevice.status === 'REVOKED' ? 'ACTIVE' : existingDevice.status,
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Device reactivated successfully',
          device: updatedDevice
        })
      }

      // Create new device record
      const device = await db.device.create({
        data: {
          deviceId,
          deviceName: deviceName || 'Unknown Device',
          platform: platform || 'Unknown',
          userAgent: userAgent || '',
          schoolId,
          userId,
          status: 'ACTIVE',
          activatedAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        }
      })

      // Update user device ID
      await db.user.update({
        where: { id: userId },
        data: { deviceId }
      })

      return NextResponse.json({
        success: true,
        message: 'Device authorized successfully',
        device
      })
    }

    if (action === 'update-last-seen') {
      // Update device last seen time (called periodically)
      if (!deviceId || !userId) {
        return NextResponse.json({ success: false, error: 'Device ID and user ID are required' }, { status: 400 })
      }
      if (actor.id !== userId) return NextResponse.json({ success: false, error: 'Device session mismatch' }, { status: 403 })

      const device = await db.device.findFirst({
        where: { deviceId, userId }
      })

      if (device) {
        await db.device.update({
          where: { id: device.id },
          data: { lastSeenAt: new Date().toISOString() }
        })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Device operation failed'
    }, { status: 500 })
  }
}

// DELETE: Revoke device
export async function DELETE(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const searchParams = request.nextUrl.searchParams
    const deviceId = searchParams.get('deviceId')
    const userId = searchParams.get('userId')
    const actorUserId = searchParams.get('actorUserId')

    if (!deviceId || !actorUserId) {
      return NextResponse.json({ success: false, error: 'Device ID and actor user ID are required' }, { status: 400 })
    }

    const sessionActor = await getAuthenticatedUser(request)
    if (!sessionActor || !canManageDevices(sessionActor.role)) {
      return NextResponse.json({ success: false, error: 'School administrator access is required' }, { status: 403 })
    }
    if (actorUserId && actorUserId !== sessionActor.id) return NextResponse.json({ success: false, error: 'Session user mismatch' }, { status: 403 })

    const device = await db.device.findFirst({ where: { deviceId } })
    if (!device) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 })
    }
    if (sessionActor.role !== 'SUPER_ADMIN' && sessionActor.schoolId !== device.schoolId) {
      return NextResponse.json({ success: false, error: 'Cross-school device access denied' }, { status: 403 })
    }

    // Revoke device
    await db.device.update({
      where: { id: device.id },
      data: {
        status: 'REVOKED',
        deactivatedAt: new Date().toISOString(),
        deactivatedBy: sessionActor.id,
      }
    })

    return NextResponse.json({ success: true, message: 'Device revoked successfully' })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke device'
    }, { status: 500 })
  }
}
