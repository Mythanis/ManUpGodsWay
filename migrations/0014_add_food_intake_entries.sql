-- Migration: Add food_intake_entries table
-- Context: Task #53 — Intake tab on Fitness page.
--          Stores per-user daily food / calorie log entries.
--          meal column uses a Postgres ENUM type (meal_type) for DB-level
--          type safety rather than varchar + CHECK.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_type') THEN
    CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS food_intake_entries (
  id                   varchar        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              varchar        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date                 varchar        NOT NULL, -- YYYY-MM-DD in the user's local timezone
  meal                 meal_type      NOT NULL,
  food_name            varchar(300)   NOT NULL,
  calories_per_serving integer        NOT NULL,
  servings             real           NOT NULL DEFAULT 1,
  total_calories       integer        NOT NULL,
  created_at           timestamp      DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_intake_user_date
  ON food_intake_entries (user_id, date);
