import { App, Modal, Setting, Notice, TAbstractFile, parseYaml, stringifyYaml, TFile, setTooltip } from 'obsidian';
import TaskNotesPlugin from '../main';
import { AttachmentSelectModal } from './AttachmentSelectModal';
import { 
    getDailyNote, 
    getAllDailyNotes,
    appHasDailyNotesPluginLoaded
} from 'obsidian-daily-notes-interface';

export interface TimeBlock {
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
    attachments?: string[];
    color?: string;
    id?: string;
}

/**
 * Modal for displaying timeblock information
 */
export class TimeblockInfoModal extends Modal {
    private timeblock: TimeBlock;
    private eventDate: Date;
    private plugin: TaskNotesPlugin;
    private originalTimeblock: TimeBlock;
    
    // Form fields
    private titleInput: HTMLInputElement;
    private descriptionInput: HTMLTextAreaElement;
    private colorInput: HTMLInputElement;
    
    // Attachment management
    private selectedAttachments: TAbstractFile[] = [];
    private attachmentsList: HTMLElement;

    constructor(app: App, plugin: TaskNotesPlugin, timeblock: TimeBlock, eventDate: Date) {
        super(app);
        this.plugin = plugin;
        this.timeblock = { ...timeblock }; // Create a copy for editing
        this.originalTimeblock = timeblock; // Keep original for comparison
        this.eventDate = eventDate;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('timeblock-info-modal');

        new Setting(contentEl)
            .setName('Edit Timeblock')
            .setHeading();

        // Date and time display (read-only)
        const dateDisplay = contentEl.createDiv({ cls: 'timeblock-date-display' });
        dateDisplay.createEl('strong', { text: 'Date & Time: ' });
        const dateText = `${this.eventDate.toLocaleDateString()} from ${this.timeblock.startTime} to ${this.timeblock.endTime}`;
        dateDisplay.createSpan({ text: dateText });

        // Title field (editable)
        new Setting(contentEl)
            .setName('Title')
            .setDesc('Title for your timeblock')
            .addText(text => {
                this.titleInput = text.inputEl;
                text.setPlaceholder('e.g., Deep work session')
                    .setValue(this.timeblock.title || '')
                    .onChange(() => this.validateForm());
            });

        // Description (editable)
        new Setting(contentEl)
            .setName('Description')
            .setDesc('Optional description for the timeblock')
            .addTextArea(text => {
                this.descriptionInput = text.inputEl;
                text.setPlaceholder('Focus on new features, no interruptions')
                    .setValue(this.timeblock.description || '');
                this.descriptionInput.rows = 3;
            });

        // Color (editable)
        new Setting(contentEl)
            .setName('Color')
            .setDesc('Optional color for the timeblock')
            .addText(text => {
                this.colorInput = text.inputEl;
                text.setPlaceholder('#3b82f6')
                    .setValue(this.timeblock.color || '#6366f1');
                this.colorInput.type = 'color';
            });

        // Attachments (editable)
        new Setting(contentEl)
            .setName('Attachments')
            .setDesc('Files or notes linked to this timeblock')
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
        
        // Initialize attachments from timeblock
        await this.initializeAttachments();
        this.renderAttachmentsList();

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'timeblock-modal-buttons' });
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.alignItems = 'center';
        buttonContainer.style.marginTop = '20px';
        
        // Delete button (left side)
        const deleteButton = buttonContainer.createEl('button', { 
            text: 'Delete Timeblock',
            cls: 'mod-warning timeblock-delete-button'
        });
        deleteButton.addEventListener('click', () => this.handleDelete());
        
        // Right side buttons container
        const rightButtons = buttonContainer.createDiv({ cls: 'timeblock-modal-buttons-right' });
        rightButtons.style.display = 'flex';
        rightButtons.style.gap = '8px';
        
        const cancelButton = rightButtons.createEl('button', { text: 'Cancel' });
        cancelButton.addEventListener('click', () => this.close());

        const saveButton = rightButtons.createEl('button', { 
            text: 'Save Changes',
            cls: 'mod-cta timeblock-save-button'
        });
        saveButton.addEventListener('click', () => this.handleSave());
        
        // Initial validation
        this.validateForm();
        
        // Focus the title input
        window.setTimeout(() => this.titleInput.focus(), 50);
    }

    private validateForm(): void {
        const saveButton = this.contentEl.querySelector('.timeblock-save-button') as HTMLButtonElement;
        if (!saveButton) return;

        const title = this.titleInput?.value.trim();
        const isValid = !!title;

        saveButton.disabled = !isValid;
        saveButton.style.opacity = isValid ? '1' : '0.5';
    }

    private async initializeAttachments(): Promise<void> {
        if (!this.timeblock.attachments) return;
        
        // Convert attachment strings back to TAbstractFile objects
        for (const attachmentPath of this.timeblock.attachments) {
            // Remove wikilink brackets if present
            const cleanPath = attachmentPath.replace(/^\[\[|\]\]$/g, '');
            const file = this.app.vault.getAbstractFileByPath(cleanPath);
            if (file) {
                this.selectedAttachments.push(file);
            }
        }
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

    private openAttachment(file: TAbstractFile): void {
        if (file instanceof TFile) {
            this.app.workspace.getLeaf(false).openFile(file);
        } else {
            new Notice(`Cannot open "${file.name}" - file type not supported`);
        }
    }

    private renderAttachmentsList(): void {
        this.attachmentsList.empty();

        if (this.selectedAttachments.length === 0) {
            const emptyState = this.attachmentsList.createDiv({ cls: 'timeblock-attachments-empty' });
            emptyState.textContent = 'No attachments';
            return;
        }

        this.selectedAttachments.forEach(file => {
            const attachmentItem = this.attachmentsList.createDiv({ cls: 'timeblock-attachment-item' });
            
            // Info container (clickable to open)
            const infoEl = attachmentItem.createDiv({ cls: 'timeblock-attachment-info' });
            infoEl.style.cursor = 'pointer';
            setTooltip(infoEl, 'Click to open', { placement: 'top' });
            infoEl.addEventListener('click', () => this.openAttachment(file));
            
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
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeAttachment(file);
            });
        });
    }

    private async handleSave(): Promise<void> {
        try {
            // Validate inputs
            const title = this.titleInput.value.trim();
            if (!title) {
                new Notice('Please enter a title for the timeblock');
                return;
            }

            // Update timeblock with new values
            this.timeblock.title = title;
            this.timeblock.description = this.descriptionInput.value.trim() || undefined;
            this.timeblock.color = this.colorInput.value || undefined;

            // Convert selected attachments to wikilinks
            const attachments: string[] = this.selectedAttachments.map(file => `[[${file.path}]]`);
            this.timeblock.attachments = attachments.length > 0 ? attachments : undefined;

            // Save to daily note
            await this.updateTimeblockInDailyNote();

            // Refresh calendar views  
            this.plugin.emitter.trigger('data-changed');

            new Notice(`Timeblock "${title}" updated successfully`);
            this.close();
        } catch (error) {
            console.error('Error updating timeblock:', error);
            new Notice('Failed to update timeblock. Check console for details.');
        }
    }

    private async updateTimeblockInDailyNote(): Promise<void> {
        if (!appHasDailyNotesPluginLoaded()) {
            throw new Error('Daily Notes plugin is not enabled');
        }

        // Get daily note for the date
        const dateStr = this.eventDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const moment = (window as any).moment(dateStr);
        const allDailyNotes = getAllDailyNotes();
        const dailyNote = getDailyNote(moment, allDailyNotes);

        if (!dailyNote) {
            throw new Error('Daily note not found');
        }

        // Read current content
        const content = await this.app.vault.read(dailyNote);
        
        // Parse existing frontmatter
        let frontmatter: any = {};
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

        // Update the specific timeblock in the array
        if (frontmatter.timeblocks && Array.isArray(frontmatter.timeblocks)) {
            const index = frontmatter.timeblocks.findIndex((tb: TimeBlock) => 
                tb.id === this.originalTimeblock.id ||
                (tb.title === this.originalTimeblock.title && 
                 tb.startTime === this.originalTimeblock.startTime &&
                 tb.endTime === this.originalTimeblock.endTime)
            );
            
            if (index >= 0) {
                frontmatter.timeblocks[index] = this.timeblock;
            } else {
                throw new Error('Timeblock not found in daily note');
            }
        } else {
            throw new Error('No timeblocks found in daily note');
        }

        // Convert frontmatter back to YAML
        const frontmatterText = stringifyYaml(frontmatter);

        // Reconstruct file content
        const newContent = `---\n${frontmatterText}---${bodyContent}`;

        // Write back to file
        await this.app.vault.modify(dailyNote, newContent);
    }

    private async handleDelete(): Promise<void> {
        // Show confirmation dialog
        const confirmed = await this.showDeleteConfirmation();
        if (!confirmed) return;

        try {
            await this.deleteTimeblockFromDailyNote();

            // Refresh calendar views  
            this.plugin.emitter.trigger('data-changed');

            new Notice(`Timeblock "${this.timeblock.title}" deleted successfully`);
            this.close();
        } catch (error) {
            console.error('Error deleting timeblock:', error);
            new Notice('Failed to delete timeblock. Check console for details.');
        }
    }

    private async showDeleteConfirmation(): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText('Delete Timeblock');
            
            const content = modal.contentEl;
            content.createEl('p', { 
                text: `Are you sure you want to delete the timeblock "${this.timeblock.title}"?` 
            });
            content.createEl('p', { 
                text: 'This action cannot be undone.',
                cls: 'mod-warning'
            });
            
            const buttonContainer = content.createDiv({ cls: 'modal-button-container' });
            buttonContainer.style.display = 'flex';
            buttonContainer.style.justifyContent = 'flex-end';
            buttonContainer.style.gap = '8px';
            buttonContainer.style.marginTop = '20px';
            
            const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
            cancelBtn.addEventListener('click', () => {
                modal.close();
                resolve(false);
            });
            
            const deleteBtn = buttonContainer.createEl('button', { 
                text: 'Delete',
                cls: 'mod-warning'
            });
            deleteBtn.addEventListener('click', () => {
                modal.close();
                resolve(true);
            });
            
            modal.open();
            
            // Focus the cancel button by default for safety
            setTimeout(() => cancelBtn.focus(), 50);
        });
    }

    private async deleteTimeblockFromDailyNote(): Promise<void> {
        if (!appHasDailyNotesPluginLoaded()) {
            throw new Error('Daily Notes plugin is not enabled');
        }

        // Get daily note for the date
        const dateStr = this.eventDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const moment = (window as any).moment(dateStr);
        const allDailyNotes = getAllDailyNotes();
        const dailyNote = getDailyNote(moment, allDailyNotes);

        if (!dailyNote) {
            throw new Error('Daily note not found');
        }

        // Read current content
        const content = await this.app.vault.read(dailyNote);
        
        // Parse existing frontmatter
        let frontmatter: any = {};
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

        // Remove the specific timeblock from the array
        if (frontmatter.timeblocks && Array.isArray(frontmatter.timeblocks)) {
            const index = frontmatter.timeblocks.findIndex((tb: TimeBlock) => 
                tb.id === this.originalTimeblock.id ||
                (tb.title === this.originalTimeblock.title && 
                 tb.startTime === this.originalTimeblock.startTime &&
                 tb.endTime === this.originalTimeblock.endTime)
            );
            
            if (index >= 0) {
                frontmatter.timeblocks.splice(index, 1);
                
                // If no timeblocks left, remove the property entirely
                if (frontmatter.timeblocks.length === 0) {
                    delete frontmatter.timeblocks;
                }
            } else {
                throw new Error('Timeblock not found in daily note');
            }
        } else {
            throw new Error('No timeblocks found in daily note');
        }

        // Convert frontmatter back to YAML
        const frontmatterText = Object.keys(frontmatter).length > 0 ? stringifyYaml(frontmatter) : '';

        // Reconstruct file content
        const newContent = frontmatterText ? `---\n${frontmatterText}---${bodyContent}` : bodyContent.trim();

        // Write back to file
        await this.app.vault.modify(dailyNote, newContent);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}