import { MigrationService } from '../../../src/services/MigrationService';
import { TFile } from 'obsidian';
import { convertLegacyRecurrenceToRRule } from '../../../src/utils/helpers';
import { MockObsidian } from '../../__mocks__/obsidian';
import { PluginFactory } from '../../helpers/mock-factories';

// Mock the helpers module
jest.mock('../../../src/utils/helpers', () => ({
    convertLegacyRecurrenceToRRule: jest.fn()
}));

const mockConvertLegacyRecurrenceToRRule = convertLegacyRecurrenceToRRule as jest.MockedFunction<typeof convertLegacyRecurrenceToRRule>;

describe('MigrationService', () => {
    let migrationService: MigrationService;
    let mockApp: any;
    let mockVault: any;
    let mockMetadataCache: any;

    beforeEach(() => {
        jest.clearAllMocks();
        MockObsidian.reset();
        
        // Reset the mocked conversion function to default behavior
        mockConvertLegacyRecurrenceToRRule.mockReturnValue('FREQ=DAILY');
        
        // Create mock app with vault and metadata cache
        mockApp = PluginFactory.createMockPlugin().app;
        mockVault = mockApp.vault;
        mockMetadataCache = mockApp.metadataCache;
        
        // Add missing getMarkdownFiles method
        mockVault.getMarkdownFiles = jest.fn().mockReturnValue([]);
        
        migrationService = new MigrationService(mockApp);
    });

    describe('needsMigration', () => {
        it('should return true when task files have legacy recurrence objects', async () => {
            const mockFile = new TFile('tasks/test-task.md');

            mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
            mockMetadataCache.getFileCache.mockReturnValue({
                frontmatter: {
                    status: 'open',
                    recurrence: {
                        frequency: 'weekly',
                        days_of_week: ['mon', 'wed', 'fri']
                    }
                }
            });

            const result = await migrationService.needsMigration();
            expect(result).toBe(true);
        });

        it('should return false when task files have rrule strings', async () => {
            const mockFile = new TFile('tasks/test-task.md');

            mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
            mockMetadataCache.getFileCache.mockReturnValue({
                frontmatter: {
                    status: 'open',
                    recurrence: 'FREQ=WEEKLY;BYDAY=MO,WE,FR'
                }
            });

            const result = await migrationService.needsMigration();
            expect(result).toBe(false);
        });

        it('should return false when no task files exist', async () => {
            mockVault.getMarkdownFiles.mockReturnValue([]);

            const result = await migrationService.needsMigration();
            expect(result).toBe(false);
        });

        it('should return false when task files have no recurrence', async () => {
            const mockFile = new TFile('tasks/test-task.md');

            mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
            mockMetadataCache.getFileCache.mockReturnValue({
                frontmatter: {
                    status: 'open',
                    title: 'Test Task'
                }
            });

            const result = await migrationService.needsMigration();
            expect(result).toBe(false);
        });

        it('should identify task files by path containing "task"', async () => {
            const taskFile = new TFile('daily-tasks/my-task.md');
            const nonTaskFile = new TFile('notes/random-note.md');

            mockVault.getMarkdownFiles.mockReturnValue([taskFile, nonTaskFile]);
            mockMetadataCache.getFileCache.mockImplementation((file: TFile) => {
                if (file.path.includes('task')) {
                    return {
                        frontmatter: {
                            recurrence: { frequency: 'daily' }
                        }
                    };
                }
                return null;
            });

            const result = await migrationService.needsMigration();
            expect(result).toBe(true);
        });

        it('should identify task files by status frontmatter property', async () => {
            const statusFile = new TFile('notes/status-note.md');

            mockVault.getMarkdownFiles.mockReturnValue([statusFile]);
            mockMetadataCache.getFileCache.mockReturnValue({
                frontmatter: {
                    status: 'done',
                    recurrence: { frequency: 'weekly' }
                }
            });

            const result = await migrationService.needsMigration();
            expect(result).toBe(true);
        });
    });

    describe('getMigrationCount', () => {
        it('should return correct count of files needing migration', async () => {
            const file1 = new TFile('tasks/task1.md');
            const file2 = new TFile('tasks/task2.md');
            const file3 = new TFile('tasks/task3.md');

            mockVault.getMarkdownFiles.mockReturnValue([file1, file2, file3]);
            mockMetadataCache.getFileCache.mockImplementation((file: TFile) => {
                if (file.path === 'tasks/task1.md') {
                    return { frontmatter: { recurrence: { frequency: 'daily' } } };
                }
                if (file.path === 'tasks/task2.md') {
                    return { frontmatter: { recurrence: 'FREQ=WEEKLY' } }; // Already migrated
                }
                if (file.path === 'tasks/task3.md') {
                    return { frontmatter: { recurrence: { frequency: 'monthly' } } };
                }
                return null;
            });

            const result = await migrationService.getMigrationCount();
            expect(result).toBe(2);
        });

        it('should return 0 when no files need migration', async () => {
            const file1 = new TFile('tasks/task1.md');

            mockVault.getMarkdownFiles.mockReturnValue([file1]);
            mockMetadataCache.getFileCache.mockReturnValue({
                frontmatter: {
                    recurrence: 'FREQ=DAILY'
                }
            });

            const result = await migrationService.getMigrationCount();
            expect(result).toBe(0);
        });
    });

    describe('performMigration', () => {
        it('should successfully migrate multiple files', async () => {
            const file1 = new TFile('tasks/task1.md');
            const file2 = new TFile('tasks/task2.md');

            mockVault.getMarkdownFiles.mockReturnValue([file1, file2]);
            mockMetadataCache.getFileCache.mockReturnValue({
                frontmatter: {
                    recurrence: { frequency: 'daily' }
                }
            });

            mockVault.read.mockImplementation((file: TFile) => {
                return Promise.resolve(`---
title: Test Task
recurrence:
  frequency: daily
---
# Task Content`);
            });

            mockConvertLegacyRecurrenceToRRule.mockReturnValue('FREQ=DAILY');
            mockVault.modify.mockResolvedValue(undefined);

            const progressCallback = jest.fn();
            const result = await migrationService.performMigration(progressCallback);

            expect(result.success).toBe(2);
            expect(result.errors).toHaveLength(0);
            expect(progressCallback).toHaveBeenCalledTimes(2);
            expect(progressCallback).toHaveBeenNthCalledWith(1, 1, 2, 'task1.md');
            expect(progressCallback).toHaveBeenNthCalledWith(2, 2, 2, 'task2.md');
        });

        it('should handle conversion errors gracefully', async () => {
            const file1 = new TFile('tasks/task1.md');

            mockVault.getMarkdownFiles.mockReturnValue([file1]);
            mockMetadataCache.getFileCache.mockReturnValue({
                frontmatter: {
                    recurrence: { frequency: 'daily' }
                }
            });

            // Make vault.read reject to simulate file read error
            mockVault.read.mockRejectedValue(new Error('File read error'));

            const result = await migrationService.performMigration();

            // Should have 0 successes and 1 error due to file read failure
            expect(result.success).toBe(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Failed to migrate tasks/task1.md');
            expect(result.errors[0]).toContain('File read error');
        });

        it('should handle malformed YAML errors', async () => {
            const file1 = new TFile('tasks/task1.md');

            mockVault.getMarkdownFiles.mockReturnValue([file1]);
            mockMetadataCache.getFileCache.mockReturnValue({
                frontmatter: {
                    recurrence: { frequency: 'daily' }
                }
            });

            // Return content that will cause frontmatter parsing to fail
            mockVault.read.mockResolvedValue(`---
title: Test Task
recurrence:
  frequency: daily
# Missing closing frontmatter marker
Task Content`);

            const result = await migrationService.performMigration();

            expect(result.success).toBe(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Failed to migrate tasks/task1.md');
        });

        it('should handle files without frontmatter', async () => {
            const file1 = new TFile('tasks/task1.md');

            mockVault.getMarkdownFiles.mockReturnValue([file1]);
            mockMetadataCache.getFileCache.mockReturnValue({
                frontmatter: {
                    recurrence: { frequency: 'daily' }
                }
            });

            mockVault.read.mockResolvedValue('# Task Content without frontmatter');

            const result = await migrationService.performMigration();

            expect(result.success).toBe(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('No frontmatter found');
        });

        it('should prevent concurrent migrations', async () => {
            const file1 = new TFile('tasks/task1.md');

            mockVault.getMarkdownFiles.mockReturnValue([file1]);
            mockMetadataCache.getFileCache.mockReturnValue({
                frontmatter: {
                    recurrence: { frequency: 'daily' }
                }
            });

            // Start first migration without awaiting
            const migration1 = migrationService.performMigration();
            
            // Try to start second migration while first is in progress
            await expect(migrationService.performMigration())
                .rejects.toThrow('Migration already in progress');

            // Wait for first migration to complete
            await migration1;
        });

        it('should add delays between batches to prevent UI freezing', async () => {
            const files = Array.from({ length: 25 }, (_, i) => 
                new TFile(`tasks/task${i}.md`)
            );

            mockVault.getMarkdownFiles.mockReturnValue(files);
            mockMetadataCache.getFileCache.mockReturnValue({
                frontmatter: {
                    recurrence: { frequency: 'daily' }
                }
            });

            mockVault.read.mockResolvedValue(`---
title: Test Task
recurrence:
  frequency: daily
---
# Task Content`);

            mockConvertLegacyRecurrenceToRRule.mockReturnValue('FREQ=DAILY');
            mockVault.modify.mockResolvedValue(undefined);

            const startTime = Date.now();
            await migrationService.performMigration();
            const endTime = Date.now();

            // Should take some time due to delays (at least 100ms for 2 delays at indices 10 and 20)
            expect(endTime - startTime).toBeGreaterThan(50);
        });

        it('should skip files that are already migrated', async () => {
            const file1 = new TFile('tasks/task1.md');

            mockVault.getMarkdownFiles.mockReturnValue([file1]);
            mockMetadataCache.getFileCache.mockReturnValue({
                frontmatter: {
                    recurrence: { frequency: 'daily' }
                }
            });

            mockVault.read.mockResolvedValue(`---
title: Test Task
recurrence: FREQ=DAILY
---
# Task Content`);

            const result = await migrationService.performMigration();

            expect(result.success).toBe(1);
            expect(result.errors).toHaveLength(0);
            expect(mockConvertLegacyRecurrenceToRRule).not.toHaveBeenCalled();
            expect(mockVault.modify).not.toHaveBeenCalled();
        });
    });

    describe('isMigrationInProgress', () => {
        it('should return false initially', () => {
            expect(migrationService.isMigrationInProgress()).toBe(false);
        });

        it('should return true during migration', async () => {
            const file1 = new TFile('tasks/task1.md');

            mockVault.getMarkdownFiles.mockReturnValue([file1]);
            mockMetadataCache.getFileCache.mockReturnValue({
                frontmatter: {
                    recurrence: { frequency: 'daily' }
                }
            });

            mockVault.read.mockImplementation(() => {
                // Check migration status during read operation
                expect(migrationService.isMigrationInProgress()).toBe(true);
                return Promise.resolve(`---
title: Test Task
recurrence:
  frequency: daily
---
# Task Content`);
            });

            mockConvertLegacyRecurrenceToRRule.mockReturnValue('FREQ=DAILY');
            mockVault.modify.mockResolvedValue(undefined);

            await migrationService.performMigration();
            
            // Should be false after migration completes
            expect(migrationService.isMigrationInProgress()).toBe(false);
        });

        it('should return false after migration error', async () => {
            const file1 = new TFile('tasks/task1.md');

            mockVault.getMarkdownFiles.mockReturnValue([file1]);
            mockMetadataCache.getFileCache.mockReturnValue({
                frontmatter: {
                    recurrence: { frequency: 'daily' }
                }
            });

            mockVault.read.mockRejectedValue(new Error('File read error'));

            await migrationService.performMigration();
            
            expect(migrationService.isMigrationInProgress()).toBe(false);
        });
    });
});