import { ItemView, WorkspaceLeaf, MarkdownRenderer } from "obsidian";
import { format, parseISO } from "date-fns";
import TaskNotesPlugin from "../main";
import { ReleaseNoteVersion } from "../releaseNotes";

export const RELEASE_NOTES_VIEW_TYPE = "tasknotes-release-notes";

const GITHUB_RELEASES_URL = "https://github.com/callumalpass/tasknotes/releases";
const GITHUB_REPO_URL = "https://github.com/callumalpass/tasknotes";

export class ReleaseNotesView extends ItemView {
	plugin: TaskNotesPlugin;
	private releaseNotesBundle: ReleaseNoteVersion[];
	private version: string;

	constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin, releaseNotesBundle: ReleaseNoteVersion[], version: string) {
		super(leaf);
		this.plugin = plugin;
		this.releaseNotesBundle = releaseNotesBundle;
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

	/**
	 * Transform issue references like (#123) into clickable GitHub issue links
	 */
	private transformIssueLinks(markdown: string): string {
		const repoUrl = "https://github.com/callumalpass/tasknotes";
		return markdown.replace(/\(#(\d+)\)/g, `([#$1](${repoUrl}/issues/$1))`);
	}

	/**
	 * Format date for display
	 */
	private formatDate(dateString: string | null): string {
		if (!dateString) return "";
		try {
			const date = parseISO(dateString);
			return format(date, "MMMM d, yyyy");
		} catch (error) {
			return "";
		}
	}

	/**
	 * Create a collapsible section for a release version
	 */
	private async createVersionSection(
		container: HTMLElement,
		versionData: ReleaseNoteVersion,
		isExpanded: boolean
	) {
		const section = container.createDiv({ cls: "release-notes-version-section" });
		section.style.marginBottom = "20px";
		section.style.border = "1px solid var(--background-modifier-border)";
		section.style.borderRadius = "6px";
		section.style.overflow = "hidden";

		// Header (clickable to toggle)
		const header = section.createDiv({ cls: "release-notes-version-header" });
		header.style.padding = "16px";
		header.style.cursor = "pointer";
		header.style.display = "flex";
		header.style.justifyContent = "space-between";
		header.style.alignItems = "center";
		header.style.backgroundColor = versionData.isCurrent
			? "var(--background-secondary)"
			: "var(--background-primary)";
		header.style.transition = "background-color 0.2s";

		header.addEventListener("mouseenter", () => {
			header.style.backgroundColor = "var(--background-secondary)";
		});
		header.addEventListener("mouseleave", () => {
			header.style.backgroundColor = versionData.isCurrent
				? "var(--background-secondary)"
				: "var(--background-primary)";
		});

		// Left side: version and date
		const headerLeft = header.createDiv({ cls: "release-notes-version-info" });
		headerLeft.style.display = "flex";
		headerLeft.style.alignItems = "baseline";
		headerLeft.style.gap = "12px";

		const versionTitle = headerLeft.createEl("h2", {
			text: versionData.version,
		});
		versionTitle.style.margin = "0";
		versionTitle.style.fontSize = "1.2em";
		versionTitle.style.fontWeight = "600";

		if (versionData.isCurrent) {
			const currentBadge = headerLeft.createEl("span", {
				text: "Current",
			});
			currentBadge.style.fontSize = "0.75em";
			currentBadge.style.padding = "2px 8px";
			currentBadge.style.borderRadius = "4px";
			currentBadge.style.backgroundColor = "var(--text-accent)";
			currentBadge.style.color = "var(--text-on-accent)";
			currentBadge.style.fontWeight = "500";
		}

		if (versionData.date) {
			const dateSpan = headerLeft.createEl("span", {
				text: this.formatDate(versionData.date),
			});
			dateSpan.style.color = "var(--text-muted)";
			dateSpan.style.fontSize = "0.9em";
		}

		// Right side: chevron icon
		const chevron = header.createEl("span", {
			text: isExpanded ? "▼" : "▶",
		});
		chevron.style.fontSize = "0.8em";
		chevron.style.color = "var(--text-muted)";

		// Content (collapsible)
		const content = section.createDiv({ cls: "release-notes-version-content" });
		content.style.padding = "0 16px 16px 16px";
		content.style.display = isExpanded ? "block" : "none";

		// Transform issue references into clickable links and render the markdown
		const transformedNotes = this.transformIssueLinks(versionData.content);
		await MarkdownRenderer.render(
			this.plugin.app,
			transformedNotes,
			content,
			"",
			this as any
		);

		// Toggle functionality
		header.addEventListener("click", () => {
			const isCurrentlyExpanded = content.style.display !== "none";
			content.style.display = isCurrentlyExpanded ? "none" : "block";
			chevron.textContent = isCurrentlyExpanded ? "▶" : "▼";
		});
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

		// Star message with GitHub link
		const starMessage = container.createEl("p");
		starMessage.style.marginBottom = "20px";
		starMessage.style.fontSize = "0.9em";
		starMessage.style.color = "var(--text-muted)";
		const messageText = this.plugin.i18n.translate("views.releaseNotes.starMessage");
		const githubIndex = messageText.toLowerCase().lastIndexOf("github");
		if (githubIndex !== -1) {
			starMessage.appendText(messageText.substring(0, githubIndex));
			const starLink = starMessage.createEl("a", {
				text: messageText.substring(githubIndex, githubIndex + 6),
				href: GITHUB_REPO_URL,
			});
			starLink.style.color = "var(--text-accent)";
			starLink.addEventListener("click", (e) => {
				e.preventDefault();
				window.open(GITHUB_REPO_URL, "_blank");
			});
			starMessage.appendText(messageText.substring(githubIndex + 6));
		} else {
			starMessage.appendText(messageText);
		}

		// Render all versions
		const versionsContainer = container.createEl("div", { cls: "release-notes-versions" });
		for (let i = 0; i < this.releaseNotesBundle.length; i++) {
			const versionData = this.releaseNotesBundle[i];
			// Current version and first patch in minor series expanded, others collapsed
			const isExpanded = versionData.isCurrent || i === 0;
			await this.createVersionSection(versionsContainer, versionData, isExpanded);
		}

		// Footer with link to all releases
		const footer = container.createEl("div", { cls: "release-notes-footer" });
		footer.style.borderTop = "1px solid var(--background-modifier-border)";
		footer.style.paddingTop = "20px";
		footer.style.marginTop = "30px";
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
