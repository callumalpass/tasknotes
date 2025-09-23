import { Modal, Setting } from 'obsidian';
import TaskNotesPlugin from '../main';

/**
 * Specialized confirmation modal for storage location changes
 */
export class StorageLocationConfirmationModal extends Modal {
    private hasExistingData: boolean;
    private resolve: (confirmed: boolean) => void;
    private plugin: TaskNotesPlugin;

    constructor(plugin: TaskNotesPlugin, hasExistingData: boolean) {
        super(plugin.app);
        this.plugin = plugin;
        this.hasExistingData = hasExistingData;
    }

    private t(key: string, params?: Record<string, string | number>): string {
        return this.plugin.i18n.translate(key, params);
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
        const stateKey = this.hasExistingData ? 'migrate' : 'switch';
        const title = this.t(`modals.storageLocation.title.${stateKey}`);
        new Setting(contentEl)
            .setName(title)
            .setHeading();
        
        // Main message
        const message = this.t(`modals.storageLocation.message.${stateKey}`);
        
        const messageP = contentEl.createEl('p');
        const strongMessage = messageP.createEl('strong');
        strongMessage.textContent = message;
        
        contentEl.createEl('br');
        
        // "What this means" section
        contentEl.createEl('p', { text: this.t('modals.storageLocation.whatThisMeans') });
        const warningsList = contentEl.createEl('ul');
        
        const warnings = [
            this.t('modals.storageLocation.bullets.dailyNotesRequired'),
            this.t('modals.storageLocation.bullets.storedInNotes'),
            this.hasExistingData
                ? this.t('modals.storageLocation.bullets.migrateData')
                : this.t('modals.storageLocation.bullets.futureSessions'),
            this.t('modals.storageLocation.bullets.dataLongevity')
        ];
        
        warnings.forEach(warning => {
            const listItem = warningsList.createEl('li');
            listItem.textContent = warning;
        });
        
        contentEl.createEl('br');
        
        // Final warning/note
        const finalNote = contentEl.createEl('p');
        if (this.hasExistingData) {
            const strongWarning = finalNote.createEl('strong');
            strongWarning.textContent = this.t('modals.storageLocation.finalNote.migrate');
        } else {
            finalNote.textContent = this.t('modals.storageLocation.finalNote.switch');
        }

        // Create buttons
        const buttonContainer = contentEl.createEl('div', { cls: 'modal-button-container' });
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.marginTop = '20px';

        const cancelButton = buttonContainer.createEl('button', { text: this.t('common.cancel') });
        cancelButton.addEventListener('click', () => {
            this.resolve(false);
            this.close();
        });

        const confirmButton = buttonContainer.createEl('button', { 
            text: this.hasExistingData
                ? this.t('modals.storageLocation.buttons.migrate')
                : this.t('modals.storageLocation.buttons.switch'),
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
export async function showStorageLocationConfirmationModal(plugin: TaskNotesPlugin, hasExistingData: boolean): Promise<boolean> {
    const modal = new StorageLocationConfirmationModal(plugin, hasExistingData);
    return modal.show();
}
