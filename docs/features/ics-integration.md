# ICS Calendar Event Integration

TaskNotes provides integration with ICS calendar events, allowing you to create notes and tasks directly from calendar entries. This feature bridges the gap between scheduled events and actionable content in your vault.

## Overview

The ICS integration allows you to:

- View detailed information about calendar events
- Create notes from calendar events with customizable templates
- Generate tasks from events with proper scheduling and context
- Link existing vault content to calendar events
- Maintain relationships between events and created content

## Event Information Modal

When you interact with a calendar event in TaskNotes, an information modal displays event details and available actions. The modal provides:

### Event Details

- Event title and description
- Start and end times (formatted according to your locale)
- Location information
- Source calendar name
- Event URL (if available)

### Related Content

The modal shows a list of existing notes and tasks that are linked to the calendar event. Content is automatically categorized as:

- **Task** - Files containing the configured task tag
- **Note** - Files without the task tag

The relationship is maintained through the ICS Event ID field in the content's frontmatter.

### Available Actions

**Create Note** - Opens a creation dialog for generating a new note from the event data.

**Create Task** - Creates a task immediately using the event information with default settings.

**Link Note** - Opens a file selection dialog to link an existing note to the calendar event.

**Refresh** - Reloads the list of related content to reflect recent changes.

## Note Creation from Events

The note creation process allows customization of the generated content:

### Basic Settings

- **Title** - Default combines event title and date, but can be modified
- **Folder** - Destination for the new note (uses default ICS note folder if configured)
- **Template** - Optional template file to structure the note content

### Template Usage

When a template is specified:

- The template file is processed with ICS-specific variables
- Standard TaskNotes template variables are also available
- Template content replaces the default event description format
- Frontmatter from templates is merged with required ICS fields

### Default Content

Without a template, notes include:

- Event title as the main heading
- Formatted start and end times
- Location information
- Source calendar name
- Event description (if provided)
- Event URL (if available)

## Task Creation from Events

Tasks created from calendar events include relevant event data:

### Scheduled Date and Time

Tasks are scheduled using the event's start time as an ISO timestamp, preserving both date and time information. This allows for accurate scheduling that reflects the original event timing.

### Task Properties

- **Title** - Uses the event title
- **Status** - Set to the default task status configured in settings
- **Priority** - Set to the default task priority
- **Contexts** - Event location is added as a context (if provided)
- **Time Estimate** - Calculated from event duration (if start and end times are available)
- **Tags** - Includes the ICS event tag and any default task tags

### Content

Task content includes formatted event details similar to note creation, providing context about the original calendar event.

## Linking Existing Content

You can establish connections between existing vault content and calendar events:

### Link Process

1. Select an existing markdown file from your vault
2. The file's frontmatter is updated to include the event ID
3. The modification date is updated to reflect the change
4. The connection appears in the related content list

### Bidirectional References

- Calendar events can display all linked content
- Content files maintain references to their associated events
- Multiple pieces of content can be linked to a single event
- Content can be linked to multiple events (stored as an array)

## Field Mapping Integration

The ICS integration extends the field mapping system with two new fields:

### ICS Event ID Field

- Stores the unique identifier connecting content to calendar events
- Default field name is `icsEventId`
- Values are stored as arrays to support multiple event associations
- Field name can be customized through field mapping settings

### ICS Event Tag Field

- Tag automatically applied to content created from events
- Default tag is `ics_event`
- Used to identify ICS-related content throughout the system
- Can be customized through field mapping settings

## Template Variables

Templates used for ICS content creation have access to event-specific variables in addition to standard TaskNotes variables:

### Event Information

- `{{icsEventTitle}}` - Event title
- `{{icsEventStart}}` - Start date and time (ISO format)
- `{{icsEventEnd}}` - End date and time (ISO format)
- `{{icsEventLocation}}` - Event location
- `{{icsEventDescription}}` - Event description
- `{{icsEventUrl}}` - Event URL
- `{{icsEventSubscription}}` - Calendar subscription name
- `{{icsEventId}}` - Unique event identifier

### Standard Variables

All standard TaskNotes template variables remain available:
- `{{title}}`, `{{date}}`, `{{time}}`
- `{{priority}}`, `{{status}}`, `{{contexts}}`
- And others as documented in the template system

## Configuration

ICS integration settings are located under **Settings → TaskNotes → Integrations**:

### Default Templates

Configure template files for consistent content creation from events. Templates are optional and the system provides sensible defaults when not specified.

### Default Folders

Set destination folders for content created from events. This helps organize ICS-generated content separately from other vault content if desired.

### Filename Formats

The system uses the standard TaskNotes filename generation with event-specific context, ensuring unique and descriptive filenames for created content.

## Technical Implementation

### Event Identification

Calendar events are identified by their unique ICS event ID, which is maintained in the frontmatter of created content. This allows the system to track relationships even if event details change.

### Content Type Detection

The system distinguishes between tasks and notes by checking for the presence of the configured task tag in the content's frontmatter tags array, rather than relying on file structure or naming conventions.

### Error Handling

The integration includes error boundaries for network issues, file operations, and template processing. Failed operations provide user feedback without interrupting the overall workflow.
