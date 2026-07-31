import { TFile } from "obsidian";
import { ICSNoteService } from "../../../src/services/ICSNoteService";
import type { ICSEvent, TaskInfo } from "../../../src/types";
import type { ICSIntegrationSettings } from "../../../src/types/settings";

function createEvent(id: string, overrides: Partial<ICSEvent> = {}): ICSEvent {
	return {
		id,
		subscriptionId: "google-primary",
		title: "Recurring Review",
		start: "2026-06-09T09:00:00Z",
		end: "2026-06-09T10:00:00Z",
		allDay: false,
		...overrides,
	};
}

function createPlugin(
	events: ICSEvent[],
	tasks: TaskInfo[] = [],
	frontmatterByPath: Record<string, unknown> = {},
	mode: ICSIntegrationSettings["recurringEventRelatedNotesMode"] = "series"
) {
	const files = Object.keys(frontmatterByPath).map((path) => new TFile(path));

	return {
		settings: {
			icsIntegration: {
				recurringEventRelatedNotesMode: mode,
			},
		},
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
			getAllEvents: jest.fn(() => []),
			getSubscriptions: jest.fn(() => []),
		},
		googleCalendarService: {
			getAllEvents: jest.fn(() => events),
			getAvailableCalendars: jest.fn(() => [{ id: "primary", summary: "Primary" }]),
		},
		microsoftCalendarService: {
			getAllEvents: jest.fn(() => []),
		},
	} as unknown as ConstructorParameters<typeof ICSNoteService>[0];
}

describe("Issue #2016: recurring external calendar related note mode", () => {
	const events = [
		createEvent("google-primary-review-0", { recurringEventId: "google-primary-review" }),
		createEvent("google-primary-review-1", { recurringEventId: "google-primary-review" }),
		createEvent("google-primary-review-2", { recurringEventId: "google-primary-review" }),
	];

	const linkedTask = {
		path: "Tasks/Recurring Review.md",
		title: "Recurring Review",
		status: "open",
		icsEventId: ["google-primary-review-1"],
	} as TaskInfo;

	it("keeps recurring event related notes series-wide by default", async () => {
		const service = new ICSNoteService(createPlugin(events, [linkedTask]));

		const related = await service.findRelatedNotes(events[2]);
		const counts = await service.getRelatedNoteCountsByEventId();

		expect(related).toEqual([linkedTask]);
		expect(counts.get("google-primary-review-0")).toBe(1);
		expect(counts.get("google-primary-review-1")).toBe(1);
		expect(counts.get("google-primary-review-2")).toBe(1);
	});

	it("limits recurring event related notes to the selected instance when configured", async () => {
		const service = new ICSNoteService(createPlugin(events, [linkedTask], {}, "instance"));

		const siblingRelated = await service.findRelatedNotes(events[2]);
		const linkedInstanceRelated = await service.findRelatedNotes(events[1]);
		const counts = await service.getRelatedNoteCountsByEventId();

		expect(siblingRelated).toEqual([]);
		expect(linkedInstanceRelated).toEqual([linkedTask]);
		expect(counts.get("google-primary-review-0")).toBeUndefined();
		expect(counts.get("google-primary-review-1")).toBe(1);
		expect(counts.get("google-primary-review-2")).toBeUndefined();
		expect(counts.get("google-primary-review")).toBeUndefined();
	});
});
