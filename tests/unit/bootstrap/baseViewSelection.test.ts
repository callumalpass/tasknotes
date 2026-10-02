import { TFile } from "obsidian";
import { WorkspaceNavigationService } from "../../../src/ui/WorkspaceNavigationService";
import type TaskNotesPlugin from "../../../src/main";

function fixture(viewName = "Retired") {
	const file = new TFile("TaskNotes/Views/tasks-default.base");
	const custom = new TFile("Custom.base");
	const state = { file: file.path, viewName, customState: "preserved" };
	const leaf = {
		view: { file, getState: () => state },
		setViewState: jest.fn().mockResolvedValue(undefined),
	};
	const other = { view: { file: custom, getState: () => ({ file: custom.path, viewName: "Retired" }) }, setViewState: jest.fn() };
	const plugin = {
		settings: { commandFileMapping: { "open-tasks-view": file.path } },
		app: {
			vault: {
				adapter: { exists: async () => true },
				getAbstractFileByPath: (path: string) => path === file.path ? file : custom,
				read: async () => 'views:\n  - type: table\n    name: Today\n  - type: table\n    name: Inbox\n',
			},
			workspace: {
				getLeavesOfType: () => [leaf, other],
				iterateAllLeaves: (callback: (leaf: unknown) => void) => [leaf, other].forEach(callback),
				setActiveLeaf: jest.fn(), revealLeaf: jest.fn(),
			},
		},
	} as unknown as TaskNotesPlugin;
	return { service: new WorkspaceNavigationService(plugin), leaf, other, state, file, plugin };
}

it("repairs only affected open Bases whose selected view was removed", async () => {
	const { service, leaf, other, file } = fixture();
	await service.repairOpenBasesLeaves([file.path]);
	expect(leaf.setViewState).toHaveBeenCalledWith({ type: "bases", state: {
		file: file.path, viewName: "Today", customState: "preserved",
	} });
	expect(other.setViewState).not.toHaveBeenCalled();
});

it("leaves malformed custom Base YAML to the native error display", async () => {
	const { service, leaf, plugin } = fixture();
	jest.spyOn(plugin.app.vault, "read").mockResolvedValue("views: [");
	await expect(service.openBasesFileForCommand("open-tasks-view")).resolves.toBeUndefined();
	expect(leaf.setViewState).not.toHaveBeenCalled();
});

it("preserves valid existing selections after regeneration", async () => {
	const { service, leaf, file } = fixture("Inbox");
	await service.repairOpenBasesLeaves([file.path]);
	expect(leaf.setViewState).not.toHaveBeenCalled();
});

it("normalizes a stale remembered view when opening the task Base", async () => {
	const { service, leaf } = fixture();
	await service.openBasesFileForCommand("open-tasks-view");
	expect(leaf.setViewState.mock.calls[0][0].state.viewName).toBe("Today");
});

it("selects the requested Today or Inbox view even in an already open leaf", async () => {
	const { service, leaf } = fixture("Today");
	await service.openBasesFileForCommand("open-tasks-view", "Inbox");
	expect(leaf.setViewState.mock.calls[0][0].state.viewName).toBe("Inbox");
});

it("falls back without modifying a custom Base that lacks the requested view", async () => {
	const { service, leaf } = fixture("Inbox");
	await service.openBasesFileForCommand("open-tasks-view", "Missing");
	expect(leaf.setViewState.mock.calls[0][0].state.viewName).toBe("Today");
});
