# Calendar Views

TaskNotes provides two calendar-based views for visualizing and managing tasks in relation to time: the Mini Calendar and the Advanced Calendar. Both views display tasks based on their due dates and scheduled dates, but serve different purposes and workflows.

## Mini Calendar View

The Mini Calendar is a compact calendar widget designed for quick navigation and overview. It shows a month view with indicators for days that contain tasks.

### Interface Elements

**Month Navigation**: Previous/next buttons and month/year selectors for moving between time periods.

**Date Grid**: Standard calendar layout with date numbers. Days with tasks show visual indicators.

**Task Indicators**: 
- Small dots or badges indicate days with tasks
- Different colors represent different task statuses or priorities
- Number badges show task count for busy days

**Current Date Highlighting**: Today's date is visually distinguished from other dates.

### Functionality

**Task Overview**: Quickly see which days have tasks without viewing details.

**Date Navigation**: Click any date to jump to that day in other views or open the Notes view for that date.

**Visual Density**: Compact design makes it suitable for keeping open alongside other views or as a sidebar widget.

**Quick Reference**: Provides an at-a-glance view of task distribution across the month.

## Advanced Calendar View

The Advanced Calendar provides a full-featured calendar interface with multiple view modes and detailed task display.

### View Modes

**Month View**: Standard monthly calendar showing tasks as events on their respective dates.

**Week View**: Seven-day layout with hourly time slots for detailed scheduling.

**Day View**: Single-day view with hourly breakdown for detailed time management.

**Agenda View**: List-based view of upcoming tasks sorted chronologically.

### Task Display

**Task Events**: Tasks appear as colored blocks or entries on their scheduled or due dates.

**Time Slots**: In week and day views, tasks with specific times appear in appropriate time slots.

**All-Day Events**: Tasks without specific times appear in the all-day section.

**Color Coding**: Tasks are colored based on:
- Status (completed, in-progress, etc.)
- Priority levels
- Custom color schemes from settings

**Task Details**: Hover over task events to see additional information like priority, contexts, and notes.

### Interactive Features

**Task Creation**: 
- Click on empty dates or time slots to create new tasks
- Created tasks automatically inherit the selected date/time
- Quick creation modal for basic task information

**Task Editing**:
- Click existing task events to open edit modal
- Modify properties directly from the calendar
- Mark tasks complete with quick actions

**Drag and Drop**: 
- Move tasks between dates by dragging
- Reschedule tasks by dragging to different time slots
- Visual feedback during drag operations

**Date Navigation**:
- Navigate between time periods using arrow buttons
- Jump to specific dates using date picker
- Keyboard shortcuts for common navigation

### External Calendar Integration

Both calendar views can display events from external calendar sources alongside your TaskNotes:

**ICS Subscription**: Subscribe to remote calendar feeds from:
- Google Calendar
- Outlook/Exchange calendars  
- iCloud calendars
- Any calendar supporting the ICS format

**Local ICS Files**: Import calendar files stored locally in your vault.

**Event Display**: External events appear as read-only entries with distinct styling.

**Calendar Management**: Add, edit, or remove calendar subscriptions through settings.

### Time-Blocking Features

The Advanced Calendar supports time-blocking workflows:

**Scheduled Tasks**: Tasks with scheduled dates and times appear as blocks in the calendar.

**Duration Display**: Tasks with time estimates show as blocks spanning the estimated duration.

**Daily Notes Integration**: 
- View time blocks from daily notes alongside tasks
- Create time blocks that link to daily note sections
- Maintain consistency between calendar and note-based planning

### Customization Options

**View Preferences**:
- Default view mode (month, week, day)
- Start day of week (Sunday or Monday)
- Working hours display in week/day views
- Time format (12-hour or 24-hour)

**Display Settings**:
- Task color schemes
- Compact or detailed task display
- Show/hide completed tasks
- Weekend highlighting

**Integration Settings**:
- External calendar refresh intervals
- Default task properties for calendar-created tasks
- Time zone handling for external calendars

### Performance and Responsiveness

**Efficient Rendering**: Calendar views use optimized rendering for smooth performance with large numbers of tasks.

**Real-Time Updates**: Changes to tasks are reflected immediately in calendar views.

**Background Sync**: External calendar data is updated in the background without blocking the interface.

**Responsive Design**: Calendar views adapt to different panel sizes and screen resolutions.

## Workflow Integration

Calendar views integrate with other TaskNotes features:

**Cross-View Consistency**: Dates selected in calendar views update related views like Notes and Agenda.

**Filter Coordination**: Applied filters in other views can be reflected in calendar displays.

**Task Creation Flow**: Tasks created in calendar views inherit appropriate default settings and can trigger template application.