CREATE TABLE IF NOT EXISTS man_up_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  url varchar NOT NULL,
  icon varchar NOT NULL DEFAULT 'globe',
  icon_color varchar NOT NULL DEFAULT 'text-black',
  image_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

INSERT INTO man_up_links (name, url, icon, icon_color, display_order) VALUES
  ('Facebook', 'https://www.facebook.com/manupgodsway', 'facebook', 'text-blue-600', 1),
  ('Twitter', 'https://twitter.com/Manupgodsway1', 'twitter', 'text-blue-400', 2),
  ('Instagram', 'https://www.instagram.com/manupgodsway/', 'instagram', 'text-pink-600', 3),
  ('Man Up God''s Way Website', 'https://manupgodsway.org/', 'globe', 'text-black', 4),
  ('Man Up God''s Way Merch', 'https://kickmerch.com/collections/man-up-gods-way', 'shirt', 'text-black', 5)
ON CONFLICT DO NOTHING;