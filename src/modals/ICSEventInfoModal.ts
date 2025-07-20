import { App, Modal, Setting, Notice, TFile, setIcon, TAbstractFile } from 'obsidian';
import TaskNotesPlugin from '../main';
import { ICSEvent, TaskInfo, NoteInfo } from '../types';
import { ICSNoteCreationModal } from './ICSNoteCreationModal';
import { ICSNoteLinkModal } from './ICSNoteLinkModal';
import { SafeAsync } from '../utils/safeAsync';

/**
 * Modal for displaying ICS event information with note/task creation capabilities
 */
export class ICSEventInfoModal extends Modal {
    private plugin: TaskNotesPlugin;
    private icsEvent: ICSEvent;
    private subscriptionName?: string;
    private relatedNotes: (TaskInfo | NoteInfo)[] = [];

    constructor(app: App, plugin: TaskNotesPlugin, icsEvent: ICSEvent, subscriptionName?: string) {
        super(app);
        this.plugin = plugin;
        this.icsEvent = icsEvent;
        this.subscriptionName = subscriptionName;
    }

    async onOpen() {
        await this.renderContent();
    }

    private async renderContent() {
        const { contentEl } = this;
        contentEl.empty();

        // Load related notes first
        await this.loadRelatedNotes();

        // Header
        new Setting(contentEl)
            .setName('Calendar Event')
            .setHeading();

        // Event title
        new Setting(contentEl)
            .setName('Title')
            .setDesc(this.icsEvent.title || 'Untitled Event');

        // Calendar source
        if (this.subscriptionName) {
            new Setting(contentEl)
                .setName('Calendar')
                .setDesc(this.subscriptionName);
        }

        // Date/time
        const startDate = new Date(this.icsEvent.start);
        let dateText = startDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        if (!this.icsEvent.allDay) {
            dateText += ` at ${startDate.toLocaleTimeString()}`;
            
            if (this.icsEvent.end) {
                const endDate = new Date(this.icsEvent.end);
                dateText += ` - ${endDate.toLocaleTimeString()}`;
            }
        }

        new Setting(contentEl)
            .setName('Date & Time')
            .setDesc(dateText);

        // Location
        if (this.icsEvent.location) {
            new Setting(contentEl)
                .setName('Location')
                .setDesc(this.icsEvent.location);
        }

        // Description
        if (this.icsEvent.description) {
            new Setting(contentEl)
                .setName('Description')
                .setDesc(this.icsEvent.description);
        }

        // URL
        if (this.icsEvent.url) {
            new Setting(contentEl)
                .setName('URL')
                .setDesc(this.icsEvent.url);
        }

        // Related notes section
        new Setting(contentEl)
            .setName('Related Notes & Tasks')
            .setHeading();

        if (this.relatedNotes.length === 0) {
            new Setting(contentEl)
                .setDesc('No related notes or tasks found for this event.');
        } else {
            this.relatedNotes.forEach(note => {
                const isTask = this.isTaskNote(note);
                new Setting(contentEl)
                    .setName(note.title)
                    .setDesc(`Type: ${isTask ? 'Task' : 'Note'}`)
                    .addButton(button => {
                        button.setButtonText('Open')
                            .onClick(async () => {
                                await this.safeOpenFile(note.path);
                                this.close();
                            });
                    });
            });
        }

        // Actions section
        new Setting(contentEl)
            .setName('Actions')
            .setHeading();

        new Setting(contentEl)
            .setName('Create from Event')
            .setDesc('Create a new note or task from this calendar event')
            .addButton(button => {
                button.setButtonText('Create Note')
                    .onClick(() => {
                        console.log('Create Note clicked');
                        this.openCreationModal();
                    });
            })
            .addButton(button => {
                button.setButtonText('Create Task')
                    .onClick(async () => {
                        console.log('Create Task clicked');
                        await this.createTaskDirectly();
                    });
            });

        new Setting(contentEl)
            .setName('Link Existing')
            .setDesc('Link an existing note to this calendar event')
            .addButton(button => {
                button.setButtonText('Link Note')
                    .onClick(() => {
                        console.log('Link Note clicked');
                        this.linkExistingNote();
                    });
            })
            .addButton(button => {
                button.setButtonText('Refresh')
                    .onClick(() => {
                        console.log('Refresh clicked');
                        this.refreshRelatedNotes();
                    });
            });
    }

    private async loadRelatedNotes(): Promise<void> {
        const result = await SafeAsync.execute(
            () => this.plugin.icsNoteService.findRelatedNotes(this.icsEvent),
            {
                fallback: [],
                errorMessage: 'Failed to load related notes',
                showNotice: false // Don't show notice for background operations
            }
        );
        this.relatedNotes = result || [];
    }



    private openCreationModal(): void {
        console.log('Opening note creation modal');
        try {
            const modal = new ICSNoteCreationModal(this.app, this.plugin, {
                icsEvent: this.icsEvent,
                subscriptionName: this.subscriptionName || 'Unknown Calendar',
                onContentCreated: async (file: TFile, info: NoteInfo) => {
                    new Notice('Note created successfully');
                    this.refreshRelatedNotes();
                    await this.safeOpenFile(file.path);
                }
            });
            
            modal.open();
        } catch (error) {
            console.error('Error opening creation modal:', error);
            new Notice('Failed to open creation modal');
        }
    }

    private async linkExistingNote(): Promise<void> {
        console.log('Link existing note button clicked');
        await SafeAsync.execute(
            async () => {
                const modal = new ICSNoteLinkModal(this.app, this.plugin, async (file) => {
                    await SafeAsync.execute(
                        async () => {
                            await this.plugin.icsNoteService.linkNoteToICS(file.path, this.icsEvent);
                            new Notice(`Linked note "${file.name}" to ICS event`);
                            this.refreshRelatedNotes();
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


    private async createTaskDirectly(): Promise<void> {
        await SafeAsync.execute(
            async () => {
                const result = await this.plugin.icsNoteService.createTaskFromICS(this.icsEvent);
                new Notice(`Task created: ${result.taskInfo.title}`);
                
                // Open the created task file
                await this.safeOpenFile(result.file.path);
                
                // Refresh the modal to show the new related task
                this.refreshRelatedNotes();
            },
            {
                errorMessage: 'Failed to create task from ICS event'
            }
        );
    }

    private async refreshRelatedNotes(): Promise<void> {
        await SafeAsync.execute(
            async () => {
                await this.loadRelatedNotes();
                await this.renderContent();
                new Notice('Related notes refreshed');
            },
            {
                errorMessage: 'Failed to refresh related notes'
            }
        );
    }

    /**
     * Check if a note is a task based on the user-configured task tag
     */
    private isTaskNote(note: TaskInfo | NoteInfo): boolean {
        // Tasks are identified exclusively by their tag
        const taskTag = this.plugin.settings.taskTag;
        return note.tags?.includes(taskTag) || false;
    }

    /**
     * Type-safe file opening with proper error handling
     */
    private async safeOpenFile(filePath: string): Promise<void> {
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                await this.app.workspace.getLeaf().openFile(file);
            } else {
                new Notice('File not found or invalid');
                console.error('Invalid file path or file not found:', filePath);
            }
        } catch (error) {
            console.error('Error opening file:', error);
            new Notice('Failed to open file');
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
