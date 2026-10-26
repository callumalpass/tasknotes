import { displayError, uiText } from "../i18n/runtime";
import { uiDuration } from "../i18n/formatters";
import { configLabel } from "../i18n/configLabels";
import { msg } from "@lingui/core/macro";
/**
 * Calendar presentation, external sources, timeblocks and creation interactions.
 * Task projection and edit semantics live in @tasknotes/model/calendar.
 */

import { format } from "date-fns";
import TaskNotesPlugin from "../main";
import { TaskInfo, ICSEvent, TimeBlock, EVENT_DATA_CHANGED } from "../types";
import {
	formatDateForStorage,
	parseDateToUTC,
	getTodayLocal,
} from "../utils/dateUtils";
import {
	updateTimeblockInDailyNote,
	copyTimeblockToDailyNote,
} from "../utils/helpers";
import { Notice, TFile } from "obsidian";
import {
	getAllDailyNotes,
	getDailyNote,
	appHasDailyNotesPluginLoaded,
	createDailyNote,
} from "obsidian-daily-notes-interface";
import {
	TimeblockCreationModal,
	type TimeblockCreationResult,
} from "../modals/TimeblockCreationModal";
import { openTaskSelector } from "../modals/TaskSelectorWithCreateModal";
import { TimeblockInfoModal } from "../modals/TimeblockInfoModal";
import { colorWithAlpha, isCssVariableColor, normalizeThemeColor } from "../utils/themeColors";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Bases/CalendarCore" });


const MIN_EXTERNAL_TIMED_EVENT_DURATION_MS = 1;
export interface CalendarEvent {
	id: string;
	title: string;
	start: string;
	end?: string;
	allDay: boolean;
	backgroundColor?: string;
	borderColor?: string;
	textColor?: string;
	editable?: boolean;
	extendedProps: {
		modelEntry?: import("@tasknotes/model/calendar").CalendarEntry;
		taskInfo?: TaskInfo;
		icsEvent?: ICSEvent;
		timeblock?: TimeBlock;
		eventType:
			| "scheduled"
			| "due"
			| "scheduledToDueSpan"
			| "timeEntry"
			| "recurring"
			| "ics"
			| "timeblock"
			| "property-based";
		filePath?: string; // For property-based events
		file?: unknown; // For property-based events
		basesEntry?: unknown; // For property-based events - full Bases entry with getValue()
		isCompleted?: boolean;
		isSkipped?: boolean;
		isRecurringInstance?: boolean;
		isNextScheduledOccurrence?: boolean;
		isPatternInstance?: boolean;
		isMaterializedOccurrence?: boolean;
		instanceDate?: string;
		occurrenceDate?: string;
		occurrenceParent?: string;
		recurringTemplateTime?: string;
		subscriptionName?: string;
		isGoogleCalendar?: boolean; // For Google Calendar events
		isMicrosoftCalendar?: boolean; // For Microsoft Calendar events
		timeEntryIndex?: number;
		originalDate?: string; // For timeblock events - tracks original date for move operations
		relatedNoteCount?: number; // For calendar events linked to notes/tasks
		isOverdueOnToday?: boolean;
	};
}

export interface ICSEventRenderOptions {
	relatedNoteCount?: number;
}

type CalendarEventLike = {
	start?: Date | null;
	end?: Date | null;
	allDay?: boolean;
	extendedProps?: Record<string, unknown> & Partial<CalendarEvent["extendedProps"]>;
};

type CalendarEventArgLike = {
	event?: CalendarEventLike;
	start?: Date;
	extendedProps?: Partial<CalendarEvent["extendedProps"]>;
};

type CalendarMutationInfo = {
	event: CalendarEventLike;
	revert: () => void;
};

type TimeblockCopyModifierEvent = Pick<MouseEvent, "altKey" | "ctrlKey" | "metaKey">;

type FrontmatterWithTimeblocks = {
	timeblocks?: unknown[];
};

type ObsidianMoment = import("moment").Moment;

type WindowWithMoment = Window & {
	moment(input?: string | Date): ObsidianMoment;
};

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function isTimeblockCopyModifierPressed(
	event: TimeblockCopyModifierEvent | undefined
): boolean {
	return Boolean(event?.ctrlKey || event?.metaKey || event?.altKey);
}

function getWindowMoment(input?: string | Date): ObsidianMoment {
	return (window as unknown as WindowWithMoment).moment(input);
}

/**
 * Convert a configured color to a translucent calendar color.
 * Theme colors are returned as color-mix() values so Obsidian themes can control them.
 */
export function hexToRgba(hex: string, alpha: number): string {
	return colorWithAlpha(hex, alpha);
}

/**
 * Check if the app is in dark mode
 * Uses activeDocument to support pop-out windows
 */
export function isDarkMode(): boolean {
	return activeDocument.body.classList.contains("theme-dark");
}

/**
 * Get appropriate text color for event based on theme
 * Returns dark text for light mode, light text for dark mode
 */
export function getEventTextColor(useThemeColor = false): string {
	if (useThemeColor) {
		return isDarkMode() ? "#e8eaed" : "#202124"; // Light text in dark mode, dark text in light mode
	}
	// For non-themed events, return empty (use border color)
	return "";
}

/**
 * Check if a color string is a CSS variable
 */
export function isCssVariable(color: string): boolean {
	return isCssVariableColor(color);
}

/**
 * Generate tooltip text for a task event
 */
export function generateTaskTooltip(task: TaskInfo, plugin: TaskNotesPlugin): string {
	let tooltipText = task.title;

	if (task.projects && task.projects.length > 0) {
		tooltipText += uiText(msg({ message: "\nProject: {value1}", context: "bases/calendar-core: generateTaskTooltip display" }), { value1: task.projects[0] });
	}

	if (task.priority) {
		const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
		tooltipText += uiText(msg({ message: "\nPriority: {value1}", context: "bases/calendar-core: generateTaskTooltip display" }), { value1: configLabel(priorityConfig) || task.priority });
	}

	if (task.status) {
		const statusConfig = plugin.statusManager.getStatusConfig(task.status);
		tooltipText += uiText(msg({ message: "\nStatus: {value1}", context: "bases/calendar-core: generateTaskTooltip display" }), { value1: configLabel(statusConfig) || task.status });
	}

	if (task.timeEstimate) {
		tooltipText += uiText(msg({ message: "\nEstimate: {duration}", context: "calendar task estimate tooltip" }), { duration: uiDuration(task.timeEstimate) });
	}

	return tooltipText;
}

/**
 * Apply recurring task styling to calendar event element
 */
export function applyRecurringTaskStyling(
	element: HTMLElement,
	extendedProps: {
		isNextScheduledOccurrence?: boolean;
		isPatternInstance?: boolean;
		isRecurringInstance?: boolean;
		isMaterializedOccurrence?: boolean;
		isCompleted?: boolean;
	}
): void {
	const {
		isNextScheduledOccurrence = false,
		isPatternInstance = false,
		isRecurringInstance = false,
		isCompleted = false,
	} = extendedProps;

	if (isNextScheduledOccurrence) {
		// Next scheduled occurrence: Normal task styling (solid border, full opacity)
		element.classList.remove("tn-static-border-style-dashed-12296c91");
		element.classList.add("tn-static-border-style-solid-11080b69");
		element.classList.add("tn-static-border-width-2px-a1222254");
		element.setAttribute("data-next-scheduled", "true");
		element.classList.add("fc-next-scheduled-event");

		// Apply dimmed appearance for completed instances
		if (isCompleted) {
			element.classList.remove(
				"tn-static-opacity-0-8d919cb5",
				"tn-static-opacity-1-c6e7979d"
			);
			element.classList.add("tn-static-opacity-0-6-d95b59ac");
		}
	} else if (isPatternInstance) {
		// Pattern occurrences: Recurring preview styling (dashed border, reduced opacity)
		element.classList.remove("tn-static-border-style-solid-11080b69");
		element.classList.add("tn-static-border-style-dashed-12296c91");
		element.classList.add("tn-static-border-width-2px-a1222254");
		element.style.opacity = isCompleted ? "0.4" : "0.7"; // Reduced opacity for pattern instances

		element.setAttribute("data-pattern-instance", "true");
		element.classList.add("fc-pattern-instance-event");
	} else if (isRecurringInstance) {
		// Legacy recurring instances (for backward compatibility)
		element.classList.remove("tn-static-border-style-solid-11080b69");
		element.classList.add("tn-static-border-style-dashed-12296c91");
		element.classList.add("tn-static-border-width-2px-a1222254");

		element.setAttribute("data-recurring", "true");
		element.classList.add("fc-recurring-event");

		// Apply dimmed appearance for completed instances
		if (isCompleted) {
			element.classList.remove(
				"tn-static-opacity-0-8d919cb5",
				"tn-static-opacity-1-c6e7979d"
			);
			element.classList.add("tn-static-opacity-0-6-d95b59ac");
		}
	}

	if (extendedProps.isMaterializedOccurrence) {
		element.setAttribute("data-materialized-occurrence", "true");
		element.classList.add("fc-materialized-occurrence-event");
	}

	// Apply strikethrough styling for completed tasks
	if (isCompleted) {
		const titleElement = element.querySelector(".tnc-item-title");
		if (titleElement) {
			(titleElement as HTMLElement).classList.remove(
				"tn-static-text-decoration-none-80d654f9"
			);
			(titleElement as HTMLElement).classList.add(
				"tn-static-text-decoration-line-through-7059a4e5"
			);
		} else {
			// Fallback: apply to the entire event element
			element.classList.remove("tn-static-text-decoration-none-80d654f9");
			element.classList.add("tn-static-text-decoration-line-through-7059a4e5");
		}
		element.classList.add("fc-completed-event");
	}
}

/**
 * Address occurrence actions by stored identity, never by rendered placement.
 */
export function getOccurrenceDateForEvent(taskInfo: TaskInfo, eventArg: unknown): Date | undefined {
	if (!taskInfo.recurrence) {
		return undefined;
	}

	const eventContainer = eventArg as CalendarEventArgLike;
	const event = eventContainer.event || eventContainer;
	const instanceDate = event.extendedProps?.instanceDate;
	if (typeof instanceDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(instanceDate)) {
		return undefined;
	}

	return parseDateToUTC(instanceDate);
}

/**
 * Get target date for calendar event context menu
 * Uses the same UTC-anchored logic as AdvancedCalendarView
 */
export function getTargetDateForEvent(eventArg: unknown): Date {
	// Extract from eventArg.event if it's an event mount arg, or directly if it's the event
	const eventContainer = eventArg as CalendarEventArgLike;
	const event = eventContainer.event || eventContainer;
	const extendedProps = event.extendedProps || {};
	const {
		isRecurringInstance,
		isNextScheduledOccurrence,
		isPatternInstance,
		isMaterializedOccurrence,
		instanceDate,
	} = extendedProps;

	// For recurring tasks, use UTC anchor for instance date (matches AdvancedCalendarView)
	if (
		(isRecurringInstance ||
			isNextScheduledOccurrence ||
			isPatternInstance ||
			isMaterializedOccurrence) &&
		instanceDate
	) {
		// For all recurring-related events, use UTC anchor for instance date
		return parseDateToUTC(instanceDate);
	}

	// For regular events, convert FullCalendar date to UTC anchor
	const eventDate = event.start;
	if (eventDate) {
		// Convert FullCalendar Date to date string preserving local date
		const dateStr = format(eventDate, "yyyy-MM-dd");
		return parseDateToUTC(dateStr);
	}

	// Fallback to today
	return getTodayLocal();
}

export function createICSEvent(
	icsEvent: ICSEvent,
	plugin: TaskNotesPlugin,
	options: ICSEventRenderOptions = {}
): CalendarEvent | null {
	try {
		// Check if this is a Google Calendar or Microsoft Calendar event
		const isGoogleCalendar = icsEvent.subscriptionId.startsWith("google-");
		const isMicrosoftCalendar = icsEvent.subscriptionId.startsWith("microsoft-");

		let backgroundColor: string;
		let borderColor: string;
		let textColor: string;
		let subscriptionName: string;

		if (isGoogleCalendar) {
			// Google Calendar event - use event's color if available
			borderColor = icsEvent.color || "#4285F4"; // Default to Google Blue if no color
			backgroundColor = hexToRgba(borderColor, 0.2);
			textColor = getEventTextColor(true); // Use theme-appropriate text color
			subscriptionName = uiText(msg({ message: "Google Calendar", context: "bases/calendar-core: createICSEvent display" }));
		} else if (isMicrosoftCalendar) {
			// Microsoft Calendar event - use event's color if available
			borderColor = icsEvent.color || "#0078D4"; // Default to Microsoft Blue if no color
			backgroundColor = hexToRgba(borderColor, 0.2);
			textColor = getEventTextColor(true); // Use theme-appropriate text color
			subscriptionName = uiText(msg({ message: "Microsoft Calendar", context: "bases/calendar-core: createICSEvent display" }));
		} else {
			// ICS subscription event - use subscription settings
			const subscription = plugin.icsSubscriptionService
				?.getSubscriptions()
				.find((sub) => sub.id === icsEvent.subscriptionId);

			if (!subscription || !subscription.enabled) {
				return null;
			}

			borderColor = normalizeThemeColor(subscription.color, "#3788d8");
			backgroundColor = hexToRgba(borderColor, 0.2);
			textColor = isCssVariable(borderColor) ? getEventTextColor(true) : borderColor;
			subscriptionName = subscription.name;
		}

		const { start, end } = normalizeExternalTimedEventRange(
			icsEvent.start,
			icsEvent.end,
			icsEvent.allDay
		);

		return {
			id: icsEvent.id,
			title: icsEvent.title,
			start,
			end,
			allDay: icsEvent.allDay,
			backgroundColor: backgroundColor,
			borderColor: borderColor,
			textColor: textColor,
			editable: isGoogleCalendar || isMicrosoftCalendar, // Google and Microsoft Calendar events are editable, ICS subscriptions are not
			extendedProps: {
				icsEvent: icsEvent,
				eventType: "ics",
				subscriptionName: subscriptionName,
				isGoogleCalendar: isGoogleCalendar,
				isMicrosoftCalendar: isMicrosoftCalendar,
				relatedNoteCount:
					options.relatedNoteCount && options.relatedNoteCount > 0
						? options.relatedNoteCount
						: undefined,
			},
		};
	} catch (error) {
		tasknotesLogger.error("Error creating ICS event:", {
			category: "provider",
			operation: "creating-ics-event",
			error: error,
		});
		return null;
	}
}

/**
 * FullCalendar list views can render a timed external event under multiple day
 * headers when the provider supplies a true zero-duration range (end === start).
 * Clamp those point-in-time external events to a minimal positive duration
 * before handing them to FullCalendar, while preserving the raw provider event
 * unchanged in extendedProps for display and debugging.
 */
function normalizeExternalTimedEventRange(
	start: string,
	end: string | undefined,
	allDay: boolean
): { start: string; end?: string } {
	if (allDay || !end) {
		return { start, end };
	}

	const startDate = new Date(start);
	const endDate = new Date(end);

	if (
		Number.isNaN(startDate.getTime()) ||
		Number.isNaN(endDate.getTime()) ||
		endDate.getTime() !== startDate.getTime()
	) {
		return { start, end };
	}

	const normalizedEnd = new Date(endDate.getTime() + MIN_EXTERNAL_TIMED_EVENT_DURATION_MS);
	return {
		start,
		end: formatExternalTimedEventEnd(normalizedEnd, end),
	};
}

function formatExternalTimedEventEnd(date: Date, originalEnd: string): string {
	if (/Z$/i.test(originalEnd)) {
		return date.toISOString();
	}

	const offsetMatch = originalEnd.match(/([+-])(\d{2}):?(\d{2})$/);
	if (offsetMatch) {
		const [, sign, hours, minutes] = offsetMatch;
		const offsetMinutes = Number(hours) * 60 + Number(minutes);
		const offsetMs = offsetMinutes * 60 * 1000 * (sign === "+" ? 1 : -1);
		const shifted = new Date(date.getTime() + offsetMs);
		const pad = (value: number, length = 2) => String(value).padStart(length, "0");
		const datePart = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
		const timePart = `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}.${pad(shifted.getUTCMilliseconds(), 3)}`;
		return `${datePart}T${timePart}${sign}${hours}:${minutes}`;
	}

	return format(date, "yyyy-MM-dd'T'HH:mm:ss.SSS");
}

/**
 * Get recurring time from task recurrence rule
 */
export function createTimeblockEvent(
	timeblock: TimeBlock,
	date: string,
	defaultColor = "#6366f1"
): CalendarEvent {
	const startDateTime = `${date}T${timeblock.startTime}:00`;
	const endDateTime = `${date}T${timeblock.endTime}:00`;

	const backgroundColor = normalizeThemeColor(timeblock.color || defaultColor, "#6366f1");
	const borderColor = backgroundColor;

	return {
		id: `timeblock-${timeblock.id}`,
		title: timeblock.title,
		start: startDateTime,
		end: endDateTime,
		allDay: false,
		backgroundColor: backgroundColor,
		borderColor: borderColor,
		textColor: "var(--text-on-accent)",
		editable: true,
		extendedProps: {
			eventType: "timeblock",
			timeblock: timeblock,
			originalDate: date, // Store original date for tracking moves
		},
	};
}

/**
 * Validate and extract timeblocks from cached frontmatter
 */
function extractTimeblocksFromCache(frontmatter: unknown, path: string): TimeBlock[] {
	const frontmatterData = frontmatter as FrontmatterWithTimeblocks | null | undefined;
	if (!frontmatterData?.timeblocks || !Array.isArray(frontmatterData.timeblocks)) {
		return [];
	}

	const validTimeblocks: TimeBlock[] = [];
	for (const tb of frontmatterData.timeblocks) {
		const timeblock = tb as Partial<TimeBlock> | null;
		// Basic validation - must have id, startTime, endTime
		if (
			timeblock &&
			typeof timeblock.id === "string" &&
			typeof timeblock.startTime === "string" &&
			typeof timeblock.endTime === "string"
		) {
			validTimeblocks.push(timeblock as TimeBlock);
		}
	}
	return validTimeblocks;
}

/**
 * Generate timeblock events from daily notes for a date range
 * Uses metadataCache for performance - no file reads required
 */
// Cache for daily notes to avoid repeated getAllDailyNotes() calls
let _dailyNotesCache: Record<string, TFile> | null = null;
let _dailyNotesCacheTime = 0;
const DAILY_NOTES_CACHE_TTL = 5000; // 5 seconds

export async function generateTimeblockEvents(
	plugin: TaskNotesPlugin,
	startDate: Date,
	endDate: Date
): Promise<CalendarEvent[]> {
	try {
		// Use cached daily notes if available and fresh
		const now = Date.now();
		if (!_dailyNotesCache || now - _dailyNotesCacheTime > DAILY_NOTES_CACHE_TTL) {
			_dailyNotesCache = getAllDailyNotes();
			_dailyNotesCacheTime = now;
		}
		const allDailyNotes = _dailyNotesCache;

		const events: CalendarEvent[] = [];

		// Iterate through date range using cached metadata (no file reads)
		for (
			let currentUTC = new Date(startDate);
			currentUTC <= endDate;
			currentUTC.setUTCDate(currentUTC.getUTCDate() + 1)
		) {
			const dateString = formatDateForStorage(currentUTC);
			const currentDate = new Date(`${dateString}T12:00:00`);
			const dailyNote = getDailyNote(getWindowMoment(currentDate), allDailyNotes);

			if (dailyNote) {
				// Use metadataCache instead of reading file
				const cache = plugin.app.metadataCache.getFileCache(dailyNote);
				if (cache?.frontmatter) {
					const timeblocks = extractTimeblocksFromCache(
						cache.frontmatter,
						dailyNote.path
					);
					for (const timeblock of timeblocks) {
						events.push(
							createTimeblockEvent(
								timeblock,
								dateString,
								plugin.settings.calendarViewSettings.defaultTimeblockColor
							)
						);
					}
				}
			}
		}

		return events;
	} catch (error) {
		tasknotesLogger.error("Error getting timeblock events:", {
			category: "provider",
			operation: "getting-timeblock-events",
			error: error,
		});
		return [];
	}
}

/**
 * Create a timeblock from a selected timed range.
 */
export async function handleTimeblockCreation(
	start: Date,
	end: Date,
	allDay: boolean,
	plugin: TaskNotesPlugin,
	onCreated?: (result: TimeblockCreationResult) => void | Promise<void>
): Promise<void> {
	// Don't create timeblocks for all-day selections
	if (allDay) {
		new Notice(plugin.i18n.translate(msg({ message: "Timeblocks must have specific times. Please select a time range in week or day view.", context: "views.advancedCalendar.notices.timeblockSpecificTime" })));
		return;
	}

	const date = format(start, "yyyy-MM-dd");
	const startTime = format(start, "HH:mm");
	const endTime = format(end, "HH:mm");

	const modal = new TimeblockCreationModal(plugin.app, plugin, {
		date,
		startTime,
		endTime,
		onCreated,
	});

	modal.open();
}

/**
 * Handle time entry creation (Alt+drag to create time entry)
 */
export async function handleTimeEntryCreation(
	start: Date,
	end: Date,
	allDay: boolean,
	plugin: TaskNotesPlugin
): Promise<void> {
	// Don't create time entries for all-day selections
	if (allDay) {
		new Notice(plugin.i18n.translate(msg({ message: "Time entries must have specific times. Please select a time range in week or day view.", context: "modals.timeEntry.mustHaveSpecificTime" })));
		return;
	}

	try {
		// Get all tasks
		const allTasks = await plugin.cacheManager.getAllTasks();
		const unarchivedTasks = allTasks.filter((task) => !task.archived);

		if (unarchivedTasks.length === 0) {
			new Notice(plugin.i18n.translate(msg({ message: "No tasks available to create time entries for", context: "modals.timeEntry.noTasksAvailable" })));
			return;
		}

		// Open task selector modal
		openTaskSelector(plugin, unarchivedTasks, (selectedTask: TaskInfo) => {
			void (async () => {
				if (selectedTask) {
					try {
						// Calculate duration
						const durationMinutes = Math.round(
							(end.getTime() - start.getTime()) / 60000
						);

						// Create new time entry
						const newEntry = {
							startTime: start.toISOString(),
							endTime: end.toISOString(),
							description: "",
						};

						// Add to task's time entries
						const updatedTimeEntries = [
							...(selectedTask.timeEntries || []),
							newEntry,
						].map((entry) => {
							const sanitizedEntry: Record<string, unknown> = { ...entry };
							delete sanitizedEntry.duration;
							return sanitizedEntry as typeof entry;
						});

						// Save to file
						await plugin.taskService.updateTask(selectedTask, {
							timeEntries: updatedTimeEntries,
						});

						// Note: updateTask in TaskService already triggers EVENT_TASK_UPDATED internally
						// We just need to trigger EVENT_DATA_CHANGED
						plugin.emitter.trigger(EVENT_DATA_CHANGED);

						new Notice(
							plugin.i18n.translate(msg({ message: "Time entry created for {taskTitle} ({duration} minutes)", context: "modals.timeEntry.created" }), {
								taskTitle: selectedTask.title,
								duration: durationMinutes.toString(),
							})
						);
					} catch (error) {
						tasknotesLogger.error("Error creating time entry:", {
							category: "provider",
							operation: "creating-time-entry",
							error: error,
						});
						new Notice(plugin.i18n.translate(msg({ message: "Failed to create time entry", context: "modals.timeEntry.createFailed" })));
					}
				}
			})();
		});
	} catch (error) {
		tasknotesLogger.error("Error opening task selector for time entry:", {
			category: "provider",
			operation: "opening-task-selector-time-entry",
			error: error,
		});
		new Notice(plugin.i18n.translate(msg({ message: "Failed to create time entry", context: "modals.timeEntry.createFailed" })));
	}
}

/**
 * Handle timeblock drop (move to new date/time)
 */
export async function handleTimeblockDrop(
	dropInfo: CalendarMutationInfo,
	timeblock: TimeBlock,
	originalDate: string,
	plugin: TaskNotesPlugin,
	copyRequested = false
): Promise<void> {
	try {
		const newStart = dropInfo.event.start;
		const newEnd = dropInfo.event.end;
		if (!newStart || !newEnd) {
			dropInfo.revert();
			return;
		}

		// Calculate new date and times
		const newDate = format(newStart, "yyyy-MM-dd");
		const newStartTime = format(newStart, "HH:mm");
		const newEndTime = format(newEnd, "HH:mm");

		if (copyRequested) {
			await copyTimeblockToDailyNote(
				plugin.app,
				newDate,
				timeblock,
				newStartTime,
				newEndTime
			);
			dropInfo.revert();
			plugin.emitter.trigger(EVENT_DATA_CHANGED);
			new Notice(plugin.i18n.translate(msg({ message: "Timeblock duplicated successfully", context: "notices.audit.timeblockCopied" })));
			return;
		}

		// Update timeblock in daily notes
		await updateTimeblockInDailyNote(
			plugin.app,
			timeblock.id,
			originalDate,
			newDate,
			newStartTime,
			newEndTime
		);

		new Notice(plugin.i18n.translate(msg({ message: "Timeblock moved successfully", context: "notices.audit.timeblockMoved" })));
	} catch (error: unknown) {
		tasknotesLogger.error("Error moving timeblock:", {
			category: "provider",
			operation: "moving-timeblock",
			error: error,
		});
		new Notice(
			plugin.i18n.translate(msg({ message: "Failed to move timeblock: {message}", context: "views.advancedCalendar.notices.timeblockMoveFailed" }), {
				message: displayError(getErrorMessage(error)),
			})
		);
		dropInfo.revert();
	}
}

/**
 * Handle timeblock resize (change duration)
 */
export async function handleTimeblockResize(
	resizeInfo: CalendarMutationInfo,
	timeblock: TimeBlock,
	originalDate: string,
	plugin: TaskNotesPlugin
): Promise<void> {
	try {
		const start = resizeInfo.event.start;
		const end = resizeInfo.event.end;

		if (!start || !end) {
			resizeInfo.revert();
			return;
		}

		// Calculate new times
		const newStartTime = format(start, "HH:mm");
		const newEndTime = format(end, "HH:mm");

		// Update timeblock in daily note (same date, just time change)
		await updateTimeblockInDailyNote(
			plugin.app,
			timeblock.id,
			originalDate,
			originalDate, // Same date
			newStartTime,
			newEndTime
		);

		new Notice(plugin.i18n.translate(msg({ message: "Timeblock duration updated", context: "notices.audit.timeblockResized" })));
	} catch (error: unknown) {
		tasknotesLogger.error("Error resizing timeblock:", {
			category: "provider",
			operation: "resizing-timeblock",
			error: error,
		});
		new Notice(
			plugin.i18n.translate(msg({ message: "Failed to resize timeblock: {message}", context: "views.advancedCalendar.notices.timeblockResizeFailed" }), {
				message: displayError(getErrorMessage(error)),
			})
		);
		resizeInfo.revert();
	}
}

/**
 * Show timeblock info modal
 */
export async function showTimeblockInfoModal(
	timeblock: TimeBlock,
	eventDate: Date,
	originalDate: string | undefined,
	plugin: TaskNotesPlugin,
	onChange?: () => void
): Promise<void> {
	const modal = new TimeblockInfoModal(
		plugin.app,
		plugin,
		timeblock,
		eventDate,
		originalDate,
		onChange
	);
	modal.open();
}

/**
 * Apply timeblock event styling
 */
export function applyTimeblockStyling(element: HTMLElement, timeblock: TimeBlock): void {
	// Add data attributes for timeblocks
	element.setAttribute("data-timeblock-id", timeblock.id || "");

	// Add visual styling for timeblocks
	element.classList.remove("tn-static-border-style-dashed-12296c91");
	element.classList.add("tn-static-border-style-solid-11080b69");
	element.classList.add("tn-static-border-width-2px-a1222254");
	element.classList.add("fc-timeblock-event");
}

/**
 * Generate timeblock tooltip text
 */
export function generateTimeblockTooltip(timeblock: TimeBlock): string {
	const attachmentCount = timeblock.attachments?.length || 0;
	const title = timeblock.title || uiText(msg({ message: "Timeblock", context: "unnamed timeblock tooltip" }));
	if (timeblock.description) {
		return uiText(msg({ message: "{count, plural, =0 {{title} - {description}} one {{title} - {description} (# attachment)} other {{title} - {description} (# attachments)}}", context: "timeblock tooltip with description" }), { count: attachmentCount, title, description: timeblock.description });
	}
	return uiText(msg({ message: "{count, plural, =0 {{title}} one {{title} (# attachment)} other {{title} (# attachments)}}", context: "timeblock tooltip" }), { count: attachmentCount, title });
}

/**
 * Add hover preview functionality to a task event element
 */
export function addTaskHoverPreview(
	element: HTMLElement,
	taskInfo: TaskInfo,
	plugin: TaskNotesPlugin,
	source = "tasknotes-calendar"
): void {
	element.addEventListener("mouseover", (event: MouseEvent) => {
		const file = plugin.app.vault.getAbstractFileByPath(taskInfo.path);
		if (file) {
			plugin.app.workspace.trigger("hover-link", {
				event,
				source,
				hoverParent: element,
				targetEl: element,
				linktext: taskInfo.path,
				sourcePath: taskInfo.path,
			});
		}
	});
}

export interface DateTitleClickOptions {
	createIfMissing?: boolean;
}

/**
 * Handle clicking on a date title to open/create daily note
 */
export async function handleDateTitleClick(
	date: Date,
	plugin: TaskNotesPlugin,
	options: DateTitleClickOptions = {}
): Promise<void> {
	try {
		const { createIfMissing = true } = options;

		// Check if Daily Notes plugin is enabled
		if (!appHasDailyNotesPluginLoaded()) {
			new Notice(plugin.i18n.translate(msg({ message: "Daily notes core plugin is not enabled. Please enable it in settings > core plugins.", context: "notices.commands.dailyNotesDisabled" })));
			return;
		}

		// Convert date to moment for the API
		const moment = getWindowMoment(date);

		// Get all daily notes to check if one exists for this date
		const allDailyNotes = getAllDailyNotes();
		let dailyNote = getDailyNote(moment, allDailyNotes);

		if (!dailyNote) {
			if (!createIfMissing) {
				new Notice(plugin.i18n.translate(msg({ message: "No daily note exists for this date.", context: "views.basesCalendar.notices.noDailyNoteForDate" })));
				return;
			}

			// Daily note doesn't exist, create it
			try {
				dailyNote = await createDailyNote(moment);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				tasknotesLogger.error("Failed to create daily note:", {
					category: "provider",
					operation: "create-daily-note",
					error: error,
				});
				new Notice(
					plugin.i18n.translate(msg({ message: "Failed to create daily note: {message}", context: "notices.commands.dailyNoteCreateFailed" }), {
						message: displayError(errorMessage),
					})
				);
				return;
			}
		}

		// Open the daily note
		if (dailyNote) {
			await plugin.app.workspace.getLeaf(false).openFile(dailyNote);
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		tasknotesLogger.error("Failed to navigate to daily note:", {
			category: "provider",
			operation: "navigate-daily-note",
			error: error,
		});
		new Notice(
			plugin.i18n.translate(msg({ message: "Failed to navigate to daily note: {message}", context: "notices.commands.dailyNoteOpenFailed" }), { message: displayError(errorMessage) })
		);
	}
}



/**
 * Calculate pre-populated values for task creation from calendar date selection
 *
 * This shared logic is used by both AdvancedCalendarView and Bases calendar view
 * to consistently handle multi-day selections, timed selections, and single clicks.
 *
 * @param start - Selection start date
 * @param end - Selection end date
 * @param allDay - Whether this is an all-day selection
 * @param slotDurationMinutes - Calendar slot duration in minutes (for detecting drags vs clicks)
 * @returns Pre-populated values object with scheduled date and optional timeEstimate
 */
export function calculateTaskCreationValues(
	start: Date,
	end: Date,
	allDay: boolean,
	slotDurationMinutes: number
): { scheduled: string; timeEstimate?: number } {
	// Pre-populate with selected date/time
	const scheduledDate = allDay
		? format(start, "yyyy-MM-dd")
		: format(start, "yyyy-MM-dd'T'HH:mm");

	const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

	// Determine if this was a drag (intentional time selection) or just a click
	// If duration is greater than slot duration, it's an intentional drag
	const isDragOperation = !allDay && durationMinutes > slotDurationMinutes;

	const prePopulatedValues: { scheduled: string; timeEstimate?: number } = {
		scheduled: scheduledDate,
	};

	// Only override time estimate if it's an intentional drag operation
	if (allDay) {
		// For all-day events, calculate duration in days if multi-day selection
		const dayDurationMillis = 24 * 60 * 60 * 1000; // milliseconds in a day
		const daysDuration = Math.round((end.getTime() - start.getTime()) / dayDurationMillis);

		if (daysDuration > 1) {
			// Multi-day selection: set time estimate based on days
			const minutesPerDay = 60 * 24;
			prePopulatedValues.timeEstimate = daysDuration * minutesPerDay;
		}
		// For single-day all-day events, let TaskCreationModal use the default setting
	} else if (isDragOperation) {
		// User dragged to select a specific duration, use that
		prePopulatedValues.timeEstimate = durationMinutes;
	}
	// For clicks (not drags), don't set timeEstimate to let default setting apply

	return prePopulatedValues;
}
