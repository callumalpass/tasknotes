# Calendar Settings

Calendar settings control the appearance and behavior of TaskNotes calendar views, time-based scheduling features, and integration with external calendar systems.

## Default Calendar View

### Initial View Mode

**Setting**: `defaultView`
**Options**: `dayGridMonth`, `timeGridWeek`, `timeGridDay`, `multiMonthYear`
**Default**: `dayGridMonth`

Determines which calendar view opens by default when accessing the Advanced Calendar View.

**View Types**:
- **dayGridMonth**: Standard monthly calendar with day grid
- **timeGridWeek**: Weekly view with hourly time slots
- **timeGridDay**: Single day view with detailed time breakdown
- **multiMonthYear**: Year view showing multiple months simultaneously

## Time Configuration

### Time Slot Settings

**Slot Duration**: `slotDuration`
**Options**: `00:15:00`, `00:30:00`, `01:00:00`
**Default**: `00:30:00`

Controls the duration of time slots in week and day views. Shorter durations provide more precise scheduling while longer durations reduce visual clutter.

**Slot Minimum Time**: `slotMinTime`
**Format**: `HH:MM:SS`
**Default**: `00:00:00`

**Slot Maximum Time**: `slotMaxTime`
**Format**: `HH:MM:SS`
**Default**: `24:00:00`

These settings define the time range displayed in week and day views. Set minimum and maximum times to focus on your working hours.

**Example Working Hours Setup**:
- Slot Min Time: `08:00:00` (8 AM)
- Slot Max Time: `18:00:00` (6 PM)

### Initial Scroll Position

**Setting**: `scrollTime`
**Format**: `HH:MM:SS`
**Default**: `08:00:00`

Sets where the calendar initially scrolls to in week and day views. Useful for automatically displaying your typical working hours.

### Time Format

**Setting**: `timeFormat`
**Options**: `12`, `24`
**Default**: `24`

Controls whether times are displayed in 12-hour format (with AM/PM) or 24-hour format.

## Week and Date Settings

### First Day of Week

**Setting**: `firstDay`
**Options**: `0` (Sunday) through `6` (Saturday)
**Default**: `1` (Monday)

Determines which day appears first in weekly and monthly calendar views.

**Common Settings**:
- `0`: Sunday (US standard)
- `1`: Monday (International standard)

### Weekend Display

**Setting**: `showWeekends`
**Default**: `true`

Controls whether Saturday and Sunday are displayed in calendar views. Disable for work-focused calendars that don't need weekend display.

## Event Type Visibility

These settings control which types of events are shown by default when opening calendar views. Users can still toggle these on/off within each view.

### Task-Related Events

**Show Scheduled Tasks**: `defaultShowScheduled`
**Default**: `true`

**Show Due Date Tasks**: `defaultShowDue`
**Default**: `true`

**Show Due Dates When Scheduled**: `defaultShowDueWhenScheduled`
**Default**: `true`

Controls whether due dates are displayed for tasks that already have scheduled dates. When enabled, tasks with both scheduled and due dates will appear twice on the calendar - once as a scheduled event and once as a due date event (with "DUE:" prefix). When disabled, only the scheduled date will be shown for tasks that have both dates.

**Show Recurring Task Instances**: `defaultShowRecurring`
**Default**: `true`

Controls default visibility for different types of task events in calendar views.

### Time Tracking Events

**Show Time Entries**: `defaultShowTimeEntries`
**Default**: `false`

When enabled, completed time tracking sessions appear as events on the calendar, showing when actual work was performed on tasks.

### External Calendar Events

**Show ICS Events**: `defaultShowICSEvents`
**Default**: `true`

Controls default visibility for events from subscribed external calendars (Google Calendar, Outlook, etc.).

## Timeblocking Features

### Enable Timeblocking

**Setting**: `enableTimeblocking`
**Default**: `false`

When enabled, allows creation and management of timeblocks in calendar views. Timeblocks are stored in daily note frontmatter.

### Show Timeblocks

**Setting**: `defaultShowTimeblocks`
**Default**: `true`

Controls default visibility for timeblocks from daily notes when timeblocking is enabled.

**Timeblock Storage Format**:
```yaml
timeblocks:
  - start: "09:00"
    end: "10:30"
    title: "Deep work session"
    color: "#4285f4"
    attachment: "[[Important Project Task]]"
```

## Calendar Behavior

### Visual Indicators

**Now Indicator**: `nowIndicator`
**Default**: `true`

Shows a line indicating the current time in week and day views.

**Today Highlight**: `showTodayHighlight`
**Default**: `true`

Highlights the current date in calendar views with distinct styling.

**Week Numbers**: `weekNumbers`
**Default**: `false`

Displays week numbers (1-52) in monthly calendar views.

### Interaction Behavior

**Select Mirror**: `selectMirror`
**Default**: `true`

Shows visual preview when dragging events or creating new items in calendar views.

## External Calendar Integration

### ICS Subscription Management

TaskNotes supports subscribing to external ICS calendar feeds. These settings are managed through the calendar settings interface.

**Supported Sources**:
- Google Calendar (public and private feeds)
- Microsoft Outlook/Exchange calendars
- Apple iCloud calendars
- Any service providing standard ICS/iCal feeds
- Local ICS files within your vault

**Subscription Properties**:
- **Name**: Display name for the calendar subscription
- **URL/Path**: Remote URL or local file path to ICS source
- **Color**: Custom color for events from this calendar
- **Enabled**: Toggle subscription visibility
- **Refresh Interval**: How often to update remote calendars (15-1440 minutes)

### Subscription Management

**Add Subscription**: Configure new external calendar feeds
**Edit Subscription**: Modify existing subscription properties
**Enable/Disable**: Toggle subscription visibility without removing
**Manual Refresh**: Force immediate update of calendar data
**Remove Subscription**: Delete subscription with confirmation

### Local ICS File Support

**File Watching**: Local ICS files are monitored for changes and updated automatically
**Path Display**: Shows vault-relative path for local files
