# Inline Task Settings

Inline task settings control how TaskNotes integrates with your regular note-taking workflow. These settings manage the display of task widgets, instant conversion features, and natural language processing capabilities.

## Task Link Overlay

### Enable Task Link Overlay

**Setting**: `enableTaskLinkOverlay`
**Default**: `true`

When enabled, TaskNotes replaces standard wikilinks to task files with interactive task widgets that display key task information and allow basic task management operations directly within your notes.

**Widget Features When Enabled**:
- Status indicator with click-to-cycle functionality
- Priority indicator with click-to-change capability
- Due date display with date picker access
- Scheduled date display with date picker access
- Task title with link to full task note
- Context menu for additional task operations

**When Disabled**:
- Task links appear as normal Obsidian wikilinks
- No inline task management capabilities
- Standard hover preview functionality applies


## Instant Task Conversion

### Enable Instant Task Convert

**Setting**: `enableInstantTaskConvert`
**Default**: `true`

Controls whether convert buttons appear next to checkbox tasks in edit mode, allowing one-click conversion from simple checkboxes to full TaskNotes.

**When Enabled**:
- File-plus icons appear next to checkbox tasks (`- [ ]` and `- [x]`)
- Click to instantly convert checkbox to TaskNote file
- Multi-line conversion support for additional details
- Automatic link replacement in original location

**When Disabled**:
- No convert buttons appear in edit mode
- Checkbox tasks remain as standard Obsidian checkboxes
- Manual task creation required for TaskNotes functionality



### Apply Defaults on Instant Convert **Setting**: `useDefaultsOnInstantConvert` **Default**: `true`
Determines whether instant conversion applies your configured task defaults (status, priority, contexts, tags, etc.) to converted tasks.

**When Enabled**:
- Converted tasks receive default status and priority
- Default contexts and tags are applied
- Default time estimates and other properties included
- Template processing applied if configured

**When Disabled**:
- Converted tasks use minimal default values
- Only basic task structure created
- No automatic property assignment
- Faster conversion with less processing


## Natural Language Processing

### Enable Natural Language Input

**Setting**: `enableNaturalLanguageInput`
**Default**: `true`

Controls whether the smart input field appears in task creation modals, allowing you to create tasks by typing natural language descriptions.

**When Enabled**:
- Natural language input field appears in task creation modal
- Parse button available to process descriptions
- Live preview of parsed task properties
- Integration with task defaults and templates

**When Disabled**:
- Only standard task property fields available
- No natural language parsing capabilities
- Manual entry required for all task properties

### Default Date Type for Natural Language

**Setting**: `nlpDefaultToScheduled`
**Default**: `true`

When the natural language parser encounters ambiguous date references (like "tomorrow" without explicit "due" or "scheduled" keywords), this setting determines how those dates are interpreted.

**When True (Default to Scheduled)**:
- Ambiguous dates become scheduled dates
- "Buy groceries tomorrow" → scheduled for tomorrow
- Explicit keywords still override: "due tomorrow" → due date

**When False (Default to Due)**:
- Ambiguous dates become due dates  
- "Buy groceries tomorrow" → due tomorrow
- Explicit keywords still override: "scheduled tomorrow" → scheduled date

**Parsing Examples**:

With `nlpDefaultToScheduled: true`:
- "Meeting tomorrow" → scheduled: tomorrow
- "Report due Friday" → due: Friday (explicit)
- "Call client next week" → scheduled: next week

With `nlpDefaultToScheduled: false`:
- "Meeting tomorrow" → due: tomorrow
- "Report scheduled Friday" → scheduled: Friday (explicit)
- "Call client next week" → due: next week

## Integration Behavior

### Interaction with Task Defaults

Inline task settings work together with task defaults:

**Instant Conversion with Defaults**:
- When `useDefaultsOnInstantConvert` is enabled, converted tasks inherit all configured defaults
- Default contexts, tags, status, and priority are applied
- Template processing occurs if body templates are enabled

**Natural Language with Defaults**:
- Parsed values override defaults where specified
- Unspecified properties use configured defaults
- Template variables populated with parsed or default values

