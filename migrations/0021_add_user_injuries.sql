CREATE TABLE IF NOT EXISTS user_injuries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body_area varchar NOT NULL,
  injury_type varchar NOT NULL,
  note text,
  created_at timestamp DEFAULT now()
);
