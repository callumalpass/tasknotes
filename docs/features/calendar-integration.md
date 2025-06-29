# Calendar Integration

TaskNotes provides comprehensive calendar integration capabilities, allowing you to display external calendar events alongside your tasks and create sophisticated scheduling workflows.

## ICS Calendar Subscriptions

### Supported Sources

TaskNotes can subscribe to ICS (iCalendar) feeds from various sources:

**Remote URLs**: Subscribe to calendar feeds from:
- Google Calendar (public and private feeds)
- Microsoft Outlook/Exchange calendars
- Apple iCloud calendars
- Any service that provides ICS/iCal URLs

**Local Files**: Import ICS files stored within your Obsidian vault:
- Downloaded calendar exports
- Locally generated calendar files
- Files synced from other applications

### Subscription Management

**Add Subscriptions**: Configure new calendar subscriptions through the settings interface
**Subscription Properties**:
- Name: Display name for the calendar
- URL/Path: Remote URL or local file path
- Color: Custom color for calendar events
- Enabled/Disabled: Toggle subscription visibility

**Automatic Refresh**: Remote calendars are refreshed automatically at configurable intervals
**File Watching**: Local ICS files are monitored for changes and updated automatically

### Event Processing

**Event Parsing**: Uses the ical.js library for robust ICS format parsing
**Recurring Events**: Automatic expansion of recurring events up to one year in advance
**Time Zone Handling**: Proper handling of time zone information in calendar events
**Event Properties**: Extracts title, start/end times, location, description, and recurrence patterns

## Calendar Display Integration

### Advanced Calendar View

External calendar events appear in the Advanced Calendar View alongside TaskNotes:

**Visual Distinction**: External events are styled differently from tasks to avoid confusion
**Read-Only Display**: External events cannot be edited directly through TaskNotes
**Event Details**: Hover over events to see full details including description and location
**Color Coding**: Each subscription can have a custom color for easy identification

### Event Type Toggles

The Advanced Calendar includes toggles to show or hide different event types:

**ICS Events**: Toggle visibility of all external calendar events
**Task Events**: Show/hide different types of task-related events
**Combined View**: See external events and tasks in a unified timeline

### Calendar Navigation

**Multi-View Support**: External events appear in month, week, and day views
**Date Navigation**: External events respect calendar navigation and date range selection
**Search Integration**: External events can be included in calendar search functionality

## Timeblocking System

### Timeblocking System

Timeblocking is an optional feature that allows you to create focused work periods directly in the Advanced Calendar. It needs to be enabled in the plugin settings.

**Direct Creation**: Create timeblocks directly in the Advanced Calendar by clicking and dragging
**Duration Setting**: Set specific start and end times for focused work periods
**Task Association**: Link timeblocks to specific TaskNotes for integrated planning

### Timeblock Storage

**Daily Note Integration**: Timeblocks are stored in daily note frontmatter
**YAML Format**: Structured storage ensures timeblock data is portable and editable
**Example Format**:
```yaml
timeblocks:
  - start: "09:00"
    end: "10:30"
    title: "Deep work session"
    color: "#4285f4"
    attachment: "[[Important Project Task]]"
```

### Timeblock Features

**Color Customization**: Assign custom colors to different types of timeblocks
**Task Attachment**: Link timeblocks to specific tasks for integrated workflow
**Drag and Drop**: Move and resize timeblocks directly in the calendar interface

## FullCalendar Integration

### Comprehensive Calendar Interface

The Advanced Calendar View uses FullCalendar.js to provide professional calendar functionality:

**Multiple View Types**:
- Month view for overview planning
- Week view for detailed scheduling
- Day view for focused daily planning
- Multi-month year view for long-term perspective

**Interactive Features**:
- Drag and drop for task rescheduling
- Click to create new tasks or timeblocks
- Resize events to adjust duration
- Context menus for quick actions

### Event Management

**Task Events**: TaskNotes appear as calendar events based on their due and scheduled dates
**Time Entry Events**: Completed time tracking sessions appear as events showing actual work time
**Recurring Task Instances**: Each instance of recurring tasks appears as a separate calendar event

### Performance Optimization

**Efficient Rendering**: FullCalendar handles large numbers of events efficiently
**Lazy Loading**: Events are loaded on demand based on visible date ranges
**Real-Time Updates**: Calendar events update immediately when underlying task data changes

## External Calendar Workflow

### Read-Only Integration

External calendar events are displayed as read-only information:

**Reference Purpose**: See external commitments alongside your task planning
**Conflict Avoidance**: Identify scheduling conflicts between tasks and external events
**Context Awareness**: Plan task work around existing calendar commitments

### Data Separation

**Clear Boundaries**: External calendar data remains separate from TaskNotes data
**No Modification**: External events cannot be accidentally modified through TaskNotes
**Source Integrity**: Original calendar data is preserved and not altered

## Configuration and Settings

### Subscription Settings

**Refresh Intervals**: Configure how often remote calendars are updated

### Display Settings

**Visibility Options**: Control which types of events are shown by default

## Use Cases

### Personal Schedule Integration

**Work Calendar**: Display your work calendar alongside personal tasks
**Family Calendar**: See family commitments when planning personal projects
**Multiple Accounts**: Subscribe to calendars from different email accounts

### Team Coordination

**Team Calendars**: Subscribe to shared team calendars to see colleague availability
**Meeting Planning**: Schedule task work around existing meeting commitments
**Project Deadlines**: Display project milestones from external project management tools

### Cross-Platform Workflow

**Calendar App Integration**: Continue using your preferred calendar app while seeing events in TaskNotes
**Mobile Sync**: External calendars sync through their native services while appearing in TaskNotes
**Unified View**: Single interface showing both external commitments and internal task planning
