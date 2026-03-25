CREATE TABLE IF NOT EXISTS daily_app_reminders (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  reminder_time varchar NOT NULL DEFAULT '08:00',
  timezone varchar NOT NULL DEFAULT 'UTC',
  updated_at timestamp DEFAULT now()
);
