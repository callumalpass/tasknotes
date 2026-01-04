# fix-prio-label-mapping

## Kanban Priority Label Mapping

This change ensures Kanban column headers use the configured priority labels when grouped by priority (including swimlanes), instead of the raw stored values.

Examples (illustrative):

- Priority label display: a priority value like `high` with label "High Priority" renders as "High Priority" in the column header.

## Changelog

- Kanban column headers now map priority values to their configured labels when grouped by priority.
