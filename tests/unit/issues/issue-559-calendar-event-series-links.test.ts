import { TFile } from "obsidian";
import { ICSNoteService } from "../../../src/services/ICSNoteService";
import type { ICSEvent, TaskInfo } from "../../../src/types";

function createEvent(id: string, overrides: Partial<ICSEvent> = {}): ICSEvent {
	return {
		id,
		subscriptionId: "work",
		title: "Weekly Review",
		start: "2026-02-05T10:00:00Z",
		end: "2026-02-05T11:00:00Z",
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
			getSubscriptions: jest.fn(() => [{ id: "work", name: "Work" }]),
		},
		googleCalendarService: {
			getAllEvents: jest.fn(() => []),
		},
		microsoftCalendarService: {
			getAllEvents: jest.fn(() => []),
		},
	} as unknown as ConstructorParameters<typeof ICSNoteService>[0];
}

describe("Issue #559: related notes for recurring calendar event series", () => {
	it("finds a note linked to one recurring instance when opening a sibling instance", async () => {
		const events = [
			createEvent("work-weekly-review-0", { recurringEventId: "work-weekly-review" }),
			createEvent("work-weekly-review-1", { recurringEventId: "work-weekly-review" }),
			createEvent("work-weekly-review-2", { recurringEventId: "work-weekly-review" }),
		];
		const linkedTask = {
			path: "Tasks/Weekly Review.md",
			title: "Weekly Review",
			status: "open",
			icsEventId: ["work-weekly-review-1"],
		} as TaskInfo;
		const service = new ICSNoteService(createPlugin(events, [linkedTask]));

		const related = await service.findRelatedNotes(events[2]);

		expect(related).toEqual([linkedTask]);
	});

	it("counts a note linked to one recurring instance for every loaded sibling instance", async () => {
		const events = [
			createEvent("work-weekly-review-0", { recurringEventId: "work-weekly-review" }),
			createEvent("work-weekly-review-1", { recurringEventId: "work-weekly-review" }),
			createEvent("work-weekly-review-2", { recurringEventId: "work-weekly-review" }),
		];
		const service = new ICSNoteService(
			createPlugin(events, [], {
				"Notes/Weekly Review.md": {
					title: "Weekly Review notes",
					icsEventId: ["work-weekly-review-1"],
				},
			})
		);

		const counts = await service.getRelatedNoteCountsByEventId();

		expect(counts.get("work-weekly-review-0")).toBe(1);
		expect(counts.get("work-weekly-review-1")).toBe(1);
		expect(counts.get("work-weekly-review-2")).toBe(1);
	});

	it("keeps numeric-suffixed standalone event ids exact when no sibling series is loaded", async () => {
		const target = createEvent("work-one-off-2");
		const linkedTask = {
			path: "Tasks/One Off.md",
			title: "One Off",
			status: "open",
			icsEventId: ["work-one-off-1"],
		} as TaskInfo;
		const service = new ICSNoteService(createPlugin([target], [linkedTask]));

		const related = await service.findRelatedNotes(target);

		expect(related).toEqual([]);
	});
});
