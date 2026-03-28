import {
	Notice,
	Platform,
	TFile,
	WorkspaceLeaf,
	normalizePath,
} from "obsidian";
import type TaskNotesPlugin from "../main";
import {
	AGENDA_VIEW_TYPE,
	POMODORO_STATS_VIEW_TYPE,
	POMODORO_VIEW_TYPE,
	STATS_VIEW_TYPE,
} from "../types";
import { RELEASE_NOTES_VIEW_TYPE } from "../views/ReleaseNotesView";

export class WorkspaceNavigationService {
	constructor(private plugin: TaskNotesPlugin) {}

	getLeafOfType(viewType: string): WorkspaceLeaf | null {
		const leaves = this.plugin.app.workspace.getLeavesOfType(viewType);
		return leaves.length > 0 ? leaves[0] : null;
	}

	async revealLeafReady(leaf: WorkspaceLeaf): Promise<void> {
		const { workspace } = this.plugin.app;
		workspace.setActiveLeaf(leaf, { focus: true });
		await workspace.revealLeaf(leaf);
		if (leaf.isDeferred) {
			await leaf.loadIfDeferred();
		}
	}

	async activateView(viewType: string): Promise<WorkspaceLeaf> {
		const { workspace } = this.plugin.app;
		let leaf = this.getLeafOfType(viewType);

		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({
				type: viewType,
				active: true,
			});
		}

		await this.revealLeafReady(leaf);
		return leaf;
	}

	async activateCalendarView(): Promise<void> {
		await this.openBasesFileForCommand("open-calendar-view");
	}

	async activateAgendaView(): Promise<WorkspaceLeaf> {
		return this.activateView(AGENDA_VIEW_TYPE);
	}

	async activatePomodoroView(): Promise<WorkspaceLeaf> {
		if (Platform.isMobile && this.plugin.settings.pomodoroMobileSidebar !== "tab") {
			const { workspace } = this.plugin.app;
			let leaf = this.getLeafOfType(POMODORO_VIEW_TYPE);

			if (!leaf) {
				const sidebarLeaf =
					this.plugin.settings.pomodoroMobileSidebar === "left"
						? workspace.getLeftLeaf(false)
						: workspace.getRightLeaf(false);

				if (sidebarLeaf) {
					leaf = sidebarLeaf;
					await leaf.setViewState({
						type: POMODORO_VIEW_TYPE,
						active: true,
					});
				} else {
					return this.activateView(POMODORO_VIEW_TYPE);
				}
			}

			await this.revealLeafReady(leaf);
			return leaf;
		}

		return this.activateView(POMODORO_VIEW_TYPE);
	}

	async activatePomodoroStatsView(): Promise<WorkspaceLeaf> {
		return this.activateView(POMODORO_STATS_VIEW_TYPE);
	}

	async activateStatsView(): Promise<WorkspaceLeaf> {
		return this.activateView(STATS_VIEW_TYPE);
	}

	async activateReleaseNotesView(): Promise<WorkspaceLeaf> {
		return this.activateView(RELEASE_NOTES_VIEW_TYPE);
	}

	async openBasesFileForCommand(commandId: string): Promise<void> {
		const filePath = this.plugin.settings.commandFileMapping[commandId];
		if (!filePath) {
			new Notice(`No file configured for command: ${commandId}`);
			return;
		}

		const normalizedPath = normalizePath(filePath);
		const fileExists = await this.plugin.app.vault.adapter.exists(normalizedPath);
		if (!fileExists) {
			new Notice(
				`File not found: ${normalizedPath}\n\nPlease configure a valid file in Settings → TaskNotes → View Commands, or use the "Create Default Files" button.`,
				10000
			);
			return;
		}

		const file = this.plugin.app.vault.getAbstractFileByPath(normalizedPath);
		if (!file) {
			new Notice(
				`File not found in vault: ${normalizedPath}\n\nThe file exists but Obsidian cannot find it. Try reloading the vault.`
			);
			return;
		}
		if (!(file instanceof TFile)) {
			new Notice(`Path is not a file: ${normalizedPath}`);
			return;
		}

		const leaf = this.plugin.app.workspace.getLeaf();
		await leaf.openFile(file);
	}
}
