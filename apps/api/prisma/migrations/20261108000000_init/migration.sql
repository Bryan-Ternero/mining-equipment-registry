-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "equipment_types" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maintenanceIntervalHours" INTEGER NOT NULL,

    CONSTRAINT "equipment_types_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "typeCode" TEXT NOT NULL,
    "hourmeter" DECIMAL(10,1) NOT NULL DEFAULT 0,
    "lastServiceHours" DECIMAL(10,1) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "hourmeter" DECIMAL(10,1) NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_code_key" ON "equipment"("code");

-- CreateIndex
CREATE INDEX "equipment_typeCode_idx" ON "equipment"("typeCode");

-- CreateIndex
CREATE INDEX "maintenance_records_equipmentId_performedAt_idx" ON "maintenance_records"("equipmentId", "performedAt");

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_typeCode_fkey" FOREIGN KEY ("typeCode") REFERENCES "equipment_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain rules also enforced by the database (Prisma does not model CHECK constraints)
ALTER TABLE "equipment_types" ADD CONSTRAINT "equipment_types_interval_positive" CHECK ("maintenanceIntervalHours" > 0);
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_hourmeter_non_negative" CHECK ("hourmeter" >= 0);
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_cycle_not_negative" CHECK ("lastServiceHours" >= 0 AND "lastServiceHours" <= "hourmeter");
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_hourmeter_non_negative" CHECK ("hourmeter" >= 0);

-- Reference data: equipment types and their maintenance interval in hours
INSERT INTO "equipment_types" ("code", "name", "maintenanceIntervalHours") VALUES
    ('CAMION', 'Camión', 250),
    ('EXCAVADORA', 'Excavadora', 500),
    ('PERFORADORA', 'Perforadora', 300);

