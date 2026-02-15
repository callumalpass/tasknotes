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

- [Mdbase spec](https://mdbase.dev) now emits `tn_role` annotations on schema fields, allowing external tools (e.g. [mtn CLI](https://github.com/callumalpass/mdbase-tasknotes)) to discover each field's semantic role regardless of custom frontmatter names
- [Mdbase spec](https://mdbase.dev) match rules now use tag or frontmatter property matching (based on task identification settings) instead of path glob, with automatic fallback to tag matching
- [Mdbase spec](https://mdbase.dev) status field now includes `tn_completed_values` annotation, listing which status values count as completed

## Changed

- Webhook emissions moved from API controllers and MCP layer into the service/domain layer, ensuring webhooks fire consistently regardless of entry point
- Webhook runtime state now syncs automatically when plugin settings change
- Extracted shared HTTP response/body-parsing utilities into a dedicated `httpUtils` module
