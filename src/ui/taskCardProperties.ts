import { Notice, setTooltip, TFile, type CachedMetadata } from "obsidian";
import TaskNotesPlugin from "../main";
import { ICSEvent, TaskInfo } from "../types";
import { DateContextMenu } from "../components/DateContextMenu";
import { DEFAULT_INTERNAL_VISIBLE_PROPERTIES } from "../settings/defaults";
import { calculateTotalTimeSpent, getFiniteRecurringInstanceCount } from "../utils/helpers";
import { filterTaskIdentificationTags } from "../utils/taskTagFiltering";
import {
	formatDateTimeForDisplay,
	getDatePart,
	getTimePart,
	isOverdueTimeAware,
	isTodayTimeAware,
} from "../utils/dateUtils";
import { stringifyUnknown } from "../utils/stringUtils";
import { convertInternalToUserProperties } from "../utils/propertyMapping";
import {
	extractBasesValue,
	isEmptyCardDisplayValue,
	renderBasesValue,
	resolveTaskCardPropertyLabel,
	type TaskCardPresentationOptions,
} from "./taskCardPresentation";
import {
	getRecurrenceTooltip,
	getTaskCardPropertyLabel,
	getTaskCardPropertyValue,
} from "./taskCardHelpers";
import {
	renderProjectLinks,
	renderTextWithLinks,
	type LinkServices,
} from "./renderers/linkRenderer";
import { renderContextsValue, renderTagsValue, type TagServices } from "./renderers/tagRenderer";

export interface TaskCardPropertyOptions {
	propertyLabels?: TaskCardPresentationOptions["propertyLabels"];
}

function tTaskCard(
	plugin: TaskNotesPlugin,
	key: string,
	vars?: Record<string, string | number>
): string {
	return plugin.i18n.translate(`ui.taskCard.${key}`, vars);
}

function prepareInteractiveControl(element: HTMLElement): void {
	element.setAttribute("role", "button");
	element.tabIndex = 0;

	if (element.dataset.tnNoDrag === "true") {
		element.setAttribute("draggable", "false");
		return;
	}

	element.dataset.tnNoDrag = "true";
	element.setAttribute("draggable", "false");
	element.addEventListener("mousedown", (event) => {
		event.preventDefault();
		event.stopPropagation();
	});
	element.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		event.stopPropagation();
		element.click();
	});
}

function normalizeICSEventIds(value: unknown): string[] {
	const values = Array.isArray(value) ? value : value ? [value] : [];
	return values
		.filter((eventId): eventId is string => typeof eventId === "string")
		.map((eventId) => eventId.trim())
		.filter(Boolean);
}

function formatICSEventSummary(icsEvent: ICSEvent, plugin: TaskNotesPlugin): string {
	const dateText = icsEvent.start
		? formatDateTimeForDisplay(icsEvent.start, {
				userTimeFormat: plugin.settings.calendarViewSettings.timeFormat,
			})
		: "";
	return dateText ? `${icsEvent.title} (${dateText})` : icsEvent.title;
}

function attachDateClickHandler(
	span: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	dateType: "due" | "scheduled"
): void {
	prepareInteractiveControl(span);
	span.addEventListener("click", (event) => {
		event.stopPropagation();
		const currentValue = dateType === "due" ? task.due : task.scheduled;
		const menu = new DateContextMenu({
			currentValue: getDatePart(currentValue || ""),
			currentTime: getTimePart(currentValue || ""),
			onSelect: (dateValue, timeValue) => {
				void (async () => {
					try {
						let finalValue: string | undefined;
						if (!dateValue) {
							finalValue = undefined;
						} else if (timeValue) {
							finalValue = `${dateValue}T${timeValue}`;
						} else {
							finalValue = dateValue;
						}
						await plugin.updateTaskProperty(task, dateType, finalValue);
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						console.error(`Error updating ${dateType} date:`, errorMessage);
						const noticeKey =
							dateType === "due"
								? "contextMenus.task.notices.updateDueDateFailure"
								: "contextMenus.task.notices.updateScheduledFailure";
						new Notice(plugin.i18n.translate(noticeKey, { message: errorMessage }));
					}
				})();
			},
			dateRole: dateType,
			plugin,
			app: plugin.app,
		});
		menu.show(event);
	});
}

export function getDefaultVisibleProperties(plugin: TaskNotesPlugin): string[] {
	const internalDefaults = [
		...DEFAULT_INTERNAL_VISIBLE_PROPERTIES,
		"tags",
		"blocked",
		"blocking",
		"googleCalendarSync",
	];

	return convertInternalToUserProperties(internalDefaults, plugin);
}

interface ChecklistProgress {
	completed: number;
	total: number;
	percent: number;
}

function getChecklistProgress(taskPath: string, plugin: TaskNotesPlugin): ChecklistProgress | null {
	const file = plugin.app.vault.getAbstractFileByPath(taskPath);
	if (!(file instanceof TFile)) return null;

	const fileCache = plugin.app.metadataCache.getFileCache(file);
	return calculateChecklistProgress(fileCache);
}

function calculateChecklistProgress(cache: unknown): ChecklistProgress | null {
	if (cache === null || cache === undefined) {
		return null;
	}

	const listItems = (cache as CachedMetadata).listItems;
	if (!Array.isArray(listItems) || listItems.length === 0) {
		return null;
	}

	let total = 0;
	let completed = 0;

	for (const item of listItems) {
		if (!item || typeof item.task !== "string") continue;
		const isNested = typeof item.parent === "number" && item.parent >= 0;
		if (isNested) continue;

		total += 1;
		if (item.task.toLowerCase() === "x") {
			completed += 1;
		}
	}

	if (total === 0) {
		return null;
	}

	return {
		completed,
		total,
		percent: Math.round((completed / total) * 100),
	};
}

type PropertyRenderer = (
	element: HTMLElement,
	value: unknown,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	options?: TaskCardPropertyOptions
) => void;

const PROPERTY_RENDERERS: Record<string, PropertyRenderer> = {
	due: (element, value, task, plugin, options) => {
		if (typeof value === "string") {
			renderDueDateProperty(element, value, task, plugin, options?.propertyLabels);
		}
	},
	scheduled: (element, value, task, plugin, options) => {
		if (typeof value === "string") {
			renderScheduledDateProperty(element, value, task, plugin, options?.propertyLabels);
		}
	},
	projects: (element, value, task, plugin) => {
		if (Array.isArray(value)) {
			const linkServices: LinkServices = {
				metadataCache: plugin.app.metadataCache,
				workspace: plugin.app.workspace,
				sourcePath: task.path,
			};
			renderProjectLinks(element, value as string[], linkServices);
		}
	},
	contexts: (element, value, task, plugin) => {
		if (Array.isArray(value)) {
			const tagServices: TagServices = {
				onTagClick: async (context) => {
					const searchTag = context.startsWith("@") ? context.slice(1) : context;
					await plugin.openTagsPane(`#${searchTag}`);
				},
				linkServices: {
					metadataCache: plugin.app.metadataCache,
					workspace: plugin.app.workspace,
					sourcePath: task.path,
				},
			};
			renderContextsValue(element, value, tagServices);
		}
	},
	tags: (element, value, _, plugin) => {
		if (Array.isArray(value)) {
			let tagsToRender = value;
			if (
				plugin.settings.taskIdentificationMethod === "tag" &&
				plugin.settings.hideIdentifyingTagsInCards
			) {
				tagsToRender = filterTaskIdentificationTags(value, plugin.settings.taskTag);
			}

			if (tagsToRender.length > 0) {
				const tagServices: TagServices = {
					onTagClick: async (tag) => {
						const searchTag = tag.startsWith("#") ? tag.slice(1) : tag;
						await plugin.openTagsPane(`#${searchTag}`);
					},
				};
				renderTagsValue(element, tagsToRender, tagServices);
			}
		}
	},
	timeEstimate: (element, value, _, plugin) => {
		if (typeof value === "number") {
			element.textContent = `${plugin.formatTime(value)} estimated`;
		}
	},
	totalTrackedTime: (element, value, _, plugin) => {
		if (typeof value === "number" && value > 0) {
			element.textContent = `${plugin.formatTime(value)} tracked`;
		}
	},
	recurrence: (element, value, _task, plugin, options) => {
		if (typeof value === "string") {
			element.textContent = getRecurrenceTooltip(plugin, value, options?.propertyLabels);
		}
	},
	completeInstances: (element, value, task) => {
		if (Array.isArray(value) && value.length > 0) {
			const count = value.length;
			const skippedCount = task.skipped_instances?.length || 0;
			const finiteTotal = getFiniteRecurringInstanceCount(task);

			if (finiteTotal) {
				const total = Math.max(finiteTotal, count + skippedCount);
				const completionRate = Math.round((count / total) * 100);
				element.textContent = `✓ ${count}/${total} completed (${completionRate}%)`;
			} else {
				element.textContent = `✓ ${count} completed`;
			}
			element.classList.add("task-card__metadata-pill--completed-instances");
		}
	},
	skippedInstances: (element, value) => {
		if (Array.isArray(value) && value.length > 0) {
			element.textContent = `⊘ ${value.length} skipped`;
			element.classList.add("task-card__metadata-pill--skipped-instances");
		}
	},
	completedDate: (element, value, _task, plugin, options) => {
		if (typeof value === "string") {
			const label = getTaskCardPropertyLabel(
				"completedDate",
				plugin,
				options?.propertyLabels
			);
			element.textContent = `${label}: ${formatDateTimeForDisplay(value, {
				dateFormat: "MMM d",
				showTime: false,
				userTimeFormat: plugin.settings.calendarViewSettings.timeFormat,
			})}`;
		}
	},
	dateCreated: (element, value, _task, plugin, options) => {
		if (typeof value === "string") {
			const label = getTaskCardPropertyLabel("dateCreated", plugin, options?.propertyLabels);
			element.textContent = `${label}: ${formatDateTimeForDisplay(value, {
				dateFormat: "MMM d",
				showTime: false,
				userTimeFormat: plugin.settings.calendarViewSettings.timeFormat,
			})}`;
		}
	},
	dateModified: (element, value, _task, plugin, options) => {
		if (typeof value === "string") {
			const label = getTaskCardPropertyLabel("dateModified", plugin, options?.propertyLabels);
			element.textContent = `${label}: ${formatDateTimeForDisplay(value, {
				dateFormat: "MMM d",
				showTime: false,
				userTimeFormat: plugin.settings.calendarViewSettings.timeFormat,
			})}`;
		}
	},
	blocked: (element, value, task, plugin, options) => {
		if (value === true) {
			const blockedCount = task.blockedBy?.length ?? 0;
			const label = getTaskCardPropertyLabel("blocked", plugin, options?.propertyLabels);
			element.textContent = blockedCount > 0 ? `${label} (${blockedCount})` : label;
			element.classList.add("task-card__metadata-pill--blocked");
		}
	},
	blocking: (element, value, task, plugin, options) => {
		if (value === true) {
			const blockingCount = task.blocking?.length ?? 0;
			const label = getTaskCardPropertyLabel("blocking", plugin, options?.propertyLabels);
			element.textContent = blockingCount > 0 ? `${label} (${blockingCount})` : label;
			element.classList.add("task-card__metadata-pill--blocking");
		}
	},
	blockedBy: (element, value, _task, plugin) => {
		if (Array.isArray(value) && value.length > 0) {
			element.createEl("span", { text: "Blocked by: " });
			const linksContainer = element.createEl("span");
			value.forEach((dep, index) => {
				if (index > 0) linksContainer.appendChild(activeDocument.createTextNode(", "));
				const depPath = typeof dep === "string" ? dep : dep.path;
				if (depPath) {
					const linkEl = linksContainer.createEl("a", {
						cls: "internal-link",
						attr: { href: depPath },
					});
					linkEl.textContent = depPath.split("/").pop()?.replace(".md", "") || depPath;
					linkEl.addEventListener("click", (event) => {
						event.preventDefault();
						event.stopPropagation();
						void plugin.app.workspace.openLinkText(depPath, "", false);
					});
				}
			});
		}
	},
	blockingTasks: (element, value, _task, plugin) => {
		if (Array.isArray(value) && value.length > 0) {
			element.createEl("span", { text: "Blocking: " });
			const linksContainer = element.createEl("span");
			value.forEach((path, index) => {
				if (index > 0) linksContainer.appendChild(activeDocument.createTextNode(", "));
				const linkEl = linksContainer.createEl("a", {
					cls: "internal-link",
					attr: { href: path },
				});
				linkEl.textContent = path.split("/").pop()?.replace(".md", "") || path;
				linkEl.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					void plugin.app.workspace.openLinkText(path, "", false);
				});
			});
		}
	},
	timeEntries: (element, value, _, plugin) => {
		if (Array.isArray(value) && value.length > 0) {
			const totalTime = calculateTotalTimeSpent(value);
			if (totalTime > 0) {
				element.textContent = `${plugin.formatTime(totalTime)} tracked (${value.length} ${value.length === 1 ? "entry" : "entries"})`;
			}
		}
	},
	reminders: (element, value) => {
		if (Array.isArray(value) && value.length > 0) {
			element.textContent = `${value.length} ${value.length === 1 ? "reminder" : "reminders"}`;
		}
	},
	icsEventId: (element, value, _task, plugin) => {
		const eventIds = normalizeICSEventIds(value);
		if (eventIds.length === 0) return;

		const eventSummaries = eventIds
			.map((eventId) => plugin.icsNoteService.findEventById(eventId)?.event)
			.filter((event): event is ICSEvent => Boolean(event))
			.map((event) => formatICSEventSummary(event, plugin));

		if (eventSummaries.length > 0) {
			element.textContent = `Calendar: ${eventSummaries.join(", ")}`;
		} else {
			element.textContent = `Linked to ${eventIds.length} calendar ${eventIds.length === 1 ? "event" : "events"}`;
		}
	},
	checklistProgress: (element, _value, task, plugin) => {
		const progress = getChecklistProgress(task.path, plugin);
		if (!progress) {
			return;
		}

		const progressEl = element.createEl("span", { cls: "task-card__progress" });
		const progressBar = progressEl.createEl("span", { cls: "task-card__progress-bar" });
		const progressFill = progressBar.createEl("span", { cls: "task-card__progress-fill" });
		progressFill.style.width = `${progress.percent}%`;
		if (progress.percent > 0 && progress.percent < 5) {
			progressFill.classList.remove("tn-static-min-width-0-3922d326");
			progressFill.classList.add("tn-static-min-width-2px-709d7da0");
		}

		progressEl.createEl("span", {
			cls: "task-card__progress-label",
			text: `${progress.completed}/${progress.total}`,
		});

		setTooltip(
			progressEl,
			`${progress.percent}% complete (${progress.completed}/${progress.total})`,
			{
				placement: "top",
			}
		);
	},
};

export function renderPropertyMetadata(
	container: HTMLElement,
	propertyId: string,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	options: TaskCardPropertyOptions = {}
): HTMLElement | null {
	const value = getTaskCardPropertyValue(task, propertyId, plugin);

	if (!hasValidValue(value)) {
		return null;
	}

	const element = container.createEl("span", {
		cls: `task-card__metadata-property task-card__metadata-property--${propertyId.replace(":", "-")}`,
	});

	try {
		const mappingKey = plugin.fieldMapper.lookupMappingKey(propertyId);
		const rendererKey = mappingKey || propertyId;

		if (rendererKey in PROPERTY_RENDERERS) {
			PROPERTY_RENDERERS[rendererKey](element, value, task, plugin, options);
		} else if (propertyId.startsWith("user:")) {
			renderUserProperty(element, propertyId, value, plugin);
		} else {
			renderGenericProperty(
				element,
				propertyId,
				value,
				plugin,
				getTaskCardPropertyLabel(propertyId, plugin, options.propertyLabels)
			);
		}

		if (!element.textContent && !element.hasChildNodes()) {
			element.remove();
			return null;
		}

		return element;
	} catch (error) {
		console.warn(`TaskCard: Error rendering property ${propertyId}:`, error);
		element.textContent = `${propertyId}: (error)`;
		return element;
	}
}

function hasValidValue(value: unknown): boolean {
	return !isEmptyCardDisplayValue(value);
}

function renderUserProperty(
	element: HTMLElement,
	propertyId: string,
	value: unknown,
	plugin: TaskNotesPlugin
): void {
	const fieldId = propertyId.slice(5);
	const userField = plugin.settings.userFields?.find((field) => field.id === fieldId);

	if (!userField) {
		element.textContent = `${fieldId}: (not found)`;
		return;
	}

	const fieldName = userField.displayName || fieldId;
	element.createEl("span", { text: `${fieldName}: ` });
	const valueContainer = element.createEl("span", {
		cls: "task-card__metadata-value",
	});
	const linkServices: LinkServices = {
		metadataCache: plugin.app.metadataCache,
		workspace: plugin.app.workspace,
	};

	if (typeof value === "string" && value.trim() !== "") {
		const stringValue = value.trim();
		if (containsRichTextLink(stringValue)) {
			renderTextWithLinks(valueContainer, stringValue, linkServices);
		} else {
			valueContainer.textContent = formatUserPropertyValue(value, userField);
		}
	} else if (userField.type === "list" && Array.isArray(value)) {
		const validItems = value.map((item) => extractBasesValue(item)).filter(hasValidValue);
		validItems.forEach((item, index) => {
			if (index > 0) valueContainer.appendChild(activeDocument.createTextNode(", "));
			if (typeof item === "string" && item.trim() !== "") {
				const itemString = item.trim();
				if (containsRichTextLink(itemString)) {
					const itemContainer = valueContainer.createEl("span");
					renderTextWithLinks(itemContainer, itemString, linkServices);
				} else {
					valueContainer.appendChild(activeDocument.createTextNode(String(item)));
				}
			} else {
				valueContainer.appendChild(activeDocument.createTextNode(String(item)));
			}
		});
	} else {
		const displayValue = formatUserPropertyValue(value, userField);
		valueContainer.textContent = displayValue.trim() !== "" ? displayValue : "(empty)";
	}
}

interface UserField {
	id: string;
	key: string;
	type: "text" | "number" | "date" | "boolean" | "list";
	displayName?: string;
}

function renderGenericProperty(
	element: HTMLElement,
	propertyId: string,
	value: unknown,
	plugin?: TaskNotesPlugin,
	displayNameOverride?: string
): void {
	const displayName = resolveTaskCardPropertyLabel(propertyId, {}, displayNameOverride);
	element.createEl("span", { text: `${displayName}: ` });
	const valueContainer = element.createEl("span", {
		cls: "task-card__metadata-value",
	});

	if (Array.isArray(value)) {
		const filtered = value.map((item) => extractBasesValue(item)).filter(hasValidValue);
		filtered.forEach((item, index) => {
			if (index > 0) valueContainer.appendChild(activeDocument.createTextNode(", "));
			renderPropertyValue(valueContainer, item, plugin);
		});
	} else {
		renderPropertyValue(valueContainer, value, plugin);
	}
}

function renderPropertyValue(
	container: HTMLElement,
	value: unknown,
	plugin?: TaskNotesPlugin
): void {
	if (!hasValidValue(value)) {
		return;
	}

	if (plugin && renderBasesValue(container, value, plugin.app.renderContext)) {
		return;
	}

	if (typeof value === "string" && plugin) {
		const linkServices: LinkServices = {
			metadataCache: plugin.app.metadataCache,
			workspace: plugin.app.workspace,
		};

		if (containsRichTextLink(value)) {
			renderTextWithLinks(container, value, linkServices, {
				onTagClick: async (tag) => {
					const searchTag = tag.startsWith("#") ? tag.slice(1) : tag;
					await plugin.openTagsPane(`#${searchTag}`);
				},
			});
			return;
		}

		container.appendChild(activeDocument.createTextNode(value));
		return;
	}

	let displayValue: string;

	if (typeof value === "object" && value !== null) {
		if (value instanceof Date) {
			displayValue = formatDateTimeForDisplay(value.toISOString(), {
				dateFormat: "MMM d, yyyy",
				timeFormat: "",
				showTime: false,
			});
		} else {
			const entries = Object.entries(value as Record<string, unknown>);
			displayValue =
				entries.length <= 3
					? entries.map(([key, item]) => `${key}: ${stringifyUnknown(item)}`).join(", ")
					: stringifyUnknown(value);
		}
	} else if (typeof value === "boolean") {
		displayValue = value ? "✓" : "✗";
	} else if (typeof value === "number") {
		displayValue = Number.isInteger(value) ? String(value) : value.toFixed(2);
	} else {
		displayValue = stringifyUnknown(value);
	}

	if (displayValue.length > 100) {
		displayValue = displayValue.substring(0, 97) + "...";
	}

	container.appendChild(activeDocument.createTextNode(displayValue));
}

function containsRichTextLink(value: string): boolean {
	return (
		value.includes("[[") ||
		value.includes("](") ||
		/<https?:\/\/[^\s>]+>/i.test(value) ||
		/(^|\s)https?:\/\/[^\s<>()]+/i.test(value) ||
		(value.includes("[") && value.includes("](")) ||
		(value.includes("#") && /\s#\w+|#\w+/.test(value))
	);
}

function formatUserPropertyValue(value: unknown, userField: UserField): string {
	if (value === null || value === undefined) return "";

	try {
		switch (userField.type) {
			case "text":
			case "number":
				return stringifyUnknown(value);
			case "date":
				return formatDateTimeForDisplay(stringifyUnknown(value), {
					dateFormat: "MMM d, yyyy",
					timeFormat: "",
					showTime: false,
				});
			case "boolean":
				return value ? "✓" : "✗";
			case "list":
				if (Array.isArray(value)) {
					return (value as unknown[]).flat(2).map(stringifyUnknown).join(", ");
				}
				return stringifyUnknown(value);
			default:
				return stringifyUnknown(value);
		}
	} catch (error) {
		console.warn("TaskCard: Error formatting user property value:", error);
		return stringifyUnknown(value);
	}
}

function getTaskCardDateFormat(dateString: string): string {
	const year = Number(getDatePart(dateString).slice(0, 4));
	return Number.isInteger(year) && year !== new Date().getFullYear() ? "MMM d, yyyy" : "MMM d";
}

function renderDueDateProperty(
	element: HTMLElement,
	due: string,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	propertyLabels?: Record<string, string>
): void {
	const isDueToday = isTodayTimeAware(due);
	const isCompleted = plugin.statusManager.isCompletedStatus(task.status);
	const hideCompletedFromOverdue = plugin.settings?.hideCompletedFromOverdue ?? true;
	const isDueOverdue = isOverdueTimeAware(due, isCompleted, hideCompletedFromOverdue);

	const userTimeFormat = plugin.settings.calendarViewSettings.timeFormat;
	const dueLabel = getTaskCardPropertyLabel("due", plugin, propertyLabels);
	let dueDateText = "";
	if (isDueToday) {
		const timeDisplay = formatDateTimeForDisplay(due, {
			dateFormat: "",
			showTime: true,
			userTimeFormat,
		});
		dueDateText =
			timeDisplay.trim() === ""
				? tTaskCard(plugin, "dueToday", { label: dueLabel })
				: tTaskCard(plugin, "dueTodayAt", { label: dueLabel, time: timeDisplay });
	} else if (isDueOverdue) {
		const display = formatDateTimeForDisplay(due, {
			dateFormat: getTaskCardDateFormat(due),
			showTime: true,
			userTimeFormat,
		});
		dueDateText = tTaskCard(plugin, "dueOverdue", { label: dueLabel, display });
	} else {
		const display = formatDateTimeForDisplay(due, {
			dateFormat: getTaskCardDateFormat(due),
			showTime: true,
			userTimeFormat,
		});
		dueDateText = tTaskCard(plugin, "dueLabel", { label: dueLabel, display });
	}

	element.textContent = dueDateText;
	element.classList.add("task-card__metadata-date", "task-card__metadata-date--due");
	if (isDueOverdue) {
		element.classList.add("task-card__metadata-date--overdue");
	}
	element.dataset.tnAction = "edit-date";
	element.dataset.tnDateType = "due";

	attachDateClickHandler(element, task, plugin, "due");
}

function renderScheduledDateProperty(
	element: HTMLElement,
	scheduled: string,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	propertyLabels?: Record<string, string>
): void {
	const isScheduledToday = isTodayTimeAware(scheduled);
	const isCompleted = plugin.statusManager.isCompletedStatus(task.status);
	const hideCompletedFromOverdue = plugin.settings?.hideCompletedFromOverdue ?? true;
	const isScheduledPast = isOverdueTimeAware(scheduled, isCompleted, hideCompletedFromOverdue);

	const userTimeFormat = plugin.settings.calendarViewSettings.timeFormat;
	const scheduledLabel = getTaskCardPropertyLabel("scheduled", plugin, propertyLabels);
	let scheduledDateText = "";
	if (isScheduledToday) {
		const timeDisplay = formatDateTimeForDisplay(scheduled, {
			dateFormat: "",
			showTime: true,
			userTimeFormat,
		});
		scheduledDateText =
			timeDisplay.trim() === ""
				? tTaskCard(plugin, "scheduledToday", { label: scheduledLabel })
				: tTaskCard(plugin, "scheduledTodayAt", {
						label: scheduledLabel,
						time: timeDisplay,
					});
	} else if (isScheduledPast) {
		const display = formatDateTimeForDisplay(scheduled, {
			dateFormat: getTaskCardDateFormat(scheduled),
			showTime: true,
			userTimeFormat,
		});
		scheduledDateText = tTaskCard(plugin, "scheduledPast", { label: scheduledLabel, display });
	} else {
		const display = formatDateTimeForDisplay(scheduled, {
			dateFormat: getTaskCardDateFormat(scheduled),
			showTime: true,
			userTimeFormat,
		});
		scheduledDateText = tTaskCard(plugin, "scheduledLabel", { label: scheduledLabel, display });
	}

	element.textContent = scheduledDateText;
	element.classList.add("task-card__metadata-date", "task-card__metadata-date--scheduled");
	if (isScheduledPast) {
		element.classList.add("task-card__metadata-date--past");
	}
	element.dataset.tnAction = "edit-date";
	element.dataset.tnDateType = "scheduled";

	attachDateClickHandler(element, task, plugin, "scheduled");
}

export function updateMetadataVisibility(
	metadataLine: HTMLElement,
	metadataElements: HTMLElement[]
): void {
	metadataLine.style.display = metadataElements.length > 0 ? "" : "none";
}
