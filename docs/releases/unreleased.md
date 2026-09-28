# TaskNotes - Unreleased

## Added

- Added an [upgrade guide for TaskNotes v4 to v5](https://tasknotes.dev/migration-v4-to-v5/) covering first-launch changes, synced devices, the reorganized settings, and returning to v4.
- Added a date format setting under Appearance → Display formatting. Choose ISO 8601 dates across TaskNotes while keeping the separate 12/24-hour preference. Stored dates and custom Bases formulas are unchanged. See [Appearance settings](https://tasknotes.dev/settings/appearance/). Thanks to @spozzi99 for requesting this in [#2354](https://github.com/callumalpass/tasknotes/issues/2354).

## Security

- (#2345) The HTTP API token is now stored in Obsidian Secret Storage on each device instead of in `data.json`, so `data.json` can be kept in git or shared without exposing it. Existing tokens move automatically. Each device now has its own token: a synced device that starts TaskNotes after the token has left `data.json` generates a new one and shows a notice; copy it into that device's API and MCP clients. See [HTTP API](https://tasknotes.dev/HTTP_API/#authentication). Thanks to @Oriery for requesting this.

## Changed

- (#2345) The last-seen and last-notified release versions are now remembered per device instead of in `data.json`, so opening Obsidian after an update no longer changes `data.json`. Thanks to @Oriery.
- Rebuilt settings around Obsidian’s native navigation, search, and editable lists. Individual settings are searchable. Ordinary preferences and property triggers use inline groups, while larger editors and advanced filters retain detail pages. See [Settings](https://tasknotes.dev/settings/) for the new layout.
- TaskNotes now requires Obsidian 1.13.1 or newer.
- This beta includes the fixes released in [4.13.2](https://github.com/callumalpass/tasknotes/releases/tag/4.13.2), [4.13.3](https://github.com/callumalpass/tasknotes/releases/tag/4.13.3), [4.13.4](https://github.com/callumalpass/tasknotes/releases/tag/4.13.4), [4.13.5](https://github.com/callumalpass/tasknotes/releases/tag/4.13.5), and [4.13.6](https://github.com/callumalpass/tasknotes/releases/tag/4.13.6).
- Task cards show dates within a week of today as relative days, such as "Due: Yesterday", "Due: 3 days ago" or "Scheduled: Monday". The full date appears on hover. Past scheduled dates no longer carry a "(past)" suffix. Choosing ISO dates keeps absolute dates.
- Task cards no longer repeat the task title as a "file name" property, and tags shown through Bases use the same tag style and identifying-tag hiding as other tags. New vaults hide the identifying tag on cards by default.
- Kanban swimlanes can be collapsed from their label. Empty swimlanes start collapsed.
- The task dialog labels its date buttons ("Due: …", "Scheduled: …") and always shows the current status and priority. While typing natural language in the create dialog, the buttons show the values that will be saved.
- In the edit dialog, fields line up in one column, Archive is a plain button, and Delete is a quieter text button.
- The task context menu keeps status, priority, dates, reminders, time tracking, edit and open at the top level. Other actions are under "More".
- Calendar year view shows the first event on each day instead of collapsing every day into "+1 more". The refresh button only appears when external calendars are connected, and the custom day-count view button has a tooltip.

## Fixed

- Fixed task dialogs falling back to plain text inputs when opened without an active note, including from release notes or in an empty vault.
- Custom priority icons on task cards now display at the same size as status icons instead of being squeezed into the smaller priority dot, and priority menus show each priority's icon instead of a star for every option.
- Suggestions in the task selector and fallback task input now use your configured natural language triggers for contexts, tags, projects and status. Previously they always used `@`, `#`, `+` and the old status trigger, and inserted characters the parser no longer recognised after a trigger was changed. See [Customizable Triggers](https://tasknotes.dev/features/inline-tasks/#customizable-triggers).
- Fixed generated recurrence and dependency link targets when the TaskNotes type uses a name other than `task`.
- Improved mdbase upgrades from TaskNotes v4, including older generated formatting and retries after interrupted updates. New collections use a dedicated membership property without claiming bibliographic `type` fields; existing custom membership keys are preserved.
- TaskNotes now bundles the same portable task contract as TaskNotes App (`tasknotes.task` 0.3.0-rc.5, which adds optional assignees linked to person notes) and preserves customized contract/schema resources rather than replacing them automatically.
- Collections written by the 5.0 betas are updated to the current contract on load, keeping their settings; contract and schema files written by earlier TaskNotes versions are replaced without backups or warnings. Task types that TaskNotes App installed (which use YAML aliases) are updated in place instead of being backed up as invalid.

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
