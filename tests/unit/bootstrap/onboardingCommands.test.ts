import { createI18nService } from "../../../src/i18n";
import { createTaskNotesCommandDefinitions } from "../../../src/commands/taskNotesCommands";
import type TaskNotesPlugin from "../../../src/main";

it("has an endonym for every supported locale", () => {
	const i18n = createI18nService();
	for (const locale of i18n.getAvailableLocales()) {
		expect(i18n.getNativeLanguageName(locale)).not.toBe(locale);
	}
	expect(i18n.getNativeLanguageName("ko")).toBe("한국어");
});

it.each([["open-today", "Today"], ["open-inbox", "Inbox"]])("opens %s on the named task Base view", async (id, view) => {
	const plugin = { openBasesFileForCommand: jest.fn() } as unknown as TaskNotesPlugin;
	const command = createTaskNotesCommandDefinitions(plugin).find(command => command.id === id);
	expect(command).toBeDefined();
	await command?.callback?.(plugin);
	expect(plugin.openBasesFileForCommand).toHaveBeenCalledWith("open-tasks-view", view);
});

it("only exposes Google sync when configured, and current-task sync in task context", () => {
	const syncAllTasks = jest.fn();
	let enabled = false;
	let activeTask = false;
	const plugin = {
		taskCalendarSyncService: { isEnabled: () => enabled, syncAllTasks },
		app: {
			workspace: { getActiveFile: () => ({ path: "task.md" }) },
			metadataCache: { getFileCache: () => ({ frontmatter: {} }) },
		},
		cacheManager: { isTaskFile: () => activeTask },
	} as unknown as TaskNotesPlugin;
	const definitions = createTaskNotesCommandDefinitions(plugin);
	const all = definitions.find(command => command.id === "sync-all-tasks-google-calendar")!;
	const current = definitions.find(command => command.id === "sync-current-task-google-calendar")!;
	expect(all.checkCallback?.(true)).toBe(false);
	expect(current.checkCallback?.(true)).toBe(false);
	enabled = true;
	expect(all.checkCallback?.(true)).toBe(true);
	expect(syncAllTasks).not.toHaveBeenCalled();
	expect(current.checkCallback?.(true)).toBe(false);
	activeTask = true;
	expect(current.checkCallback?.(true)).toBe(true);
	expect(all.checkCallback?.(false)).toBe(true);
	expect(syncAllTasks).toHaveBeenCalledTimes(1);
});

it("keeps the timer but does not register statistics commands", () => {
	const ids = createTaskNotesCommandDefinitions({} as TaskNotesPlugin).map(command => command.id);
	expect(ids).toContain("open-pomodoro-view");
	expect(ids).not.toContain("open-statistics");
	expect(ids).not.toContain("open-pomodoro-stats");
});
