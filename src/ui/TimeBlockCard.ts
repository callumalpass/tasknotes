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

	const card = activeDocument.createElement("div");
	card.className = "task-card task-card--timeblock";

	card.dataset.key = `timeblock-${timeblock.id}`;

	// Main row
	const mainRow = card.createEl("div", { cls: "task-card__main-row" });

	// Left indicator area: clock icon
	const leftIconWrap = mainRow.createEl("span", { cls: "timeblock-card__icon" });
	const leftIcon = leftIconWrap.createDiv();
	setIcon(leftIcon, "clock");

	// Styling for icon area
	leftIconWrap.classList.remove(
		"tn-static-display-block-2a1b75c9",
		"tn-static-display-flex-4d51fc62",
		"tn-static-display-flex-75816cae",
		"tn-static-display-flex-8bb39979",
		"tn-static-display-inline-block-60e32dcb",
		"tn-static-display-inline-cccfa456",
		"tn-static-display-none-6b99de8b",
		"tn-static-min-height-800px-997b4c8c"
	);
	leftIconWrap.classList.add("tn-static-display-inline-flex-f984c520");
	leftIconWrap.classList.remove(
		"tn-static-width-100-0466783d",
		"tn-static-width-12px-fbf353fb",
		"tn-static-width-1px-aa77e27e",
		"tn-static-width-200px-2acaf3b5",
		"tn-static-width-60px-bd09c419",
		"tn-static-width-80px-8573bae3"
	);
	leftIconWrap.classList.add("tn-static-width-16px-7375d50b");
	leftIconWrap.classList.remove(
		"tn-static-display-flex-4d51fc62",
		"tn-static-height-0-7a31cef0",
		"tn-static-height-100-62264068",
		"tn-static-height-12px-06c0747e",
		"tn-static-height-24px-29a11d37",
		"tn-static-min-height-800px-997b4c8c"
	);
	leftIconWrap.classList.add("tn-static-height-16px-30de4aee");
	leftIconWrap.classList.remove("tn-static-margin-right-4px-c6b76b85");
	leftIconWrap.classList.add("tn-static-margin-right-8px-539fa9a0");
	leftIconWrap.classList.remove(
		"tn-static-align-items-baseline-4b95b5c7",
		"tn-static-align-items-flex-start-0486f781"
	);
	leftIconWrap.classList.add("tn-static-align-items-center-7c619740");
	leftIconWrap.classList.remove(
		"tn-static-justify-content-flex-end-455f8cca",
		"tn-static-justify-content-space-between-a562f4fd"
	);
	leftIconWrap.classList.add("tn-static-justify-content-center-03c4bb6f");
	leftIconWrap.classList.add("tn-static-flex-shrink-0-6ee0661e");
	leftIcon.classList.remove(
		"tn-static-width-12px-fbf353fb",
		"tn-static-width-16px-7375d50b",
		"tn-static-width-1px-aa77e27e",
		"tn-static-width-200px-2acaf3b5",
		"tn-static-width-60px-bd09c419",
		"tn-static-width-80px-8573bae3"
	);
	leftIcon.classList.add("tn-static-width-100-0466783d");
	leftIcon.classList.remove(
		"tn-static-display-flex-4d51fc62",
		"tn-static-height-0-7a31cef0",
		"tn-static-height-12px-06c0747e",
		"tn-static-height-16px-30de4aee",
		"tn-static-height-24px-29a11d37",
		"tn-static-min-height-800px-997b4c8c"
	);
	leftIcon.classList.add("tn-static-height-100-62264068");
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
		description.classList.remove(
			"tn-static-font-size-0-75em-948e16e5",
			"tn-static-font-size-0-8em-19dc7c13",
			"tn-static-font-size-0-9em-65025e95",
			"tn-static-font-size-1-2em-3a352995",
			"tn-static-font-size-12px-65574819",
			"tn-static-font-size-12px-b0cc7e05",
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-margin-top-8px-f4f01e68"
		);
		description.classList.add("tn-static-font-size-var-tn-font-size-sm-0274a31d");
		description.classList.remove(
			"tn-static-color-var-color-accent-d2cad743",
			"tn-static-color-var-text-accent-65b47ee3",
			"tn-static-color-var-text-muted-5872de20",
			"tn-static-color-var-text-on-accent-f3e1679d",
			"tn-static-color-var-text-warning-783d5f03",
			"tn-static-color-white-0a43e56a",
			"tn-static-cursor-pointer-2723efcc",
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-2px-0-edce9b14",
			"tn-static-padding-20px-7a035d95",
			"tn-static-padding-20px-ebe8e48c"
		);
		description.classList.add("tn-static-color-var-tn-text-muted-a90fb6f3");
		description.classList.remove(
			"tn-static-font-size-12px-b0cc7e05",
			"tn-static-margin-top-0-5rem-3dc98b5e",
			"tn-static-margin-top-0-d462248a",
			"tn-static-margin-top-12px-91e0f558",
			"tn-static-margin-top-16px-1b0f4999",
			"tn-static-margin-top-1rem-2239d6d5",
			"tn-static-margin-top-20px-a26bda7d",
			"tn-static-margin-top-30px-2fbbbcd4",
			"tn-static-margin-top-8px-8a77e5a3",
			"tn-static-margin-top-8px-f4f01e68"
		);
		description.classList.add("tn-static-margin-top-4px-96ad6099");
	}

	// Attachments (if available and enabled)
	if (opts.showAttachments && timeblock.attachments && timeblock.attachments.length > 0) {
		const attachmentsEl = content.createEl("div", {
			cls: "timeblock-card__attachments",
		});
		attachmentsEl.classList.remove(
			"tn-static-font-size-0-75em-948e16e5",
			"tn-static-font-size-0-8em-19dc7c13",
			"tn-static-font-size-0-9em-65025e95",
			"tn-static-font-size-1-2em-3a352995",
			"tn-static-font-size-12px-65574819",
			"tn-static-font-size-12px-b0cc7e05",
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-margin-top-8px-f4f01e68"
		);
		attachmentsEl.classList.add("tn-static-font-size-var-tn-font-size-sm-0274a31d");
		attachmentsEl.classList.remove(
			"tn-static-color-var-color-accent-d2cad743",
			"tn-static-color-var-text-accent-65b47ee3",
			"tn-static-color-var-text-muted-5872de20",
			"tn-static-color-var-text-on-accent-f3e1679d",
			"tn-static-color-var-text-warning-783d5f03",
			"tn-static-color-white-0a43e56a",
			"tn-static-cursor-pointer-2723efcc",
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-2px-0-edce9b14",
			"tn-static-padding-20px-7a035d95",
			"tn-static-padding-20px-ebe8e48c"
		);
		attachmentsEl.classList.add("tn-static-color-var-tn-text-muted-a90fb6f3");
		attachmentsEl.classList.remove(
			"tn-static-font-size-12px-b0cc7e05",
			"tn-static-margin-top-0-5rem-3dc98b5e",
			"tn-static-margin-top-0-d462248a",
			"tn-static-margin-top-12px-91e0f558",
			"tn-static-margin-top-16px-1b0f4999",
			"tn-static-margin-top-1rem-2239d6d5",
			"tn-static-margin-top-20px-a26bda7d",
			"tn-static-margin-top-30px-2fbbbcd4",
			"tn-static-margin-top-8px-8a77e5a3",
			"tn-static-margin-top-8px-f4f01e68"
		);
		attachmentsEl.classList.add("tn-static-margin-top-4px-96ad6099");

		const attachmentText =
			timeblock.attachments.length === 1
				? "1 attachment"
				: `${timeblock.attachments.length} attachments`;
		attachmentsEl.textContent = `📎 ${attachmentText}`;
	}

	// Click handler - open timeblock modal
	card.addEventListener("click", (e) => {
		if (opts.eventDate && opts.originalDate) {
			void showTimeblockInfoModal(timeblock, opts.eventDate, opts.originalDate, plugin);
		}
	});

	// Apply custom color if provided (used for icon color)
	if (timeblock.color) {
		card.style.setProperty("--current-status-color", timeblock.color);
	} else {
		card.setCssProps({ "--current-status-color": "var(--color-accent)" });
	}

	return card;
}
