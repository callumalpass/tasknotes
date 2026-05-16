import { TFile } from "obsidian";
import { ICSNoteService } from "../../../src/services/ICSNoteService";
import type { ICSEvent, NoteInfo, TaskInfo } from "../../../src/types";

function makeEvent(): ICSEvent {
	return {
		id: "google-event-1",
		subscriptionId: "google-primary",
		title: "Project review",
		start: "2026-02-05T10:00:00Z",
		end: "2026-02-05T11:00:00Z",
		allDay: false,
	};
}

function makePlugin(tasks: TaskInfo[], files: TFile[], frontmatterByPath: Record<string, unknown>) {
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
	} as unknown as ConstructorParameters<typeof ICSNoteService>[0];
}

describe("Issue #1563: related ICS notes are deduplicated", () => {
	it("keeps the richer task cache result when a task note also matches vault frontmatter", async () => {
		const event = makeEvent();
		const linkedTask = {
			title: "Project review task",
			path: "TaskNotes/Project review.md",
			status: "open",
			icsEventId: [event.id],
		} as TaskInfo;
		const taskFile = new TFile(linkedTask.path);
		const plainNoteFile = new TFile("Notes/Project review notes.md");
		const plugin = makePlugin([linkedTask], [taskFile, plainNoteFile], {
			[taskFile.path]: {
				title: "Project review task",
				icsEventId: [event.id],
				tags: ["task"],
			},
			[plainNoteFile.path]: {
				title: "Project review notes",
				icsEventId: event.id,
				tags: ["meeting"],
			},
		});
		const service = new ICSNoteService(plugin);

		const related = await service.findRelatedNotes(event);

		expect(related).toHaveLength(2);
		expect(related[0]).toBe(linkedTask);
		expect(related.map((item) => item.path)).toEqual([
			"TaskNotes/Project review.md",
			"Notes/Project review notes.md",
		]);
		expect((related[1] as NoteInfo).title).toBe("Project review notes");
	});
});
