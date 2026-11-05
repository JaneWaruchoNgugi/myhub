-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "anchorDay" INTEGER;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "anchorDay" INTEGER;

-- Backfill: existing bills/subscriptions keep the day of month they currently fall on.
UPDATE "Bill" SET "anchorDay" = EXTRACT(DAY FROM "nextDueDate")::int WHERE "anchorDay" IS NULL;
UPDATE "Subscription" SET "anchorDay" = EXTRACT(DAY FROM "nextBillingDate")::int WHERE "anchorDay" IS NULL;
