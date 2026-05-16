import { describe, expect, it, jest } from "@jest/globals";
import { createICSEvent } from "../../../src/bases/calendar-core";
import { ICSNoteService } from "../../../src/services/ICSNoteService";
import { createICSEventCard } from "../../../src/ui/ICSCard";
import { renderPropertyMetadata } from "../../../src/ui/taskCardProperties";
import type { ICSEvent, TaskInfo } from "../../../src/types";

function createEvent(overrides: Partial<ICSEvent> = {}): ICSEvent {
	return {
		id: "event-1",
		subscriptionId: "work",
		title: "Team Sync",
		start: "2025-02-15T10:00:00",
		end: "2025-02-15T11:00:00",
		allDay: false,
		...overrides,
	};
}

function createPlugin() {
	const event = createEvent();
	const task: TaskInfo = {
		id: "Tasks/Meeting.md",
		path: "Tasks/Meeting.md",
		title: "Meeting task",
		status: "open",
		priority: "normal",
		archived: false,
		tags: ["task"],
		contexts: [],
		projects: [],
		icsEventId: ["event-1"],
	};

	const plugin = {
		i18n: {
			translate: (key: string) =>
				key === "modals.icsEventInfo.relatedNotesHeading"
					? "Related notes & tasks"
					: key,
		},
		settings: {
			calendarViewSettings: {
				timeFormat: "24",
			},
		},
		fieldMapper: {
			toUserField: (field: string) => field,
			lookupMappingKey: () => undefined,
		},
		cacheManager: {
			getAllTasks: jest.fn(async () => [task]),
		},
		app: {
			vault: {
				getMarkdownFiles: () => [
					{ path: "Tasks/Meeting.md" },
					{ path: "Notes/Meeting notes.md" },
					{ path: "Notes/Unlinked.md" },
				],
			},
			metadataCache: {
				getFileCache: (file: { path: string }) => {
					if (file.path === "Tasks/Meeting.md") {
						return { frontmatter: { icsEventId: ["event-1"] } };
					}
					if (file.path === "Notes/Meeting notes.md") {
						return { frontmatter: { icsEventId: "event-1" } };
					}
					return { frontmatter: {} };
				},
			},
		},
		icsSubscriptionService: {
			getAllEvents: () => [event],
			getSubscriptions: () => [
				{ id: "work", name: "Work", color: "#2563eb", enabled: true },
			],
		},
		googleCalendarService: {
			getAllEvents: () => [],
			getAvailableCalendars: () => [],
		},
		microsoftCalendarService: {
			getAllEvents: () => [],
			getAvailableCalendars: () => [],
		},
	};

	return {
		...plugin,
		icsNoteService: new ICSNoteService(plugin as any),
	};
}

describe("issue #1502 / #603 calendar related-note indicators", () => {
	it("counts linked tasks and notes per calendar event without double-counting paths", async () => {
		const plugin = createPlugin();
		const service = new ICSNoteService(plugin as any);

		const counts = await service.getRelatedNoteCountsByEventId();

		expect(counts.get("event-1")).toBe(2);
	});

	it("passes related note counts through calendar event extended props", () => {
		const plugin = createPlugin();

		const calendarEvent = createICSEvent(createEvent(), plugin as any, {
			relatedNoteCount: 2,
		});

		expect(calendarEvent?.extendedProps.relatedNoteCount).toBe(2);
	});

	it("marks ICS list cards that have related notes", () => {
		const plugin = createPlugin();

		const card = createICSEventCard(createEvent(), plugin as any, {
			relatedNoteCount: 2,
		});

		expect(card.classList.contains("has-related-note")).toBe(true);
		expect(card.dataset.relatedNoteCount).toBe("2");
		const indicator = card.querySelector<HTMLElement>(".ics-card__related-note-indicator");
		expect(indicator?.getAttribute("data-icon")).toBe("file-text");
		expect(indicator?.getAttribute("data-tooltip")).toBe("Related notes & tasks: 2");
	});

	it("renders loaded calendar event names instead of raw ICS ids on task cards", () => {
		const plugin = createPlugin();
		const container = document.createElement("div");
		const task = {
			path: "Tasks/Meeting.md",
			title: "Meeting task",
			icsEventId: ["event-1"],
		} as TaskInfo;

		const property = renderPropertyMetadata(container, "icsEventId", task, plugin as any);

		expect(property?.textContent).toContain("Calendar: Team Sync");
		expect(property?.textContent).not.toContain("event-1");
	});
});
