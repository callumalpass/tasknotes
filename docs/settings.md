# Settings

Open **Settings → TaskNotes**. TaskNotes uses Obsidian’s native settings pages and requires Obsidian **1.13.1 or newer**.

Use Obsidian’s settings search to find individual options without opening their pages first. Within each main category, ordinary settings appear in headed inline groups rather than separate pages. Larger editors, such as calendar defaults and form fields, retain detail pages. Changes save automatically; invalid values are not saved.

| Page | What belongs here |
| --- | --- |
| **Task files** | Task identification, folders, filenames, and frontmatter storage |
| **Properties** | Property mappings, status and priority definitions, custom properties, and property-specific input behaviour |
| **Task creation** | Defaults for new tasks, templates, natural-language input, and form fields |
| **Appearance & interaction** | Task-card properties, inline tasks, click behaviour, calendar defaults, and view command files |
| **Time & reminders** | Notifications, time tracking, recurrence, Pomodoro, and timeblocking |
| **Calendars & integrations** | Calendar connections, subscriptions, exports, and interoperability |
| **Advanced** | Indexing, diagnostics, the desktop HTTP API, and webhooks |

Interface language, release notes, and documentation links are also available on the main page.

## Properties, defaults, and forms

These settings answer different questions:

- **Properties:** Which frontmatter key stores a value, and what type is it?
- **Task creation → Defaults:** Which values should a new task start with?
- **Task creation → Form fields:** Which fields should people see when creating or editing a task?

Under **Properties**, add a custom property, then open its detail page to set its display name, key, type, and optional default. NLP triggers appear in an inline group in the same editor. Advanced autosuggestion filters remain on a separate detail page. New custom properties are added to the form configuration automatically.

Custom property keys are trimmed when loading, editing and saving settings. Settings edits require a non-empty key that is not already used by another property (case-insensitive). Invalid edits retain the last accepted key.

Changing or trimming a property mapping does **not** rename properties in existing notes. Likewise, changing a status value or deleting a configured property does not rewrite existing task frontmatter. Plan any vault-wide migration separately.

## Global preferences and Bases views

Calendar and task-card settings provide defaults. An individual Bases view can override them. Configure filters, sorting, grouping, and view-specific options within that Base rather than looking for duplicate global controls.

## Further reference

- [Task files and folders](settings/general.md)
- [Properties](settings/task-properties.md)
- [Task defaults](settings/defaults.md)
- [Form fields](settings/modal-fields.md)
- [Appearance](settings/appearance.md)
- [Time and workflow features](settings/features.md)
- [Integrations](settings/integrations.md)
