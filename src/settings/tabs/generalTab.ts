// import { TAbstractFile } from 'obsidian';
import TaskNotesPlugin from '../../main';
import { 
    createSectionHeader, 
    createTextSetting, 
    createToggleSetting, 
    createDropdownSetting,
    createHelpText
} from '../components/settingHelpers';

/**
 * Renders the General tab - foundational settings for task identification and storage
 */
export function renderGeneralTab(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();

    // Tasks Storage Section
    createSectionHeader(container, 'Task Storage');
    createHelpText(container, 'Configure where tasks are stored and how they are identified.');

    createTextSetting(container, {
        name: 'Default tasks folder',
        desc: 'Default location for new tasks',
        placeholder: 'TaskNotes',
        getValue: () => plugin.settings.tasksFolder,
        setValue: async (value: string) => {
            plugin.settings.tasksFolder = value;
            save();
        },
        ariaLabel: 'Default folder path for new tasks'
    });

    createToggleSetting(container, {
        name: 'Move archived tasks to folder',
        desc: 'Automatically move archived tasks to an archive folder',
        getValue: () => plugin.settings.moveArchivedTasks,
        setValue: async (value: boolean) => {
            plugin.settings.moveArchivedTasks = value;
            save();
            // Re-render to show/hide archive folder setting
            renderGeneralTab(container, plugin, save);
        }
    });

    if (plugin.settings.moveArchivedTasks) {
        createTextSetting(container, {
            name: 'Archive folder',
            desc: 'Folder to move tasks to when archived',
            placeholder: 'TaskNotes/Archive',
            getValue: () => plugin.settings.archiveFolder,
            setValue: async (value: string) => {
                plugin.settings.archiveFolder = value;
                save();
            },
            ariaLabel: 'Archive folder path'
        });
    }

    // Task Identification Section
    createSectionHeader(container, 'Task Identification');
    createHelpText(container, 'Choose how TaskNotes identifies notes as tasks.');

    createDropdownSetting(container, {
        name: 'Identify tasks by',
        desc: 'Choose whether to identify tasks by tag or by a frontmatter property',
        options: [
            { value: 'tag', label: 'Tag' },
            { value: 'property', label: 'Property' }
        ],
        getValue: () => plugin.settings.taskIdentificationMethod,
        setValue: async (value: string) => {
            plugin.settings.taskIdentificationMethod = value as 'tag' | 'property';
            save();
            // Re-render to show/hide conditional fields
            renderGeneralTab(container, plugin, save);
        },
        ariaLabel: 'Task identification method'
    });

    if (plugin.settings.taskIdentificationMethod === 'tag') {
        createTextSetting(container, {
            name: 'Task tag',
            desc: 'Tag that identifies notes as tasks (without #)',
            placeholder: 'task',
            getValue: () => plugin.settings.taskTag,
            setValue: async (value: string) => {
                plugin.settings.taskTag = value;
                save();
            },
            ariaLabel: 'Task identification tag'
        });
    } else {
        createTextSetting(container, {
            name: 'Task property name',
            desc: 'The frontmatter property name (e.g., "category")',
            placeholder: 'category',
            getValue: () => plugin.settings.taskPropertyName,
            setValue: async (value: string) => {
                plugin.settings.taskPropertyName = value;
                save();
            }
        });

        createTextSetting(container, {
            name: 'Task property value',
            desc: 'The value that identifies a note as a task (e.g., "task")',
            placeholder: 'task',
            getValue: () => plugin.settings.taskPropertyValue,
            setValue: async (value: string) => {
                plugin.settings.taskPropertyValue = value;
                save();
            }
        });
    }

    // Folder Management Section
    createSectionHeader(container, 'Folder Management');

    createTextSetting(container, {
        name: 'Excluded folders',
        desc: 'Comma-separated list of folders to exclude from Notes tab',
        placeholder: 'Templates, Archive',
        getValue: () => plugin.settings.excludedFolders,
        setValue: async (value: string) => {
            plugin.settings.excludedFolders = value;
            save();
        },
        ariaLabel: 'Excluded folder paths'
    });

    // Task Interaction Section
    createSectionHeader(container, 'Task Interaction');
    createHelpText(container, 'Configure how clicking on tasks behaves.');

    createDropdownSetting(container, {
        name: 'Single-click action',
        desc: 'Action performed when single-clicking a task card',
        options: [
            { value: 'edit', label: 'Edit task' },
            { value: 'openNote', label: 'Open note' }
        ],
        getValue: () => plugin.settings.singleClickAction,
        setValue: async (value: string) => {
            plugin.settings.singleClickAction = value as 'edit' | 'openNote';
            save();
        }
    });

    createDropdownSetting(container, {
        name: 'Double-click action',
        desc: 'Action performed when double-clicking a task card',
        options: [
            { value: 'edit', label: 'Edit task' },
            { value: 'openNote', label: 'Open note' },
            { value: 'none', label: 'No action' }
        ],
        getValue: () => plugin.settings.doubleClickAction,
        setValue: async (value: string) => {
            plugin.settings.doubleClickAction = value as 'edit' | 'openNote' | 'none';
            save();
        }
    });
}