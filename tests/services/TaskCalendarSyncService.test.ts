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
                    getName: jest.fn().mockReturnValue("Martin OS"),
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
            path: "1 Tasks/Tasks/Download first personal data export batch.md",
            title: "Download first personal data export batch",
            status: "ready",
            priority: "2-high",
            scheduled: "2026-04-29",
            timeEstimate: 180,
            projects: [
                "[[0 Collect personal data exports for vault intelligence|Collect personal data exports for vault intelligence]]",
                "[[Projects/Nested Project.md]]",
                "[Markdown Project](Projects/Markdown%20Project.md)",
            ],
            contexts: ["[[People/Martin Ball|Martin Ball]]", "admin"],
        } as TaskInfo);

        expect(description).toContain("Priority: High");
        expect(description).toContain("Status: Ready");
        expect(description).toContain("Scheduled: 2026-04-29");
        expect(description).toContain("Time Estimate: 3h 0m");
        expect(description).toContain("Contexts: @Martin Ball, @admin");
        expect(description).toContain(
            "Projects: Collect personal data exports for vault intelligence, Nested Project, Markdown Project"
        );
        expect(description).toContain(
            "Open in Obsidian: obsidian://open?vault=Martin%20OS&file=1%20Tasks%2FTasks%2FDownload%20first%20personal%20data%20export%20batch.md"
        );
        expect(description).not.toContain("[[");
        expect(description).not.toContain("]]");
        expect(description).not.toContain("<a ");
        expect(description).not.toContain("</a>");
        expect(description).not.toContain("](");
    });
});
