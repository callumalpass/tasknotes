import { msg } from "@lingui/core/macro";
import { Platform, TFile, WorkspaceLeaf, normalizePath } from "obsidian";
import type TaskNotesPlugin from "../main";
import {
	AGENDA_VIEW_TYPE,
	POMODORO_STATS_VIEW_TYPE,
	POMODORO_VIEW_TYPE,
	STATS_VIEW_TYPE,
} from "../types";
import { RELEASE_NOTES_VIEW_TYPE } from "../views/ReleaseNotesView";
import { showNotice } from "../ui/notifications";

type WorkspaceLeafLike = {
	isDeferred?: boolean;
	loadIfDeferred(): Promise<void>;
	openFile?(file: TFile): Promise<void>;
	setViewState(state: { type: string; active?: boolean }): Promise<void>;
	view?: {
		file?: TFile;
		getState?(): { file?: string };
	};
};

export class WorkspaceNavigationService {
	constructor(private plugin: TaskNotesPlugin) {}

	getLeafOfType(viewType: string): WorkspaceLeafLike | null {
		const leaves = this.plugin.app.workspace.getLeavesOfType(viewType);
		return leaves.length > 0 ? leaves[0] : null;
	}

	async revealLeafReady(leaf: WorkspaceLeafLike): Promise<void> {
		const { workspace } = this.plugin.app;
		workspace.setActiveLeaf(leaf as WorkspaceLeaf, { focus: true });
		await workspace.revealLeaf(leaf as WorkspaceLeaf);
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
		return leaf as WorkspaceLeaf;
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
			return leaf as WorkspaceLeaf;
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

	private getLeafFilePath(leaf: WorkspaceLeafLike): string | null {
		const filePath = leaf.view?.file?.path || leaf.view?.getState?.().file;
		return filePath ? normalizePath(filePath) : null;
	}

	private findLeafForFile(normalizedPath: string): WorkspaceLeafLike | null {
		const workspace = this.plugin.app.workspace;
		let match: WorkspaceLeafLike | null = null;

		workspace.iterateAllLeaves?.((leaf) => {
			if (!match && this.getLeafFilePath(leaf) === normalizedPath) {
				match = leaf;
			}
		});

		return match;
	}

	async openBasesFileForCommand(commandId: string): Promise<void> {
		const filePath = this.plugin.settings.commandFileMapping[commandId];
		if (!filePath) {
			showNotice(
				this.plugin.i18n.translate(msg({ message: "No file configured for command: {command}", context: "notices.interface.commandFileMissing" }), {
					command: commandId,
				})
			);
			return;
		}

		const normalizedPath = normalizePath(filePath);
		const fileExists = await this.plugin.app.vault.adapter.exists(normalizedPath);
		if (!fileExists) {
			showNotice(
				this.plugin.i18n.translate(msg({ message: "File not found: {path}. Configure a valid file in the View Commands settings or create the default files.", context: "notices.interface.commandFileInvalid" }), {
					path: normalizedPath,
				}),
				10000
			);
			return;
		}

		const file = this.plugin.app.vault.getAbstractFileByPath(normalizedPath);
		if (!file) {
			showNotice(
				this.plugin.i18n.translate(msg({ message: "File not found in vault: {path}. The file exists but Obsidian cannot find it. Try reloading the vault.", context: "notices.interface.commandFileUnindexed" }), {
					path: normalizedPath,
				})
			);
			return;
		}
		if (!(file instanceof TFile)) {
			showNotice(
				this.plugin.i18n.translate(msg({ message: "Path is not a file: {path}", context: "notices.interface.notAFile" }), { path: normalizedPath })
			);
			return;
		}

		const existingLeaf = this.findLeafForFile(normalizedPath);
		if (existingLeaf) {
			await this.revealLeafReady(existingLeaf);
			return;
		}

		const leaf = this.plugin.app.workspace.getLeaf("tab");
		await leaf.openFile(file);
	}
}
