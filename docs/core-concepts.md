# Core Concepts

TaskNotes follows the "one note per task" principle, where each task lives as a separate Markdown note with structured metadata in YAML frontmatter.

## The Note-Per-Task Approach

Individual Markdown notes replace centralized databases or proprietary formats. Each task file can be read, edited, and backed up with any text editor or automation tool.

The note body holds additional context like research findings, meeting notes, or links to related documents. Since tasks are proper notes, they work with Obsidian's backlinking, graph visualization, and tag management.

This approach does create many small files, which may not suit every organizational preference.

## YAML Frontmatter for Structured Data

Task metadata like due dates, priorities, and status live in YAML frontmatter. This widely adopted standard has broad tool support, letting you integrate task data with external systems and extend the data model with custom fields.

TaskNotes uses Obsidian's native metadata cache for performance, even with large task counts. The YAML format works with other Obsidian plugins like Bases, and plain text files integrate naturally with version control systems like Git.

## Methodology-Agnostic Design

TaskNotes doesn't enforce any specific productivity methodology. The tools adapt to various approaches:

Getting Things Done benefits from contexts, status workflows, and calendar integration. Time-based planning uses calendar integration and time tracking features. Project-centric workflows leverage the projects feature with tags, contexts, and linking. Kanban and Agile methodologies work with the Kanban view and customizable status systems.