import { ItemView, WorkspaceLeaf } from 'obsidian';
import TaskNotesPlugin from '../../main';

export const BASES_TASK_LIST_VIEW_TYPE = 'bases-task-list';

export class BasesTaskListView extends ItemView {
    plugin: TaskNotesPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return BASES_TASK_LIST_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'TaskNotes Task List (Bases)';
    }

    getIcon(): string {
        return 'check-square';
    }

    async onOpen() {
        const container = this.contentEl;
        container.empty();
        container.createEl('h2', { text: 'TaskNotes Task List' });

        // Create a simple task list interface
        const taskListContainer = container.createDiv({ cls: 'bases-task-list-container' });
        
        // Add a disabled checkbox input
        const inputContainer = taskListContainer.createDiv({ cls: 'task-input-container' });
        inputContainer.createEl('input', {
            type: 'checkbox',
            attr: { disabled: 'true' }
        });
        inputContainer.createSpan({ text: ' Add new task...' });

        // Create task list
        const taskList = taskListContainer.createEl('ul', { cls: 'task-list' });
        
        // Add sample tasks for demonstration
        const sampleTasks = [
            'Sample Task A',
            'Sample Task B', 
            'Sample Task C'
        ];

        sampleTasks.forEach(taskText => {
            const listItem = taskList.createEl('li', { cls: 'task-item' });
            listItem.createEl('input', {
                type: 'checkbox',
                attr: { disabled: 'true' }
            });
            listItem.createSpan({ text: ` ${taskText}` });
        });
    }

    async onClose() {
        // Clean up
        this.contentEl.empty();
    }
}