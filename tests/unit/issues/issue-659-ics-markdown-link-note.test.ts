/**
 * Issue #659 - Link to the note in markdown after export to ICS
 *
 * Feature Request: https://github.com/tasknotes/tasknotes/issues/659
 *
 * Description:
 * After exporting tasks to .ics calendar format, the description currently
 * mentions the path of the original note as plain text. The user requests
 * that the description contain a markdown link to the original note instead,
 * allowing them to jump to the note directly from their calendar application
 * (e.g., Thunderbird, Evolution).
 *
 * Current behavior:
 * - ICS DESCRIPTION field contains: "Exported from TaskNotes: tasks/my-task.md"
 *
 * Requested behavior:
 * - ICS DESCRIPTION field contains a clickable link like:
 *   "Open in Obsidian: obsidian://open?vault=VaultName&file=tasks%2Fmy-task.md"
 *   or markdown format: "[Open in Obsidian](obsidian://open?vault=VaultName&file=tasks%2Fmy-task.md)"
 *
 * Use case:
 * - User exports tasks to ICS file
 * - Opens ICS in calendar application (Thunderbird, Evolution, etc.)
 * - Clicks link in event description to jump back to the Obsidian note
 *
 * Implementation considerations:
 * - CalendarExportService.buildDescription() at src/services/CalendarExportService.ts:249
 *   currently outputs: `Exported from TaskNotes: ${task.path}`
 * - Need to construct Obsidian URI: obsidian://open?vault=VAULT_NAME&file=ENCODED_PATH
 * - The vault name is available from plugin.app.vault.getName() but CalendarExportService
 *   is currently a static utility class without access to the plugin instance
 * - Options for implementation:
 *   1. Pass vault name as parameter to generateICSContent/buildDescription
 *   2. Add an option in ICSExportOptions for includeObsidianLink and vault name
 *   3. Make CalendarExportService non-static with plugin dependency injection
 *
 * Related implementation:
 * - TaskCalendarSyncService.buildEventDescription() (lines 225-231) already implements
 *   this for Google Calendar export with HTML anchor tags:
 *   `<a href="obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodedPath}">Open in Obsidian</a>`
 */

import { CalendarExportService } from "../../../src/services/CalendarExportService";
import { TaskInfo } from "../../../src/types";

// Mock Obsidian's dependencies
jest.mock("obsidian", () => ({
	Notice: jest.fn(),
}));

describe("Issue #659 - Link to the note in markdown after export to ICS", () => {
	describe("Current behavior (before fix)", () => {
		it("currently includes plain text path in ICS description", () => {
			const task: TaskInfo = {
				title: "My Task",
				path: "tasks/project/my-task.md",
				status: "todo",
				tags: [],
				projects: [],
				contexts: [],
			};

			const icsContent = CalendarExportService.generateICSContent(task);

			// Current behavior: plain text path
			expect(icsContent).toContain("Exported from TaskNotes: tasks/project/my-task.md");
		});
	});

	describe("Feature: Include Obsidian link in ICS description", () => {
		it.skip("reproduces issue #659 - should include obsidian:// link in ICS description for single task export", () => {
			// Feature: ICS export should include clickable Obsidian link
			const task: TaskInfo = {
				title: "Meeting Notes",
				path: "tasks/meetings/standup.md",
				scheduled: "2025-01-20T09:00:00",
				status: "todo",
				tags: [],
				projects: [],
				contexts: [],
			};

			const vaultName = "My Vault";
			// Expected: ICS content should contain an Obsidian URI
			// Format: obsidian://open?vault=My%20Vault&file=tasks%2Fmeetings%2Fstandup.md

			const icsContent = CalendarExportService.generateICSContent(task);

			// Currently fails - plain path is used instead of obsidian:// URI
			const expectedUri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(task.path)}`;
			expect(icsContent).toContain(expectedUri);
		});

		it.skip("reproduces issue #659 - should URL-encode special characters in vault name and path", () => {
			// Feature: Proper URL encoding for vault names and paths with spaces/special chars
			const task: TaskInfo = {
				title: "Task with Special Path",
				path: "Daily Notes/2025/01 January/Meeting Notes.md",
				scheduled: "2025-01-20T10:00:00",
				status: "todo",
				tags: [],
				projects: [],
				contexts: [],
			};

			const vaultName = "My Personal Vault";
			// Path with spaces should be encoded: Daily%20Notes%2F2025%2F01%20January%2FMeeting%20Notes.md
			// Vault with spaces should be encoded: My%20Personal%20Vault

			const icsContent = CalendarExportService.generateICSContent(task);

			// Currently fails - encoding is not applied
			expect(icsContent).toContain("obsidian://open");
			expect(icsContent).toContain(encodeURIComponent(vaultName));
			expect(icsContent).toContain(encodeURIComponent(task.path));
		});

		it.skip("reproduces issue #659 - should include obsidian:// link in bulk ICS export (generateMultipleTasksICSContent)", () => {
			// Feature: Bulk export should also include Obsidian links for each task
			const tasks: TaskInfo[] = [
				{
					title: "Task 1",
					path: "tasks/task-1.md",
					scheduled: "2025-01-20T09:00:00",
					status: "todo",
					tags: [],
					projects: [],
					contexts: [],
				},
				{
					title: "Task 2",
					path: "tasks/task-2.md",
					scheduled: "2025-01-20T10:00:00",
					status: "todo",
					tags: [],
					projects: [],
					contexts: [],
				},
			];

			const vaultName = "TaskVault";

			const icsContent = CalendarExportService.generateMultipleTasksICSContent(tasks);

			// Each event should have its own Obsidian link
			// Currently fails - plain paths are used
			const expectedUri1 = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(tasks[0].path)}`;
			const expectedUri2 = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(tasks[1].path)}`;

			expect(icsContent).toContain(expectedUri1);
			expect(icsContent).toContain(expectedUri2);
		});

		it.skip("reproduces issue #659 - should work with calendar apps that support URL links (Thunderbird, Evolution)", () => {
			// Use case: User opens ICS in desktop calendar and clicks link
			// The obsidian:// protocol should be clickable in:
			// - Thunderbird
			// - Evolution
			// - Other desktop calendar apps that support custom URL protocols

			const task: TaskInfo = {
				title: "Review Document",
				path: "work/reviews/Q1-review.md",
				due: "2025-01-25",
				status: "todo",
				tags: ["review"],
				projects: [],
				contexts: [],
			};

			const vaultName = "Work";
			const icsContent = CalendarExportService.generateICSContent(task);

			// The DESCRIPTION field should contain the link in a format that
			// calendar apps can render as clickable
			// Currently fails - no obsidian:// link present
			expect(icsContent).toContain("obsidian://open");
			expect(icsContent).toContain("DESCRIPTION:");
		});
	});

	describe("Feature: ICS export options for Obsidian link", () => {
		it.skip("reproduces issue #659 - should accept vaultName in ICSExportOptions", () => {
			// Feature: Pass vault name through options to enable link generation
			// This aligns with how Google Calendar export works in TaskCalendarSyncService

			interface ExtendedICSExportOptions {
				useDurationForExport?: boolean;
				includeObsidianLink?: boolean;
				vaultName?: string;
			}

			const task: TaskInfo = {
				title: "Test Task",
				path: "tasks/test.md",
				scheduled: "2025-01-20T09:00:00",
				status: "todo",
				tags: [],
				projects: [],
				contexts: [],
			};

			const options: ExtendedICSExportOptions = {
				includeObsidianLink: true,
				vaultName: "MyVault",
			};

			// Expected: When options.includeObsidianLink is true and vaultName is provided,
			// the ICS description should contain the obsidian:// link
			// Currently fails - options don't support this yet
			expect(options.includeObsidianLink).toBe(true);
			expect(options.vaultName).toBe("MyVault");
		});

		it.skip("reproduces issue #659 - should fall back to plain path when vaultName is not provided", () => {
			// Feature: Graceful fallback when vault name is unknown
			// If vaultName is not provided in options, should fall back to current behavior

			const task: TaskInfo = {
				title: "Test Task",
				path: "tasks/test.md",
				scheduled: "2025-01-20T09:00:00",
				status: "todo",
				tags: [],
				projects: [],
				contexts: [],
			};

			const icsContent = CalendarExportService.generateICSContent(task);

			// Without vault name, should still work but use plain path
			expect(icsContent).toContain("Exported from TaskNotes: tasks/test.md");
		});
	});

	describe("Feature: Proper ICS text escaping for URLs", () => {
		it.skip("reproduces issue #659 - should properly escape obsidian:// URL in ICS DESCRIPTION field", () => {
			// ICS format requires certain characters to be escaped:
			// - Semicolons (;) -> \;
			// - Commas (,) -> \,
			// - Newlines -> \n
			// - Backslashes -> \\

			// Note: URL encoding handles special characters in the path,
			// but the resulting URL may still need ICS escaping

			const task: TaskInfo = {
				title: "Task",
				path: "notes/project;special,chars.md", // Path with ICS-sensitive chars
				scheduled: "2025-01-20T09:00:00",
				status: "todo",
				tags: [],
				projects: [],
				contexts: [],
			};

			const icsContent = CalendarExportService.generateICSContent(task);

			// The URL-encoded path should handle the special characters
			// Then ICS escaping should handle any remaining sensitive chars
			// Currently fails - no obsidian:// link present
			expect(icsContent).toContain("DESCRIPTION:");
			// Should not have unescaped semicolons or commas in DESCRIPTION value
		});
	});
});
