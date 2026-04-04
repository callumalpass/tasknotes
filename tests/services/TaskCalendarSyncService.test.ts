import { TaskCalendarSyncService } from "../../src/services/TaskCalendarSyncService";
import { TaskInfo } from "../../src/types";

describe("TaskCalendarSyncService", () => {
    let syncService: any;
    let mockPlugin: any;
    let mockGoogleCalendarService: any;

    beforeEach(() => {
        jest.useFakeTimers();

        mockPlugin = {
            settings: {
                googleCalendarExport: {
                    syncOnTaskUpdate: true,
                    targetCalendarId: "test-calendar",
                }
            },
            cacheManager: {
                getTaskInfo: jest.fn()
            },
            statusManager: {
                getStatusConfig: jest.fn().mockReturnValue({ label: "Todo" })
            },
            priorityManager: {
                getPriorityConfig: jest.fn().mockReturnValue({ label: "High" })
            },
            i18n: {
                translate: jest.fn().mockReturnValue("Untitled Task")
            }
        };

        mockGoogleCalendarService = {
            updateEvent: jest.fn().mockResolvedValue({}),
            createEvent: jest.fn().mockResolvedValue({ id: "test-id" })
        };

        syncService = new TaskCalendarSyncService(mockPlugin, mockGoogleCalendarService);

        // Mock internal methods to avoid testing downstream serialization logic which might be complex
        syncService.executeTaskUpdate = jest.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("should use the most recently passed task explicitly, avoiding stale cacheManager payloads during debounce", async () => {
        const taskPath = "test/path.md";

        const firstPayload: TaskInfo = {
            path: taskPath,
            title: "Task Title",
            scheduled: "2026-04-04"
        };

        const secondPayload: TaskInfo = {
            path: taskPath,
            title: "Task Title",
            scheduled: "2026-04-06" // Agent updated it to April 6
        };

        // Pretend the metadataCache hasn't caught up and still returns the stale task
        mockPlugin.cacheManager.getTaskInfo.mockResolvedValue(firstPayload);

        // Act: trigger sync twice rapidly to simulate MCP updates or user typing
        syncService.updateTaskInCalendar(firstPayload);
        syncService.updateTaskInCalendar(secondPayload);

        // Fast-forward past the 500ms debounce
        jest.advanceTimersByTime(500);

        // Flush the microtask queue so the async debounce handler completes
        await Promise.resolve();
        await Promise.resolve();

        // Assert: It should execute only once, and pass the explicit secondPayload, not the stale cache!
        expect(syncService.executeTaskUpdate).toHaveBeenCalledTimes(1);
        expect(syncService.executeTaskUpdate).toHaveBeenCalledWith(secondPayload);
    });
});
