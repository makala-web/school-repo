import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { generateInviteCode } from '@/lib/access-control';

/**
 * GET /api/shulea/access-requests
 * - Super Admin: Get all requests
 * - Regular users: 404
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const actorUserId = searchParams.get('actorUserId');
    const status = searchParams.get('status');

    // Verify actor is Super Admin
    const actor = await getAuthenticatedUser(request);
    if (!actor || actor.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (actorUserId && actorUserId !== actor.id) return NextResponse.json({ error: 'Session user mismatch' }, { status: 403 });

    // Get access requests with optional status filter
    const whereClause = status ? { status } : undefined;
    const requests = await db.accessRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: { school: true }
    });

    return NextResponse.json({
      requests,
      total: requests.length
    });
  } catch (error) {
    console.error('Error fetching access requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch access requests' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shulea/access-requests
 * - Create new access request (public endpoint)
 * - Update request status (Super Admin only)
 * - Approve request (Super Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, actorUserId, ...data } = body;

    if (action === 'create') {
      return handleCreateRequest(data);
    }

    // Verify actor is Super Admin for other actions
    const actor = await getAuthenticatedUser(request);
    if (!actor || actor.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (actorUserId && actorUserId !== actor.id) return NextResponse.json({ error: 'Session user mismatch' }, { status: 403 });

    if (action === 'approve') {
      return handleApproveRequest(data, actor.id);
    }

    if (action === 'reject') {
      return handleRejectRequest(data, actor.id);
    }

    if (action === 'update-status') {
      return handleUpdateStatus(data, actor.id);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Access request error:', error);
    return NextResponse.json(
      { error: 'Failed to process access request' },
      { status: 500 }
    );
  }
}

async function handleCreateRequest(data: {
  schoolName: string;
  schoolType: string;
  contactPerson: string;
  phone: string;
  email: string;
  location?: string;
  numberOfStudents?: number;
  numberOfTeachers?: number;
  requestedPlan?: string;
  message?: string;
}) {
  // Validate required fields
  const { schoolName, schoolType, contactPerson, phone, email } = data;
  if (!schoolName || !schoolType || !contactPerson || !phone || !email) {
    return NextResponse.json(
      { error: 'School name, type, contact person, phone, and email are required' },
      { status: 400 }
    );
  }

  // Validate school type
  if (!['PRIMARY', 'SECONDARY'].includes(schoolType)) {
    return NextResponse.json(
      { error: 'School type must be PRIMARY or SECONDARY' },
      { status: 400 }
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: 'Invalid email format' },
      { status: 400 }
    );
  }

  // Check if request already exists for this email
  const existingRequest = await db.accessRequest.findFirst({
    where: {
      email: email.toLowerCase(),
      status: 'PENDING'
    }
  });

  if (existingRequest) {
    return NextResponse.json(
      { error: 'You already have a pending access request. Please wait for approval.' },
      { status: 409 }
    );
  }

  // Create access request
  const accessRequest = await db.accessRequest.create({
    data: {
      schoolName,
      schoolType,
      contactPerson,
      phone,
      email: email.toLowerCase(),
      location: data.location || null,
      numberOfStudents: data.numberOfStudents || null,
      numberOfTeachers: data.numberOfTeachers || null,
      requestedPlan: data.requestedPlan || 'STANDARD',
      message: data.message || null,
      status: 'PENDING'
    }
  });

  return NextResponse.json({
    message: 'Access request submitted successfully. You will receive an email update soon.',
    request: accessRequest
  }, { status: 201 });
}

async function handleApproveRequest(data: {
  requestId: string;
  schoolName?: string;
  licenseType?: string;
  expiryDays?: number;
}, actorUserId: string) {
  const { requestId, schoolName, licenseType = 'STANDARD', expiryDays = 365 } = data;

  if (!requestId) {
    return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
  }

  const accessRequest = await db.accessRequest.findUnique({
    where: { id: requestId }
  });

  if (!accessRequest) {
    return NextResponse.json({ error: 'Access request not found' }, { status: 404 });
  }

  // Approval is safe to retry from the admin UI after a network timeout.
  if (accessRequest.status === 'APPROVED' && accessRequest.schoolId) {
    const existingSchool = await db.school.findUnique({ where: { id: accessRequest.schoolId } });
    const existingInvitation = await db.invitation.findFirst({
      where: { schoolId: accessRequest.schoolId, email: accessRequest.email },
      orderBy: { createdAt: 'desc' },
    });
    if (existingSchool) {
      return NextResponse.json({
        message: 'Access request was already approved.',
        school: existingSchool,
        adminInvitation: existingInvitation ? {
          inviteCode: existingInvitation.inviteCode,
          email: existingInvitation.email,
          expiresAt: existingInvitation.expiresAt,
        } : null,
        activationCode: existingSchool.activationCode,
        licenseExpiryDate: existingSchool.expiryDate,
      });
    }
  }

  if (accessRequest.status !== 'PENDING' && accessRequest.status !== 'UNDER_REVIEW') {
    return NextResponse.json(
      { error: 'Only pending or under-review requests can be approved' },
      { status: 400 }
    );
  }

  // Generate school ID
  const schoolCode = Math.random().toString(36).substring(2, 7).toUpperCase();
  const schoolId = `SHL-${Date.now()}-${schoolCode}`;

  // Calculate license expiry
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiryDays);

  const { school, adminInvitation } = await db.$transaction(async (tx) => {
    const current = await tx.accessRequest.findUnique({ where: { id: requestId } });
    if (!current || (current.status !== 'PENDING' && current.status !== 'UNDER_REVIEW')) {
      throw new Error('Access request has already been processed');
    }

    const school = await tx.school.create({
      data: {
        id: schoolId,
        name: schoolName || current.schoolName,
        schoolType: current.schoolType as 'PRIMARY' | 'SECONDARY',
        licenseType,
        licenseStatus: 'ACTIVE',
        startDate: new Date().toISOString().split('T')[0],
        expiryDate: expiryDate.toISOString().split('T')[0],
        maxTeachers: 50,
        maxDevices: 50,
        maxStudents: 1000,
        activationCode: `SHL-${schoolCode}-ACTIVATION`,
        isDemo: false,
      },
    });

    const adminInvitation = await tx.invitation.create({
      data: {
        inviteCode: generateInviteCode(),
        schoolId: school.id,
        senderId: actorUserId,
        email: current.email,
        fullName: current.contactPerson,
        role: 'SCHOOL_ADMIN',
        assignedClasses: JSON.stringify([]),
        assignedSubjects: JSON.stringify([]),
        status: 'PENDING',
        expiresAt: expiryDate,
      },
    });

    await tx.accessRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', approvedBy: actorUserId, approvedAt: new Date(), schoolId: school.id },
    });
    await tx.auditLog.create({
      data: {
        action: 'ACCESS_REQUEST_APPROVED',
        entityType: 'ACCESS_REQUEST',
        entityId: requestId,
        userId: actorUserId,
        details: `Approved access request from ${current.schoolName}`,
      },
    });
    return { school, adminInvitation };
  });

  return NextResponse.json({
    message: 'Access request approved. School has been created.',
    school,
    adminInvitation: {
      inviteCode: adminInvitation.inviteCode,
      email: adminInvitation.email,
      expiresAt: adminInvitation.expiresAt,
    },
    activationCode: school.activationCode,
    licenseExpiryDate: expiryDate.toISOString().split('T')[0]
  });
}

async function handleRejectRequest(data: {
  requestId: string;
  rejectionReason: string;
}, actorUserId: string) {
  const { requestId, rejectionReason } = data;

  if (!requestId || !rejectionReason) {
    return NextResponse.json(
      { error: 'Request ID and rejection reason are required' },
      { status: 400 }
    );
  }

  const accessRequest = await db.accessRequest.findUnique({
    where: { id: requestId }
  });

  if (!accessRequest) {
    return NextResponse.json({ error: 'Access request not found' }, { status: 404 });
  }

  if (accessRequest.status !== 'PENDING' && accessRequest.status !== 'UNDER_REVIEW') {
    return NextResponse.json(
      { error: 'Only pending or under-review requests can be rejected' },
      { status: 400 }
    );
  }

  await db.accessRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      approvedBy: actorUserId,
      rejectionReason: rejectionReason,
      approvedAt: new Date()
    }
  });

  // Log audit
  await db.auditLog.create({
    data: {
      action: 'ACCESS_REQUEST_REJECTED',
      entityType: 'ACCESS_REQUEST',
      entityId: requestId,
      userId: actorUserId,
      details: `Rejected access request from ${accessRequest.schoolName}. Reason: ${rejectionReason}`
    }
  });

  return NextResponse.json({
    message: 'Access request rejected.'
  });
}

async function handleUpdateStatus(data: {
  requestId: string;
  status: string;
}, actorUserId: string) {
  const { requestId, status } = data;

  if (!requestId || !status) {
    return NextResponse.json(
      { error: 'Request ID and status are required' },
      { status: 400 }
    );
  }

  const validStatuses = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: 'Invalid status' },
      { status: 400 }
    );
  }

  const accessRequest = await db.accessRequest.findUnique({
    where: { id: requestId }
  });

  if (!accessRequest) {
    return NextResponse.json({ error: 'Access request not found' }, { status: 404 });
  }

  await db.accessRequest.update({
    where: { id: requestId },
    data: {
      status,
      approvedBy: actorUserId
    }
  });

  // Log audit
  await db.auditLog.create({
    data: {
      action: 'ACCESS_REQUEST_STATUS_UPDATED',
      entityType: 'ACCESS_REQUEST',
      entityId: requestId,
      userId: actorUserId,
      details: `Status changed to ${status}`
    }
  });

  return NextResponse.json({
    message: 'Access request status updated.',
    request: await db.accessRequest.findUnique({ where: { id: requestId } })
  });
}
