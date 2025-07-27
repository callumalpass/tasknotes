import { App, Modal, Setting, Notice, TAbstractFile, parseYaml, stringifyYaml, setTooltip } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TimeBlock, DailyNoteFrontmatter } from '../types';
import { generateTimeblockId } from '../utils/helpers';
import { AttachmentSelectModal } from './AttachmentSelectModal';
import { 
    createDailyNote, 
    getDailyNote, 
    getAllDailyNotes,
    appHasDailyNotesPluginLoaded
} from 'obsidian-daily-notes-interface';

export interface TimeblockCreationOptions {
    date: string; // YYYY-MM-DD format
    startTime?: string; // HH:MM format
    endTime?: string; // HH:MM format
    prefilledTitle?: string;
}

export class TimeblockCreationModal extends Modal {
    plugin: TaskNotesPlugin;
    options: TimeblockCreationOptions;
    
    // Form fields
    private titleInput: HTMLInputElement;
    private startTimeInput: HTMLInputElement;
    private endTimeInput: HTMLInputElement;
    private descriptionInput: HTMLTextAreaElement;
    private colorInput: HTMLInputElement;
    
    // Attachment management
    private selectedAttachments: TAbstractFile[] = [];
    private attachmentsList: HTMLElement;
    
    constructor(app: App, plugin: TaskNotesPlugin, options: TimeblockCreationOptions) {
        super(app);
        this.plugin = plugin;
        this.options = options;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('timeblock-creation-modal');

        new Setting(contentEl)
            .setName('Create timeblock')
            .setHeading();

        // Date display (read-only)
        const dateDisplay = contentEl.createDiv({ cls: 'timeblock-date-display' });
        dateDisplay.createEl('strong', { text: 'Date: ' });
        const dateObj = new Date(this.options.date + 'T00:00:00');
        dateDisplay.createSpan({ text: dateObj.toLocaleDateString() });

        // Title field
        new Setting(contentEl)
            .setName('Title')
            .setDesc('Title for your timeblock')
            .addText(text => {
                this.titleInput = text.inputEl;
                text.setPlaceholder('e.g., Deep work session')
                    .setValue(this.options.prefilledTitle || '')
                    .onChange(() => this.validateForm());
                // Focus on title input
                window.setTimeout(() => this.titleInput.focus(), 100);
            });

        // Time range
        const timeContainer = contentEl.createDiv({ cls: 'timeblock-time-container' });
        
        new Setting(timeContainer)
            .setName('Start time')
            .setDesc('When the timeblock starts')
            .addText(text => {
                this.startTimeInput = text.inputEl;
                text.setPlaceholder('09:00')
                    .setValue(this.options.startTime || '')
                    .onChange(() => this.validateForm());
                this.startTimeInput.type = 'time';
            });

        new Setting(timeContainer)
            .setName('End time')
            .setDesc('When the timeblock ends')
            .addText(text => {
                this.endTimeInput = text.inputEl;
                text.setPlaceholder('11:00')
                    .setValue(this.options.endTime || '')
                    .onChange(() => this.validateForm());
                this.endTimeInput.type = 'time';
            });

        // Description (optional)
        new Setting(contentEl)
            .setName('Description')
            .setDesc('Optional description for the timeblock')
            .addTextArea(text => {
                this.descriptionInput = text.inputEl;
                text.setPlaceholder('Focus on new features, no interruptions')
                    .setValue('');
                this.descriptionInput.rows = 3;
            });

        // Color (optional)
        new Setting(contentEl)
            .setName('Color')
            .setDesc('Optional color for the timeblock')
            .addText(text => {
                this.colorInput = text.inputEl;
                text.setPlaceholder('#3b82f6')
                    .setValue('#6366f1'); // Default indigo color
                this.colorInput.type = 'color';
            });

        // Attachments (optional)
        new Setting(contentEl)
            .setName('Attachments')
            .setDesc('Files or notes to link to this timeblock')
            .addButton(button => {
                button.setButtonText('Add Attachment')
                    .setTooltip('Select a file or note using fuzzy search')
                    .onClick(() => {
                        const modal = new AttachmentSelectModal(this.app, this.plugin, (file) => {
                            this.addAttachment(file);
                        });
                        modal.open();
                    });
            });

        // Attachments list container
        this.attachmentsList = contentEl.createDiv({ cls: 'timeblock-attachments-list' });
        this.renderAttachmentsList(); // Initialize empty state

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'timeblock-modal-buttons' });
        
        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.addEventListener('click', () => this.close());

        const createButton = buttonContainer.createEl('button', { 
            text: 'Create timeblock',
            cls: 'mod-cta timeblock-create-button'
        });
        createButton.addEventListener('click', () => this.handleSubmit());
        
        // Initial validation
        this.validateForm();
    }

    private validateForm(): void {
        const createButton = this.contentEl.querySelector('.timeblock-create-button') as HTMLButtonElement;
        if (!createButton) return;

        const title = this.titleInput?.value.trim();
        const startTime = this.startTimeInput?.value;
        const endTime = this.endTimeInput?.value;

        // Check required fields
        let isValid = !!(title && startTime && endTime);

        // Validate time range
        if (isValid && startTime && endTime) {
            const [startHour, startMin] = startTime.split(':').map(Number);
            const [endHour, endMin] = endTime.split(':').map(Number);
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;
            
            if (endMinutes <= startMinutes) {
                isValid = false;
            }
        }

        createButton.disabled = !isValid;
        createButton.style.opacity = isValid ? '1' : '0.5';
    }

    private async handleSubmit(): Promise<void> {
        try {
            // Validate inputs
            const title = this.titleInput.value.trim();
            const startTime = this.startTimeInput.value;
            const endTime = this.endTimeInput.value;
            const description = this.descriptionInput.value.trim();
            const color = this.colorInput.value;
            if (!title || !startTime || !endTime) {
                new Notice('Please fill in all required fields');
                return;
            }

            // Convert selected attachments to wikilinks
            const attachments: string[] = this.selectedAttachments.map(file => `[[${file.path}]]`);

            // Create timeblock object
            const timeblock: TimeBlock = {
                id: generateTimeblockId(),
                title,
                startTime,
                endTime
            };
            
            // Add optional fields
            if (description) {
                timeblock.description = description;
            }
            if (color) {
                timeblock.color = color;
            }
            if (attachments.length > 0) {
                timeblock.attachments = attachments;
            }

            // Save to daily note
            await this.saveTimeblockToDailyNote(timeblock);

            // Refresh calendar views  
            this.plugin.emitter.trigger('data-changed');

            new Notice(`Timeblock "${title}" created successfully`);
            this.close();
        } catch (error) {
            console.error('Error creating timeblock:', error);
            new Notice('Failed to create timeblock. Check console for details.');
        }
    }

    private async saveTimeblockToDailyNote(timeblock: TimeBlock): Promise<void> {
        if (!appHasDailyNotesPluginLoaded()) {
            throw new Error('Daily Notes plugin is not enabled');
        }

        // Get or create daily note for the date
        const moment = (window as any).moment(this.options.date);
        const allDailyNotes = getAllDailyNotes();
        let dailyNote = getDailyNote(moment, allDailyNotes);

        if (!dailyNote) {
            // Create daily note if it doesn't exist
            dailyNote = await createDailyNote(moment);
            
            // Validate that daily note was created successfully
            if (!dailyNote) {
                throw new Error('Failed to create daily note. Please check your Daily Notes plugin configuration and ensure the daily notes folder exists.');
            }
        }

        // Read current content
        const content = await this.app.vault.read(dailyNote);
        
        // Parse existing frontmatter
        let frontmatter: DailyNoteFrontmatter = {};
        let bodyContent = content;

        if (content.startsWith('---')) {
            const endOfFrontmatter = content.indexOf('---', 3);
            if (endOfFrontmatter !== -1) {
                const frontmatterText = content.substring(3, endOfFrontmatter);
                bodyContent = content.substring(endOfFrontmatter + 3);
                
                try {
                    frontmatter = parseYaml(frontmatterText) || {};
                } catch (error) {
                    console.error('Error parsing existing frontmatter:', error);
                    frontmatter = {};
                }
            }
        }

        // Add timeblock to frontmatter
        if (!frontmatter.timeblocks) {
            frontmatter.timeblocks = [];
        }
        frontmatter.timeblocks.push(timeblock);

        // Convert frontmatter back to YAML
        const frontmatterText = stringifyYaml(frontmatter);

        // Reconstruct file content
        const newContent = `---\n${frontmatterText}---${bodyContent}`;

        // Write back to file
        await this.app.vault.modify(dailyNote, newContent);
        
        // The native metadata cache will automatically update
    }

    private addAttachment(file: TAbstractFile): void {
        // Avoid duplicates
        if (this.selectedAttachments.some(existing => existing.path === file.path)) {
            new Notice(`"${file.name}" is already attached`);
            return;
        }

        this.selectedAttachments.push(file);
        this.renderAttachmentsList();
        new Notice(`Added "${file.name}" as attachment`);
    }

    private removeAttachment(file: TAbstractFile): void {
        this.selectedAttachments = this.selectedAttachments.filter(
            existing => existing.path !== file.path
        );
        this.renderAttachmentsList();
        new Notice(`Removed "${file.name}" from attachments`);
    }

    private renderAttachmentsList(): void {
        this.attachmentsList.empty();

        if (this.selectedAttachments.length === 0) {
            const emptyState = this.attachmentsList.createDiv({ cls: 'timeblock-attachments-empty' });
            emptyState.textContent = 'No attachments added yet';
            return;
        }

        this.selectedAttachments.forEach(file => {
            const attachmentItem = this.attachmentsList.createDiv({ cls: 'timeblock-attachment-item' });
            
            // Info container
            const infoEl = attachmentItem.createDiv({ cls: 'timeblock-attachment-info' });
            
            // File name
            const nameEl = infoEl.createSpan({ cls: 'timeblock-attachment-name' });
            nameEl.textContent = file.name;
            
            // File path (if different from name)
            if (file.path !== file.name) {
                const pathEl = infoEl.createDiv({ cls: 'timeblock-attachment-path' });
                pathEl.textContent = file.path;
            }
            
            // Remove button
            const removeBtn = attachmentItem.createEl('button', { 
                cls: 'timeblock-attachment-remove',
                text: '×'
            });
            setTooltip(removeBtn, 'Remove attachment', { placement: 'top' });
            removeBtn.addEventListener('click', () => {
                this.removeAttachment(file);
            });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
