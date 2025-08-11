import { Menu, Notice, TFile } from 'obsidian';
import TaskNotesPlugin from '../main';
import { ICSEvent } from '../types';
import { ICSEventInfoModal } from '../modals/ICSEventInfoModal';
import { ICSNoteCreationModal } from '../modals/ICSNoteCreationModal';
import { ICSNoteLinkModal } from '../modals/ICSNoteLinkModal';
import { SafeAsync } from '../utils/safeAsync';

export interface ICSEventContextMenuOptions {
    icsEvent: ICSEvent;
    plugin: TaskNotesPlugin;
    subscriptionName?: string;
    onUpdate?: () => void;
}

export class ICSEventContextMenu {
    private menu: Menu;
    private options: ICSEventContextMenuOptions;

    constructor(options: ICSEventContextMenuOptions) {
        this.menu = new Menu();
        this.options = options;
        this.buildMenu();
    }

    private buildMenu(): void {
        const { icsEvent, plugin, subscriptionName } = this.options;

        // Show details option
        this.menu.addItem((item) =>
            item
                .setTitle("Show details")
                .setIcon("info")
                .onClick(() => {
                    const modal = new ICSEventInfoModal(plugin.app, plugin, icsEvent, subscriptionName);
                    modal.open();
                })
        );

        this.menu.addSeparator();

        // Create task from event
        this.menu.addItem((item) =>
            item
                .setTitle("Create task from event")
                .setIcon("check-circle")
                .onClick(async () => {
                    await this.createTaskFromEvent();
                })
        );

        // Create note from event
        this.menu.addItem((item) =>
            item
                .setTitle("Create note from event")
                .setIcon("file-plus")
                .onClick(() => {
                    this.createNoteFromEvent();
                })
        );

        // Link existing note
        this.menu.addItem((item) =>
            item
                .setTitle("Link existing note")
                .setIcon("link")
                .onClick(() => {
                    this.linkExistingNote();
                })
        );

        this.menu.addSeparator();

        // Copy title option
        this.menu.addItem((item) =>
            item
                .setTitle("Copy title")
                .setIcon("copy")
                .onClick(async () => {
                    try {
                        await navigator.clipboard.writeText(icsEvent.title);
                        new Notice('Event title copied to clipboard');
                    } catch (error) {
                        new Notice('Failed to copy to clipboard');
                    }
                })
        );

        // Copy location (if available)
        if (icsEvent.location) {
            this.menu.addItem((item) =>
                item
                    .setTitle("Copy location")
                    .setIcon("map-pin")
                    .onClick(async () => {
                        try {
                            await navigator.clipboard.writeText(icsEvent.location!);
                            new Notice('Location copied to clipboard');
                        } catch (error) {
                            new Notice('Failed to copy to clipboard');
                        }
                    })
            );
        }

        // Copy URL option (if available)
        if (icsEvent.url) {
            this.menu.addItem((item) =>
                item
                    .setTitle("Copy URL")
                    .setIcon("external-link")
                    .onClick(async () => {
                        try {
                            await navigator.clipboard.writeText(icsEvent.url!);
                            new Notice('Event URL copied to clipboard');
                        } catch (error) {
                            new Notice('Failed to copy to clipboard');
                        }
                    })
            );
        }

        // Copy event details as markdown
        this.menu.addItem((item) =>
            item
                .setTitle("Copy as markdown")
                .setIcon("file-text")
                .onClick(async () => {
                    const markdown = this.formatEventAsMarkdown();
                    try {
                        await navigator.clipboard.writeText(markdown);
                        new Notice('Event details copied as markdown');
                    } catch (error) {
                        new Notice('Failed to copy to clipboard');
                    }
                })
        );
    }

    private async createTaskFromEvent(): Promise<void> {
        await SafeAsync.execute(
            async () => {
                const result = await this.options.plugin.icsNoteService.createTaskFromICS(this.options.icsEvent);
                new Notice(`Task created: ${result.taskInfo.title}`);
                
                // Open the created task file
                const file = this.options.plugin.app.vault.getAbstractFileByPath(result.file.path);
                if (file instanceof TFile) {
                    await this.options.plugin.app.workspace.getLeaf().openFile(file);
                }
                
                // Trigger update callback if provided
                if (this.options.onUpdate) {
                    this.options.onUpdate();
                }
            },
            {
                errorMessage: 'Failed to create task from event'
            }
        );
    }

    private createNoteFromEvent(): void {
        try {
            const modal = new ICSNoteCreationModal(this.options.plugin.app, this.options.plugin, {
                icsEvent: this.options.icsEvent,
                subscriptionName: this.options.subscriptionName || 'Unknown Calendar',
                onContentCreated: async (file: TFile) => {
                    new Notice('Note created successfully');
                    await this.options.plugin.app.workspace.getLeaf().openFile(file);
                    
                    // Trigger update callback if provided
                    if (this.options.onUpdate) {
                        this.options.onUpdate();
                    }
                }
            });
            
            modal.open();
        } catch (error) {
            console.error('Error opening creation modal:', error);
            new Notice('Failed to open creation modal');
        }
    }

    private async linkExistingNote(): Promise<void> {
        await SafeAsync.execute(
            async () => {
                const modal = new ICSNoteLinkModal(this.options.plugin.app, this.options.plugin, async (file) => {
                    await SafeAsync.execute(
                        async () => {
                            await this.options.plugin.icsNoteService.linkNoteToICS(file.path, this.options.icsEvent);
                            new Notice(`Linked note "${file.name}" to event`);
                            
                            // Trigger update callback if provided
                            if (this.options.onUpdate) {
                                this.options.onUpdate();
                            }
                        },
                        {
                            errorMessage: 'Failed to link note'
                        }
                    );
                });
                modal.open();
            },
            {
                errorMessage: 'Failed to open note selection'
            }
        );
    }

    private formatEventAsMarkdown(): string {
        const { icsEvent, subscriptionName } = this.options;
        const lines: string[] = [];
        
        lines.push(`## ${icsEvent.title || 'Untitled Event'}`);
        lines.push('');
        
        if (subscriptionName) {
            lines.push(`**Calendar:** ${subscriptionName}`);
        }
        
        // Format date/time
        const startDate = new Date(icsEvent.start);
        let dateText = startDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        if (!icsEvent.allDay) {
            dateText += ` at ${startDate.toLocaleTimeString()}`;
            
            if (icsEvent.end) {
                const endDate = new Date(icsEvent.end);
                dateText += ` - ${endDate.toLocaleTimeString()}`;
            }
        }
        
        lines.push(`**Date & Time:** ${dateText}`);
        
        if (icsEvent.location) {
            lines.push(`**Location:** ${icsEvent.location}`);
        }
        
        if (icsEvent.description) {
            lines.push('');
            lines.push('### Description');
            lines.push(icsEvent.description);
        }
        
        if (icsEvent.url) {
            lines.push('');
            lines.push(`**URL:** ${icsEvent.url}`);
        }
        
        return lines.join('\n');
    }

    public show(event: MouseEvent): void {
        this.menu.showAtMouseEvent(event);
    }

    public showAtElement(element: HTMLElement): void {
        this.menu.showAtPosition({
            x: element.getBoundingClientRect().left,
            y: element.getBoundingClientRect().bottom + 4
        });
    }
}