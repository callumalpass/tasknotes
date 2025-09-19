import { App, Modal, Setting, Notice } from 'obsidian';
import { MigrationService } from '../services/MigrationService';
import { TranslationKey } from '../i18n';
import type TaskNotesPlugin from '../main';

/**
 * Modal for migrating legacy RecurrenceInfo to rrule format
 */
export class MigrationModal extends Modal {
    private migrationService: MigrationService;
    private migrationCount = 0;
    private plugin: TaskNotesPlugin;
    private translate: (key: TranslationKey, variables?: Record<string, any>) => string;

    constructor(app: App, migrationService: MigrationService, plugin: TaskNotesPlugin) {
        super(app);
        this.migrationService = migrationService;
        this.plugin = plugin;
        this.translate = plugin.i18n.translate;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Get migration count
        this.migrationCount = await this.migrationService.getMigrationCount();

        new Setting(contentEl)
            .setName(this.translate('modals.migration.title'))
            .setHeading();

        contentEl.createEl('p', {
            text: this.translate('modals.migration.description')
        });

        contentEl.createEl('p', {
            text: this.translate('modals.migration.tasksFound', { count: this.migrationCount })
        });

        if (this.migrationCount === 0) {
            contentEl.createEl('p', {
                text: this.translate('modals.migration.noMigrationNeeded'),
                cls: 'text-success'
            });

            new Setting(contentEl)
                .addButton(button => {
                    button
                        .setButtonText(this.translate('common.close'))
                        .setCta()
                        .onClick(() => this.close());
                });
            return;
        }

        // Warning section
        const warningEl = contentEl.createDiv('migration-warning');
        new Setting(warningEl)
            .setName(this.translate('modals.migration.warnings.title'))
            .setHeading();
        
        const warningList = warningEl.createEl('ul');
        warningList.createEl('li', { text: this.translate('modals.migration.warnings.backup') });
        warningList.createEl('li', { text: this.translate('modals.migration.warnings.conversion') });
        warningList.createEl('li', { text: this.translate('modals.migration.warnings.normalUsage') });
        warningList.createEl('li', { text: this.translate('modals.migration.warnings.permanent') });

        // Benefits section
        const benefitsEl = contentEl.createDiv('migration-benefits');
        new Setting(benefitsEl)
            .setName(this.translate('modals.migration.benefits.title'))
            .setHeading();
        
        const benefitsList = benefitsEl.createEl('ul');
        benefitsList.createEl('li', { text: this.translate('modals.migration.benefits.powerfulPatterns') });
        benefitsList.createEl('li', { text: this.translate('modals.migration.benefits.performance') });
        benefitsList.createEl('li', { text: this.translate('modals.migration.benefits.compatibility') });
        benefitsList.createEl('li', { text: this.translate('modals.migration.benefits.nlp') });

        // Progress section (initially hidden)
        const progressEl = contentEl.createDiv('migration-progress');
        progressEl.style.display = 'none';
        
        new Setting(progressEl)
            .setName(this.translate('modals.migration.progress.title'))
            .setHeading();
        const progressBar = progressEl.createEl('progress');
        progressBar.max = this.migrationCount;
        progressBar.value = 0;
        
        const progressText = progressEl.createEl('p', { text: this.translate('modals.migration.progress.preparing') });

        // Action buttons
        const buttonContainer = contentEl.createDiv('migration-buttons');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.marginTop = '20px';

        const cancelButton = buttonContainer.createEl('button', { text: this.translate('common.cancel') });
        cancelButton.onclick = () => this.close();

        const migrateButton = buttonContainer.createEl('button', {
            text: this.translate('modals.migration.buttons.migrate', { count: this.migrationCount }),
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
                        progressText.textContent = this.translate('modals.migration.progress.migrating', { current, total, fileName });
                    }
                );

                progressText.textContent = this.translate('modals.migration.progress.completed', { count: result.success });

                if (result.errors.length > 0) {
                    const errorEl = progressEl.createDiv('migration-errors');
                    new Setting(errorEl)
                        .setName(this.translate('modals.migration.errors.title'))
                        .setHeading();
                    const errorList = errorEl.createEl('ul');
                    
                    result.errors.forEach(error => {
                        errorList.createEl('li', { text: error });
                    });

                    new Notice(this.translate('modals.migration.notices.completedWithErrors', { count: result.errors.length }), 10000);
                } else {
                    new Notice(this.translate('modals.migration.notices.success', { count: result.success }), 5000);
                }

                // Update button
                migrateButton.textContent = this.translate('modals.migration.buttons.completed');
                cancelButton.textContent = this.translate('common.close');
                cancelButton.disabled = false;

            } catch (error) {
                progressText.textContent = this.translate('modals.migration.progress.failed', { error: error instanceof Error ? error.message : String(error) });
                new Notice(this.translate('modals.migration.notices.failed', { error: error instanceof Error ? error.message : String(error) }), 10000);
                
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
export function showMigrationPrompt(app: App, migrationService: MigrationService, plugin: TaskNotesPlugin): void {
    const notice = new Notice('', 0); // Persistent notice
    
    const container = notice.messageEl.createDiv();
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';
    container.style.padding = '8px';
    
    const message = container.createSpan();
    message.textContent = plugin.i18n.translate('modals.migration.prompt.message');
    message.style.lineHeight = '1.4';
    message.style.marginBottom = '4px';
    
    const buttonContainer = container.createDiv();
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.alignItems = 'center';
    
    const migrateButton = buttonContainer.createEl('button', {
        text: plugin.i18n.translate('modals.migration.prompt.migrateNow'),
        cls: 'mod-cta'
    });
    
    const laterButton = buttonContainer.createEl('button', {
        text: plugin.i18n.translate('modals.migration.prompt.remindLater')
    });
    
    migrateButton.onclick = () => {
        notice.hide();
        const modal = new MigrationModal(app, migrationService, plugin);
        modal.open();
    };
    
    laterButton.onclick = () => {
        notice.hide();
    };
}
