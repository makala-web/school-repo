import { db } from '@/lib/db'

export interface SyncLedgerChange {
  entityType: string
  entityId: string
  payload: unknown | null
  action?: 'UPSERT' | 'DELETE'
}

/** Append a cloud mutation to the incremental sync ledger after a direct API write. */
export async function recordSyncLedgerChanges(schoolId: string, changes: SyncLedgerChange[], operationId?: string | null) {
  const valid = changes.filter(change => change.entityId)
  if (!schoolId || valid.length === 0) return

  await db.$transaction(async tx => {
    for (const change of valid) {
      const previous = await tx.syncChange.findFirst({
        where: { schoolId, entityType: change.entityType, entityId: change.entityId },
        orderBy: { sequence: 'desc' },
        select: { version: true },
      })
      const sequence = await tx.syncSequence.upsert({
        where: { schoolId },
        create: { schoolId, nextSequence: 1 },
        update: { nextSequence: { increment: 1 } },
        select: { nextSequence: true },
      })
      const action = change.action || 'UPSERT'
      await tx.syncChange.create({
        data: {
          schoolId,
          sequence: sequence.nextSequence,
          entityType: change.entityType,
          entityId: change.entityId,
          action,
          version: (previous?.version || 0) + 1,
          operationId: operationId || undefined,
          payload: action === 'DELETE' ? null : JSON.stringify(change.payload),
          deletedAt: action === 'DELETE' ? new Date() : null,
        },
      })
    }
  })
}

export function schoolSyncPayload(school: {
  id: string
  name?: string | null
  schoolType?: string | null
  logo?: string | null
  logo2?: string | null
  registrationNo?: string | null
  council?: string | null
  region?: string | null
  district?: string | null
  ward?: string | null
  phone?: string | null
  email?: string | null
  headTeacherName?: string | null
  headTeacherSign?: string | null
  headTeacherComments?: string | null
  classTeacherName?: string | null
  classTeacherShortName?: string | null
  classTeacherComments?: string | null
  ctGradeA_en?: string | null
  ctGradeB_en?: string | null
  ctGradeC_en?: string | null
  ctGradeD_en?: string | null
  ctGradeE_en?: string | null
  ctGradeA_sw?: string | null
  ctGradeB_sw?: string | null
  ctGradeC_sw?: string | null
  ctGradeD_sw?: string | null
  ctGradeE_sw?: string | null
  htGradeA_en?: string | null
  htGradeB_en?: string | null
  htGradeC_en?: string | null
  htGradeD_en?: string | null
  htGradeE_en?: string | null
  htGradeA_sw?: string | null
  htGradeB_sw?: string | null
  htGradeC_sw?: string | null
  htGradeD_sw?: string | null
  htGradeE_sw?: string | null
  academicYear?: string | null
  term?: string | null
}) {
  // Do not expose school license/activation secrets in teacher change feeds.
  return school
}
