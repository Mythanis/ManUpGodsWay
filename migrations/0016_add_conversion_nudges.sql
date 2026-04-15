ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "conversion_nudges_sent" jsonb DEFAULT '{}';
