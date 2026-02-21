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
- Time slot window (`slotMinTime`, `slotMaxTime`, `slotDuration`)
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
