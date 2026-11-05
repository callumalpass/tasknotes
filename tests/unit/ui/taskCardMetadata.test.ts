import { observeTranslation as mockObserveTranslation, englishText as mockEnglishText, conceptDescriptor as mockConceptDescriptor } from "../../helpers/real-i18n";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import {
	renderTaskCardMetadata,
	renderTaskCardMetadataLine,
	cleanupTaskCardMetadata,
	fitTaskCardMetadata,
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
			translate: mockObserveTranslation(),
		},
		statusManager: {
        getAllStatuses: jest.fn(() => [{ value: "open", label: "Open", color: "#666666", isCompleted: false, order: 0 }, { value: "done", label: "Done", color: "#00ff00", isCompleted: true, order: 1 }]),
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
	it("never paints a zero overflow count after final geometry fits all metadata", () => {
		const original = window.ResizeObserver;
		let resize = () => {};
		window.ResizeObserver = class {
			constructor(callback: () => void) { resize = callback; }
			observe() {}
			unobserve() {}
			disconnect() {}
		} as unknown as typeof ResizeObserver;
		try {
			const { metadataLine } = createMetadataHost();
			Object.defineProperty(metadataLine, "clientWidth", { value: 200 });
			const values = metadataLine.createSpan();
			const chip = values.createSpan({ text: "Studio" });
			let measurements = 0;
			metadataLine.getBoundingClientRect = () => ({ right: 200 }) as DOMRect;
			values.getBoundingClientRect = () => ({ right: 200 }) as DOMRect;
			chip.getBoundingClientRect = () => ({ right: measurements++ === 0 ? 300 : 100 }) as DOMRect;
			fitTaskCardMetadata(values, metadataLine);
			resize();
			const overflow = metadataLine.querySelector<HTMLElement>(".task-card__metadata-overflow")!;
			expect(overflow.textContent).toBe("");
			expect(overflow.hidden).toBe(true);
			resize();
			expect(overflow.hidden).toBe(true);
		} finally {
			cleanupTaskCardMetadata(document.querySelector(".task-card__metadata") as HTMLElement);
			window.ResizeObserver = original;
		}
	});
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("keeps due before scheduled when only one date fits and summarizes the hidden date", () => {
		const original = window.ResizeObserver;
		let resize = () => {};
		window.ResizeObserver = class {
			constructor(callback: () => void) { resize = callback; }
			observe() {}
			unobserve() {}
			disconnect() {}
		} as unknown as typeof ResizeObserver;
		try {
			const { metadataLine } = createMetadataHost();
			Object.defineProperty(metadataLine, "clientWidth", { value: 100 });
			const values = metadataLine.createSpan();
			const scheduled = metadataLine.createSpan({ cls: "task-card__date-slot" });
			scheduled.createSpan({ attr: { "aria-label": "Scheduled: tomorrow" } });
			const due = metadataLine.createSpan({ cls: "task-card__date-slot" });
			due.createSpan({ text: "Today" });
			metadataLine.getBoundingClientRect = () => ({ right: 100 }) as DOMRect;
			scheduled.getBoundingClientRect = () => ({ right: 80 }) as DOMRect;
			due.getBoundingClientRect = () => ({ right: scheduled.hidden ? 80 : 140 }) as DOMRect;
			fitTaskCardMetadata(values, metadataLine);
			resize();
			expect(scheduled.hidden).toBe(true);
			expect(due.hidden).toBe(false);
			expect(values.hidden).toBe(true);
			expect(metadataLine.querySelector(".task-card__metadata-overflow")?.getAttribute("aria-label")).toBe("Scheduled: tomorrow");
		} finally {
			cleanupTaskCardMetadata(document.querySelector(".task-card__metadata") as HTMLElement);
			window.ResizeObserver = original;
		}
	});

	it("removes the empty values gap after rejecting a chip so both dates fit", () => {
		const original = window.ResizeObserver;
		let resize = () => {};
		const observe = jest.fn();
		window.ResizeObserver = class {
			constructor(callback: () => void) { resize = callback; }
			observe = observe;
			unobserve() {}
			disconnect() {}
		} as unknown as typeof ResizeObserver;
		try {
			const { metadataLine } = createMetadataHost();
			Object.defineProperty(metadataLine, "clientWidth", { value: 250 });
			const values = metadataLine.createSpan();
			const chip = values.createSpan({ cls: "task-card__metadata-property", text: "Long project" });
			const scheduled = metadataLine.createSpan({ cls: "task-card__date-slot", text: "Today 10:00" });
			const due = metadataLine.createSpan({ cls: "task-card__date-slot", text: "Today 14:00" });
			metadataLine.getBoundingClientRect = () => ({ right: 250 }) as DOMRect;
			values.getBoundingClientRect = () => ({ right: 50 }) as DOMRect;
			chip.getBoundingClientRect = () => ({ right: 400 }) as DOMRect;
			scheduled.getBoundingClientRect = () => ({ right: 100 }) as DOMRect;
			due.getBoundingClientRect = () => ({ right: values.hidden ? 200 : 260 }) as DOMRect;
			fitTaskCardMetadata(values, metadataLine);
			resize();
			expect(chip.hidden).toBe(true);
			expect(values.hidden).toBe(true);
			expect(observe).toHaveBeenCalledWith(values);
			expect(observe).toHaveBeenCalledWith(metadataLine);
			expect(scheduled.hidden).toBe(false);
			expect(due.hidden).toBe(false);
		} finally {
			cleanupTaskCardMetadata(document.querySelector(".task-card__metadata") as HTMLElement);
			window.ResizeObserver = original;
		}
	});

	it("disconnects overflow observers on rerender, removal and explicit cleanup", () => {
		const original = window.ResizeObserver;
		const callbacks: Array<() => void> = [];
		const disconnect = jest.fn();
		window.ResizeObserver = class {
			constructor(callback: () => void) { callbacks.push(callback); }
			observe() {}
			unobserve() {}
			disconnect = disconnect;
		} as unknown as typeof ResizeObserver;
		try {
			const { card, metadataLine } = createMetadataHost();
			const config = { card, metadataLine, task: createTask(), plugin: createPlugin(), visibleProperties: ["tags"], onBlockedByToggle: jest.fn() };
			renderTaskCardMetadata(config);
			renderTaskCardMetadata(config);
			expect(disconnect).toHaveBeenCalledTimes(1);
			card.remove();
			callbacks[1]();
			expect(disconnect).toHaveBeenCalledTimes(2);
			cleanupTaskCardMetadata(metadataLine);
			expect(disconnect).toHaveBeenCalledTimes(2);
		} finally {
			window.ResizeObserver = original;
		}
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

		it.each([
			{ state: "unresolved", instances: {}, past: true },
			{ state: "completed", instances: { complete_instances: ["2026-08-05"] }, past: false },
			{ state: "skipped", instances: { skipped_instances: ["2026-08-05"] }, past: false },
		])("classifies a past occurrence by its own $state state", ({ instances, past }) => {
			const { card, metadataLine } = createMetadataHost();

			renderTaskCardMetadata({
				metadataLine,
				card,
				task: createTask({ scheduled: "2026-08-19", ...instances }),
				plugin: createPlugin(),
				visibleProperties: ["scheduled"],
				propertyOptions: { occurrenceScheduled: "2026-08-05" },
				onBlockedByToggle: jest.fn(),
			});

			expect(
				getDateMetadata(metadataLine, "scheduled").classList.contains(
					"task-card__metadata-date--past"
				)
			).toBe(past);
		});

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

	it("shows an occurrence's own date read-only instead of the series' date controls", () => {
		const plugin = createPlugin();
		const { card, metadataLine } = createMetadataHost();

		renderTaskCardMetadata({
			metadataLine,
			card,
			task: createTask({ scheduled: "2026-11-08", due: "2026-11-10" }),
			plugin,
			visibleProperties: ["scheduled", "due"],
			propertyOptions: { occurrenceScheduled: "2026-11-15" },
			onBlockedByToggle: jest.fn(),
		});

		const scheduled = getDateMetadata(metadataLine, "scheduled");
		expect(scheduled.textContent).toContain("Nov 15");
		expect(scheduled.dataset.tnAction).toBeUndefined();
		expect(scheduled.getAttribute("role")).toBeNull();
		expect(metadataLine.querySelector(".task-card__metadata-date--due")).toBeNull();
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
