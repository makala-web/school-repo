import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateInviteCode, isInvitationValid, canInviteTeachers } from '@/lib/access-control'
import { getAuthenticatedUser } from '@/lib/server-auth'

// GET: List invitations for a school
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const schoolId = searchParams.get('schoolId')
    const userId = searchParams.get('userId')
    const inviteCode = searchParams.get('inviteCode')
    const status = searchParams.get('status')

    if (inviteCode) {
      // Check specific invitation validity
      const invitation = await db.invitation.findUnique({
        where: { inviteCode },
        include: { school: true, sender: true }
      })

      if (!invitation) {
        return NextResponse.json({ success: false, error: 'Invitation not found' }, { status: 404 })
      }

      const isValid = isInvitationValid({
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
      })

      return NextResponse.json({
        success: true,
        invitation: {
          id: invitation.id,
          inviteCode: invitation.inviteCode,
          school: {
            id: invitation.school.id,
            name: invitation.school.name,
            schoolType: invitation.school.schoolType,
          },
          sender: {
            id: invitation.sender.id,
            fullName: invitation.sender.fullName,
          },
          email: invitation.email,
          fullName: invitation.fullName,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          isValid,
        }
      })
    }

    if (schoolId) {
      // List invitations for a school
      const user = await getAuthenticatedUser(request)
      if (!user || !canInviteTeachers(user.role)) {
        return NextResponse.json({ success: false, error: 'School administrator access is required' }, { status: 403 })
      }
      if (user.role !== 'SUPER_ADMIN' && user.schoolId !== schoolId) {
        return NextResponse.json({ success: false, error: 'Cross-school invitation access denied' }, { status: 403 })
      }

      const where: any = { schoolId }
      if (status) where.status = status

      const invitations = await db.invitation.findMany({
        where,
        include: {
          sender: { select: { id: true, fullName: true } },
          receiver: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' }
      })

      return NextResponse.json({
        success: true,
        invitations: invitations.map(inv => ({
          id: inv.id,
          inviteCode: inv.inviteCode,
          email: inv.email,
          fullName: inv.fullName,
          role: inv.role,
          status: inv.status,
          expiresAt: inv.expiresAt,
          acceptedAt: inv.acceptedAt,
          sender: inv.sender,
          receiver: inv.receiver,
        }))
      })
    }

    return NextResponse.json({ success: false, error: 'School ID or invite code is required' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch invitations'
    }, { status: 500 })
  }
}

// POST: Create or accept invitation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, schoolId, inviteCode, email, fullName, role, assignedClasses, assignedSubjects, expiryDays } = body

    if (action === 'create-invitation') {
      // Create teacher invitation
      const user = await getAuthenticatedUser(request)
      if (!user || !canInviteTeachers(user.role)) {
        return NextResponse.json({ success: false, error: 'School administrator access is required' }, { status: 403 })
      }

      if (!schoolId || !email) {
        return NextResponse.json({ success: false, error: 'School ID and email are required' }, { status: 400 })
      }

      if (user.role !== 'SUPER_ADMIN' && user.schoolId !== schoolId) {
        return NextResponse.json({ success: false, error: 'Cross-school invitation denied' }, { status: 403 })
      }

      const requestedRole = role === 'SCHOOL_ADMIN' && user.role === 'SUPER_ADMIN' ? 'SCHOOL_ADMIN' : 'TEACHER'
      const requestedClassIds = Array.isArray(assignedClasses)
        ? assignedClasses.filter((value: unknown): value is string => typeof value === 'string')
        : []
      const requestedSubjectIds = Array.isArray(assignedSubjects)
        ? assignedSubjects.filter((value: unknown): value is string => typeof value === 'string')
        : []

      if (requestedRole === 'TEACHER' && requestedClassIds.length === 0) {
        return NextResponse.json({ success: false, error: 'Assign at least one class before sending a teacher invitation' }, { status: 400 })
      }

      if (requestedRole === 'TEACHER') {
        const validClasses = await db.class.count({ where: { id: { in: requestedClassIds }, schoolId } })
        if (validClasses !== requestedClassIds.length) {
          return NextResponse.json({ success: false, error: 'One or more assigned classes do not belong to this school' }, { status: 400 })
        }
        if (requestedSubjectIds.length > 0) {
          const validSubjects = await db.subject.count({ where: { id: { in: requestedSubjectIds }, schoolId } })
          if (validSubjects !== requestedSubjectIds.length) {
            return NextResponse.json({ success: false, error: 'One or more assigned subjects do not belong to this school' }, { status: 400 })
          }
        }
      }

      // Check if user already belongs to this school
      const existingUser = await db.user.findFirst({
        where: { email, schoolId }
      })

      if (existingUser) {
        return NextResponse.json({ success: false, error: 'User already belongs to this school' }, { status: 400 })
      }

      // Check for pending invitation
      const pendingInvitation = await db.invitation.findFirst({
        where: { email, schoolId, status: 'PENDING' }
      })

      if (pendingInvitation) {
        return NextResponse.json({ success: false, error: 'Pending invitation already exists for this email' }, { status: 400 })
      }

      // Generate invite code and expiry
      const newInviteCode = generateInviteCode()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + (expiryDays || 7))

      const invitation = await db.invitation.create({
        data: {
          inviteCode: newInviteCode,
          schoolId,
          senderId: user.id,
          email,
          fullName: fullName || null,
          role: requestedRole,
          assignedClasses: JSON.stringify(requestedClassIds),
          assignedSubjects: JSON.stringify(requestedSubjectIds),
          status: 'PENDING',
          expiresAt: expiresAt.toISOString(),
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Invitation created successfully',
        invitation: {
          id: invitation.id,
          inviteCode: invitation.inviteCode,
          email: invitation.email,
          fullName: invitation.fullName,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          assignedClasses: invitation.assignedClasses ? JSON.parse(invitation.assignedClasses) : [],
          assignedSubjects: invitation.assignedSubjects ? JSON.parse(invitation.assignedSubjects) : [],
          delivery: 'SERVER_SAVED',
        }
      })
    }

    if (action === 'accept-invitation') {
      // Accept invitation and join school
      const actor = await getAuthenticatedUser(request)
      if (!actor) {
        return NextResponse.json({ success: false, error: 'Sign in before accepting an invitation' }, { status: 401 })
      }
      if (!inviteCode) {
        return NextResponse.json({ success: false, error: 'Invite code is required' }, { status: 400 })
      }

      const invitation = await db.invitation.findUnique({
        where: { inviteCode },
        include: { school: true }
      })

      if (!invitation) {
        return NextResponse.json({ success: false, error: 'Invitation not found' }, { status: 404 })
      }

      // Validate invitation
      if (!isInvitationValid({
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
      })) {
        return NextResponse.json({ success: false, error: 'Invitation is invalid or expired' }, { status: 400 })
      }

      // Check if invitation email matches user email
      const user = actor
      if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        return NextResponse.json({ success: false, error: 'Invitation email does not match your email' }, { status: 400 })
      }

      // Update user to join school
      const updatedUser = await db.user.update({
        where: { id: user.id },
        data: {
          schoolId: invitation.schoolId,
          schoolType: invitation.school.schoolType,
          role: invitation.role,
        }
      })

      // Create teacher record
      const teacher = invitation.role === 'TEACHER'
        ? await db.teacher.upsert({
            where: { userId: user.id },
            update: { name: user.fullName, schoolId: invitation.schoolId },
            create: { name: user.fullName, schoolId: invitation.schoolId, userId: user.id },
          })
        : null

      // Update invitation status
      await db.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          receiverId: user.id,
          acceptedAt: new Date().toISOString(),
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Invitation accepted successfully',
        user: updatedUser,
        teacher,
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Invitation operation failed'
    }, { status: 500 })
  }
}

// DELETE: Revoke invitation
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const invitationId = searchParams.get('invitationId')

    if (!invitationId) {
      return NextResponse.json({ success: false, error: 'Invitation ID is required' }, { status: 400 })
    }

    const user = await getAuthenticatedUser(request)
    if (!user || !canInviteTeachers(user.role)) {
      return NextResponse.json({ success: false, error: 'School administrator access is required' }, { status: 403 })
    }

    const invitation = await db.invitation.findUnique({ where: { id: invitationId } })
    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Invitation not found' }, { status: 404 })
    }

    if (user.role !== 'SUPER_ADMIN' && user.schoolId !== invitation.schoolId) {
      return NextResponse.json({ success: false, error: 'Cross-school invitation access denied' }, { status: 403 })
    }

    // Only allow revoking pending invitations
    if (invitation.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Can only revoke pending invitations' }, { status: 400 })
    }

    await db.invitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' }
    })

    return NextResponse.json({ success: true, message: 'Invitation revoked successfully' })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke invitation'
    }, { status: 500 })
  }
}
