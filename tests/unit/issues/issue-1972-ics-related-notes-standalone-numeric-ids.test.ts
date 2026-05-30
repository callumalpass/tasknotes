import { TFile } from "obsidian";
import { ICSNoteService } from "../../../src/services/ICSNoteService";
import type { ICSEvent, TaskInfo } from "../../../src/types";

function createEvent(id: string, overrides: Partial<ICSEvent> = {}): ICSEvent {
	return {
		id,
		subscriptionId: "outlook-local",
		title: "Schedule",
		start: "2026-06-08T09:00:00",
		end: "2026-06-08T10:00:00",
		allDay: false,
		...overrides,
	};
}

function createPlugin(
	events: ICSEvent[],
	tasks: TaskInfo[] = [],
	frontmatterByPath: Record<string, unknown> = {}
) {
	const files = Object.keys(frontmatterByPath).map((path) => new TFile(path));

	return {
		fieldMapper: {
			toUserField: jest.fn((field: string) => field),
		},
		cacheManager: {
			getAllTasks: jest.fn().mockResolvedValue(tasks),
		},
		app: {
			vault: {
				getMarkdownFiles: jest.fn(() => files),
			},
			metadataCache: {
				getFileCache: jest.fn((file: TFile) => ({
					frontmatter: frontmatterByPath[file.path],
				})),
			},
		},
		icsSubscriptionService: {
			getAllEvents: jest.fn(() => events),
			getSubscriptions: jest.fn(() => [{ id: "outlook-local", name: "Outlook Local" }]),
		},
		googleCalendarService: {
			getAllEvents: jest.fn(() => []),
		},
		microsoftCalendarService: {
			getAllEvents: jest.fn(() => []),
		},
	} as unknown as ConstructorParameters<typeof ICSNoteService>[0];
}

describe("Issue #1972: ICS related notes require explicit recurrence metadata", () => {
	it("does not treat standalone numeric-suffixed ICS ids as the same series", async () => {
		const events = [
			createEvent("outlook-local-exported-schedule-1"),
			createEvent("outlook-local-exported-schedule-2"),
		];
		const linkedTask = {
			path: "Tasks/First schedule.md",
			title: "First schedule",
			status: "open",
			icsEventId: ["outlook-local-exported-schedule-1"],
		} as TaskInfo;
		const service = new ICSNoteService(createPlugin(events, [linkedTask]));

		const related = await service.findRelatedNotes(events[1]);
		const counts = await service.getRelatedNoteCountsByEventId();

		expect(related).toEqual([]);
		expect(counts.get(events[0].id)).toBe(1);
		expect(counts.get(events[1].id)).toBeUndefined();
	});

	it("still links real recurrence instances with an explicit recurring event id", async () => {
		const events = [
			createEvent("outlook-local-weekly-review-0", {
				recurringEventId: "outlook-local-weekly-review",
			}),
			createEvent("outlook-local-weekly-review-1", {
				recurringEventId: "outlook-local-weekly-review",
			}),
		];
		const linkedTask = {
			path: "Tasks/Weekly Review.md",
			title: "Weekly Review",
			status: "open",
			icsEventId: ["outlook-local-weekly-review-0"],
		} as TaskInfo;
		const service = new ICSNoteService(createPlugin(events, [linkedTask]));

		const related = await service.findRelatedNotes(events[1]);
		const counts = await service.getRelatedNoteCountsByEventId();

		expect(related).toEqual([linkedTask]);
		expect(counts.get(events[0].id)).toBe(1);
		expect(counts.get(events[1].id)).toBe(1);
		expect(counts.get("outlook-local-weekly-review")).toBe(1);
	});
});
