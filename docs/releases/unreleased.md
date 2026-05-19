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

## Fixed

- (#1906) Fixed NLP priority shortcuts leaving partial text in task titles when custom priority values include words like `high` or `low`.
  - Thanks to @RumiaKitinari for reporting the issue.
- (#1901) Fixed the task context menu creating an `undefined` property when adding or removing tags.
  - Hardened task property updates so invalid frontmatter property names are rejected instead of written.
  - Thanks to @mgrecar for reporting the issue.
- (#1902) Fixed Markdown-style project links in task frontmatter not appearing as subtasks on project pages.
  - Thanks to @minchinweb for reporting the issue.

## Changed

- Improved internal boundaries for service notifications, vault writes, and pure utilities to make the codebase easier to maintain.
