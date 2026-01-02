# TaskNotes - Unreleased

<!--

**Added** for new features.
**Changed** for changes in existing functionality.
**Deprecated** for soon-to-be removed features.
**Removed** for now removed features.
**Fixed** for any bug fixes.
**Security** in case of vulnerabilities.

Always acknowledge contributors and those who report issues.

Example:

```
## Fixed

- (#768) Fixed calendar view appearing empty in week and day views due to invalid time configuration values
  - Added time validation in settings UI with proper error messages and debouncing
  - Prevents "Cannot read properties of null (reading 'years')" error from FullCalendar
  - Thanks to @userhandle for reporting and help debugging
```

-->

## Added

- New Calendars API endpoints for accessing calendar provider information and events
  - `GET /api/calendars` - Overview of all calendar sources with connection status
  - `GET /api/calendars/google` - Google Calendar connection details and available calendars
  - `GET /api/calendars/microsoft` - Microsoft Calendar connection details and available calendars
  - `GET /api/calendars/subscriptions` - ICS subscription details with fetch status
  - `GET /api/calendars/events` - All calendar events with optional date range filtering

## Fixed

- (#1410) Fixed vim insert mode not activating in task creation modal
  - The 4.2.0 implementation used incorrect path to access the CodeMirror vim adapter
  - Now correctly accesses the CM5 adapter and adds a small delay for vim initialization
  - Thanks to @Leo310 for the feature request

