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
- Per-Base calendar options can override the app-level time slot window. If a `.base` file includes `slotMinTime` or `slotMaxTime`, remove those lines or edit them in the Base layout controls to use the app-level defaults again.
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

## Practical Setup Order

1. Configure baseline calendar display in `Appearance`.
2. Enable timeblocking in `Features` if you schedule focused blocks.
3. Add external calendars in `Integrations`.
4. Validate event visibility in your calendar `.base` view options.

## Related Docs

- `docs/features/calendar-integration.md`
- `docs/calendar-setup.md`
- `docs/views/calendar-views.md`
