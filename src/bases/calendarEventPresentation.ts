import { Platform, setTooltip } from "obsidian";
import { viewToBases, type ItemArg } from "@tasknotes/calendar";
import type TaskNotesPlugin from "../main";
import type { CalendarEventProps } from "./calendarEngine";
import { isCalendarBatchTarget } from "./calendarBatchMove";
import { applyTimeblockStyling, generateTimeblockTooltip, applyRecurringTaskStyling, generateTaskTooltip, addTaskHoverPreview } from "./calendar-core";
import { appendCalendarAttachmentIndicator, decorateCalendarIcsEventElement, getCalendarRelatedNoteTooltip, normalizeCalendarRelatedNoteCount } from "./calendarEventMount";
import { filterEmptyProjects, sanitizeForCssClass } from "../utils/helpers";

interface CalendarPresentationContext {
 plugin: TaskNotesPlugin;
 rootElement: HTMLElement | null;
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
		if (taskInfo?.path) {
			el.setAttribute("data-task-path", taskInfo.path);
			el.classList.add("fc-task-event");
			const selectable = isCalendarBatchTarget(extendedProps);
			el.dataset.batchSelectable = String(selectable);
			if (selectable) {
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

		// List rows are task cards with their own tooltips, previews and menus.
		if (arg.view.type === "list") return;

		// Handle timeblock events
		if (eventType === "timeblock" && timeblock) {
			applyTimeblockStyling(el, timeblock);
			setTooltip(el, generateTimeblockTooltip(timeblock), { placement: "top" });
			return;
		}

		// Add data attributes and classes for tasks
		if (taskInfo && taskInfo.path) {
			attachCalendarTaskHoverLink(context.rootElement, el, taskInfo.path);

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
		if (taskInfo) {
			setTooltip(el, generateTaskTooltip(taskInfo, context.plugin));
		} else if (icsEvent) {
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
			const selector = `.fc-task-event[data-task-path="${CSS.escape(taskPath)}"]`;
			const relatedEvents = root?.querySelectorAll<HTMLElement>(selector) ?? [];

			relatedEvents.forEach((relatedEvent) => {
				if (relatedEvent === element) {
					relatedEvent.classList.toggle("fc-task-event--hover-source", active);
				} else {
					relatedEvent.classList.toggle("fc-task-event--related-hover", active);
				}
			});
		};

		element.addEventListener("mouseenter", () => setRelatedState(true));
		element.addEventListener("mouseleave", () => setRelatedState(false));
	}


