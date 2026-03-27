import { App, Modal, Setting } from "obsidian";

/**
 * Result from the filename collision recovery modal
 */
export interface CollisionRecoveryResult {
	action: "retry" | "change-format" | "open-settings" | "edit-task" | "cancel";
	newFormat?: "title" | "zettel" | "zettel-title" | "timestamp" | "custom";
	customTemplate?: string;
	retrySuffix?: string; // The suffix to append when retrying
	useDueDateForZettel?: boolean; // Whether to use due date for zettel ID
}

/**
 * Modal shown when a filename collision occurs during task creation.
 * Provides user-friendly recovery options instead of just showing an error.
 */
export class FilenameCollisionModal extends Modal {
	private result: CollisionRecoveryResult = { action: "cancel" };
	private resolvePromise: ((result: CollisionRecoveryResult) => void) | null = null;
	private useDueDateForZettel = false;

	constructor(
		app: App,
		private filename: string,
		private currentFormat: string,
		private retrySuffixFormat: "timestamp" | "random" | "zettel" = "timestamp",
		private dueDate?: string, // Optional due date (YYYY-MM-DD) for zettel date source option
		private currentZettelDateSource: "creation" | "due" = "creation"
	) {
		super(app);
		// Default to current setting
		this.useDueDateForZettel = currentZettelDateSource === "due" && !!dueDate;
	}

	/**
	 * Generate the suffix based on configured format
	 */
	private generateSuffix(): string {
		const now = new Date();
		switch (this.retrySuffixFormat) {
			case "random":
				return Math.floor(Math.random() * 46656).toString(36).padStart(3, "0");
			case "zettel": {
				// Determine which date to use for the date portion
				let dateForZettel = now;
				if (this.useDueDateForZettel && this.dueDate) {
					const [year, month, day] = this.dueDate.split("-").map(Number);
					if (year && month && day) {
						dateForZettel = new Date(year, month - 1, day);
					}
				}
				const datePart = dateForZettel.toISOString().slice(2, 10).replace(/-/g, "").slice(0, 6);
				// Use milliseconds since midnight for uniqueness
				const midnight = new Date(now);
				midnight.setHours(0, 0, 0, 0);
				const msSinceMidnight = now.getTime() - midnight.getTime();
				return `${datePart}${msSinceMidnight.toString(36)}`;
			}
			case "timestamp":
			default:
				return Date.now().toString(36);
		}
	}

	/**
	 * Open the modal and wait for user action
	 */
	async waitForResult(): Promise<CollisionRecoveryResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-collision-modal");

		// Header with TaskNotes branding
		contentEl.createEl("h2", { text: "TaskNotes: Filename collision" });

		// Explanation
		contentEl.createEl("p", {
			text: `Could not create "${this.filename}.md" because a file with a similar name already exists.`,
		});

		contentEl.createEl("p", {
			text: `This can happen on Windows when filenames differ only by case (e.g., "Test" vs "test"). Current format: ${this.currentFormat}`,
			cls: "setting-item-description",
		});

		// Section: Change format permanently (with top margin for spacing)
		const permanentSection = contentEl.createDiv({ cls: "tasknotes-collision-section" });
		permanentSection.style.marginTop = "1em";
		permanentSection.createEl("h4", { text: "Change format for all future tasks:" });

		// Option 1: Switch to zettel-title format (recommended)
		new Setting(permanentSection)
			.setName("Zettel-title (recommended)")
			.setDesc("Sortable date ID + title (e.g., 260202abc-My Task)")
			.addButton((btn) =>
				btn
					.setButtonText("Use zettel-title")
					.setCta()
					.onClick(() => {
						this.result = { action: "change-format", newFormat: "zettel-title" };
						this.close();
					})
			);

		// Option 2: Switch to zettel format (no title)
		new Setting(permanentSection)
			.setName("Zettel only")
			.setDesc("Date-based IDs only (e.g., 260202abc)")
			.addButton((btn) =>
				btn.setButtonText("Use zettel").onClick(() => {
					this.result = { action: "change-format", newFormat: "zettel" };
					this.close();
				})
			);

		// Option 3: Switch to timestamp format
		new Setting(permanentSection)
			.setName("Timestamp")
			.setDesc("Full timestamp (e.g., 2026-02-02-143052)")
			.addButton((btn) =>
				btn.setButtonText("Use timestamp").onClick(() => {
					this.result = { action: "change-format", newFormat: "timestamp" };
					this.close();
				})
			);

		// Option 4: Switch to title format (original, may still collide)
		new Setting(permanentSection)
			.setName("Title only")
			.setDesc("Uses task title as filename (may still collide)")
			.addButton((btn) =>
				btn.setButtonText("Use title").onClick(() => {
					this.result = { action: "change-format", newFormat: "title" };
					this.close();
				})
			);

		// Option 5: Switch to custom format
		new Setting(permanentSection)
			.setName("Custom template")
			.setDesc("Define your own format in settings")
			.addButton((btn) =>
				btn.setButtonText("Use custom").onClick(() => {
					this.result = { action: "change-format", newFormat: "custom" };
					this.close();
				})
			);

		// Section: One-time fix
		const onetimeSection = contentEl.createDiv({ cls: "tasknotes-collision-section" });
		onetimeSection.style.marginTop = "1.5em";
		onetimeSection.createEl("h4", { text: "One-time fix (keeps current format):" });

		// Date source option for zettel formats (only show if using zettel-based suffix)
		if (this.retrySuffixFormat === "zettel") {
			const dateSourceSetting = new Setting(onetimeSection)
				.setName("Use task date for zettel ID")
				.setDesc(this.dueDate
					? `Use ${this.dueDate} (due/scheduled) instead of today for the YYMMDD portion`
					: "No due/scheduled date set - will use creation date");

			if (this.dueDate) {
				dateSourceSetting.addToggle((toggle) =>
					toggle
						.setValue(this.useDueDateForZettel)
						.onChange((value) => {
							this.useDueDateForZettel = value;
							// Re-render the retry preview
							this.renderRetryPreview(onetimeSection);
						})
				);
			} else {
				// Show disabled toggle when no due date
				dateSourceSetting.addToggle((toggle) =>
					toggle
						.setValue(false)
						.setDisabled(true)
				);
			}
		}

		// Preview container for retry option
		this.renderRetryPreview(onetimeSection);

		// Section: Other options
		const otherSection = contentEl.createDiv({ cls: "tasknotes-collision-section" });
		otherSection.style.marginTop = "1.5em";

		// Edit task button - return to edit the task
		new Setting(otherSection)
			.setName("Edit task")
			.setDesc("Go back to edit the task title or other details")
			.addButton((btn) =>
				btn.setButtonText("Edit task").onClick(() => {
					this.result = { action: "edit-task" };
					this.close();
				})
			);

		// Open settings
		new Setting(otherSection)
			.setName("Open settings")
			.setDesc("Configure filename format in plugin settings")
			.addButton((btn) =>
				btn.setButtonText("Settings").onClick(() => {
					this.result = { action: "open-settings" };
					this.close();
				})
			);

		// Cancel button
		new Setting(otherSection).addButton((btn) =>
			btn.setButtonText("Cancel").onClick(() => {
				this.result = { action: "cancel" };
				this.close();
			})
		);
	}

	/**
	 * Render the retry preview with current date source setting
	 */
	private retryPreviewEl: HTMLElement | null = null;
	private renderRetryPreview(container: HTMLElement): void {
		// Remove existing preview if any
		if (this.retryPreviewEl) {
			this.retryPreviewEl.remove();
		}

		const suffix = this.generateSuffix();
		const previewFilename = `${this.filename}-${suffix}`;

		this.retryPreviewEl = container.createDiv();
		new Setting(this.retryPreviewEl)
			.setName("Retry with suffix")
			.setDesc(`Creates: ${previewFilename}.md`)
			.addButton((btn) =>
				btn.setButtonText("Retry once").onClick(() => {
					this.result = {
						action: "retry",
						retrySuffix: suffix,
						useDueDateForZettel: this.useDueDateForZettel,
					};
					this.close();
				})
			);
	}

	onClose(): void {
		if (this.resolvePromise) {
			this.resolvePromise(this.result);
			this.resolvePromise = null;
		}
	}
}
