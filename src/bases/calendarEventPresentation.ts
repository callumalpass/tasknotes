import { Platform, setIcon, setTooltip } from "obsidian";
import { msg } from "@lingui/core/macro";
import { uiText } from "../i18n/runtime";
import { viewToBases, type ItemArg } from "@tasknotes/calendar";
import type TaskNotesPlugin from "../main";
import type { CalendarEventProps } from "./calendarEngine";
import { isCalendarBatchTarget, isCalendarSelectionTarget } from "./calendarBatchMove";
import { applyTimeblockStyling, generateTimeblockTooltip, applyRecurringTaskStyling, generateTaskTooltip, addTaskHoverPreview, getTargetDateForEvent } from "./calendar-core";
import { appendCalendarAttachmentIndicator, decorateCalendarIcsEventElement, getCalendarRelatedNoteTooltip, normalizeCalendarRelatedNoteCount } from "./calendarEventMount";
import { filterEmptyProjects, sanitizeForCssClass, getEffectiveTaskStatus } from "../utils/helpers";
import { eventApiFromItem } from "./calendarEngine";
import type { TaskInfo } from "../types";
import { createTaskGlyphs } from "../ui/taskGlyphs";
import { createElementInDocument } from "../utils/documentDom";
import { taskDueUrgency } from "../ui/kit/dateLabel";
import { formatTime } from "../utils/dateUtils";

interface CalendarPresentationContext {
 plugin: TaskNotesPlugin;
 rootElement: HTMLElement | null;
 timeFormat?: "12" | "24";
}

export function decorateCalendarTaskGlyphs(element: HTMLElement, task: TaskInfo, plugin: TaskNotesPlugin): void {
	const status = plugin.statusManager.getStatusConfig(task.status);
	element.dataset.status = task.status;
	element.dataset.priority = task.priority;
	element.style.setProperty("--tn-calendar-status-color", status?.color || "var(--text-muted)");
	const title = element.querySelector<HTMLElement>(".tnc-item-title");
	if (!title) return;
	title.querySelector(".tn-task-glyphs")?.remove();
	if (!title.querySelector(".tn-calendar-event-title")) {
		const text = createElementInDocument(element.ownerDocument, "span");
		text.className = "tn-calendar-event-title";
		text.append(...Array.from(title.childNodes));
		title.append(text);
	}
	const glyphs = createTaskGlyphs(element.ownerDocument, task, plugin);
	for (const glyph of Array.from(glyphs.children) as HTMLElement[]) {
		if (!element.classList.contains("tnc-item--list")) glyph.style.removeProperty("color");
	}
	title.prepend(glyphs);
}

export function suppressCalendarContextMenuOnMobile(element: HTMLElement): void {
	if (!Platform.isMobile) return;

	element.classList.add("tn-calendar-event-touch-target");
	element.addEventListener(
		"contextmenu",
		(event) => {
			event.preventDefault();
			event.stopImmediatePropagation();
		},
		{ capture: true }
	);
}

export function decorateCalendarEvent(context: CalendarPresentationContext, arg: ItemArg<CalendarEventProps>): void {
		const extendedProps = arg.item.data;
		if (!extendedProps) return;
		const el = arg.el;
		const { taskInfo, timeblock, icsEvent, eventType, relatedNoteCount } = extendedProps;
		suppressCalendarContextMenuOnMobile(el);

		const relatedNoteTotal = normalizeCalendarRelatedNoteCount(relatedNoteCount);
		const viewType = viewToBases(arg.view.type) ?? arg.view.type;
		decorateCalendarIcsEventElement({
			element: el,
			viewType,
			icsEvent,
			relatedNoteCount: relatedNoteTotal,
			plugin: context.plugin,
		});

		// Set event type attribute
		el.setAttribute("data-event-type", eventType || "unknown");
		if (taskInfo?.recurrence) el.dataset.occurrenceDay = String(arg.day);
		else delete el.dataset.occurrenceDay;
		if (taskInfo?.path) {
			el.setAttribute("data-task-path", taskInfo.path);
			el.classList.add("fc-task-event");
			const selectable = isCalendarBatchTarget(extendedProps);
			el.dataset.batchSelectable = String(selectable);
			if (isCalendarSelectionTarget(extendedProps)) {
				const selected = Boolean(context.plugin.taskSelectionService?.isSelected(taskInfo.path));
				el.classList.toggle("tn-calendar-item-selected", selected);
				el.setAttribute("aria-pressed", String(selected));
			}
		}

		if (extendedProps.isBatchPreview) {
			el.setAttribute("aria-hidden", "true");
			el.tabIndex = -1;
			return;
		}
		const tracked = eventType === "timeEntry" && taskInfo && arg.item.end
			? `${taskInfo.title}\n${uiText(msg({ message: "{value1} tracked", context: "ui/taskCardProperties: totalTrackedTime display" }), {
				value1: context.plugin.formatTime((new Date(arg.item.end).getTime() - new Date(arg.item.start).getTime()) / 60000),
			})}\n${formatTime(new Date(arg.item.start), context.timeFormat ?? context.plugin.settings.calendarViewSettings.timeFormat)} – ${formatTime(new Date(arg.item.end), context.timeFormat ?? context.plugin.settings.calendarViewSettings.timeFormat)}`
			: null;
		if (tracked) el.setAttribute("aria-label", tracked);

		// List rows are task cards with their own tooltips, previews and menus.
		if (arg.view.type === "list") {
			if (taskInfo && el.querySelector(".tnc-item-title") && !el.querySelector(".task-card")) {
				decorateCalendarTaskGlyphs(el, taskInfo, context.plugin);
			}
			return;
		}

		// Handle timeblock events
		if (eventType === "timeblock" && timeblock) {
			applyTimeblockStyling(el, timeblock);
			setTooltip(el, generateTimeblockTooltip(timeblock), { placement: "top" });
			return;
		}

		// Add data attributes and classes for tasks
		if (taskInfo && taskInfo.path) {
			attachCalendarTaskHoverLink(context.rootElement, el, taskInfo.path);
			const status = taskInfo.recurrence
				? getEffectiveTaskStatus(taskInfo, getTargetDateForEvent({ event: eventApiFromItem(arg.item) }), context.plugin.statusManager.getCompletedStatuses()[0])
				: taskInfo.status;
			decorateCalendarTaskGlyphs(el, { ...taskInfo, status }, context.plugin);
			if (eventType === "due") {
				const title = el.querySelector(".tnc-item-title");
				if (title && !title.querySelector(".tn-calendar-deadline-marker")) {
					const marker = createElementInDocument(el.ownerDocument, "span");
					marker.className = "tn-calendar-deadline-marker tn-task-date";
					marker.dataset.tnDateUrgency = taskDueUrgency(taskInfo.due,
						context.plugin.statusManager.isCompletedStatus(status), context.plugin.settings.hideCompletedFromOverdue);
					marker.setAttribute("aria-hidden", "true");
					setIcon(marker, "flag-triangle-right");
					title.prepend(marker);
				}
			}

			// Add tag classes to tasks
			if (taskInfo.tags && taskInfo.tags.length > 0) {
				taskInfo.tags.forEach((tag: string) => {
					const sanitizedTag = tag.replace(/[^a-zA-Z0-9-_]/g, "");
					if (sanitizedTag) {
						el.classList.add(`fc-tag-${sanitizedTag}`);
					}
				});
			}

			filterEmptyProjects(taskInfo.projects || []).forEach((project) => {
				const sanitizedProject = sanitizeForCssClass(project);
				if (sanitizedProject) {
					el.classList.add(`fc-project-${sanitizedProject}`);
				}
			});

			// Apply recurring task styling (handles completion styling as well)
			applyRecurringTaskStyling(el, extendedProps);

			appendCalendarAttachmentIndicator(el, context.plugin, taskInfo.attachments?.length ?? 0);
		}

		// Add hover tooltip for tasks and ICS events
		if (taskInfo && arg.variant !== "list") {
			const tooltip = generateTaskTooltip(taskInfo, context.plugin);
			const deadline = eventType === "due"
				? context.plugin.i18n.translate(msg({ message: "Deadline", context: "calendar event marker" }))
				: null;
			setTooltip(el, tracked ?? (deadline ? `${deadline}: ${tooltip}` : tooltip));
		} else if (icsEvent && arg.variant !== "list") {
			const relatedNotesText =
				relatedNoteTotal > 0
					? `\n\n${getCalendarRelatedNoteTooltip(context.plugin, relatedNoteTotal)}`
					: "";
			const tooltipText = icsEvent.description
				? `${icsEvent.title}\n\n${icsEvent.description}${relatedNotesText}`
				: `${icsEvent.title}${relatedNotesText}`;
			setTooltip(el, tooltipText);
		}

		// Add hover preview for tasks (Ctrl+hover to preview daily note)
		if (taskInfo && eventType !== "ics") {
			addTaskHoverPreview(el, taskInfo, context.plugin, "tasknotes-bases-calendar");
		}

		// Add hover preview for property-based events (Ctrl+hover to preview note)
		const filePath = extendedProps.filePath;
		if (eventType === "property-based" && filePath) {
			el.addEventListener("mouseover", (event: MouseEvent) => {
				const file = context.plugin.app.vault.getAbstractFileByPath(filePath);
				if (file) {
					context.plugin.app.workspace.trigger("hover-link", {
						event,
						source: "tasknotes-bases-calendar",
						hoverParent: el,
						targetEl: el,
						linktext: filePath,
						sourcePath: filePath,
					});
				}
			});
		}
	}

export function attachCalendarTaskHoverLink(root: HTMLElement | null, element: HTMLElement, taskPath: string): void {
		const setRelatedState = (active: boolean) => {
			if (active && (element.closest(".tnc-dragging") || root?.querySelector(".tnc-dragging"))) return;
			const selector = `.fc-task-event[data-task-path="${CSS.escape(taskPath)}"]`;
			const relatedEvents = root?.querySelectorAll<HTMLElement>(selector) ?? [];

			relatedEvents.forEach((relatedEvent) => {
				if (relatedEvent === element) {
					relatedEvent.classList.toggle("fc-task-event--hover-source", active);
				} else {
					relatedEvent.classList.toggle("fc-task-event--related-hover", active &&
						relatedEvent.dataset.occurrenceDay === element.dataset.occurrenceDay);
				}
			});
		};

		element.addEventListener("mouseenter", () => setRelatedState(true));
		element.addEventListener("mouseleave", () => setRelatedState(false));
	}
