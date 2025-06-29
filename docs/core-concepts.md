# Core Concepts

TaskNotes is a powerful task and note management plugin for Obsidian, designed around the central principle of "one note per task." This approach treats each task as a complete Markdown note, storing all task-related information directly within the note's YAML frontmatter. This design philosophy ensures that your data remains portable, extensible, and seamlessly integrated with the Obsidian ecosystem.

## The Note-Per-Task Approach

At the heart of TaskNotes is the decision to use individual Markdown notes for each task, rather than relying on a centralized database or proprietary format. This approach offers several key advantages:

**Data Ownership and Portability**: Each task exists as a standard Markdown file that you own and control. You can read, edit, back up, and process these files with any text editor or automation tool, ensuring that your data remains accessible and future-proof, independent of TaskNotes or Obsidian itself.

**Rich Context and Flexibility**: Unlike traditional task management systems that limit you to a few predefined fields, TaskNotes allows you to include unlimited additional content within the body of each task note. You can add research findings, meeting notes, links to related documents, embedded images, code snippets, or any other relevant information, creating a rich, contextualized record of your work.

**Seamless Obsidian Integration**: By treating tasks as notes, TaskNotes leverages Obsidian's core features, such as backlinking, graph visualization, full-text search, and tag management. This allows you to create intricate networks of interconnected tasks, projects, and ideas, enhancing your ability to navigate and understand your work.

While this approach offers significant benefits, it's important to be aware of the trade-offs. Storing each task as a separate file can lead to a large number of small files, which may not suit everyone's organizational preferences. Additionally, a large volume of task files can impact vault performance, although TaskNotes includes optimizations to mitigate this.

## YAML Frontmatter for Structured Data

TaskNotes uses YAML frontmatter to store structured task metadata, such as due dates, priority levels, and status. This human-readable format provides a powerful combination of structure and flexibility, offering several advantages:

**Standardization and Extensibility**: YAML is a widely adopted standard with broad tool support, making it easy to integrate your task data with external systems. You can also extend the data model by adding custom fields to the frontmatter, allowing you to tailor TaskNotes to your specific needs without waiting for plugin updates.

**Performance and Compatibility**: By leveraging Obsidian's native metadata cache, TaskNotes achieves excellent performance, even with thousands of tasks. The use of YAML frontmatter also ensures compatibility with other Obsidian plugins, such as Bases, which can be used for database-style operations like bulk updates and complex filtering.

**Version Control and Collaboration**: Since tasks are stored as plain text files, they work seamlessly with version control systems like Git. This allows you to track changes to your task data over time, collaborate with others, and maintain a complete history of your work.

## A Methodology-Agnostic Approach

TaskNotes is designed to be methodology-agnostic, providing a flexible set of tools that can be adapted to a wide range of productivity systems, including:

- **Getting Things Done (GTD)**: Contexts, status workflows, and calendar integration support GTD principles, while allowing for customization.
- **Timeboxing and Time-blocking**: Calendar integration and time tracking features facilitate time-based planning without imposing rigid scheduling structures.
- **Project-based Organization**: Tags, contexts, and linking capabilities enable project-centric workflows while maintaining task-level granularity.
- **Kanban and Agile**: The Kanban view and customizable status systems support agile development processes and other visual workflows.

By integrating task management directly into your note-taking workflow, TaskNotes helps you maintain context, reduce friction, and create a unified, interconnected system for managing your work and ideas.
