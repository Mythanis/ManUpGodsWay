# Lesson Management Feature - Manual Testing Guide

## Overview
This document provides instructions for manually testing the admin lesson management interface since automated e2e testing is blocked by OIDC authentication configuration.

## Prerequisites
1. Admin account with role set to 'admin' or 'owner' in the database
2. Access to the application at /admin route
3. At least one study created to test lesson management

## Feature Checklist

### 1. Access Lesson Management
- [ ] Log in as admin user
- [ ] Navigate to /admin
- [ ] Verify "Admin Panel" page loads with tabs
- [ ] Click on a study's "Manage Lessons" button
- [ ] Verify lesson management dialog opens

### 2. Rich Text Editor
- [ ] Click "Add New Lesson"
- [ ] Verify rich text editor toolbar appears with formatting buttons
- [ ] Type text in the content area
- [ ] Test Bold formatting (B button)
- [ ] Test Italic formatting (I button)  
- [ ] Test Underline formatting (U button)
- [ ] Test Heading (H3 button)
- [ ] Test Bullet List (• List button)
- [ ] Test Numbered List (1. List button)
- [ ] Verify formatted content persists when saving

### 3. Question Builder
- [ ] Click "Add Question" button
- [ ] Verify question card appears
- [ ] Fill in question text
- [ ] Select question type (Reflection/Application/Discussion)
- [ ] Add multiple questions
- [ ] Delete a question
- [ ] Verify questions are saved with the lesson

### 4. Lesson CRUD Operations
**Create:**
- [ ] Fill all required fields (Title, Content)
- [ ] Add optional fields (Scripture, Key Takeaway, Questions)
- [ ] Click "Save Lesson"
- [ ] Verify success toast appears
- [ ] Verify lesson appears in "Existing Lessons" list

**Read:**
- [ ] Verify lesson displays Day number badge
- [ ] Verify lesson shows title and content preview
- [ ] Verify scripture reference displays if present

**Update:**
- [ ] Click edit button on existing lesson
- [ ] Verify form populates with existing data
- [ ] Verify rich text content is preserved
- [ ] Verify questions are loaded
- [ ] Update lesson details
- [ ] Click "Update Lesson"
- [ ] Verify changes appear in lesson list

**Delete:**
- [ ] Click delete button on a lesson
- [ ] Verify confirmation dialog appears
- [ ] Accept deletion
- [ ] Verify success toast
- [ ] Verify lesson removed from list

### 5. Reorder Functionality
- [ ] Create at least 2 lessons
- [ ] Verify first lesson has disabled up arrow
- [ ] Verify last lesson has disabled down arrow
- [ ] Click down arrow on first lesson
- [ ] Verify lessons swap positions
- [ ] Verify success toast
- [ ] Click up arrow to restore order

### 6. Data Validation
- [ ] Try to save lesson without title - should show error
- [ ] Try to save lesson without content - should show error
- [ ] Verify day numbers increment automatically
- [ ] Verify display order increments automatically

## Database Verification
After testing, verify in the database:
```sql
-- Check studyLessons table
SELECT id, "studyId", "dayNumber", title, "displayOrder", questions 
FROM study_lessons 
WHERE "studyId" = '<study-id>'
ORDER BY "displayOrder";
```

Expected:
- Content stored as HTML
- Questions stored as JSONB array
- DisplayOrder reflects reordering operations
- All required fields populated

## Known Issues
- Automated e2e testing blocked by OIDC authentication configuration
- Manual testing required for full feature validation

## Implementation Details
- **Rich Text**: contentEditable div with document.execCommand
- **Questions**: JSONB array with {id, question, type} structure
- **Reordering**: Swaps displayOrder between adjacent lessons via PATCH
- **Validation**: Required fields checked before submission
