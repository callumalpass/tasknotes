import { observeTranslation as mockObserveTranslation, englishText as mockEnglishText, conceptDescriptor as mockConceptDescriptor } from "../../helpers/real-i18n";
import { msg } from "@lingui/core/macro";
import {
	decorateCalendarIcsEventElement,
	createCalendarListEventCard,
	enrichCalendarListTaskInfo,
} from "../../../src/bases/calendarEventMount";
import type { CalendarEventApi } from "../../../src/bases/calendarEngine";
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
			translate: mockObserveTranslation(),
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

function createEvent(extendedProps: Record<string, unknown>): CalendarEventApi {
	return {
		id: "event",
		title: "Event",
		start: new Date("2026-05-19T10:30:00"),
		end: null,
		allDay: false,
		extendedProps: extendedProps as CalendarEventApi["extendedProps"],
	};
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
		const title = element.createDiv({ cls: "tnc-item-title" });

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
		expect(indicator?.getAttribute("aria-label")).toBe("Related notes & tasks: 2");
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

	it("renders a list-view task card with enriched task data", () => {
		const task = createTask();
		const basesEntry = { getValue: jest.fn(() => ({ data: "2026-05-19T00:00:00" })) };
		const createTaskCard = jest.fn(() => document.createElement("div"));
		const buildTaskCardOptions = jest.fn((options) => options as any);

		const card = createCalendarListEventCard({
			event: createEvent({ taskInfo: task, eventType: "scheduled" }),
			plugin: createPlugin(),
			visibleProperties: ["formula.score"],
			basesEntryByPath: new Map([[task.path, basesEntry]]),
			buildTaskCardOptions,
			factories: { createTaskCard: createTaskCard as any },
		});

		expect(card).toBe(createTaskCard.mock.results[0].value);
		const [enrichedTask, , visibleProperties] = createTaskCard.mock.calls[0] as unknown as [
			TaskInfo,
			unknown,
			string[],
		];
		expect(enrichedTask.basesData).toBe(basesEntry);
		expect(enrichedTask.dateCreated).toBe("2026-05-19T00:00:00");
		expect(visibleProperties).toEqual(["formula.score"]);
		expect(buildTaskCardOptions.mock.calls[0][0].targetDate).toBeInstanceOf(Date);
	});

	it("renders provider events as calendar event cards with related-note counts", () => {
		const icsEvent = { id: "event-1", title: "Event", start: "2026-05-19" };
		const createICSEventCard = jest.fn(() => document.createElement("div"));

		createCalendarListEventCard({
			event: createEvent({ eventType: "ics", icsEvent, relatedNoteCount: 2 }),
			plugin: createPlugin(),
			visibleProperties: [],
			basesEntryByPath: new Map(),
			buildTaskCardOptions: (options) => options as any,
			factories: { createICSEventCard: createICSEventCard as any },
		});

		expect(createICSEventCard).toHaveBeenCalledWith(icsEvent, expect.anything(), {
			relatedNoteCount: 2,
		});
	});

	it("keeps the calendar's default row for unknown list events", () => {
		const card = createCalendarListEventCard({
			event: createEvent({ eventType: "unknown" }),
			plugin: createPlugin(),
			visibleProperties: [],
			basesEntryByPath: new Map(),
			buildTaskCardOptions: (options) => options as any,
		});

		expect(card).toBeNull();
	});
});
