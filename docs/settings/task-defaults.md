# Task Defaults

These settings control the default properties for new tasks, as well as the file management and template settings.

## Folder and File Management

You can specify a **Default Tasks Folder** where new tasks will be created. You can also configure the **Task Tag** that identifies notes as TaskNotes, and you can specify a list of **Excluded Folders** that will be ignored by the plugin.

TaskNotes also provides a system for **Filename Generation**. You can choose from a variety of patterns, including title-based, timestamp-based, and Zettelkasten-style, or you can create your own custom filename template.

### Store Title Exclusively in Filename

This setting provides an alternative way to manage your task titles. When enabled, the task's title will be used as the filename, and the `title` property will be removed from the frontmatter. This is a significant data storage change that simplifies frontmatter but disables all other filename templating options.

**Important Considerations:**

*   **Backward Compatibility:** This feature is designed to be backward-compatible. Existing tasks with the `title` property in their frontmatter will continue to work as expected. The plugin will always prioritize reading the title from the frontmatter if it exists.
*   **New Tasks:** New tasks created with this setting enabled will have their title stored exclusively in the filename.
*   **Migration:** To migrate an existing task to this new system, you will need to manually rename the file to match the task's title and then remove the `title` property from the frontmatter.

This feature is recommended for users who prefer a minimalist approach to their frontmatter and want a direct relationship between the filename and the task title.

## Default Task Properties

You can set the **Default Status** and **Default Priority** for new tasks, as well as the **Default Due Date** and **Default Scheduled Date**. You can also specify default **Contexts**, **Projects**, and **Tags** that will be automatically added to new tasks.

## Template System

TaskNotes supports **Templates** for both the YAML frontmatter and the body of your task notes. You can use templates to pre-fill common values, add boilerplate text, and create a consistent structure for your tasks. Templates can also include variables, such as `{{title}}`, `{{date}}`, `{{parentNote}}`, and `{{projects}}`, which will be automatically replaced with the appropriate values when a new task is created.