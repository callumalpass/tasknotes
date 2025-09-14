# Calendar Integration

TaskNotes provides calendar integration features, which allow you to visualize your tasks and schedule your work. This is done through two calendar views and the ability to subscribe to external calendar feeds.

## Calendar Views

TaskNotes has two calendar views for visualizing and managing tasks: the **Mini Calendar** and the **Advanced Calendar**.

The **Mini Calendar** is a compact, month-based view that provides an overview of which days have tasks. It is designed for navigation and for understanding task distribution.

The **Advanced Calendar** is a calendar with multiple view modes (month, week, day, year, and custom days), drag-and-drop scheduling, and time-blocking capabilities. You can create new tasks by clicking on dates or time slots, and you can reschedule tasks by dragging them to a new date or time. The custom days view allows you to display 2-10 days at once, providing flexible screen space utilization.

## ICS Calendar Subscriptions

TaskNotes can subscribe to external calendar feeds using the iCalendar (ICS) format. This allows you to display events from services like Google Calendar and Outlook alongside your tasks. You can add and manage your calendar subscriptions in the plugin's settings.

### Creating Content from Calendar Events

TaskNotes allows you to create notes and tasks directly from calendar events through the event information modal. When you click on a calendar event, you can:

**Create Notes from Events:**

- Generate notes using the event title, date, location, and description
- Apply custom templates for consistent note formatting
- Automatically link notes to the original calendar event for reference

**Create Tasks from Events:**

- Convert calendar events into actionable tasks
- Preserve the event's start time as the task's scheduled date and time
- Include event duration as the task's time estimate
- Add event location as a task context
- Automatically tag tasks with the ICS event identifier

**Link Existing Content:**

- Connect existing notes to calendar events
- View all notes and tasks related to a specific event
- Maintain bidirectional references between calendar events and vault content

### Event Information Modal

The event information modal displays details about calendar events and provides action buttons for content creation. The modal shows:

- Event title, date, time, location, and description
- Source calendar subscription name
- List of related notes and tasks (if any exist)
- Options to create new content or link existing notes

Related notes and tasks are automatically identified by their ICS event ID field. Tasks are distinguished from notes based on the presence of the configured task tag in their frontmatter.

## Time-blocking

The Advanced Calendar supports time-blocking, which is a time management method that involves scheduling out parts of your day. You can create time blocks by holding the Shift key while selecting a time range in the calendar. Time blocks are stored in the frontmatter of your daily notes and can be linked to specific tasks.
