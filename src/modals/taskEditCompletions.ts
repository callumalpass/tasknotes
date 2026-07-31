import { Menu, setIcon } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";
import {
	formatDateForStorage,
	generateUTCCalendarDates,
	getTodayLocal,
	getUTCEndOfMonth,
	getUTCEndOfWeek,
	getUTCStartOfMonth,
	getUTCStartOfWeek,
	parseDateAsLocal,
} from "../utils/dateUtils";
import { generateRecurringInstances } from "../utils/helpers";
import { openOrCreateOccurrenceNote } from "../ui/occurrenceNoteActions";

interface TaskEditCompletionsOptions {
	task: TaskInfo;
	plugin: TaskNotesPlugin;
	completedInstancesChanges: string[];
	skippedInstancesChanges: string[];
	translate: (key: string, params?: Record<string, string | number>) => string;
}

export function createCompletionsCalendarSection(
	container: HTMLElement,
	options: TaskEditCompletionsOptions
): void {
	if (!options.task.recurrence) {
		return;
	}

	const calendarContainer = container.createDiv("completions-calendar-container");
	const calendarLabel = calendarContainer.createDiv("detail-label");
	calendarLabel.textContent = options.translate("modals.taskEdit.sections.completions");

	const calendarContent = calendarContainer.createDiv("completions-calendar-content");
	createRecurringCalendar(calendarContent, options);
}

function createRecurringCalendar(
	container: HTMLElement,
	options: TaskEditCompletionsOptions
): void {
	const calendarWrapper = container.createDiv("recurring-calendar");
	const currentDate = getTodayLocal();
	let mostRecentCompletion = currentDate;

	if (options.task.complete_instances && options.task.complete_instances.length > 0) {
		const validCompletions = options.task.complete_instances
			.filter((date) => date && typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date.trim()))
			.map((date) => parseDateAsLocal(date).getTime())
			.filter((time) => !isNaN(time));

		if (validCompletions.length > 0) {
			mostRecentCompletion = new Date(Math.max(...validCompletions));
		}
	}

	renderCalendarMonth(calendarWrapper, mostRecentCompletion, options);
}

function renderCalendarMonth(
	container: HTMLElement,
	displayDate: Date,
	options: TaskEditCompletionsOptions
): void {
	container.empty();

	const header = container.createDiv("recurring-calendar__header");
	const prevButton = header.createEl("button", {
		cls: "recurring-calendar__nav",
		attr: {
			type: "button",
			"aria-label": "Previous month",
		},
	});
	setIcon(prevButton, "chevron-left");
	const monthLabel = header.createSpan("recurring-calendar__month");
	const locale = options.plugin.i18n.getCurrentLocale() || "en";
	const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
	monthLabel.textContent = monthFormatter.format(displayDate);
	const nextButton = header.createEl("button", {
		cls: "recurring-calendar__nav",
		attr: {
			type: "button",
			"aria-label": "Next month",
		},
	});
	setIcon(nextButton, "chevron-right");

	const grid = container.createDiv("recurring-calendar__grid");
	const monthStart = getUTCStartOfMonth(displayDate);
	const monthEnd = getUTCEndOfMonth(displayDate);
	const firstDaySetting = options.plugin.settings.calendarViewSettings.firstDay || 0;
	const calendarStart = getUTCStartOfWeek(monthStart, firstDaySetting);
	const calendarEnd = getUTCEndOfWeek(monthEnd, firstDaySetting);
	const allDays = generateUTCCalendarDates(calendarStart, calendarEnd);

	const bufferStart = getUTCStartOfMonth(displayDate);
	bufferStart.setUTCMonth(bufferStart.getUTCMonth() - 1);
	const bufferEnd = getUTCEndOfMonth(displayDate);
	bufferEnd.setUTCMonth(bufferEnd.getUTCMonth() + 1);

	const recurringDates = generateRecurringInstances(options.task, bufferStart, bufferEnd);
	const recurringDateStrings = new Set(recurringDates.map((date) => formatDateForStorage(date)));
	const completedInstances = getCurrentCompletedInstances(options);
	const skippedInstances = getCurrentSkippedInstances(options);

	allDays.forEach((day) => {
		const dayStr = formatDateForStorage(day);
		const isCurrentMonth = day.getUTCMonth() === displayDate.getUTCMonth();
		const isOccurrenceDate = recurringDateStrings.has(dayStr);
		const occurrenceDate = new Date(day);
		const dayElement = grid.createDiv("recurring-calendar__day");
		dayElement.textContent = String(day.getUTCDate());
		dayElement.addClass("recurring-calendar__day--clickable");
		dayElement.setAttribute("data-occurrence-date", dayStr);

		if (!isCurrentMonth) {
			dayElement.addClass("recurring-calendar__day--faded");
		}
		if (isOccurrenceDate) {
			dayElement.addClass("recurring-calendar__day--recurring");
			dayElement.addClass("recurring-calendar__day--contextable");
			dayElement.setAttribute("aria-label", `Occurrence ${dayStr}`);
		}
		if (completedInstances.has(dayStr)) {
			dayElement.addClass("recurring-calendar__day--completed");
		}
		if (skippedInstances.has(dayStr)) {
			dayElement.addClass("recurring-calendar__day--skipped");
		}

		dayElement.addEventListener("click", () => {
			syncInstanceChangeState(options, dayStr, "complete");
			renderCalendarMonth(container, displayDate, options);
		});

		if (isOccurrenceDate) {
			dayElement.addEventListener("contextmenu", (event) => {
				showOccurrenceContextMenu(event, container, displayDate, occurrenceDate, options);
			});
		}
	});

	prevButton.addEventListener("click", () => {
		const prevMonth = new Date(displayDate);
		prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
		renderCalendarMonth(container, prevMonth, options);
	});

	nextButton.addEventListener("click", () => {
		const nextMonth = new Date(displayDate);
		nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
		renderCalendarMonth(container, nextMonth, options);
	});
}

function showOccurrenceContextMenu(
	event: MouseEvent,
	container: HTMLElement,
	displayDate: Date,
	occurrenceDate: Date,
	options: TaskEditCompletionsOptions
): void {
	event.preventDefault();
	event.stopPropagation();

	const dayStr = formatDateForStorage(occurrenceDate);
	const completedInstances = getCurrentCompletedInstances(options);
	const isCompleted = completedInstances.has(dayStr);
	const menu = new Menu();

	menu.addItem((item) => {
		item.setTitle("Open or create occurrence note");
		item.setIcon("file-plus");
		item.onClick(async () => {
			await openOrCreateOccurrenceNote({
				plugin: options.plugin,
				parentTask: options.task,
				targetDate: occurrenceDate,
				openInNewLeaf: true,
			});
		});
	});

	menu.addSeparator();

	menu.addItem((item) => {
		item.setTitle(isCompleted ? "Mark incomplete for this date" : "Mark complete for this date");
		item.setIcon(isCompleted ? "x" : "check");
		item.onClick(() => {
			syncInstanceChangeState(options, dayStr, "complete");
			renderCalendarMonth(container, displayDate, options);
		});
	});

	const skippedInstances = getCurrentSkippedInstances(options);
	const isSkipped = skippedInstances.has(dayStr);

	menu.addItem((item) => {
		item.setTitle(isSkipped ? "Unskip instance" : "Skip instance");
		item.setIcon(isSkipped ? "undo" : "x-circle");
		item.onClick(() => {
			syncInstanceChangeState(options, dayStr, "skip");
			renderCalendarMonth(container, displayDate, options);
		});
	});

	menu.showAtMouseEvent(event);
}

function getCurrentCompletedInstances(options: TaskEditCompletionsOptions): Set<string> {
	const completedInstances = new Set(options.task.complete_instances || []);
	for (const dateStr of options.completedInstancesChanges) {
		if (completedInstances.has(dateStr)) {
			completedInstances.delete(dateStr);
		} else {
			completedInstances.add(dateStr);
		}
	}
	return completedInstances;
}

function getCurrentSkippedInstances(options: TaskEditCompletionsOptions): Set<string> {
	const skippedInstances = new Set(options.task.skipped_instances || []);
	for (const dateStr of options.skippedInstancesChanges) {
		if (skippedInstances.has(dateStr)) {
			skippedInstances.delete(dateStr);
		} else {
			skippedInstances.add(dateStr);
		}
	}
	return skippedInstances;
}

function syncInstanceChangeState(
	options: TaskEditCompletionsOptions,
	dateStr: string,
	action: "complete" | "skip"
): void {
	const completedInstances = getCurrentCompletedInstances(options);
	const skippedInstances = getCurrentSkippedInstances(options);

	if (action === "complete") {
		if (completedInstances.has(dateStr)) {
			completedInstances.delete(dateStr);
			skippedInstances.delete(dateStr);
		} else {
			completedInstances.add(dateStr);
			skippedInstances.delete(dateStr);
		}
	} else if (skippedInstances.has(dateStr)) {
		skippedInstances.delete(dateStr);
	} else {
		skippedInstances.add(dateStr);
		completedInstances.delete(dateStr);
	}

	replaceInstanceChanges(
		options.completedInstancesChanges,
		options.task.complete_instances || [],
		completedInstances
	);
	replaceInstanceChanges(
		options.skippedInstancesChanges,
		options.task.skipped_instances || [],
		skippedInstances
	);
}

function replaceInstanceChanges(
	changes: string[],
	originalInstances: string[],
	currentInstances: Set<string>
): void {
	changes.splice(0, changes.length);
	const original = new Set(originalInstances);
	const allDates = new Set([...original, ...currentInstances]);
	for (const dateStr of allDates) {
		if (original.has(dateStr) !== currentInstances.has(dateStr)) {
			changes.push(dateStr);
		}
	}
}
