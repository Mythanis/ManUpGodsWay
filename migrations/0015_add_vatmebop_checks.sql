-- Migration: Add VATMEBOP accountability chart table
-- One row per (user_id, year, week) with 8 discipline integer columns.
-- Values: 0=blank, 1=failed-but-repented, 2=accomplished.

CREATE TABLE IF NOT EXISTS vatmebop_checks (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  week INTEGER NOT NULL CHECK (week >= 1 AND week <= 52),
  v INTEGER NOT NULL DEFAULT 0 CHECK (v >= 0 AND v <= 2),
  a INTEGER NOT NULL DEFAULT 0 CHECK (a >= 0 AND a <= 2),
  t INTEGER NOT NULL DEFAULT 0 CHECK (t >= 0 AND t <= 2),
  m INTEGER NOT NULL DEFAULT 0 CHECK (m >= 0 AND m <= 2),
  e INTEGER NOT NULL DEFAULT 0 CHECK (e >= 0 AND e <= 2),
  b INTEGER NOT NULL DEFAULT 0 CHECK (b >= 0 AND b <= 2),
  o INTEGER NOT NULL DEFAULT 0 CHECK (o >= 0 AND o <= 2),
  p INTEGER NOT NULL DEFAULT 0 CHECK (p >= 0 AND p <= 2),
  CONSTRAINT vatmebop_user_year_week UNIQUE (user_id, year, week)
);

CREATE INDEX IF NOT EXISTS idx_vatmebop_user_year ON vatmebop_checks(user_id, year);
