import { msg } from "@lingui/core/macro";
import type { BasesEntry, BasesViewConfig } from "obsidian";
import { setIcon, setTooltip } from "obsidian";
import { format } from "date-fns";
import TaskNotesPlugin from "../main";
import type { ICSEvent, TaskInfo } from "../types";
import { createTaskCard, type TaskCardOptions } from "../ui/TaskCard";
import { createICSEventCard } from "../ui/ICSCard";
import { createPropertyEventCard } from "../ui/PropertyEventCard";
import { createTimeBlockCard } from "../ui/TimeBlockCard";
import { getTargetDateForEvent } from "./calendar-core";
import { createElementInDocument } from "../utils/documentDom";
import type { CalendarEventApi } from "./calendarEngine";

type BasesEntryValue = {
	data?: string;
};

export type BasesEntryWithGetValue = {
	getValue?: (propertyId: string) => BasesEntryValue | undefined;
};

type CalendarListCardFactories = {
	createTaskCard?: typeof createTaskCard;
	createICSEventCard?: typeof createICSEventCard;
	createPropertyEventCard?: typeof createPropertyEventCard;
	createTimeBlockCard?: typeof createTimeBlockCard;
};

export type CalendarListEventCardInput = {
	event: CalendarEventApi;
	plugin: TaskNotesPlugin;
	config?: BasesViewConfig;
	visibleProperties: string[];
	basesEntryByPath: ReadonlyMap<string, BasesEntryWithGetValue>;
	buildTaskCardOptions: (
		options: Partial<TaskCardOptions> & { targetDate: Date }
	) => TaskCardOptions;
	logDebug?: (message: string, ...data: unknown[]) => void;
	factories?: CalendarListCardFactories;
};

export type CalendarIcsEventDecorationInput = {
	element: HTMLElement;
	viewType: string;
	icsEvent: ICSEvent | null | undefined;
	relatedNoteCount: number;
	plugin: TaskNotesPlugin;
};

export function getCalendarRelatedNoteTooltip(
	plugin: TaskNotesPlugin,
	relatedNoteCount: number
): string {
	const label = plugin.i18n.translate(msg({ message: "Related notes & tasks", context: "modals.icsEventInfo.relatedNotesHeading" }));
	return `${label}: ${relatedNoteCount}`;
}

export function normalizeCalendarRelatedNoteCount(value: unknown): number {
	return typeof value === "number" && value > 0 ? value : 0;
}

export function appendCalendarRelatedNoteIndicator(
	container: Element,
	plugin: TaskNotesPlugin,
	relatedNoteCount: number
): void {
	if (relatedNoteCount <= 0 || container.querySelector(".ics-related-note-indicator")) {
		return;
	}

	const doc = container.ownerDocument;
	const iconContainer = createElementInDocument(doc, "span");
	iconContainer.classList.add("ics-related-note-indicator");
	iconContainer.setAttribute(
		"aria-label",
		getCalendarRelatedNoteTooltip(plugin, relatedNoteCount)
	);
	iconContainer.dataset.relatedNoteCount = String(relatedNoteCount);
	setIcon(iconContainer, "file-text");
	setTooltip(iconContainer, getCalendarRelatedNoteTooltip(plugin, relatedNoteCount), {
		placement: "top",
	});
	container.appendChild(iconContainer);
}

export function decorateCalendarIcsEventElement({
	element,
	viewType,
	icsEvent,
	relatedNoteCount,
	plugin,
}: CalendarIcsEventDecorationInput): void {
	if (!icsEvent) {
		return;
	}

	element.setAttribute("data-ics-event", "true");
	element.classList.add("fc-ics-event");

	if (relatedNoteCount > 0) {
		element.classList.add("has-related-note", "fc-event--has-related-note");
		element.dataset.relatedNoteCount = String(relatedNoteCount);
	}

	if (viewType === "listWeek") {
		return;
	}

	const provider = plugin.calendarProviderRegistry?.findProviderForEvent(icsEvent);
	if (provider && !element.querySelector(".fc-event-provider-icon")) {
		const iconEl = createElementInDocument(element.ownerDocument, "span");
		iconEl.classList.add("fc-event-provider-icon");
		iconEl.setAttribute("aria-hidden", "true");
		setIcon(iconEl, "calendar");
		element.appendChild(iconEl);
	}

	const titleEl = element.querySelector(".tnc-item-title");
	if (titleEl && relatedNoteCount > 0) {
		appendCalendarRelatedNoteIndicator(titleEl, plugin, relatedNoteCount);
	}
}

export function enrichCalendarListTaskInfo({
	taskInfo,
	basesEntry,
	visibleProperties,
	logDebug,
}: {
	taskInfo: TaskInfo;
	basesEntry?: BasesEntryWithGetValue;
	visibleProperties: string[];
	logDebug?: (message: string, ...data: unknown[]) => void;
}): TaskInfo {
	const enrichedTask = { ...taskInfo };
	if (!basesEntry) {
		return enrichedTask;
	}

	enrichedTask.basesData = basesEntry;

	for (const propId of visibleProperties) {
		if (!propId.startsWith("formula.")) {
			continue;
		}
		try {
			basesEntry.getValue?.(propId);
		} catch (error) {
			logDebug?.("[TaskNotes][CalendarView] Error getting formula:", propId, error);
		}
	}

	if (!enrichedTask.dateCreated) {
		try {
			const ctimeValue = basesEntry.getValue?.("file.ctime");
			if (ctimeValue?.data) enrichedTask.dateCreated = ctimeValue.data;
		} catch (error) {
			logDebug?.("[TaskNotes][CalendarView] Error getting file.ctime:", error);
		}
	}

	if (!enrichedTask.dateModified) {
		try {
			const mtimeValue = basesEntry.getValue?.("file.mtime");
			if (mtimeValue?.data) enrichedTask.dateModified = mtimeValue.data;
		} catch (error) {
			logDebug?.("[TaskNotes][CalendarView] Error getting file.mtime:", error);
		}
	}

	return enrichedTask;
}

/** The card shown for an event in the list view, or null to keep the calendar's default row. */
export function createCalendarListEventCard({
	event,
	plugin,
	config,
	visibleProperties,
	basesEntryByPath,
	buildTaskCardOptions,
	logDebug,
	factories = {},
}: CalendarListEventCardInput): HTMLElement | null {
	const { taskInfo, timeblock, icsEvent, eventType, basesEntry, relatedNoteCount } =
		event.extendedProps;
	const relatedNoteTotal = normalizeCalendarRelatedNoteCount(relatedNoteCount);

	if (taskInfo && eventType !== "ics" && eventType !== "property-based") {
		const enrichedTask = enrichCalendarListTaskInfo({
			taskInfo,
			basesEntry: basesEntryByPath.get(taskInfo.path),
			visibleProperties,
			logDebug,
		});
		return (factories.createTaskCard ?? createTaskCard)(
			enrichedTask,
			plugin,
			visibleProperties,
			buildTaskCardOptions({
				targetDate: getTargetDateForEvent({ event }),
				promoteOccurrenceControlsInContextMenu: Boolean(
					taskInfo.recurrence || (taskInfo.recurrence_parent && taskInfo.occurrence_date)
				),
			})
		);
	}
	if (icsEvent && eventType === "ics") {
		return (factories.createICSEventCard ?? createICSEventCard)(icsEvent, plugin, {
			relatedNoteCount: relatedNoteTotal,
		});
	}
	if (eventType === "property-based" && basesEntry) {
		// Property events carry the Bases entry they were built from.
		return (factories.createPropertyEventCard ?? createPropertyEventCard)(
			basesEntry as BasesEntry,
			plugin,
			config
		);
	}
	if (eventType === "timeblock" && timeblock) {
		const originalDate = event.start ? format(event.start, "yyyy-MM-dd") : undefined;
		return (factories.createTimeBlockCard ?? createTimeBlockCard)(timeblock, plugin, {
			eventDate: event.start ?? undefined,
			originalDate,
		});
	}
	return null;
}
