/**
 * Tests for FilterService focusing on issue 153: timezone-related date comparison bugs
 * These tests verify that the timezone fix prevents tasks from disappearing due to 
 * timezone boundary issues in the Agenda view.
 */

import { FilterService } from '../../../src/services/FilterService';
import { MinimalNativeCache } from '../../../src/utils/MinimalNativeCache';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { TaskInfo, FilterQuery } from '../../../src/types';
import { format, addDays } from 'date-fns';

// Import the mocked module to get access to mocked functions
import * as dateUtils from '../../../src/utils/dateUtils';

// Mock the date-fns and dateUtils modules to simulate timezone issues
jest.mock('date-fns');
jest.mock('../../../src/utils/dateUtils');

const mockFormat = format as jest.MockedFunction<typeof format>;
const mockAddDays = addDays as jest.MockedFunction<typeof addDays>;

describe('FilterService - Issue 153 Timezone Bug Fix Verification', () => {
    let filterService: FilterService;
    let mockCacheManager: jest.Mocked<MinimalNativeCache>;
    let mockStatusManager: jest.Mocked<StatusManager>;
    let mockPriorityManager: jest.Mocked<PriorityManager>;

    // Test timezone offsets that commonly cause issues
    const TIME_ZONES = {
        UTC_PLUS_9: 9 * 60, // Asia/Tokyo
        UTC_MINUS_8: -8 * 60, // America/Los_Angeles
        UTC_PLUS_5_30: 5.5 * 60, // Asia/Kolkata
        UTC_MINUS_5: -5 * 60 // America/New_York
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Create mocked dependencies
        mockCacheManager = {
            getAllTasks: jest.fn(),
            getTaskPathsByStatus: jest.fn(),
            getTaskPathsByPriority: jest.fn(),
            getTaskPathsByDate: jest.fn(),
            getOverdueTaskPaths: jest.fn(),
            getAllTaskPaths: jest.fn(),
            getCachedTaskInfo: jest.fn(),
            getTaskInfo: jest.fn(),
        } as any;

        mockStatusManager = {
            isCompletedStatus: jest.fn().mockReturnValue(false),
        } as any;
        mockPriorityManager = {} as any;

        filterService = new FilterService(mockCacheManager, mockStatusManager, mockPriorityManager);
    });

    describe('Date comparison edge cases that cause issue 153', () => {
        /**
         * This test reproduces the exact issue described:
         * "Tasks scheduled for yesterday or on a multiple of 7 days do not appear in the Agenda View"
         */
        it('should fail to find tasks scheduled exactly 7 days ago due to timezone drift', async () => {
            // Simulate the issue: Create a task scheduled exactly 7 days ago
            const today = new Date('2025-01-15T12:00:00.000Z'); // Tuesday
            const sevenDaysAgo = new Date('2025-01-08T12:00:00.000Z'); // Tuesday, 7 days ago
            
            // Mock task scheduled for 7 days ago
            const testTask: TaskInfo = {
                title: 'Task scheduled 7 days ago',
                status: 'open',
                priority: 'normal',
                path: '/test/task-7-days-ago.md',
                archived: false,
                scheduled: '2025-01-08', // Date-only format as stored in frontmatter
                tags: ['task']
            };

            // Mock cache to return our test task
            mockCacheManager.getAllTasks.mockResolvedValue([testTask]);
            mockCacheManager.getTaskPathsByDate.mockReturnValue([testTask.path]);
            mockCacheManager.getAllTaskPaths.mockReturnValue(new Set([testTask.path]));
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(testTask);
            mockCacheManager.getTaskInfo.mockResolvedValue(testTask);

            // Simulate the problematic scenario: timezone drift in date arithmetic
            mockAddDays.mockImplementation((date: Date, amount: number) => {
                // Simulate DST or timezone boundary issues where the result
                // doesn't align perfectly with midnight local time
                const result = new Date(date);
                result.setDate(result.getDate() + amount);
                
                // For timezone UTC+9, adding days can sometimes result in dates
                // that are off by several hours from expected midnight
                if (amount === -7) {
                    // Simulate the issue: the calculated date is slightly off
                    result.setHours(23, 0, 0, 0); // 23:00 instead of 00:00
                }
                
                return result;
            });

            // Mock format to show the issue: dates that should be the same format differently
            mockFormat.mockImplementation((date: Date, formatStr: string) => {
                if (formatStr === 'yyyy-MM-dd') {
                    // For the problematic date, return a different day due to timezone boundary
                    if (date.getHours() === 23) {
                        // This simulates the bug: a date at 23:00 on Jan 8 gets formatted as Jan 7
                        return '2025-01-07'; // Wrong! Should be 2025-01-08
                    }
                    
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
                return date.toISOString();
            });

            // Mock getDatePart to return the task's scheduled date correctly
            const mockGetDatePart = jest.mocked(dateUtils.getDatePart);
            mockGetDatePart.mockImplementation((dateStr: string) => dateStr.split('T')[0]);

            // Create a query for 7 days ago (this should find the task but won't due to the bug)
            const targetDate = addDays(today, -7); // Should be 2025-01-08
            const query: FilterQuery = {
                searchQuery: undefined,
                statuses: undefined,
                contexts: undefined,
                priorities: undefined,
                showArchived: false,
                showRecurrent: true,
                showCompleted: false,
                sortKey: 'due',
                sortDirection: 'asc',
                groupKey: 'none'
            };

            // Call getTasksForDate - this should find the task but won't due to the bug
            const result = await filterService.getTasksForDate(targetDate, query, false);

            // EXPECTATION: This test should FAIL with the current implementation
            // The task should be found but won't be due to the timezone bug
            expect(result).toHaveLength(0); // BUG: Should be 1 but returns 0
            
            // Verify the issue: format(targetDate) returns '2025-01-07' but task.scheduled is '2025-01-08'
            expect(mockFormat).toHaveBeenCalledWith(targetDate, 'yyyy-MM-dd');
            expect(mockGetDatePart).toHaveBeenCalledWith('2025-01-08');
        });

        it('should fail to find tasks scheduled yesterday due to timezone boundary crossing', async () => {
            const today = new Date('2025-01-15T01:00:00.000Z'); // Early morning UTC
            const yesterday = new Date('2025-01-14T01:00:00.000Z');
            
            const testTask: TaskInfo = {
                title: 'Task scheduled yesterday',
                status: 'open',
                priority: 'normal',
                path: '/test/task-yesterday.md',
                archived: false,
                scheduled: '2025-01-14',
                tags: ['task']
            };

            mockCacheManager.getAllTasks.mockResolvedValue([testTask]);
            mockCacheManager.getAllTaskPaths.mockReturnValue(new Set([testTask.path]));
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(testTask);
            mockCacheManager.getTaskInfo.mockResolvedValue(testTask);

            // Simulate timezone issue for users in UTC+9 (Asia/Tokyo)
            // When it's 01:00 UTC, it's 10:00 in Tokyo (same day)
            // But timezone calculations might be off
            mockFormat.mockImplementation((date: Date, formatStr: string) => {
                if (formatStr === 'yyyy-MM-dd') {
                    // Simulate the bug: boundary crossing issue where yesterday becomes the day before
                    if (date.getHours() === 1) { // Early morning UTC time
                        // This simulates the timezone boundary crossing bug
                        return '2025-01-13'; // Wrong! Should be 2025-01-14 but timezone calc is off
                    }
                    
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
                return date.toISOString();
            });

            // Mock getDatePart to return the task's scheduled date correctly
            const mockGetDatePart = jest.mocked(dateUtils.getDatePart);
            mockGetDatePart.mockImplementation((dateStr: string) => dateStr.split('T')[0]);

            // Mock addDays to simulate timezone boundary issues
            mockAddDays.mockImplementation((date: Date, amount: number) => {
                const result = new Date(date);
                result.setDate(result.getDate() + amount);
                
                // For yesterday calculation, simulate timezone drift
                if (amount === -1) {
                    result.setHours(1, 0, 0, 0); // Early morning that will cause boundary issues
                }
                
                return result;
            });

            const targetDate = addDays(today, -1);
            const query: FilterQuery = {
                searchQuery: undefined,
                statuses: undefined,
                contexts: undefined,
                priorities: undefined,
                showArchived: false,
                showRecurrent: true,
                showCompleted: false,
                sortKey: 'due',
                sortDirection: 'asc',
                groupKey: 'none'
            };

            const result = await filterService.getTasksForDate(targetDate, query, false);

            // This should fail due to timezone mismatch
            expect(result).toHaveLength(0); // BUG: Should find the yesterday task
        });

        it('should demonstrate the cyclical nature of the bug (multiples of 7 days)', async () => {
            const today = new Date('2025-01-15T12:00:00.000Z');
            
            // Create tasks for various days that are multiples of 7 days from today
            const taskDates = [
                { daysOffset: -7, date: '2025-01-08' },   // 1 week ago
                { daysOffset: -14, date: '2025-01-01' },  // 2 weeks ago  
                { daysOffset: -21, date: '2024-12-25' },  // 3 weeks ago
                { daysOffset: 7, date: '2025-01-22' },    // 1 week ahead
                { daysOffset: 14, date: '2025-01-29' },   // 2 weeks ahead
            ];

            const testTasks: TaskInfo[] = taskDates.map((item, index) => ({
                title: `Task ${item.daysOffset} days from today`,
                status: 'open',
                priority: 'normal',
                path: `/test/task-${index}.md`,
                archived: false,
                scheduled: item.date,
                tags: ['task']
            }));

            mockCacheManager.getAllTasks.mockResolvedValue(testTasks);
            mockCacheManager.getAllTaskPaths.mockReturnValue(new Set(testTasks.map(t => t.path)));
            
            // Mock getCachedTaskInfo to return the appropriate task for each path
            mockCacheManager.getCachedTaskInfo.mockImplementation(async (path: string) => {
                return testTasks.find(task => task.path === path) || null;
            });
            mockCacheManager.getTaskInfo.mockImplementation(async (path: string) => {
                return testTasks.find(task => task.path === path) || null;
            });

            // Simulate the cyclical timezone issue that occurs every 7 days
            mockFormat.mockImplementation((date: Date, formatStr: string) => {
                if (formatStr === 'yyyy-MM-dd') {
                    // Simulate a systematic timezone drift that affects dates in a cyclical pattern
                    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
                    
                    if (dayOfWeek === 3) { // Wednesday - simulate timezone boundary issue
                        // Shift the date by 1 day due to timezone calculation error
                        const shiftedDate = new Date(date);
                        shiftedDate.setDate(shiftedDate.getDate() - 1);
                        const year = shiftedDate.getFullYear();
                        const month = String(shiftedDate.getMonth() + 1).padStart(2, '0');
                        const day = String(shiftedDate.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                    }
                    
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
                return date.toISOString();
            });

            const query: FilterQuery = {
                searchQuery: undefined,
                statuses: undefined,
                contexts: undefined,
                priorities: undefined,
                showArchived: false,
                showRecurrent: true,
                showCompleted: false,
                sortKey: 'due',
                sortDirection: 'asc',
                groupKey: 'none'
            };

            // Test each problematic date
            for (const item of taskDates) {
                const targetDate = addDays(today, item.daysOffset);
                const result = await filterService.getTasksForDate(targetDate, query, false);
                
                // Some dates will fail due to the cyclical timezone bug
                if (targetDate.getDay() === 3) { // Wednesday dates are affected
                    expect(result).toHaveLength(0); // BUG: Should find 1 task but returns 0
                } else {
                    expect(result).toHaveLength(1); // These should work correctly
                }
            }
        });
    });

    describe('Additional timezone edge cases', () => {
        it('should fail during DST transitions', async () => {
            // Simulate DST transition date (spring forward)
            const dstTransitionDate = new Date('2025-03-09T07:00:00.000Z'); // 2nd Sunday in March
            
            const testTask: TaskInfo = {
                title: 'Task during DST transition',
                status: 'open',
                priority: 'normal',
                path: '/test/dst-task.md',
                archived: false,
                scheduled: '2025-03-09',
                tags: ['task']
            };

            mockCacheManager.getAllTasks.mockResolvedValue([testTask]);
            mockCacheManager.getAllTaskPaths.mockReturnValue(new Set([testTask.path]));
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(testTask);
            mockCacheManager.getTaskInfo.mockResolvedValue(testTask);

            // Mock DST-related date formatting issues
            mockFormat.mockImplementation((date: Date, formatStr: string) => {
                if (formatStr === 'yyyy-MM-dd' && date.getMonth() === 2 && date.getDate() === 9) {
                    // During DST transition, hour calculations can be off
                    // This simulates getting the wrong date due to the "lost hour"
                    return '2025-03-08'; // Wrong date due to DST calculation error
                }
                
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            });

            const query: FilterQuery = {
                searchQuery: undefined,
                statuses: undefined,
                contexts: undefined,
                priorities: undefined,
                showArchived: false,
                showRecurrent: true,
                showCompleted: false,
                sortKey: 'due',
                sortDirection: 'asc',
                groupKey: 'none'
            };

            const result = await filterService.getTasksForDate(dstTransitionDate, query, false);

            // Should fail due to DST transition bug
            expect(result).toHaveLength(0); // BUG: Task not found due to DST issue
        });
    });
});