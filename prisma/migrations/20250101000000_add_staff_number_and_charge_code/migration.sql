-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "staff_number" TEXT,
ADD COLUMN IF NOT EXISTS "charge_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_staff_number_key" ON "users"("staff_number") WHERE "staff_number" IS NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_staff_number_idx" ON "users"("staff_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_charge_code_idx" ON "users"("charge_code");
