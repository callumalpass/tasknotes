# TaskNotes - Unreleased

## Bug Fixes

### Calendar View

- Fixed calendar view appearing empty in week and day views due to invalid time configuration values ([#768](https://github.com/callumalpass/tasknotes/issues/768))
- Added robust time validation in settings UI with proper error messages and debouncing
- Added runtime sanitization in calendar with safe defaults (00:00:00, 24:00:00, 08:00:00)
- Prevents "Cannot read properties of null (reading 'years')" error from FullCalendar

## New Features

(Track new features here)

## Breaking Changes

(Track breaking changes here)