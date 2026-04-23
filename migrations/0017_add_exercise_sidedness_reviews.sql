CREATE TABLE IF NOT EXISTS exercise_sidedness_reviews (
  id serial PRIMARY KEY,
  exercise_id integer NOT NULL UNIQUE,
  exercise_name varchar NOT NULL,
  proposed_sidedness varchar NOT NULL,
  reasoning text NOT NULL,
  confidence varchar NOT NULL DEFAULT 'high',
  raw_model_response text,
  status varchar NOT NULL DEFAULT 'pending',
  approved_sidedness varchar,
  reviewed_at timestamp,
  processed_at timestamp DEFAULT now()
);
