/**
 * Issue #396: Recurring tasks completed after scheduled date do not process
 * into next available recurrence.
 *
 * Root cause: toggleRecurringTaskComplete defaults to getTodayLocal() when no
 * explicit date is passed. For scheduled-anchor recurring tasks, this records
 * today in complete_instances instead of the scheduled occurrence date.
 *
 * Fix: default to task.scheduled (via getDatePart) for scheduled-anchor tasks.
 */

import { TFile } from "obsidian";
import { TaskService } from "../../../src/services/TaskService";
import { TaskInfo } from "../../../src/types";
import { TaskFactory } from "../../helpers/mock-factories";
import { getTodayLocal } from "../../../src/utils/dateUtils";

// Mock dateUtils so we can control "today"
jest.mock("../../../src/utils/dateUtils", () => ({
    ...jest.requireActual("../../../src/utils/dateUtils"),
    getTodayLocal: jest.fn(),
}));

const mockGetTodayLocal = getTodayLocal as jest.MockedFunction<typeof getTodayLocal>;

describe("Issue #396 — recurring late completion records wrong date", () => {
    let taskService: TaskService;
    let writtenFrontmatter: Record<string, any>;

    function buildMockPlugin(task: TaskInfo) {
        writtenFrontmatter = {};
        return {
            app: {
                vault: {
                    getAbstractFileByPath: jest.fn().mockReturnValue(new TFile(task.path)),
                    modify: jest.fn(),
                    read: jest.fn().mockResolvedValue(""),
                },
                workspace: { getActiveFile: jest.fn() },
                metadataCache: { getCache: jest.fn() },
                fileManager: {
                    processFrontMatter: jest.fn().mockImplementation((_file: any, fn: any) => {
                        // Start with empty frontmatter like Obsidian does
                        const fm: Record<string, any> = {};
                        fn(fm);
                        Object.assign(writtenFrontmatter, fm);
                        return Promise.resolve();
                    }),
                },
            },
            settings: {
                taskFolder: "tasks",
                fieldMapping: {},
                defaultTaskStatus: "open",
                taskTag: "#task",
                storeTitleInFilename: false,
                resetCheckboxesOnRecurrence: false,
            },
            statusManager: {
                isCompletedStatus: jest.fn((s: string) => s === "done"),
                getCompletedStatuses: jest.fn(() => ["done"]),
            },
            // Return field names as-is — the test checks the mapped field name
            fieldMapper: { toUserField: jest.fn((f: string) => f) },
            cacheManager: {
                getTaskInfo: jest.fn().mockResolvedValue(task),
                updateTaskInfoInCache: jest.fn(),
                waitForFreshTaskData: jest.fn().mockResolvedValue(undefined),
            },
            emitter: { trigger: jest.fn() },
        } as any;
    }

    it("scheduled-anchor task completed late records the scheduled date, not today", async () => {
        // Saturday task, completed on Sunday
        mockGetTodayLocal.mockReturnValue(new Date("2026-04-05T12:00:00")); // Sunday

        const saturdayTask = TaskFactory.createTask({
            path: "tasks/test.md",
            title: "Weekly task",
            recurrence: "FREQ=WEEKLY;BYDAY=SA",
            recurrence_anchor: "scheduled",
            scheduled: "2026-04-04", // Saturday
            complete_instances: [],
        });

        const plugin = buildMockPlugin(saturdayTask);
        taskService = new TaskService(plugin);

        // Call WITHOUT explicit date — should default to scheduled, not today
        await taskService.toggleRecurringTaskComplete(saturdayTask);

        // completeInstances is the mapped field name (toUserField returns as-is)
        expect(writtenFrontmatter.completeInstances).toContain("2026-04-04");
        expect(writtenFrontmatter.completeInstances).not.toContain("2026-04-05");
    });

    it("completion-anchor task completed late records today, not the scheduled date", async () => {
        mockGetTodayLocal.mockReturnValue(new Date("2026-04-05T12:00:00")); // Sunday

        const completionTask = TaskFactory.createTask({
            path: "tasks/test.md",
            title: "Completion-anchor task",
            recurrence: "FREQ=WEEKLY;BYDAY=SA",
            recurrence_anchor: "completion",
            scheduled: "2026-04-04", // Saturday
            complete_instances: [],
        });

        const plugin = buildMockPlugin(completionTask);
        taskService = new TaskService(plugin);

        await taskService.toggleRecurringTaskComplete(completionTask);

        // completion-anchor should use today (Sunday), not scheduled (Saturday)
        expect(writtenFrontmatter.completeInstances).toContain("2026-04-05");
        expect(writtenFrontmatter.completeInstances).not.toContain("2026-04-04");
    });

    it("undefined recurrence_anchor defaults to using the scheduled date", async () => {
        mockGetTodayLocal.mockReturnValue(new Date("2026-04-05T12:00:00")); // Sunday

        const defaultTask = TaskFactory.createTask({
            path: "tasks/test.md",
            title: "Default anchor task",
            recurrence: "FREQ=WEEKLY;BYDAY=SA",
            scheduled: "2026-04-04", // Saturday
            complete_instances: [],
        });
        // Ensure recurrence_anchor is undefined (default = scheduled)
        delete (defaultTask as any).recurrence_anchor;

        const plugin = buildMockPlugin(defaultTask);
        taskService = new TaskService(plugin);

        await taskService.toggleRecurringTaskComplete(defaultTask);

        expect(writtenFrontmatter.completeInstances).toContain("2026-04-04");
        expect(writtenFrontmatter.completeInstances).not.toContain("2026-04-05");
    });
});
