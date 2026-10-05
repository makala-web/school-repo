ALTER TABLE "MarksEntry" ADD COLUMN "recordedByUserId" TEXT;
ALTER TABLE "MarksEntry" ADD CONSTRAINT "MarksEntry_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "MarksEntry_recordedByUserId_idx" ON "MarksEntry"("recordedByUserId");
