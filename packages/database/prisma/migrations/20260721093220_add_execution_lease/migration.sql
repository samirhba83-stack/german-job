-- CreateTable
CREATE TABLE "execution_leases" (
    "key" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "fencingToken" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "execution_leases_pkey" PRIMARY KEY ("key")
);
