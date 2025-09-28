/* eslint-disable no-console */
import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import TaskNotesPlugin from '../main';
import { ICSEvent, NoteInfo } from '../types';
import { format } from 'date-fns';
import { SafeAsync } from '../utils/safeAsync';

export interface ICSNoteCreationOptions {
    icsEvent: ICSEvent;
    subscriptionName: string;
    onContentCreated?: (file: TFile, info: NoteInfo) => void;
}

export class ICSNoteCreationModal extends Modal {
    private plugin: TaskNotesPlugin;
    private options: ICSNoteCreationOptions;
    private title = '';
    private folder = '';
    private template = '';
    private useTemplate = false;

    // UI elements
    private titleInput: HTMLInputElement;
    private folderInput: HTMLInputElement;
    private templateContainer: HTMLElement;
    private templateInput: HTMLInputElement;
    private previewContainer: HTMLElement;

    constructor(app: App, plugin: TaskNotesPlugin, options: ICSNoteCreationOptions) {
        super(app);
        this.plugin = plugin;
        this.options = options;
        
        // Set initial values
        this.title = this.generateDefaultTitle();
        this.folder = this.getDefaultFolder();
        this.template = this.getDefaultTemplate();
    }

    onOpen() {
        this.containerEl.addClass('tasknotes-plugin', 'ics-note-creation-modal');
        this.createModalContent();
    }

    onClose() {
        this.contentEl.empty();
    }

    private createModalContent(): void {
        const { contentEl } = this;
        contentEl.empty();

        // Modal header
        const header = contentEl.createDiv('modal-header');
        header.createEl('h2', { text: 'Create from ICS Event' });

        // Event info preview
        const eventPreview = contentEl.createDiv('ics-event-preview');
        this.createEventPreview(eventPreview);

        // Note: This modal is now dedicated to note creation only

        // Title input
        new Setting(contentEl)
            .setName('Title')
            .setDesc('Title for the new content')
            .addText(text => {
                this.titleInput = text.inputEl;
                text.setValue(this.title)
                    .onChange(value => {
                        this.title = value;
                        this.updatePreview();
                    });
            });

        // Folder input
        new Setting(contentEl)
            .setName('Folder')
            .setDesc('Destination folder (leave empty for vault root)')
            .addText(text => {
                this.folderInput = text.inputEl;
                text.setValue(this.folder)
                    .setPlaceholder('folder/subfolder')
                    .onChange(value => {
                        this.folder = value;
                        this.updatePreview();
                    });
            });

        // Template settings
        this.templateContainer = contentEl.createDiv('template-settings');
        this.createTemplateSettings();

        // Preview container
        this.previewContainer = contentEl.createDiv('content-preview');
        this.updatePreview();

        // Action buttons
        const buttonContainer = contentEl.createDiv('modal-button-container');
        
        const createButton = buttonContainer.createEl('button', {
            text: 'Create',
            cls: 'mod-cta'
        });
        createButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Create button clicked');
            this.handleCreate();
        };

        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel'
        });
        cancelButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Cancel button clicked');
            this.close();
        };

        // Focus title input
        setTimeout(() => this.titleInput?.focus(), 100);
    }

    private createEventPreview(container: HTMLElement): void {
        const { icsEvent, subscriptionName } = this.options;
        
        container.createEl('h3', { text: icsEvent.title });
        
        const details = container.createDiv('event-details');
        
        if (icsEvent.start) {
            const startDate = new Date(icsEvent.start);
            const startDiv = details.createDiv();
            startDiv.createEl('strong', { text: 'Start: ' });
            startDiv.appendText(format(startDate, 'PPPp'));
        }
        
        if (icsEvent.end && !icsEvent.allDay) {
            const endDate = new Date(icsEvent.end);
            const endDiv = details.createDiv();
            endDiv.createEl('strong', { text: 'End: ' });
            endDiv.appendText(format(endDate, 'PPPp'));
        }
        
        if (icsEvent.location) {
            const locationDiv = details.createDiv();
            locationDiv.createEl('strong', { text: 'Location: ' });
            locationDiv.appendText(icsEvent.location);
        }
        
        const calendarDiv = details.createDiv();
        calendarDiv.createEl('strong', { text: 'Calendar: ' });
        calendarDiv.appendText(subscriptionName);
    }


    private createTemplateSettings(): void {
        this.templateContainer.empty();

        new Setting(this.templateContainer)
            .setName('Use Template')
            .setDesc('Apply a template when creating the content')
            .addToggle(toggle => {
                toggle.setValue(this.useTemplate)
                    .onChange(value => {
                        this.useTemplate = value;
                        this.updateTemplateInput();
                        this.updatePreview();
                    });
            });

        if (this.useTemplate) {
            new Setting(this.templateContainer)
                .setName('Template Path')
                .setDesc('Path to the template file')
                .addText(text => {
                    this.templateInput = text.inputEl;
                    text.setValue(this.template)
                        .setPlaceholder('templates/ics-note-template.md')
                        .onChange(value => {
                            this.template = value;
                            this.updatePreview();
                        });
                });
        }
    }


    private updateDefaultsForContentType(): void {
        // Always use note defaults since this modal is notes-only
        this.folder = this.plugin.settings.icsIntegration?.defaultNoteFolder || '';
        this.template = this.plugin.settings.icsIntegration?.defaultNoteTemplate || '';
        
        if (this.folderInput) this.folderInput.value = this.folder;
        if (this.templateInput) this.templateInput.value = this.template;
    }

    private updateTemplateInput(): void {
        this.createTemplateSettings();
    }

    private updatePreview(): void {
        if (!this.previewContainer) return;

        this.previewContainer.empty();
        this.previewContainer.createEl('h4', { text: 'Summary' });

        const previewDetails = this.previewContainer.createDiv('preview-details');
        
        const typeDiv = previewDetails.createDiv();
        typeDiv.createEl('strong', { text: 'Type: ' });
        typeDiv.appendText('Note');
        const titleDiv = previewDetails.createDiv();
        titleDiv.createEl('strong', { text: 'Title: ' });
        titleDiv.appendText(this.title || 'Untitled');
        const folderDiv = previewDetails.createDiv();
        folderDiv.createEl('strong', { text: 'Folder: ' });
        folderDiv.appendText(this.folder || 'Vault root');
        
        if (this.useTemplate && this.template) {
            const templateDiv = previewDetails.createDiv();
            templateDiv.createEl('strong', { text: 'Template: ' });
            templateDiv.appendText(this.template);
        } else {
            const templateDiv = previewDetails.createDiv();
            templateDiv.createEl('strong', { text: 'Template: ' });
            templateDiv.appendText('Default format');
        }

        // Show available template variables
        const variablesDiv = this.previewContainer.createDiv('template-variables');
        variablesDiv.createEl('h5', { text: 'Available Template Variables' });
        
        const variables = [
            '{{title}}', '{{icsEventTitle}}', '{{icsEventStart}}', '{{icsEventEnd}}',
            '{{icsEventLocation}}', '{{icsEventDescription}}', '{{icsEventUrl}}',
            '{{icsEventSubscription}}', '{{icsEventId}}', '{{date}}', '{{time}}'
        ];

        const variablesList = variablesDiv.createDiv('variables-list');
        variables.forEach(variable => {
            variablesList.createSpan({
                text: variable,
                cls: 'template-variable'
            });
        });
    }

    private generateDefaultTitle(): string {
        const { icsEvent } = this.options;
        const startDate = new Date(icsEvent.start);
        return `${icsEvent.title} - ${format(startDate, 'PPP')}`;
    }

    private getDefaultFolder(): string {
        return this.plugin.settings.icsIntegration?.defaultNoteFolder || '';
    }

    private getDefaultTemplate(): string {
        return this.plugin.settings.icsIntegration?.defaultNoteTemplate || '';
    }


    private async handleCreate(): Promise<void> {
        await SafeAsync.executeWithValidation(
            async () => {
                const { icsEvent } = this.options;

                const result = await this.plugin.icsNoteService.createNoteFromICS(icsEvent, {
                    title: this.title,
                    folder: this.folder || undefined,
                    template: this.useTemplate && this.template ? this.template : undefined
                });

                new Notice(`Note created: ${this.title}`);
                this.options.onContentCreated?.(result.file, result.noteInfo);

                this.close();
            },
            [
                {
                    condition: !!this.title.trim(),
                    message: 'Title is required'
                }
            ],
            {
                errorMessage: 'Failed to create note from ICS event'
            }
        );
    }
}