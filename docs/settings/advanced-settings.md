# Advanced Settings

Advanced settings provide sophisticated customization options for experienced users who need to adapt TaskNotes to specific workflows, vault structures, or performance requirements.

## Field Mapping

Field mapping allows you to customize the YAML property names used in task files, enabling integration with existing vault structures and compatibility with other plugins.

### Purpose and Benefits

**Vault Integration**: Match existing YAML property names in your vault
**Plugin Compatibility**: Work with other task management plugins that use different field names
**Personal Preference**: Use property names that match your mental model
**Legacy Support**: Maintain compatibility with existing task files

### Configurable Field Mappings

**Core Task Fields**:
- `title`: Task title property name (default: `title`)
- `status`: Task status property name (default: `status`) 
- `priority`: Task priority property name (default: `priority`)

**Date Fields**:
- `due`: Due date property name (default: `due`)
- `scheduled`: Scheduled date property name (default: `scheduled`)
- `dateCreated`: Creation date property name (default: `dateCreated`)
- `dateModified`: Modification date property name (default: `dateModified`)
- `completedDate`: Completion date property name (default: `completedDate`)

**Organization Fields**:
- `contexts`: Contexts array property name (default: `contexts`)
- `archiveTag`: Archive tag value (default: `archived`)

**Advanced Fields**:
- `timeEstimate`: Time estimate property name (default: `timeEstimate`)
- `recurrence`: Recurrence pattern property name (default: `recurrence`)
- `timeEntries`: Time tracking array property name (default: `timeEntries`)
- `completeInstances`: Recurring task completion array (default: `complete_instances`)
- `pomodoros`: Pomodoro session data (default: `pomodoros`)

### Field Mapping Examples

**Tasks Plugin Compatibility**:
```
due: due
scheduled: start
status: status
priority: priority
contexts: tags
```

**Custom Naming Scheme**:
```
title: taskName
status: currentStatus
priority: importance
due: deadline
scheduled: workDate
```

**Minimal Mapping**:
```
title: name
status: state
priority: level
due: dueDate
scheduled: startDate
```

### Validation Rules

**Unique Names**: All field names must be unique across the mapping
**No Empty Values**: Field names cannot be empty strings
**YAML Compatibility**: Field names must be valid YAML property names
**Reserved Words**: Cannot use YAML reserved words or special characters

## Custom Status System

Define custom status workflows with colors, completion behavior, and progression order.

### Status Configuration

Each status includes the following properties:

**ID**: Unique identifier for internal use
**Value**: What gets written to YAML frontmatter
**Label**: Display name in user interface
**Color**: Hex color code for visual styling
**Is Completed**: Whether this status counts as "done"
**Order**: Numeric order for status cycling

### Default Status Configuration

```typescript
[
  { id: 'none', value: 'none', label: 'None', color: '#cccccc', isCompleted: false, order: 0 },
  { id: 'open', value: 'open', label: 'Open', color: '#808080', isCompleted: false, order: 1 },
  { id: 'in-progress', value: 'in-progress', label: 'In progress', color: '#0066cc', isCompleted: false, order: 2 },
  { id: 'done', value: 'done', label: 'Done', color: '#00aa00', isCompleted: true, order: 3 }
]
```

### Custom Status Examples

**Agile Workflow**:
```
Backlog → In Progress → Review → Done → Archived
```

**GTD Workflow**:
```
Inbox → Next Action → Waiting → Done
```

**Project Workflow**:
```
Planning → Active → Testing → Complete → Cancelled
```

### Status Validation Rules

**Minimum Requirements**: At least 2 statuses required
**Completion Status**: At least one status must be marked as completed
**Unique Values**: Status values and IDs must be unique
**Valid Colors**: Colors must be valid hex format (#rrggbb)
**Non-Empty**: Values and labels cannot be empty

## Custom Priority System

Configure priority levels with weights, colors, and sorting behavior.

### Priority Configuration

Each priority includes:

**ID**: Unique identifier for internal use
**Value**: What gets written to YAML frontmatter  
**Label**: Display name in user interface
**Color**: Hex color code for visual indicators
**Weight**: Numeric weight for sorting (higher = more important)

### Default Priority Configuration

```typescript
[
  { id: 'none', value: 'none', label: 'None', color: '#cccccc', weight: 0 },
  { id: 'low', value: 'low', label: 'Low', color: '#00aa00', weight: 1 },
  { id: 'normal', value: 'normal', label: 'Normal', color: '#ffaa00', weight: 2 },
  { id: 'high', value: 'high', label: 'High', color: '#ff0000', weight: 3 }
]
```

### Custom Priority Examples

**Eisenhower Matrix**:
```
Not Important/Not Urgent (weight: 0)
Important/Not Urgent (weight: 1)  
Not Important/Urgent (weight: 2)
Important/Urgent (weight: 3)
```

**Business Priority Levels**:
```
Nice to Have (weight: 0)
Standard (weight: 1)
High (weight: 2)
Critical (weight: 3)
Emergency (weight: 4)
```

### Priority Validation Rules

**Minimum Requirements**: At least 1 priority required
**Unique Values**: Priority values, IDs, and weights must be unique
**Valid Colors**: Colors must be valid hex format (#rrggbb)
**Non-Negative Weights**: Weights must be non-negative numbers
**Non-Empty**: Values and labels cannot be empty

## Performance Settings

### Note Indexing

**Setting**: `disableNoteIndexing`
**Default**: `false`

When enabled, disables indexing of non-task notes to improve performance in large vaults.

**Performance Impact**:
- **Enabled**: Notes view becomes unavailable, but task operations are faster
- **Disabled**: Full functionality available, may be slower with many notes

**Use Cases**:
- Large vaults with thousands of notes
- Users who don't use the Notes view
- Performance-critical environments

**Trade-offs**:
- Disabling breaks Notes view functionality
- Agenda view will only show tasks, not notes
- Note-based date navigation becomes unavailable

## Pomodoro Timer Settings

Advanced configuration for the built-in pomodoro timer system.

### Timer Durations

**Work Session Duration**: `pomodoroWorkDuration`
**Default**: `25` minutes

**Short Break Duration**: `pomodoroShortBreakDuration`
**Default**: `5` minutes

**Long Break Duration**: `pomodoroLongBreakDuration`  
**Default**: `15` minutes

**Long Break Interval**: `pomodoroLongBreakInterval`
**Default**: `4` (sessions before long break)

### Automation Settings

**Auto-Start Breaks**: `pomodoroAutoStartBreaks`
**Default**: `true`

**Auto-Start Work**: `pomodoroAutoStartWork`
**Default**: `false`

Controls whether timers automatically start after session completion.

### Notification Settings

**Enable Notifications**: `pomodoroNotifications`
**Default**: `true`

**Enable Sound**: `pomodoroSoundEnabled`
**Default**: `true`

**Sound Volume**: `pomodoroSoundVolume`
**Range**: 0-100
**Default**: `50`

### Data Storage Location

**Setting**: `pomodoroStorageLocation`
**Options**: `plugin`, `daily-notes`
**Default**: `plugin`

**Plugin Storage**: Session data stored in plugin data files
**Daily Notes Storage**: Session data stored in daily note frontmatter

**Daily Notes Requirements**:
- Requires Daily Notes plugin to be enabled
- Uses configured daily notes folder and format
- Integrates with existing daily note workflow

## Configuration Management

### Settings Export/Import

TaskNotes settings are stored in Obsidian's standard plugin data format:

**Location**: `.obsidian/plugins/tasknotes/data.json`
**Format**: JSON with typed structure
**Backup**: Included in Obsidian vault backups automatically

### Migration and Updates

**Automatic Migration**: Settings are automatically migrated when plugin updates introduce new fields
**Validation**: Settings are validated on load and invalid configurations are reset to defaults
**Backward Compatibility**: Existing settings continue to work with new plugin versions

### Advanced Customization

For users comfortable with JSON editing:

**Direct Editing**: Settings file can be edited directly when Obsidian is closed
**Bulk Configuration**: Useful for setting up multiple vaults with identical configurations
**Scripting Support**: Settings can be programmatically modified through Obsidian's plugin API

These advanced settings provide the flexibility needed to adapt TaskNotes to sophisticated workflows while maintaining the simplicity of default configurations for standard use cases.