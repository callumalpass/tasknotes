---
description: Adopt TaskNotes in a vault that already contains tasks, tags, and custom frontmatter without rewriting everything first.
---

# Adopt TaskNotes in an existing vault

TaskNotes can use your current folders and property names. Configure identification and field mapping before creating or converting tasks so the first write follows your vault conventions.

## 1. Back up the vault

Make a complete vault backup, including the hidden `.obsidian` directory. The task notes themselves are Markdown, while TaskNotes settings live in `.obsidian/plugins/tasknotes/data.json`.

## 2. Inspect a representative note

Choose one existing task and record:

- The property or tag that distinguishes tasks from ordinary notes
- The property names used for title, status, priority, due date, and scheduled date
- Whether contexts and tags are stored with or without display prefixes
- The folder patterns that should be included or excluded

Canonical frontmatter values do not include natural-language trigger characters. Store `office`, not `@office`, and `review`, not `#review`.

```yaml
---
type: task
status: open
contexts:
  - office
tags:
  - review
---
```

## 3. Choose task identification

Open **Settings → TaskNotes → General**.

- Choose **Tag** if every task contains one identifying tag, such as `task`.
- Choose **Property** if a property/value pair identifies tasks, such as `type: task`.
- Add archive, template, attachment, or other non-task locations to **Excluded folders**.

Task identification controls indexing and every generated Base filter. Confirm it before regenerating Base files.

## 4. Map properties

Open **Settings → TaskNotes → Task properties** and map TaskNotes fields to the names already used in your notes. Avoid creating two properties for one concept, such as both `due` and `deadline`.

Start with title, status, priority, due, scheduled, projects, contexts, and recurrence. Use the [property types reference](../settings/property-types-reference.md) to check value shapes.

## 5. Test one note

Open one existing note and confirm that TaskNotes recognizes it. Use **TaskNotes: Quick actions for current task** and make a reversible edit, such as changing priority. Inspect the frontmatter before testing a larger set.

If the note is not recognized, use the [troubleshooting decision tree](../troubleshooting.md#tasks-not-appearing-in-views).

## 6. Generate views from the final mapping

Open **Settings → TaskNotes → General → Views & base files** and create or update the default Base files. Generated filters and columns use the current task identifier and field mapping.

The update action replaces configured default Base files. Copy any customized Base to a new filename before updating it.

## 7. Convert incrementally

Convert or edit a small group first. Keep normal version-control or backup checkpoints between batches. Existing notes do not need to move into the default `TaskNotes/Tasks` folder if your storage and exclusion settings already cover their location.
