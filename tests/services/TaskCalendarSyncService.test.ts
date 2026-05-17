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
                    includeObsidianLink: true,
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
            statusManager: {
                getStatusConfig: jest.fn((status: string) => ({ label: status === "ready" ? "Ready" : "Todo" }))
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
});
