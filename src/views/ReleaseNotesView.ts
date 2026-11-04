import { formatUIDate } from "../i18n/formatters";
import { msg } from "@lingui/core/macro";
import { ItemView, WorkspaceLeaf, MarkdownRenderer, setIcon } from "obsidian";
import { parseISO } from "date-fns";
import TaskNotesPlugin from "../main";
import type { ReleaseNoteVersion } from "../releaseNotes";
import { getReleaseNotesAnnouncement } from "../i18n/releaseNotesAnnouncement";

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
		return this.plugin.i18n.translate(msg({ message: "What''s new in TaskNotes {version}", context: "views.releaseNotes.title" }), { version: this.version });
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
			return formatUIDate(date, "MMMM d, yyyy");
		} catch {
			return "";
		}
	}

	private async renderVersionContent(
		content: HTMLElement,
		versionData: ReleaseNoteVersion
	): Promise<void> {
		// Transform issue references into clickable links and render the markdown
		// The beta invitation now appears once above the version list. Preserve
		// historical source files (also used by GitHub), but omit their old callout.
		const notes = versionData.content.replace(
			/^> \[!info\] TaskNotes v5 beta\r?\n(?:>[^\n]*(?:\n|$))*/gm,
			""
		);
		const transformedNotes = this.transformIssueLinks(notes);
		const releaseContent = versionData.isCurrent
			? `${this.plugin.i18n.translate(msg({ message: "> [!info] About default `.base` files\n> Updates to default generated `.base` templates do not overwrite your existing `.base` files, so your customizations stay safe.\n> If you want the newest template improvements, regenerate base files in **Settings → TaskNotes → General → Views & base files → Update files**.", context: "views.releaseNotes.baseFilesNotice" }))}\n\n${transformedNotes}`
			: transformedNotes;
		await MarkdownRenderer.render(this.plugin.app, releaseContent, content, "", this);
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

		// Header (clickable to toggle)
		const header = section.createDiv({ cls: "release-notes-version-header" });
		// Left side: version and date
		const headerLeft = header.createDiv({ cls: "release-notes-version-info" });

		headerLeft.createEl("h2", {
			text: versionData.version,
		});

		if (versionData.isCurrent) {
			headerLeft.createSpan({
				cls: "release-notes-current",
				text: this.plugin.i18n.translate(msg({ message: "Current", context: "views.releaseNotes.current" })),
			});
		}

		if (versionData.date) {
			headerLeft.createSpan({
				cls: "release-notes-date",
				text: this.formatDate(versionData.date),
			});
		}

		// Right side: chevron icon
		const chevron = header.createSpan({ cls: "release-notes-chevron" });
		setIcon(chevron, isExpanded ? "chevron-down" : "chevron-right");

		// Content (collapsible)
		const content = section.createDiv({ cls: "release-notes-version-content" });
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
			setIcon(chevron, isCurrentlyExpanded ? "chevron-right" : "chevron-down");
			if (!isCurrentlyExpanded) {
				void renderIfNeeded();
			}
		});
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-plugin", "tasknotes-release-notes-view");

		// Create a container for the markdown content
		const container = contentEl.createDiv({ cls: "tasknotes-release-notes-container" });

		// Header with version
		const header = container.createDiv({ cls: "release-notes-header" });
		header.createEl("h1", {
			text: this.plugin.i18n.translate(msg({ message: "What''s new in TaskNotes {version}", context: "views.releaseNotes.header" }), {
				version: this.version,
			}),
		});

		// Star message with GitHub link
		const starMessage = container.createEl("p");
		const messageText = this.plugin.i18n.translate(msg({ message: "We really appreciate all feedback. If something does not feel right, please let us know on GitHub. If you find TaskNotes useful, please consider giving it a star.", context: "views.releaseNotes.starMessage" }));
		const githubIndex = messageText.toLowerCase().lastIndexOf("github");
		if (githubIndex !== -1) {
			starMessage.appendText(messageText.substring(0, githubIndex));
			const starLink = starMessage.createEl("a", {
				text: messageText.substring(githubIndex, githubIndex + 6),
				href: GITHUB_REPO_URL,
			});
			starLink.addEventListener("click", (e) => {
				e.preventDefault();
				window.open(GITHUB_REPO_URL, "_blank");
			});
			starMessage.appendText(messageText.substring(githubIndex + 6));
		} else {
			starMessage.appendText(messageText);
		}

		// One shared announcement, independent of the bundled release versions.
		const announcement = container.createEl("section", {
			cls: "release-notes-announcement",
		});
		await MarkdownRenderer.render(
			this.plugin.app,
			getReleaseNotesAnnouncement(),
			announcement,
			"",
			this
		);

		// Create all version sections
		const versionsContainer = container.createDiv({ cls: "release-notes-versions" });
		for (let i = 0; i < this.releaseNotesBundle.length; i++) {
			const versionData = this.releaseNotesBundle[i];
			// Current version and newest bundled version expanded, others collapsed
			const isExpanded = versionData.isCurrent || i === 0;
			await this.createVersionSection(versionsContainer, versionData, isExpanded);
		}

		// Footer with link to all releases
		const footer = container.createDiv({ cls: "release-notes-footer" });

		const link = footer.createEl("a", {
			text: this.plugin.i18n.translate(msg({ message: "View all release notes on GitHub →", context: "views.releaseNotes.viewAllLink" })),
			href: GITHUB_RELEASES_URL,
		});
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
