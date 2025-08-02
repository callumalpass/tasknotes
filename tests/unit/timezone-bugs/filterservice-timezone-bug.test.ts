/**
 * Tests to reproduce and verify the FilterService timezone bug.
 * 
 * BUG: FilterService.getTasksForDate uses date-fns format() on UTC-anchored dates,
 * causing wrong dates for users in timezones west of UTC.
 */

import { FilterService } from '../../../src/services/FilterService';
import { MinimalNativeCache } from '../../../src/utils/MinimalNativeCache';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { parseDateToUTC, formatDateForStorage } from '../../../src/utils/dateUtils';

// Mock the timezone by setting TZ environment variable
const originalTZ = process.env.TZ;

describe('FilterService Timezone Bug Reproduction', () => {
    let filterService: FilterService;
    let mockCache: jest.Mocked<MinimalNativeCache>;
    let mockStatusManager: jest.Mocked<StatusManager>;
    let mockPriorityManager: jest.Mocked<PriorityManager>;

    beforeEach(() => {
        // Create mocks
        mockCache = {
            getTasksInDateRange: jest.fn(),
            getAllTasks: jest.fn(),
            getTasksInPath: jest.fn(),
            isReady: jest.fn().mockReturnValue(true),
        } as any;

        mockStatusManager = {
            getStatusBySymbol: jest.fn(),
            getAllStatuses: jest.fn(),
        } as any;

        mockPriorityManager = {
            getPriorityBySymbol: jest.fn(),
            getAllPriorities: jest.fn(),
        } as any;

        filterService = new FilterService(mockCache, mockStatusManager, mockPriorityManager);
    });

    afterEach(() => {
        // Restore original timezone
        if (originalTZ) {
            process.env.TZ = originalTZ;
        } else {
            delete process.env.TZ;
        }
    });

    test('should reproduce the timezone bug - California user sees wrong date', async () => {
        // Set timezone to Pacific Time (UTC-7/UTC-8)
        process.env.TZ = 'America/Los_Angeles';

        // Create a UTC-anchored date for October 26, 2024
        const targetDate = parseDateToUTC('2024-10-26');
        
        // This should represent October 26th in UTC: 2024-10-26T00:00:00.000Z
        expect(targetDate.toISOString()).toBe('2024-10-26T00:00:00.000Z');
        
        // Mock cache to return tasks for the CORRECT date (2024-10-26)
        const mockTasks = [
            {
                path: 'test.md',
                due: '2024-10-26',
                title: 'Test task for Oct 26',
                status: 'open'
            }
        ];
        
        mockCache.getTasksInDateRange.mockResolvedValue(new Set(['test.md']));
        mockCache.getAllTasks.mockResolvedValue(mockTasks as any);

        // Call getTasksForDate with the UTC-anchored date
        const result = await filterService.getTasksForDate(targetDate);

        // BUG REPRODUCTION: Due to the timezone bug, when FilterService formats
        // the UTC date 2024-10-26T00:00:00.000Z using date-fns format() in 
        // Pacific timezone, it will be formatted as "2024-10-25"
        
        // The cache should be called with the WRONG date string due to the bug
        expect(mockCache.getTasksInDateRange).toHaveBeenCalledWith(
            expect.stringMatching(/2024-10-25/), // BUG: Should be 2024-10-26
            expect.stringMatching(/2024-10-25/)  // BUG: Should be 2024-10-26
        );

        // This test will FAIL after we fix the bug, which is what we want
    });

    test('should reproduce the timezone bug - New York user sees wrong date', async () => {
        // Set timezone to Eastern Time (UTC-4/UTC-5)
        process.env.TZ = 'America/New_York';

        const targetDate = parseDateToUTC('2024-10-26');
        expect(targetDate.toISOString()).toBe('2024-10-26T00:00:00.000Z');

        const mockTasks = [
            {
                path: 'test.md',
                due: '2024-10-26',
                title: 'Test task for Oct 26',
                status: 'open'
            }
        ];
        
        mockCache.getTasksInDateRange.mockResolvedValue(new Set(['test.md']));
        mockCache.getAllTasks.mockResolvedValue(mockTasks as any);

        await filterService.getTasksForDate(targetDate);

        // In Eastern Time, the UTC date should still be wrong due to format()
        expect(mockCache.getTasksInDateRange).toHaveBeenCalledWith(
            expect.stringMatching(/2024-10-25/), // BUG: Should be 2024-10-26
            expect.stringMatching(/2024-10-25/)  // BUG: Should be 2024-10-26
        );
    });

    test('should work correctly in UTC timezone (control test)', async () => {
        // Set timezone to UTC
        process.env.TZ = 'UTC';

        const targetDate = parseDateToUTC('2024-10-26');
        expect(targetDate.toISOString()).toBe('2024-10-26T00:00:00.000Z');

        const mockTasks = [
            {
                path: 'test.md',
                due: '2024-10-26',
                title: 'Test task for Oct 26',
                status: 'open'
            }
        ];
        
        mockCache.getTasksInDateRange.mockResolvedValue(new Set(['test.md']));
        mockCache.getAllTasks.mockResolvedValue(mockTasks as any);

        await filterService.getTasksForDate(targetDate);

        // In UTC, date-fns format() will produce the correct result
        expect(mockCache.getTasksInDateRange).toHaveBeenCalledWith(
            expect.stringMatching(/2024-10-26/), // CORRECT in UTC
            expect.stringMatching(/2024-10-26/)  // CORRECT in UTC
        );
    });

    test('should demonstrate the correct behavior after fix', async () => {
        // This test shows how it SHOULD work after we fix the bug
        process.env.TZ = 'America/Los_Angeles';

        const targetDate = parseDateToUTC('2024-10-26');
        
        // What the correct implementation should do:
        const correctDateStr = formatDateForStorage(targetDate);
        expect(correctDateStr).toBe('2024-10-26'); // Always correct regardless of timezone
        
        // The fixed version should always produce 2024-10-26 regardless of local timezone
        // because it uses UTC methods to extract the date components
    });
});