import { App, Modal } from 'obsidian';

/**
 * Specialized confirmation modal for storage location changes
 */
export class StorageLocationConfirmationModal extends Modal {
    private hasExistingData: boolean;
    private resolve: (confirmed: boolean) => void;

    constructor(app: App, hasExistingData: boolean) {
        super(app);
        this.hasExistingData = hasExistingData;
    }

    public show(): Promise<boolean> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Create title
        const title = this.hasExistingData ? 'Migrate pomodoro data?' : 'Switch to daily notes storage?';
        contentEl.createEl('h2', { text: title });
        
        // Main message
        const message = this.hasExistingData 
            ? 'This will migrate your existing pomodoro session data to daily notes frontmatter. The data will be grouped by date and stored in each daily note.'
            : 'Pomodoro session data will be stored in daily notes frontmatter instead of the plugin data file.';
        
        const messageP = contentEl.createEl('p');
        const strongMessage = messageP.createEl('strong');
        strongMessage.textContent = message;
        
        contentEl.createEl('br');
        
        // "What this means" section
        contentEl.createEl('p', { text: 'What this means:' });
        const warningsList = contentEl.createEl('ul');
        
        const warnings = [
            'Daily Notes core plugin must remain enabled',
            'Data will be stored in your daily notes frontmatter',
            this.hasExistingData ? 'Existing plugin data will be migrated and then cleared' : 'Future sessions will be saved to daily notes',
            'This provides better data longevity with your notes'
        ];
        
        warnings.forEach(warning => {
            const listItem = warningsList.createEl('li');
            listItem.textContent = `• ${warning}`;
        });
        
        contentEl.createEl('br');
        
        // Final warning/note
        const finalNote = contentEl.createEl('p');
        if (this.hasExistingData) {
            const strongWarning = finalNote.createEl('strong');
            strongWarning.textContent = '⚠️ Make sure you have backups if needed. This change cannot be automatically undone.';
        } else {
            finalNote.textContent = 'You can switch back to plugin storage at any time in the future.';
        }

        // Create buttons
        const buttonContainer = contentEl.createEl('div', { cls: 'modal-button-container' });
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.marginTop = '20px';

        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.addEventListener('click', () => {
            this.resolve(false);
            this.close();
        });

        const confirmButton = buttonContainer.createEl('button', { 
            text: this.hasExistingData ? 'Migrate data' : 'Switch storage',
            cls: 'mod-cta'
        });
        
        confirmButton.addEventListener('click', () => {
            this.resolve(true);
            this.close();
        });

        // Focus the confirm button
        window.setTimeout(() => {
            confirmButton.focus();
        }, 50);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        // Ensure promise is resolved even if modal is closed without selection
        if (this.resolve) {
            this.resolve(false);
        }
    }
}

/**
 * Utility function to show storage location confirmation modal
 */
export async function showStorageLocationConfirmationModal(app: App, hasExistingData: boolean): Promise<boolean> {
    const modal = new StorageLocationConfirmationModal(app, hasExistingData);
    return modal.show();
}