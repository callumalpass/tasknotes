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

When a change has user-facing documentation, include a canonical tasknotes.dev link:

```
## Added

- Added materialized occurrence notes for recurring tasks. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#materialized-occurrence-notes) for setup and calendar behavior.
```

-->

## Fixed

- Trim surrounding whitespace from custom property keys when loading, editing and saving settings, while retaining native validation for empty and colliding keys. This does not rename properties in existing notes. Thanks to @prethrive for reporting (#2269). See [Settings](https://tasknotes.dev/settings/).
- Prevent custom list fields from duplicating wikilinks already extracted by the shared parser.
- Preserve wikilinks containing NLP triggers, including quoted links, during task capture. Thanks to @Hermegenius for reporting (#694).
- Preserve email addresses and URL fragments when extracting tags, contexts, projects and custom fields. These selectors now require start-of-input or preceding whitespace; punctuation-adjacent selectors such as `(@work)` stay literal. See [Natural Language Input](https://tasknotes.dev/features/task-management/#natural-language-selector-rules).
- Parse repeated project prefixes without leaving a stray trigger in the title: `++personal` selects project `+personal`. Thanks to @prethrive for reporting (#2269).
- Parse Italian relative days `oggi`, `domani` and `dopodomani`, including `entro`/`per` Due forms, without changing links, metadata, escaped words or details. Thanks to @MarcoBarna for reporting (#2274).
