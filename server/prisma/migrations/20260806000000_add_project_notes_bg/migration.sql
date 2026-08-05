-- AlterTable
-- Additive with a default, so existing rows need no backfill and the column is
-- immediately valid. Empty string means "no background chosen" — the notes view
-- then follows the OS light/dark theme, which is why the default is not a hex.
ALTER TABLE "projects" ADD COLUMN     "notesBg" TEXT NOT NULL DEFAULT '';
