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

- (#440) Fixed inline task replacement not working for links with relative paths
  - Markdown links with relative paths like `[task](../../../GTD/tasks/task.md)` now display inline previews
  - Wikilinks with relative paths now work correctly
  - Removed overly aggressive path sanitization that was stripping `..` from all link paths
  - Works in both Live Preview and Reading Mode
  - Thanks to @minchinweb for reporting

- (#814) Fixed markdown links in projects field not being recognized on Project notes
  - Tasks with markdown-style project links `[text](path)` now appear in project's Subtasks section
  - Updated project link detection to use `parseLinkToPath` utility which handles both wikilinks and markdown links
  - Handles URL-encoded paths like `[z Test Project](z%20Test%20Project.md)`
  - Thanks to @minchinweb for reporting

- (#827) Fixed project links being generated as markdown links for users with markdown links enabled in Obsidian settings
  - Project links in frontmatter are now always generated as wikilinks `[[link]]` by default for Obsidian compatibility
  - Obsidian does not support markdown links in frontmatter properties without third-party plugins
  - Added optional setting to enable markdown links in frontmatter for users with `obsidian-frontmatter-markdown-links` plugin
  - Setting only appears when user has markdown links enabled globally in Obsidian
  - Thanks to @nightroman for reporting
