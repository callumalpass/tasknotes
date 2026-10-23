import { msg } from "@lingui/core/macro";
import { uiText } from "../i18n/runtime";
import { TFile, normalizePath, type App } from "obsidian";
import type { TaskNotesSettings } from "../types/settings";
import { ensureFolderHierarchy } from "./defaultBasesFiles";

export const STARTER_NOTE_PATH = "TaskNotes/Start Here.md";

/** Generated tutorial prose; URLs, paths and code tokens are immutable parameters. */
export function getStarterNoteContent(): string {
	return uiText(msg({ message: "# Start Here with TaskNotes\n\nThis note is a small tour of TaskNotes inside your own vault. Work through it in place, then keep it as a reference or delete it when you no longer need it.\n\nTaskNotes works best when three things feel connected:\n\n1. Capture a task quickly.\n2. Store the task as a normal Markdown note.\n3. Review tasks through Bases views.\n\n## Before you start\n\n- [ ] Enable the Obsidian **Bases** core plugin.\n- [ ] Confirm TaskNotes has created the default {token1} files in {token2}.\n- [ ] Open the command palette and run **TaskNotes: Open tasks view**.\n\nTaskNotes creates missing default {token3} files automatically on startup when **Auto-create default files** is enabled. If the files are missing, use **Settings -> TaskNotes -> General -> Views & base files -> Create files**.\n\n## 1. Create a task from the command palette\n\nRun **TaskNotes: Create new task** and create a real task you intend to do soon.\n\nTry a title like:\n\n```text\nReview my TaskNotes setup tomorrow #admin\n```\n\nAfter saving, TaskNotes creates a Markdown note for that task. Open the task note and look at the YAML properties at the top. Those properties are what Bases reads for filtering, sorting, grouping, and calendar placement.\n\n## 2. Convert inline tasks into TaskNotes\n\nThe checkboxes below are ordinary Markdown tasks. Convert each one into a TaskNote from the line''s inline action or the command palette.\n\n- [ ] Create a TaskNotes inbox task due tomorrow #admin\n- [ ] Schedule a 20 minute planning task for next Monday #planning\n- [ ] Make a task linked to an active project note\n\nAfter conversion, notice a few things:\n\n- The source line can stay in this note as context.\n- The actual task now lives as its own Markdown note, so it can appear in TaskNotes views.\n- The converted line links to the TaskNote. Right-click that TaskNote link to open the task menu, then try changing a property such as status, priority, due date, scheduled date, or project.\n\n## 3. Review your tasks\n\nThe embedded views below use the default TaskNotes Bases files.\n\n### Task list\n\n{token4}\n\nUse this when you want a straightforward list of everything open.\n\n### Agenda\n\n{token5}\n\nUse this when you care about due dates, scheduled dates, and what needs attention soon.\n\n### Mini calendar\n\n{token6}\n\nUse this when you want a compact calendar alongside your notes.\n\n### Calendar\n\n{token7}\n\nUse this when you want a larger calendar for scheduled work, due dates, timeblocks, and calendar events.\n\n### Kanban\n\n{token8}\n\nUse this when you want to move work through statuses like open, in progress, and done.\n\n## 4. Adjust only what gets in your way\n\nThe defaults are enough to start. Visit settings later when you know what you want to change:\n\n- If task files are going to the wrong place, check **Settings -> TaskNotes -> General**.\n- If converted inline tasks should be created somewhere else, check **Settings -> TaskNotes -> Inline Task Settings**.\n- If the task modal shows too much or too little, check **Settings -> TaskNotes -> Modal Fields**.\n- If your vault uses different property names, statuses, priorities, or custom fields, check **Settings -> TaskNotes -> Task Properties**.\n\n## 5. Make it yours\n\nTry adding one custom property to a task, such as {token9}, {token10}, or {token11}. Because tasks are Markdown notes, custom properties can be used in Bases without locking you into a separate task database.\n\n## 6. Contextual views\n\nYou can embed Bases views inside daily notes, project notes, meeting notes, or task notes. Advanced Bases filters can use the current note as context, so one view can show tasks related to whatever note it is embedded in.\n\nTaskNotes uses this pattern for the Relationships widget in task notes. When you are ready to customize views, see the TaskNotes documentation for examples.\n\nUseful next experiments:\n\n- Duplicate {token12} and make a view for one project.\n- Add a group to a Base view, such as status or priority.\n- Add a filter for tasks due this week.\n- Link a task to a project note and use backlinks to see where it is mentioned.\n\n## More help and extensions\n\n- Documentation: [tasknotes.dev]({token13})\n- Problems or bugs: [open an issue on GitHub]({token14})\n- Companion plugins:\n  - [Canvas Bases]({token15}) adds canvas-style boards and JSON Canvas snapshots for Bases views, with optional TaskNotes badges, actions, and relationship edges.\n  - [TaskNotes Workflows]({token16}) adds Markdown-defined automation for TaskNotes events, schedules, manual commands, and task actions.\n\n## Finished\n\nNow you know the core idea: tasks are notes, properties make them queryable, and Bases turns them into views.\n", context: "starter note Markdown" }), { token1: "`.base`", token2: "`TaskNotes/Views/`", token3: "`.base`", token4: "![[TaskNotes/Views/tasks-default.base]]", token5: "![[TaskNotes/Views/agenda-default.base]]", token6: "![[TaskNotes/Views/mini-calendar-default.base]]", token7: "![[TaskNotes/Views/calendar-default.base]]", token8: "![[TaskNotes/Views/kanban-default.base]]", token9: "`energy`", token10: "`client`", token11: "`area`", token12: "`TaskNotes/Views/tasks-default.base`", token13: "https://tasknotes.dev/", token14: "https://github.com/callumalpass/tasknotes/issues", token15: "https://tasknotes.dev/companion-plugins/canvas-bases/", token16: "https://tasknotes.dev/companion-plugins/tasknotes-workflows/" });
}

export type StarterNoteResult =
	| "created"
	| "opened-existing"
	| "already-created"
	| "not-first-install"
	| "path-not-file"
	| "failed";

export type StarterNoteHost = {
	app: Pick<App, "vault" | "workspace">;
	settings: Pick<TaskNotesSettings, "starterNoteCreated">;
	shouldCreateStarterNote: boolean;
	saveSettings(): Promise<void>;
	warn?(message: string, error?: unknown): void;
};

export async function ensureStarterNote(host: StarterNoteHost): Promise<StarterNoteResult> {
	if (host.settings.starterNoteCreated) {
		return "already-created";
	}

	if (!host.shouldCreateStarterNote) {
		return "not-first-install";
	}

	const normalizedPath = normalizePath(STARTER_NOTE_PATH);

	try {
		const vault = host.app.vault;
		const existing = await vault.adapter.exists(normalizedPath);
		let file: TFile;
		let result: StarterNoteResult = "created";

		if (existing) {
			const existingFile = vault.getAbstractFileByPath(normalizedPath);
			if (!(existingFile instanceof TFile)) {
				host.warn?.(
					`[TaskNotes][StarterNote] Starter note path exists but is not a file: ${normalizedPath}`
				);
				return "path-not-file";
			}
			file = existingFile;
			result = "opened-existing";
		} else {
			const lastSlashIndex = normalizedPath.lastIndexOf("/");
			const directory =
				lastSlashIndex >= 0 ? normalizedPath.substring(0, lastSlashIndex) : "";
			if (directory) {
				await ensureFolderHierarchy(vault, directory);
			}
			file = await vault.create(normalizedPath, getStarterNoteContent());
		}

		host.settings.starterNoteCreated = true;
		await host.saveSettings();
		await host.app.workspace.getLeaf("tab").openFile(file);
		return result;
	} catch (error) {
		host.warn?.("[TaskNotes][StarterNote] Failed to create starter note:", error);
		return "failed";
	}
}
