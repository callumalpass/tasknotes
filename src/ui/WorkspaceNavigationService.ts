import {
	Platform,
	TFile,
	WorkspaceLeaf,
	normalizePath,
	parseYaml,
} from "obsidian";
import type TaskNotesPlugin from "../main";
import {
	AGENDA_VIEW_TYPE,
	POMODORO_VIEW_TYPE,
} from "../types";
import { RELEASE_NOTES_VIEW_TYPE } from "../views/ReleaseNotesView";
import { showNotice } from "../ui/notifications";

type WorkspaceLeafLike = {
	isDeferred?: boolean;
	loadIfDeferred(): Promise<void>;
	openFile?(file: TFile): Promise<void>;
	setViewState(state: { type: string; active?: boolean; state?: Record<string, unknown> }): Promise<void>;
	view?: {
		file?: TFile;
		getState?(): { file?: string; viewName?: string; [key: string]: unknown };
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

	/** Only repair selections, never rewrite the Base or its valid selected view. */
	async repairOpenBasesLeaves(paths: string[]): Promise<void> {
		const affected = new Set(paths.map(normalizePath));
		for (const leaf of this.plugin.app.workspace.getLeavesOfType("bases")) {
			const path = this.getLeafFilePath(leaf);
			if (!path || !affected.has(path)) continue;
			const file = this.plugin.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) await this.selectBasesView(leaf, file);
		}
	}

	private async selectBasesView(
		leaf: WorkspaceLeafLike,
		file: TFile,
		preferredView?: string
	): Promise<void> {
		if (file.extension !== "base" || !leaf.view?.getState || !leaf.setViewState) return;
		const text = await this.plugin.app.vault.read(file);
		let content: unknown;
		try {
			content = parseYaml(text);
		} catch {
			// Bases displays malformed user-authored YAML itself. Do not change its state.
			return;
		}
		if (!content || typeof content !== "object" || !("views" in content)) return;
		const views = content.views;
		if (!Array.isArray(views)) return;
		const names = views.flatMap((view: unknown) =>
			view && typeof view === "object" && "name" in view && typeof view.name === "string"
				? [view.name]
				: []
		);
		const state = leaf.view?.getState?.() ?? { file: file.path };
		const selected = preferredView ?? state.viewName;
		const viewName = selected && names.includes(selected) ? selected : names[0];
		if (viewName && viewName !== state.viewName) {
			await leaf.setViewState({ type: "bases", state: { ...state, file: file.path, viewName } });
		}
	}

	async openBasesFileForCommand(commandId: string, preferredView?: string): Promise<void> {
		const filePath = this.plugin.settings.commandFileMapping[commandId];
		if (!filePath) {
			showNotice(`No file configured for command: ${commandId}`);
			return;
		}

		const normalizedPath = normalizePath(filePath);
		const fileExists = await this.plugin.app.vault.adapter.exists(normalizedPath);
		if (!fileExists) {
			showNotice(
				`File not found: ${normalizedPath}\n\nPlease configure a valid file in Settings → TaskNotes → Appearance & interaction → Views & base files, or use the "Create Default Files" button.`,
				10000
			);
			return;
		}

		const file = this.plugin.app.vault.getAbstractFileByPath(normalizedPath);
		if (!file) {
			showNotice(
				`File not found in vault: ${normalizedPath}\n\nThe file exists but Obsidian cannot find it. Try reloading the vault.`
			);
			return;
		}
		if (!(file instanceof TFile)) {
			showNotice(`Path is not a file: ${normalizedPath}`);
			return;
		}

		const existingLeaf = this.findLeafForFile(normalizedPath);
		if (existingLeaf) {
			await this.revealLeafReady(existingLeaf);
			await this.selectBasesView(existingLeaf, file, preferredView);
			return;
		}

		const leaf = this.plugin.app.workspace.getLeaf("tab");
		await leaf.openFile(file);
		await this.selectBasesView(leaf, file, preferredView);
	}
}
