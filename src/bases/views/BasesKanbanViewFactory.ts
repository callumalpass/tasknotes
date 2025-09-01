import { Component } from 'obsidian';
import TaskNotesPlugin from '../../main';

interface BasesComponentHooks {
    getContainer: () => HTMLElement | null;
    setContainer: (el: HTMLElement | null) => void;
    refresh: () => Promise<void> | void;
    attachQueryListener?: (handler: () => void) => void;
    detachQueryListener?: (handler: () => void) => void;
}

class TaskNotesKanbanBasesComponent extends Component implements BasesComponentHooks {
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
        this.container.createEl('h3', { text: 'TaskNotes Kanban' });
        
        const kanbanContainer = this.container.createDiv({ cls: 'bases-kanban-container' });
        kanbanContainer.createEl('p', { text: 'TaskNotes Kanban integration with Bases' });
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

export function createBasesKanbanView(plugin: TaskNotesPlugin): TaskNotesKanbanBasesComponent {
    return new TaskNotesKanbanBasesComponent(plugin);
}