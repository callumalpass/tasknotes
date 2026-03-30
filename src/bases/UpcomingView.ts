/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { TFile, setIcon, Notice, Menu, Modal, Setting } from "obsidian";
import { format, add } from "date-fns";
import TaskNotesPlugin from "../main";
import { BasesViewBase } from "./BasesViewBase";
import { TaskInfo } from "../types";
import {
	AggregatedNotificationItem,
	TimeCategory,
} from "../types/settings";
import { showTaskContextMenu } from "../ui/TaskCard";
import { createAvatarStack } from "../ui/PersonAvatar";
import { hasTimeComponent, formatTime, parseDate, parseDateAsLocal, tryParseDateAsLocal, getDatePart, combineDateAndTime, formatDateForUpcomingView, UpcomingViewDateSettings } from "../utils/dateUtils";
import { normalizeDateValue } from "../utils/propertyDiscoveryUtils";
import { DueDateModal } from "../modals/DueDateModal";
import { BulkOperationEngine, BulkItem, formatResultNotice } from "../bulk";
import { readFieldOverrides, resolveFieldName } from "../utils/fieldOverrideUtils";

/**
 * Extended time category that includes "noDueDate" for items without dates.
 */
type ExtendedTimeCategory = TimeCategory | "noDueDate";

/**
 * Period types for date navigation (Agenda-style).
 */
type PeriodType = "day" | "3day" | "week" | "month" | "year" | "list";

/**
 * Display labels for time categories.
 */
const TIME_CATEGORY_LABELS: Record<ExtendedTimeCategory, string> = {
	overdue: "Overdue",
	today: "Today",
	tomorrow: "Tomorrow",
	thisWeek: "This week",
	thisMonth: "This month",
	later: "Later",
	noDueDate: "No due date",
};

/**
 * Icons for time categories.
 */
const TIME_CATEGORY_ICONS: Record<ExtendedTimeCategory, string> = {
	overdue: "alert-circle",
	today: "calendar",
	tomorrow: "calendar-plus",
	thisWeek: "calendar-range",
	thisMonth: "calendar-days",
	later: "clock",
	noDueDate: "inbox",
};

/**
 * Order for time categories (most urgent first).
 * "noDueDate" is at the end and collapsed by default.
 */
const TIME_CATEGORY_ORDER: ExtendedTimeCategory[] = [
	"overdue",
	"today",
	"tomorrow",
	"thisWeek",
	"thisMonth",
	"later",
	"noDueDate",
];

/**
 * Categories that should be collapsed by default.
 */
const DEFAULT_COLLAPSED: ExtendedTimeCategory[] = ["noDueDate"];

/**
 * UpcomingView - Todoist-style aggregated notification view.
 *
 * This is a Bases view type that:
 * 1. Shows items from its own filter (like any Bases view)
 * 2. ALSO aggregates items from VaultWideNotificationService (all notify:true bases)
 * 3. Groups items by time category (Overdue, Today, Tomorrow, etc.)
 * 4. Provides Todoist-style UI with actions (Open, Complete, Reschedule)
 *
 * Usage in .base file:
 * ```yaml
 * views:
 *   - type: tasknotesUpcoming
 *     name: Upcoming
 * ```
 */
export class UpcomingView extends BasesViewBase {
	type = "tasknotesUpcoming";

	private itemsContainer: HTMLElement | null = null;
	private collapsedSections: Set<ExtendedTimeCategory> = new Set(DEFAULT_COLLAPSED);
	private groupedItems: Map<ExtendedTimeCategory, AggregatedNotificationItem[]> = new Map();

	// Which date field drives grouping: "due" (default) or "scheduled"
	private groupByDate: "due" | "scheduled" = "due";

	// Agenda-style date navigation state
	private currentDate: Date = new Date();
	private periodType: PeriodType = "list"; // Fallback, will be overwritten by device prefs

	constructor(controller: any, containerEl: HTMLElement, plugin: TaskNotesPlugin) {
		super(controller, containerEl, plugin);
		(this.dataAdapter as any).basesView = this;

		// Load period from device preferences (persists across sessions)
		this.periodType = this.plugin.devicePrefs?.getUpcomingViewPeriod() ?? "list";
	}

	/**
	 * Extract the path from a wikilink string.
	 * E.g., "[[path/to/file.base]]" → "path/to/file.base"
	 */
	private extractWikilinkPath(wikilink?: string): string | undefined {
		if (!wikilink) return undefined;
		const match = wikilink.match(/\[\[([^\]|]+)/);
		return match ? match[1] : undefined;
	}

	/**
	 * Extract display name from a projects field.
	 * Handles: wikilink string, array of wikilinks, plain string, or undefined.
	 * E.g., "[[Project Alpha]]" → "Project Alpha"
	 *       ["[[Project Alpha]]", "[[Project Beta]]"] → "Project Alpha" (first one)
	 */
	private extractProjectName(projects?: string | string[]): string {
		if (!projects) return "";

		// Handle array - take first project
		const firstProject = Array.isArray(projects) ? projects[0] : projects;
		if (!firstProject) return "";

		// Handle Bases Link objects (has path/display properties)
		if (typeof firstProject === "object" && firstProject !== null) {
			const linkObj = firstProject as { display?: string; path?: string };
			if (linkObj.display) return linkObj.display;
			if (linkObj.path) {
				// Extract basename from path
				const parts = linkObj.path.split("/");
				return parts[parts.length - 1].replace(/\.md$/, "");
			}
			return "";
		}

		// Handle wikilink string: [[path/to/Project Alpha]] or [[Project Alpha|Display Name]]
		if (typeof firstProject === "string") {
			const match = firstProject.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
			if (match) {
				// If there's an alias (display name after |), use it
				if (match[2]) return match[2];
				// Otherwise extract basename from path
				const path = match[1];
				const parts = path.split("/");
				return parts[parts.length - 1].replace(/\.md$/, "");
			}
			// Plain string (no wikilink brackets)
			return firstProject;
		}

		return "";
	}

	/**
	 * Extract display names from assignee wikilink values.
	 * [[User-DB/Alice Chen]] → "Alice Chen"
	 * [[User-DB/Alice Chen|Alice]] → "Alice"
	 * "Bob" → "Bob"
	 */
	private extractAssigneeNames(assignees?: string[]): string[] {
		if (!assignees || assignees.length === 0) return [];
		return assignees.map(a => {
			const match = a.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
			if (match) {
				if (match[2]) return match[2];
				const parts = match[1].split("/");
				return parts[parts.length - 1].replace(/\.md$/, "");
			}
			return a;
		});
	}

	onload(): void {
		super.onload();
	}

	protected setupContainer(): void {
		super.setupContainer();

		if (this.rootElement) {
			this.rootElement.style.cssText = "display: flex; flex-direction: column; height: 100%;";
			this.rootElement.classList.add("tn-upcoming-view");
		}

		const doc = this.containerEl.ownerDocument;

		// Create items container
		const itemsContainer = doc.createElement("div");
		itemsContainer.className = "tn-upcoming-items-container";
		itemsContainer.style.cssText = "flex: 1; overflow-y: auto; position: relative;";
		this.rootElement?.appendChild(itemsContainer);
		this.itemsContainer = itemsContainer;
	}

	async render(): Promise<void> {
		if (!this.itemsContainer || !this.rootElement) return;

		this.plugin.debugLog.log("UpcomingView", "render() called");

		// Read groupByDate config from .base file (defaults to "due")
		if (this.config && typeof this.config.get === "function") {
			const raw = this.config.get("groupByDate") as string;
			this.groupByDate = (raw === "scheduled") ? "scheduled" : "due";
		}

		try {
			// Get items from own filter ONLY (this base's data)
			// NOTE: We do NOT aggregate from other notify:true bases here.
			// notify:true is for the notification system, not for injecting items into views.
			// Each view should respect its own filters.
			const items = await this.getOwnFilterItems();
			this.plugin.debugLog.log("UpcomingView", `Filter items: ${items.length}`);

			// Store filtered items for bulk creation (matches what user sees)
			if (this.data?.data && items.length > 0) {
				const filteredPaths = new Set(items.map(i => i.path));
				const dataItems = this.dataAdapter.extractDataItems();
				this.lastFilteredDataItems = dataItems.filter(item => item.path != null && filteredPaths.has(item.path));
			} else {
				this.lastFilteredDataItems = [];
			}

			// Group by time category
			this.groupedItems = this.groupByTimeCategory(items);

			// Render the UI
			this.renderContent();
		} catch (error) {
			this.plugin.debugLog.error("UpcomingView", "Error in render:", error);
			this.renderError(error as Error);
		}
	}

	/**
	 * Get items from this view's own filter (standard Bases data).
	 *
	 * IMPORTANT: Only include items that are relevant for an "Upcoming" view:
	 * - Tasks (isTask: true)
	 * - Items with due dates
	 *
	 * This prevents random notes from appearing in the view when the .base
	 * file has no filters or overly broad filters.
	 */
	private async getOwnFilterItems(): Promise<AggregatedNotificationItem[]> {
		const items: AggregatedNotificationItem[] = [];

		if (!this.data?.data) {
			this.plugin.debugLog.log("UpcomingView", "getOwnFilterItems: no this.data?.data");
			return items;
		}

		const dataItems = this.dataAdapter.extractDataItems();
		this.plugin.debugLog.log("UpcomingView", `getOwnFilterItems: extractDataItems returned ${dataItems.length} raw items`);

		let skippedCount = 0;
		for (const item of dataItems) {
			const file = item.file instanceof TFile ? item.file :
				(item.path ? this.plugin.app.vault.getAbstractFileByPath(item.path) as TFile : null);

			if (!file) {
				this.plugin.debugLog.log("UpcomingView", `getOwnFilterItems: skipping item with no file, path=${item.path}`);
				continue;
			}

			const frontmatter = item.properties ||
				this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;

			const isTask = frontmatter ? this.plugin.cacheManager.isTaskFile(frontmatter) : false;

			// Check if this is a base notification task (type: base-notification)
			const isBaseNotification = frontmatter?.type === "base-notification";
			const matchCount = isBaseNotification ? frontmatter?.matchCount : undefined;
			const sourceBasePath = isBaseNotification ? this.extractWikilinkPath(frontmatter?.sourceBase) : undefined;

			// Get dates — resolve per-task field overrides (tnDueDateProp etc.) then
			// fall back to global field mapping. Ensures remapped properties like
			// "next_assessment_due" are correctly read as due dates.
			const overrides = frontmatter ? readFieldOverrides(frontmatter) : {};
			const duePropName = resolveFieldName("due", overrides, this.plugin.fieldMapper.toUserField("due"));
			const schedPropName = resolveFieldName("scheduled", overrides, this.plugin.fieldMapper.toUserField("scheduled"));
			const rawDueDate = frontmatter?.[duePropName] || frontmatter?.Review_date;
			const rawScheduledDate = frontmatter?.[schedPropName];
			const dueDate = normalizeDateValue(rawDueDate) ?? undefined;
			const scheduledDate = normalizeDateValue(rawScheduledDate) ?? undefined;

			// FILTER: Only include items that are tasks OR have the active date
			// This prevents random notes from appearing in the Upcoming view
			const activeDate = this.groupByDate === "scheduled" ? scheduledDate : dueDate;
			if (!isTask && !activeDate) {
				skippedCount++;
				continue;
			}

			// Get title - handle various types (string, object, undefined)
			const rawTitle = frontmatter?.title;
			const mappedTitle = frontmatter?.[this.plugin.fieldMapper.toUserField("title")];
			let title: string;

			if (typeof rawTitle === "string" && rawTitle) {
				title = rawTitle;
			} else if (typeof mappedTitle === "string" && mappedTitle) {
				title = mappedTitle;
			} else if (rawTitle && typeof rawTitle === "object") {
				// Handle Bases Link objects
				title = (rawTitle as any).display || (rawTitle as any).path || file.basename;
			} else {
				title = file.basename;
			}

			this.plugin.debugLog.log("UpcomingView", `getOwnFilterItems: included ${file.path}`, {
				title,
				isTask,
				dueDate,
			});

			const timeCategory = this.categorizeByTime(activeDate);
			const timeContext = this.getTimeContext(activeDate);

			// Get projects field (user-configured field name via fieldMapper)
			const projectFieldName = this.plugin.fieldMapper.toUserField("projects");
			const projects = frontmatter?.[projectFieldName];

			// Get assignees field (resolve per-task override)
			const globalAssignee = this.plugin.settings.assigneeFieldName || "assignee";
			const assigneeOverrides = readFieldOverrides(frontmatter);
			const assigneeFieldName = resolveFieldName("assignee", assigneeOverrides, globalAssignee);
			const rawAssignee = frontmatter?.[assigneeFieldName];
			let assignees: string[] | undefined;
			if (rawAssignee) {
				if (Array.isArray(rawAssignee)) {
					assignees = rawAssignee.map(String);
				} else {
					assignees = [String(rawAssignee)];
				}
			}

			items.push({
				path: file.path,
				title,
				isTask,
				status: isTask ? frontmatter?.status : undefined,
				dueDate,
				scheduledDate,
				assignees,
				projects,
				sources: [{
					type: "base",
					path: "this",
					name: "This view",
				}],
				timeCategory,
				timeContext,
				isBaseNotification,
				matchCount,
				sourceBasePath,
			});
		}

		this.plugin.debugLog.log("UpcomingView", `getOwnFilterItems: filtered to ${items.length} items (skipped ${skippedCount} non-task items without ${this.groupByDate} dates)`);

		return items;
	}

	/**
	 * Merge own items with aggregated items, deduplicating by path.
	 */
	private mergeAndDeduplicate(
		ownItems: AggregatedNotificationItem[],
		aggregatedItems: AggregatedNotificationItem[]
	): AggregatedNotificationItem[] {
		const byPath = new Map<string, AggregatedNotificationItem>();

		// Add aggregated items first (they have source info)
		for (const item of aggregatedItems) {
			byPath.set(item.path, item);
		}

		// Add own items, merging sources if already exists
		for (const item of ownItems) {
			const existing = byPath.get(item.path);
			if (existing) {
				// Merge sources
				existing.sources.push(...item.sources.filter(s =>
					!existing.sources.some(es => es.path === s.path)
				));
			} else {
				byPath.set(item.path, item);
			}
		}

		return Array.from(byPath.values());
	}

	/**
	 * Group items by time category.
	 * Items without due dates go to "noDueDate" category (collapsed by default).
	 */
	private groupByTimeCategory(items: AggregatedNotificationItem[]): Map<ExtendedTimeCategory, AggregatedNotificationItem[]> {
		const grouped = new Map<ExtendedTimeCategory, AggregatedNotificationItem[]>();

		// Initialize all categories
		for (const cat of TIME_CATEGORY_ORDER) {
			grouped.set(cat, []);
		}

		// Group items - route items without the active date to "noDueDate"
		for (const item of items) {
			// Determine the actual category using whichever date field is active
			const activeDate = this.groupByDate === "scheduled" ? item.scheduledDate : item.dueDate;
			let category: ExtendedTimeCategory;
			if (!activeDate) {
				category = "noDueDate";
			} else {
				category = item.timeCategory;
			}

			const group = grouped.get(category) || [];
			group.push(item);
			grouped.set(category, group);
		}

		// Sort items within each group by title (handle undefined/object titles)
		for (const [cat, catItems] of grouped) {
			catItems.sort((a, b) => {
				// Force string conversion - title might be undefined, null, or an object
				const titleA = String(a.title ?? "");
				const titleB = String(b.title ?? "");
				return titleA.localeCompare(titleB);
			});
		}

		return grouped;
	}

	/**
	 * Categorize an item by time based on due date.
	 */
	private categorizeByTime(dueDate?: string): TimeCategory {
		if (!dueDate) {
			return "later";
		}

		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		// Use safe parsing — invalid/placeholder dates (e.g. "(YYYY-MM-DD)") return null
		const due = tryParseDateAsLocal(dueDate);
		if (!due) return "later";
		const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

		const diffDays = Math.floor((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

		if (diffDays < 0) return "overdue";
		if (diffDays === 0) return "today";
		if (diffDays === 1) return "tomorrow";
		if (diffDays <= 7) return "thisWeek";
		if (diffDays <= 30) return "thisMonth";
		return "later";
	}

	/**
	 * Get the Upcoming View date settings.
	 * Checks view-specific config first (from .base file), falls back to plugin defaults.
	 */
	private getDateSettings(): UpcomingViewDateSettings {
		// Try to get view-specific settings from .base file config
		let viewDateFormat: string | undefined;
		let viewUseRelativeDates: boolean | undefined;

		if (this.config && typeof this.config.get === "function") {
			try {
				viewDateFormat = this.config.get("dateFormat") as string;
				const viewRelative = this.config.get("useRelativeDates");
				// Bases API may return toggle values as strings ("true"/"false") or booleans
				if (viewRelative !== undefined) {
					viewUseRelativeDates = viewRelative === true || viewRelative === "true";
				}
			} catch {
				// Config not available, use defaults
			}
		}

		// Use view override if set and not "default", otherwise use plugin defaults
		const dateFormat = (viewDateFormat && viewDateFormat !== "default")
			? viewDateFormat as "iso" | "us" | "eu" | "relative" | "rich" | "custom"
			: this.plugin.settings.upcomingViewDateFormat;

		const useRelativeDates = viewUseRelativeDates ?? this.plugin.settings.upcomingViewUseRelativeDates;

		return {
			upcomingViewDateFormat: dateFormat,
			upcomingViewCustomDateFormat: this.plugin.settings.upcomingViewCustomDateFormat,
			upcomingViewUseRelativeDates: useRelativeDates,
			upcomingViewRelativeDateThreshold: this.plugin.settings.upcomingViewRelativeDateThreshold,
		};
	}

	/**
	 * Get human-readable time context for an item.
	 * Uses the date format settings to determine display format.
	 */
	private getTimeContext(dueDate?: string): string | undefined {
		if (!dueDate) {
			return undefined;
		}

		const settings = this.getDateSettings();
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		// Use safe parsing — invalid/placeholder dates return null
		const due = tryParseDateAsLocal(dueDate);
		if (!due) return undefined;
		const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

		const diffDays = Math.floor((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
		const absDays = Math.abs(diffDays);

		// Check if within relative date threshold
		const withinThreshold = absDays <= settings.upcomingViewRelativeDateThreshold;

		// If using relative dates and within threshold, show relative
		if (settings.upcomingViewUseRelativeDates && withinThreshold) {
			// For overdue items, show just the relative date without "Due" prefix
			// (they're already in the red Overdue section, so "Due" is redundant)
			if (diffDays < -1) return `${absDays} days ago`;
			if (diffDays === -1) return "Yesterday";
			if (diffDays === 0) return "Due today";
			if (diffDays === 1) return "Due tomorrow";
			if (diffDays > 1) return `Due in ${diffDays} days`;
		}

		// Use date format based on user settings (respects relative dates toggle)
		const formattedDate = formatDateForUpcomingView(due, settings, false);
		return diffDays < 0 ? formattedDate : `Due ${formattedDate}`;
	}

	/**
	 * Render the main content.
	 */
	private renderContent(): void {
		if (!this.itemsContainer) return;
		this.itemsContainer.empty();

		const doc = this.itemsContainer.ownerDocument;

		// Render Agenda-style date navigation
		this.renderDateNavigation(doc);

		// Get the date range for the current period
		const { start, end } = this.getDateRange();

		// Filter items by date range (but always show overdue)
		const filteredItems = this.filterItemsByDateRange(start, end);

		// Group filtered items by time category
		const filteredGrouped = this.groupByTimeCategory(filteredItems);

		// Render time category sections
		for (const category of TIME_CATEGORY_ORDER) {
			const items = filteredGrouped.get(category) || [];

			// Skip empty sections (except for today/tomorrow which always show if in range)
			const isInRange = this.isCategoryInRange(category, start, end);
			if (items.length === 0 && !isInRange) {
				continue;
			}

			// Always show overdue section if it has items (regardless of date range)
			if (category === "overdue" && items.length === 0) {
				continue;
			}

			this.renderSection(doc, category, items);
		}

		// Render empty state if no items
		const totalItems = Array.from(filteredGrouped.values()).reduce((sum, items) => sum + items.length, 0);
		if (totalItems === 0) {
			this.renderEmptyState(doc);
		}
	}

	/**
	 * Render Agenda-style date navigation.
	 * Layout: < > Today Refresh | Date Range Label | Y M W 3D D L
	 */
	private renderDateNavigation(doc: Document): void {
		const navContainer = doc.createElement("div");
		navContainer.className = "tn-upcoming-nav";

		// Left section: navigation buttons
		const leftSection = doc.createElement("div");
		leftSection.className = "tn-upcoming-nav__left";

		// Previous button
		const prevBtn = doc.createElement("button");
		prevBtn.className = "tn-upcoming-nav__button tn-upcoming-nav__arrow";
		setIcon(prevBtn, "chevron-left");
		prevBtn.title = "Previous";
		prevBtn.addEventListener("click", () => this.prevPeriod());
		leftSection.appendChild(prevBtn);

		// Next button
		const nextBtn = doc.createElement("button");
		nextBtn.className = "tn-upcoming-nav__button tn-upcoming-nav__arrow";
		setIcon(nextBtn, "chevron-right");
		nextBtn.title = "Next";
		nextBtn.addEventListener("click", () => this.nextPeriod());
		leftSection.appendChild(nextBtn);

		// Today button
		const todayBtn = doc.createElement("button");
		todayBtn.className = "tn-upcoming-nav__button";
		todayBtn.textContent = "Today";
		todayBtn.addEventListener("click", () => this.goToToday());
		leftSection.appendChild(todayBtn);

		// Refresh button
		const refreshBtn = doc.createElement("button");
		refreshBtn.className = "tn-upcoming-nav__button tn-upcoming-nav__icon-btn";
		setIcon(refreshBtn, "refresh-cw");
		refreshBtn.title = "Refresh";
		refreshBtn.addEventListener("click", () => this.render());
		leftSection.appendChild(refreshBtn);

		navContainer.appendChild(leftSection);

		// Center section: date range label
		const centerSection = doc.createElement("div");
		centerSection.className = "tn-upcoming-nav__center";
		centerSection.textContent = this.getDateRangeLabel();
		navContainer.appendChild(centerSection);

		// Right section: period buttons (Y M W 3D D L)
		const rightSection = doc.createElement("div");
		rightSection.className = "tn-upcoming-nav__right";

		const periods: Array<{ id: PeriodType; label: string; title: string }> = [
			{ id: "year", label: "Y", title: "Year" },
			{ id: "month", label: "M", title: "Month" },
			{ id: "week", label: "W", title: "Week" },
			{ id: "3day", label: "3D", title: "3 Days" },
			{ id: "day", label: "D", title: "Day" },
			{ id: "list", label: "L", title: "List (all)" },
		];

		for (const period of periods) {
			const btn = doc.createElement("button");
			btn.className = `tn-upcoming-nav__period${this.periodType === period.id ? " tn-upcoming-nav__period--active" : ""}`;
			btn.textContent = period.label;
			btn.title = period.title;
			btn.addEventListener("click", () => this.setPeriodType(period.id));
			rightSection.appendChild(btn);
		}

		navContainer.appendChild(rightSection);

		this.itemsContainer?.appendChild(navContainer);
	}

	/**
	 * Navigate to today.
	 */
	private goToToday(): void {
		this.currentDate = new Date();
		this.renderContent();
	}

	/**
	 * Navigate to the next period.
	 */
	private nextPeriod(): void {
		const newDate = new Date(this.currentDate);

		switch (this.periodType) {
			case "day":
				newDate.setDate(newDate.getDate() + 1);
				break;
			case "3day":
				newDate.setDate(newDate.getDate() + 3);
				break;
			case "week":
				newDate.setDate(newDate.getDate() + 7);
				break;
			case "month":
				newDate.setMonth(newDate.getMonth() + 1);
				break;
			case "year":
				newDate.setFullYear(newDate.getFullYear() + 1);
				break;
			case "list":
				// List mode shows all - no navigation
				return;
		}

		this.currentDate = newDate;
		this.renderContent();
	}

	/**
	 * Navigate to the previous period.
	 */
	private prevPeriod(): void {
		const newDate = new Date(this.currentDate);

		switch (this.periodType) {
			case "day":
				newDate.setDate(newDate.getDate() - 1);
				break;
			case "3day":
				newDate.setDate(newDate.getDate() - 3);
				break;
			case "week":
				newDate.setDate(newDate.getDate() - 7);
				break;
			case "month":
				newDate.setMonth(newDate.getMonth() - 1);
				break;
			case "year":
				newDate.setFullYear(newDate.getFullYear() - 1);
				break;
			case "list":
				// List mode shows all - no navigation
				return;
		}

		this.currentDate = newDate;
		this.renderContent();
	}

	/**
	 * Set the period type.
	 * Persists choice to device preferences so it's remembered across sessions.
	 */
	private setPeriodType(type: PeriodType): void {
		this.periodType = type;

		// Save to device preferences (per-device, survives restart)
		this.plugin.devicePrefs?.setUpcomingViewPeriod(type);

		this.renderContent();
	}

	/**
	 * Get the date range for the current period.
	 */
	private getDateRange(): { start: Date; end: Date } {
		const base = new Date(this.currentDate);
		base.setHours(0, 0, 0, 0);

		switch (this.periodType) {
			case "day":
				return { start: base, end: base };

			case "3day": {
				const end = new Date(base);
				end.setDate(end.getDate() + 2);
				return { start: base, end };
			}

			case "week": {
				// Start of week (Monday = 1)
				const dayOfWeek = base.getDay();
				const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Monday start
				const start = new Date(base);
				start.setDate(start.getDate() + diff);
				const end = new Date(start);
				end.setDate(end.getDate() + 6);
				return { start, end };
			}

			case "month": {
				const start = new Date(base.getFullYear(), base.getMonth(), 1);
				const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
				return { start, end };
			}

			case "year": {
				const start = new Date(base.getFullYear(), 0, 1);
				const end = new Date(base.getFullYear(), 11, 31);
				return { start, end };
			}

			case "list":
			default:
				// List mode: show all (far past to far future)
				return {
					start: new Date(1970, 0, 1),
					end: new Date(2099, 11, 31),
				};
		}
	}

	/**
	 * Get the date range label for display.
	 */
	private getDateRangeLabel(): string {
		const { start, end } = this.getDateRange();
		const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
		const yearOptions: Intl.DateTimeFormatOptions = { year: "numeric" };

		switch (this.periodType) {
			case "day":
				return start.toLocaleDateString("en-US", { ...options, year: "numeric", weekday: "long" });

			case "3day":
			case "week": {
				const startStr = start.toLocaleDateString("en-US", options);
				const endStr = end.toLocaleDateString("en-US", options);
				const year = end.toLocaleDateString("en-US", yearOptions);
				return `${startStr} - ${endStr}, ${year}`;
			}

			case "month":
				return start.toLocaleDateString("en-US", { month: "long", year: "numeric" });

			case "year":
				return start.toLocaleDateString("en-US", { year: "numeric" });

			case "list":
				return "All items";

			default:
				return "";
		}
	}

	/**
	 * Filter items by date range.
	 * Overdue items are always included.
	 */
	private filterItemsByDateRange(start: Date, end: Date): AggregatedNotificationItem[] {
		const allItems = Array.from(this.groupedItems.values()).flat();

		// In list mode, return all items
		if (this.periodType === "list") {
			return allItems;
		}

		return allItems.filter(item => {
			// Always include overdue items
			if (item.timeCategory === "overdue") {
				return true;
			}

			// Items without due date go to noDueDate section (always show in list mode only)
			if (!item.dueDate) {
				return false;
			}

			const itemDate = new Date(item.dueDate);
			itemDate.setHours(0, 0, 0, 0);

			return itemDate >= start && itemDate <= end;
		});
	}

	/**
	 * Check if a time category should show (even empty) based on date range.
	 */
	private isCategoryInRange(category: ExtendedTimeCategory, start: Date, end: Date): boolean {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		switch (category) {
			case "overdue":
				return true; // Always show overdue section if enabled
			case "today":
				return today >= start && today <= end;
			case "tomorrow":
				return tomorrow >= start && tomorrow <= end;
			default:
				return false;
		}
	}

	/**
	 * Get formatted date string for section header (Todoist style).
	 * Returns "Jan 31 • Friday" or "Jan 31 • Today • Friday" etc.
	 * Note: Section headers manually add Today/Tomorrow labels, so we use
	 * a simple date format here, not the rich format which includes labels.
	 */
	private getSectionDateLabel(category: ExtendedTimeCategory): string {
		const now = new Date();
		const settings = this.getDateSettings();
		const dayOptions: Intl.DateTimeFormatOptions = { weekday: "long" };

		// For section headers, use a simple date format (not rich) to avoid
		// duplicating Today/Tomorrow labels which are added manually below
		const getSimpleDateStr = (date: Date): string => {
			const currentYear = date.getFullYear();
			const dateYear = date.getFullYear();
			const sameYear = new Date().getFullYear() === dateYear;

			// Use the format preference but without Today/Tomorrow labels
			switch (settings.upcomingViewDateFormat) {
				case "iso":
					return sameYear
						? date.toLocaleDateString("en-CA").slice(5) // "02-02"
						: date.toLocaleDateString("en-CA"); // "2026-02-02"
				case "eu":
					return sameYear
						? date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
						: date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
				case "us":
				case "rich":
				case "relative":
				case "custom":
				default:
					// US-style date portion (no year if same year)
					return sameYear
						? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
						: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
			}
		};

		switch (category) {
			case "overdue":
				return "Overdue";
			case "today": {
				const dateStr = getSimpleDateStr(now);
				const dayStr = now.toLocaleDateString("en-US", dayOptions);
				return `${dateStr} • Today • ${dayStr}`;
			}
			case "tomorrow": {
				const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
				const dateStr = getSimpleDateStr(tomorrow);
				const dayStr = tomorrow.toLocaleDateString("en-US", dayOptions);
				return `${dateStr} • Tomorrow • ${dayStr}`;
			}
			case "thisWeek":
				return "This week";
			case "thisMonth":
				return "This month";
			case "later":
				return "Later";
			case "noDueDate":
				return this.groupByDate === "scheduled" ? "No scheduled date" : "No due date";
			default:
				return TIME_CATEGORY_LABELS[category];
		}
	}

	/**
	 * Render a time category section.
	 * Todoist-style: collapse arrow on far left, reschedule link on far right for overdue
	 */
	private renderSection(doc: Document, category: ExtendedTimeCategory, items: AggregatedNotificationItem[]): void {
		const section = doc.createElement("div");
		section.className = `tn-upcoming-section tn-upcoming-section--${category}`;

		// Section header - Todoist style: [chevron] [date label] [count] ... [reschedule]
		const header = doc.createElement("div");
		header.className = "tn-upcoming-section__header";

		// Collapse chevron FIRST (far left) - Todoist pattern
		const collapseEl = doc.createElement("span");
		collapseEl.className = "tn-upcoming-section__collapse";
		setIcon(collapseEl, this.collapsedSections.has(category) ? "chevron-right" : "chevron-down");
		header.appendChild(collapseEl);

		// Date label (Todoist style: "Jan 31 • Today • Friday")
		const titleEl = doc.createElement("span");
		titleEl.className = "tn-upcoming-section__title";
		titleEl.textContent = this.getSectionDateLabel(category);
		header.appendChild(titleEl);

		// Count
		const countEl = doc.createElement("span");
		countEl.className = "tn-upcoming-section__count";
		countEl.textContent = `(${items.length})`;
		header.appendChild(countEl);

		// Spacer to push reschedule to right
		const spacer = doc.createElement("span");
		spacer.className = "tn-upcoming-section__spacer";
		header.appendChild(spacer);

		// Reschedule link on far right (only for overdue section with items)
		if (category === "overdue" && items.length > 0) {
			const rescheduleLink = doc.createElement("span");
			rescheduleLink.className = "tn-upcoming-section__reschedule";
			rescheduleLink.textContent = "Reschedule";
			rescheduleLink.addEventListener("click", (e) => {
				e.stopPropagation();
				this.plugin.debugLog.log("UpcomingView", "=== RESCHEDULE BUTTON CLICKED ===");
				this.plugin.debugLog.log("UpcomingView", `Category: ${category}, Items count: ${items.length}`);
				try {
					this.handleRescheduleAll(items);
				} catch (error) {
					this.plugin.debugLog.error("UpcomingView", "Error in handleRescheduleAll:", error);
					new Notice(`Reschedule error: ${error}`);
				}
			});
			header.appendChild(rescheduleLink);
		}

		header.addEventListener("click", () => {
			if (this.collapsedSections.has(category)) {
				this.collapsedSections.delete(category);
			} else {
				this.collapsedSections.add(category);
			}
			this.renderContent();
		});

		section.appendChild(header);

		// Section content (if not collapsed)
		if (!this.collapsedSections.has(category)) {
			const content = doc.createElement("div");
			content.className = "tn-upcoming-section__content";

			// Render items
			for (const item of items) {
				this.renderItem(doc, content, item);
			}

			// Add task button at bottom (Todoist pattern - simple + and text)
			const addTaskBtn = doc.createElement("div");
			addTaskBtn.className = "tn-upcoming-add-task";

			const plusIcon = doc.createElement("span");
			plusIcon.className = "tn-upcoming-add-task__icon";
			plusIcon.textContent = "+";
			addTaskBtn.appendChild(plusIcon);

			const addText = doc.createElement("span");
			addText.className = "tn-upcoming-add-task__text";
			addText.textContent = "Add task";
			addTaskBtn.appendChild(addText);

			addTaskBtn.addEventListener("click", () => {
				this.handleAddTask(category);
			});
			content.appendChild(addTaskBtn);

			section.appendChild(content);
		}

		this.itemsContainer?.appendChild(section);
	}

	/**
	 * Render a single item — Todoist-style 2-row layout.
	 * Row 1: indicator + title + avatar stack (or base indicator)
	 * Row 2: date/time (left) + project/context (right, grey)
	 *
	 * Phase 8c: Shows seen/unseen state from reminder queue.
	 * - PENDING (unseen): Normal styling
	 * - SEEN: Muted styling (grey text, reduced opacity)
	 */
	private renderItem(doc: Document, container: HTMLElement, item: AggregatedNotificationItem): void {
		// Check if item is seen in the reminder queue (Phase 8c)
		const isSeen = this.plugin.toastNotification.isItemSeen(item);

		const itemEl = doc.createElement("div");
		itemEl.className = `tn-upcoming-item${item.isTask ? " tn-upcoming-item--task" : ""}${item.isBaseNotification ? " tn-upcoming-item--base-notification" : ""}${isSeen ? " tn-upcoming-item--seen" : ""}`;

		// ── Row 1: indicator + title + avatars/base-indicator ──
		const row1 = doc.createElement("div");
		row1.className = "tn-upcoming-item__row1";

		// Indicator: checkbox for tasks, circle for base notifications, file icon for notes
		const indicator = doc.createElement("span");
		indicator.className = "tn-upcoming-item__indicator";

		if (item.isBaseNotification) {
			indicator.classList.add("tn-upcoming-item__indicator--task");
			setIcon(indicator, "circle");
			indicator.addEventListener("click", (e) => {
				e.stopPropagation();
				const newLeaf = e.ctrlKey || e.metaKey;
				this.handleOpenBase(item, newLeaf);
			});
		} else if (item.isTask) {
			indicator.classList.add("tn-upcoming-item__indicator--task");

			// Status-aware rendering (matches TaskCard pattern)
			const statusConfig = item.status
				? this.plugin.statusManager.getStatusConfig(item.status)
				: undefined;

			if (statusConfig?.icon) {
				// Icon mode: render the status icon with color
				indicator.classList.add("tn-upcoming-item__indicator--icon");
				setIcon(indicator, statusConfig.icon);
				indicator.style.color = statusConfig.color;
			} else {
				// Dot mode: colored border circle
				setIcon(indicator, "circle");
				if (statusConfig) {
					indicator.style.borderColor = statusConfig.color;
				}
			}

			// Completed state: filled circle
			if (statusConfig?.isCompleted) {
				indicator.classList.add("tn-upcoming-item__indicator--completed");
				if (statusConfig.color) {
					indicator.style.setProperty("--status-color", statusConfig.color);
				}
			}

			// Next status hint for hover
			const nextStatus = this.plugin.statusManager.getNextStatus(item.status ?? "");
			const nextConfig = nextStatus
				? this.plugin.statusManager.getStatusConfig(nextStatus)
				: undefined;
			if (nextConfig) {
				indicator.style.setProperty("--next-status-color", nextConfig.color);
			}

			indicator.addEventListener("click", (e) => {
				e.stopPropagation();
				this.handleComplete(item);
			});
		} else {
			indicator.classList.add("tn-upcoming-item__indicator--note");
			setIcon(indicator, "file-text");
		}
		row1.appendChild(indicator);

		// Title
		const titleEl = doc.createElement("span");
		titleEl.className = "tn-upcoming-item__title";
		titleEl.textContent = String(item.title ?? "Untitled");
		titleEl.addEventListener("click", (event) => {
			const newLeaf = event.ctrlKey || event.metaKey;
			if (item.isBaseNotification) {
				this.handleOpenBase(item, newLeaf);
			} else {
				this.handleOpen(item, newLeaf);
			}
		});
		row1.appendChild(titleEl);

		// Right side of Row 1: avatar stack (for ALL items with assignees)
		const assigneeNames = this.extractAssigneeNames(item.assignees);
		if (assigneeNames.length > 0) {
			const avatarsContainer = doc.createElement("div");
			avatarsContainer.className = "tn-upcoming-item__avatars";
			const stack = createAvatarStack(assigneeNames, { size: "xs", maxShow: 3 });
			avatarsContainer.appendChild(stack);
			row1.appendChild(avatarsContainer);
		}

		itemEl.appendChild(row1);

		// ── Row 2: date/time (left) + context/project (right) ──
		const row2 = doc.createElement("div");
		row2.className = "tn-upcoming-item__row2";

		// Left side: date/time display
		// The "active" date is the one used for grouping; the "other" is supplementary info
		const activeDateValue = this.groupByDate === "scheduled" ? item.scheduledDate : item.dueDate;
		const otherDateValue = this.groupByDate === "scheduled" ? item.dueDate : item.scheduledDate;

		const dateEl = doc.createElement("span");
		const itemHasTime = activeDateValue && hasTimeComponent(activeDateValue);
		const isDateSpecificSection = item.timeCategory === "today" || item.timeCategory === "tomorrow";
		const isCategorySection = item.timeCategory === "overdue" || item.timeCategory === "thisWeek" ||
			item.timeCategory === "thisMonth" || item.timeCategory === "later";
		const needsDateDisplay = isCategorySection && activeDateValue;

		if (itemHasTime || needsDateDisplay) {
			dateEl.className = `tn-upcoming-item__date tn-upcoming-item__date--${item.timeCategory}`;

			if (itemHasTime) {
				const clockIcon = doc.createElement("span");
				clockIcon.className = "tn-upcoming-item__date-icon";
				setIcon(clockIcon, "clock");
				dateEl.appendChild(clockIcon);

				const timeFormat = this.plugin.settings.calendarViewSettings?.timeFormat || "12";
				const parsedDate = parseDate(activeDateValue!);
				const timeStr = formatTime(parsedDate, timeFormat as "12" | "24");
				dateEl.appendChild(doc.createTextNode(` ${timeStr}`));

				if (!isDateSpecificSection && activeDateValue) {
					const settings = this.getDateSettings();
					const formattedDate = formatDateForUpcomingView(activeDateValue, settings, false);
					dateEl.appendChild(doc.createTextNode(` • ${formattedDate}`));
				}
			} else if (needsDateDisplay) {
				const settings = this.getDateSettings();
				const formattedDate = formatDateForUpcomingView(activeDateValue, settings, false);
				dateEl.textContent = formattedDate;
			}
		}

		// Show the "other" date as supplementary info (e.g., due date when grouping by scheduled)
		if (otherDateValue) {
			const otherLabel = this.groupByDate === "scheduled" ? "Due" : "Scheduled";
			const otherIcon = this.groupByDate === "scheduled" ? "calendar" : "calendar-clock";
			if (dateEl.textContent || dateEl.childNodes.length > 0) {
				dateEl.appendChild(doc.createTextNode(" • "));
			}
			dateEl.className = dateEl.className || `tn-upcoming-item__date tn-upcoming-item__date--${item.timeCategory}`;
			const iconSpan = doc.createElement("span");
			iconSpan.className = "tn-upcoming-item__date-icon";
			setIcon(iconSpan, otherIcon);
			dateEl.appendChild(iconSpan);
			const settings = this.getDateSettings();
			const formattedOther = formatDateForUpcomingView(otherDateValue, settings, false);
			dateEl.appendChild(doc.createTextNode(` ${otherLabel}: ${formattedOther}`));
		}
		row2.appendChild(dateEl);

		// Right side: base indicator (for base notifications) or project/context (grey text)
		if (item.isBaseNotification) {
			const baseIndicator = doc.createElement("span");
			baseIndicator.className = "tn-upcoming-item__base-indicator";

			if (item.matchCount !== undefined) {
				const countEl = doc.createElement("span");
				countEl.className = "tn-upcoming-item__base-indicator__count";
				countEl.textContent = String(item.matchCount);
				baseIndicator.appendChild(countEl);
			}

			const iconSpan = doc.createElement("span");
			setIcon(iconSpan, "layers");
			baseIndicator.appendChild(iconSpan);

			baseIndicator.addEventListener("click", (e) => {
				e.stopPropagation();
				const newLeaf = e.ctrlKey || e.metaKey;
				this.handleOpenBase(item, newLeaf);
			});

			row2.appendChild(baseIndicator);
		} else {
			const projectName = this.extractProjectName(item.projects);
			if (projectName) {
				const contextEl = doc.createElement("span");
				contextEl.className = "tn-upcoming-item__context";
				contextEl.textContent = projectName.length > 25 ? projectName.substring(0, 22) + "..." : projectName;
				contextEl.title = projectName;
				row2.appendChild(contextEl);
			}
		}

		itemEl.appendChild(row2);

		// Context menu (right-click)
		itemEl.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.showItemContextMenu(e, item);
		});

		container.appendChild(itemEl);
	}

	/**
	 * Show context menu for an item.
	 * TaskNotes items get the full upstream task context menu.
	 * Base notification items get a specialized menu.
	 */
	private async showItemContextMenu(event: MouseEvent, item: AggregatedNotificationItem): Promise<void> {
		if (item.isBaseNotification) {
			// Base notification tasks get a specialized menu (not the full task menu)
			this.showBaseNotificationTaskContextMenu(event, item);
		} else if (item.isTask) {
			// Regular tasks get the full upstream context menu (includes due date, status, priority, etc.)
			this.plugin.debugLog.log("UpcomingView", `Showing upstream task context menu for: ${item.title}`);
			await showTaskContextMenu(event, item.path, this.plugin, new Date());
		} else {
			// Non-task items get a simplified menu
			this.showBaseNotificationContextMenu(event, item);
		}
	}

	/**
	 * Show context menu for regular task items in Upcoming view.
	 * Includes reschedule option that the upstream menu doesn't have.
	 */
	private showTaskItemContextMenu(event: MouseEvent, item: AggregatedNotificationItem): void {
		this.plugin.debugLog.log("UpcomingView", `showTaskItemContextMenu for: ${item.title}`);
		const menu = new Menu();

		// Open the task
		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Open task")
				.setIcon("file-text")
				.onClick(() => {
					this.handleOpen(item);
				});
		});

		menu.addSeparator();

		// Complete the task
		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Complete")
				.setIcon("check")
				.onClick(async () => {
					try {
						await this.handleComplete(item);
					} catch (error) {
						this.plugin.debugLog.error("UpcomingView", "Error completing task:", error);
						new Notice(`Error: ${error}`);
					}
				});
		});

		// Reschedule (change due date) - for regular tasks
		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Reschedule")
				.setIcon("calendar")
				.onClick(async () => {
					this.plugin.debugLog.log("UpcomingView", "=== TASK CONTEXT MENU RESCHEDULE CLICKED ===");
					this.plugin.debugLog.log("UpcomingView", `Item: ${item.title}, isTask: ${item.isTask}, path: ${item.path}`);
					try {
						await this.handleReschedule(item);
					} catch (error) {
						this.plugin.debugLog.error("UpcomingView", "Error in handleReschedule:", error);
						new Notice(`Reschedule error: ${error}`);
					}
				});
		});

		menu.addSeparator();

		// Snooze options
		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Snooze 1 hour")
				.setIcon("clock")
				.onClick(() => {
					this.handleSnooze(item, 60);
				});
		});

		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Snooze until tomorrow")
				.setIcon("clock")
				.onClick(() => {
					// Calculate minutes until tomorrow 9am
					const now = new Date();
					const tomorrow9am = new Date(now);
					tomorrow9am.setDate(tomorrow9am.getDate() + 1);
					tomorrow9am.setHours(9, 0, 0, 0);
					const minutes = Math.round((tomorrow9am.getTime() - now.getTime()) / (1000 * 60));
					this.handleSnooze(item, minutes);
				});
		});

		menu.addSeparator();

		// Copy link
		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Copy link")
				.setIcon("link")
				.onClick(() => {
					navigator.clipboard.writeText(`[[${item.path}]]`);
					new Notice("Link copied to clipboard");
				});
		});

		menu.showAtMouseEvent(event);
	}

	/**
	 * Show specialized context menu for base notification TASKS.
	 * These are the notification TaskNote files (type: base-notification).
	 * Actions: Open base, Mark resolved, Reschedule, Snooze, etc.
	 */
	private showBaseNotificationTaskContextMenu(event: MouseEvent, item: AggregatedNotificationItem): void {
		const menu = new Menu();

		// Open the source base file (primary action)
		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Open base")
				.setIcon("database")
				.onClick(() => {
					this.handleOpenBase(item);
				});
		});

		// Open the notification task file itself
		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Open notification task")
				.setIcon("file-text")
				.onClick(() => {
					this.handleOpen(item);
				});
		});

		// Edit task (opens full edit modal)
		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Edit task")
				.setIcon("pencil")
				.onClick(() => {
					this.handleEditTask(item);
				});
		});

		// Assign submenu
		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Assign")
				.setIcon("user");

			const submenu = (menuItem as any).setSubmenu();
			this.addAssignSubmenu(submenu, item);
		});

		menu.addSeparator();

		// Mark as resolved (complete the notification task)
		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Mark resolved")
				.setIcon("check")
				.onClick(async () => {
					try {
						await this.handleComplete(item);
					} catch (error) {
						this.plugin.debugLog.error("UpcomingView", "Error completing base notification:", error);
						new Notice(`Error: ${error}`);
					}
				});
		});

		// NOTE: "Reschedule" removed for base notifications - see knowledge-base/01-working/upcoming-view-deferred-items.md
		// Base notification timing is based on "X days after items appear", not a simple due date.
		// Implementing reschedule for base notifications requires:
		// - UUID-based tracking of when items first appeared
		// - Persistence across restarts
		// - Different UI (adjust delay, not pick a date)

		menu.addSeparator();

		// Snooze options
		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Snooze 1 hour")
				.setIcon("clock")
				.onClick(() => {
					this.handleSnooze(item, 60);
				});
		});

		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Snooze until tomorrow")
				.setIcon("clock")
				.onClick(() => {
					// Calculate minutes until 9am tomorrow
					const now = new Date();
					const tomorrow = new Date(now);
					tomorrow.setDate(tomorrow.getDate() + 1);
					tomorrow.setHours(9, 0, 0, 0);
					const minutes = Math.floor((tomorrow.getTime() - now.getTime()) / (60 * 1000));
					this.handleSnooze(item, minutes);
				});
		});

		menu.addSeparator();

		// Copy link
		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Copy link")
				.setIcon("link")
				.onClick(() => {
					const link = `[[${item.path}]]`;
					navigator.clipboard.writeText(link);
					new Notice("Link copied to clipboard");
				});
		});

		menu.showAtMouseEvent(event);
	}

	/**
	 * Show simplified context menu for base notification items.
	 * Limited actions: Open, Open in base view, Exclude, Copy link
	 */
	private showBaseNotificationContextMenu(event: MouseEvent, item: AggregatedNotificationItem): void {
		const menu = new Menu();

		// Open the file
		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Open")
				.setIcon("file")
				.onClick(() => {
					this.handleOpen(item);
				});
		});

		// Open in source base view (if from a base)
		const baseSource = item.sources.find(s => s.type === "base");
		if (baseSource && baseSource.path) {
			menu.addItem((menuItem) => {
				menuItem
					.setTitle(`Open in ${baseSource.name}`)
					.setIcon("database")
					.onClick(async () => {
						const file = this.plugin.app.vault.getAbstractFileByPath(baseSource.path!);
						if (file instanceof TFile) {
							await this.plugin.app.workspace.getLeaf(false).openFile(file);
						}
					});
			});
		}

		menu.addSeparator();

		// Copy link to file
		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Copy link")
				.setIcon("link")
				.onClick(() => {
					const link = `[[${item.path}]]`;
					navigator.clipboard.writeText(link);
					new Notice("Link copied to clipboard");
				});
		});

		// Copy file path
		menu.addItem((menuItem) => {
			menuItem
				.setTitle("Copy path")
				.setIcon("copy")
				.onClick(() => {
					navigator.clipboard.writeText(item.path);
					new Notice("Path copied to clipboard");
				});
		});

		// Show menu at click position
		menu.showAtMouseEvent(event);
	}

	/**
	 * Open the edit task modal for an item.
	 */
	private async handleEditTask(item: AggregatedNotificationItem): Promise<void> {
		const task = await this.plugin.cacheManager.getTaskInfo(item.path);
		if (task) {
			this.plugin.openTaskEditModal(task);
		} else {
			// Fallback: just open the note
			this.handleOpen(item);
		}
	}

	/**
	 * Add assign submenu items for an upcoming view item.
	 */
	private addAssignSubmenu(menu: Menu, item: AggregatedNotificationItem): void {
		// Get current assignees from frontmatter (normalize to array)
		const file = this.plugin.app.vault.getAbstractFileByPath(item.path);
		const frontmatter = file instanceof TFile
			? this.plugin.app.metadataCache.getFileCache(file)?.frontmatter
			: null;
		const globalAssignee2 = this.plugin.settings.assigneeFieldName || "assignee";
		const assigneeFieldName = resolveFieldName("assignee", readFieldOverrides(frontmatter), globalAssignee2);
		const currentAssignee = frontmatter?.[assigneeFieldName];
		const currentAssignees: string[] = Array.isArray(currentAssignee)
			? currentAssignee
			: currentAssignee ? [currentAssignee] : [];

		// Discover persons
		const persons = this.plugin.personNoteService?.discoverPersons() || [];

		// Unassign all option
		if (currentAssignees.length > 0) {
			menu.addItem((subItem: any) => {
				subItem.setTitle("Unassign all");
				subItem.setIcon("user-x");
				subItem.onClick(async () => {
					await this.toggleItemAssignee(item, null, []);
				});
			});
			menu.addSeparator();
		}

		// People
		for (const person of persons) {
			const personPath = person.path.replace(/\.md$/, "");
			const isAssigned = currentAssignees.some(a => a.includes(personPath));

			menu.addItem((subItem: any) => {
				subItem.setTitle(person.displayName);
				subItem.setIcon(isAssigned ? "check" : "user");
				subItem.onClick(async () => {
					await this.toggleItemAssignee(item, person.path, currentAssignees);
				});
			});
		}

		// Groups
		const groups = this.plugin.groupRegistry?.getAllGroups() || [];
		if (groups.length > 0 && persons.length > 0) {
			menu.addSeparator();
		}
		for (const group of groups) {
			const groupPath = group.notePath.replace(/\.md$/, "");
			const isAssigned = currentAssignees.some(a => a.includes(groupPath));

			menu.addItem((subItem: any) => {
				subItem.setTitle(group.displayName);
				subItem.setIcon(isAssigned ? "check" : "users");
				subItem.onClick(async () => {
					await this.toggleItemAssignee(item, group.notePath, currentAssignees);
				});
			});
		}

		if (persons.length === 0 && groups.length === 0) {
			menu.addItem((subItem: any) => {
				subItem.setTitle("No people or groups found");
				subItem.setDisabled(true);
			});
		}
	}

	/**
	 * Toggle an assignee in/out of the assignees list using shortest wikilink format.
	 * Pass filePath=null to clear all assignees.
	 */
	private async toggleItemAssignee(
		item: AggregatedNotificationItem,
		filePath: string | null,
		currentAssignees: string[]
	): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(item.path);
		if (!(file instanceof TFile)) return;
		const fmCache = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		const globalAssignee3 = this.plugin.settings.assigneeFieldName || "assignee";
		const assigneeFieldName = resolveFieldName("assignee", readFieldOverrides(fmCache), globalAssignee3);

		try {
			let actionLabel = "";

			await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
				if (filePath === null) {
					delete fm[assigneeFieldName];
					actionLabel = "unassigned";
					return;
				}

				const targetPath = filePath.replace(/\.md$/, "");
				const alreadyIndex = currentAssignees.findIndex(a => a.includes(targetPath));

				// Generate shortest wikilink
				const targetFile = this.plugin.app.vault.getAbstractFileByPath(filePath);
				const linktext = targetFile instanceof TFile
					? this.plugin.app.metadataCache.fileToLinktext(targetFile, file.path, true)
					: targetPath;
				const wikilink = `[[${linktext}]]`;
				const displayName = this.extractAssigneeNames([wikilink])[0] || linktext;

				if (alreadyIndex >= 0) {
					// Remove this assignee
					const updated = currentAssignees.filter((_, i) => i !== alreadyIndex);
					if (updated.length === 0) {
						delete fm[assigneeFieldName];
					} else if (updated.length === 1) {
						fm[assigneeFieldName] = updated[0];
					} else {
						fm[assigneeFieldName] = updated;
					}
					actionLabel = `Removed ${displayName}`;
				} else {
					// Add this assignee
					const updated = [...currentAssignees, wikilink];
					if (updated.length === 1) {
						fm[assigneeFieldName] = updated[0];
					} else {
						fm[assigneeFieldName] = updated;
					}
					actionLabel = `Added ${displayName}`;
				}
			});

			new Notice(actionLabel || "Updated assignees");
			await this.render();
		} catch (error) {
			this.plugin.debugLog.error("UpcomingView", "Error toggling assignee:", error);
			new Notice("Failed to update assignee");
		}
	}

	/**
	 * Render empty state.
	 */
	private renderEmptyState(doc: Document): void {
		const emptyEl = doc.createElement("div");
		emptyEl.className = "tn-upcoming-empty";

		const iconEl = doc.createElement("div");
		iconEl.className = "tn-upcoming-empty__icon";
		setIcon(iconEl, "check-circle-2");
		emptyEl.appendChild(iconEl);

		const textEl = doc.createElement("div");
		textEl.className = "tn-upcoming-empty__text";
		textEl.textContent = "All caught up!";
		emptyEl.appendChild(textEl);

		const subtextEl = doc.createElement("div");
		subtextEl.className = "tn-upcoming-empty__subtext";
		subtextEl.textContent = "No items need your attention right now.";
		emptyEl.appendChild(subtextEl);

		this.itemsContainer?.appendChild(emptyEl);
	}

	/**
	 * Render error state.
	 */
	renderError(error: Error): void {
		if (!this.itemsContainer) return;
		this.itemsContainer.empty();

		const errorEl = this.itemsContainer.createDiv({ cls: "tn-upcoming-error" });
		errorEl.createEl("p", { text: "Error loading upcoming items:" });
		errorEl.createEl("pre", { text: error.message });
	}

	/**
	 * Handle task update events (required by BasesViewBase).
	 * Re-renders the view when a task is updated.
	 */
	protected async handleTaskUpdate(task: TaskInfo): Promise<void> {
		// Re-render to reflect task changes
		await this.render();
	}

	// Action handlers

	private handleOpen(item: AggregatedNotificationItem, newLeaf = false): void {
		const file = this.plugin.app.vault.getAbstractFileByPath(item.path);
		if (file instanceof TFile) {
			this.plugin.app.workspace.getLeaf(newLeaf).openFile(file);
		}
	}

	/**
	 * Open the source .base file for a base notification item.
	 */
	private handleOpenBase(item: AggregatedNotificationItem, newLeaf = false): void {
		if (item.sourceBasePath) {
			const file = this.plugin.app.vault.getAbstractFileByPath(item.sourceBasePath);
			if (file instanceof TFile) {
				this.plugin.app.workspace.getLeaf(newLeaf).openFile(file);
				return;
			}
		}

		// Fallback: check sources for a base path
		const baseSource = item.sources.find(s => s.type === "base" && s.path && s.path !== "this");
		if (baseSource?.path) {
			const file = this.plugin.app.vault.getAbstractFileByPath(baseSource.path);
			if (file instanceof TFile) {
				this.plugin.app.workspace.getLeaf(newLeaf).openFile(file);
				return;
			}
		}

		// If no base found, just open the item itself
		new Notice("Could not find source base file");
		this.handleOpen(item, newLeaf);
	}

	/**
	 * Snooze a base notification for the specified number of minutes.
	 * Uses BasesQueryWatcher's snooze functionality.
	 */
	private handleSnooze(item: AggregatedNotificationItem, minutes: number): void {
		if (item.sourceBasePath) {
			this.plugin.basesQueryWatcher.snoozeBase(item.sourceBasePath, minutes);
			new Notice(`Snoozed for ${minutes >= 60 ? Math.round(minutes / 60) + " hours" : minutes + " minutes"}`);
			// Re-render to remove the item from view (it's snoozed)
			this.render();
		} else {
			new Notice("Could not snooze: source base not found");
		}
	}

	private async handleComplete(item: AggregatedNotificationItem): Promise<void> {
		if (!item.isTask) return;

		try {
			// Get a completed status from StatusManager
			const completedStatuses = this.plugin.statusManager.getCompletedStatuses();
			if (!completedStatuses || completedStatuses.length === 0) {
				this.plugin.debugLog.warn("UpcomingView", "No completed status found");
				return;
			}

			// Use the first completed status
			const completedStatusValue = completedStatuses[0];

			// Get the task info
			const task = await this.plugin.cacheManager.getTaskInfo(item.path);
			if (task) {
				await this.plugin.taskService.updateTask(task, { status: completedStatusValue });
				// Re-render to remove the completed item
				await this.render();
			}
		} catch (error) {
			this.plugin.debugLog.error("UpcomingView", "Error completing task:", error);
		}
	}

	private async handleReschedule(item: AggregatedNotificationItem): Promise<void> {
		this.plugin.debugLog.log("UpcomingView", `handleReschedule called for: ${item.title}, isTask=${item.isTask}, path=${item.path}`);

		// Only tasks can be rescheduled
		if (!item.isTask) {
			this.plugin.debugLog.log("UpcomingView", "Item is not a task, cannot reschedule");
			new Notice("Only tasks can be rescheduled");
			return;
		}

		// Get the TaskInfo from cache
		this.plugin.debugLog.log("UpcomingView", `Getting TaskInfo from cache for: ${item.path}`);
		const task = await this.plugin.cacheManager.getTaskByPath(item.path);
		if (!task) {
			this.plugin.debugLog.log("UpcomingView", "Could not find task in cache");
			new Notice("Could not find task information");
			return;
		}

		this.plugin.debugLog.log("UpcomingView", `Found task: ${task.title}, opening reschedule modal (target: ${this.groupByDate})`);
		const app = (this as any).app || this.plugin.app;

		if (this.groupByDate === "scheduled") {
			// Use BulkRescheduleModal for a single item targeting scheduled date
			new BulkRescheduleModal(app, [item], this.plugin, () => {
				this.renderContent();
			}, "scheduled").open();
		} else {
			// Open the standard DueDateModal for due date
			new DueDateModal(app, task, this.plugin).open();
		}
	}

	private handleRescheduleAll(items: AggregatedNotificationItem[]): void {
		this.plugin.debugLog.log("UpcomingView", `handleRescheduleAll called with ${items.length} items`);

		// Log each item for debugging
		items.forEach((item, i) => {
			this.plugin.debugLog.log("UpcomingView", `  Item ${i}: ${item.title}, isTask=${item.isTask}, path=${item.path}`);
		});

		// Filter to only regular tasks (exclude base notifications - their timing works differently)
		// Base notification "rescheduling" would mean adjusting "X days after appears", not a due date
		const taskItems = items.filter(item => item.isTask && !item.isBaseNotification);
		this.plugin.debugLog.log("UpcomingView", `Filtered to ${taskItems.length} regular task items (excluded base notifications)`);

		if (taskItems.length === 0) {
			new Notice("No tasks to reschedule");
			return;
		}

		// Open bulk reschedule modal
		this.plugin.debugLog.log("UpcomingView", "Opening BulkRescheduleModal");
		// Use this.app if available (set by Bases), otherwise fall back to plugin.app
		const app = (this as any).app || this.plugin.app;
		new BulkRescheduleModal(app, taskItems, this.plugin, () => {
			// Refresh the view after rescheduling
			this.renderContent();
		}, this.groupByDate).open();
	}

	private handleAddTask(category: ExtendedTimeCategory): void {
		// Calculate default due date based on category
		const now = new Date();
		let dueDate: Date | undefined;

		switch (category) {
			case "overdue":
			case "today":
				dueDate = now;
				break;
			case "tomorrow":
				dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
				break;
			case "thisWeek":
				// End of this week (Sunday)
				const daysUntilSunday = 7 - now.getDay();
				dueDate = new Date(now.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000);
				break;
			case "thisMonth":
				// End of this month
				dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
				break;
			case "noDueDate":
			case "later":
			default:
				dueDate = undefined;
		}

		// Open task creation modal with pre-populated date
		// Use local date components directly to avoid timezone shift from toISOString()
		const dateStr = dueDate
			? `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(dueDate.getDate()).padStart(2, "0")}`
			: undefined;
		const prePopulate = this.groupByDate === "scheduled"
			? { scheduled: dateStr }
			: { due: dateStr };
		this.plugin.openTaskCreationModal(prePopulate);
	}
}

/**
 * Modal for bulk rescheduling multiple tasks at once.
 * Shows a date picker and applies the selected date to all provided tasks.
 *
 * TECHNICAL DEBT: This is a standalone implementation that does NOT use the
 * unified BulkOperationEngine. It directly calls taskService.updateProperty()
 * in a loop. When the bulk engine is implemented, this should be refactored.
 *
 * Known limitations:
 * - Only handles regular TaskNotes (base notifications filtered out upstream)
 * - No weekend-aware quick date options (Next Monday, End of week, etc.)
 * - No mixed item type handling with appropriate per-type actions
 *
 * See: knowledge-base/01-working/bulk-engine-unified-operations.md
 */
class BulkRescheduleModal extends Modal {
	private items: AggregatedNotificationItem[];
	private plugin: TaskNotesPlugin;
	private onComplete: () => void;
	private targetField: "due" | "scheduled";
	private dueDateInput: HTMLInputElement;
	private dueTimeInput: HTMLInputElement;

	constructor(
		app: any,
		items: AggregatedNotificationItem[],
		plugin: TaskNotesPlugin,
		onComplete: () => void,
		targetField: "due" | "scheduled" = "due"
	) {
		super(app);
		this.items = items;
		this.plugin = plugin;
		this.onComplete = onComplete;
		this.targetField = targetField;
	}

	onOpen() {
		this.plugin.debugLog.log("BulkRescheduleModal", `=== MODAL OPENED with ${this.items.length} items ===`);
		this.items.forEach((item, i) => {
			this.plugin.debugLog.log("BulkRescheduleModal", `  Item ${i}: ${item.title}, path: ${item.path}`);
		});

		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-plugin");

		// Title
		this.titleEl.setText(`Reschedule ${this.items.length} task${this.items.length > 1 ? "s" : ""}`);

		// Description
		const dateLabel = this.targetField === "scheduled" ? "scheduled date" : "due date";
		contentEl.createEl("p", {
			text: `Select a new ${dateLabel} for ${this.items.length} task${this.items.length > 1 ? "s" : ""}.`,
			cls: "bulk-reschedule-modal__description",
		});

		// Date and time inputs
		const dateTimeSetting = new Setting(contentEl)
			.setName(this.targetField === "scheduled" ? "New scheduled date" : "New due date")
			.setDesc("All selected tasks will be rescheduled to this date");

		const dateTimeContainer = dateTimeSetting.controlEl.createDiv({
			cls: "modal-form__datetime-container",
		});

		// Date input
		this.dueDateInput = dateTimeContainer.createEl("input", {
			type: "date",
			cls: "modal-form__input modal-form__input--date",
		});
		// Default to today
		this.dueDateInput.value = format(new Date(), "yyyy-MM-dd");

		// Time input (optional)
		this.dueTimeInput = dateTimeContainer.createEl("input", {
			type: "time",
			cls: "modal-form__input modal-form__input--time",
		});

		// Quick date buttons
		const quickDatesContainer = contentEl.createDiv({ cls: "modal-form__group" });
		new Setting(quickDatesContainer).setName("Quick options").setHeading();

		const buttonsContainer = quickDatesContainer.createDiv({
			cls: "modal-form__quick-actions",
		});

		// Today button
		const todayBtn = buttonsContainer.createEl("button", {
			text: "Today",
			cls: "modal-form__button modal-form__button--quick-date",
		});
		todayBtn.addEventListener("click", () => {
			this.dueDateInput.value = format(new Date(), "yyyy-MM-dd");
		});

		// Tomorrow button
		const tomorrowBtn = buttonsContainer.createEl("button", {
			text: "Tomorrow",
			cls: "modal-form__button modal-form__button--quick-date",
		});
		tomorrowBtn.addEventListener("click", () => {
			this.dueDateInput.value = format(add(new Date(), { days: 1 }), "yyyy-MM-dd");
		});

		// Next week button
		const nextWeekBtn = buttonsContainer.createEl("button", {
			text: "Next week",
			cls: "modal-form__button modal-form__button--quick-date",
		});
		nextWeekBtn.addEventListener("click", () => {
			this.dueDateInput.value = format(add(new Date(), { weeks: 1 }), "yyyy-MM-dd");
		});

		// Next month button
		const nextMonthBtn = buttonsContainer.createEl("button", {
			text: "Next month",
			cls: "modal-form__button modal-form__button--quick-date",
		});
		nextMonthBtn.addEventListener("click", () => {
			this.dueDateInput.value = format(add(new Date(), { months: 1 }), "yyyy-MM-dd");
		});

		// Preview of tasks to be rescheduled
		const previewContainer = contentEl.createDiv({ cls: "bulk-reschedule-modal__preview" });
		new Setting(previewContainer).setName("Tasks to reschedule").setHeading();

		const taskList = previewContainer.createEl("ul", { cls: "bulk-reschedule-modal__task-list" });
		const maxPreview = 5;
		const dateSettings: UpcomingViewDateSettings = {
			upcomingViewDateFormat: this.plugin.settings.upcomingViewDateFormat,
			upcomingViewCustomDateFormat: this.plugin.settings.upcomingViewCustomDateFormat,
			upcomingViewUseRelativeDates: this.plugin.settings.upcomingViewUseRelativeDates,
			upcomingViewRelativeDateThreshold: this.plugin.settings.upcomingViewRelativeDateThreshold,
		};
		this.items.slice(0, maxPreview).forEach(item => {
			const li = taskList.createEl("li");
			li.createSpan({ text: item.title, cls: "bulk-reschedule-modal__task-title" });
			const previewDate = this.targetField === "scheduled" ? item.scheduledDate : item.dueDate;
			if (previewDate) {
				const formattedDate = formatDateForUpcomingView(previewDate, dateSettings, true);
				if (formattedDate) {
					li.createSpan({
						text: ` (was: ${formattedDate})`,
						cls: "bulk-reschedule-modal__task-old-date",
					});
				}
			}
		});
		if (this.items.length > maxPreview) {
			taskList.createEl("li", {
				text: `...and ${this.items.length - maxPreview} more`,
				cls: "bulk-reschedule-modal__task-overflow",
			});
		}

		// Action buttons
		const buttonContainer = contentEl.createDiv({ cls: "modal-form__buttons" });

		const saveButton = buttonContainer.createEl("button", {
			text: `Reschedule ${this.items.length} task${this.items.length > 1 ? "s" : ""}`,
			cls: "modal-form__button modal-form__button--primary",
		});
		saveButton.addEventListener("click", () => this.save());

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
			cls: "modal-form__button modal-form__button--secondary",
		});
		cancelButton.addEventListener("click", () => this.close());

		// Focus date input
		setTimeout(() => this.dueDateInput.focus(), 100);

		// Enter key to save
		this.dueDateInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") this.save();
			if (e.key === "Escape") this.close();
		});
	}

	private async save() {
		const dateValue = this.dueDateInput.value.trim();
		const timeValue = this.dueTimeInput.value.trim();

		if (!dateValue) {
			new Notice("Please select a date");
			return;
		}

		// Build the final date value
		const finalValue = timeValue ? combineDateAndTime(dateValue, timeValue) : dateValue;

		// Convert items to BulkItem format
		const bulkItems: BulkItem[] = this.items.map(item => ({
			path: item.path,
			itemType: item.isBaseNotification ? "base-notification" : "tasknote",
			title: item.title,
			dueDate: item.dueDate,
			sourceBase: item.sourceBasePath,
		}));

		// Use unified bulk engine for reschedule — target the correct date field
		const engine = new BulkOperationEngine(this.plugin);
		const rescheduleOptions = this.targetField === "scheduled"
			? { newScheduledDate: finalValue }
			: { newDueDate: finalValue };
		const result = await engine.reschedule(bulkItems, rescheduleOptions);

		// Show result using unified format
		const message = `Rescheduled to ${dateValue}: ${formatResultNotice(result)}`;
		new Notice(message);

		// Log any errors for debugging
		if (result.errors.length > 0) {
			this.plugin.debugLog.warn("BulkReschedule", `Errors: ${result.errors.join(", ")}`);
		}

		this.close();
		this.onComplete();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Factory function for registering with Bases plugin.
 */
export function buildUpcomingViewFactory(plugin: TaskNotesPlugin) {
	return function (controller: any, containerEl: HTMLElement): UpcomingView {
		if (!containerEl) {
			console.error("[TaskNotes][UpcomingView] No containerEl provided");
			throw new Error("UpcomingView requires a containerEl");
		}
		return new UpcomingView(controller, containerEl, plugin);
	};
}
