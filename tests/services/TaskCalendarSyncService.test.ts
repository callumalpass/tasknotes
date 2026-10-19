import { TaskCalendarSyncService } from "../../src/services/TaskCalendarSyncService";
import { TaskInfo } from "../../src/types";

describe("TaskCalendarSyncService", () => {
    let syncService: any;
    let mockPlugin: any;
    let mockGoogleCalendarService: any;

    const deferred = () => {
        let resolve!: () => void;
        const promise = new Promise<void>((innerResolve) => {
            resolve = innerResolve;
        });
        return { promise, resolve };
    };

    beforeEach(() => {
        jest.useFakeTimers();
        const pluginData: Record<string, unknown> = {};

        mockPlugin = {
            settings: {
                googleCalendarExport: {
                    syncOnTaskUpdate: true,
                    syncOnTaskComplete: true,
                    enabled: true,
                    targetCalendarId: "test-calendar",
                    includeObsidianLink: true,
                    eventTitleTemplate: "{{title}}",
                    includeDescription: false,
                    syncTrigger: "scheduled",
                    createAsAllDay: true,
                    defaultEventDuration: 60,
                }
            },
            app: {
                vault: {
                    getName: jest.fn().mockReturnValue("Example Vault"),
                },
            },
            cacheManager: {
                getTaskInfo: jest.fn()
            },
            loadData: jest.fn().mockImplementation(async () => pluginData),
            loadPluginDataForSafeWrite: jest.fn().mockImplementation(async () => pluginData),
            saveData: jest.fn().mockImplementation(async (data: Record<string, unknown>) => {
                const nextData = { ...data };
                for (const key of Object.keys(pluginData)) {
                    delete pluginData[key];
                }
                Object.assign(pluginData, nextData);
            }),
            statusManager: {
                getStatusConfig: jest.fn((status: string) => ({ label: status === "ready" ? "Ready" : "Todo" })),
                isCompletedStatus: jest.fn((status?: string) => status === "done")
            },
            priorityManager: {
                getPriorityConfig: jest.fn((priority: string) => ({ label: priority === "2-high" ? "High" : "Medium" }))
            },
            i18n: {
                translate: jest.fn((key: string, params?: Record<string, string | number>) => {
                    const translations: Record<string, string> = {
                        "settings.integrations.googleCalendarExport.eventDescription.untitledTask": "Untitled Task",
                        "settings.integrations.googleCalendarExport.eventDescription.priority": "Priority: {value}",
                        "settings.integrations.googleCalendarExport.eventDescription.status": "Status: {value}",
                        "settings.integrations.googleCalendarExport.eventDescription.scheduled": "Scheduled: {value}",
                        "settings.integrations.googleCalendarExport.eventDescription.timeEstimate": "Time Estimate: {value}",
                        "settings.integrations.googleCalendarExport.eventDescription.contexts": "Contexts: {value}",
                        "settings.integrations.googleCalendarExport.eventDescription.projects": "Projects: {value}",
                        "settings.integrations.googleCalendarExport.eventDescription.openInObsidian": "Open in Obsidian",
                    };
                    const translation = translations[key] || key;
                    return translation.replace(/\{(\w+)\}/g, (_match, name) => String(params?.[name] ?? ""));
                })
            }
        };

        mockGoogleCalendarService = {
            getAvailableCalendars: jest.fn().mockReturnValue([{ id: "test-calendar" }]),
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

    it("should build plain-text calendar descriptions for external calendar clients", () => {
        const description = syncService.buildEventDescription({
            path: "Tasks/Prepare quarterly planning notes.md",
            title: "Prepare quarterly planning notes",
            status: "ready",
            priority: "2-high",
            scheduled: "2026-04-29",
            timeEstimate: 180,
            projects: [
                "[[Projects/Quarterly Planning|Quarterly Planning]]",
                "[[Projects/Nested Project.md]]",
                "[Markdown Project](Projects/Markdown%20Project.md)",
            ],
            contexts: ["[[People/Alex Example|Alex Example]]", "admin"],
        } as TaskInfo);

        expect(description).toContain("Priority: High");
        expect(description).toContain("Status: Ready");
        expect(description).toContain("Scheduled: 2026-04-29");
        expect(description).toContain("Time Estimate: 3h 0m");
        expect(description).toContain("Contexts: @Alex Example, @admin");
        expect(description).toContain(
            "Projects: Quarterly Planning, Nested Project, Markdown Project"
        );
        expect(description).toContain(
            "Open in Obsidian: obsidian://open?vault=Example%20Vault&file=Tasks%2FPrepare%20quarterly%20planning%20notes.md"
        );
        expect(description).not.toContain("[[");
        expect(description).not.toContain("]]");
        expect(description).not.toContain("<a ");
        expect(description).not.toContain("</a>");
        expect(description).not.toContain("](");
    });

    it("should cancel a pending status update before syncing completion", async () => {
        syncService.withGoogleRateLimit = (fn: () => Promise<unknown>) => fn();

        const taskPath = "test/path.md";
        const somedayPayload: TaskInfo = {
            path: taskPath,
            title: "Task Title",
            status: "someday",
            scheduled: "2026-04-29",
            googleCalendarEventId: "event-1"
        };
        const donePayload: TaskInfo = {
            ...somedayPayload,
            status: "done"
        };

        syncService.updateTaskInCalendar(somedayPayload);
        await syncService.completeTaskInCalendar(donePayload);

        jest.advanceTimersByTime(500);
        await Promise.resolve();
        await Promise.resolve();

        expect(syncService.executeTaskUpdate).not.toHaveBeenCalled();
        expect(mockGoogleCalendarService.updateEvent).toHaveBeenCalledTimes(1);
        expect(mockGoogleCalendarService.updateEvent).toHaveBeenCalledWith(
            "test-calendar",
            "event-1",
            {
                summary: "✓ Task Title",
                description: undefined
            },
            expect.any(Number)
        );
    });

    it("should mark already-completed tasks when a later schedule change creates a calendar event", () => {
        const event = syncService.taskToCalendarEvent({
            path: "test/path.md",
            title: "Task Title",
            status: "done",
            scheduled: "2026-04-29"
        } as TaskInfo);

        expect(event).toEqual(
            expect.objectContaining({
                summary: "✓ Task Title",
                start: { date: "2026-04-29" }
            })
        );
    });

    describe("all-day task availability (#2375)", () => {
        const task = { path: "Tasks/Availability.md", title: "Availability", scheduled: "2026-10-01" };

        it.each([false, undefined])("preserves Busy when the option is %s", (enabled) => {
            mockPlugin.settings.googleCalendarExport.showAllDayAsFree = enabled;
            expect(syncService.taskToCalendarEvent(task).transparency).toBe("opaque");
        });

        it.each([false, true])("exports date-only tasks as Free with createAsAllDay=%s", (allDay) => {
            Object.assign(mockPlugin.settings.googleCalendarExport, { showAllDayAsFree: true, createAsAllDay: allDay });
            expect(syncService.taskToCalendarEvent(task).transparency).toBe("transparent");
        });

        it("keeps timed exports Busy but makes forced all-day exports Free", () => {
            Object.assign(mockPlugin.settings.googleCalendarExport, { showAllDayAsFree: true, createAsAllDay: false });
            const timed = { ...task, scheduled: "2026-10-01T10:00:00" };
            expect(syncService.taskToCalendarEvent(timed).transparency).toBe("opaque");
            mockPlugin.settings.googleCalendarExport.createAsAllDay = true;
            expect(syncService.taskToCalendarEvent(timed).transparency).toBe("transparent");
        });

        it("supports due-date exports and switching back to Busy", () => {
            Object.assign(mockPlugin.settings.googleCalendarExport, { showAllDayAsFree: true, syncTrigger: "due" });
            const dueTask = { ...task, scheduled: undefined, due: "2026-10-01" };
            expect(syncService.taskToCalendarEvent(dueTask).transparency).toBe("transparent");
            mockPlugin.settings.googleCalendarExport.showAllDayAsFree = false;
            expect(syncService.taskToCalendarEvent(dueTask).transparency).toBe("opaque");
        });

        it.each([
            ["DTSTART:20261001\nRRULE:FREQ=DAILY", "2026-10-01T10:00:00", "transparent"],
            ["DTSTART:20261001T100000\nRRULE:FREQ=DAILY", "2026-10-01", "opaque"],
        ])("uses the final recurring event shape for %s", (recurrence, scheduled, expected) => {
            Object.assign(mockPlugin.settings.googleCalendarExport, { showAllDayAsFree: true, createAsAllDay: false });
            const event = syncService.taskToCalendarEvent({ ...task, scheduled, recurrence });
            expect(event.transparency).toBe(expected);
        });

        it("applies the policy to detached recurring exceptions", () => {
            Object.assign(mockPlugin.settings.googleCalendarExport, { showAllDayAsFree: true, createAsAllDay: false });
            expect(syncService.buildRecurringExceptionEvent(task).transparency).toBe("transparent");
            expect(syncService.buildRecurringExceptionEvent({ ...task, scheduled: "2026-10-01T10:00:00" }).transparency).toBe("opaque");
            mockPlugin.settings.googleCalendarExport.createAsAllDay = true;
            expect(syncService.buildRecurringExceptionEvent({ ...task, scheduled: "2026-10-01T10:00:00" }).transparency).toBe("transparent");
        });

        it("updates existing events on a bulk resync even when only the setting changed", async () => {
            mockPlugin.cacheManager.getAllTasks = jest.fn().mockResolvedValue([
                { ...task, googleCalendarEventId: "availability-event" },
            ]);
            syncService.withGoogleRateLimit = async (operation: () => Promise<unknown>) => operation();
            syncService.assertConnectionGenerationCurrent = jest.fn().mockResolvedValue(undefined);
            mockPlugin.settings.googleCalendarExport.showAllDayAsFree = true;
            await syncService.syncAllTasks();
            expect(mockGoogleCalendarService.updateEvent).toHaveBeenLastCalledWith(
                "test-calendar", "availability-event", expect.objectContaining({ transparency: "transparent" }), expect.any(Number)
            );
            mockPlugin.settings.googleCalendarExport.showAllDayAsFree = false;
            await syncService.syncAllTasks();
            expect(mockGoogleCalendarService.updateEvent).toHaveBeenLastCalledWith(
                "test-calendar", "availability-event", expect.objectContaining({ transparency: "opaque" }), expect.any(Number)
            );
        });
    });

    it("should retry recovery queues without overlapping runs", async () => {
        const startupRecovery = deferred();
        const firstRetry = deferred();

        syncService.processStartupRecovery = jest.fn().mockReturnValue(startupRecovery.promise);
        syncService.processRecoveryQueues = jest.fn().mockReturnValue(firstRetry.promise);

        syncService.startRecoveryQueueProcessor();

        expect(syncService.processStartupRecovery).toHaveBeenCalledTimes(1);
        expect(syncService.processRecoveryQueues).not.toHaveBeenCalled();

        jest.advanceTimersByTime(60000);
        expect(syncService.processRecoveryQueues).not.toHaveBeenCalled();

        startupRecovery.resolve();
        await Promise.resolve();
        await Promise.resolve();

        jest.advanceTimersByTime(60000);
        expect(syncService.processRecoveryQueues).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(60000);
        expect(syncService.processRecoveryQueues).toHaveBeenCalledTimes(1);

        firstRetry.resolve();
        await Promise.resolve();
        await Promise.resolve();

        jest.advanceTimersByTime(60000);
        expect(syncService.processRecoveryQueues).toHaveBeenCalledTimes(2);
    });
});
