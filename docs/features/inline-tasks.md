# Inline Task Integration

TaskNotes integrates with the Obsidian editor to allow task management directly within notes. This is achieved through interactive widgets, a conversion feature for checkboxes, and natural language processing.

## Task Link Overlays

When a wikilink to a task note is created, TaskNotes can replace it with an interactive **Task Link Overlay**. This widget displays information about the task, such as its status, priority, and due date. It also allows for actions like changing the status or priority, or opening the task for editing, directly from the note.

![Task Link Overlays in Live Preview mode](../assets/2025-07-17_21-03-55.png)

*Task link overlays in Live Preview mode show interactive widgets with status, dates, and quick actions*

![Task Link Overlays in Source mode](../assets/2025-07-17_21-04-24.png)

*In Source mode, task links appear as standard wikilinks until rendered*

### Widget Features

The task link overlay displays:

- **Status Dot**: Clickable circular indicator showing current task status. Click to cycle through available statuses.
- **Priority Dot**: Color-coded indicator for task priority (only shown when assigned).
- **Task Title**: Displays the task name (truncated to 80 characters). Click to open the task edit modal.
- **Date Information**: Shows due dates (calendar icon) and scheduled dates (clock icon) with clickable context menus.
- **Recurrence Indicator**: Rotating arrow icon for recurring tasks with modification options.
- **Action Menu**: Ellipsis icon (shown on hover) provides additional task actions.

### Mode-Specific Behavior

Task link overlays work in both Live Preview and Reading modes:

- **Live Preview Mode**: Widgets hide when the cursor is within the wikilink range, allowing for easy editing.
- **Reading Mode**: Widgets display with full functionality and integrate with the reading mode typography.

The overlays support drag-and-drop to calendar views and provide keyboard shortcuts for quick navigation (Ctrl/Cmd+Click to open the source file).

## Instant Task Conversion

The **Instant Task Conversion** feature transforms lines in your notes into TaskNotes files. This works with both checkbox tasks and regular lines of text. When available, a "convert" button appears next to the content in edit mode. Clicking this button creates a new task note using the line's text as the title and replaces the original line with a link to the new task file.

### Supported Line Types

The conversion feature works with:

- **Checkbox tasks**: `- [ ] Task description` becomes a TaskNote with task metadata
- **Bullet points**: `- Some task idea` becomes a TaskNote with the text as title
- **Numbered lists**: `1. Important item` becomes a TaskNote
- **Blockquoted content**: `> Task in callout` becomes a TaskNote (preserves blockquote formatting)
- **Plain text lines**: `Important thing to do` becomes a TaskNote
- **Mixed formats**: `> - [ ] Task in blockquote` handles both blockquote and checkbox formatting

### Content Processing

When converting lines:

- **Special characters** like `>`, `#`, `-` are automatically removed from the task title
- **Original formatting** is preserved in the note (e.g., `> [[Task Title]]` for blockquoted content)
- **Task metadata** is extracted from checkbox tasks (due dates, priorities, etc.)
- **Natural language processing** can extract dates and metadata from plain text (if enabled)

The feature handles edge cases like nested blockquotes and maintains proper indentation in the final link replacement.

## Bulk Task Conversion

The **Bulk Task Conversion** command converts all checkbox tasks in the current note to TaskNotes in a single operation. This command is available in the command palette as "Convert all tasks in note to TaskNotes".

### How It Works

The command:

1. Scans the entire current note for checkbox tasks (`- [ ]`, `* [ ]`, `1. [ ]`, etc.)
2. Includes tasks inside blockquotes (e.g., `> - [ ] task in callout`)
3. Applies the same enhanced conversion logic as instant task conversion
4. Creates individual TaskNote files for each task
5. Replaces the original checkboxes with links to the new task files
6. Preserves original indentation and formatting (including blockquote markers)

The bulk conversion uses the same content processing as instant conversion, automatically removing special characters from task titles while preserving original formatting in the note.

### Usage

To use bulk conversion:

1. Open a note containing checkbox tasks
2. Access the command palette (`Ctrl+P` / `Cmd+P`)
3. Search for "Convert all tasks in note to TaskNotes"
4. Execute the command

The command will display progress and show a summary when complete (e.g., "✅ Successfully converted 5 tasks to TaskNotes!").

!!! warning "Important Considerations"

    **This command modifies note content permanently.** Before using:

    - **Create a backup** of your note if it contains important data
    - **Review the tasks** to ensure they should become individual TaskNotes
    - **Expect processing time** - notes with many tasks may take several seconds to process
    - **Avoid interruption** - do not edit the note while conversion is running

!!! note "Performance"

    Processing time depends on the number of tasks:

    - Small notes (1-10 tasks): Near-instant
    - Medium notes (10-50 tasks): 2-5 seconds
    - Large notes (50+ tasks): 10+ seconds

    The operation creates multiple files and updates the note content, which requires disk I/O and editor updates.

### Error Handling

If some tasks fail to convert, the command will:

- Complete successfully converted tasks
- Display a summary showing both successes and failures
- Log detailed error information to the console for troubleshooting

Failed conversions typically occur due to:

- Tasks with titles containing invalid filename characters
- Insufficient disk permissions
- Very long task titles (over 200 characters)

## Project Subtasks Widget

The **Project Subtasks Widget** displays tasks that reference the current note as a project. When viewing a project note, the widget automatically appears and shows all tasks that link to that project, providing a consolidated view of project-related work.

The widget includes:

- **Collapsible Interface**: Click the widget title to expand or collapse the task list. The state is remembered between sessions.
- **FilterBar Integration**: Full filtering, sorting, and grouping capabilities with real-time filtering and count display.
- **Collapsible Groups**: When tasks are grouped, each group can be individually collapsed/expanded with persistent state. Includes expand/collapse all controls.
- **Saved Views System**: Access to saved filter configurations for consistent task organization.
- **Task Details**: Each task shows its status, priority, due date, and other properties.
- **Real-time Updates**: The widget updates automatically when tasks are added, modified, or deleted.
- **Smart Positioning**: The widget appears after frontmatter and properties but before the main note content.

The widget can be enabled or disabled in the plugin settings in the Misc tab under "Show project subtasks widget".

### Expandable Subtasks Chevron

Project tasks can display an expand/collapse chevron that toggles the visibility of subtasks.

- The chevron can be positioned on the Right (default, hover to show) or on the Left (always visible, matches group chevrons).
- Configure this in Settings → Misc → Subtask chevron position.

![Left subtask chevron](../assets/left-task-subtask-chevron.gif)

### Collapsible Groups

When tasks are grouped by status, priority, or other criteria, each group displays with a collapsible header. Click the chevron or group header to expand/collapse individual groups, with state persisted per note.

![Subtask widget collapsible groups](../assets/subtask-widget-collapsible-groups.gif)


### Saved view heading and counts in Subtasks Widget

The Project Subtasks widget shows the saved view name and completion counts just like the Task List heading.

![Subtask widget saved view and counts](../assets/subtask_view_nam+count+task_count.png)

## Natural Language Processing

TaskNotes includes a **Natural Language Processor (NLP)** that parses task descriptions written in English to extract structured data. This allows for task creation from conversational language, such as "Prepare quarterly report due Friday #work high priority," which would automatically set the due date, tag, and priority.

The NLP engine supports syntax for:

-   **Tags and Contexts**: `#tag` and `@context` syntax.
-   **Projects**: `+project` for simple projects or `+[[Project Name]]` for projects with spaces.
-   **Priority Levels**: Keywords like "high," "normal," and "low".
-   **Status Assignment**: Keywords like "open," "in-progress," and "done".
-   **Dates and Times**: Phrases like "tomorrow," "next Friday," and "January 15th at 3pm".
-   **Time Estimates**: Formats like "2h," "30min," and "1h30m".
-   **Recurrence Patterns**: Phrases like "daily," "weekly," and "every Monday".

The NLP engine is integrated with the task creation modal. Typing a natural language description there will populate the corresponding fields.
