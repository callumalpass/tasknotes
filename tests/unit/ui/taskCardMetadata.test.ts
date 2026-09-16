import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import {
	renderTaskCardMetadata,
	renderTaskCardMetadataLine,
} from "../../../src/ui/taskCardMetadata";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Task",
		status: "open",
		priority: "normal",
		path: "Tasks/task.md",
		archived: false,
		...overrides,
	};
}

function createPlugin(): TaskNotesPlugin {
	return {
		settings: {
			calendarViewSettings: {
				timeFormat: "24",
			},
		},
		app: {
			metadataCache: {
				getFirstLinkpathDest: jest.fn(() => null),
				getCache: jest.fn(() => ({ frontmatter: {} })),
			},
			vault: {
				getAbstractFileByPath: jest.fn(() => null),
			},
			workspace: {
				openLinkText: jest.fn(),
			},
		},
		fieldMapper: {
			isPropertyForField: jest.fn(() => false),
			lookupMappingKey: jest.fn((propertyId: string) => propertyId),
			toUserField: jest.fn((field: string) => field),
		},
		i18n: {
			translate: jest.fn((key: string, vars?: Record<string, string | number>) => {
				const translations: Record<string, string> = {
					"ui.taskCard.blockedBadge": "Blocked",
					"ui.taskCard.blockedBadgeTooltip": "This task is blocked",
					"ui.taskCard.blockingBadge": "Blocking",
					"ui.taskCard.blockingBadgeTooltip": "This task is blocking another task",
					"ui.taskCard.googleCalendarSyncTooltip": "Synced to Google Calendar",
					"ui.taskCard.labels.due": "Due",
					"ui.taskCard.labels.scheduled": "Scheduled",
				};
				if (translations[key]) {
					return translations[key];
				}
				if (vars) {
					return `${key} ${Object.values(vars).join(" ")}`;
				}
				return key;
			}),
		},
		statusManager: {
			isCompletedStatus: jest.fn((status: string) => status === "done"),
		},
		updateTaskProperty: jest.fn(),
	} as unknown as TaskNotesPlugin;
}

function createMetadataHost() {
	const card = document.createElement("div");
	card.className = "task-card";
	const metadataLine = document.createElement("div");
	metadataLine.className = "task-card__metadata";
	card.appendChild(metadataLine);
	document.body.appendChild(card);
	return { card, metadataLine };
}

function renderMetadataForTask(
	task: TaskInfo,
	visibleProperties: string[]
): { metadataLine: HTMLElement; elements: HTMLElement[] } {
	const plugin = createPlugin();
	const { card, metadataLine } = createMetadataHost();
	const elements = renderTaskCardMetadata({
		metadataLine,
		card,
		task,
		plugin,
		visibleProperties,
		onBlockedByToggle: jest.fn(),
	});

	return { metadataLine, elements };
}

function getDateMetadata(metadataLine: HTMLElement, dateType: "due" | "scheduled"): HTMLElement {
	const element = metadataLine.querySelector<HTMLElement>(
		`.task-card__metadata-date--${dateType}`
	);
	if (!element) {
		throw new Error(`Missing ${dateType} date metadata`);
	}
	return element;
}

describe("taskCardMetadata", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	describe("date metadata state classes", () => {
		beforeEach(() => {
			jest.useFakeTimers();
			jest.setSystemTime(new Date("2026-08-12T12:00:00"));
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it.each([
			{
				due: "2026-08-11",
				expectedClass: "task-card__metadata-date--overdue",
				absentClasses: [
					"task-card__metadata-date--today",
					"task-card__metadata-date--future",
				],
			},
			{
				due: "2026-08-12",
				expectedClass: "task-card__metadata-date--today",
				absentClasses: [
					"task-card__metadata-date--overdue",
					"task-card__metadata-date--future",
				],
			},
			{
				due: "2026-08-13",
				expectedClass: "task-card__metadata-date--future",
				absentClasses: [
					"task-card__metadata-date--overdue",
					"task-card__metadata-date--today",
				],
			},
		])("adds due metadata state class for $due", ({ due, expectedClass, absentClasses }) => {
			const { metadataLine } = renderMetadataForTask(createTask({ due }), ["due"]);
			const dueElement = getDateMetadata(metadataLine, "due");

			expect(dueElement.classList.contains("task-card__metadata-date")).toBe(true);
			expect(dueElement.classList.contains(expectedClass)).toBe(true);
			for (const absentClass of absentClasses) {
				expect(dueElement.classList.contains(absentClass)).toBe(false);
			}
		});

		it.each([
			{
				scheduled: "2026-08-11",
				expectedClass: "task-card__metadata-date--past",
				absentClasses: [
					"task-card__metadata-date--today",
					"task-card__metadata-date--future",
				],
			},
			{
				scheduled: "2026-08-12",
				expectedClass: "task-card__metadata-date--today",
				absentClasses: [
					"task-card__metadata-date--past",
					"task-card__metadata-date--future",
				],
			},
			{
				scheduled: "2026-08-13",
				expectedClass: "task-card__metadata-date--future",
				absentClasses: [
					"task-card__metadata-date--past",
					"task-card__metadata-date--today",
				],
			},
		])(
			"adds scheduled metadata state class for $scheduled",
			({ scheduled, expectedClass, absentClasses }) => {
				const { metadataLine } = renderMetadataForTask(createTask({ scheduled }), [
					"scheduled",
				]);
				const scheduledElement = getDateMetadata(metadataLine, "scheduled");

				expect(scheduledElement.classList.contains("task-card__metadata-date")).toBe(true);
				expect(scheduledElement.classList.contains(expectedClass)).toBe(true);
				for (const absentClass of absentClasses) {
					expect(scheduledElement.classList.contains(absentClass)).toBe(false);
				}
			}
		);

		it("does not classify a completed past due date as future when overdue styling is hidden", () => {
			const { metadataLine } = renderMetadataForTask(
				createTask({
					due: "2026-08-11",
					status: "done",
				}),
				["due"]
			);
			const dueElement = getDateMetadata(metadataLine, "due");

			expect(dueElement.classList.contains("task-card__metadata-date--overdue")).toBe(false);
			expect(dueElement.classList.contains("task-card__metadata-date--future")).toBe(false);
		});
	});

	it("renders blocked metadata as an interactive blocked-by expansion control", () => {
		const plugin = createPlugin();
		const { card, metadataLine } = createMetadataHost();
		const onBlockedByToggle = jest.fn();
		const parentClick = jest.fn();
		card.addEventListener("click", parentClick);

		const elements = renderTaskCardMetadata({
			metadataLine,
			card,
			task: createTask({
				isBlocked: true,
				blockedBy: [{ uid: "Tasks/blocker.md", reltype: "FINISHTOSTART" }],
			}),
			plugin,
			visibleProperties: ["blocked"],
			onBlockedByToggle,
		});

		const blockedPill = metadataLine.querySelector<HTMLElement>(
			".task-card__metadata-pill--blocked"
		);
		expect(elements).toEqual([blockedPill]);
		expect(blockedPill?.textContent).toBe("Blocked (1)");
		expect(blockedPill?.getAttribute("role")).toBe("button");
		expect(blockedPill?.getAttribute("aria-expanded")).toBe("false");

		blockedPill?.click();

		expect(onBlockedByToggle).toHaveBeenCalledTimes(1);
		expect(parentClick).not.toHaveBeenCalled();
	});

	it("renders blocking and Google Calendar sync pills from the same metadata path", () => {
		const plugin = createPlugin();
		const { card, metadataLine } = createMetadataHost();

		const elements = renderTaskCardMetadata({
			metadataLine,
			card,
			task: createTask({
				isBlocking: true,
				blocking: ["Tasks/dependent-a.md", "Tasks/dependent-b.md"],
				googleCalendarEventId: "gcal-123",
			}),
			plugin,
			visibleProperties: ["blocking", "googleCalendarSync"],
			onBlockedByToggle: jest.fn(),
		});

		expect(elements).toHaveLength(2);
		expect(metadataLine.querySelector(".task-card__metadata-pill--blocking")?.textContent).toBe(
			"Blocking (2)"
		);
		expect(
			metadataLine.querySelector(".task-card__metadata-pill--google-calendar")
		).not.toBeNull();
		expect(metadataLine.textContent).not.toContain("Tasks/task.md");
	});

	it("renders materialized occurrence identity as an interactive parent control", () => {
		const plugin = createPlugin();
		const { card, metadataLine } = createMetadataHost();
		const parentClick = jest.fn();
		card.addEventListener("click", parentClick);

		const elements = renderTaskCardMetadata({
			metadataLine,
			card,
			task: createTask({
				recurrence_parent: "[[Tasks/Daily task]]",
				occurrence_date: "2026-06-01",
			}),
			plugin,
			visibleProperties: [],
			onBlockedByToggle: jest.fn(),
		});

		const occurrencePill = metadataLine.querySelector<HTMLElement>(
			".task-card__metadata-pill--occurrence"
		);
		expect(elements).toEqual([occurrencePill]);
		expect(occurrencePill?.textContent).toContain("Occurrence:");
		expect(occurrencePill?.getAttribute("role")).toBe("button");

		occurrencePill?.click();

		expect(plugin.app.workspace.openLinkText).toHaveBeenCalledWith(
			"Tasks/Daily task",
			"Tasks/task.md",
			false
		);
		expect(parentClick).not.toHaveBeenCalled();
	});

	it("clears stale metadata and hides the line when no configured property renders", () => {
		const plugin = createPlugin();
		const { card, metadataLine } = createMetadataHost();
		metadataLine.textContent = "stale metadata";

		const elements = renderTaskCardMetadata({
			metadataLine,
			card,
			task: createTask(),
			plugin,
			visibleProperties: ["googleCalendarSync"],
			onBlockedByToggle: jest.fn(),
		});

		expect(elements).toEqual([]);
		expect(metadataLine.textContent).toBe("");
		expect(metadataLine.style.display).toBe("none");
	});

	it("wires blocked metadata toggles through the shared metadata-line adapter", () => {
		const plugin = createPlugin();
		const { card, metadataLine } = createMetadataHost();
		const toggleBlockedByTasks = jest.fn();

		renderTaskCardMetadataLine({
			metadataLine,
			card,
			task: createTask({
				isBlocked: true,
				blockedBy: [{ uid: "Tasks/blocker.md", reltype: "FINISHTOSTART" }],
			}),
			plugin,
			visibleProperties: ["blocked"],
			handlers: {
				toggleBlockedByTasks,
			},
		});

		metadataLine.querySelector<HTMLElement>(".task-card__metadata-pill--blocked")?.click();

		expect(toggleBlockedByTasks).toHaveBeenCalledWith(card, expect.any(Object), true);
	});
});
