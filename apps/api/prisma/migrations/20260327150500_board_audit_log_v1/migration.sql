-- CreateTable
CREATE TABLE "app"."BoardAuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardAuditEvent_tenantId_createdAt_idx" ON "app"."BoardAuditEvent"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "app"."BoardAuditEvent" ADD CONSTRAINT "BoardAuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "app"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
