ALTER TABLE "User" ADD COLUMN "activationStartDate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "activationExpiryDate" TIMESTAMP(3);
ALTER TABLE "Invitation" ADD COLUMN "teacherShortName" TEXT;
