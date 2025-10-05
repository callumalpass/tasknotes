import { setIcon } from "obsidian";
import TaskNotesPlugin from "../main";
import { TimeBlock } from "../types";
import { showTimeblockInfoModal } from "../bases/calendar-core";

export interface TimeBlockCardOptions {
	showDescription: boolean;
	showAttachments: boolean;
	eventDate?: Date;
	originalDate?: string;
}

export const DEFAULT_TIMEBLOCK_CARD_OPTIONS: TimeBlockCardOptions = {
	showDescription: true,
	showAttachments: true,
};

/**
 * Create a timeblock card for Bases calendar list view
 * Shows timeblock title, time range, and optional description/attachments
 */
export function createTimeBlockCard(
	timeblock: TimeBlock,
	plugin: TaskNotesPlugin,
	options: Partial<TimeBlockCardOptions> = {}
): HTMLElement {
	const opts = { ...DEFAULT_TIMEBLOCK_CARD_OPTIONS, ...options };

	const card = document.createElement("div");
	card.className = "task-card task-card--timeblock";

	(card as any).dataset.key = `timeblock-${timeblock.id}`;

	// Main row
	const mainRow = card.createEl("div", { cls: "task-card__main-row" });

	// Left indicator area: clock icon
	const leftIconWrap = mainRow.createEl("span", { cls: "timeblock-card__icon" });
	const leftIcon = leftIconWrap.createDiv();
	setIcon(leftIcon, "clock");

	// Styling for icon area
	leftIconWrap.style.display = "inline-flex";
	leftIconWrap.style.width = "16px";
	leftIconWrap.style.height = "16px";
	leftIconWrap.style.marginRight = "8px";
	leftIconWrap.style.alignItems = "center";
	leftIconWrap.style.justifyContent = "center";
	leftIconWrap.style.flexShrink = "0";
	leftIcon.style.width = "100%";
	leftIcon.style.height = "100%";
	leftIcon.style.color = timeblock.color || "var(--color-accent)";

	// Content
	const content = mainRow.createEl("div", { cls: "task-card__content" });

	// Title with time range
	const titleText = timeblock.title || "Timeblock";
	const timeRange = `${timeblock.startTime} - ${timeblock.endTime}`;
	content.createEl("div", {
		cls: "task-card__title",
		text: titleText,
	});

	// Metadata line: time range
	const metadata = content.createEl("div", { cls: "task-card__metadata" });
	metadata.textContent = timeRange;

	// Description (if available and enabled)
	if (opts.showDescription && timeblock.description) {
		const description = content.createEl("div", {
			cls: "task-card__description",
			text: timeblock.description,
		});
		description.style.fontSize = "var(--tn-font-size-sm)";
		description.style.color = "var(--tn-text-muted)";
		description.style.marginTop = "4px";
	}

	// Attachments (if available and enabled)
	if (opts.showAttachments && timeblock.attachments && timeblock.attachments.length > 0) {
		const attachmentsEl = content.createEl("div", {
			cls: "timeblock-card__attachments",
		});
		attachmentsEl.style.fontSize = "var(--tn-font-size-sm)";
		attachmentsEl.style.color = "var(--tn-text-muted)";
		attachmentsEl.style.marginTop = "4px";

		const attachmentText =
			timeblock.attachments.length === 1
				? "1 attachment"
				: `${timeblock.attachments.length} attachments`;
		attachmentsEl.textContent = `📎 ${attachmentText}`;
	}

	// Click handler - open timeblock modal
	card.addEventListener("click", (e) => {
		if (opts.eventDate && opts.originalDate) {
			showTimeblockInfoModal(timeblock, opts.eventDate, opts.originalDate, plugin);
		}
	});

	// Apply custom color if provided (used for icon color)
	if (timeblock.color) {
		card.style.setProperty("--current-status-color", timeblock.color);
	} else {
		card.style.setProperty("--current-status-color", "var(--color-accent)");
	}

	return card;
}
