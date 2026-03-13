-- Add one-time display support for carousel items
ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS is_one_time boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS carousel_dismissals (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  carousel_item_id varchar NOT NULL REFERENCES carousel_items(id) ON DELETE CASCADE,
  dismissed_at timestamp DEFAULT NOW(),
  UNIQUE(user_id, carousel_item_id)
);
