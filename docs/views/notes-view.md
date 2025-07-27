# Notes View

The Notes View displays your vault's non-task notes organized by date, providing a chronological view of your notes for the selected day.

## What Notes Are Included

The Notes View shows **non-task notes** that meet specific criteria:

### Inclusion Criteria

- **Markdown files** (`.md` extension)
- **Non-task notes** (don't contain the task tag in frontmatter)
- **Date-matched notes** for the selected day
- **Not in excluded folders** (configurable in settings)
- **Note indexing enabled** (performance setting)

### Date Detection

Notes are associated with dates through:
1. **Frontmatter fields**: `dateCreated` or `date` 
2. **Filename patterns**: YYYY-MM-DD format in the filename
3. Only notes matching the selected date appear

### Exclusions

Notes are excluded if they:

- Are task files (contain the configured task tag)
- Are in excluded folders (Templates, Archive, etc.)
- Have note indexing disabled (performance optimization)
- Don't have a date or the date doesn't match the selected day

## Interface Layout

The Notes View consists of:

- **Date navigation header** - Navigate between dates to view notes for different days
- **Note cards list** - Displays all qualifying notes for the selected date
- Each note card shows the note's title, path, and relevant metadata

## Note Actions

**Click to open**: Click on any note card to open the note in the current pane.

## Settings That Affect Notes View

Several settings control what appears in the Notes View:

- **Note indexing** (Settings > Performance > "Disable note indexing")
  - When disabled, no notes appear in this view
- **Excluded folders** (Settings > General > "Excluded folders") 
  - Comma-separated folder paths to exclude from indexing
- **Task tag** (Settings > General)
  - Notes with this tag are treated as tasks and excluded from Notes view

## Performance Considerations

For large vaults, you can:
- Disable note indexing entirely to improve performance
- Add frequently-changing folders (like Templates) to excluded folders
- Note that disabling note indexing will hide the Notes view entirely
