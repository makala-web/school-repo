DROP INDEX IF EXISTS "ClassTeacherAssignment_schoolId_classId_academicYear_status_key";

CREATE UNIQUE INDEX IF NOT EXISTS "ClassTeacherAssignment_one_active_per_class_year_idx"
ON "ClassTeacherAssignment"("schoolId", "classId", "academicYear")
WHERE "status" = 'ACTIVE';

CREATE INDEX IF NOT EXISTS "ClassTeacherAssignment_schoolId_classId_academicYear_status_idx"
ON "ClassTeacherAssignment"("schoolId", "classId", "academicYear", "status");
