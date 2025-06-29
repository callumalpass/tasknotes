# Inline Task Integration

TaskNotes provides several features that integrate task management directly into your regular note-taking workflow. These features allow you to work with tasks without leaving your notes or switching to dedicated task views.

## Task Link Overlay

### Interactive Task Previews

When you create wikilinks to task notes (`[[task-name]]`), TaskNotes displays interactive widgets instead of plain links. These widgets show essential task information and allow basic task management operations directly within your notes.

### Widget Components

Task link widgets display:

**Status Indicator**: Colored dot showing current task status that can be clicked to cycle through available statuses.

**Task Title**: The task name, truncated at 80 characters with full title available on hover.

**Priority Indicator**: Colored dot representing priority level that can be clicked to change priority.

**Due Date**: Calendar icon with date that opens a date picker when clicked.

**Scheduled Date**: Clock icon with date that opens a date picker when clicked.

**Context Menu**: Vertical ellipsis icon or right-click access to full task editing options.

### Widget Interactions

**Status Changes**: Click the status indicator to cycle through your configured statuses.

**Priority Changes**: Click the priority indicator to change between priority levels.

**Date Editing**: Click date displays to open date picker context menu for quick scheduling changes.

**Full Editing**: Click the context menu icon or right-click for access to the complete task edit modal.

**Navigation**: Click the task title to open the full task note.

**Drag Support**: Drag task widgets to calendar views to reschedule tasks.

## Instant Task Conversion

### Checkbox Task Conversion

The instant conversion feature transforms standard Obsidian checkbox tasks into full TaskNotes with a single click.

### Conversion Process

**Detection**: The system identifies checkbox tasks (`- [ ]` or `- [x]`) in your notes.

**Convert Buttons**: Small file-plus icons appear next to eligible checkbox tasks in edit mode.

**One-Click Conversion**: Clicking the convert button:
1. Creates a new TaskNote file with the checkbox text as the title
2. Applies configured default settings (status, priority, contexts, tags)
3. Processes any additional selected lines as task details
4. Replaces the checkbox with a wikilink to the new task

### Multi-Line Support

The conversion system supports multi-line task creation:

**Title Line**: The checkbox line becomes the task title
**Detail Lines**: Additional selected lines below the checkbox become the task body content
**Smart Selection**: The system preserves your text selection during conversion

### Integration with Defaults

Converted tasks automatically receive:

**Default Values**: Status, priority, contexts, and tags from your configured defaults
**Template Processing**: Body template application if configured
**Folder Placement**: Creation in your default tasks folder

## Task Link Overlay System

### Live Preview Integration

TaskNotes integrates with Obsidian's live preview mode (CodeMirror 6) to display task widgets in real-time as you type and edit notes.

### Dynamic Updates

**Real-Time Refresh**: Task widgets update immediately when underlying task data changes
**State Persistence**: Widget state is maintained during note editing and scrolling
**Performance Optimization**: Only visible widgets are rendered to maintain editor performance

## Convert Button System

### Editor Integration

Convert buttons appear automatically in edit mode next to checkbox tasks that can be converted to TaskNotes.

### Visual Design

**Minimal Interface**: Small, unobtrusive file-plus icons positioned at line ends
**Responsive Display**: Buttons appear and disappear based on cursor position and edit mode
**Click Handling**: Special event handling preserves text selection during conversion

## Validation and Error Handling

### Conversion Safety

The instant conversion system includes multiple validation checks:

**Editor State Validation**: Ensures the editor is in a valid state for conversion
**Selection Validation**: Verifies that selected text is appropriate for task creation
**File System Checks**: Confirms ability to create new files in the target location
**Race Condition Protection**: Prevents multiple simultaneous conversions

### Error Recovery

**Graceful Degradation**: Conversion failures don't affect the original note content
**User Feedback**: Clear error messages when conversion cannot proceed
**State Restoration**: Editor state is preserved if conversion fails

## Hover Preview Integration

### Native Obsidian Integration

Task link widgets integrate with Obsidian's hover preview system, allowing you to preview task content by hovering over task links.

### Preview Content

Hover previews show:
- Full task note content
- Complete YAML frontmatter
- Any additional notes or context in the task body

## Configuration Options

### Task Link Overlay Settings

**Enable/Disable**: Toggle task link overlays on or off in the plugin settings.

### Instant Convert Settings

**Default Application**: Choose whether converted tasks inherit default settings.

### Visual Customization

Task widgets respect Obsidian themes and can be further customized with CSS to match your vault's visual style.
