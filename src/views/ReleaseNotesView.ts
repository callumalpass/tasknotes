import { ItemView, WorkspaceLeaf, MarkdownRenderer } from "obsidian";
import TaskNotesPlugin from "../main";

export const RELEASE_NOTES_VIEW_TYPE = "tasknotes-release-notes";

const GITHUB_RELEASES_URL = "https://github.com/callumalpass/tasknotes/releases";

export class ReleaseNotesView extends ItemView {
	plugin: TaskNotesPlugin;
	private releaseNotes: string;
	private version: string;

	constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin, releaseNotes: string, version: string) {
		super(leaf);
		this.plugin = plugin;
		this.releaseNotes = releaseNotes;
		this.version = version;
	}

	getViewType(): string {
		return RELEASE_NOTES_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.plugin.i18n.translate("views.releaseNotes.title", { version: this.version });
	}

	getIcon(): string {
		return "book-open";
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-release-notes-view");

		// Create a container for the markdown content
		const container = contentEl.createDiv({ cls: "tasknotes-release-notes-container" });
		container.style.padding = "20px";
		container.style.maxWidth = "900px";
		container.style.margin = "0 auto";

		// Header with version
		const header = container.createEl("div", { cls: "release-notes-header" });
		header.style.marginBottom = "20px";
		header.createEl("h1", {
			text: this.plugin.i18n.translate("views.releaseNotes.header", { version: this.version })
		});

		// Markdown content
		const markdownContainer = container.createEl("div", { cls: "release-notes-content" });
		markdownContainer.style.marginBottom = "30px";

		// Render the markdown
		await MarkdownRenderer.render(
			this.plugin.app,
			this.releaseNotes,
			markdownContainer,
			"",
			this as any
		);

		// Footer with link to all releases
		const footer = container.createEl("div", { cls: "release-notes-footer" });
		footer.style.borderTop = "1px solid var(--background-modifier-border)";
		footer.style.paddingTop = "20px";
		footer.style.textAlign = "center";

		const link = footer.createEl("a", {
			text: this.plugin.i18n.translate("views.releaseNotes.viewAllLink"),
			href: GITHUB_RELEASES_URL,
		});
		link.style.color = "var(--text-accent)";
		link.style.textDecoration = "none";
		link.addEventListener("click", (e) => {
			e.preventDefault();
			window.open(GITHUB_RELEASES_URL, "_blank");
		});
	}

	async onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
