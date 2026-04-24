CREATE TABLE "public"."Terminal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Terminal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Terminal_prefix_key" ON "public"."Terminal"("prefix");
CREATE UNIQUE INDEX "Terminal_deviceId_key" ON "public"."Terminal"("deviceId");
