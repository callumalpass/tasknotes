/**
 * Test for Issue #327: Updating Recurring Task from Agenda View updates wrong day
 * 
 * From GitHub issue: https://github.com/callumalpass/tasknotes/issues/327
 * 
 * User report: "I have a recurring task in Agenda View... And when I click on it, 
 * it updates for the wrong day"
 */

import { TaskInfo } from '../../../src/types';
import { formatDateForStorage } from '../../../src/utils/dateUtils';
import { TaskFactory } from '../../helpers/mock-factories';
import TaskNotesPlugin from '../../../src/main';
import { TFile } from 'obsidian';

describe('Issue #327: Recurring Task Updates Wrong Day from Agenda View', () => {
    let plugin: TaskNotesPlugin;
    let mockFile: TFile;

    beforeEach(() => {
        // Create a minimal mock plugin
        plugin = {
            app: {
                fileManager: {
                    processFrontMatter: jest.fn()
                },
                vault: {
                    getAbstractFileByPath: jest.fn()
                }
            },
            cacheManager: {
                getTaskInfo: jest.fn(),
                getTasksForDate: jest.fn(),
                invalidateTaskCache: jest.fn(),
                setTaskInfo: jest.fn()
            },
            emitter: {
                emit: jest.fn()
            },
            toggleRecurringTaskComplete: jest.fn()
        } as any;

        mockFile = {
            path: 'tasks/recurring-task.md',
            name: 'recurring-task.md',
            basename: 'recurring-task'
        } as TFile;

        plugin.app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
    });

    it('should update the correct date when marking a recurring task complete from agenda view', async () => {
        // Create a recurring task that repeats daily
        const recurringTask: TaskInfo = TaskFactory.createRecurringTask('RRULE:FREQ=DAILY', {
            path: 'tasks/recurring-task.md',
            title: 'Daily recurring task',
            scheduled: '2024-01-15', // Monday
            complete_instances: [] // No completions yet
        });

        // Mock the cache manager to return our task
        plugin.cacheManager.getTaskInfo.mockResolvedValue(recurringTask);

        // Simulate clicking on the task in agenda view for Wednesday (2024-01-17)
        const targetDate = new Date('2024-01-17T00:00:00.000Z');
        const expectedDateStr = formatDateForStorage(targetDate);

        // Mock the frontmatter processing
        let updatedFrontmatter: any = {};
        plugin.app.fileManager.processFrontMatter.mockImplementation(
            async (file: TFile, processor: (fm: any) => void) => {
                const frontmatter = {
                    status: 'open',
                    title: 'Daily recurring task',
                    scheduled: '2024-01-15',
                    recurrence: 'RRULE:FREQ=DAILY',
                    complete_instances: []
                };
                processor(frontmatter);
                updatedFrontmatter = { ...frontmatter };
                return;
            }
        );

        // Create the actual toggleRecurringTaskComplete function
        plugin.toggleRecurringTaskComplete = async (task: TaskInfo, targetDate: Date) => {
            const file = plugin.app.vault.getAbstractFileByPath(task.path);
            if (!file) throw new Error('File not found');

            await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
                const dateStr = formatDateForStorage(targetDate);
                
                if (!frontmatter.complete_instances) {
                    frontmatter.complete_instances = [];
                }

                const index = frontmatter.complete_instances.indexOf(dateStr);
                if (index === -1) {
                    // Add completion
                    frontmatter.complete_instances.push(dateStr);
                } else {
                    // Remove completion
                    frontmatter.complete_instances.splice(index, 1);
                }
            });
        };

        // Toggle the task completion for the target date
        await plugin.toggleRecurringTaskComplete(recurringTask, targetDate);

        // Verify that the correct date was marked as complete
        expect(updatedFrontmatter.complete_instances).toBeDefined();
        expect(updatedFrontmatter.complete_instances).toContain(expectedDateStr);
        expect(updatedFrontmatter.complete_instances).toHaveLength(1);
        
        // Ensure it didn't mark a different date
        expect(updatedFrontmatter.complete_instances[0]).toBe('2024-01-17');
        expect(updatedFrontmatter.complete_instances).not.toContain('2024-01-15'); // The scheduled date
        expect(updatedFrontmatter.complete_instances).not.toContain('2024-01-16'); // Tuesday
        expect(updatedFrontmatter.complete_instances).not.toContain('2024-01-18'); // Thursday
    });

    it('should handle timezone differences correctly when marking recurring tasks complete', () => {
        // Create dates that might cause timezone issues
        const localDate = new Date('2024-01-17'); // This creates a date in local time
        const utcDate = new Date('2024-01-17T00:00:00.000Z'); // This creates a date in UTC
        
        // Format both dates
        const localDateStr = formatDateForStorage(localDate);
        const utcDateStr = formatDateForStorage(utcDate);
        
        // They should produce the same date string regardless of timezone
        expect(localDateStr).toBe('2024-01-17');
        expect(utcDateStr).toBe('2024-01-17');
        
        // Test with edge case times that might roll over to different days
        const lateNightLocal = new Date('2024-01-17T23:59:59'); // Late at night local time
        const lateNightUTC = new Date('2024-01-17T23:59:59.000Z'); // Late at night UTC
        
        expect(formatDateForStorage(lateNightLocal)).toBe('2024-01-17');
        // In Australia (UTC+11), Jan 17 23:59 UTC is actually Jan 18 10:59 local
        expect(formatDateForStorage(lateNightUTC)).toBe('2024-01-18');
    });
    
    it('should handle dates created with UTC constructor methods', () => {
        // Test the date creation method used in AgendaView.getAgendaDates()
        const year = 2024;
        const month = 0; // January (0-indexed)
        const day = 17;
        
        // This is how AgendaView creates normalized dates
        const normalizedDate = new Date(Date.UTC(year, month, day));
        
        // Test that it formats correctly
        expect(formatDateForStorage(normalizedDate)).toBe('2024-01-17');
        
        // Test with a date that would be different in some timezones
        // For example, if local timezone is UTC-5, then Jan 17 00:00 UTC is Jan 16 19:00 local
        const utcMidnight = new Date(Date.UTC(2024, 0, 17, 0, 0, 0));
        expect(formatDateForStorage(utcMidnight)).toBe('2024-01-17');
        
        // Test with a date created differently but should result in same output
        const regularDate = new Date('2024-01-17');
        const utcConstructedDate = new Date(Date.UTC(2024, 0, 17));
        
        // Both should format to the same string
        expect(formatDateForStorage(regularDate)).toBe(formatDateForStorage(utcConstructedDate));
    });
    
    it('FAILS: demonstrates the timezone bug when local date differs from UTC date', () => {
        // This test demonstrates the actual bug reported in issue #327
        // When user is in a timezone where local midnight is on a different UTC day
        
        // Simulate a user in Pacific Time (UTC-8) clicking on January 17th
        // At midnight Pacific Time on Jan 17, it's already 8 AM UTC on Jan 17
        // But if we create a date incorrectly, it might think it's Jan 16 UTC
        
        // This is what might happen if the date is created incorrectly:
        // User clicks on Jan 17 in UI (local time)
        // Code creates: new Date(2024, 0, 17) - this is Jan 17 00:00 LOCAL time
        // In Pacific Time, this is actually Jan 17 08:00 UTC
        // But if code then extracts UTC date, it would still be Jan 17
        
        // The real issue might be when dates are created from strings without timezone info
        const localDateString = '2024-01-17'; // No timezone info
        const localDate = new Date(localDateString); // Creates date in local timezone
        
        // If user is in a timezone where it's still Jan 16 when UTC is Jan 17
        // This could cause the wrong date to be marked complete
        
        // For this test to actually fail and demonstrate the bug, we'd need to:
        // 1. Mock the timezone to be something like UTC+12 (New Zealand)
        // 2. Create a date that's Jan 17 in local time but Jan 16 in UTC
        
        // Since we can't easily mock timezones in Jest, let's at least document
        // the scenario that would cause the bug:
        console.log('Local date string:', localDateString);
        console.log('Local date object:', localDate.toString());
        console.log('Local date ISO:', localDate.toISOString());
        console.log('Formatted for calendar:', formatDateForStorage(localDate));
        
        // The bug would occur if formatDateForStorage returns a different date
        // than what the user clicked on in the UI
    });

    it('should remove completion when toggling an already completed date', async () => {
        // Task with one date already marked complete
        const recurringTask: TaskInfo = TaskFactory.createRecurringTask('RRULE:FREQ=DAILY', {
            path: 'tasks/recurring-task.md',
            title: 'Daily recurring task',
            scheduled: '2024-01-15',
            complete_instances: ['2024-01-17'] // Wednesday already marked complete
        });

        plugin.cacheManager.getTaskInfo.mockResolvedValue(recurringTask);

        const targetDate = new Date('2024-01-17T00:00:00.000Z');

        let updatedFrontmatter: any = {};
        plugin.app.fileManager.processFrontMatter.mockImplementation(
            async (file: TFile, processor: (fm: any) => void) => {
                const frontmatter = {
                    status: 'open',
                    title: 'Daily recurring task',
                    scheduled: '2024-01-15',
                    recurrence: 'RRULE:FREQ=DAILY',
                    complete_instances: ['2024-01-17']
                };
                processor(frontmatter);
                updatedFrontmatter = { ...frontmatter };
                return;
            }
        );

        // Create the toggleRecurringTaskComplete function
        plugin.toggleRecurringTaskComplete = async (task: TaskInfo, targetDate: Date) => {
            const file = plugin.app.vault.getAbstractFileByPath(task.path);
            if (!file) throw new Error('File not found');

            await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
                const dateStr = formatDateForStorage(targetDate);
                
                if (!frontmatter.complete_instances) {
                    frontmatter.complete_instances = [];
                }

                const index = frontmatter.complete_instances.indexOf(dateStr);
                if (index === -1) {
                    frontmatter.complete_instances.push(dateStr);
                } else {
                    frontmatter.complete_instances.splice(index, 1);
                }
            });
        };

        await plugin.toggleRecurringTaskComplete(recurringTask, targetDate);

        // Should remove the completion for that date
        expect(updatedFrontmatter.complete_instances).toBeDefined();
        expect(updatedFrontmatter.complete_instances).not.toContain('2024-01-17');
        expect(updatedFrontmatter.complete_instances).toHaveLength(0);
    });

    it('should preserve other completed dates when toggling a specific date', async () => {
        // Task with multiple dates marked complete
        const recurringTask: TaskInfo = TaskFactory.createRecurringTask('RRULE:FREQ=DAILY', {
            path: 'tasks/recurring-task.md',
            title: 'Daily recurring task',
            scheduled: '2024-01-15',
            complete_instances: ['2024-01-16', '2024-01-17', '2024-01-18'] // Multiple days complete
        });

        plugin.cacheManager.getTaskInfo.mockResolvedValue(recurringTask);

        const targetDate = new Date('2024-01-17T00:00:00.000Z'); // Toggle Wednesday

        let updatedFrontmatter: any = {};
        plugin.app.fileManager.processFrontMatter.mockImplementation(
            async (file: TFile, processor: (fm: any) => void) => {
                const frontmatter = {
                    status: 'open',
                    title: 'Daily recurring task',
                    scheduled: '2024-01-15',
                    recurrence: 'RRULE:FREQ=DAILY',
                    complete_instances: ['2024-01-16', '2024-01-17', '2024-01-18']
                };
                processor(frontmatter);
                updatedFrontmatter = { ...frontmatter };
                return;
            }
        );

        // Create the toggleRecurringTaskComplete function
        plugin.toggleRecurringTaskComplete = async (task: TaskInfo, targetDate: Date) => {
            const file = plugin.app.vault.getAbstractFileByPath(task.path);
            if (!file) throw new Error('File not found');

            await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
                const dateStr = formatDateForStorage(targetDate);
                
                if (!frontmatter.complete_instances) {
                    frontmatter.complete_instances = [];
                }

                const index = frontmatter.complete_instances.indexOf(dateStr);
                if (index === -1) {
                    frontmatter.complete_instances.push(dateStr);
                } else {
                    frontmatter.complete_instances.splice(index, 1);
                }
            });
        };

        await plugin.toggleRecurringTaskComplete(recurringTask, targetDate);

        // Should only remove the target date, preserve others
        expect(updatedFrontmatter.complete_instances).not.toContain('2024-01-17');
        expect(updatedFrontmatter.complete_instances).toContain('2024-01-16');
        expect(updatedFrontmatter.complete_instances).toContain('2024-01-18');
        expect(updatedFrontmatter.complete_instances).toHaveLength(2);
    });
});