# TaskNotes Specification

The TaskNotes specification defines how tools should read, write, and reason about task data stored as markdown files with YAML frontmatter.

It exists so that multiple implementations — the Obsidian plugin, the terminal UI, CLI tools, and anything else that touches the same vault — can agree on what a task looks like, how dates and recurrence work, and what happens when a task is completed, skipped, or archived.

The spec is maintained separately from any single implementation. The canonical source is [callumalpass/tasknotes-spec](https://github.com/callumalpass/tasknotes-spec).

## Sections

| Section | Content |
|---|---|
| [Overview](spec/00-overview.md) | Motivation, scope, and design principles |
| [Terminology](spec/01-terminology.md) | Normative definitions used throughout |
| [Model & Mapping](spec/02-model-and-mapping.md) | Task data model, semantic roles, and field mapping |
| [Temporal Semantics](spec/03-temporal-semantics.md) | Date, datetime, and timezone rules |
| [Recurrence](spec/04-recurrence.md) | RRULE semantics and per-instance state |
| [Operations](spec/05-operations.md) | Create, update, complete, skip, delete behaviors |
| [Validation](spec/06-validation.md) | Validation rules and the issue model |
| [Conformance](spec/07-conformance.md) | Conformance profiles and how to claim them |
| [Compatibility & Migrations](spec/08-compatibility-and-migrations.md) | Migration and backwards-compatibility policy |
| [Configuration](spec/09-configuration.md) | `tasknotes.yaml` schema and the provider model |
| [Dependencies & Reminders](spec/10-dependencies-and-reminders.md) | Dependency and reminder semantics |
| [Links](spec/11-links.md) | Link syntax, parsing, and resolution |

## Conformance

The spec includes an executable conformance suite — a set of JSON test fixtures that any implementation can run against via a simple adapter interface. The suite covers date handling, recurrence, field mapping, configuration, operations, validation, and more.

Implementations claim conformance to one or more profiles (core-lite, recurrence, extended, templating) and must declare their spec version and any known deviations.

See the [Conformance](spec/07-conformance.md) section for details.

## For implementers

If you're building a tool that reads or writes TaskNotes data, the spec is the contract. Start with [Model & Mapping](spec/02-model-and-mapping.md) to understand the data model, then [Operations](spec/05-operations.md) for write behavior. The conformance suite can validate your implementation against the spec's expectations.
