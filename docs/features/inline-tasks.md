# Inline Task Integration

[← Back to Features](../features.md)

TaskNotes integrates with the Obsidian editor to allow task management directly within notes. This is achieved through interactive widgets, a conversion feature for checkboxes, and natural language processing.

## Task Link Overlays

When a wikilink to a task note is created, TaskNotes can replace it with an interactive **Task Link Overlay**. Enable or disable overlays from **Settings → TaskNotes → General → Task link overlay**. The widget displays information about the task, such as its status, priority, and due date, and allows actions like changing the status or priority or opening the task for editing directly from the note.

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

## Create Inline Task Command

The `Create inline task` command allows you to create a new task from the current line in the editor. This command is available in the command palette.

When you run the command, the current line is used as the title of the new task. The line is then replaced with a link to the new task file.

## Instant Task Conversion

The **Instant Task Conversion** feature transforms lines in your notes into TaskNotes files. This works with both checkbox tasks and regular lines of text. Turn the feature on or off from **Settings → TaskNotes → Features → Show convert button next to checkboxes**. When enabled, a "convert" button appears next to the content in edit mode. Clicking this button creates a new task note using the line's text as the title and replaces the original line with a link to the new task file.

### Folder Configuration

By default, converted tasks are placed in the same folder as the current note (`{{currentNotePath}}`). You can change this behavior in **Settings → TaskNotes → General → Folder for converted tasks**:

- **Leave empty**: Uses your default tasks folder (configured in the same section)
- **`{{currentNotePath}}`**: Places tasks in the same folder as the note you're editing (default)
- **`{{currentNoteTitle}}`**: Creates a subfolder named after the current note
- **Custom path**: Specify any folder path (e.g., `TaskNotes/Converted`)

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

## Relationships Widget

**New in v4**: The Relationships Widget consolidates what were previously three separate widgets (project subtasks, task dependencies, and blocking tasks) into a single dynamic interface.

The widget appears in task notes and automatically displays up to four tabs based on available relationship data:

- **Subtasks Tab (Kanban)**: Shows tasks that reference the current note as a project. Uses Kanban layout for visual task management.
- **Projects Tab (List)**: Shows projects that the current task belongs to. Uses list layout.
- **Blocked By Tab (List)**: Shows tasks that are blocking the current task. Uses list layout.
- **Blocking Tab (Kanban)**: Shows tasks that the current task is blocking. Uses Kanban layout.

### Automatic Tab Management

Tabs automatically show or hide based on the presence of relationship data. If a task has no subtasks, the Subtasks tab does not appear. If there are no blocking relationships, those tabs remain hidden. This keeps the interface focused on relevant information.

### Features

The widget embeds the `TaskNotes/Views/relationships.base` view directly in the editor. Every filter, grouping rule, or property shown in that `.base` file is exactly what appears inside the widget, so you can customize the experience by editing the file just like any other Bases view.

Additional behavior:

- **Collapsible Interface**: Click the widget title to expand or collapse. The state is remembered between sessions.
- **Persistent Grouping**: Any grouping defined in the `.base` file is honoured, and collapsed groups retain their state per note.
- **Task Details**: Each task shows its status, priority, due date, and other configured properties.
- **Real-time Updates**: The widget updates automatically when tasks are added, modified, or deleted via Bases views.

### Configuration

Enable or disable the widget in **Settings → TaskNotes → Misc Settings → Show Relationships Widget**.

Position the widget at the top (after frontmatter) or bottom of the note using the **Relationships Position** setting.

### Expandable Subtasks Chevron

Tasks with subtasks can display an expand/collapse chevron that toggles subtask visibility.

- The chevron can be positioned on the Right (default, hover to show) or on the Left (always visible, matches group chevrons).
- Configure this in Settings → TaskNotes → Misc Settings → Subtask chevron position.

![Left subtask chevron](../assets/left-task-subtask-chevron.gif)

### Migration from v3

In v3, TaskNotes provided three separate widgets controlled by individual settings:

- `showProjectSubtasks` and `projectSubtasksPosition`
- `showTaskDependencies` and `taskDependenciesPosition`
- `showBlockingTasks` and `blockingTasksPosition`

These settings are replaced in v4 by:

- `showRelationships` and `relationshipsPosition`

If you had project subtasks enabled in v3, the relationships widget will be enabled automatically after upgrading to v4. The underlying Bases file changed from `TaskNotes/Views/project-subtasks.base` to `TaskNotes/Views/relationships.base`. Run the **Create Default Files** command in Settings → General to create the new relationships.base file.

## Natural Language Processing

TaskNotes includes a **Natural Language Processor (NLP)** that parses task descriptions to extract structured data. This allows for task creation from conversational language, such as "Prepare quarterly report due Friday #work high priority," which would automatically set the due date, tag, and priority.

The NLP engine supports multiple languages, including English, Spanish, French, German, Italian, Japanese, Dutch, Portuguese, Russian, Swedish, Chinese, and Ukrainian.

### Supported Syntax

The NLP engine recognizes:

-   **Tags and Contexts**: `#tag` and `@context` syntax (triggers are customizable).
-   **Projects**: `+project` for simple projects or `+[[Project Name]]` for projects with spaces.
-   **Priority Levels**: Keywords like "high," "normal," and "low". Also supports a trigger character (default: `!`).
-   **Status Assignment**: Keywords like "open," "in-progress," and "done". Also supports a trigger character (default: `*`).
-   **Dates and Times**: Phrases like "tomorrow," "next Friday," and "January 15th at 3pm".
-   **Time Estimates**: Formats like "2h," "30min," and "1h30m".
-   **Recurrence Patterns**: Phrases like "daily," "weekly," and "every Monday".
-   **User-Defined Fields**: Custom fields can be assigned using configured triggers (e.g., `effort: high`). Supports quoted values for multi-word entries.

### Rich Markdown Editor

**New in v4**: The task creation modal uses a rich CodeMirror markdown editor instead of a plain textarea.

Features include:

-   **Live Preview**: Rendered markdown preview as you type.
-   **Syntax Highlighting**: Code blocks, links, and formatting are highlighted.
-   **Wikilink Support**: Create links to other notes using `[[Note Name]]` syntax.
-   **Keyboard Shortcuts**:
    - `Ctrl/Cmd+Enter` saves the task
    - `Esc` or `Tab` to navigate out of the editor
-   **Placeholder Text**: Shows an example task (e.g., "Buy groceries tomorrow at 3pm @home #errands") when the editor is empty.

### Customizable Triggers

**New in v4**: Triggers for NLP properties can be customized in **Settings → Features → NLP Triggers**.

You can configure trigger characters or strings for:

-   **Tags** (default: `#`) - When set to `#`, Obsidian's native tag suggester is used
-   **Contexts** (default: `@`)
-   **Projects** (default: `+`)
-   **Status** (default: `*`)
-   **Priority** (default: `!`, disabled by default)
-   **User-Defined Fields** (default: `fieldname:`) - Each custom field can have its own trigger

Triggers support up to 10 characters and can include trailing spaces (e.g., `"def: "` for a custom field).

### Autocomplete

**New in v4**: When typing a trigger in the NLP editor, an autocomplete menu appears with available values.

-   Navigate suggestions with arrow keys
-   Select with `Enter` or `Tab`
-   Autocomplete works for tags, contexts, projects, status, priority, and user-defined fields
-   Tag autocomplete uses Obsidian's native tag suggester when using the `#` trigger
-   For user fields with multi-word values, wrap the value in quotes (e.g., `effort: "very high"`)

The NLP engine is integrated with the task creation modal and bulk conversion features. Typing a natural language description populates the corresponding task fields automatically.
