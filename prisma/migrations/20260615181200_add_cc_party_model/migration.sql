-- CreateTable
CREATE TABLE "cc_parties" (
    "id" TEXT NOT NULL,
    "clientLEId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'CLIENT_LE',
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cc_parties_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cc_parties" ADD CONSTRAINT "cc_parties_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;
