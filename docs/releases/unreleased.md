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

- Split layout for task modals on wide screens (900px+)
  - Details editor appears in a dedicated right column when the modal is expanded
  - New setting "Split layout on wide screens" in Modal Fields settings tab to toggle this behavior
  - Improves usability by showing form fields and details side-by-side

## Changed

- Refactored task modal architecture to use template method pattern
  - `TaskModal` base class now provides shared `createModalContent()` structure
  - Subclasses (`TaskCreationModal`, `TaskEditModal`) override hook methods for customization
  - Reduces code duplication and improves maintainability
- Input fields in task modals now use transparent backgrounds for a cleaner appearance

## Fixed

- (#1330) Fixed calendar view taking 5 seconds to load and respond to user interactions
  - Initial calendar load is now immediate again
  - User interactions (drag/drop, creating timeblocks, etc.) respond instantly
  - Removed redundant date filtering (FullCalendar handles this more efficiently)
  - Thanks to @ysafonov, @kmaustral, @sunjiawe for reporting, and @Мизгирь, @FiliusIcari for contributing to the discussion

