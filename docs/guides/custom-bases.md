---
description: Create a custom Obsidian Base for TaskNotes while keeping generated defaults safe and upgradeable.
---

# Build a custom Base

TaskNotes views are ordinary Obsidian `.base` files. The safest workflow is to copy a generated Base, give it a new path, and customize the copy.

## Start from a copy

1. Open `TaskNotes/Views/` in the file explorer.
2. Duplicate the closest default, such as `tasks-default.base`.
3. Rename the copy, for example `work-tasks.base`.
4. Open the copy and make changes with the Bases interface or source editor.

Avoid editing the only copy of a generated default. **Update default base files** replaces the files configured as defaults.

## Preserve task identification

Every task view needs a filter that matches the identification method in **Settings → TaskNotes → General**.

For tag identification:

```yaml
filters:
  and:
    - file.hasTag("task")
```

For property identification:

```yaml
filters:
  and:
    - note["type"] == "task"
```

Also preserve any excluded-folder conditions generated from your settings.

## Add a focused view

This example starts with recognized tasks, then limits the view to the `work` context:

```yaml
filters:
  and:
    - file.hasTag("task")
    - list(contexts).contains("work")

views:
  - type: tasknotesTaskList
    name: Work
    order:
      - status
      - priority
      - due
      - file.name
    sort:
      - column: due
        direction: ASC
```

Use canonical stored values in filters. Natural-language prefixes such as `@` and `#` are input syntax, not part of stored context and tag values.

## Point a command at the custom Base

Open **Settings → TaskNotes → General → View commands** and change the relevant command path. Resetting that mapping returns it to the generated default path.

## Upgrade safely

When TaskNotes ships improved templates:

1. Keep your custom file at its own path.
2. Run **Update default base files**.
3. Compare the regenerated default with your copy.
4. Bring across only the formulas, filters, or view options you want.

The [generated template reference](../reference/default-base-templates.md) always reflects the current source and default field mapping.

## Recovery

If a custom Base no longer opens, validate its YAML indentation and remove the most recent filter or formula change. You can create a fresh default from settings at any time, then copy your custom view into it one section at a time.
