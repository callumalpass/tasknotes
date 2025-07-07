import { App, TFile } from 'obsidian';
import { convertLegacyRecurrenceToRRule } from '../utils/helpers';

/**
 * Service for migrating legacy RecurrenceInfo objects to rrule strings
 */
export class MigrationService {
    private app: App;
    private migrationInProgress = false;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Check if migration is needed by scanning for tasks with legacy recurrence
     */
    async needsMigration(): Promise<boolean> {
        const taskFiles = this.app.vault.getMarkdownFiles().filter(file => 
            file.path.includes('task') || 
            this.app.metadataCache.getFileCache(file)?.frontmatter?.status
        );

        for (const file of taskFiles) {
            const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
            // Check if recurrence exists and is an object (not a string)
            if (frontmatter?.recurrence && typeof frontmatter.recurrence === 'object') {
                return true;
            }
        }

        return false;
    }

    /**
     * Get count of files that need migration
     */
    async getMigrationCount(): Promise<number> {
        const taskFiles = this.app.vault.getMarkdownFiles().filter(file => 
            file.path.includes('task') || 
            this.app.metadataCache.getFileCache(file)?.frontmatter?.status
        );

        let count = 0;
        for (const file of taskFiles) {
            const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
            // Check if recurrence exists and is an object (not a string)
            if (frontmatter?.recurrence && typeof frontmatter.recurrence === 'object') {
                count++;
            }
        }

        return count;
    }

    /**
     * Perform the migration from legacy RecurrenceInfo to rrule
     */
    async performMigration(progressCallback?: (current: number, total: number, fileName: string) => void): Promise<{ success: number; errors: string[] }> {
        if (this.migrationInProgress) {
            throw new Error('Migration already in progress');
        }

        this.migrationInProgress = true;
        const errors: string[] = [];
        let success = 0;

        try {
            // Find all task files with legacy recurrence (object format)
            const taskFiles = this.app.vault.getMarkdownFiles().filter(file => {
                const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
                return frontmatter?.recurrence && typeof frontmatter.recurrence === 'object';
            });

            const total = taskFiles.length;

            for (let i = 0; i < taskFiles.length; i++) {
                const file = taskFiles[i];
                
                if (progressCallback) {
                    progressCallback(i + 1, total, file.name);
                }

                try {
                    await this.migrateFile(file);
                    success++;
                } catch (error) {
                    const errorMsg = `Failed to migrate ${file.path}: ${error instanceof Error ? error.message : String(error)}`;
                    errors.push(errorMsg);
                    console.error(errorMsg, error);
                }

                // Add small delay to prevent UI freezing
                if (i % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            return { success, errors };
        } finally {
            this.migrationInProgress = false;
        }
    }

    /**
     * Migrate a single file from legacy recurrence to rrule
     */
    private async migrateFile(file: TFile): Promise<void> {
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            // Check if migration is needed (recurrence should be an object)
            if (!frontmatter.recurrence || typeof frontmatter.recurrence !== 'object') {
                return; // Already migrated or no recurrence
            }

            // Convert legacy recurrence to rrule string
            try {
                const rruleString = convertLegacyRecurrenceToRRule(frontmatter.recurrence);
                
                // Replace the recurrence object with the rrule string
                frontmatter.recurrence = rruleString;
            } catch (error) {
                throw new Error(`Failed to convert recurrence to rrule: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }

    /**
     * Check if migration is currently in progress
     */
    isMigrationInProgress(): boolean {
        return this.migrationInProgress;
    }
}