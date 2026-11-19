import { msg } from "@lingui/core/macro";
import { setIcon, setTooltip } from "obsidian";
import TaskNotesPlugin from "../main";
import { ICSEvent, ICSSubscription } from "../types";
import { ICSEventContextMenu } from "../components/ICSEventContextMenu";
import { formatTime } from "../utils/dateUtils";
import { ICSEventInfoModal } from "../modals/ICSEventInfoModal";
import { findProviderCalendar } from "../services/CalendarProvider";

export interface ICSCardOptions {
	showDate: boolean;
	relatedNoteCount?: number;
}

export const DEFAULT_ICS_CARD_OPTIONS: ICSCardOptions = {
	showDate: true,
};

function getRelatedNoteTooltip(plugin: TaskNotesPlugin, relatedNoteCount: number): string {
	const label = plugin.i18n.translate(msg({ message: "Related notes & tasks", context: "modals.icsEventInfo.relatedNotesHeading" }));
	return `${label}: ${relatedNoteCount}`;
}

function renderRelatedNoteIndicator(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	relatedNoteCount?: number
): void {
	const normalizedCount =
		typeof relatedNoteCount === "number" && relatedNoteCount > 0 ? relatedNoteCount : 0;
	const existing = container.querySelector<HTMLElement>(".ics-card__related-note-indicator");

	if (!normalizedCount) {
		existing?.remove();
		return;
	}

	const indicator =
		existing ||
		container.createSpan({
			cls: "ics-card__related-note-indicator",
		});
	indicator.dataset.relatedNoteCount = String(normalizedCount);
	indicator.setAttribute("aria-label", getRelatedNoteTooltip(plugin, normalizedCount));
	setIcon(indicator, "file-text");
	setTooltip(indicator, getRelatedNoteTooltip(plugin, normalizedCount), {
		placement: "top",
	});
}

function getEventSourceName(
	icsEvent: ICSEvent,
	plugin: TaskNotesPlugin,
	subscription: ICSSubscription | undefined
): string {
	if (subscription?.name) {
		return subscription.name;
	}

	const provider = plugin.calendarProviderRegistry?.findProviderForEvent(icsEvent);
	if (provider) {
		const { calendarId } = provider.extractEventIds(icsEvent);
		const calendar = findProviderCalendar(provider.getAvailableCalendars(), calendarId);
		return calendar?.summary || provider.providerName;
	}

	return plugin.i18n.translate(msg({ message: "Calendar", context: "ui.icsCard.calendarFallback" }));
}

function formatTimeRange(icsEvent: ICSEvent, plugin: TaskNotesPlugin): string {
	try {
		if (!icsEvent.start) return "";
		const start = new Date(icsEvent.start);
		if (icsEvent.allDay) {
			return plugin.i18n.translate(msg({ message: "All day", context: "ui.icsCard.allDay" }));
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

function renderTitle(
	titleText: HTMLElement,
	icsEvent: ICSEvent,
	plugin: TaskNotesPlugin,
	relatedNoteCount?: number
): void {
	titleText.textContent =
		icsEvent.title || plugin.i18n.translate(msg({ message: "Untitled event", context: "ui.icsCard.untitledEvent" }));
	renderRelatedNoteIndicator(titleText, plugin, relatedNoteCount);
}

/** Metadata line: time range, location and source calendar. */
function renderMetadata(
	metadata: HTMLElement,
	icsEvent: ICSEvent,
	plugin: TaskNotesPlugin,
	sourceName: string
): void {
	metadata.replaceChildren();
	const timeText = formatTimeRange(icsEvent, plugin);
	if (timeText) metadata.createSpan({ cls: "ics-card__time", text: timeText });
	if (icsEvent.location) {
		const location = metadata.createSpan({ cls: "ics-card__location" });
		const icon = location.createSpan({ cls: "ics-card__meta-icon" });
		icon.setAttribute("aria-hidden", "true");
		setIcon(icon, "map-pin");
		location.createSpan({ cls: "ics-card__location-text", text: icsEvent.location });
	}
	metadata.createSpan({ cls: "ics-card__source", text: sourceName });
}

/**
 * Create a compact ICS event card styled similar to TaskCard
 */
export function createICSEventCard(
	icsEvent: ICSEvent,
	plugin: TaskNotesPlugin,
	options: Partial<ICSCardOptions> = {}
): HTMLElement {
	const opts = { ...DEFAULT_ICS_CARD_OPTIONS, ...options };

	const card = activeWindow.createDiv();
	// Reuse task-card base styling for visual consistency
	card.className = "task-card task-card--ics";
	card.dataset.key = icsEvent.id;
	if (opts.relatedNoteCount && opts.relatedNoteCount > 0) {
		card.classList.add("has-related-note", "task-card--ics-has-related-note");
		card.dataset.relatedNoteCount = String(opts.relatedNoteCount);
	}

	// Determine subscription color and source name
	const subscription = plugin.icsSubscriptionService
		?.getSubscriptions()
		.find((s) => s.id === icsEvent.subscriptionId);
	const color = icsEvent.color || subscription?.color || "var(--color-accent)";
	const sourceName = getEventSourceName(icsEvent, plugin, subscription);

	// Main row
	const mainRow = card.createDiv({ cls: "task-card__main-row" });

	// The calendar icon sits where a task shows its status; CSS colours it with --current-status-color.
	const leftIcon = mainRow.createSpan({
		cls: "ics-card__icon",
		attr: {
			role: "img",
			"aria-label": plugin.i18n.translate(msg({ message: "Calendar event", context: "ui.icsCard.calendarEvent" })),
		},
	});
	setIcon(leftIcon, "calendar");

	const content = mainRow.createDiv({ cls: "task-card__content" });
	const titleText = content.createDiv({ cls: "task-card__title" }).createSpan({ cls: "task-card__title-text" });
	renderTitle(titleText, icsEvent, plugin, opts.relatedNoteCount);
	renderMetadata(content.createDiv({ cls: "task-card__metadata" }), icsEvent, plugin, sourceName);

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
	const opts = { ...DEFAULT_ICS_CARD_OPTIONS, ...options };

	const subscription = plugin.icsSubscriptionService
		?.getSubscriptions()
		.find((s) => s.id === icsEvent.subscriptionId);
	const color = icsEvent.color || subscription?.color || "var(--color-accent)";
	const sourceName = getEventSourceName(icsEvent, plugin, subscription);

	element.style.setProperty("--current-status-color", color);
	element.classList.toggle(
		"has-related-note",
		Boolean(opts.relatedNoteCount && opts.relatedNoteCount > 0)
	);
	element.classList.toggle(
		"task-card--ics-has-related-note",
		Boolean(opts.relatedNoteCount && opts.relatedNoteCount > 0)
	);
	if (opts.relatedNoteCount && opts.relatedNoteCount > 0) {
		element.dataset.relatedNoteCount = String(opts.relatedNoteCount);
	} else {
		delete element.dataset.relatedNoteCount;
	}

	const titleText = element.querySelector<HTMLElement>(".task-card__title-text");
	if (titleText) renderTitle(titleText, icsEvent, plugin, opts.relatedNoteCount);

	const metadata = element.querySelector<HTMLElement>(".task-card__metadata");
	if (metadata) renderMetadata(metadata, icsEvent, plugin, sourceName);
}
