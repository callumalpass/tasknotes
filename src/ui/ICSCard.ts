import { setIcon } from "obsidian";
import TaskNotesPlugin from "../main";
import { ICSEvent } from "../types";
import { ICSEventContextMenu } from "../components/ICSEventContextMenu";
import { formatTime } from "../utils/dateUtils";
import { ICSEventInfoModal } from "../modals/ICSEventInfoModal";

export interface ICSCardOptions {
	showDate: boolean;
}

export const DEFAULT_ICS_CARD_OPTIONS: ICSCardOptions = {
	showDate: true,
};

function formatTimeRange(icsEvent: ICSEvent, plugin: TaskNotesPlugin): string {
	try {
		if (!icsEvent.start) return "";
		const start = new Date(icsEvent.start);
		if (icsEvent.allDay) {
			return plugin.i18n.translate("ui.icsCard.allDay");
		}
		const timeFormat = plugin.settings.calendarViewSettings.timeFormat;
		const startText = formatTime(start, timeFormat);
		if (icsEvent.end) {
			const end = new Date(icsEvent.end);
			const endText = formatTime(end, timeFormat);
			return `${startText} – ${endText}`;
		}
		return startText;
	} catch {
		return "";
	}
}

/**
 * Create a compact ICS event card styled similar to TaskCard
 */
export function createICSEventCard(
	icsEvent: ICSEvent,
	plugin: TaskNotesPlugin,
	options: Partial<ICSCardOptions> = {}
): HTMLElement {
	// const opts = { ...DEFAULT_ICS_CARD_OPTIONS, ...options }; // Currently unused

	const card = activeDocument.createElement("div");
	// Reuse task-card base styling for visual consistency
	card.className = "task-card task-card--ics";
	card.dataset.key = icsEvent.id;

	// Determine subscription color and name
	const subscription = plugin.icsSubscriptionService
		?.getSubscriptions()
		.find((s) => s.id === icsEvent.subscriptionId);
	const color = icsEvent.color || subscription?.color || "var(--color-accent)";
	const sourceName = subscription?.name || plugin.i18n.translate("ui.icsCard.calendarFallback");

	// Main row
	const mainRow = card.createEl("div", { cls: "task-card__main-row" });

	// Left indicator area: calendar icon (no ring/checkbox)
	const leftIconWrap = mainRow.createEl("span", { cls: "ics-card__icon" });
	const leftIcon = leftIconWrap.createDiv({
		attr: { "aria-label": plugin.i18n.translate("ui.icsCard.calendarEvent") },
	});
	setIcon(leftIcon, "calendar");
	// Inline layout styling to mimic status area spacing without the ring
	const wrapEl = leftIconWrap;
	wrapEl.classList.remove(
		"tn-static-display-block-2a1b75c9",
		"tn-static-display-flex-4d51fc62",
		"tn-static-display-flex-75816cae",
		"tn-static-display-flex-8bb39979",
		"tn-static-display-inline-block-60e32dcb",
		"tn-static-display-inline-cccfa456",
		"tn-static-display-none-6b99de8b",
		"tn-static-min-height-800px-997b4c8c"
	);
	wrapEl.classList.add("tn-static-display-inline-flex-f984c520");
	wrapEl.classList.remove(
		"tn-static-width-100-0466783d",
		"tn-static-width-12px-fbf353fb",
		"tn-static-width-1px-aa77e27e",
		"tn-static-width-200px-2acaf3b5",
		"tn-static-width-60px-bd09c419",
		"tn-static-width-80px-8573bae3"
	);
	wrapEl.classList.add("tn-static-width-16px-7375d50b");
	wrapEl.classList.remove(
		"tn-static-display-flex-4d51fc62",
		"tn-static-height-0-7a31cef0",
		"tn-static-height-100-62264068",
		"tn-static-height-12px-06c0747e",
		"tn-static-height-24px-29a11d37",
		"tn-static-min-height-800px-997b4c8c"
	);
	wrapEl.classList.add("tn-static-height-16px-30de4aee");
	wrapEl.classList.remove("tn-static-margin-right-4px-c6b76b85");
	wrapEl.classList.add("tn-static-margin-right-8px-539fa9a0");
	wrapEl.classList.remove(
		"tn-static-align-items-baseline-4b95b5c7",
		"tn-static-align-items-flex-start-0486f781"
	);
	wrapEl.classList.add("tn-static-align-items-center-7c619740");
	wrapEl.classList.remove(
		"tn-static-justify-content-flex-end-455f8cca",
		"tn-static-justify-content-space-between-a562f4fd"
	);
	wrapEl.classList.add("tn-static-justify-content-center-03c4bb6f");
	wrapEl.classList.add("tn-static-flex-shrink-0-6ee0661e");
	// Color the icon using subscription color
	(leftIcon as HTMLElement).classList.remove(
		"tn-static-width-12px-fbf353fb",
		"tn-static-width-16px-7375d50b",
		"tn-static-width-1px-aa77e27e",
		"tn-static-width-200px-2acaf3b5",
		"tn-static-width-60px-bd09c419",
		"tn-static-width-80px-8573bae3"
	);
	(leftIcon as HTMLElement).classList.add("tn-static-width-100-0466783d");
	(leftIcon as HTMLElement).classList.remove(
		"tn-static-display-flex-4d51fc62",
		"tn-static-height-0-7a31cef0",
		"tn-static-height-12px-06c0747e",
		"tn-static-height-16px-30de4aee",
		"tn-static-height-24px-29a11d37",
		"tn-static-min-height-800px-997b4c8c"
	);
	(leftIcon as HTMLElement).classList.add("tn-static-height-100-62264068");
	(leftIcon as HTMLElement).style.color = color;

	// Content
	const content = mainRow.createEl("div", { cls: "task-card__content" });
	content.createEl("div", {
		cls: "task-card__title",
		text: icsEvent.title || plugin.i18n.translate("ui.icsCard.untitledEvent"),
	});

	// Metadata line: time range • location • source
	const metadata = content.createEl("div", { cls: "task-card__metadata" });
	const parts: string[] = [];
	const timeText = formatTimeRange(icsEvent, plugin);
	if (timeText) parts.push(timeText);
	if (icsEvent.location) parts.push(icsEvent.location);
	parts.push(sourceName);
	metadata.textContent = parts.join(" • ");

	// Left-click to open detailed info modal
	card.addEventListener("click", () => {
		const modal = new ICSEventInfoModal(plugin.app, plugin, icsEvent, sourceName);
		modal.open();
	});

	// Right-click for context menu
	card.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		e.stopPropagation();

		const contextMenu = new ICSEventContextMenu({
			icsEvent: icsEvent,
			plugin: plugin,
			subscriptionName: sourceName,
			onUpdate: () => {
				// Trigger any necessary updates
				plugin.app.workspace.trigger("tasknotes:refresh-views");
			},
		});

		contextMenu.show(e);
	});

	// Apply accent color as CSS var for nicer theming
	card.style.setProperty("--current-status-color", color);

	return card;
}

/**
 * Update an existing ICS event card
 */
export function updateICSEventCard(
	element: HTMLElement,
	icsEvent: ICSEvent,
	plugin: TaskNotesPlugin,
	options: Partial<ICSCardOptions> = {}
): void {
	// const opts = { ...DEFAULT_ICS_CARD_OPTIONS, ...options }; // Currently unused

	const subscription = plugin.icsSubscriptionService
		?.getSubscriptions()
		.find((s) => s.id === icsEvent.subscriptionId);
	const color = icsEvent.color || subscription?.color || "var(--color-accent)";
	const sourceName = subscription?.name || plugin.i18n.translate("ui.icsCard.calendarFallback");

	// Update icon color on wrapper to propagate to svg (icons use currentColor)
	element.style.setProperty("--current-status-color", color);
	const iconWrap = element.querySelector<HTMLElement>(".ics-card__icon");
	if (iconWrap) iconWrap.style.color = color;

	const titleEl = element.querySelector(".task-card__title");
	if (titleEl)
		titleEl.textContent = icsEvent.title || plugin.i18n.translate("ui.icsCard.untitledEvent");

	const metadata = element.querySelector(".task-card__metadata");
	if (metadata) {
		const parts: string[] = [];
		const timeText = formatTimeRange(icsEvent, plugin);
		if (timeText) parts.push(timeText);
		if (icsEvent.location) parts.push(icsEvent.location);
		parts.push(sourceName);
		metadata.textContent = parts.join(" • ");
	}
}
