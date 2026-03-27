-- CreateTable
CREATE TABLE "app"."RecurringCashflowRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL,
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RecurringCashflowRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringCashflowRule_tenantId_status_nextRunAt_idx" ON "app"."RecurringCashflowRule"("tenantId", "status", "nextRunAt");

-- AddForeignKey
ALTER TABLE "app"."RecurringCashflowRule" ADD CONSTRAINT "RecurringCashflowRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "app"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
