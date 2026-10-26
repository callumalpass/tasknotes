# Calendar Settings

Calendar behavior is configured across multiple tabs.

## Settings Map

### Appearance tab

Location:

- `Settings -> TaskNotes -> Appearance`

Controls include:

- Default calendar view mode (month/week/day/year/custom days)
- First day of week and weekend visibility
- Locale and date formatting
- Default time slot window (`slotMinTime`, `slotMaxTime`, `slotDuration`). The default start/end window is the full day, `00:00` to `24:00`. Use `slotMaxTime` values above `24:00:00`, such as `26:00:00`, to show early next-day hours in timeline views.
- Per-Base calendar options can override the app-level time slot window. If a `.base` file includes `slotMinTime`, `slotMaxTime`, or `slotDuration`, remove those lines or edit them in the Base layout controls to use the app-level defaults again. Calendar Bases can also set `snapDuration` to control drag/drop resolution independently from the visible `slotDuration`.
- Default event visibility toggles (due, scheduled, recurring, time entries, ICS)
- Event stacking and overlap display options

### Features tab

Location:

- `Settings -> TaskNotes -> Features`

Controls include:

- Timeblocking enable/disable
- Timeblocking behavior options

### Integrations tab

Location:

- `Settings -> TaskNotes -> Integrations`

Controls include:

- Google/Microsoft OAuth calendar connections
- ICS calendar subscriptions
- ICS import behavior and note/task creation options
- Automatic ICS export settings
- Google Calendar task export settings

## Per-view settings in Bases

Open a Calendar Base, then open its view settings from the Bases toolbar. These collapsible sections change only that saved view:

- **What to show**: scheduled and due tasks, recurring tasks, time entries, timeblocks, and events from note properties. Scheduled-to-due spans appear when both scheduled and due tasks are enabled.
- **Layout**: calendar mode, custom/list day count, height, week start, clock format, week numbers, weekends, today's highlight, and search.
- **Time grid**: all-day area, day start/end, time between grid lines, initial scroll time, current-time marker, and hourly breakdown. Available for Week, Day, and Custom days.
- **Day cells**: events shown before a “+ more” link, for Month, Year, and the all-day area of time-grid views. `0` chooses the automatic limit.
- **Property-based events**: start, end, and title properties. Hidden when property-based events are off.
- **Advanced**: opening date (fixed or taken from a property), daily-note creation, completed/skipped recurring instances, today column width, drag/resize step, selection preview, overlapping events, minimum event height, simultaneous-event limit, and the row-limit override.
- Connected calendars have their own visibility sections.

The **row limit override** in Advanced takes priority over the Day cells limit when positive. It counts rows including the “+ more” link; `0` turns off the override, not the ordinary event limit. The simultaneous-event limit applies to timed events; `0` means no limit.

Existing `.base` keys and their values have not changed. Moving a control to Advanced does not reset it. Older files with settings nested under `config:` or `options:` are still read; direct view keys take precedence. Remove a per-view key to return to the plugin default on the next opening.

For reusable setups, save separate Bases (for example a Day planner, Month overview, or List/Agenda) with different settings; there is no preset selector that overwrites several settings at once.

## Practical Setup Order

1. Configure baseline calendar display in `Appearance`.
2. Enable timeblocking in `Features` if you schedule focused blocks.
3. Add external calendars in `Integrations`.
4. Validate event visibility in your calendar `.base` view options.

## Related Docs

- `docs/features/calendar-integration.md`
- `docs/calendar-setup.md`
- `docs/views/calendar-views.md`
