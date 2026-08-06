jest.mock("yaml", () => {
	const parseScalar = (value: string): unknown => {
		const trimmed = value.trim();
		if (!trimmed) return null;
		if (
			(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
			(trimmed.startsWith("'") && trimmed.endsWith("'"))
		) {
			return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/''/g, "'");
		}
		return trimmed;
	};

	const parse = jest.fn((input: string) => {
		const result: Record<string, unknown> = {};
		let currentListKey: string | null = null;

		for (const line of input.split(/\r?\n/)) {
			const listMatch = line.match(/^\s*-\s+(.*)$/);
			if (listMatch && currentListKey) {
				(result[currentListKey] as unknown[]).push(parseScalar(listMatch[1]));
				continue;
			}

			const keyMatch = line.match(/^([^:\n]+):\s*(.*)$/);
			if (!keyMatch) continue;

			const key = keyMatch[1].trim();
			const value = keyMatch[2];
			if (!value.trim()) {
				result[key] = [];
				currentListKey = key;
				continue;
			}

			result[key] = parseScalar(value);
			currentListKey = null;
		}

		return result;
	});
	const stringify = jest.fn();

	return {
		parse,
		stringify,
		default: { parse, stringify },
	};
});

import { TFile } from "../../helpers/obsidian-runtime";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";
import { TaskService } from "../../../src/services/TaskService";
import type { TaskInfo } from "../../../src/types";

jest.mock("../../../src/utils/dateUtils", () => {
	const actual = jest.requireActual("../../../src/utils/dateUtils");
	return {
		...actual,
		getCurrentTimestamp: jest.fn(() => "2025-01-01T12:00:00Z"),
		getCurrentDateString: jest.fn(() => "2025-01-01"),
	};
});

jest.mock("../../../src/utils/filenameGenerator", () => ({
	generateTaskFilename: jest.fn((context) => context.title.toLowerCase().replace(/\s+/g, "-")),
	generateUniqueFilename: jest.fn((base) => base),
	generateOccurrenceFilename: jest.fn(
		(context, template, occurrenceDate) => `${context.title} OCC ${occurrenceDate}`
	),
}));

describe("TaskService materialized occurrences", () => {
	beforeEach(() => {
		const dateUtils = jest.requireMock("../../../src/utils/dateUtils");
		dateUtils.getCurrentDateString.mockReturnValue("2025-01-01");
	});

	function createService(tasks: Record<string, TaskInfo> = {}) {
		const frontmatterByPath = new Map<string, Record<string, unknown>>();
		const plugin = PluginFactory.createMockPlugin({
			statusManager: {
				isCompletedStatus: jest.fn((status) => status === "done"),
				getCompletedStatuses: jest.fn(() => ["done"]),
				getStatusConfig: jest.fn(),
			},
			getActiveTimeSession: jest.fn(),
			cacheManager: {
				getTaskInfo: jest.fn(async (path: string) => tasks[path] ?? null),
				getAllTasks: jest.fn(async () => Object.values(tasks)),
				updateTaskInfoInCache: jest.fn((path: string, task: TaskInfo) => {
					tasks[path] = task;
				}),
				getBlockedTaskPaths: jest.fn(() => []),
			},
		});

		plugin.settings.maintainDueDateOffsetInRecurring = true;
		plugin.settings.defaultTaskStatus = "open";
		plugin.settings.defaultTaskPriority = "normal";
		plugin.settings.useFrontmatterMarkdownLinks = false;
		plugin.app.vault.getAbstractFileByPath = jest.fn((path: string) => new TFile(path));
		plugin.app.metadataCache.fileToLinktext = jest.fn((file: TFile) =>
			file.path.replace(/\.md$/i, "")
		);
		plugin.app.metadataCache.getFirstLinkpathDest = jest.fn();
		plugin.app.fileManager.processFrontMatter = jest.fn(
			async (file: TFile, fn: (frontmatter: Record<string, unknown>) => void) => {
				const frontmatter = frontmatterByPath.get(file.path) ?? {};
				fn(frontmatter);
				frontmatterByPath.set(file.path, frontmatter);
			}
		);

		return {
			plugin,
			taskService: new TaskService(plugin),
			frontmatterByPath,
		};
	}

	function getVaultReadPaths(plugin: ReturnType<typeof createService>["plugin"]): string[] {
		return (plugin.app.vault.read as jest.Mock).mock.calls.map(
			([file]: [TFile]) => file.path
		);
	}

	it("creates occurrence notes with recurrence identity fields", async () => {
		const parent = TaskFactory.createTask({
			title: "Daily task",
			path: "Tasks/Daily task.md",
			priority: "high",
			recurrence: "DTSTART:20260601;FREQ=DAILY",
			recurrence_anchor: "scheduled",
			scheduled: "2026-06-01T09:30:00",
			due: "2026-06-02T10:45:00",
			contexts: ["office"],
			projects: ["[[Projects/Launch]]"],
			tags: ["task", "review"],
			timeEstimate: 45,
			timeEntries: [
				{
					startTime: "2026-06-01T09:30:00Z",
					endTime: "2026-06-01T10:00:00Z",
				},
			],
			reminders: [
				{
					id: "rem-1",
					type: "relative",
					relatedTo: "scheduled",
					offset: "-PT15M",
				},
			],
			details: "- [ ] Review notes",
		});
		const { taskService, plugin } = createService({ [parent.path]: parent });

		const occurrence = await taskService.materializeOccurrence(parent, "2026-06-08");

		expect(occurrence).toMatchObject({
			title: "Daily task",
			status: "open",
			priority: "high",
			scheduled: "2026-06-08T09:30:00",
			due: "2026-06-09T10:45:00",
			recurrence_parent: "[[Tasks/Daily task]]",
			occurrence_date: "2026-06-08",
			contexts: ["office"],
			projects: ["[[Projects/Launch]]"],
			timeEstimate: 45,
			reminders: parent.reminders,
			details: "- [ ] Review notes",
		});
		expect(occurrence.tags).toEqual(expect.arrayContaining(["task", "review"]));
		expect(occurrence.timeEntries).toBeUndefined();
		expect(occurrence.recurrence).toBeUndefined();
		expect(plugin.cacheManager.getAllTasks).toHaveBeenCalled();
	});

	it("uses a parent occurrence_template for occurrence note frontmatter and body", async () => {
		const parent = TaskFactory.createTask({
			title: "Weekly review",
			path: "Tasks/Weekly review.md",
			priority: "high",
			status: "waiting",
			recurrence: "DTSTART:20260601;FREQ=WEEKLY",
			scheduled: "2026-06-01T09:30:00",
			details: "Parent details",
			occurrence_template: "[[Templates/Occurrence]]",
		});
		const { taskService, plugin } = createService({ [parent.path]: parent });
		plugin.settings.taskCreationDefaults.useBodyTemplate = true;
		plugin.settings.taskCreationDefaults.bodyTemplate = "Templates/Normal.md";

		const occurrenceTemplate = new TFile("Templates/Occurrence.md");
		const normalTemplate = new TFile("Templates/Normal.md");
		plugin.app.metadataCache.getFirstLinkpathDest = jest.fn((linkpath: string) =>
			linkpath === "Templates/Occurrence" ? occurrenceTemplate : null
		);
		plugin.app.vault.getAbstractFileByPath = jest.fn((path: string) => {
			if (path === "Templates/Occurrence.md") return occurrenceTemplate;
			if (path === "Templates/Normal.md") return normalTemplate;
			return new TFile(path);
		});
		plugin.app.vault.read = jest.fn(async (file: TFile) => {
			if (file.path === "Templates/Occurrence.md") {
				return [
					"---",
					"status: in-progress",
					"priority: low",
					"review_type: weekly-occurrence",
					"---",
					"Occurrence {{title}} on {{scheduledDate}}",
					"Parent: {{parentNote}}",
				].join("\n");
			}
			return "Normal task template";
		});

		const occurrence = await taskService.materializeOccurrence(parent, "2026-06-08");

		expect(occurrence).toMatchObject({
			title: "Weekly review",
			status: "in-progress",
			priority: "low",
			recurrence_parent: "[[Tasks/Weekly review]]",
			occurrence_date: "2026-06-08",
			details:
				"Occurrence Weekly review on 2026-06-08T09:30:00\nParent: [[Tasks/Weekly review]]",
			review_type: "weekly-occurrence",
		});
		expect(getVaultReadPaths(plugin)).toContain(occurrenceTemplate.path);
		expect(getVaultReadPaths(plugin)).not.toContain(normalTemplate.path);
	});

	it("uses the global occurrence body template when the parent has no template", async () => {
		const parent = TaskFactory.createTask({
			title: "Monthly review",
			path: "Tasks/Monthly review.md",
			recurrence: "DTSTART:20260601;FREQ=MONTHLY",
			scheduled: "2026-06-01",
			details: "Parent monthly details",
		});
		const { taskService, plugin } = createService({ [parent.path]: parent });
		plugin.settings.taskCreationDefaults.useBodyTemplate = true;
		plugin.settings.taskCreationDefaults.bodyTemplate = "Templates/Normal.md";
		plugin.settings.taskCreationDefaults.useOccurrenceBodyTemplate = true;
		plugin.settings.taskCreationDefaults.occurrenceBodyTemplate = "Templates/Occurrence fallback";

		const occurrenceTemplate = new TFile("Templates/Occurrence fallback.md");
		const normalTemplate = new TFile("Templates/Normal.md");
		plugin.app.vault.getAbstractFileByPath = jest.fn((path: string) => {
			if (path === "Templates/Occurrence fallback.md") return occurrenceTemplate;
			if (path === "Templates/Normal.md") return normalTemplate;
			return new TFile(path);
		});
		plugin.app.vault.read = jest.fn(async (file: TFile) => {
			if (file.path === "Templates/Occurrence fallback.md") {
				return "Fallback occurrence body for {{title}} on {{scheduledDate}}";
			}
			return "Normal task template";
		});

		const occurrence = await taskService.materializeOccurrence(parent, "2026-07-01");

		expect(occurrence.details).toBe(
			"Fallback occurrence body for Monthly review on 2026-07-01"
		);
		expect(getVaultReadPaths(plugin)).toContain(occurrenceTemplate.path);
		expect(getVaultReadPaths(plugin)).not.toContain(normalTemplate.path);
	});

	it("keeps using the normal body template when no occurrence template is configured", async () => {
		const parent = TaskFactory.createTask({
			title: "Daily planning",
			path: "Tasks/Daily planning.md",
			recurrence: "DTSTART:20260601;FREQ=DAILY",
			scheduled: "2026-06-01",
			details: "Parent planning details",
		});
		const { taskService, plugin } = createService({ [parent.path]: parent });
		plugin.settings.taskCreationDefaults.useBodyTemplate = true;
		plugin.settings.taskCreationDefaults.bodyTemplate = "Templates/Normal.md";

		const normalTemplate = new TFile("Templates/Normal.md");
		plugin.app.vault.getAbstractFileByPath = jest.fn((path: string) =>
			path === "Templates/Normal.md" ? normalTemplate : new TFile(path)
		);
		plugin.app.vault.read = jest.fn(async () => "Normal body for {{title}}");

		const occurrence = await taskService.materializeOccurrence(parent, "2026-06-02");

		expect(occurrence.details).toBe("Normal body for Daily planning");
		expect(plugin.app.vault.read).toHaveBeenCalledWith(normalTemplate);
	});

	it("finds existing occurrence notes for a parent and target date", async () => {
		const parent = TaskFactory.createTask({
			title: "Daily task",
			path: "Tasks/Daily task.md",
			recurrence: "DTSTART:20260601;FREQ=DAILY",
			scheduled: "2026-06-01",
		});
		const occurrence = TaskFactory.createTask({
			title: "Daily task",
			path: "Tasks/Daily task 2026-06-01.md",
			recurrence_parent: "[[Tasks/Daily task]]",
			occurrence_date: "2026-06-01",
		});
		const { taskService } = createService({
			[parent.path]: parent,
			[occurrence.path]: occurrence,
		});

		await expect(taskService.findMaterializedOccurrence(parent, "2026-06-01")).resolves.toBe(
			occurrence
		);
	});

	it("completes an existing materialized occurrence for API-style recurring completion", async () => {
		const parent = TaskFactory.createTask({
			title: "Daily task",
			path: "Tasks/Daily task.md",
			recurrence: "DTSTART:20260601;FREQ=DAILY",
			scheduled: "2026-06-01",
			occurrence_materialization: "on_completion",
		});
		const occurrence = TaskFactory.createTask({
			title: "Daily task",
			path: "Tasks/Daily task 2026-06-01.md",
			status: "open",
			recurrence_parent: "[[Tasks/Daily task]]",
			occurrence_date: "2026-06-01",
		});
		const { taskService } = createService({
			[parent.path]: parent,
			[occurrence.path]: occurrence,
		});
		const toggleStatus = jest.spyOn(taskService, "toggleStatus").mockResolvedValue({
			...occurrence,
			status: "done",
		});
		const materializeOccurrence = jest.spyOn(taskService, "materializeOccurrence");

		const updated = await taskService.toggleRecurringTaskCompleteWithOccurrenceNotes(
			parent,
			new Date("2026-06-01T12:00:00Z")
		);

		expect(updated.status).toBe("done");
		expect(toggleStatus).toHaveBeenCalledWith(occurrence);
		expect(materializeOccurrence).not.toHaveBeenCalled();
	});

	it("materializes and completes an occurrence for on-completion API-style recurring completion", async () => {
		const parent = TaskFactory.createTask({
			title: "Daily task",
			path: "Tasks/Daily task.md",
			recurrence: "DTSTART:20260601;FREQ=DAILY",
			scheduled: "2026-06-01",
			complete_instances: [],
			occurrence_materialization: "on_completion",
		});
		const occurrence = TaskFactory.createTask({
			title: "Daily task",
			path: "Tasks/Daily task 2026-06-01.md",
			status: "open",
			recurrence_parent: "[[Tasks/Daily task]]",
			occurrence_date: "2026-06-01",
		});
		const { taskService } = createService({ [parent.path]: parent });
		const materializeOccurrence = jest
			.spyOn(taskService, "materializeOccurrence")
			.mockResolvedValue(occurrence);
		const toggleStatus = jest.spyOn(taskService, "toggleStatus").mockResolvedValue({
			...occurrence,
			status: "done",
		});

		const updated = await taskService.toggleRecurringTaskCompleteWithOccurrenceNotes(
			parent,
			new Date("2026-06-01T12:00:00Z")
		);

		expect(updated.status).toBe("done");
		expect(materializeOccurrence).toHaveBeenCalledWith(
			expect.objectContaining({ path: parent.path }),
			new Date("2026-06-01T12:00:00Z")
		);
		expect(toggleStatus).toHaveBeenCalledWith(occurrence);
	});

	it("keeps manual occurrence policy on the virtual recurring completion path", async () => {
		const parent = TaskFactory.createTask({
			title: "Daily task",
			path: "Tasks/Daily task.md",
			recurrence: "DTSTART:20260601;FREQ=DAILY",
			scheduled: "2026-06-01",
			complete_instances: [],
			occurrence_materialization: "manual",
		});
		const { taskService } = createService({ [parent.path]: parent });
		const virtualComplete = jest
			.spyOn(taskService, "toggleRecurringTaskComplete")
			.mockResolvedValue({
				...parent,
				complete_instances: ["2026-06-01"],
			});
		const materializeOccurrence = jest.spyOn(taskService, "materializeOccurrence");

		await taskService.toggleRecurringTaskCompleteWithOccurrenceNotes(
			parent,
			new Date("2026-06-01T12:00:00Z")
		);

		expect(virtualComplete).toHaveBeenCalledWith(
			expect.objectContaining({ path: parent.path }),
			new Date("2026-06-01T12:00:00Z")
		);
		expect(materializeOccurrence).not.toHaveBeenCalled();
	});

	it("reconciles parent instances when completing a materialized occurrence", async () => {
		const parent = TaskFactory.createTask({
			title: "Daily task",
			path: "Tasks/Daily task.md",
			recurrence: "DTSTART:20260601;FREQ=DAILY",
			scheduled: "2026-06-01",
			complete_instances: [],
			skipped_instances: ["2026-06-01"],
		});
		const occurrence = TaskFactory.createTask({
			title: "Daily task",
			path: "Tasks/Daily task 2026-06-01.md",
			status: "open",
			recurrence_parent: "[[Tasks/Daily task]]",
			occurrence_date: "2026-06-01",
			scheduled: "2026-06-01",
		});
		const { taskService, frontmatterByPath } = createService({
			[parent.path]: parent,
			[occurrence.path]: occurrence,
		});

		await taskService.updateProperty(occurrence, "status", "done");

		// completedDate records when the user actually completed the occurrence
		// (the mocked "today", 2025-01-01), while the parent's complete_instances
		// keeps tracking WHICH occurrence was fulfilled (the occurrence date).
		expect(frontmatterByPath.get(occurrence.path)).toMatchObject({
			status: "done",
			completedDate: "2025-01-01",
		});
		expect(frontmatterByPath.get(parent.path)).toMatchObject({
			complete_instances: ["2026-06-01"],
			scheduled: "2026-06-02",
		});
		expect(frontmatterByPath.get(parent.path)?.skipped_instances).toBeUndefined();
	});

	it("advances completion-anchored parents from the actual completion date", async () => {
		const dateUtils = jest.requireMock("../../../src/utils/dateUtils");
		dateUtils.getCurrentDateString.mockReturnValue("2026-07-30");
		const parent = TaskFactory.createTask({
			title: "Weekly task",
			path: "Tasks/Weekly task.md",
			recurrence: "DTSTART:20260727;FREQ=WEEKLY",
			recurrence_anchor: "completion",
			scheduled: "2026-07-27",
			complete_instances: [],
			occurrence_materialization: "on_completion",
		});
		const occurrence = TaskFactory.createTask({
			title: "Weekly task",
			path: "Tasks/Weekly task 2026-07-28.md",
			status: "open",
			recurrence_parent: "[[Tasks/Weekly task]]",
			occurrence_date: "2026-07-28",
			scheduled: "2026-07-29",
		});
		const { taskService, frontmatterByPath } = createService({
			[parent.path]: parent,
			[occurrence.path]: occurrence,
		});

		const completedOccurrence = await taskService.updateProperty(
			occurrence,
			"status",
			"done"
		);

		expect(frontmatterByPath.get(occurrence.path)).toMatchObject({
			status: "done",
			completedDate: "2026-07-30",
		});
		expect(frontmatterByPath.get(parent.path)).toMatchObject({
			complete_instances: ["2026-07-28"],
			recurrence: "DTSTART:20260730;FREQ=WEEKLY",
			scheduled: "2026-08-06",
		});

		await taskService.updateProperty(completedOccurrence, "status", "open");

		expect(frontmatterByPath.get(parent.path)).toMatchObject({
			recurrence: "DTSTART:20260730;FREQ=WEEKLY",
			scheduled: "2026-08-06",
		});
		expect(frontmatterByPath.get(parent.path)?.complete_instances).toBeUndefined();
	});

	describe("issue #2126 — occurrence filename template wiring", () => {
		const filenameGenerator = jest.requireMock("../../../src/utils/filenameGenerator");

		beforeEach(() => {
			filenameGenerator.generateOccurrenceFilename.mockClear();
			filenameGenerator.generateTaskFilename.mockClear();
		});

		it("uses the global template", async () => {
			const parent = TaskFactory.createTask({
				title: "Pay rent",
				path: "Tasks/Pay rent.md",
				recurrence: "FREQ=MONTHLY",
				scheduled: "2026-08-01",
			});
			const { taskService, plugin } = createService({ [parent.path]: parent });
			plugin.settings.occurrenceFilenameTemplate = "{{title}} — {{occurrenceDate}}";

			const occurrence = await taskService.materializeOccurrence(parent, "2026-08-01");

			expect(filenameGenerator.generateOccurrenceFilename).toHaveBeenCalledWith(
				expect.objectContaining({ title: "Pay rent" }),
				"{{title}} — {{occurrenceDate}}",
				"2026-08-01"
			);
			expect(filenameGenerator.generateTaskFilename).not.toHaveBeenCalled();
			expect(occurrence.path).toBe("Tasks/Pay rent OCC 2026-08-01.md");
		});

		it("parent frontmatter property overrides the global template", async () => {
			const parent = TaskFactory.createTask({
				title: "Weekly review",
				path: "Tasks/Weekly review.md",
				recurrence: "FREQ=WEEKLY",
				scheduled: "2026-08-03",
			});
			const { taskService, plugin } = createService({ [parent.path]: parent });
			plugin.settings.occurrenceFilenameTemplate = "{{title}} — {{occurrenceDate}}";
			plugin.settings.occurrenceFilenameTemplateProperty = "occurrenceFilenameTemplate";
			// the harness resolves the parent frontmatter via metadataCache.getFileCache —
			// override it so the parent note carries the per-task template override
			plugin.app.metadataCache.getFileCache = jest.fn((file: { path: string }) =>
				file.path === "Tasks/Weekly review.md"
					? { frontmatter: { occurrenceFilenameTemplate: "{{title}} ({{occurrenceWeek}})" } }
					: { frontmatter: {} }
			);

			await taskService.materializeOccurrence(parent, "2026-08-03");

			expect(filenameGenerator.generateOccurrenceFilename).toHaveBeenCalledWith(
				expect.anything(),
				"{{title}} ({{occurrenceWeek}})",
				"2026-08-03"
			);
		});

		it("empty template preserves legacy filename behavior", async () => {
			const parent = TaskFactory.createTask({
				title: "Daily task",
				path: "Tasks/Daily task.md",
				recurrence: "FREQ=DAILY",
				scheduled: "2026-08-01",
			});
			const { taskService, plugin } = createService({ [parent.path]: parent });
			plugin.settings.occurrenceFilenameTemplate = "";

			await taskService.materializeOccurrence(parent, "2026-08-01");

			expect(filenameGenerator.generateOccurrenceFilename).not.toHaveBeenCalled();
			expect(filenameGenerator.generateTaskFilename).toHaveBeenCalled();
		});
	});

	it("does not advance scheduled-anchored parents before a rescheduled occurrence", async () => {
		const dateUtils = jest.requireMock("../../../src/utils/dateUtils");
		dateUtils.getCurrentDateString.mockReturnValue("2026-01-01");
		const parent = TaskFactory.createTask({
			title: "Weekly task",
			path: "Tasks/Weekly task.md",
			recurrence: "DTSTART:20260101;FREQ=WEEKLY",
			recurrence_anchor: "scheduled",
			scheduled: "2026-01-01",
			complete_instances: [],
		});
		const occurrence = TaskFactory.createTask({
			title: "Weekly task",
			path: "Tasks/Weekly task 2026-01-01.md",
			status: "open",
			recurrence_parent: "[[Tasks/Weekly task]]",
			occurrence_date: "2026-01-01",
			scheduled: "2026-01-10",
		});
		const { taskService, frontmatterByPath } = createService({
			[parent.path]: parent,
			[occurrence.path]: occurrence,
		});

		await taskService.updateProperty(occurrence, "status", "done");

		expect(frontmatterByPath.get(occurrence.path)).toMatchObject({
			status: "done",
			completedDate: "2026-01-01",
		});
		expect(frontmatterByPath.get(parent.path)).toMatchObject({
			complete_instances: ["2026-01-01"],
			recurrence: "DTSTART:20260101;FREQ=WEEKLY",
			scheduled: "2026-01-15",
		});
	});
});
