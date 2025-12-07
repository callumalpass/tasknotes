# Migrating from v3 to v4

TaskNotes v4 migrates all views to the Bases system. This guide covers what changed and how to update your setup.

## Requirements

- **Obsidian 1.10.1 or later** (required for Bases API)
- **Bases core plugin enabled** (Settings → Core Plugins → Bases)

## What Changed

### Views are Now Bases Files

All task views (Task List, Kanban, Calendar, Agenda) are now `.base` files stored in `TaskNotes/Views/`. This replaces the custom view system in v3.

| v3 | v4 |
|----|-----|
| Views stored in plugin settings | Views stored as `.base` files |
| Custom filter UI | Bases filter syntax |
| Saved views in settings | Each view is a separate file |

### Automatic Migration on First Launch

When you first open TaskNotes v4:

1. Default `.base` files are created in `TaskNotes/Views/`
2. Ribbon icons and commands now open these `.base` files
3. Your existing task files are unchanged

### Converting Saved Filter Views

If you had saved filter views in v3, you can convert them to `.base` files:

1. Go to Settings → General
2. Find the "Convert Saved Views" button
3. Click to convert your saved views
4. Converted views appear in `TaskNotes/Views/`

This is a one-way conversion. The original saved views remain in settings until you delete them.

## Breaking Changes

### View Configuration

v3 saved views with custom filters need manual conversion to Bases filter syntax. Simple filters (status, priority, due date) convert automatically. Complex filters may need adjustment.

**v3 Filter Example:**
```
status: in-progress
priority: high
```

**v4 Bases Syntax:**
```yaml
filters:
  and:
    - status == "in-progress"
    - priority == "high"
```

See the [Obsidian Bases documentation](https://help.obsidian.md/Bases/Introduction+to+Bases) for filter syntax details.

### Minimum Obsidian Version

v4 requires Obsidian 1.10.1 or later. If you can't upgrade Obsidian, stay on TaskNotes v3.

## New Features in v4

### OAuth Calendar Integration

v4 adds Google Calendar and Microsoft Outlook integration:

- View external calendar events alongside tasks
- Drag events to reschedule (syncs back to calendar provider)
- Events sync every 15 minutes

See [Calendar Setup](calendar-setup.md) for configuration.

### Kanban Swimlanes

The Kanban view now supports horizontal swimlane grouping:

```yaml
views:
  - type: tasknotesKanban
    groupBy:
      property: status
    config:
      swimLane: priority
```

### Time Entry Editor

A dedicated modal for managing time entries:

- Alt-drag on calendar to create time entries
- View total tracked time per task
- Edit and delete time entries

## Troubleshooting

### Views Not Loading

1. Verify Bases core plugin is enabled (Settings → Core Plugins)
2. Check that `.base` files exist in `TaskNotes/Views/`
3. Restart Obsidian

### Missing Saved Views After Upgrade

Saved views from v3 are preserved in settings. Use the conversion button in Settings → General to create `.base` files from them.

### Filter Syntax Errors

Bases uses different filter syntax than v3. Common issues:

| Problem | Solution |
|---------|----------|
| `status: done` | Use `status == "done"` |
| Multiple conditions | Wrap in `and:` or `or:` block |
| Date comparisons | Use `date(due) < today()` |

### Downgrading to v3

Migration is one-way. If you need to downgrade:

1. Uninstall TaskNotes v4
2. Install TaskNotes v3 from releases
3. Reconfigure your saved views manually

Your task files are unaffected—only view configurations change.

## View Templates

For complete `.base` file examples, see [Default Base Templates](views/default-base-templates.md).
