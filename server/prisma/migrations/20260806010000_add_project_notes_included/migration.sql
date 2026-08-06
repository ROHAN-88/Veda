-- AlterTable
-- Additive with a default, so existing rows need no backfill. TRUE means every
-- project already in the database shows up in the combined notes view the first
-- time it is opened, which is what someone expects to see there.
ALTER TABLE "projects" ADD COLUMN     "notesIncluded" BOOLEAN NOT NULL DEFAULT true;
