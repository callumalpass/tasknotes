# Progress Tracking

TaskNotes automatically calculates and displays task completion progress based on first-level checkboxes in the task body. This feature provides a visual progress bar similar to Trello, helping you track completion status at a glance.

[← Back to Features](../features.md)

## Overview

The progress feature counts checkboxes at the first indentation level (no indentation) in your task's body content. It calculates completion percentage and displays it as a progress bar or text in task cards.

![Progress Bar Example](../assets/progress-bar-example.png)

## How It Works

### Checkbox Detection

Progress is calculated by analyzing the task body for checkboxes. Only **first-level checkboxes** (no indentation) are counted:

```markdown
---
title: Complete project setup
status: in-progress
progress: 50
---

- [x] Set up repository
- [x] Configure CI/CD
- [ ] Write documentation
- [ ] Deploy to staging
```

In this example, there are 4 first-level checkboxes, 2 completed, resulting in 50% progress.

### Nested Checkboxes

Nested checkboxes (indented) are **not** counted:

```markdown
- [x] Main task
  - [x] Subtask 1 (not counted)
  - [ ] Subtask 2 (not counted)
- [ ] Another main task
```

Only the two main tasks are counted for progress calculation.

## Display Modes

You can configure how progress is displayed in task cards through **Settings → Appearance & UI → Progress Bar**:

### Bar Only
Shows only the visual progress bar without text.

### Text Only
Shows only the text representation (e.g., "2/4 (50%)") without the bar.

### Bar with Text (Default)
Shows both the progress bar and text representation.

## Empty State Handling

When a task has no checkboxes, you can configure how to handle the empty state:

- **Show Zero**: Display "0/0 (0%)" even when there are no checkboxes
- **Hide**: Don't show progress at all when there are no checkboxes

Configure this in **Settings → Appearance & UI → Progress Bar → Empty State**.

## Using Progress in Bases Views

Progress is available as `task.progress` in all Bases views (Table, Kanban, Calendar, etc.) and can be used for:

### Sorting
Sort tasks by progress percentage to see which tasks are most complete.

### Filtering
Filter tasks by progress using Bases filter expressions:

```
task.progress >= 50
```

This shows all tasks that are at least 50% complete.

### Grouping
Group tasks by progress ranges to organize your workflow:

```
task.progress < 25 → "Just Started"
task.progress >= 25 && task.progress < 75 → "In Progress"
task.progress >= 75 → "Nearly Done"
```

## Automatic Updates

Progress is automatically recalculated and updated in the frontmatter when:

- **Task details change**: When you update task body content via the task modal
- **Direct file edits**: When you toggle checkboxes directly in the editor
- **Task creation**: When creating new tasks with body content

The progress value is stored in the task's frontmatter as a number (0-100), making it available for Bases sorting and filtering.

## Frontmatter Storage

Progress is stored in the task's frontmatter as a percentage number:

```yaml
---
title: Complete project setup
status: in-progress
progress: 50
---
```

The `progress` field contains the completion percentage (0-100) and is automatically updated when checkboxes change.

## Performance

Progress calculation is optimized for performance:

- **Lazy Loading**: Progress is only calculated when the property is visible in task cards
- **Caching**: Calculated progress is cached to avoid redundant calculations
- **Automatic Cache Invalidation**: Cache is cleared when task content changes

## Settings

Configure progress display options in **Settings → Appearance & UI → Progress Bar**:

- **Display Mode**: Choose between bar-only, text-only, or bar-with-text
- **Show Percentage**: Toggle percentage display in text mode
- **Show Count**: Toggle checkbox count display (e.g., "2/4")
- **Empty State**: Configure how to handle tasks without checkboxes

## Examples

### Project Milestones

Track project completion with checkboxes:

```markdown
---
title: Q1 Product Launch
status: in-progress
progress: 60
---

- [x] Market research
- [x] Product design
- [x] Development sprint 1
- [ ] Development sprint 2
- [ ] Testing phase
- [ ] Launch preparation
```

### Task Breakdown

Break down complex tasks into checkboxes:

```markdown
---
title: Write technical documentation
status: in-progress
progress: 33
---

- [x] Outline structure
- [ ] Write API documentation
- [ ] Write user guide
```

### Daily Checklist

Use progress to track daily task completion:

```markdown
---
title: Daily standup preparation
status: open
progress: 0
---

- [ ] Review yesterday's tasks
- [ ] Update task statuses
- [ ] Prepare today's priorities
- [ ] Check team blockers
```

## Tips

- **Use consistent formatting**: Keep checkboxes at the first level for accurate counting
- **Update frequently**: Progress updates automatically, but you may need to save the file for changes to reflect
- **Combine with filters**: Use progress filters in Bases views to focus on tasks at specific completion stages
- **Visual feedback**: The progress bar provides quick visual feedback on task completion status
