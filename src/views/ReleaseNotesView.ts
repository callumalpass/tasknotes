import { ItemView, WorkspaceLeaf, MarkdownRenderer } from "obsidian";
import { format, parseISO } from "date-fns";
import TaskNotesPlugin from "../main";
import type { ReleaseNoteVersion } from "../releaseNotes";

export const RELEASE_NOTES_VIEW_TYPE = "tasknotes-release-notes";

const GITHUB_RELEASES_URL = "https://github.com/callumalpass/tasknotes/releases";
const GITHUB_REPO_URL = "https://github.com/callumalpass/tasknotes";

/**
 * Transform parenthesized issue/PR references like (#123) or (#123, #456)
 * into clickable GitHub links while preserving the surrounding parentheses.
 */
export function transformReleaseNoteIssueLinks(
	markdown: string,
	repoUrl = GITHUB_REPO_URL
): string {
	return markdown.replace(/\(((?:#\d+\s*)(?:,\s*#\d+\s*)*)\)/g, (_match, refs: string) => {
		const linkedRefs = refs
			.split(",")
			.map((ref) => ref.trim())
			.filter(Boolean)
			.map((ref) => {
				const issueNumber = ref.slice(1);
				return `[#${issueNumber}](${repoUrl}/issues/${issueNumber})`;
			})
			.join(", ");

		return `(${linkedRefs})`;
	});
}

export class ReleaseNotesView extends ItemView {
	plugin: TaskNotesPlugin;
	private releaseNotesBundle: ReleaseNoteVersion[];
	private version: string;

	constructor(
		leaf: WorkspaceLeaf,
		plugin: TaskNotesPlugin,
		releaseNotesBundle: ReleaseNoteVersion[],
		version: string
	) {
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
		return transformReleaseNoteIssueLinks(markdown);
	}

	/**
	 * Format date for display
	 */
	private formatDate(dateString: string | null): string {
		if (!dateString) return "";
		try {
			const date = parseISO(dateString);
			return format(date, "MMMM d, yyyy");
		} catch {
			return "";
		}
	}

	private async renderVersionContent(
		content: HTMLElement,
		versionData: ReleaseNoteVersion
	): Promise<void> {
		// Transform issue references into clickable links and render the markdown
		const transformedNotes = this.transformIssueLinks(versionData.content);
		const releaseContent = versionData.isCurrent
			? `${this.plugin.i18n.translate("views.releaseNotes.baseFilesNotice")}\n\n${transformedNotes}`
			: transformedNotes;
		await MarkdownRenderer.render(
			this.plugin.app,
			releaseContent,
			content,
			"",
			this
		);
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
		section.classList.remove(
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-bottom-0-75rem-c05a3c6e",
			"tn-static-margin-bottom-8px-fdf33f23"
		);
		section.classList.add("tn-static-margin-bottom-20px-49f14f8f");
		section.classList.remove(
			"tn-static-border-none-2eda1daa",
			"tn-static-padding-12px-43bef435"
		);
		section.classList.add("tn-static-border-1px-solid-var-background-mo-b65b5121");
		section.classList.remove(
			"tn-static-border-radius-4px-c290c56e",
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-padding-12px-43bef435",
			"tn-static-padding-20px-ebe8e48c"
		);
		section.classList.add("tn-static-border-radius-6px-0dc8408c");
		section.classList.remove("tn-static-flex-1-14e3b769");
		section.classList.add("tn-static-overflow-hidden-69824400");

		// Header (clickable to toggle)
		const header = section.createDiv({ cls: "release-notes-version-header" });
		header.classList.remove(
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-padding-0-16px-16px-16px-f1aa998c",
			"tn-static-padding-0-41d7d7e2",
			"tn-static-padding-12px-43bef435",
			"tn-static-padding-20px-769fed37",
			"tn-static-padding-20px-7a035d95",
			"tn-static-padding-20px-ebe8e48c",
			"tn-static-padding-2px-8px-c8eea84a",
			"tn-static-padding-2rem-42aa6d9c"
		);
		header.classList.add("tn-static-padding-16px-287f770e");
		header.classList.remove(
			"tn-static-cursor-grab-dad79857",
			"tn-static-cursor-pointer-2723efcc"
		);
		header.classList.add("tn-static-cursor-pointer-3b6a3a65");
		header.classList.remove(
			"tn-static-display-block-2a1b75c9",
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		header.classList.add("tn-static-display-flex-75816cae");
		header.classList.remove(
			"tn-static-justify-content-center-03c4bb6f",
			"tn-static-justify-content-flex-end-455f8cca"
		);
		header.classList.add("tn-static-justify-content-space-between-a562f4fd");
		header.classList.remove(
			"tn-static-align-items-baseline-4b95b5c7",
			"tn-static-align-items-flex-start-0486f781"
		);
		header.classList.add("tn-static-align-items-center-7c619740");
		header.style.backgroundColor = versionData.isCurrent
			? "var(--background-secondary)"
			: "var(--background-primary)";
		header.classList.add("tn-static-transition-background-color-0-2s-8142f01e");

		header.addEventListener("mouseenter", () => {
			header.classList.remove(
				"tn-static-background-color-var-background-mo-94b219f0",
				"tn-static-background-color-var-color-base-40-ef5f175e",
				"tn-static-background-color-var-color-red-134bc721",
				"tn-static-background-color-var-text-accent-a954c70f"
			);
			header.classList.add("tn-static-background-color-var-background-se-9087a23e");
		});
		header.addEventListener("mouseleave", () => {
			header.style.backgroundColor = versionData.isCurrent
				? "var(--background-secondary)"
				: "var(--background-primary)";
		});

		// Left side: version and date
		const headerLeft = header.createDiv({ cls: "release-notes-version-info" });
		headerLeft.classList.remove(
			"tn-static-display-block-2a1b75c9",
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		headerLeft.classList.add("tn-static-display-flex-75816cae");
		headerLeft.classList.remove(
			"tn-static-align-items-center-7c619740",
			"tn-static-align-items-flex-start-0486f781"
		);
		headerLeft.classList.add("tn-static-align-items-baseline-4b95b5c7");
		headerLeft.classList.remove(
			"tn-static-display-flex-8bb39979",
			"tn-static-gap-0-5rem-ce2fca4d",
			"tn-static-gap-10px-f3d7ce77",
			"tn-static-gap-6px-f0abc1db",
			"tn-static-gap-8px-33fcd4c3"
		);
		headerLeft.classList.add("tn-static-gap-12px-ed7b3d87");

		const versionTitle = headerLeft.createEl("h2", {
			text: versionData.version,
		});
		versionTitle.classList.remove(
			"tn-static-margin-0-auto-266e9b04",
			"tn-static-margin-0-db0d5f36",
			"tn-static-margin-0-var-size-4-2-77f7dc08",
			"tn-static-margin-2px-0-edce9b14",
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-padding-12px-43bef435",
			"tn-static-padding-20px-ebe8e48c"
		);
		versionTitle.classList.add("tn-static-margin-0-11696618");
		versionTitle.classList.remove(
			"tn-static-font-size-0-75em-948e16e5",
			"tn-static-font-size-0-8em-19dc7c13",
			"tn-static-font-size-0-9em-65025e95",
			"tn-static-font-size-12px-65574819",
			"tn-static-font-size-12px-b0cc7e05",
			"tn-static-font-size-var-tn-font-size-sm-0274a31d",
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-margin-top-8px-f4f01e68"
		);
		versionTitle.classList.add("tn-static-font-size-1-2em-3a352995");
		versionTitle.classList.remove(
			"tn-static-cursor-pointer-2723efcc",
			"tn-static-font-weight-500-02a2d333",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd"
		);
		versionTitle.classList.add("tn-static-font-weight-600-eed0f8fb");

		if (versionData.isCurrent) {
			const currentBadge = headerLeft.createEl("span", {
				text: "Current",
			});
			currentBadge.classList.remove(
				"tn-static-font-size-0-8em-19dc7c13",
				"tn-static-font-size-0-9em-65025e95",
				"tn-static-font-size-1-2em-3a352995",
				"tn-static-font-size-12px-65574819",
				"tn-static-font-size-12px-b0cc7e05",
				"tn-static-font-size-var-tn-font-size-sm-0274a31d",
				"tn-static-margin-8px-0-0-0-a2eb8382",
				"tn-static-margin-top-8px-f4f01e68"
			);
			currentBadge.classList.add("tn-static-font-size-0-75em-948e16e5");
			currentBadge.classList.remove(
				"tn-static-margin-8px-0-0-0-a2eb8382",
				"tn-static-padding-0-16px-16px-16px-f1aa998c",
				"tn-static-padding-0-41d7d7e2",
				"tn-static-padding-12px-43bef435",
				"tn-static-padding-16px-287f770e",
				"tn-static-padding-20px-769fed37",
				"tn-static-padding-20px-7a035d95",
				"tn-static-padding-20px-ebe8e48c",
				"tn-static-padding-2rem-42aa6d9c"
			);
			currentBadge.classList.add("tn-static-padding-2px-8px-c8eea84a");
			currentBadge.classList.remove(
				"tn-static-border-radius-6px-0dc8408c",
				"tn-static-margin-8px-0-0-0-a2eb8382",
				"tn-static-padding-12px-43bef435",
				"tn-static-padding-20px-ebe8e48c"
			);
			currentBadge.classList.add("tn-static-border-radius-4px-c290c56e");
			currentBadge.classList.remove(
				"tn-static-background-color-var-background-mo-94b219f0",
				"tn-static-background-color-var-background-se-9087a23e",
				"tn-static-background-color-var-color-base-40-ef5f175e",
				"tn-static-background-color-var-color-red-134bc721"
			);
			currentBadge.classList.add("tn-static-background-color-var-text-accent-a954c70f");
			currentBadge.classList.remove(
				"tn-static-color-var-color-accent-d2cad743",
				"tn-static-color-var-text-accent-65b47ee3",
				"tn-static-color-var-text-muted-5872de20",
				"tn-static-color-var-text-warning-783d5f03",
				"tn-static-color-var-tn-text-muted-a90fb6f3",
				"tn-static-color-white-0a43e56a",
				"tn-static-cursor-pointer-2723efcc",
				"tn-static-font-size-12px-65574819",
				"tn-static-font-weight-bold-0fe8c30d",
				"tn-static-font-weight-bold-e0b452bd",
				"tn-static-margin-2px-0-edce9b14",
				"tn-static-padding-20px-7a035d95",
				"tn-static-padding-20px-ebe8e48c"
			);
			currentBadge.classList.add("tn-static-color-var-text-on-accent-f3e1679d");
			currentBadge.classList.remove(
				"tn-static-cursor-pointer-2723efcc",
				"tn-static-font-weight-600-eed0f8fb",
				"tn-static-font-weight-bold-0fe8c30d",
				"tn-static-font-weight-bold-e0b452bd"
			);
			currentBadge.classList.add("tn-static-font-weight-500-02a2d333");
		}

		if (versionData.date) {
			const dateSpan = headerLeft.createEl("span", {
				text: this.formatDate(versionData.date),
			});
			dateSpan.classList.remove(
				"tn-static-color-var-color-accent-d2cad743",
				"tn-static-color-var-text-accent-65b47ee3",
				"tn-static-color-var-text-on-accent-f3e1679d",
				"tn-static-color-var-text-warning-783d5f03",
				"tn-static-color-var-tn-text-muted-a90fb6f3",
				"tn-static-color-white-0a43e56a",
				"tn-static-cursor-pointer-2723efcc",
				"tn-static-font-size-12px-65574819",
				"tn-static-font-weight-bold-0fe8c30d",
				"tn-static-font-weight-bold-e0b452bd",
				"tn-static-margin-2px-0-edce9b14",
				"tn-static-padding-20px-7a035d95",
				"tn-static-padding-20px-ebe8e48c"
			);
			dateSpan.classList.add("tn-static-color-var-text-muted-5872de20");
			dateSpan.classList.remove(
				"tn-static-font-size-0-75em-948e16e5",
				"tn-static-font-size-0-8em-19dc7c13",
				"tn-static-font-size-1-2em-3a352995",
				"tn-static-font-size-12px-65574819",
				"tn-static-font-size-12px-b0cc7e05",
				"tn-static-font-size-var-tn-font-size-sm-0274a31d",
				"tn-static-margin-8px-0-0-0-a2eb8382",
				"tn-static-margin-top-8px-f4f01e68"
			);
			dateSpan.classList.add("tn-static-font-size-0-9em-65025e95");
		}

		// Right side: chevron icon
		const chevron = header.createEl("span", {
			text: isExpanded ? "▼" : "▶",
		});
		chevron.classList.remove(
			"tn-static-font-size-0-75em-948e16e5",
			"tn-static-font-size-0-9em-65025e95",
			"tn-static-font-size-1-2em-3a352995",
			"tn-static-font-size-12px-65574819",
			"tn-static-font-size-12px-b0cc7e05",
			"tn-static-font-size-var-tn-font-size-sm-0274a31d",
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-margin-top-8px-f4f01e68"
		);
		chevron.classList.add("tn-static-font-size-0-8em-19dc7c13");
		chevron.classList.remove(
			"tn-static-color-var-color-accent-d2cad743",
			"tn-static-color-var-text-accent-65b47ee3",
			"tn-static-color-var-text-on-accent-f3e1679d",
			"tn-static-color-var-text-warning-783d5f03",
			"tn-static-color-var-tn-text-muted-a90fb6f3",
			"tn-static-color-white-0a43e56a",
			"tn-static-cursor-pointer-2723efcc",
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-2px-0-edce9b14",
			"tn-static-padding-20px-7a035d95",
			"tn-static-padding-20px-ebe8e48c"
		);
		chevron.classList.add("tn-static-color-var-text-muted-5872de20");

		// Content (collapsible)
		const content = section.createDiv({ cls: "release-notes-version-content" });
		content.classList.remove(
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-padding-0-41d7d7e2",
			"tn-static-padding-12px-43bef435",
			"tn-static-padding-16px-287f770e",
			"tn-static-padding-20px-769fed37",
			"tn-static-padding-20px-7a035d95",
			"tn-static-padding-20px-ebe8e48c",
			"tn-static-padding-2px-8px-c8eea84a",
			"tn-static-padding-2rem-42aa6d9c"
		);
		content.classList.add("tn-static-padding-0-16px-16px-16px-f1aa998c");
		content.style.display = isExpanded ? "block" : "none";

		let renderPromise: Promise<void> | null = null;
		const renderIfNeeded = () => {
			if (!renderPromise) {
				renderPromise = this.renderVersionContent(content, versionData);
			}
			return renderPromise;
		};

		if (isExpanded) {
			await renderIfNeeded();
		}

		// Toggle functionality
		header.addEventListener("click", () => {
			const isCurrentlyExpanded = content.style.display !== "none";
			content.style.display = isCurrentlyExpanded ? "none" : "block";
			chevron.textContent = isCurrentlyExpanded ? "▶" : "▼";
			if (!isCurrentlyExpanded) {
				void renderIfNeeded();
			}
		});
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-release-notes-view");

		// Create a container for the markdown content
		const container = contentEl.createDiv({ cls: "tasknotes-release-notes-container" });
		container.classList.remove(
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-padding-0-16px-16px-16px-f1aa998c",
			"tn-static-padding-0-41d7d7e2",
			"tn-static-padding-12px-43bef435",
			"tn-static-padding-16px-287f770e",
			"tn-static-padding-20px-7a035d95",
			"tn-static-padding-20px-ebe8e48c",
			"tn-static-padding-2px-8px-c8eea84a",
			"tn-static-padding-2rem-42aa6d9c"
		);
		container.classList.add("tn-static-padding-20px-769fed37");
		container.classList.add("tn-static-max-width-900px-1d34c094");
		container.classList.remove(
			"tn-static-margin-0-11696618",
			"tn-static-margin-0-db0d5f36",
			"tn-static-margin-0-var-size-4-2-77f7dc08",
			"tn-static-margin-2px-0-edce9b14",
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-padding-12px-43bef435",
			"tn-static-padding-20px-ebe8e48c"
		);
		container.classList.add("tn-static-margin-0-auto-266e9b04");

		// Header with version
		const header = container.createEl("div", { cls: "release-notes-header" });
		header.classList.remove(
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-bottom-0-75rem-c05a3c6e",
			"tn-static-margin-bottom-8px-fdf33f23"
		);
		header.classList.add("tn-static-margin-bottom-20px-49f14f8f");
		header.createEl("h1", {
			text: this.plugin.i18n.translate("views.releaseNotes.header", {
				version: this.version,
			}),
		});

		// Star message with GitHub link
		const starMessage = container.createEl("p");
		starMessage.classList.remove(
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-bottom-0-75rem-c05a3c6e",
			"tn-static-margin-bottom-8px-fdf33f23"
		);
		starMessage.classList.add("tn-static-margin-bottom-20px-49f14f8f");
		starMessage.classList.remove(
			"tn-static-font-size-0-75em-948e16e5",
			"tn-static-font-size-0-8em-19dc7c13",
			"tn-static-font-size-1-2em-3a352995",
			"tn-static-font-size-12px-65574819",
			"tn-static-font-size-12px-b0cc7e05",
			"tn-static-font-size-var-tn-font-size-sm-0274a31d",
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-margin-top-8px-f4f01e68"
		);
		starMessage.classList.add("tn-static-font-size-0-9em-65025e95");
		starMessage.classList.remove(
			"tn-static-color-var-color-accent-d2cad743",
			"tn-static-color-var-text-accent-65b47ee3",
			"tn-static-color-var-text-on-accent-f3e1679d",
			"tn-static-color-var-text-warning-783d5f03",
			"tn-static-color-var-tn-text-muted-a90fb6f3",
			"tn-static-color-white-0a43e56a",
			"tn-static-cursor-pointer-2723efcc",
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-2px-0-edce9b14",
			"tn-static-padding-20px-7a035d95",
			"tn-static-padding-20px-ebe8e48c"
		);
		starMessage.classList.add("tn-static-color-var-text-muted-5872de20");
		const messageText = this.plugin.i18n.translate("views.releaseNotes.starMessage");
		const githubIndex = messageText.toLowerCase().lastIndexOf("github");
		if (githubIndex !== -1) {
			starMessage.appendText(messageText.substring(0, githubIndex));
			const starLink = starMessage.createEl("a", {
				text: messageText.substring(githubIndex, githubIndex + 6),
				href: GITHUB_REPO_URL,
			});
			starLink.classList.remove(
				"tn-static-color-var-color-accent-d2cad743",
				"tn-static-color-var-text-muted-5872de20",
				"tn-static-color-var-text-on-accent-f3e1679d",
				"tn-static-color-var-text-warning-783d5f03",
				"tn-static-color-var-tn-text-muted-a90fb6f3",
				"tn-static-color-white-0a43e56a",
				"tn-static-cursor-pointer-2723efcc",
				"tn-static-font-size-12px-65574819",
				"tn-static-font-weight-bold-0fe8c30d",
				"tn-static-font-weight-bold-e0b452bd",
				"tn-static-margin-2px-0-edce9b14",
				"tn-static-padding-20px-7a035d95",
				"tn-static-padding-20px-ebe8e48c"
			);
			starLink.classList.add("tn-static-color-var-text-accent-65b47ee3");
			starLink.addEventListener("click", (e) => {
				e.preventDefault();
				window.open(GITHUB_REPO_URL, "_blank");
			});
			starMessage.appendText(messageText.substring(githubIndex + 6));
		} else {
			starMessage.appendText(messageText);
		}

		// Create all version sections
		const versionsContainer = container.createEl("div", { cls: "release-notes-versions" });
		for (let i = 0; i < this.releaseNotesBundle.length; i++) {
			const versionData = this.releaseNotesBundle[i];
			// Current version and newest bundled version expanded, others collapsed
			const isExpanded = versionData.isCurrent || i === 0;
			await this.createVersionSection(versionsContainer, versionData, isExpanded);
		}

		// Footer with link to all releases
		const footer = container.createEl("div", { cls: "release-notes-footer" });
		footer.classList.add("tn-static-border-top-1px-solid-var-backgroun-aab7c2ca");
		footer.classList.add("tn-static-padding-top-20px-49826953");
		footer.classList.remove(
			"tn-static-font-size-12px-b0cc7e05",
			"tn-static-margin-top-0-5rem-3dc98b5e",
			"tn-static-margin-top-0-d462248a",
			"tn-static-margin-top-12px-91e0f558",
			"tn-static-margin-top-16px-1b0f4999",
			"tn-static-margin-top-1rem-2239d6d5",
			"tn-static-margin-top-20px-a26bda7d",
			"tn-static-margin-top-4px-96ad6099",
			"tn-static-margin-top-8px-8a77e5a3",
			"tn-static-margin-top-8px-f4f01e68"
		);
		footer.classList.add("tn-static-margin-top-30px-2fbbbcd4");
		footer.classList.remove("tn-static-padding-20px-7a035d95");
		footer.classList.add("tn-static-text-align-center-91a87015");

		const link = footer.createEl("a", {
			text: this.plugin.i18n.translate("views.releaseNotes.viewAllLink"),
			href: GITHUB_RELEASES_URL,
		});
		link.classList.remove(
			"tn-static-color-var-color-accent-d2cad743",
			"tn-static-color-var-text-muted-5872de20",
			"tn-static-color-var-text-on-accent-f3e1679d",
			"tn-static-color-var-text-warning-783d5f03",
			"tn-static-color-var-tn-text-muted-a90fb6f3",
			"tn-static-color-white-0a43e56a",
			"tn-static-cursor-pointer-2723efcc",
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-2px-0-edce9b14",
			"tn-static-padding-20px-7a035d95",
			"tn-static-padding-20px-ebe8e48c"
		);
		link.classList.add("tn-static-color-var-text-accent-65b47ee3");
		link.classList.remove("tn-static-text-decoration-line-through-7059a4e5");
		link.classList.add("tn-static-text-decoration-none-80d654f9");
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
