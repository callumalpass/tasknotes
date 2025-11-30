# Calendar Settings

These settings control the appearance and behavior of the calendar views, as well as the integration with external calendar systems.

## Default Calendar View

You can set the **Default View** for the Calendar View, choosing from month, week, day, year, or custom days. You can also configure the **Time Slot Duration** and the **Time Range** that is displayed in the week, day, and custom days views.

**Custom view day count** - When using the Custom Days view, this slider controls how many days (2-10) are displayed simultaneously. The default is 3 days, which provides optimal screen space utilization while maintaining detailed scheduling capabilities.

## Week and Date Settings

You can set the **First Day of the Week** and choose whether to **Show Weekends** in the calendar views.

You can also configure the **Calendar Locale** to change the calendar's language and date formatting. This supports different calendar systems like the Jalali (Persian) calendar by setting the locale to "fa". Leave this field empty to automatically detect your browser's locale.

## Event Type Visibility

You can control which types of events are shown by default in the calendar views, including scheduled tasks, tasks with due dates, recurring tasks, time entries, and events from external calendars.

## Event Display and Stacking

These settings control how events are displayed when multiple events occur at the same time or on the same day.

**Allow events to overlap** - When enabled, timed events in week and day views can visually overlap each other. When disabled, events are displayed side-by-side with no overlapping.

**Max stacked events (week/day view)** - Limits how many events can stack horizontally in the week and day views. When exceeded, a "+X more" link appears. Set to 0 for unlimited stacking.

**Max events per day (month view)** - Limits how many events are shown per day cell in month view. When exceeded, a "+X more" link appears. Set to 0 for automatic limiting based on cell height.

**Max event rows per day (month view)** - Limits how many rows of events are shown per day cell in month view. Set to 0 for unlimited rows.

## Timeblocking Features

You can enable or disable the **Timeblocking** feature in the Features tab, which allows you to create and manage timeblocks in the calendar views. When enabled, dragging on a time slot in the calendar view will display a context menu that includes the "Create timeblock" option.

## External Calendar Integration

You can manage your **ICS Calendar Subscriptions** from this section, including adding, editing, and removing subscriptions. You can also set the refresh interval for remote calendars.

## Content Creation from Events

These settings control how notes are created from calendar events.

**Default note template** - Template file for notes created from ICS events (leave empty for default format). Specify the path to a markdown template file.

**Default note folder** - Folder for notes created from ICS events (leave empty for vault root). The folder structure will be created if it doesn't exist.
