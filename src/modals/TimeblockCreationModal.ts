import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import { format } from 'date-fns';
import * as YAML from 'yaml';
import TaskNotesPlugin from '../main';
import { TimeBlock, DailyNoteFrontmatter } from '../types';
import { generateTimeblockId } from '../utils/helpers';
import { YAMLCache } from '../utils/YAMLCache';
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
    private attachmentsInput: HTMLTextAreaElement;
    
    constructor(app: App, plugin: TaskNotesPlugin, options: TimeblockCreationOptions) {
        super(app);
        this.plugin = plugin;
        this.options = options;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('timeblock-creation-modal');

        contentEl.createEl('h2', { text: 'Create Timeblock' });

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
                text.setPlaceholder('e.g., Deep Work Session')
                    .setValue(this.options.prefilledTitle || '')
                    .onChange(() => this.validateForm());
                // Focus on title input
                setTimeout(() => this.titleInput.focus(), 100);
            });

        // Time range
        const timeContainer = contentEl.createDiv({ cls: 'timeblock-time-container' });
        
        new Setting(timeContainer)
            .setName('Start Time')
            .setDesc('When the timeblock starts')
            .addText(text => {
                this.startTimeInput = text.inputEl;
                text.setPlaceholder('09:00')
                    .setValue(this.options.startTime || '')
                    .onChange(() => this.validateForm());
                this.startTimeInput.type = 'time';
            });

        new Setting(timeContainer)
            .setName('End Time')
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
            .setDesc('Markdown links to tasks or notes (one per line)')
            .addTextArea(text => {
                this.attachmentsInput = text.inputEl;
                text.setPlaceholder('[[TaskNotes/Tasks/my-task]]\n[[Projects/Important Project]]')
                    .setValue('');
                this.attachmentsInput.rows = 3;
            });

        // Help text for attachments
        const helpText = contentEl.createDiv({ cls: 'timeblock-help-text' });
        helpText.innerHTML = `
            <strong>Attachment formats:</strong><br>
            • Wiki links: <code>[[Page Name]]</code><br>
            • Markdown links: <code>[Display Text](path/to/file.md)</code><br>
            • One link per line
        `;

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'timeblock-modal-buttons' });
        
        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.addEventListener('click', () => this.close());

        const createButton = buttonContainer.createEl('button', { 
            text: 'Create Timeblock',
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
            const attachmentsText = this.attachmentsInput.value.trim();

            if (!title || !startTime || !endTime) {
                new Notice('Please fill in all required fields');
                return;
            }

            // Parse attachments
            const attachments: string[] = [];
            if (attachmentsText) {
                const lines = attachmentsText.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
                attachments.push(...lines);
            }

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
            this.plugin.emitter.emit('data-changed');

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
                    frontmatter = YAMLCache.parse(frontmatterText, dailyNote.path) || {};
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
        const frontmatterText = YAML.stringify(frontmatter);

        // Reconstruct file content
        const newContent = `---\n${frontmatterText}---${bodyContent}`;

        // Write back to file
        await this.app.vault.modify(dailyNote, newContent);
        
        // Clear cache for this file to ensure fresh parsing
        YAMLCache.clearCacheEntry(dailyNote.path);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}