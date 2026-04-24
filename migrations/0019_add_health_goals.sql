CREATE TABLE IF NOT EXISTS health_goals (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_type varchar(20) NOT NULL,
  target_value real NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS health_goals_user_metric_idx ON health_goals (user_id, metric_type);
