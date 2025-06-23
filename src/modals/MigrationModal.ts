import { App, Modal, Setting, Notice } from 'obsidian';
import { MigrationService } from '../services/MigrationService';

/**
 * Modal for migrating legacy RecurrenceInfo to rrule format
 */
export class MigrationModal extends Modal {
    private migrationService: MigrationService;
    private migrationCount: number = 0;

    constructor(app: App, migrationService: MigrationService) {
        super(app);
        this.migrationService = migrationService;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Get migration count
        this.migrationCount = await this.migrationService.getMigrationCount();

        contentEl.createEl('h2', { text: 'Recurrence System Migration' });

        contentEl.createEl('p', { 
            text: 'TaskNotes has an updated, more powerful recurrence system based on the RFC 5545 standard. This migration will convert your existing recurring tasks to use the new format.'
        });

        contentEl.createEl('p', { 
            text: `Found ${this.migrationCount} task(s) that need migration.`
        });

        if (this.migrationCount === 0) {
            contentEl.createEl('p', { 
                text: 'No migration needed! All your tasks are already using the new recurrence format.',
                cls: 'text-success'
            });

            new Setting(contentEl)
                .addButton(button => {
                    button
                        .setButtonText('Close')
                        .setCta()
                        .onClick(() => this.close());
                });
            return;
        }

        // Warning section
        const warningEl = contentEl.createDiv('migration-warning');
        warningEl.createEl('h3', { text: '⚠️ Important Notes' });
        
        const warningList = warningEl.createEl('ul');
        warningList.createEl('li', { text: 'We strongly recommend backing up your vault before proceeding.' });
        warningList.createEl('li', { text: 'The migration will convert your recurrence objects to standardized rrule strings.' });
        warningList.createEl('li', { text: 'You can continue using your tasks normally after migration.' });
        warningList.createEl('li', { text: 'The migration is permanent - your legacy recurrence objects will be replaced.' });

        // Benefits section
        const benefitsEl = contentEl.createDiv('migration-benefits');
        benefitsEl.createEl('h3', { text: '✨ What You Get' });
        
        const benefitsList = benefitsEl.createEl('ul');
        benefitsList.createEl('li', { text: 'More powerful recurrence patterns (e.g., "every other Tuesday", "last Friday of the month")' });
        benefitsList.createEl('li', { text: 'Better performance for calendar views' });
        benefitsList.createEl('li', { text: 'Improved compatibility with calendar standards' });
        benefitsList.createEl('li', { text: 'Enhanced natural language processing for task creation' });

        // Progress section (initially hidden)
        const progressEl = contentEl.createDiv('migration-progress');
        progressEl.style.display = 'none';
        
        const progressTitle = progressEl.createEl('h3', { text: 'Migration Progress' });
        const progressBar = progressEl.createEl('progress');
        progressBar.max = this.migrationCount;
        progressBar.value = 0;
        
        const progressText = progressEl.createEl('p', { text: 'Preparing migration...' });

        // Action buttons
        const buttonContainer = contentEl.createDiv('migration-buttons');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.marginTop = '20px';

        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.onclick = () => this.close();

        const migrateButton = buttonContainer.createEl('button', { 
            text: `Migrate ${this.migrationCount} Task(s)`,
            cls: 'mod-cta'
        });

        migrateButton.onclick = async () => {
            // Disable buttons during migration
            migrateButton.disabled = true;
            cancelButton.disabled = true;
            
            // Show progress section
            progressEl.style.display = 'block';

            try {
                const result = await this.migrationService.performMigration(
                    (current, total, fileName) => {
                        progressBar.value = current;
                        progressText.textContent = `Migrating ${current}/${total}: ${fileName}`;
                    }
                );

                progressText.textContent = `Migration completed! ${result.success} files migrated successfully.`;

                if (result.errors.length > 0) {
                    const errorEl = progressEl.createDiv('migration-errors');
                    errorEl.createEl('h4', { text: '⚠️ Errors Encountered' });
                    const errorList = errorEl.createEl('ul');
                    
                    result.errors.forEach(error => {
                        errorList.createEl('li', { text: error });
                    });

                    new Notice(`Migration completed with ${result.errors.length} errors. Check the migration modal for details.`, 10000);
                } else {
                    new Notice(`Migration completed successfully! ${result.success} tasks migrated.`, 5000);
                }

                // Update button
                migrateButton.textContent = 'Migration Complete';
                cancelButton.textContent = 'Close';
                cancelButton.disabled = false;

            } catch (error) {
                progressText.textContent = `Migration failed: ${error instanceof Error ? error.message : String(error)}`;
                new Notice(`Migration failed: ${error instanceof Error ? error.message : String(error)}`, 10000);
                
                // Re-enable buttons
                migrateButton.disabled = false;
                cancelButton.disabled = false;
            }
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Show a simple migration prompt notice
 */
export function showMigrationPrompt(app: App, migrationService: MigrationService): void {
    const notice = new Notice('', 0); // Persistent notice
    
    const container = notice.noticeEl.createDiv();
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '10px';
    
    const message = container.createSpan();
    message.textContent = 'TaskNotes has an updated recurrence system. Migrate your existing recurring tasks to continue using them.';
    
    const buttonContainer = container.createDiv();
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '5px';
    
    const migrateButton = buttonContainer.createEl('button', {
        text: 'Migrate Now',
        cls: 'mod-cta'
    });
    
    const laterButton = buttonContainer.createEl('button', {
        text: 'Remind Later'
    });
    
    migrateButton.onclick = () => {
        notice.hide();
        const modal = new MigrationModal(app, migrationService);
        modal.open();
    };
    
    laterButton.onclick = () => {
        notice.hide();
    };
}