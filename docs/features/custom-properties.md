# Custom Properties

[← Back to Features](../features.md)

<!--
Recording Script
SETUP (need tasks with contexts, timeEstimate):
  cd .obsidian/plugins/tasknotes
  node scripts/generate-test-data.mjs --clean   # or: bun run generate-test-data:clean
  Reload plugin in Obsidian

Use: TaskNotes/Demos/Custom Properties Demo.base
Show PropertyPicker with type badges and scope chips
Show clicking scope chips: "This note" → "View items" → "All tasks" → "All files"
Show searching for a property, selecting it, seeing it appear as editable row
Show selecting "Use as Due date" on a custom property → date picker appears
-->
{>> I have a lot of comments down below. We need to clarify for sure how custom. how custom properties relates to per base mapping or just property mapping in general.  There may be a lot of confusion around these. per base mapping, though, is more related to bulk tasking or like a tasking workspace. And that's something we could call out in the workflow section. Tasking workspaces You know how you work with tasks. One context would be on the fly in line and then the other would be from a task workspace, which is really just an obsidian base.<<}
TaskNotes discovers custom frontmatter properties from your existing task files and lets you use them in filters, views, modals, and bulk operations. You are not limited to the built-in fields. Any property you add to a task's frontmatter can become a first-class part of your workflow.{>>We need to show a diagram that shows why. being able to map custom properties to the task note properties is useful Also probably need to have a terminology section in our docs so that we can refer to it. But long story short here on the custom properties you might. have a different schema in all sorts of contexts across the vault. For instance, you might have a base where you have certain columns which are really just properties in the YAML front matter.  And their only specific to that type of context or base view, for instance, And so you still want them to have the functionality, but you can.' Use the global task note core properties. So we can actually remap to those properties on the fly. We need to explain this in intuitive way, and maybe use a mermaid diagram to show it.<<}

<!-- SCREENSHOT: PropertyPicker showing discovered properties with type badges and scope chips -->



Custom properties appear throughout TaskNotes: in [task modals](task-management.md#editing-tasks), [bulk operations](bulk-tasking.md#custom-properties-in-bulk-operations), [per-view field mapping](per-base-mapping.md), and [Bases view filters](../views.md).

## Discovering Properties

TaskNotes scans your vault's frontmatter to find properties beyond the built-in task fields. When you open a task modal or the bulk tasking dialog, the PropertyPicker reads the metadata cache (not the files directly, so it is fast even on large vaults) and presents every custom property it finds.

Built-in properties like `title`, `status`, `due`, `tags`, and identity fields like `type`, `assignee`, and `creator` are excluded automatically. Properties from your global field mapping (when you have renamed a built-in field) are also excluded. What remains are your custom additions -- project codes, review dates, effort estimates, client names, or anything else you have added.

Each discovered property shows:

- **Name** in human-readable form (underscores become spaces, first letter capitalized)
- **Type badge** with a color indicating what kind of value it holds
- **File count** showing how many files use this property (in catalog view)

| Type | Badge color | Detected when |
|------|-------------|---------------|
| Date | Blue | Value is a `Date` object or a string starting with `YYYY-MM-DD` |
| Text | Green | Value is a non-date string |
| Number | Purple | Value is a number |
| Boolean | Orange | Value is `true` or `false` |
| List | Cyan | Value is an array |

Type detection runs on each value individually. If a property is used as a date in some files and as text in others, the PropertyPicker shows the dominant type (the most common one) and flags the inconsistency.

## Scope Chips

<!-- GIF: Clicking scope chips to switch between "This note", "View items", "All tasks", and "All files" -->

Above the PropertyPicker search input, scope chips control where properties are discovered from. Click a chip to switch scopes:

| Chip | Label | What it scans |
|------|-------|---------------|
| This note | "This note" | Only the current task's frontmatter |
| View items | "View items" | All files currently shown in the Bases view |
| All tasks | "All tasks" | Every file identified as a task in your vault |
| All files | "All files" | Every Markdown file in the vault |

{>>Not sure it's applicable here, but if you're ever referencing something else in the tool, the task notes tool then actually linked to it from here. Don't just mention what it is.<<}Not all chips are always visible. "This note" only appears when editing an existing task. "View items" only appears when the PropertyPicker was opened from a Bases view context (like bulk tasking).

The default scope depends on context: if you opened from a view, it starts on "View items". If you are editing a single task, it starts on "This note". Otherwise it defaults to "All tasks".

Switching scopes immediately reloads the property list. A property that exists on one task might not appear in "All tasks" if the scope started on "This note", and switching to "All files" may reveal properties from non-task notes that you could adopt.

## Adding a Custom Property

<!-- GIF: Searching for a property in the PropertyPicker, selecting it, and seeing it appear as an editable row -->
{>>Originally, we also have this for the reminders model. I'm not sure if we want to call that out here as well, and then link to the page from there, but it could be something.<<}
In any task creation or edit modal, scroll to the **Additional Properties** section. The PropertyPicker search input lets you:

1. **Select an existing property** -- start typing to filter discovered properties, then click one. It appears as an editable row below the picker with an appropriate editor (text input, date picker, or checkbox depending on the detected type).

2. {>>Not sure how to visually call this out, but this second type of thing that you can do is going to rarely be used from this, and there's definitely better plugins that can do it at scale, way better. So avoid this. Maybe call an experimental, I'm not sure what to do here, but this is rarely going to be used. and we should style it that way on this document page.<<}**Create a new property** -- type a name that does not match any existing property and press Enter. A small form appears where you choose the property type (text, number, date, boolean, list). The property is added to the task's frontmatter when you save.

Once added, a property row shows its name, current value, and a remove button. You can add multiple custom properties to a single task.

### Using Properties in Bulk Operations

The [Bulk Tasking](bulk-tasking.md) modal has the same PropertyPicker. Properties you set there apply to every item in the batch:

{>>We should probably just replace these three with a gig. that or a video that's also used in the bulk tasking modal so that we're not duplicating a demonstrations and we can just reference the same demonstration file right here. That might be a good idea.<<}- In **Generate** mode, custom properties are written to each new task file
- In **Convert** mode, custom properties are added only if the file does not already have them
- In **Edit** mode, custom properties overwrite existing values

## Type Detection and Conversion

{>>Awful lot of text for something that isn't as important of a call out, so maybe you can try to make some of these a collapsed by default call out and. we could just have a GIF or a video or something that shows it in action and that could take up most of the space here. But the how it works could be like a call out or something like that.<<}When a property has inconsistent types across files (for example, `review_date` is a proper date in 43 files but plain text in 2 files), the PropertyPicker flags it. The catalog view shows a type breakdown:

```
review_date   Date (43)  Text (2)  -- 2 mismatched files
```

You can convert mismatched files to a consistent type. Click the convert button next to the property, and TaskNotes shows a confirmation dialog listing how many files will be updated. Conversion uses Obsidian's `processFrontMatter` API to safely rewrite each file's YAML.

Conversion targets depend on context. In the reminder modal, only date conversion is offered (since reminders need date anchors). In task modals, all type conversions are available.

## Per-Task Field Overrides

Custom properties can replace built-in date and assignee fields on a per-task basis. This is useful when your vault uses different property names for the same concept -- one project might use `deadline` while another uses `due`.

<!-- GIF: Selecting "Use as Due date" on a custom property and seeing it switch to a date picker -->
{>>I thought this was what we were calling out in a section above it somewhere. Or maybe we also have custom and global properties. We are. currently we only allow that at the global level for reminders. but we plan on making a bulk tasking version of that for all bulk tasking models, but that'll have to be a later feature. So we should add that to the road map as well.<<}
When you select a custom property in the PropertyPicker, a **Use as** option appears next to it. Click it to see which core fields the property can replace:

| Core field | What it replaces |
|------------|-----------------|
| Due date | The task's due date |
| Scheduled date | The task's scheduled date |
| Completed date | When the task was completed |
| Created date | When the task was created |
| Assignee | Who the task is assigned to |

Choosing "Use as Due date" on a property called `deadline` means:

1. The task's due date is read from and written to `deadline` instead of the global due date property
2. A tracking property (`tnDueDateProp: deadline`) is saved in the task's frontmatter so TaskNotes always knows where to find the due date, even without view context
3. The property row switches to a rich editor (date picker for dates, person/group picker for assignee) instead of a plain text input

Each core field can only be mapped to one custom property at a time. If `deadline` is already mapped to Due date, the "Use as Due date" option is grayed out for other properties.

The tracking properties are internal to TaskNotes:

| Tracking property | Maps to |
|-------------------|---------|
| `tnDueDateProp` | Due date |
| `tnScheduledDateProp` | Scheduled date |
| `tnCompletedDateProp` | Completed date |
| `tnCreatedDateProp` | Created date |
| `tnAssigneeProp` | Assignee |

These are hidden from the PropertyPicker (they are in the core properties skip list) and should not be edited manually. They make each task self-describing: the notification system, overdue calculations, sorting, and views all read the tracking property first, then fall back to the global field mapping.

## Settings
{>>There will be a lot of user confusion around how these differ from the other ones, like the custom property mappings per view, not per view, but per per task. The. are really just additional things that you can fill out a. essentially letting you fill out a proper ty like a custom yamel property on the fly. So really any plugin could do this, but we just allow you to do it alongside your task notes if there's an additional thing you always want to track with a task though the property doesn't really do anything with the back end task note logic. but this could change in the future.  <<}
These settings are in **Settings > Task Properties > User Fields**:

| Setting | Default | Description |
|---------|---------|-------------|
| User fields | (empty) | Properties to always show in task modals, even if not yet on the current task |
| Modal field visibility | All shown | Choose which built-in and custom fields appear in the task creation and edit modals |

User fields let you define properties that should always be available in task modals without needing to discover them first. Add a property name and type, and it appears as an editable row every time you create or edit a task.

## Related

- [Task Management](task-management.md) for built-in task properties
- [Per-View Property Mapping](per-base-mapping.md) for per-view field name configuration
- [Bulk Tasking](bulk-tasking.md) for using custom properties in bulk operations
- [Views](../views.md) for filtering and sorting by custom properties
