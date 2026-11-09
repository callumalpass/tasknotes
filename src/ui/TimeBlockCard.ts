import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
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

export function createTimeBlockCard(
	timeblock: TimeBlock,
	plugin: TaskNotesPlugin,
	options: Partial<TimeBlockCardOptions> = {}
): HTMLElement {
	const opts = { ...DEFAULT_TIMEBLOCK_CARD_OPTIONS, ...options };
	const card = activeWindow.createDiv({ cls: "task-card task-card--timeblock" });
	card.dataset.key = `timeblock-${timeblock.id}`;
	card.style.setProperty("--current-status-color", timeblock.color || "var(--text-muted)");
	const mainRow = card.createDiv({ cls: "task-card__main-row" });
	const icon = mainRow.createSpan({ cls: "timeblock-card__icon" });
	setIcon(icon, "clock");
	const content = mainRow.createDiv({ cls: "task-card__content" });
	content.createDiv({ cls: "task-card__title" }).createSpan({
		cls: "task-card__title-text",
		text: timeblock.title || uiText(msg({ message: "Timeblock", context: "ui/TimeBlockCard: createTimeBlockCard display" })),
	});
	const metadata = content.createDiv({ cls: "task-card__metadata" });
	metadata.createSpan({ cls: "tn-chip timeblock-card__time", text: `${timeblock.startTime} - ${timeblock.endTime}` });
	if (opts.showDescription && timeblock.description) {
		card.createDiv({ cls: "task-card__description", text: timeblock.description });
	}
	if (opts.showAttachments && timeblock.attachments && timeblock.attachments.length > 0) {
		const attachments = metadata.createSpan({ cls: "tn-chip timeblock-card__attachments" });
		setIcon(attachments.createSpan(), "paperclip");
		attachments.createSpan({ text: uiText(msg({ message: "{count, plural, one {# attachment} other {# attachments}}", context: "timeblock attachment count" }), { count: timeblock.attachments.length }) });
	}
	card.addEventListener("click", () => {
		if (opts.eventDate && opts.originalDate) {
			void showTimeblockInfoModal(timeblock, opts.eventDate, opts.originalDate, plugin);
		}
	});
	return card;
}
