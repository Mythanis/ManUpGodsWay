-- Migration: Reset any persisted light/system theme preferences to dark
-- Context: Light mode support was removed entirely from the app (Task #27).
--          Any users who previously chose 'light' or 'system' must be reset
--          to 'dark' so the server-side preference no longer conflicts with
--          the hard-locked dark UI.
-- Applied: 2026-03-27 (dev) — 3 rows updated.

UPDATE users
SET theme_preference = 'dark'
WHERE theme_preference IN ('light', 'system');
