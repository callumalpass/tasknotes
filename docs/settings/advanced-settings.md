# Advanced Settings

This page documents advanced configuration patterns that are spread across multiple TaskNotes settings tabs.

## Where Advanced Configuration Lives

TaskNotes v4 uses a 6-tab settings layout:

- `General`
- `Task Properties`
- `Modal Fields`
- `Appearance`
- `Features`
- `Integrations`

There is no separate `Advanced` tab in the current UI.

## Field Mapping

Field mapping controls which frontmatter keys TaskNotes reads and writes for core properties.

Location:

- `Settings -> TaskNotes -> Task Properties`

Use field mapping when:

- You already use different frontmatter key names in your vault.
- You are integrating with other plugins that expect specific keys.

## User Fields

User fields add custom properties that become available in filters, grouping, sorting, and modal forms.

Location:

- `Settings -> TaskNotes -> Task Properties`

Typical fields:

- Text (`client`, `assignee`)
- Number (`effort`, `score`)
- Date (`reviewDate`)
- Boolean (`urgent`)
- List (`labels`, `stakeholders`)

## Status and Priority Workflows

Custom statuses and priorities are configured in Task Properties.

Location:

- `Settings -> TaskNotes -> Task Properties`

Notes:

- Statuses define workflow progression and completion semantics.
- Priority names sort lexicographically in Bases unless your view uses explicit formulas.

## Modal Field Layout

The create/edit modal can be reconfigured to show only relevant fields.

Location:

- `Settings -> TaskNotes -> Modal Fields`

This is useful when your team standardizes a minimal required schema.

## Time Tracking and Pomodoro Controls

Time tracking auto-stop and pomodoro behavior are configured in Features.

Location:

- `Settings -> TaskNotes -> Features`

## ICS-Specific Field Mapping

ICS-related identifiers (`icsEventId`, ICS tag field) are part of field mapping.

Location:

- `Settings -> TaskNotes -> Task Properties`

These fields are used to maintain links between imported calendar events and created notes/tasks.
