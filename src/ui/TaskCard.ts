/* eslint-disable no-console */
import { TFile, setIcon, Notice, Modal, App, setTooltip, parseLinktext, Menu } from "obsidian";
import { TaskInfo } from "../types";
import TaskNotesPlugin from "../main";
import { TaskContextMenu } from "../components/TaskContextMenu";
import {
	getEffectiveTaskStatus,
	getRecurrenceDisplayText,
	filterEmptyProjects,
	calculateTotalTimeSpent,
} from "../utils/helpers";
import { FilterUtils } from "../utils/FilterUtils";
import {
	formatDateTimeForDisplay,
	isTodayTimeAware,
	isOverdueTimeAware,
	getDatePart,
	getTimePart,
	formatDateForStorage,
} from "../utils/dateUtils";
import { DateContextMenu } from "../components/DateContextMenu";
import { PriorityContextMenu } from "../components/PriorityContextMenu";
import { RecurrenceContextMenu } from "../components/RecurrenceContextMenu";
import { createTaskClickHandler, createTaskHoverHandler } from "../utils/clickHandlers";
import { ReminderModal } from "../modals/ReminderModal";
import {
	renderProjectLinks,
	renderTextWithLinks,
	type LinkServices,
} from "./renderers/linkRenderer";
import { renderTagsValue, renderContextsValue, type TagServices } from "./renderers/tagRenderer";
import {
	convertInternalToUserProperties,
	isPropertyForField,
} from "../utils/propertyMapping";
import { DEFAULT_INTERNAL_VISIBLE_PROPERTIES } from "../settings/defaults";

export interface TaskCardOptions {
	targetDate?: Date;
	layout?: "default" | "compact" | "inline";
}

export const DEFAULT_TASK_CARD_OPTIONS: TaskCardOptions = {
	layout: "default",
};

/* =================================================================
   BADGE INDICATOR HELPERS
   ================================================================= */

interface BadgeIndicatorConfig {
	container: HTMLElement;
	className: string;
	icon: string;
	tooltip: string;
	ariaLabel?: string;
	onClick?: (e: MouseEvent) => void;
	visible?: boolean;
}

/**
 * Creates a badge indicator element with icon, tooltip, and optional click handler.
 * Returns the element, or null if visible is false.
 */
function createBadgeIndicator(config: BadgeIndicatorConfig): HTMLElement | null {
	const { container, className, icon, tooltip, ariaLabel, onClick, visible = true } = config;

	if (!visible) return null;

	const indicator = container.createEl("div", {
		cls: className,
		attr: { "aria-label": ariaLabel || tooltip },
	});

	setIcon(indicator, icon);
	setTooltip(indicator, tooltip, { placement: "top" });

	if (onClick) {
		indicator.addEventListener("click", (e) => {
			e.stopPropagation();
			onClick(e);
		});
	}

	return indicator;
}

/**
 * Updates or creates a badge indicator, returning the element.
 * If the indicator should not exist, removes any existing one and returns null.
 */
function updateBadgeIndicator(
	container: HTMLElement,
	selector: string,
	config: Omit<BadgeIndicatorConfig, "container"> & { shouldExist: boolean }
): HTMLElement | null {
	const existing = container.querySelector(selector) as HTMLElement | null;

	if (!config.shouldExist) {
		existing?.remove();
		return null;
	}

	if (existing) {
		// Update existing indicator
		existing.setAttribute("aria-label", config.ariaLabel || config.tooltip);
		setTooltip(existing, config.tooltip, { placement: "top" });
		return existing;
	}

	// Create new indicator
	const badgesContainer = container.querySelector(".task-card__badges") as HTMLElement;
	const targetContainer = badgesContainer || container.querySelector(".task-card__main-row") as HTMLElement;

	if (!targetContainer) return null;

	return createBadgeIndicator({
		container: targetContainer,
		...config,
	});
}

/* =================================================================
   CLICK HANDLER FACTORIES
   ================================================================= */

/**
 * Creates a click handler for cycling task status
 */
function createStatusCycleHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	card: HTMLElement,
	statusDot: HTMLElement,
	targetDate: Date
): (e: MouseEvent) => Promise<void> {
	return async (e: MouseEvent) => {
		e.stopPropagation();
		try {
			if (task.recurrence) {
				// For recurring tasks, toggle completion for the target date
				const updatedTask = await plugin.toggleRecurringTaskComplete(task, targetDate);
				const newEffectiveStatus = getEffectiveTaskStatus(updatedTask, targetDate);
				const newStatusConfig = plugin.statusManager.getStatusConfig(newEffectiveStatus);
				const isNowCompleted = plugin.statusManager.isCompletedStatus(newEffectiveStatus);

				if (newStatusConfig) {
					statusDot.style.borderColor = newStatusConfig.color;
					// Update icon if configured
					if (newStatusConfig.icon) {
						statusDot.addClass("task-card__status-dot--icon");
						statusDot.empty();
						setIcon(statusDot, newStatusConfig.icon);
					} else {
						statusDot.removeClass("task-card__status-dot--icon");
						statusDot.empty();
					}
				}

				// Update card classes
				updateCardCompletionState(card, task, plugin, isNowCompleted, newEffectiveStatus);
			} else {
				// For regular tasks, cycle to next status
				const freshTask = await plugin.cacheManager.getTaskInfo(task.path);
				if (!freshTask) {
					new Notice("Task not found");
					return;
				}
				const currentStatus = freshTask.status || "open";
				const nextStatus = plugin.statusManager.getNextStatus(currentStatus);
				await plugin.updateTaskProperty(freshTask, "status", nextStatus);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("Error cycling task status:", { error: errorMessage, taskPath: task.path });
			new Notice(`Failed to update task status: ${errorMessage}`);
		}
	};
}

/**
 * Updates card classes based on completion state
 */
function updateCardCompletionState(
	card: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	isCompleted: boolean,
	effectiveStatus: string
): void {
	const cardClasses = ["task-card"];
	if (isCompleted) cardClasses.push("task-card--completed");
	if (task.archived) cardClasses.push("task-card--archived");
	if (plugin.getActiveTimeSession(task)) cardClasses.push("task-card--actively-tracked");
	if (task.recurrence) cardClasses.push("task-card--recurring");
	if (task.priority) cardClasses.push(`task-card--priority-${task.priority}`);
	if (effectiveStatus) cardClasses.push(`task-card--status-${effectiveStatus}`);
	if (plugin.settings?.subtaskChevronPosition === "left") cardClasses.push("task-card--chevron-left");

	card.className = cardClasses.join(" ");
	card.dataset.status = effectiveStatus;

	// Update title styling
	const titleEl = card.querySelector(".task-card__title") as HTMLElement;
	const titleTextEl = card.querySelector(".task-card__title-text") as HTMLElement;
	if (titleEl) titleEl.classList.toggle("completed", isCompleted);
	if (titleTextEl) titleTextEl.classList.toggle("completed", isCompleted);
}

/**
 * Creates a click handler for priority dot
 */
function createPriorityClickHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin
): (e: MouseEvent) => void {
	return (e: MouseEvent) => {
		e.stopPropagation();
		const menu = new PriorityContextMenu({
			currentValue: task.priority,
			onSelect: async (newPriority) => {
				try {
					await plugin.updateTaskProperty(task, "priority", newPriority);
				} catch (error) {
					console.error("Error updating priority:", error);
					new Notice("Failed to update priority");
				}
			},
			plugin: plugin,
		});
		menu.show(e);
	};
}

/**
 * Creates a click handler for recurrence indicator
 */
function createRecurrenceClickHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin
): (e: MouseEvent) => void {
	return (e: MouseEvent) => {
		e.stopPropagation();
		const menu = new RecurrenceContextMenu({
			currentValue: typeof task.recurrence === "string" ? task.recurrence : undefined,
			currentAnchor: task.recurrence_anchor || "scheduled",
			onSelect: async (newRecurrence, anchor) => {
				try {
					await plugin.updateTaskProperty(task, "recurrence", newRecurrence || undefined);
					if (anchor !== undefined) {
						await plugin.updateTaskProperty(task, "recurrence_anchor", anchor);
					}
				} catch (error) {
					console.error("Error updating recurrence:", error);
					new Notice("Failed to update recurrence");
				}
			},
			app: plugin.app,
			plugin: plugin,
		});
		menu.show(e);
	};
}

/**
 * Creates a click handler for reminder indicator
 */
function createReminderClickHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin
): () => void {
	return () => {
		const modal = new ReminderModal(plugin.app, plugin, task, async (reminders) => {
			try {
				await plugin.updateTaskProperty(task, "reminders", reminders.length > 0 ? reminders : undefined);
			} catch (error) {
				console.error("Error updating reminders:", error);
				new Notice("Failed to update reminders");
			}
		});
		modal.open();
	};
}

/**
 * Creates a click handler for project indicator
 */
function createProjectClickHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin
): () => Promise<void> {
	return async () => {
		try {
			await plugin.applyProjectSubtaskFilter(task);
		} catch (error) {
			console.error("Error filtering project subtasks:", error);
			new Notice("Failed to filter project subtasks");
		}
	};
}

/**
 * Creates a click handler for chevron (expand/collapse subtasks)
 */
function createChevronClickHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	card: HTMLElement,
	chevron: HTMLElement
): () => Promise<void> {
	return async () => {
		try {
			if (!plugin.expandedProjectsService) {
				new Notice("Service not available. Please try reloading the plugin.");
				return;
			}
			const newExpanded = plugin.expandedProjectsService.toggle(task.path);
			chevron.classList.toggle("task-card__chevron--expanded", newExpanded);
			const newTooltip = newExpanded ? "Collapse subtasks" : "Expand subtasks";
			chevron.setAttribute("aria-label", newTooltip);
			setTooltip(chevron, newTooltip, { placement: "top" });
			await toggleSubtasks(card, task, plugin, newExpanded);
		} catch (error) {
			console.error("Error toggling subtasks:", error);
			new Notice("Failed to toggle subtasks");
		}
	};
}

/**
 * Creates a click handler for blocking toggle
 */
function createBlockingToggleClickHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	card: HTMLElement,
	toggle: HTMLElement
): () => Promise<void> {
	return async () => {
		const expanded = toggle.classList.toggle("task-card__blocking-toggle--expanded");
		await toggleBlockingTasks(card, task, plugin, expanded);
	};
}

/**
 * Helper function to attach date context menu click handlers
 */
function attachDateClickHandler(
	span: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	dateType: "due" | "scheduled"
): void {
	span.addEventListener("click", (e) => {
		e.stopPropagation(); // Don't trigger card click
		const currentValue = dateType === "due" ? task.due : task.scheduled;
		const menu = new DateContextMenu({
			currentValue: getDatePart(currentValue || ""),
			currentTime: getTimePart(currentValue || ""),
			onSelect: async (dateValue, timeValue) => {
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
			},
			plugin,
			app: plugin.app,
		});
		menu.show(e as MouseEvent);
	});
}

/**
 * Get default visible properties when no custom configuration is provided.
 * Returns user-configured property names (e.g., "task-status" if user customized the status field).
 *
 * @param plugin - The plugin instance with fieldMapper
 * @returns Array of user-configured property names
 */
function getDefaultVisibleProperties(plugin: TaskNotesPlugin): string[] {
	// Combine FieldMapping properties with special properties
	const internalDefaults = [
		...DEFAULT_INTERNAL_VISIBLE_PROPERTIES,
		"tags", // Special property (not in FieldMapping)
		"blocked", // Special property (computed from blockedBy)
		"blocking", // Special property (not in FieldMapping)
	];

	return convertInternalToUserProperties(internalDefaults, plugin);
}

/**
 * Property value extractors for better type safety and error handling
 */
const PROPERTY_EXTRACTORS: Record<string, (task: TaskInfo) => any> = {
	due: (task) => task.due,
	scheduled: (task) => task.scheduled,
	projects: (task) => task.projects,
	contexts: (task) => task.contexts,
	tags: (task) => task.tags,
	blocked: (task) => task.isBlocked,
	blocking: (task) => task.isBlocking,
	blockedBy: (task) => task.blockedBy,
	blockingTasks: (task) => task.blocking,
	timeEstimate: (task) => task.timeEstimate,
	timeEntries: (task) => task.timeEntries,
	totalTrackedTime: (task) => task.totalTrackedTime,
	recurrence: (task) => task.recurrence,
	completedDate: (task) => task.completedDate,
	reminders: (task) => task.reminders,
	icsEventId: (task) => task.icsEventId,
	completeInstances: (task) => task.complete_instances,
	skippedInstances: (task) => task.skipped_instances,
	dateCreated: (task) => task.dateCreated,
	dateModified: (task) => task.dateModified,
};

/**
 * Extract raw value from a Bases Value object.
 * Bases API may return objects like {icon: "...", data: ...} or {icon: "...", link: "..."}
 * instead of raw primitive values. This function extracts the actual value.
 *
 * For link values (icon: "lucide-link"), Bases strips the [[]] from wikilinks,
 * so we need to restore them to ensure proper rendering.
 */
function extractBasesValue(value: unknown): unknown {
	if (value && typeof value === "object" && "icon" in value) {
		const v = value as Record<string, unknown>;

		// Handle link results (icon: "lucide-link") - restore wikilink format for internal links
		// Bases stores the link path in "data" field for links
		if (v.icon === "lucide-link" && "data" in v && v.data !== null && v.data !== undefined) {
			const linkPath = String(v.data);
			// Check if it's an internal link (not a URL) - restore wikilink format
			if (!linkPath.match(/^[a-z]+:\/\//i)) {
				// Get display text if available
				const display = "display" in v && v.display ? String(v.display) : null;
				if (display && display !== linkPath) {
					return `[[${linkPath}|${display}]]`;
				}
				return `[[${linkPath}]]`;
			}
			// External URL - return as markdown link if we have display text
			const display = "display" in v && v.display ? String(v.display) : null;
			if (display) {
				return `[${display}](${linkPath})`;
			}
			return linkPath;
		}

		// Return data value if present (for non-link types)
		if ("data" in v && v.data !== null && v.data !== undefined) {
			return v.data;
		}
		// Handle date results
		if (v.icon === "lucide-calendar" && "date" in v) {
			return v.date;
		}
		// Handle text results with display property
		if ("display" in v && v.display !== null && v.display !== undefined) {
			return v.display;
		}
		// Handle missing/empty data indicators
		if (v.icon === "lucide-file-question" || v.icon === "lucide-help-circle") {
			return "";
		}
		// Fallback for other icon-only results
		return v.icon ? String(v.icon).replace("lucide-", "") : "";
	}
	return value;
}

/**
 * Get property value from a task with improved error handling and type safety.
 *
 * @param task - The task to extract the property from
 * @param propertyId - The property identifier (user-configured or internal name)
 * @param plugin - TaskNotes plugin instance
 * @returns The property value, or undefined if not found
 */
function getPropertyValue(task: TaskInfo, propertyId: string, plugin: TaskNotesPlugin): unknown {
	try {
		// Check if this is a user-configured name for a mapped field
		const mappingKey = plugin.fieldMapper.lookupMappingKey(propertyId);
		if (mappingKey) {
			// Use the mapping key as the extractor key (e.g., "due", "scheduled")
			if (mappingKey in PROPERTY_EXTRACTORS) {
				return PROPERTY_EXTRACTORS[mappingKey](task);
			}
		}

		// Try direct property lookup (for non-mapped properties)
		if (propertyId in PROPERTY_EXTRACTORS) {
			return PROPERTY_EXTRACTORS[propertyId](task);
		}

		// Handle user properties
		if (propertyId.startsWith("user:")) {
			return getUserPropertyValue(task, propertyId, plugin);
		}

		// Check custom properties from Bases or other sources
		// Values may be Bases Value objects, so extract the raw value
		if (task.customProperties && propertyId in task.customProperties) {
			return extractBasesValue(task.customProperties[propertyId]);
		}

		// Check for file properties (stored as "file.name", "file.basename", etc.)
		if (task.customProperties) {
			const filePropertyId = `file.${propertyId}`;
			if (filePropertyId in task.customProperties) {
				return extractBasesValue(task.customProperties[filePropertyId]);
			}
		}

		// Lazy fetch for file.* properties (backlinks, links, embeds, etc.)
		// These are NOT pre-extracted for performance - only computed when visible
		if (propertyId.startsWith("file.") && task.basesData && typeof task.basesData.getValue === "function") {
			try {
				const value = task.basesData.getValue(propertyId as any);
				if (value !== null && value !== undefined) {
					return extractBasesValue(value);
				}
			} catch (error) {
				// Property doesn't exist or error fetching
			}
		}

		// Handle Bases formula properties
		if (propertyId.startsWith("formula.")) {
			try {
				const basesData = task.basesData;

				if (!basesData || typeof basesData.getValue !== "function") {
					return "";
				}

				// Use BasesEntry.getValue() to get formula result
				// BasesEntry is from Obsidian's Bases API (1.10.0+)
				const value = basesData.getValue(propertyId as any);

				// Handle null/undefined
				if (value === null || value === undefined) {
					return "";
				}

				// Extract raw value from Bases Value object
				const extracted = extractBasesValue(value);
				return extracted !== "" ? extracted : "";
			} catch (error) {
				console.debug(`[TaskNotes] Error computing formula ${propertyId}:`, error);
				return "[Formula Error]";
			}
		}

		// Try to get property from Bases API first (for custom properties)
		// This ensures we get the same value that Bases is displaying
		if (task.basesData && typeof task.basesData.getValue === "function") {
			try {
				// Try with "note." prefix first (most common for custom frontmatter properties)
				const notePropertyId = `note.${propertyId}`;
				const value = task.basesData.getValue(notePropertyId as any);
				if (value !== null && value !== undefined) {
					return extractBasesValue(value);
				}
			} catch (error) {
				// Property doesn't exist in Bases, try fallback
			}
		}

		// Fallback: try to get arbitrary property from frontmatter
		if (task.path) {
			const value = getFrontmatterValue(task.path, propertyId, plugin);
			if (value !== undefined) {
				return value;
			}
		}

		return null;
	} catch (error) {
		console.warn(`TaskCard: Error getting property ${propertyId}:`, error);
		return null;
	}
}

/**
 * Extract user property value with improved error handling and type safety
 */
function getUserPropertyValue(
	task: TaskInfo,
	propertyId: string,
	plugin: TaskNotesPlugin
): unknown {
	const fieldId = propertyId.slice(5);
	const userField = plugin.settings.userFields?.find((f) => f.id === fieldId);

	if (!userField?.key) {
		return null;
	}

	// Try task object first (backward compatibility)
	let value = (task as unknown as Record<string, unknown>)[userField.key];

	// Fall back to frontmatter if needed
	if (value === undefined) {
		value = getFrontmatterValue(task.path, userField.key, plugin);
	}

	return value;
}

/**
 * Safely extract frontmatter value with proper typing
 */
function getFrontmatterValue(taskPath: string, key: string, plugin: TaskNotesPlugin): unknown {
	try {
		const fileMetadata = plugin.app.metadataCache.getCache(taskPath);
		if (!fileMetadata?.frontmatter) {
			return undefined;
		}

		const frontmatter = fileMetadata.frontmatter as Record<string, unknown>;
		return frontmatter[key];
	} catch (error) {
		console.warn(`TaskCard: Error accessing frontmatter for ${taskPath}:`, error);
		return undefined;
	}
}

/**
 * Property renderer function type for better type safety
 */
type PropertyRenderer = (
	element: HTMLElement,
	value: unknown,
	task: TaskInfo,
	plugin: TaskNotesPlugin
) => void;

/**
 * Property renderers for cleaner separation of concerns
 */
const PROPERTY_RENDERERS: Record<string, PropertyRenderer> = {
	due: (element, value, task, plugin) => {
		if (typeof value === "string") {
			renderDueDateProperty(element, value, task, plugin);
		}
	},
	scheduled: (element, value, task, plugin) => {
		if (typeof value === "string") {
			renderScheduledDateProperty(element, value, task, plugin);
		}
	},
	projects: (element, value, _, plugin) => {
		if (Array.isArray(value)) {
			const linkServices: LinkServices = {
				metadataCache: plugin.app.metadataCache,
				workspace: plugin.app.workspace,
			};
			renderProjectLinks(element, value as string[], linkServices);
		}
	},
	contexts: (element, value, _, plugin) => {
		if (Array.isArray(value)) {
			const tagServices: TagServices = {
				onTagClick: async (context, _event) => {
					// Remove @ prefix if present for search
					const searchTag = context.startsWith("@") ? context.slice(1) : context;
					const success = await plugin.openTagsPane(`#${searchTag}`);
					if (!success) {
						console.log("Could not open search pane, context clicked:", context);
					}
				},
			};
			renderContextsValue(element, value, tagServices);
		}
	},
	tags: (element, value, _, plugin) => {
		if (Array.isArray(value)) {
			// Filter out identifying tags if setting is enabled and using tag-based identification
			let tagsToRender = value;
			if (
				plugin.settings.taskIdentificationMethod === "tag" &&
				plugin.settings.hideIdentifyingTagsInCards
			) {
				tagsToRender = value.filter(
					(tag) =>
						!FilterUtils.matchesHierarchicalTagExact(
							tag,
							plugin.settings.taskTag,
						),
				);
			}

			// Only render if there are tags to display
			if (tagsToRender.length > 0) {
				const tagServices: TagServices = {
					onTagClick: async (tag, _event) => {
						// Remove # prefix if present for search
						const searchTag = tag.startsWith("#") ? tag.slice(1) : tag;
						const success = await plugin.openTagsPane(`#${searchTag}`);
						if (!success) {
							console.log("Could not open search pane, tag clicked:", tag);
						}
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
	recurrence: (element, value) => {
		if (typeof value === "string") {
			element.textContent = `Recurring: ${getRecurrenceDisplayText(value)}`;
		}
	},
	completeInstances: (element, value, task) => {
		if (Array.isArray(value) && value.length > 0) {
			const count = value.length;
			const skippedCount = task.skipped_instances?.length || 0;
			const total = count + skippedCount;

			if (total > 0) {
				const completionRate = Math.round((count / total) * 100);
				element.textContent = `✓ ${count} completed (${completionRate}%)`;
				element.classList.add("task-card__metadata-pill--completed-instances");
			} else {
				element.textContent = `✓ ${count} completed`;
				element.classList.add("task-card__metadata-pill--completed-instances");
			}
		}
	},
	skippedInstances: (element, value, task) => {
		if (Array.isArray(value) && value.length > 0) {
			const count = value.length;
			element.textContent = `⊘ ${count} skipped`;
			element.classList.add("task-card__metadata-pill--skipped-instances");
		}
	},
	completedDate: (element, value, task, plugin) => {
		if (typeof value === "string") {
			element.textContent = `Completed: ${formatDateTimeForDisplay(value, {
				dateFormat: "MMM d",
				showTime: false,
				userTimeFormat: plugin.settings.calendarViewSettings.timeFormat,
			})}`;
		}
	},
	dateCreated: (element, value, task, plugin) => {
		if (typeof value === "string") {
			element.textContent = `Created: ${formatDateTimeForDisplay(value, {
				dateFormat: "MMM d",
				showTime: false,
				userTimeFormat: plugin.settings.calendarViewSettings.timeFormat,
			})}`;
		}
	},
	dateModified: (element, value, task, plugin) => {
		if (typeof value === "string") {
			element.textContent = `Modified: ${formatDateTimeForDisplay(value, {
				dateFormat: "MMM d",
				showTime: false,
				userTimeFormat: plugin.settings.calendarViewSettings.timeFormat,
			})}`;
		}
	},
	blocked: (element, value, task) => {
		// Show blocked status with count if available
		if (value === true) {
			const blockedCount = task.blockedBy?.length ?? 0;
			element.textContent = blockedCount > 0 ? `Blocked (${blockedCount})` : "Blocked";
			element.classList.add("task-card__metadata-pill--blocked");
		}
	},
	blocking: (element, value, task) => {
		// Show blocking status with count if available
		if (value === true) {
			const blockingCount = task.blocking?.length ?? 0;
			element.textContent = blockingCount > 0 ? `Blocking (${blockingCount})` : "Blocking";
			element.classList.add("task-card__metadata-pill--blocking");
		}
	},
	blockedBy: (element, value, task, plugin) => {
		// Show list of tasks blocking this one
		if (Array.isArray(value) && value.length > 0) {
			element.createEl("span", { text: "Blocked by: " });
			const linksContainer = element.createEl("span");
			value.forEach((dep, idx) => {
				if (idx > 0) linksContainer.appendChild(document.createTextNode(", "));
				// Each dependency has a path property
				const depPath = typeof dep === "string" ? dep : dep.path;
				if (depPath) {
					const linkEl = linksContainer.createEl("a", {
						cls: "internal-link",
						attr: { href: depPath },
					});
					linkEl.textContent = depPath.split("/").pop()?.replace(".md", "") || depPath;
					linkEl.addEventListener("click", (e) => {
						e.preventDefault();
						e.stopPropagation();
						plugin.app.workspace.openLinkText(depPath, "", false);
					});
				}
			});
		}
	},
	blockingTasks: (element, value, task, plugin) => {
		// Show list of tasks that this one is blocking
		if (Array.isArray(value) && value.length > 0) {
			element.createEl("span", { text: "Blocking: " });
			const linksContainer = element.createEl("span");
			value.forEach((path, idx) => {
				if (idx > 0) linksContainer.appendChild(document.createTextNode(", "));
				const linkEl = linksContainer.createEl("a", {
					cls: "internal-link",
					attr: { href: path },
				});
				linkEl.textContent = path.split("/").pop()?.replace(".md", "") || path;
				linkEl.addEventListener("click", (e) => {
					e.preventDefault();
					e.stopPropagation();
					plugin.app.workspace.openLinkText(path, "", false);
				});
			});
		}
	},
	timeEntries: (element, value, _, plugin) => {
		// Show total tracked time from time entries
		if (Array.isArray(value) && value.length > 0) {
			const totalTime = calculateTotalTimeSpent(value);
			if (totalTime > 0) {
				element.textContent = `${plugin.formatTime(totalTime)} tracked (${value.length} ${value.length === 1 ? "entry" : "entries"})`;
			}
		}
	},
	reminders: (element, value) => {
		// Show reminder count
		if (Array.isArray(value) && value.length > 0) {
			element.textContent = `${value.length} ${value.length === 1 ? "reminder" : "reminders"}`;
		}
	},
	icsEventId: (element, value) => {
		// Show calendar event indicator
		if (Array.isArray(value) && value.length > 0) {
			element.textContent = `Linked to ${value.length} calendar ${value.length === 1 ? "event" : "events"}`;
		}
	},
};

/**
 * Render a single property as a metadata element with improved organization
 */
function renderPropertyMetadata(
	container: HTMLElement,
	propertyId: string,
	task: TaskInfo,
	plugin: TaskNotesPlugin
): HTMLElement | null {
	const value = getPropertyValue(task, propertyId, plugin);

	if (!hasValidValue(value)) {
		return null;
	}

	const element = container.createEl("span", {
		cls: `task-card__metadata-property task-card__metadata-property--${propertyId.replace(":", "-")}`,
	});

	try {
		// Check if this is a user-configured name for a mapped field
		const mappingKey = plugin.fieldMapper.lookupMappingKey(propertyId);

		// Try using the mapping key as the renderer key
		const rendererKey = mappingKey || propertyId;

		if (rendererKey in PROPERTY_RENDERERS) {
			PROPERTY_RENDERERS[rendererKey](element, value, task, plugin);
		} else if (propertyId.startsWith("user:")) {
			renderUserProperty(element, propertyId, value, plugin);
		} else {
			// Fallback: render arbitrary property with generic format
			renderGenericProperty(element, propertyId, value, plugin);
		}

		// If the renderer didn't add any content, remove the element and return null
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

/**
 * Check if a value is valid for display
 */
function hasValidValue(value: any): boolean {
	return (
		value !== null &&
		value !== undefined &&
		!(Array.isArray(value) && value.length === 0) &&
		!(typeof value === "string" && value.trim() === "")
	);
}


/**
 * Render user-defined property with type safety and enhanced link/tag support
 */
function renderUserProperty(
	element: HTMLElement,
	propertyId: string,
	value: unknown,
	plugin: TaskNotesPlugin
): void {
	const fieldId = propertyId.slice(5);
	const userField = plugin.settings.userFields?.find((f) => f.id === fieldId);

	if (!userField) {
		element.textContent = `${fieldId}: (not found)`;
		return;
	}

	const fieldName = userField.displayName || fieldId;

	// Add field label
	element.createEl("span", { text: `${fieldName}: ` });

	// Create value container
	const valueContainer = element.createEl("span");

	// Create shared services to avoid redundant object creation
	const linkServices: LinkServices = {
		metadataCache: plugin.app.metadataCache,
		workspace: plugin.app.workspace,
	};

	// Check if the value might contain links or tags and render appropriately
	if (typeof value === "string" && value.trim() !== "") {
		const stringValue = value.trim();

		// Check if string contains links or tags
		if (
			stringValue.includes("[[") ||
			stringValue.includes("](") ||
			(stringValue.includes("#") && /\s#\w+|#\w+/.test(stringValue))
		) {
			renderTextWithLinks(valueContainer, stringValue, linkServices);
		} else {
			// Format according to field type
			const displayValue = formatUserPropertyValue(value, userField);
			valueContainer.textContent = displayValue;
		}
	} else if (userField.type === "list" && Array.isArray(value)) {
		// Handle list fields - avoid recursive renderPropertyValue call to prevent stack overflow
		const validItems = value.filter((item) => item !== null && item !== undefined);
		validItems.forEach((item, idx) => {
			if (idx > 0) valueContainer.appendChild(document.createTextNode(", "));

			// Render each list item directly instead of recursively calling renderPropertyValue
			if (typeof item === "string" && item.trim() !== "") {
				const itemString = item.trim();
				if (
					itemString.includes("[[") ||
					itemString.includes("](") ||
					(itemString.includes("#") && /\s#\w+|#\w+/.test(itemString))
				) {
					const itemContainer = valueContainer.createEl("span");
					renderTextWithLinks(itemContainer, itemString, linkServices);
				} else {
					valueContainer.appendChild(document.createTextNode(String(item)));
				}
			} else {
				valueContainer.appendChild(document.createTextNode(String(item)));
			}
		});
	} else {
		// Use standard formatting for other types or empty values
		const displayValue = formatUserPropertyValue(value, userField);
		if (displayValue.trim() !== "") {
			valueContainer.textContent = displayValue;
		} else {
			valueContainer.textContent = "(empty)";
		}
	}
}

/**
 * User field type definition for better type safety
 */
interface UserField {
	id: string;
	key: string;
	type: "text" | "number" | "date" | "boolean" | "list";
	displayName?: string;
}

/**
 * Render generic property with smart formatting and link detection
 */
function renderGenericProperty(
	element: HTMLElement,
	propertyId: string,
	value: unknown,
	plugin?: TaskNotesPlugin
): void {
	// Handle formula properties - show just the formula name, not "formula.TESTST"
	let displayName: string;
	if (propertyId.startsWith("formula.")) {
		displayName = propertyId.substring(8); // Remove "formula." prefix
	} else {
		displayName = propertyId.charAt(0).toUpperCase() + propertyId.slice(1);
	}

	// Add property label
	element.createEl("span", { text: `${displayName}: ` });

	// Create value container
	const valueContainer = element.createEl("span");

	if (Array.isArray(value)) {
		// Handle arrays - render each item separately to detect links
		// Extract Bases values from array items as they may be wrapped objects
		const filtered = value
			.map((v) => extractBasesValue(v))
			.filter((v) => v !== null && v !== undefined && v !== "");
		filtered.forEach((item, idx) => {
			if (idx > 0) valueContainer.appendChild(document.createTextNode(", "));
			renderPropertyValue(valueContainer, item, plugin);
		});
	} else {
		renderPropertyValue(valueContainer, value, plugin);
	}
}

/**
 * Render a single property value with link detection
 */
function renderPropertyValue(
	container: HTMLElement,
	value: unknown,
	plugin?: TaskNotesPlugin
): void {
	if (typeof value === "string" && plugin) {
		// Check if string contains links and render appropriately
		const linkServices: LinkServices = {
			metadataCache: plugin.app.metadataCache,
			workspace: plugin.app.workspace,
		};

		// If the string contains wikilinks, markdown links, or tags, render with enhanced support
		if (
			value.includes("[[") ||
			(value.includes("[") && value.includes("](")) ||
			(value.includes("#") && /\s#\w+|#\w+/.test(value))
		) {
			renderTextWithLinks(container, value, linkServices, {
				onTagClick: async (tag, _event) => {
					// Remove # prefix if present for search
					const searchTag = tag.startsWith("#") ? tag.slice(1) : tag;
					const success = await plugin.openTagsPane(`#${searchTag}`);
					if (!success) {
						console.log(
							"Could not open search pane, generic property tag clicked:",
							tag
						);
					}
				},
			});
			return;
		}

		// Plain string
		container.appendChild(document.createTextNode(value));
		return;
	}

	let displayValue: string;

	if (typeof value === "object" && value !== null) {
		// Handle Date objects specially
		if (value instanceof Date) {
			displayValue = formatDateTimeForDisplay(value.toISOString(), {
				dateFormat: "MMM d, yyyy",
				timeFormat: "",
				showTime: false,
			});
		}
		// Handle objects with meaningful toString methods or simple key-value pairs
		else if (typeof value.toString === "function" && value.toString() !== "[object Object]") {
			displayValue = value.toString();
		}
		// For simple objects with a few key-value pairs, show them nicely
		else {
			const entries = Object.entries(value as Record<string, any>);
			if (entries.length <= 3) {
				displayValue = entries.map(([k, v]) => `${k}: ${v}`).join(", ");
			} else {
				// Fallback to JSON for complex objects
				displayValue = JSON.stringify(value);
			}
		}
	} else if (typeof value === "boolean") {
		// Handle booleans with checkmark/x symbols for better visual
		displayValue = value ? "✓" : "✗";
	} else if (typeof value === "number") {
		// Format numbers with appropriate precision
		displayValue = Number.isInteger(value) ? String(value) : value.toFixed(2);
	} else {
		// Handle strings and other primitive types
		displayValue = String(value);
	}

	// Truncate very long values to keep card readable
	if (displayValue.length > 100) {
		displayValue = displayValue.substring(0, 97) + "...";
	}

	container.appendChild(document.createTextNode(displayValue));
}

/**
 * Format user property value based on field type with improved type safety
 */
function formatUserPropertyValue(value: unknown, userField: UserField): string {
	if (value === null || value === undefined) return "";

	try {
		switch (userField.type) {
			case "text":
			case "number":
				return String(value);
			case "date":
				return formatDateTimeForDisplay(String(value), {
					dateFormat: "MMM d, yyyy",
					timeFormat: "",
					showTime: false,
				});
			case "boolean":
				return value ? "✓" : "✗";
			case "list":
				if (Array.isArray(value)) {
					return (value as unknown[]).flat(2).join(", ");
				}
				return String(value);
			default:
				return String(value);
		}
	} catch (error) {
		console.warn("TaskCard: Error formatting user property value:", error);
		return String(value);
	}
}

/**
 * Render due date property with click handler
 */
function renderDueDateProperty(
	element: HTMLElement,
	due: string,
	task: TaskInfo,
	plugin: TaskNotesPlugin
): void {
	const isDueToday = isTodayTimeAware(due);
	const isDueOverdue = isOverdueTimeAware(due);

	const userTimeFormat = plugin.settings.calendarViewSettings.timeFormat;
	let dueDateText = "";
	if (isDueToday) {
		const timeDisplay = formatDateTimeForDisplay(due, {
			dateFormat: "",
			showTime: true,
			userTimeFormat,
		});
		dueDateText = timeDisplay.trim() === "" ? "Due: Today" : `Due: Today at ${timeDisplay}`;
	} else if (isDueOverdue) {
		const display = formatDateTimeForDisplay(due, {
			dateFormat: "MMM d",
			showTime: true,
			userTimeFormat,
		});
		dueDateText = `Due: ${display} (overdue)`;
	} else {
		const display = formatDateTimeForDisplay(due, {
			dateFormat: "MMM d",
			showTime: true,
			userTimeFormat,
		});
		dueDateText = `Due: ${display}`;
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

/**
 * Render scheduled date property with click handler
 */
function renderScheduledDateProperty(
	element: HTMLElement,
	scheduled: string,
	task: TaskInfo,
	plugin: TaskNotesPlugin
): void {
	const isScheduledToday = isTodayTimeAware(scheduled);
	const isScheduledPast = isOverdueTimeAware(scheduled);

	const userTimeFormat = plugin.settings.calendarViewSettings.timeFormat;
	let scheduledDateText = "";
	if (isScheduledToday) {
		const timeDisplay = formatDateTimeForDisplay(scheduled, {
			dateFormat: "",
			showTime: true,
			userTimeFormat,
		});
		scheduledDateText =
			timeDisplay.trim() === "" ? "Scheduled: Today" : `Scheduled: Today at ${timeDisplay}`;
	} else if (isScheduledPast) {
		const display = formatDateTimeForDisplay(scheduled, {
			dateFormat: "MMM d",
			showTime: true,
			userTimeFormat,
		});
		scheduledDateText = `Scheduled: ${display} (past)`;
	} else {
		const display = formatDateTimeForDisplay(scheduled, {
			dateFormat: "MMM d",
			showTime: true,
			userTimeFormat,
		});
		scheduledDateText = `Scheduled: ${display}`;
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

/**
 * Show or hide metadata line based on whether it has content
 */
function updateMetadataVisibility(metadataLine: HTMLElement, metadataElements: HTMLElement[]): void {
	metadataLine.style.display = metadataElements.length > 0 ? "" : "none";
}

/**
 * Create a minimalist, unified task card element
 *
 * @param task - The task to render
 * @param plugin - TaskNotes plugin instance
 * @param visibleProperties - IMPORTANT: Must be user-configured frontmatter property names
 *                            (e.g., "task-status", "complete_instances"), NOT internal FieldMapping keys.
 *                            If passing from settings.defaultVisibleProperties, convert using
 *                            convertInternalToUserProperties() first.
 * @param options - Optional rendering options (layout, targetDate, etc.)
 *
 * @example
 * // Correct: Convert internal names before passing
 * const props = plugin.settings.defaultVisibleProperties
 *   ? convertInternalToUserProperties(plugin.settings.defaultVisibleProperties, plugin)
 *   : undefined;
 * createTaskCard(task, plugin, props);
 *
 * // Correct: Pass frontmatter names from Bases
 * createTaskCard(task, plugin, ["complete_instances", "task-status"]);
 *
 * // WRONG: Don't pass internal keys directly
 * createTaskCard(task, plugin, ["completeInstances", "status"]); // ❌
 */
export function createTaskCard(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	visibleProperties?: string[],
	options: Partial<TaskCardOptions> = {}
): HTMLElement {
	const opts = { ...DEFAULT_TASK_CARD_OPTIONS, ...options };
	// Use fresh UTC-anchored "today" if no targetDate provided
	// This ensures recurring tasks show correct completion status for the current day
	const targetDate = opts.targetDate || (() => {
		const todayLocal = new Date();
		return new Date(Date.UTC(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate()));
	})();

	// Determine effective status for recurring tasks
	const effectiveStatus = task.recurrence
		? getEffectiveTaskStatus(task, targetDate)
		: task.status;

	// Determine layout mode first
	const layout = opts.layout || "default";

	// Main container with BEM class structure
	// Use span for inline layout to ensure proper inline flow in CodeMirror
	const card = document.createElement(layout === "inline" ? "span" : "div");

	// Store task path for circular reference detection
	(card as any)._taskPath = task.path;

	const isActivelyTracked = plugin.getActiveTimeSession(task) !== null;
	const isCompleted = task.recurrence
		? task.complete_instances?.includes(formatDateForStorage(targetDate)) || false // Direct check of complete_instances
		: plugin.statusManager.isCompletedStatus(effectiveStatus); // Regular tasks use status config
	const isSkipped = task.recurrence
		? task.skipped_instances?.includes(formatDateForStorage(targetDate)) || false // Direct check of skipped_instances
		: false; // Only recurring tasks can have skipped instances
	const isRecurring = !!task.recurrence;

	// Build BEM class names
	const cardClasses = ["task-card"];

	// Add layout modifier
	if (layout !== "default") {
		cardClasses.push(`task-card--layout-${layout}`);
	}

	// Add modifiers
	if (isCompleted) cardClasses.push("task-card--completed");
	if (isSkipped) cardClasses.push("task-card--skipped");
	if (task.archived) cardClasses.push("task-card--archived");
	if (isActivelyTracked) cardClasses.push("task-card--actively-tracked");
	if (isRecurring) cardClasses.push("task-card--recurring");

	// Add priority modifier
	if (task.priority) {
		cardClasses.push(`task-card--priority-${task.priority}`);
	}

	// Add status modifier
	if (effectiveStatus) {
		cardClasses.push(`task-card--status-${effectiveStatus}`);
	}

	// Chevron position preference
	if (plugin.settings?.subtaskChevronPosition === "left") {
		cardClasses.push("task-card--chevron-left");
	}

	// Add project modifier (for issue #355)
	const hasProjects = filterEmptyProjects(task.projects || []).length > 0;
	if (hasProjects) {
		cardClasses.push("task-card--has-projects");
	}

	card.className = cardClasses.join(" ");
	card.dataset.taskPath = task.path;
	card.dataset.key = task.path; // For DOMReconciler compatibility
	card.dataset.status = effectiveStatus;

	// Create main row container for horizontal layout
	// Use span for inline layout to maintain inline flow
	const mainRow = card.createEl(layout === "inline" ? "span" : "div", { cls: "task-card__main-row" });

	// Apply priority and status colors as CSS custom properties
	const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
	if (priorityConfig) {
		card.style.setProperty("--priority-color", priorityConfig.color);
	}

	const statusConfig = plugin.statusManager.getStatusConfig(effectiveStatus);
	if (statusConfig) {
		card.style.setProperty("--current-status-color", statusConfig.color);
	}

	// Set next status color for hover preview
	const nextStatus = plugin.statusManager.getNextStatus(effectiveStatus);
	const nextStatusConfig = plugin.statusManager.getStatusConfig(nextStatus);
	if (nextStatusConfig) {
		card.style.setProperty("--next-status-color", nextStatusConfig.color);
	}

	// Status indicator dot (conditional based on visible properties)
	let statusDot: HTMLElement | null = null;
	const shouldShowStatus =
		!visibleProperties ||
		visibleProperties.some((prop) => isPropertyForField(prop, "status", plugin));
	if (shouldShowStatus) {
		statusDot = mainRow.createEl("span", { cls: "task-card__status-dot" });
		if (statusConfig) {
			statusDot.style.borderColor = statusConfig.color;
			// If status has an icon configured, render it instead of colored dot
			if (statusConfig.icon) {
				statusDot.addClass("task-card__status-dot--icon");
				setIcon(statusDot, statusConfig.icon);
			}
		}
	}

	// Add click handler to cycle through statuses
	if (statusDot) {
		// Prevent mousedown from propagating to editor (fixes inline widget de-rendering)
		statusDot.addEventListener("mousedown", (e) => {
			e.preventDefault();
			e.stopPropagation();
		});
		statusDot.addEventListener("click", createStatusCycleHandler(task, plugin, card, statusDot, targetDate));
	}

	// Priority indicator dot (conditional based on visible properties)
	const shouldShowPriority =
		!visibleProperties ||
		visibleProperties.some((prop) => isPropertyForField(prop, "priority", plugin));
	if (task.priority && priorityConfig && shouldShowPriority) {
		const priorityDot = mainRow.createEl("span", {
			cls: "task-card__priority-dot",
			attr: { "aria-label": `Priority: ${priorityConfig.label}` },
		});
		priorityDot.style.borderColor = priorityConfig.color;
		priorityDot.addEventListener("click", createPriorityClickHandler(task, plugin));
	}

	// Content container
	const contentContainer = mainRow.createEl(layout === "inline" ? "span" : "div", { cls: "task-card__content" });

	// Badge area for secondary indicators (only in non-inline mode)
	const badgesContainer = layout !== "inline" ? mainRow.createEl("div", { cls: "task-card__badges" }) : null;

	if (badgesContainer) {
		// Recurring indicator
		if (task.recurrence) {
			const recurrenceTooltip = `Recurring: ${getRecurrenceDisplayText(task.recurrence)} (click to change)`;
			createBadgeIndicator({
				container: badgesContainer,
				className: "task-card__recurring-indicator",
				icon: "rotate-ccw",
				tooltip: recurrenceTooltip,
				onClick: createRecurrenceClickHandler(task, plugin),
			});
		}

		// Reminder indicator
		if (task.reminders && task.reminders.length > 0) {
			const count = task.reminders.length;
			const reminderTooltip = count === 1 ? "1 reminder set (click to manage)" : `${count} reminders set (click to manage)`;
			createBadgeIndicator({
				container: badgesContainer,
				className: "task-card__reminder-indicator",
				icon: "bell",
				tooltip: reminderTooltip,
				onClick: createReminderClickHandler(task, plugin),
			});
		}

		// Project indicator
		const isProject = plugin.projectSubtasksService.isTaskUsedAsProjectSync(task.path);
		if (isProject) {
			createBadgeIndicator({
				container: badgesContainer,
				className: "task-card__project-indicator",
				icon: "folder",
				tooltip: "This task is used as a project (click to filter subtasks)",
				onClick: createProjectClickHandler(task, plugin),
			});

			// Chevron for expandable subtasks
			if (plugin.settings?.showExpandableSubtasks) {
				const isExpanded = plugin.expandedProjectsService?.isExpanded(task.path) || false;
				const chevron = createBadgeIndicator({
					container: badgesContainer,
					className: `task-card__chevron${isExpanded ? " task-card__chevron--expanded" : ""}`,
					icon: "chevron-right",
					tooltip: isExpanded ? "Collapse subtasks" : "Expand subtasks",
				});

				// Chevron needs special handler since it updates its own state
				if (chevron) {
					chevron.addEventListener("click", (e) => {
						e.stopPropagation();
						createChevronClickHandler(task, plugin, card, chevron)();
					});
				}

				// Show subtasks if already expanded
				if (isExpanded) {
					toggleSubtasks(card, task, plugin, true).catch((error) => {
						console.error("Error showing initial subtasks:", error);
					});
				}
			}
		}

		// Blocking toggle
		const hasBlocking = task.blocking && task.blocking.length > 0;
		if (hasBlocking) {
			const toggleLabel = plugin.i18n.translate("ui.taskCard.blockingToggle", { count: task.blocking!.length });
			const toggle = createBadgeIndicator({
				container: badgesContainer,
				className: "task-card__blocking-toggle is-visible",
				icon: "git-branch",
				tooltip: toggleLabel,
			});

			if (toggle) {
				toggle.addEventListener("click", (e) => {
					e.stopPropagation();
					createBlockingToggleClickHandler(task, plugin, card, toggle)();
				});
			}
		}
	}

	// Context menu icon (appears on hover)
	const contextIcon = mainRow.createEl("div", {
		cls: "task-card__context-menu",
		attr: {
			"aria-label": "Task options",
		},
	});

	// Use Obsidian's built-in ellipsis-vertical icon
	setIcon(contextIcon, "ellipsis-vertical");
	setTooltip(contextIcon, "Task options", { placement: "top" });

	contextIcon.addEventListener("click", async (e) => {
		e.stopPropagation();
		e.preventDefault();
		await showTaskContextMenu(e as MouseEvent, task.path, plugin, targetDate);
	});

	// First line: Task title
	const titleEl = contentContainer.createEl(layout === "inline" ? "span" : "div", { cls: "task-card__title" });
	const titleTextEl = titleEl.createSpan({ cls: "task-card__title-text", text: task.title });

	if (isCompleted) {
		titleEl.classList.add("completed");
		titleTextEl.classList.add("completed");
	}

	// Second line: Metadata (dynamic based on visible properties)
	const metadataLine = contentContainer.createEl(layout === "inline" ? "span" : "div", { cls: "task-card__metadata" });
	const metadataElements: HTMLElement[] = [];

	// Get properties to display
	const propertiesToShow =
		visibleProperties ||
		(plugin.settings.defaultVisibleProperties
			? convertInternalToUserProperties(plugin.settings.defaultVisibleProperties, plugin)
			: getDefaultVisibleProperties(plugin));

	// Render each visible property
	for (const propertyId of propertiesToShow) {
		// Skip status and priority as they're rendered separately
		if (
			isPropertyForField(propertyId, "status", plugin) ||
			isPropertyForField(propertyId, "priority", plugin)
		) {
			continue;
		}

		if (propertyId === "blocked") {
			if (task.isBlocked) {
				const blockedLabel = plugin.i18n.translate("ui.taskCard.blockedBadge");
				const blockedCount = task.blockedBy?.length ?? 0;
				const pillText =
					blockedCount > 0 ? `${blockedLabel} (${blockedCount})` : blockedLabel;
				const blockedPill = metadataLine.createSpan({
					cls: "task-card__metadata-pill task-card__metadata-pill--blocked",
					text: pillText,
				});
				setTooltip(
					blockedPill,
					plugin.i18n.translate("ui.taskCard.blockedBadgeTooltip"),
					{
						placement: "top",
					}
				);
				metadataElements.push(blockedPill);
			}
			continue;
		}

		if (propertyId === "blocking") {
			if (task.isBlocking) {
				const blockingLabel = plugin.i18n.translate("ui.taskCard.blockingBadge");
				const blockingCount = task.blocking?.length ?? 0;
				const pillText =
					blockingCount > 0 ? `${blockingLabel} (${blockingCount})` : blockingLabel;
				const blockingPill = metadataLine.createSpan({
					cls: "task-card__metadata-pill task-card__metadata-pill--blocking",
					text: pillText,
				});
				setTooltip(
					blockingPill,
					plugin.i18n.translate("ui.taskCard.blockingBadgeTooltip"),
					{ placement: "top" }
				);
				metadataElements.push(blockingPill);
			}
			continue;
		}

		const element = renderPropertyMetadata(metadataLine, propertyId, task, plugin);
		if (element) {
			metadataElements.push(element);
		}
	}

	// Show/hide metadata line based on content
	updateMetadataVisibility(metadataLine, metadataElements);

	// Add click handlers with single/double click distinction
	const { clickHandler, dblclickHandler, contextmenuHandler } = createTaskClickHandler({
		task,
		plugin,
		contextMenuHandler: async (e) => {
			const path = card.dataset.taskPath;
			if (!path) return;
			await showTaskContextMenu(e, path, plugin, targetDate);
		},
	});

	card.addEventListener("click", clickHandler);
	card.addEventListener("dblclick", dblclickHandler);
	card.addEventListener("contextmenu", contextmenuHandler);

	// Hover preview
	card.addEventListener("mouseover", createTaskHoverHandler(task, plugin));

	return card;
}

/**
 * Show context menu for task card
 */
export async function showTaskContextMenu(
	event: MouseEvent,
	taskPath: string,
	plugin: TaskNotesPlugin,
	targetDate: Date
) {
	const file = plugin.app.vault.getAbstractFileByPath(taskPath);
	const showFileMenuFallback = () => {
		if (file instanceof TFile) {
			showFileContextMenu(event, file, plugin);
		}
	};

	try {
		// Always fetch fresh task data - ignore any stale captured data
		const task = await plugin.cacheManager.getTaskInfo(taskPath);
		if (!task) {
			showFileMenuFallback();
			return;
		}

		const contextMenu = new TaskContextMenu({
			task: task,
			plugin: plugin,
			targetDate: targetDate,
			onUpdate: () => {
				// Trigger refresh of views
				plugin.app.workspace.trigger("tasknotes:refresh-views");
			},
		});

		contextMenu.show(event);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("Error creating context menu:", {
			error: errorMessage,
			taskPath,
		});
		new Notice(`Failed to create context menu: ${errorMessage}`);
		showFileMenuFallback();
	}
}

function showFileContextMenu(event: MouseEvent, file: TFile, plugin: TaskNotesPlugin) {
	const menu = new Menu();

	let populated = false;
	try {
		plugin.app.workspace.trigger("file-menu", menu, file, "tasknotes-bases-view");
		populated = (menu as any).items?.length > 0;
	} catch (error) {
		populated = false;
	}

	if (!populated) {
		menu.addItem((item) => {
			item.setTitle("Open");
			item.setIcon("file-text");
			item.onClick(() => {
				plugin.app.workspace.getLeaf(false).openFile(file);
			});
		});
		menu.addItem((item) => {
			item.setTitle("Open in new tab");
			item.setIcon("external-link");
			item.onClick(() => {
				plugin.app.workspace.openLinkText(file.path, "", true);
			});
		});
	}

	menu.showAtMouseEvent(event);
}

/**
 * Update an existing task card with new data
 */
export function updateTaskCard(
	element: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	visibleProperties?: string[],
	options: Partial<TaskCardOptions> = {}
): void {
	const opts = { ...DEFAULT_TASK_CARD_OPTIONS, ...options };
	// Use fresh UTC-anchored "today" if no targetDate provided
	// This ensures recurring tasks show correct completion status for the current day
	const targetDate = opts.targetDate || (() => {
		const todayLocal = new Date();
		return new Date(Date.UTC(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate()));
	})();

	// Update effective status
	const effectiveStatus = task.recurrence
		? getEffectiveTaskStatus(task, targetDate)
		: task.status;

	// Update main element classes using BEM structure
	const isActivelyTracked = plugin.getActiveTimeSession(task) !== null;
	const isCompleted = task.recurrence
		? task.complete_instances?.includes(formatDateForStorage(targetDate)) || false // Direct check of complete_instances
		: plugin.statusManager.isCompletedStatus(effectiveStatus); // Regular tasks use status config
	const isSkipped = task.recurrence
		? task.skipped_instances?.includes(formatDateForStorage(targetDate)) || false // Direct check of skipped_instances
		: false; // Only recurring tasks can have skipped instances
	const isRecurring = !!task.recurrence;

	// Build BEM class names for update
	const cardClasses = ["task-card"];

	// Add modifiers
	if (isCompleted) cardClasses.push("task-card--completed");
	if (isSkipped) cardClasses.push("task-card--skipped");
	if (task.archived) cardClasses.push("task-card--archived");
	if (isActivelyTracked) cardClasses.push("task-card--actively-tracked");
	if (isRecurring) cardClasses.push("task-card--recurring");

	// Add priority modifier
	if (task.priority) {
		cardClasses.push(`task-card--priority-${task.priority}`);
	}

	// Add status modifier
	if (effectiveStatus) {
		cardClasses.push(`task-card--status-${effectiveStatus}`);
	}

	// Chevron position preference
	if (plugin.settings?.subtaskChevronPosition === "left") {
		cardClasses.push("task-card--chevron-left");
	}

	element.className = cardClasses.join(" ");
	element.dataset.status = effectiveStatus;

	// Get the main row container
	const mainRow = element.querySelector(".task-card__main-row") as HTMLElement;

	// Update priority and status colors
	const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
	if (priorityConfig) {
		element.style.setProperty("--priority-color", priorityConfig.color);
	}

	const statusConfig = plugin.statusManager.getStatusConfig(effectiveStatus);
	if (statusConfig) {
		element.style.setProperty("--current-status-color", statusConfig.color);
	}

	// Update next status color for hover preview
	const nextStatus = plugin.statusManager.getNextStatus(effectiveStatus);
	const nextStatusConfig = plugin.statusManager.getStatusConfig(nextStatus);
	if (nextStatusConfig) {
		element.style.setProperty("--next-status-color", nextStatusConfig.color);
	}

	// Update checkbox if present
	const checkbox = element.querySelector(".task-card__checkbox") as HTMLInputElement;
	if (checkbox) {
		checkbox.checked = plugin.statusManager.isCompletedStatus(effectiveStatus);
	}

	// Update status dot (conditional based on visible properties)
	const shouldShowStatus =
		!visibleProperties ||
		visibleProperties.some((prop) => isPropertyForField(prop, "status", plugin));
	const statusDot = element.querySelector(".task-card__status-dot") as HTMLElement;

	if (shouldShowStatus) {
		if (statusDot) {
			// Update existing dot
			if (statusConfig) {
				statusDot.style.borderColor = statusConfig.color;
			}
		} else if (mainRow) {
			// Add missing dot
			const newStatusDot = mainRow.createEl("span", { cls: "task-card__status-dot" });
			if (statusConfig) {
				newStatusDot.style.borderColor = statusConfig.color;
			}

			// Add click handler to cycle through statuses
			newStatusDot.addEventListener("click", async (e) => {
				e.stopPropagation();
				try {
					if (task.recurrence) {
						// For recurring tasks, toggle completion for the target date
						const updatedTask = await plugin.toggleRecurringTaskComplete(
							task,
							targetDate
						);

						// Immediately update the visual state of the status dot
						const newEffectiveStatus = getEffectiveTaskStatus(updatedTask, targetDate);
						const newStatusConfig =
							plugin.statusManager.getStatusConfig(newEffectiveStatus);
						const isNowCompleted =
							plugin.statusManager.isCompletedStatus(newEffectiveStatus);

						// Update status dot border color
						if (newStatusConfig) {
							newStatusDot.style.borderColor = newStatusConfig.color;
						}

						// Update the card's completion state and classes
						const cardClasses = ["task-card"];
						if (isNowCompleted) {
							cardClasses.push("task-card--completed");
						}
						if (task.archived) cardClasses.push("task-card--archived");
						if (plugin.getActiveTimeSession(task))
							cardClasses.push("task-card--actively-tracked");
						if (task.recurrence) cardClasses.push("task-card--recurring");
						if (task.priority) cardClasses.push(`task-card--priority-${task.priority}`);
						if (newEffectiveStatus)
							cardClasses.push(`task-card--status-${newEffectiveStatus}`);

						element.className = cardClasses.join(" ");
						element.dataset.status = newEffectiveStatus;

						// Update the title completion styling
						const titleText = element.querySelector(
							".task-card__title-text"
						) as HTMLElement;
						const titleContainer = element.querySelector(
							".task-card__title"
						) as HTMLElement;
						if (titleText) {
							titleText.classList.toggle("completed", isNowCompleted);
						}
						if (titleContainer) {
							titleContainer.classList.toggle("completed", isNowCompleted);
						}
					} else {
						// For regular tasks, cycle to next status
						// Get fresh task data to ensure we have the latest status
						const freshTask = await plugin.cacheManager.getTaskInfo(task.path);
						if (!freshTask) {
							new Notice("Task not found");
							return;
						}

						const currentStatus = freshTask.status || "open";
						const nextStatus = plugin.statusManager.getNextStatus(currentStatus);
						await plugin.updateTaskProperty(freshTask, "status", nextStatus);
					}
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					console.error("Error cycling task status:", {
						error: errorMessage,
						taskPath: task.path,
					});
					new Notice(`Failed to update task status: ${errorMessage}`);
				}
			});

			// Insert at the beginning after checkbox
			const checkbox = element.querySelector(".task-card__checkbox");
			if (checkbox) {
				checkbox.insertAdjacentElement("afterend", newStatusDot);
			} else {
				mainRow.insertBefore(newStatusDot, mainRow.firstChild);
			}
		}
	} else if (statusDot) {
		// Remove dot if it shouldn't be visible
		statusDot.remove();
	}

	// Update priority indicator (conditional based on visible properties)
	const shouldShowPriority =
		!visibleProperties ||
		visibleProperties.some((prop) => isPropertyForField(prop, "priority", plugin));
	const existingPriorityDot = element.querySelector(".task-card__priority-dot") as HTMLElement;

	if (shouldShowPriority && task.priority && priorityConfig) {
		if (!existingPriorityDot && mainRow) {
			// Add priority dot if task has priority but no dot exists
			const priorityDot = mainRow.createEl("span", {
				cls: "task-card__priority-dot",
				attr: { "aria-label": `Priority: ${priorityConfig.label}` },
			});
			priorityDot.style.borderColor = priorityConfig.color;

			// Add click context menu for priority
			priorityDot.addEventListener("click", (e) => {
				e.stopPropagation(); // Don't trigger card click
				const menu = new PriorityContextMenu({
					currentValue: task.priority,
					onSelect: async (newPriority) => {
						try {
							await plugin.updateTaskProperty(task, "priority", newPriority);
						} catch (error) {
							console.error("Error updating priority:", error);
							new Notice("Failed to update priority");
						}
					},
					plugin: plugin,
				});
				menu.show(e as MouseEvent);
			});

			// Insert after status dot if it exists, otherwise after checkbox
			const statusDotForInsert = element.querySelector(".task-card__status-dot");
			const checkbox = element.querySelector(".task-card__checkbox");
			if (statusDotForInsert) {
				statusDotForInsert.insertAdjacentElement("afterend", priorityDot);
			} else if (checkbox) {
				checkbox.insertAdjacentElement("afterend", priorityDot);
			} else {
				mainRow.insertBefore(priorityDot, mainRow.firstChild);
			}
		} else if (existingPriorityDot) {
			// Update existing priority dot
			existingPriorityDot.style.borderColor = priorityConfig.color;
			existingPriorityDot.setAttribute("aria-label", `Priority: ${priorityConfig.label}`);

			// Remove old event listener and add new one with updated task data
			const newPriorityDot = existingPriorityDot.cloneNode(true) as HTMLElement;
			newPriorityDot.addEventListener("click", (e) => {
				e.stopPropagation(); // Don't trigger card click
				const menu = new PriorityContextMenu({
					currentValue: task.priority,
					onSelect: async (newPriority) => {
						try {
							await plugin.updateTaskProperty(task, "priority", newPriority);
						} catch (error) {
							console.error("Error updating priority:", error);
							new Notice("Failed to update priority");
						}
					},
					plugin: plugin,
				});
				menu.show(e as MouseEvent);
			});
			existingPriorityDot.replaceWith(newPriorityDot);
		}
	} else if (existingPriorityDot) {
		// Remove priority dot if it shouldn't be visible or task no longer has priority
		existingPriorityDot.remove();
	}

	// Update badge indicators using helper
	const badgesContainer = element.querySelector(".task-card__badges") as HTMLElement;

	// Update recurring indicator
	const recurrenceTooltip = task.recurrence
		? `Recurring: ${getRecurrenceDisplayText(task.recurrence)} (click to change)`
		: "";
	updateBadgeIndicator(element, ".task-card__recurring-indicator", {
		shouldExist: !!task.recurrence,
		className: "task-card__recurring-indicator",
		icon: "rotate-ccw",
		tooltip: recurrenceTooltip,
		onClick: createRecurrenceClickHandler(task, plugin),
	});

	// Update reminder indicator
	const hasReminders = !!(task.reminders && task.reminders.length > 0);
	const reminderCount = task.reminders?.length || 0;
	const reminderTooltip = reminderCount === 1
		? "1 reminder set (click to manage)"
		: `${reminderCount} reminders set (click to manage)`;
	updateBadgeIndicator(element, ".task-card__reminder-indicator", {
		shouldExist: hasReminders,
		className: "task-card__reminder-indicator",
		icon: "bell",
		tooltip: reminderTooltip,
		onClick: createReminderClickHandler(task, plugin),
	});

	// Update project indicator and chevron (async)
	plugin.projectSubtasksService
		.isTaskUsedAsProject(task.path)
		.then((isProject: boolean) => {
			// Remove old placeholders if they exist
			element.querySelector(".task-card__project-indicator-placeholder")?.remove();
			element.querySelector(".task-card__chevron-placeholder")?.remove();

			// Update project indicator
			updateBadgeIndicator(element, ".task-card__project-indicator", {
				shouldExist: isProject,
				className: "task-card__project-indicator",
				icon: "folder",
				tooltip: "This task is used as a project (click to filter subtasks)",
				onClick: createProjectClickHandler(task, plugin),
			});

			// Update chevron
			const showChevron = isProject && plugin.settings?.showExpandableSubtasks;
			const existingChevron = element.querySelector(".task-card__chevron") as HTMLElement;

			if (showChevron && !existingChevron) {
				const isExpanded = plugin.expandedProjectsService?.isExpanded(task.path) || false;
				const chevron = createBadgeIndicator({
					container: badgesContainer || mainRow,
					className: `task-card__chevron${isExpanded ? " task-card__chevron--expanded" : ""}`,
					icon: "chevron-right",
					tooltip: isExpanded ? "Collapse subtasks" : "Expand subtasks",
				});

				if (chevron) {
					chevron.addEventListener("click", (e) => {
						e.stopPropagation();
						createChevronClickHandler(task, plugin, element, chevron)();
					});
				}

				if (isExpanded) {
					toggleSubtasks(element, task, plugin, true).catch((error) => {
						console.error("Error showing initial subtasks in update:", error);
					});
				}
			} else if (!showChevron && existingChevron) {
				existingChevron.remove();
				// Clean up subtasks container
				const subtasksContainer = element.querySelector(".task-card__subtasks") as HTMLElement;
				if (subtasksContainer) {
					const clickHandler = (subtasksContainer as any)._clickHandler;
					if (clickHandler) {
						subtasksContainer.removeEventListener("click", clickHandler);
						delete (subtasksContainer as any)._clickHandler;
					}
					subtasksContainer.remove();
				}
			}
		})
		.catch((error: any) => {
			console.error("Error checking if task is used as project in update:", error);
		});

	const blockingToggleEl = element.querySelector(".task-card__blocking-toggle") as HTMLElement;
	if (blockingToggleEl) {
		if (task.blocking && task.blocking.length > 0) {
			blockingToggleEl.classList.add("is-visible");
			blockingToggleEl.classList.remove("is-hidden");
			const toggleLabel = plugin.i18n.translate("ui.taskCard.blockingToggle", {
				count: task.blocking.length,
			});
			blockingToggleEl.setAttribute("aria-label", toggleLabel);
			setTooltip(blockingToggleEl, toggleLabel, { placement: "top" });
			blockingToggleEl.dataset.count = String(task.blocking.length);
			if (blockingToggleEl.classList.contains("task-card__blocking-toggle--expanded")) {
				toggleBlockingTasks(element, task, plugin, true).catch((error) => {
					console.error("Error refreshing blocking tasks:", error);
				});
			}
		} else {
			blockingToggleEl.classList.remove("is-visible", "task-card__blocking-toggle--expanded");
			blockingToggleEl.classList.add("is-hidden");
			const existingBlockingContainer = element.querySelector(".task-card__blocking");
			if (existingBlockingContainer) {
				existingBlockingContainer.remove();
			}
		}
	}

	// Update title
	const titleText = element.querySelector(".task-card__title-text") as HTMLElement;
	const titleContainer = element.querySelector(".task-card__title") as HTMLElement;
	const titleIsCompleted = isCompleted;
	if (titleText) {
		titleText.textContent = task.title;
		titleText.classList.toggle("completed", titleIsCompleted);
	}
	if (titleContainer) {
		titleContainer.classList.toggle("completed", titleIsCompleted);
	}

	const legacyBlockedBadge = element.querySelector(".task-card__badge--blocked");
	if (legacyBlockedBadge) {
		legacyBlockedBadge.remove();
	}

	// Update metadata line
	const metadataLine = element.querySelector(".task-card__metadata") as HTMLElement;
	if (metadataLine) {
		// Clear the metadata line and rebuild with DOM elements to support project links
		metadataLine.innerHTML = "";
		const metadataElements: HTMLElement[] = [];

		// Get properties to display
		const propertiesToShow =
			visibleProperties ||
			(plugin.settings.defaultVisibleProperties
				? convertInternalToUserProperties(plugin.settings.defaultVisibleProperties, plugin)
				: getDefaultVisibleProperties(plugin));

		for (const propertyId of propertiesToShow) {
			// Skip status and priority as they're rendered separately
			if (
				isPropertyForField(propertyId, "status", plugin) ||
				isPropertyForField(propertyId, "priority", plugin)
			) {
				continue;
			}

			if (propertyId === "blocked") {
				if (task.isBlocked) {
					const blockedLabel = plugin.i18n.translate("ui.taskCard.blockedBadge");
					const blockedCount = task.blockedBy?.length ?? 0;
					const pillText =
						blockedCount > 0 ? `${blockedLabel} (${blockedCount})` : blockedLabel;
					const blockedPill = metadataLine.createSpan({
						cls: "task-card__metadata-pill task-card__metadata-pill--blocked",
						text: pillText,
					});
					setTooltip(
						blockedPill,
						plugin.i18n.translate("ui.taskCard.blockedBadgeTooltip"),
						{ placement: "top" }
					);
					metadataElements.push(blockedPill);
				}
				continue;
			}

			if (propertyId === "blocking") {
				if (task.isBlocking) {
					const blockingLabel = plugin.i18n.translate("ui.taskCard.blockingBadge");
					const blockingCount = task.blocking?.length ?? 0;
					const pillText =
						blockingCount > 0 ? `${blockingLabel} (${blockingCount})` : blockingLabel;
					const blockingPill = metadataLine.createSpan({
						cls: "task-card__metadata-pill task-card__metadata-pill--blocking",
						text: pillText,
					});
					setTooltip(
						blockingPill,
						plugin.i18n.translate("ui.taskCard.blockingBadgeTooltip"),
						{ placement: "top" }
					);
					metadataElements.push(blockingPill);
				}
				continue;
			}

			const element = renderPropertyMetadata(metadataLine, propertyId, task, plugin);
			if (element) {
				metadataElements.push(element);
			}
		}

		// Hide metadata line if empty
		updateMetadataVisibility(metadataLine, metadataElements);
	}

	// Animation is now handled separately - don't add it here during reconciler updates
}

/**
 * Confirmation modal for task deletion
 */
class DeleteTaskConfirmationModal extends Modal {
	private task: TaskInfo;
	private onConfirm: () => Promise<void>;

	constructor(app: App, task: TaskInfo, onConfirm: () => Promise<void>) {
		super(app);
		this.task = task;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Delete Task" });

		const description = contentEl.createEl("p");
		description.appendText('Are you sure you want to delete the task "');
		description.createEl("strong", { text: this.task.title });
		description.appendText('"?');

		contentEl.createEl("p", {
			cls: "mod-warning",
			text: "This action cannot be undone. The task file will be permanently deleted.",
		});

		const buttonContainer = contentEl.createEl("div", { cls: "modal-button-container" });
		buttonContainer.style.display = "flex";
		buttonContainer.style.gap = "10px";
		buttonContainer.style.justifyContent = "flex-end";
		buttonContainer.style.marginTop = "20px";

		const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		const deleteButton = buttonContainer.createEl("button", {
			text: "Delete",
			cls: "mod-warning",
		});
		deleteButton.style.backgroundColor = "var(--color-red)";
		deleteButton.style.color = "white";

		deleteButton.addEventListener("click", async () => {
			try {
				await this.onConfirm();
				this.close();
				new Notice("Task deleted successfully");
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				new Notice(`Failed to delete task: ${errorMessage}`);
				console.error("Error in delete confirmation:", error);
			}
		});

		// Focus the cancel button by default
		cancelButton.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Show delete confirmation modal and handle task deletion
 */
export async function showDeleteConfirmationModal(
	task: TaskInfo,
	plugin: TaskNotesPlugin
): Promise<void> {
	return new Promise((resolve, reject) => {
		const modal = new DeleteTaskConfirmationModal(plugin.app, task, async () => {
			try {
				await plugin.taskService.deleteTask(task);
				resolve();
			} catch (error) {
				reject(error);
			}
		});
		modal.open();
	});
}

/**
 * Clean up event listeners and resources for a task card
 */
export function cleanupTaskCard(card: HTMLElement): void {
	// Clean up subtasks container if it exists
	const subtasksContainer = card.querySelector(".task-card__subtasks") as HTMLElement;
	if (subtasksContainer) {
		// Clean up the click handler
		const clickHandler = (subtasksContainer as any)._clickHandler;
		if (clickHandler) {
			subtasksContainer.removeEventListener("click", clickHandler);
			delete (subtasksContainer as any)._clickHandler;
		}
	}

	// Note: Other event listeners on the card itself are automatically cleaned up
	// when the card is removed from the DOM. We only need to manually clean up
	// listeners that we store references to.
}

/**
 * Toggle subtasks display for a project task card
 */
export async function toggleSubtasks(
	card: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	expanded: boolean
): Promise<void> {
	try {
		let subtasksContainer = card.querySelector(".task-card__subtasks") as HTMLElement;

		if (expanded) {
			// Show subtasks
			if (!subtasksContainer) {
				// Create subtasks container after the main content
				subtasksContainer = document.createElement("div");
				subtasksContainer.className = "task-card__subtasks";

				// Prevent clicks inside subtasks container from bubbling to parent card
				const clickHandler = (e: Event) => {
					e.stopPropagation();
				};
				subtasksContainer.addEventListener("click", clickHandler);

				// Store handler reference for cleanup
				(subtasksContainer as any)._clickHandler = clickHandler;

				card.appendChild(subtasksContainer);
			}

			// Clear existing content properly (this will clean up subtask event listeners)
			while (subtasksContainer.firstChild) {
				subtasksContainer.removeChild(subtasksContainer.firstChild);
			}

			// Show loading state
			const loadingEl = subtasksContainer.createEl("div", {
				cls: "task-card__subtasks-loading",
				text: plugin.i18n.translate("contextMenus.task.subtasks.loading"),
			});

			try {
				// Get the file for this task
				const file = plugin.app.vault.getAbstractFileByPath(task.path);
				if (!(file instanceof TFile)) {
					throw new Error("Task file not found");
				}

				// Get subtasks
				if (!plugin.projectSubtasksService) {
					throw new Error("projectSubtasksService not initialized");
				}

				const subtasks = await plugin.projectSubtasksService.getTasksLinkedToProject(file);

				// Apply current filter to subtasks if available
				// For now, we'll show all subtasks to keep the implementation simple
				// Future enhancement: Apply the current view's filter to subtasks
				// This could be implemented by accessing the FilterService's evaluateFilterNode method

				// Remove loading indicator
				loadingEl.remove();

				if (subtasks.length === 0) {
					subtasksContainer.createEl("div", {
						cls: "task-card__subtasks-loading",
						text: plugin.i18n.translate("contextMenus.task.subtasks.noSubtasks"),
					});
					return;
				}

				// Sort subtasks
				const sortedSubtasks = plugin.projectSubtasksService.sortTasks(subtasks);

				// Build parent chain by traversing up the DOM hierarchy
				const buildParentChain = (element: HTMLElement): string[] => {
					const chain: string[] = [];
					let current = element.closest(".task-card");

					while (current) {
						const taskPath = (current as any)._taskPath;
						if (taskPath) {
							chain.unshift(taskPath); // Add to beginning
						}
						// Find next parent task card (skip current)
						current = current.parentElement?.closest(".task-card") as HTMLElement;
					}
					return chain;
				};

				const parentChain = buildParentChain(card);

				// Render each subtask (but prevent circular references)
				for (const subtask of sortedSubtasks) {
					// Check for circular reference in the parent chain
					if (parentChain.includes(subtask.path)) {
						console.warn("Circular reference detected in task chain:", {
							subtask: subtask.path,
							parentChain,
							cycle: [...parentChain, subtask.path],
						});
						continue;
					}

					const subtaskCard = createTaskCard(subtask, plugin, undefined);

					// Add subtask modifier class
					subtaskCard.classList.add("task-card--subtask");

					subtasksContainer.appendChild(subtaskCard);
				}
			} catch (error) {
				console.error("Error loading subtasks:", error);
				loadingEl.textContent = plugin.i18n.translate(
					"contextMenus.task.subtasks.loadFailed"
				);
			}
		} else {
			// Hide subtasks
			if (subtasksContainer) {
				// Clean up the click handler
				const clickHandler = (subtasksContainer as any)._clickHandler;
				if (clickHandler) {
					subtasksContainer.removeEventListener("click", clickHandler);
					delete (subtasksContainer as any)._clickHandler;
				}

				// Remove the container (this will also clean up child elements and their listeners)
				subtasksContainer.remove();
			}
		}
	} catch (error) {
		console.error("Error in toggleSubtasks:", error);
		throw error;
	}
}

export async function toggleBlockingTasks(
	card: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	shouldExpand: boolean
): Promise<void> {
	let container = card.querySelector(".task-card__blocking") as HTMLElement | null;

	if (!shouldExpand) {
		if (container) {
			container.remove();
		}
		return;
	}

	if (!container) {
		container = card.createDiv({ cls: "task-card__blocking" });
		// Prevent clicks within the dependency list from bubbling up to the parent card.
		// Otherwise both the blocking task and the dependent task modals would open.
		container.addEventListener("click", (event) => event.stopPropagation());
		container.addEventListener("dblclick", (event) => event.stopPropagation());
		container.addEventListener("contextmenu", (event) => event.stopPropagation());
	}

	container.empty();
	const loadingEl = container.createDiv({
		cls: "task-card__blocking-loading",
		text: plugin.i18n.translate("ui.taskCard.loadingDependencies"),
	});

	try {
		const dependentInfos = task.blocking
			? await Promise.all(task.blocking.map((path) => plugin.cacheManager.getTaskInfo(path)))
			: [];
		const dependents = dependentInfos.filter((info): info is TaskInfo => Boolean(info));

		loadingEl.remove();

		if (dependents.length === 0) {
			container.createDiv({
				cls: "task-card__blocking-empty",
				text: plugin.i18n.translate("ui.taskCard.blockingEmpty"),
			});
			return;
		}

		dependents.forEach((dependentTask) => {
			const dependentCard = createTaskCard(dependentTask, plugin, undefined);
			dependentCard.classList.add("task-card--dependency");
			container!.appendChild(dependentCard);
		});
	} catch (error) {
		console.error("Error loading blocking tasks:", error);
		loadingEl.textContent = plugin.i18n.translate("ui.taskCard.blockingLoadError");
	}
}

/**
 * Refresh expanded subtasks in parent task cards when a subtask is updated
 * This ensures that when a subtask is modified, any parent task cards that have
 * that subtask expanded will refresh their subtasks display
 */
export async function refreshParentTaskSubtasks(
	updatedTask: TaskInfo,
	plugin: TaskNotesPlugin,
	container: HTMLElement
): Promise<void> {
	// Only process if the updated task has projects (i.e., is a subtask)
	if (!updatedTask || !updatedTask.projects || updatedTask.projects.length === 0) {
		return;
	}

	// Wait for cache to contain the updated task data to prevent race condition
	// Try to get the updated task from cache, with a short retry loop
	let attempts = 0;
	const maxAttempts = 10; // Max 100ms wait
	while (attempts < maxAttempts) {
		try {
			const cachedTask = await plugin.cacheManager.getTaskInfo(updatedTask.path);
			if (cachedTask && cachedTask.dateModified === updatedTask.dateModified) {
				// Cache has been updated
				break;
			}
		} catch (error) {
			// Cache not ready yet
		}
		await new Promise((resolve) => setTimeout(resolve, 10));
		attempts++;
	}

	// Find all expanded project task cards in the container
	const expandedChevrons = container.querySelectorAll(".task-card__chevron--expanded");

	for (const chevron of expandedChevrons) {
		const taskCard = chevron.closest(".task-card") as HTMLElement;
		if (!taskCard) continue;

		const projectTaskPath = taskCard.dataset.taskPath;
		if (!projectTaskPath) continue;

		// Check if this project task is referenced by the updated subtask
		const projectFile = plugin.app.vault.getAbstractFileByPath(projectTaskPath);
		if (!(projectFile instanceof TFile)) continue;

		const projectFileName = projectFile.basename;

		// Check if the updated task references this project
		const isSubtaskOfThisProject = updatedTask.projects.flat(2).some((project) => {
			if (
				project &&
				typeof project === "string" &&
				project.startsWith("[[") &&
				project.endsWith("]]")
			) {
				const linkContent = project.slice(2, -2).trim();
				const linkedNoteName = parseLinktext(linkContent).path;
				// Check both exact match and resolved file match
				const resolvedFile = plugin.app.metadataCache.getFirstLinkpathDest(
					linkedNoteName,
					""
				);
				return (
					linkedNoteName === projectFileName ||
					(resolvedFile && resolvedFile.path === projectTaskPath)
				);
			}
			return project === projectFileName || project === projectTaskPath;
		});

		if (isSubtaskOfThisProject) {
			// Find the subtasks container
			const subtasksContainer = taskCard.querySelector(".task-card__subtasks") as HTMLElement;
			if (subtasksContainer) {
				// Re-render the subtasks by calling toggleSubtasks
				try {
					// Get the parent task info
					const parentTask = await plugin.cacheManager.getTaskInfo(projectTaskPath);
					if (parentTask) {
						// Clear and re-render subtasks
						await toggleSubtasks(taskCard, parentTask, plugin, true);
					}
				} catch (error) {
					console.error("Error refreshing parent task subtasks:", error);
				}
			}
		}
	}
}
