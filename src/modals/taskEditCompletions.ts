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

interface TaskEditCompletionsOptions {
	task: TaskInfo;
	plugin: TaskNotesPlugin;
	completedInstancesChanges: string[];
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
		text: "<",
	});
	const monthLabel = header.createSpan("recurring-calendar__month");
	const locale = options.plugin.i18n.getCurrentLocale() || "en";
	const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
	monthLabel.textContent = monthFormatter.format(displayDate);
	const nextButton = header.createEl("button", {
		cls: "recurring-calendar__nav",
		text: ">",
	});

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
	const skippedInstances = new Set(options.task.skipped_instances || []);

	allDays.forEach((day) => {
		const dayStr = formatDateForStorage(day);
		const isCurrentMonth = day.getUTCMonth() === displayDate.getUTCMonth();
		const dayElement = grid.createDiv("recurring-calendar__day");
		dayElement.textContent = String(day.getUTCDate());
		dayElement.addClass("recurring-calendar__day--clickable");

		if (!isCurrentMonth) {
			dayElement.addClass("recurring-calendar__day--faded");
		}
		if (recurringDateStrings.has(dayStr)) {
			dayElement.addClass("recurring-calendar__day--recurring");
		}
		if (completedInstances.has(dayStr)) {
			dayElement.addClass("recurring-calendar__day--completed");
		}
		if (skippedInstances.has(dayStr)) {
			dayElement.addClass("recurring-calendar__day--skipped");
		}

		dayElement.addEventListener("click", () => {
			toggleCompletedInstance(dayStr, options.completedInstancesChanges);
			renderCalendarMonth(container, displayDate, options);
		});
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

function toggleCompletedInstance(dateStr: string, changes: string[]): void {
	const index = changes.indexOf(dateStr);
	if (index !== -1) {
		changes.splice(index, 1);
	} else {
		changes.push(dateStr);
	}
}
