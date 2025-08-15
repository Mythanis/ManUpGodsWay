-- Add original participant names column to conversations table
ALTER TABLE conversations ADD COLUMN original_participant_names TEXT;