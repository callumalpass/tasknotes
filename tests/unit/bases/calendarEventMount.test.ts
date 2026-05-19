import {
	decorateCalendarIcsEventElement,
	enrichCalendarListTaskInfo,
	mountCalendarListEventCard,
} from "../../../src/bases/calendarEventMount";
import type { TaskInfo } from "../../../src/types";

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

function createPlugin(overrides: Record<string, unknown> = {}) {
	return {
		i18n: {
			translate: (key: string) =>
				key === "modals.icsEventInfo.relatedNotesHeading" ? "Related notes" : key,
		},
		calendarProviderRegistry: {
			findProviderForEvent: jest.fn(() => ({ providerName: "google" })),
		},
		settings: {
			calendarViewSettings: {
				timeFormat: "HH:mm",
			},
		},
		...overrides,
	} as any;
}

function createEventMountArg({
	viewType = "listWeek",
	start = new Date("2026-05-19T10:30:00"),
	extendedProps = {},
}: {
	viewType?: string;
	start?: Date | null;
	extendedProps?: Record<string, unknown>;
}) {
	const el = document.createElement("tr");
	el.className = "fc-event fc-event-start fc-event-end";
	el.innerHTML = "<td>default</td>";
	return {
		el,
		view: {
			type: viewType,
		},
		event: {
			start,
			extendedProps,
		},
	} as any;
}

describe("calendarEventMount", () => {
	it("enriches list-view task cards with Bases formula and file values", () => {
		const getValue = jest.fn((propertyId: string) => {
			if (propertyId === "file.ctime") return { data: "2026-05-18T00:00:00" };
			if (propertyId === "file.mtime") return { data: "2026-05-19T00:00:00" };
			return { data: `value:${propertyId}` };
		});
		const task = createTask();

		const enriched = enrichCalendarListTaskInfo({
			taskInfo: task,
			basesEntry: { getValue },
			visibleProperties: ["formula.score", "title"],
		});

		expect(enriched).not.toBe(task);
		expect(enriched.basesData).toEqual({ getValue });
		expect(enriched.dateCreated).toBe("2026-05-18T00:00:00");
		expect(enriched.dateModified).toBe("2026-05-19T00:00:00");
		expect(getValue).toHaveBeenCalledWith("formula.score");
		expect(getValue).toHaveBeenCalledWith("file.ctime");
		expect(getValue).toHaveBeenCalledWith("file.mtime");
	});

	it("does not overwrite existing task file timestamps during enrichment", () => {
		const getValue = jest.fn(() => ({ data: "from-bases" }));
		const enriched = enrichCalendarListTaskInfo({
			taskInfo: createTask({
				dateCreated: "existing-created",
				dateModified: "existing-modified",
			}),
			basesEntry: { getValue },
			visibleProperties: [],
		});

		expect(enriched.dateCreated).toBe("existing-created");
		expect(enriched.dateModified).toBe("existing-modified");
		expect(getValue).not.toHaveBeenCalledWith("file.ctime");
		expect(getValue).not.toHaveBeenCalledWith("file.mtime");
	});

	it("decorates provider calendar events with related-note state in grid views", () => {
		const plugin = createPlugin();
		const element = document.createElement("div");
		const title = element.createDiv({ cls: "fc-event-title" });

		decorateCalendarIcsEventElement({
			element,
			viewType: "dayGridMonth",
			icsEvent: { id: "event-1", title: "Event", start: "2026-05-19" } as any,
			relatedNoteCount: 2,
			plugin,
		});

		expect(element.getAttribute("data-ics-event")).toBe("true");
		expect(element.classList.contains("fc-ics-event")).toBe(true);
		expect(element.classList.contains("fc-event--has-related-note")).toBe(true);
		expect(element.dataset.relatedNoteCount).toBe("2");
		expect(element.querySelector(".fc-event-provider-icon")).not.toBeNull();
		const indicator = title.querySelector<HTMLElement>(".ics-related-note-indicator");
		expect(indicator?.dataset.relatedNoteCount).toBe("2");
		expect(indicator?.getAttribute("aria-label")).toBe("Related notes: 2");
	});

	it("skips provider icons for list-view provider events", () => {
		const element = document.createElement("div");

		decorateCalendarIcsEventElement({
			element,
			viewType: "listWeek",
			icsEvent: { id: "event-1", title: "Event", start: "2026-05-19" } as any,
			relatedNoteCount: 1,
			plugin: createPlugin(),
		});

		expect(element.classList.contains("fc-ics-event")).toBe(true);
		expect(element.querySelector(".fc-event-provider-icon")).toBeNull();
	});

	it("mounts a list-view task card with enriched task data", () => {
		const task = createTask();
		const arg = createEventMountArg({
			extendedProps: {
				taskInfo: task,
				eventType: "scheduled",
			},
		});
		const basesEntry = { getValue: jest.fn(() => ({ data: "2026-05-19T00:00:00" })) };
		const createTaskCard = jest.fn((enrichedTask: TaskInfo) => {
			const card = document.createElement("div");
			card.className = "task-card";
			card.dataset.path = enrichedTask.path;
			card.dataset.created = enrichedTask.dateCreated;
			return card;
		});

		const mounted = mountCalendarListEventCard({
			arg,
			plugin: createPlugin(),
			visibleProperties: ["formula.score"],
			basesEntryByPath: new Map([[task.path, basesEntry]]),
			buildTaskCardOptions: ({ targetDate }) => ({ targetDate }) as any,
			factories: {
				createTaskCard: createTaskCard as any,
			},
		});

		expect(mounted).toBe(true);
		expect(arg.el.getAttribute("data-task-path")).toBe("Tasks/task.md");
		expect(arg.el.classList.contains("fc-list-task-card")).toBe(true);
		expect(arg.el.classList.contains("fc-event")).toBe(false);
		expect(arg.el.querySelector("td.fc-list-card-content")?.getAttribute("colspan")).toBe(
			"3"
		);
		expect(arg.el.querySelector(".task-card")).not.toBeNull();
		expect(createTaskCard.mock.calls[0][0].basesData).toBe(basesEntry);
		expect(createTaskCard.mock.calls[0][0].dateCreated).toBe("2026-05-19T00:00:00");
	});

	it("leaves unknown list events on the default rendering path", () => {
		const arg = createEventMountArg({
			extendedProps: {
				eventType: "unknown",
			},
		});

		const mounted = mountCalendarListEventCard({
			arg,
			plugin: createPlugin(),
			visibleProperties: [],
			basesEntryByPath: new Map(),
			buildTaskCardOptions: ({ targetDate }) => ({ targetDate }) as any,
		});

		expect(mounted).toBe(false);
		expect(arg.el.classList.contains("fc-event-default-list")).toBe(true);
	});
});
