-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CENTRAL', 'STATE', 'DISTRICT', 'PROJECT_OFFICER', 'CITIZEN');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('HIGHWAY', 'RAIL', 'CORRIDOR', 'IRRIGATION', 'AIRPORT', 'POWER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AcquisitionStatus" AS ENUM ('NOT_STARTED', 'VERIFICATION', 'NOTIFICATION', 'OBJECTION', 'COMPENSATION_PROCESSING', 'COMPENSATION_PAID', 'POSSESSION', 'ACQUIRED', 'LEGAL_DISPUTE');

-- CreateEnum
CREATE TYPE "LegalStatus" AS ENUM ('NONE', 'DISPUTE_PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "RRStatus" AS ENUM ('NOT_ASSESSED', 'ELIGIBLE', 'DOCS_PENDING', 'PROCESSING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('OWNERSHIP', 'SURVEY', 'NOTIFICATION', 'COMPENSATION', 'LEGAL', 'RR');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'VERIFIED', 'MISMATCH');

-- CreateEnum
CREATE TYPE "CompensationStatus" AS ENUM ('NOT_ASSESSED', 'PARTIALLY_PAID', 'FULLY_PAID');

-- CreateEnum
CREATE TYPE "LegalCaseStatus" AS ENUM ('OPEN', 'CLOSED', 'UNDER_INVESTIGATION');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('FIELD_VERIFICATION', 'DOCUMENT_REVIEW', 'COMPENSATION_CALCULATION', 'LEGAL_PROCESSING', 'RR_PROCESSING', 'SITE_VISIT', 'MEETING', 'REPORT_GENERATION');

-- CreateEnum
CREATE TYPE "ProjectRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProjectType" NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "totalParcels" INTEGER NOT NULL,
    "landRequiredAcres" DOUBLE PRECISION NOT NULL,
    "landAcquiredAcres" DOUBLE PRECISION NOT NULL,
    "compensationAssessed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "compensationPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskScore" DOUBLE PRECISION,
    "riskLevel" "ProjectRiskLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Landowner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactInfo" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Landowner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandParcel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parcelCode" TEXT NOT NULL,
    "surveyNumber" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "areaAcres" DOUBLE PRECISION NOT NULL,
    "village" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "acquisitionStatus" "AcquisitionStatus" NOT NULL,
    "legalStatus" "LegalStatus" NOT NULL,
    "rrStatus" "RRStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandParcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL,
    "extractedFields" JSONB,
    "dbComparisonResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compensation" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "assessedAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "CompensationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Compensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalCase" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "status" "LegalCaseStatus" NOT NULL,
    "daysPending" INTEGER NOT NULL,
    "responsibleDept" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RRRecord" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "status" "RRStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RRRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parcelId" TEXT,
    "type" "TaskType" NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleRole" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "daysPending" INTEGER NOT NULL,
    "priority" "TaskPriority" NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assigneeId" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_state_district_idx" ON "User"("state", "district");

-- CreateIndex
CREATE INDEX "Project_state_district_idx" ON "Project"("state", "district");

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "LandParcel_parcelCode_key" ON "LandParcel"("parcelCode");

-- CreateIndex
CREATE INDEX "LandParcel_projectId_idx" ON "LandParcel"("projectId");

-- CreateIndex
CREATE INDEX "LandParcel_ownerId_idx" ON "LandParcel"("ownerId");

-- CreateIndex
CREATE INDEX "LandParcel_parcelCode_idx" ON "LandParcel"("parcelCode");

-- CreateIndex
CREATE INDEX "Document_parcelId_idx" ON "Document"("parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "Compensation_parcelId_key" ON "Compensation"("parcelId");

-- CreateIndex
CREATE INDEX "Compensation_parcelId_idx" ON "Compensation"("parcelId");

-- CreateIndex
CREATE INDEX "LegalCase_parcelId_idx" ON "LegalCase"("parcelId");

-- CreateIndex
CREATE INDEX "RRRecord_parcelId_idx" ON "RRRecord"("parcelId");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_parcelId_idx" ON "Task"("parcelId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandParcel" ADD CONSTRAINT "LandParcel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandParcel" ADD CONSTRAINT "LandParcel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Landowner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compensation" ADD CONSTRAINT "Compensation_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RRRecord" ADD CONSTRAINT "RRRecord_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
