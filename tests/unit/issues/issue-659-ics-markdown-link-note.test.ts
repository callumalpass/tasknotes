import { CalendarExportService } from "../../../src/services/CalendarExportService";
import type { TaskInfo } from "../../../src/types";

jest.mock("obsidian", () => ({
	Notice: jest.fn(),
}));

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Review agenda",
		path: "Tasks/Project Notes/Review agenda.md",
		scheduled: "2026-05-18T09:00:00",
		status: "todo",
		tags: [],
		projects: [],
		contexts: [],
		...overrides,
	};
}

function unfoldIcs(content: string): string {
	return content.replace(/\r\n /g, "");
}

describe("Issue #659 - ICS exports link back to source notes", () => {
	it("keeps the plain source path when no vault name is provided", () => {
		const icsContent = CalendarExportService.generateICSContent(makeTask(), {
			includeObsidianLink: true,
		});

		expect(icsContent).toContain(
			"Exported from TaskNotes: Tasks/Project Notes/Review agenda.md"
		);
		expect(icsContent).not.toContain("obsidian://open");
	});

	it("adds an encoded Obsidian URI to a single-task ICS description", () => {
		const task = makeTask();
		const icsContent = CalendarExportService.generateICSContent(task, {
			includeObsidianLink: true,
			vaultName: "My Personal Vault",
		});

		const expectedUri = `obsidian://open?vault=${encodeURIComponent(
			"My Personal Vault"
		)}&file=${encodeURIComponent(task.path)}`;

		expect(icsContent).toContain(`Open in Obsidian: ${expectedUri}`);
		expect(icsContent).toContain("DESCRIPTION:");
	});

	it("adds a link for each event in bulk ICS exports", () => {
		const tasks = [
			makeTask({
				title: "Task 1",
				path: "Tasks/task-1.md",
			}),
			makeTask({
				title: "Task 2",
				path: "Tasks/task-2.md",
			}),
		];

		const icsContent = unfoldIcs(
			CalendarExportService.generateMultipleTasksICSContent(tasks, {
				includeObsidianLink: true,
				vaultName: "TaskVault",
			})
		);

		expect(icsContent).toContain(
			`Open in Obsidian: obsidian://open?vault=TaskVault&file=${encodeURIComponent(
				tasks[0].path
			)}`
		);
		expect(icsContent).toContain(
			`Open in Obsidian: obsidian://open?vault=TaskVault&file=${encodeURIComponent(
				tasks[1].path
			)}`
		);
	});

	it("URL-encodes path characters that are meaningful in ICS text", () => {
		const task = makeTask({
			path: "Notes/project;special,chars.md",
		});
		const icsContent = CalendarExportService.generateICSContent(task, {
			includeObsidianLink: true,
			vaultName: "Work Vault",
		});

		expect(icsContent).toContain("obsidian://open");
		expect(icsContent).toContain("vault=Work%20Vault");
		expect(icsContent).toContain("file=Notes%2Fproject%3Bspecial%2Cchars.md");
		expect(icsContent).not.toContain("file=Notes/project;special,chars.md");
	});
});
