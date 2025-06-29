# Core Concepts

TaskNotes is a task and note management plugin for Obsidian that is built on the principle of "one note per task." This means that each task is a Markdown note, and all task-related information is stored in the note's YAML frontmatter.

## The Note-Per-Task Approach

TaskNotes uses individual Markdown notes for each task, rather than a centralized database or a proprietary format. This approach has several implications:

**Data Ownership and Portability**: Each task is a standard Markdown file that you can read, edit, and back up with any text editor or automation tool.

**Rich Context and Flexibility**: You can include additional content in the body of each task note, such as research findings, meeting notes, or links to related documents.

**Obsidian Integration**: By treating tasks as notes, TaskNotes can use Obsidian's core features, such as backlinking, graph visualization, and tag management.

Storing each task as a separate file can lead to a large number of small files, which may not be ideal for all organizational preferences.

## YAML Frontmatter for Structured Data

TaskNotes uses YAML frontmatter to store structured task metadata, such as due dates, priority levels, and status. This human-readable format has several implications:

**Standardization and Extensibility**: YAML is a widely adopted standard with broad tool support, which allows you to integrate your task data with external systems. You can also extend the data model by adding custom fields to the frontmatter.

**Performance and Compatibility**: By using Obsidian's native metadata cache, TaskNotes can maintain good performance, even with a large number of tasks. The use of YAML frontmatter also allows for compatibility with other Obsidian plugins, such as Bases.

**Version Control and Collaboration**: Since tasks are stored as plain text files, they can be used with version control systems like Git.

## A Methodology-Agnostic Approach

TaskNotes does not enforce a specific task management methodology. It provides a set of tools that can be adapted to a variety of productivity systems, including:

- **Getting Things Done (GTD)**: Contexts, status workflows, and calendar integration can be used to support GTD principles.
- **Timeboxing and Time-blocking**: Calendar integration and time tracking features can be used for time-based planning.
- **Project-based Organization**: Tags, contexts, and linking capabilities can be used for project-centric workflows.
- **Kanban and Agile**: The Kanban view and customizable status systems can be used to support agile development processes and other visual workflows.