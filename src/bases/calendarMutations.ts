import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import type { CalendarEventChange } from "./calendarEngine";
import { format } from "date-fns";
import { TFile } from "obsidian";
import {
	handleTimeblockDrop,
	handleTimeblockResize,
	isTimeblockCopyModifierPressed,
} from "./calendar-core";
import {
	buildProviderEventDateUpdate,
	getCalendarFrontmatterPropertyName,
	planPropertyEventDrop,
	planPropertyEventResize,
} from "./calendarMutationPlanning";
import { processVaultFrontMatter } from "../services/VaultMutationService";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { captureTaskUndo } from "../ui/taskMutationUndo";
import { showTaskUndo } from "../ui/taskPropertyPickers";

const tasknotesLogger = createTaskNotesLogger({ tag: "Bases/CalendarMutations" });
export interface CalendarMutationContext {
	plugin: TaskNotesPlugin;
	options: { startDateProperty: string | null; endDateProperty: string | null };
	timezone: string;
	refreshTask(task: TaskInfo): Promise<void>;
	refreshEvent(event: CalendarEventChange["event"]): void;
}

export async function handleCalendarEventDrop(
	context: CalendarMutationContext,
	info: CalendarEventChange
): Promise<void> {
	if (!info.event.extendedProps) {
		tasknotesLogger.warn("[TaskNotes][CalendarView] Event dropped without extendedProps", {
			category: "provider",
			operation: "event-dropped-without-extendedprops",
		});
		return;
	}

	const { taskInfo, timeblock, eventType, filePath, icsEvent } = info.event.extendedProps;

	// Handle timeblock drops
	if (eventType === "timeblock") {
		if (!info.oldEvent.start || !timeblock) {
			info.revert();
			return;
		}
		const originalDate = format(info.oldEvent.start, "yyyy-MM-dd");
		const updated = await handleTimeblockDrop(
			info,
			timeblock,
			originalDate,
			context.plugin,
			info.isPointer && isTimeblockCopyModifierPressed(info.jsEvent ?? undefined)
		);
		if (updated) context.refreshEvent(info.event);
		return;
	}

	// Handle property-based event drops
	if (eventType === "property-based" && filePath) {
		try {
			const file = context.plugin.app.vault.getAbstractFileByPath(filePath);
			if (!file || !(file instanceof TFile)) {
				info.revert();
				return;
			}

			// Get property IDs
			const startDateProperty = context.options.startDateProperty;
			const endDateProperty = context.options.endDateProperty;

			const startProp = getCalendarFrontmatterPropertyName(startDateProperty);
			const endProp = getCalendarFrontmatterPropertyName(endDateProperty);
			if (!startProp) {
				info.revert();
				return;
			}

			const oldStart = info.oldEvent.start;
			const newStart = info.event.start;
			if (!oldStart || !newStart) {
				info.revert();
				return;
			}

			// Update frontmatter
			await processVaultFrontMatter(context.plugin.app, file, (frontmatter) => {
				const plan = planPropertyEventDrop({
					frontmatter,
					startProperty: startProp,
					endProperty: endProp,
					oldStart,
					newStart,
					allDay: info.event.allDay,
				});
				if (plan.kind === "update-frontmatter") {
					for (const [property, value] of Object.entries(plan.updates)) {
						frontmatter[property] = value;
					}
				}
			});
		} catch (error) {
			tasknotesLogger.error(
				"[TaskNotes][CalendarView] Error updating property-based event:",
				{
					category: "provider",
					operation: "updating-property-based-event",
					error: error,
				}
			);
			info.revert();
		}
		return;
	}

	// Handle calendar provider event drops (Google, Microsoft, etc.)
	if (eventType === "ics" && icsEvent) {
		const provider = context.plugin.calendarProviderRegistry?.findProviderForEvent(icsEvent);
		if (provider) {
			try {
				const { calendarId, eventId } = provider.extractEventIds(icsEvent);
				const providerUpdate = buildProviderEventDateUpdate({
					start: info.event.start,
					end: info.event.end,
					allDay: info.event.allDay,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
				});
				if (providerUpdate.kind === "revert") {
					info.revert();
					return;
				}

				info.event.extendedProps.icsEvent = await provider.updateEvent(calendarId, eventId, providerUpdate.updates);
				context.refreshEvent(info.event);
			} catch (error) {
				tasknotesLogger.error(
					`[TaskNotes][CalendarView] Error updating ${provider.providerName} event:`,
					{ category: "provider", operation: "updating", error: error }
				);
				info.revert();
			}
			return;
		} else {
			// ICS event without provider, block move
			info.revert();
			return;
		}
	}

	if (taskInfo) await applyTaskCalendarGesture(context, info, "drop");
}

export async function handleCalendarEventResize(
	context: CalendarMutationContext,
	info: CalendarEventChange
): Promise<void> {
	if (!info.event.extendedProps) {
		tasknotesLogger.warn("[TaskNotes][CalendarView] Event resized without extendedProps", {
			category: "provider",
			operation: "event-resized-without-extendedprops",
		});
		return;
	}

	const { taskInfo, timeblock, eventType, filePath, icsEvent } = info.event.extendedProps;

	// Handle timeblock resize
	if (eventType === "timeblock") {
		if (!info.event.start || !timeblock) {
			info.revert();
			return;
		}
		const originalDate = format(info.event.start, "yyyy-MM-dd");
		if (await handleTimeblockResize(info, timeblock, originalDate, context.plugin)) {
			context.refreshEvent(info.event);
		}
		return;
	}

	// Handle property-based event resize
	if (eventType === "property-based" && filePath) {
		try {
			const file = context.plugin.app.vault.getAbstractFileByPath(filePath);
			if (!file || !(file instanceof TFile)) {
				info.revert();
				return;
			}

			const endDateProperty = context.options.endDateProperty;
			const endProp = getCalendarFrontmatterPropertyName(endDateProperty);
			const plan = planPropertyEventResize({
				endProperty: endProp,
				newEnd: info.event.end,
				allDay: info.event.allDay,
			});
			if (plan.kind === "revert") {
				info.revert();
				return;
			}
			if (plan.kind === "ignore") {
				return;
			}

			// Update frontmatter
			await processVaultFrontMatter(context.plugin.app, file, (frontmatter) => {
				for (const [property, value] of Object.entries(plan.updates)) {
					frontmatter[property] = value;
				}
			});
		} catch (error) {
			tasknotesLogger.error(
				"[TaskNotes][CalendarView] Error resizing property-based event:",
				{
					category: "provider",
					operation: "resizing-property-based-event",
					error: error,
				}
			);
			info.revert();
		}
		return;
	}

	// Handle calendar provider event resize (Google, Microsoft, etc.)
	if (eventType === "ics" && icsEvent) {
		const provider = context.plugin.calendarProviderRegistry?.findProviderForEvent(icsEvent);
		if (provider) {
			try {
				const { calendarId, eventId } = provider.extractEventIds(icsEvent);
				const providerUpdate = buildProviderEventDateUpdate({
					start: info.event.start,
					end: info.event.end,
					allDay: info.event.allDay,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
					requireEnd: true,
				});
				if (providerUpdate.kind === "revert") {
					info.revert();
					return;
				}

				info.event.extendedProps.icsEvent = await provider.updateEvent(calendarId, eventId, providerUpdate.updates);
				context.refreshEvent(info.event);
			} catch (error) {
				tasknotesLogger.error(
					`[TaskNotes][CalendarView] Error resizing ${provider.providerName} event:`,
					{ category: "provider", operation: "resizing", error: error }
				);
				info.revert();
			}
			return;
		}
	}

	if (taskInfo) await applyTaskCalendarGesture(context, info, "resize");
}

async function applyTaskCalendarGesture(
	context: CalendarMutationContext,
	info: CalendarEventChange,
	kind: "drop" | "resize"
): Promise<void> {
	const { taskInfo, modelEntry } = info.oldEvent.extendedProps;
	if (!taskInfo || !modelEntry || !info.event.start) {
		info.revert();
		return;
	}
	try {
		const start = info.event.start.toISOString();
		const current = await context.plugin.cacheManager.getTaskInfo(taskInfo.path);
		if (!current) throw new Error(`Missing task: ${taskInfo.path}`);
		const result = await captureTaskUndo(context.plugin, current, () => context.plugin.taskService.applyCalendarEdit(
			current,
			modelEntry,
			{
				kind,
				start,
				end: info.event.end?.toISOString(),
				allDay: info.event.allDay,
			},
			context.timezone
		));
		if (result.task) {
			await context.refreshTask(result.task);
			showTaskUndo(result.undo ? [result.undo] : [], false, 1, context.plugin.app.vault, `${result.task.title} · ${result.task.scheduled ?? result.task.due ?? ""}`);
		}
		else info.revert();
	} catch (error) {
		tasknotesLogger.error("Cannot apply calendar edit", {
			category: "persistence",
			operation: "calendar-edit",
			error,
		});
		showTaskUndo([], true, 0, context.plugin.app.vault, taskInfo.title);
		info.revert();
	}
}
