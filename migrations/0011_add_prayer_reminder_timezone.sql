ALTER TABLE prayer_reminders ADD COLUMN IF NOT EXISTS timezone varchar DEFAULT 'UTC';
