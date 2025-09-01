import { Component } from 'obsidian';
import TaskNotesPlugin from '../../main';

interface BasesComponentHooks {
    getContainer: () => HTMLElement | null;
    setContainer: (el: HTMLElement | null) => void;
    refresh: () => Promise<void> | void;
    attachQueryListener?: (handler: () => void) => void;
    detachQueryListener?: (handler: () => void) => void;
}

class TaskNotesBasesComponent extends Component implements BasesComponentHooks {
    private container: HTMLElement | null = null;
    private plugin: TaskNotesPlugin;

    constructor(plugin: TaskNotesPlugin) {
        super();
        this.plugin = plugin;
    }

    getContainer(): HTMLElement | null {
        return this.container;
    }

    setContainer(el: HTMLElement | null): void {
        this.container = el;
        if (el) {
            this.refresh();
        }
    }

    refresh(): void {
        if (!this.container) return;

        this.container.empty();
        this.container.createEl('h3', { text: 'TaskNotes Task List' });
        
        // Create a simple task list interface
        const taskListContainer = this.container.createDiv({ cls: 'bases-task-list-container' });
        
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

    onload(): void {
        // Component loaded
    }

    onunload(): void {
        // Component unloaded
        if (this.container) {
            this.container.empty();
        }
    }
}

export function createBasesTaskListView(plugin: TaskNotesPlugin): TaskNotesBasesComponent {
    return new TaskNotesBasesComponent(plugin);
}