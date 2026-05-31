import type { EventMountArg } from "@fullcalendar/core";
import type { BasesViewConfig } from "obsidian";
import { setIcon, setTooltip } from "obsidian";
import { format } from "date-fns";
import TaskNotesPlugin from "../main";
import type { ICSEvent, TaskInfo, TimeBlock } from "../types";
import { createTaskCard, type TaskCardOptions } from "../ui/TaskCard";
import { createICSEventCard } from "../ui/ICSCard";
import { createPropertyEventCard } from "../ui/PropertyEventCard";
import { createTimeBlockCard } from "../ui/TimeBlockCard";
import { getTargetDateForEvent } from "./calendar-core";

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

export type CalendarListEventMountInput = {
	arg: EventMountArg;
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
	const label = plugin.i18n.translate("modals.icsEventInfo.relatedNotesHeading");
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
	const iconContainer = doc.createElement("span");
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
		const iconEl = element.ownerDocument.createElement("span");
		iconEl.classList.add("fc-event-provider-icon");
		iconEl.setAttribute("aria-hidden", "true");
		setIcon(iconEl, "calendar");
		element.appendChild(iconEl);
	}

	const titleEl = element.querySelector(".fc-event-title");
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

export function mountCalendarListEventCard({
	arg,
	plugin,
	config,
	visibleProperties,
	basesEntryByPath,
	buildTaskCardOptions,
	logDebug,
	factories = {},
}: CalendarListEventMountInput): boolean {
	if (arg.view.type !== "listWeek") {
		return false;
	}

	arg.el.innerHTML = "";

	const { taskInfo, timeblock, icsEvent, eventType, basesEntry, relatedNoteCount } =
		arg.event.extendedProps || {};
	const relatedNoteTotal = normalizeCalendarRelatedNoteCount(relatedNoteCount);
	let cardElement: HTMLElement | null = null;

	if (taskInfo && eventType !== "ics" && eventType !== "property-based") {
		const enrichedTask = enrichCalendarListTaskInfo({
			taskInfo,
			basesEntry: basesEntryByPath.get(taskInfo.path),
			visibleProperties,
			logDebug,
		});
		const targetDate = getTargetDateForEvent(arg);
		cardElement = (factories.createTaskCard ?? createTaskCard)(
			enrichedTask,
			plugin,
			visibleProperties,
			buildTaskCardOptions({
				targetDate,
				promoteOccurrenceControlsInContextMenu: Boolean(
					taskInfo.recurrence || (taskInfo.recurrence_parent && taskInfo.occurrence_date)
				),
			})
		);
	} else if (icsEvent && eventType === "ics") {
		cardElement = (factories.createICSEventCard ?? createICSEventCard)(icsEvent, plugin, {
			relatedNoteCount: relatedNoteTotal,
		});
	} else if (eventType === "property-based" && basesEntry) {
		cardElement = (factories.createPropertyEventCard ?? createPropertyEventCard)(
			basesEntry,
			plugin,
			config
		);
	} else if (eventType === "timeblock" && timeblock) {
		const originalDate = arg.event.start ? format(arg.event.start, "yyyy-MM-dd") : undefined;
		cardElement = (factories.createTimeBlockCard ?? createTimeBlockCard)(
			timeblock as TimeBlock,
			plugin,
			{
				eventDate: arg.event.start ?? undefined,
				originalDate,
			}
		);
	}

	if (!cardElement) {
		arg.el.classList.add("fc-event-default-list");
		return false;
	}

	const cardCell = arg.el.ownerDocument.createElement("td");
	cardCell.className = "fc-list-event-title fc-list-card-content";
	cardCell.colSpan = 3;
	cardCell.appendChild(cardElement);
	arg.el.appendChild(cardCell);

	if (taskInfo?.path) {
		arg.el.setAttribute("data-task-path", taskInfo.path);
		arg.el.classList.add("fc-task-event");
	}
	arg.el.classList.add("fc-list-task-card");
	arg.el.classList.remove("fc-event", "fc-event-start", "fc-event-end");

	return true;
}
