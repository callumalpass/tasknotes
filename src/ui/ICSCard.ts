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

	const card = document.createElement("div");
	// Reuse task-card base styling for visual consistency
	card.className = "task-card task-card--ics";
	(card as any).dataset.key = icsEvent.id;

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
	const wrapEl = leftIconWrap as HTMLElement;
	wrapEl.style.display = "inline-flex";
	wrapEl.style.width = "16px";
	wrapEl.style.height = "16px";
	wrapEl.style.marginRight = "8px";
	wrapEl.style.alignItems = "center";
	wrapEl.style.justifyContent = "center";
	wrapEl.style.flexShrink = "0";
	// Color the icon using subscription color
	(leftIcon as HTMLElement).style.width = "100%";
	(leftIcon as HTMLElement).style.height = "100%";
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
	const iconWrap = element.querySelector(".ics-card__icon") as HTMLElement | null;
	if (iconWrap) iconWrap.style.color = color;

	const titleEl = element.querySelector(".task-card__title") as HTMLElement | null;
	if (titleEl)
		titleEl.textContent = icsEvent.title || plugin.i18n.translate("ui.icsCard.untitledEvent");

	const metadata = element.querySelector(".task-card__metadata") as HTMLElement | null;
	if (metadata) {
		const parts: string[] = [];
		const timeText = formatTimeRange(icsEvent, plugin);
		if (timeText) parts.push(timeText);
		if (icsEvent.location) parts.push(icsEvent.location);
		parts.push(sourceName);
		metadata.textContent = parts.join(" • ");
	}
}
