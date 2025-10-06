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
  - Added runtime sanitization in calendar with safe defaults (00:00:00, 24:00:00, 08:00:00)
  - Prevents "Cannot read properties of null (reading 'years')" error from FullCalendar
  - Thanks to @userhandle for reporting and help debugging
```

-->

## Fixed

- (#854) (#695) Fixed all-day ICS calendar events displaying on wrong day and appearing twice
  - All-day events now stored as date-only strings (YYYY-MM-DD) instead of UTC timestamps
  - Events display on correct calendar date regardless of user timezone (fixes issue in PST, EST, and other negative UTC offset timezones)
  - All-day events no longer appear twice in Agenda view
  - Updated all date parsing throughout the codebase to handle date-only format correctly
  - Maintains compatibility with FullCalendar and preserves iCalendar RFC 5545 semantics for VALUE=DATE events
  - Thanks to @needo37 for reporting #854 and @realJohnDoe for reporting #695
