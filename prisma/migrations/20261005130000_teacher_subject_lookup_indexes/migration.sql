CREATE INDEX "TeacherSubject_teacherId_classId_idx" ON "TeacherSubject"("teacherId", "classId");
CREATE INDEX "TeacherSubject_classId_subjectId_idx" ON "TeacherSubject"("classId", "subjectId");
