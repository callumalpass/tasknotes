/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Notice, TFile, setIcon } from "obsidian";
import TaskNotesPlugin from "../main";
import { BasesViewBase } from "./BasesViewBase";
import { TaskInfo } from "../types";
import { identifyTaskNotesFromBasesData, BasesDataItem } from "./helpers";
import { createTaskCard, showTaskContextMenu } from "../ui/TaskCard";
import { renderGroupTitle } from "./groupTitleRenderer";
import { type LinkServices } from "../ui/renderers/linkRenderer";
import { DateContextMenu } from "../components/DateContextMenu";
import { PriorityContextMenu } from "../components/PriorityContextMenu";
import { RecurrenceContextMenu } from "../components/RecurrenceContextMenu";
import { ReminderModal } from "../modals/ReminderModal";
import { getDatePart, getTimePart, parseDateToUTC, createUTCDateFromLocalCalendarDate } from "../utils/dateUtils";
import { VirtualScroller } from "../utils/VirtualScroller";

export class TaskListView extends BasesViewBase {
	type = "tasknotesTaskList";

	private itemsContainer: HTMLElement | null = null;
	private currentTaskElements = new Map<string, HTMLElement>();
	private lastRenderWasGrouped = false;
	private lastFlatPaths: string[] = [];
	private lastTaskSignatures = new Map<string, string>();
	private taskInfoCache = new Map<string, TaskInfo>();
	private clickTimeouts = new Map<string, number>();
	private currentTargetDate = createUTCDateFromLocalCalendarDate(new Date());
	private containerListenersRegistered = false;
	private virtualScroller: VirtualScroller<any> | null = null; // Can render TaskInfo or group headers
	private useVirtualScrolling = false;
	private collapsedGroups = new Set<string>(); // Track collapsed group keys
	private collapsedSubGroups = new Set<string>(); // Track collapsed sub-group keys
	private subGroupPropertyId: string | null = null; // Property ID for sub-grouping
	private configLoaded = false; // Track if we've successfully loaded config

	/**
	 * Threshold for enabling virtual scrolling in task list view.
	 * Virtual scrolling activates when total items (tasks + group headers) >= 100.
	 * Benefits: ~90% memory reduction, eliminates UI lag for large lists.
	 * Lower than KanbanView (30) because task cards are simpler/smaller.
	 */
	private readonly VIRTUAL_SCROLL_THRESHOLD = 100;

	constructor(controller: any, containerEl: HTMLElement, plugin: TaskNotesPlugin) {
		super(controller, containerEl, plugin);
		// BasesView now provides this.data, this.config, and this.app directly
		// Update the data adapter to use this BasesView instance
		(this.dataAdapter as any).basesView = this;
	}

	/**
	 * Component lifecycle: Called when view is first loaded.
	 * Override from Component base class.
	 */
	onload(): void {
		// Read view options now that config is available
		this.readViewOptions();
		// Call parent onload which sets up container and listeners
		super.onload();
	}

	/**
	 * Read view configuration options from BasesViewConfig.
	 */
	private readViewOptions(): void {
		// Guard: config may not be set yet if called too early
		if (!this.config || typeof this.config.get !== 'function') {
			console.debug('[TaskListView] Config not available yet in readViewOptions');
			return;
		}

		try {
			this.subGroupPropertyId = this.config.getAsPropertyId('subGroup');
			// Read enableSearch toggle (default: false for backward compatibility)
			const enableSearchValue = this.config.get('enableSearch');
			this.enableSearch = (enableSearchValue as boolean) ?? false;
			// Mark config as successfully loaded
			this.configLoaded = true;
		} catch (e) {
			// Use defaults
			console.warn('[TaskListView] Failed to parse config:', e);
		}
	}

	protected setupContainer(): void {
		super.setupContainer();

		// Make rootElement fill its container and establish flex context
		if (this.rootElement) {
			this.rootElement.style.cssText = "display: flex; flex-direction: column; height: 100%;";
		}

		// Use correct document for pop-out window support
		const doc = this.containerEl.ownerDocument;

		// Create items container
		const itemsContainer = doc.createElement("div");
		itemsContainer.className = "tn-bases-items-container";
		// Use flex: 1 to fill available space in the rootElement flex container
		// max-height: 100vh prevents unbounded growth when embedded in notes
		// overflow-y: auto provides scrolling when content exceeds available height
		itemsContainer.style.cssText = "margin-top: 12px; flex: 1; max-height: 100vh; overflow-y: auto; position: relative;";
		this.rootElement?.appendChild(itemsContainer);
		this.itemsContainer = itemsContainer;
		this.registerContainerListeners();
	}

	async render(): Promise<void> {
		if (!this.itemsContainer || !this.rootElement) return;

		// Ensure view options are read (in case config wasn't available in onload)
		if (!this.configLoaded && this.config) {
			this.readViewOptions();
		}

		// Now that config is loaded, setup search (idempotent: will only create once)
		if (this.rootElement) {
			this.setupSearch(this.rootElement);
		}

		try {
			// Skip rendering if we have no data yet (prevents flickering during data updates)
			if (!this.data?.data) {
				return;
			}

			// Extract data using adapter (adapter now uses this as basesView)
			const dataItems = this.dataAdapter.extractDataItems();

			// Compute Bases formulas for TaskNotes items
			await this.computeFormulas(dataItems);

			const taskNotes = await identifyTaskNotesFromBasesData(dataItems, this.plugin);

			if (taskNotes.length === 0) {
				this.clearAllTaskElements();
				this.renderEmptyState();
				this.lastRenderWasGrouped = false;
				return;
			}

			const isGrouped = this.dataAdapter.isGrouped();

			// Special case: if sub-grouping is configured but primary grouping is not,
			// treat sub-group property as primary grouping
			if (!isGrouped && this.subGroupPropertyId) {
				if (!this.lastRenderWasGrouped) {
					this.clearAllTaskElements();
				}
				await this.renderGroupedBySubProperty(taskNotes);
				this.lastRenderWasGrouped = true;
			} else if (isGrouped) {
				if (!this.lastRenderWasGrouped) {
					this.clearAllTaskElements();
				}
				await this.renderGrouped(taskNotes);
				this.lastRenderWasGrouped = true;
			} else {
				if (this.lastRenderWasGrouped) {
					this.clearAllTaskElements();
				}
				await this.renderFlat(taskNotes);
				this.lastRenderWasGrouped = false;
			}

			// Check if we have grouped data
		} catch (error: any) {
			console.error("[TaskNotes][TaskListView] Error rendering:", error);
			this.clearAllTaskElements();
			this.renderError(error);
		}
	}

	/**
	 * Compute Bases formulas for TaskNotes items.
	 * This ensures formulas have access to TaskNote-specific properties.
	 */
	private async computeFormulas(dataItems: BasesDataItem[]): Promise<void> {
		// Access formulas through the data context
		const ctxFormulas = (this.data as any)?.ctx?.formulas;
		if (!ctxFormulas || typeof ctxFormulas !== "object" || dataItems.length === 0) {
			return;
		}

		for (let i = 0; i < dataItems.length; i++) {
			const item = dataItems[i];
			const itemFormulaResults = item.basesData?.formulaResults;
			if (!itemFormulaResults?.cachedFormulaOutputs) continue;

			for (const formulaName of Object.keys(ctxFormulas)) {
				const formula = ctxFormulas[formulaName];
				if (formula && typeof formula.getValue === "function") {
					try {
						const baseData = item.basesData;
						const taskProperties = item.properties || {};

						let result;

						// Temporarily merge TaskNote properties into frontmatter for formula access
						if (baseData.frontmatter && Object.keys(taskProperties).length > 0) {
							const originalFrontmatter = baseData.frontmatter;
							baseData.frontmatter = {
								...originalFrontmatter,
								...taskProperties,
							};
							result = formula.getValue(baseData);
							baseData.frontmatter = originalFrontmatter; // Restore original state
						} else {
							result = formula.getValue(baseData);
						}

						// Store computed result for TaskCard rendering
						if (result !== undefined) {
							itemFormulaResults.cachedFormulaOutputs[formulaName] = result;
						}
					} catch (e) {
						// Formulas may fail for various reasons - this is expected
					}
				}
			}
		}
	}

	private async renderFlat(taskNotes: TaskInfo[]): Promise<void> {
		const visibleProperties = this.getVisibleProperties();

		// Apply search filter
		const filteredTasks = this.applySearchFilter(taskNotes);

		// Show "no results" if search returned empty but we had tasks
		if (this.isSearchWithNoResults(filteredTasks, taskNotes.length)) {
			this.clearAllTaskElements();
			if (this.itemsContainer) {
				this.renderSearchNoResults(this.itemsContainer);
			}
			return;
		}

		// Note: taskNotes are already sorted by Bases according to sort configuration
		// No manual sorting needed - Bases provides pre-sorted data

		const targetDate = createUTCDateFromLocalCalendarDate(new Date());
		this.currentTargetDate = targetDate;

		const cardOptions = this.getCardOptions(targetDate);

		// Decide whether to use virtual scrolling based on filtered task count
		const shouldUseVirtualScrolling = filteredTasks.length >= this.VIRTUAL_SCROLL_THRESHOLD;

		if (shouldUseVirtualScrolling && !this.useVirtualScrolling) {
			// Switch to virtual scrolling
			this.cleanupNonVirtualRendering();
			this.useVirtualScrolling = true;
		} else if (!shouldUseVirtualScrolling && this.useVirtualScrolling) {
			// Switch back to normal rendering
			this.destroyVirtualScroller();
			this.useVirtualScrolling = false;
		}

		if (this.useVirtualScrolling) {
			await this.renderFlatVirtual(filteredTasks, visibleProperties, cardOptions);
		} else {
			await this.renderFlatNormal(filteredTasks, visibleProperties, cardOptions);
		}
	}

	private async renderFlatVirtual(
		taskNotes: TaskInfo[],
		visibleProperties: string[] | undefined,
		cardOptions: any
	): Promise<void> {
		if (!this.itemsContainer) return;

		if (!this.virtualScroller) {
			// Initialize virtual scroller with automatic height calculation
			this.virtualScroller = new VirtualScroller<TaskInfo>({
				container: this.itemsContainer,
				items: taskNotes,
				// itemHeight omitted - will be calculated automatically from sample
				overscan: 5,
				renderItem: (taskInfo: TaskInfo, index: number) => {
					// Create card using lazy mode
					const card = createTaskCard(taskInfo, this.plugin, visibleProperties, cardOptions);

					// Cache task info for event handlers
					this.taskInfoCache.set(taskInfo.path, taskInfo);
					this.lastTaskSignatures.set(taskInfo.path, this.buildTaskSignature(taskInfo));

					return card;
				},
				getItemKey: (taskInfo: TaskInfo) => taskInfo.path,
			});

			// Force recalculation after DOM settles
			setTimeout(() => {
				this.virtualScroller?.recalculate();
			}, 0);
		} else {
			// Update existing virtual scroller with new items
			this.virtualScroller.updateItems(taskNotes);
		}

		this.lastFlatPaths = taskNotes.map((task) => task.path);
	}

	private async renderFlatNormal(
		taskNotes: TaskInfo[],
		visibleProperties: string[] | undefined,
		cardOptions: any
	): Promise<void> {
		if (!this.itemsContainer) return;

		const seenPaths = new Set<string>();
		const orderChanged = !this.arePathArraysEqual(taskNotes, this.lastFlatPaths);

		if (orderChanged) {
			this.itemsContainer.empty();
			this.currentTaskElements.clear();
		}

		for (const taskInfo of taskNotes) {
			let cardEl = orderChanged ? null : this.currentTaskElements.get(taskInfo.path) || null;
			const signature = this.buildTaskSignature(taskInfo);
			const previousSignature = this.lastTaskSignatures.get(taskInfo.path);
			const needsUpdate = signature !== previousSignature || !cardEl;

			if (!cardEl || needsUpdate) {
				const newCard = createTaskCard(
					taskInfo,
					this.plugin,
					visibleProperties,
					cardOptions
				);
				if (cardEl && cardEl.isConnected) {
					cardEl.replaceWith(newCard);
				}
				cardEl = newCard;
			}

			if (!cardEl!.isConnected) {
				this.itemsContainer!.appendChild(cardEl!);
			}

			this.currentTaskElements.set(taskInfo.path, cardEl!);
			this.taskInfoCache.set(taskInfo.path, taskInfo);
			this.lastTaskSignatures.set(taskInfo.path, signature);
			seenPaths.add(taskInfo.path);
		}

		if (!orderChanged && seenPaths.size !== this.currentTaskElements.size) {
			for (const [path, el] of this.currentTaskElements) {
				if (!seenPaths.has(path)) {
					el.remove();
					this.currentTaskElements.delete(path);

					// Clean up related state in the same pass
					const timeout = this.clickTimeouts.get(path);
					if (timeout) {
						clearTimeout(timeout);
						this.clickTimeouts.delete(path);
					}
					this.taskInfoCache.delete(path);
					this.lastTaskSignatures.delete(path);
				}
			}
		}

		this.lastFlatPaths = taskNotes.map((task) => task.path);
	}

	/**
	 * Build flattened list of render items (headers + tasks) for grouped view
	 * Shared between renderGrouped() and refreshGroupedView()
	 */
	private buildGroupedRenderItems(groups: any[], taskNotes: TaskInfo[]): any[] {
		type RenderItem =
			| { type: 'primary-header'; groupKey: string; groupTitle: string; taskCount: number; groupEntries: any[]; isCollapsed: boolean }
			| { type: 'sub-header'; groupKey: string; subGroupKey: string; subGroupTitle: string; taskCount: number; isCollapsed: boolean; parentKey: string }
			| { type: 'task'; task: TaskInfo; groupKey: string; subGroupKey?: string };

		const items: RenderItem[] = [];

		// Build property map for sub-grouping if needed
		const pathToProps = this.subGroupPropertyId ? this.buildPathToPropsMap() : new Map();

		for (const group of groups) {
			const primaryKey = this.dataAdapter.convertGroupKeyToString(group.key);
			const groupPaths = new Set(group.entries.map((e: any) => e.file.path));
			const groupTasks = taskNotes.filter((t) => groupPaths.has(t.path));

			// Skip groups with no matching tasks (e.g., after search filtering)
			if (groupTasks.length === 0) continue;

			const isPrimaryCollapsed = this.collapsedGroups.has(primaryKey);

			// Add primary header
			items.push({
				type: 'primary-header',
				groupKey: primaryKey,
				groupTitle: primaryKey,
				taskCount: groupTasks.length,
				groupEntries: group.entries,
				isCollapsed: isPrimaryCollapsed
			});

			// If primary group is not collapsed, add sub-groups or tasks
			if (!isPrimaryCollapsed) {
				if (this.subGroupPropertyId) {
					// Sub-grouping enabled: create nested structure
					const subGroups = this.groupTasksBySubProperty(groupTasks, this.subGroupPropertyId, pathToProps);

					for (const [subKey, subTasks] of subGroups) {
						// Filter out empty sub-groups
						if (subTasks.length === 0) continue;

						const compoundKey = `${primaryKey}:${subKey}`;
						const isSubCollapsed = this.collapsedSubGroups.has(compoundKey);

						// Add sub-header
						items.push({
							type: 'sub-header',
							groupKey: primaryKey,
							subGroupKey: subKey,
							subGroupTitle: subKey,
							taskCount: subTasks.length,
							isCollapsed: isSubCollapsed,
							parentKey: primaryKey
						});

						// Add tasks if sub-group is not collapsed
						if (!isSubCollapsed) {
							for (const task of subTasks) {
								items.push({ type: 'task', task, groupKey: primaryKey, subGroupKey: subKey });
							}
						}
					}
				} else {
					// No sub-grouping: add tasks directly
					for (const task of groupTasks) {
						items.push({ type: 'task', task, groupKey: primaryKey });
					}
				}
			}
		}

		return items;
	}

	/**
	 * Render tasks grouped by sub-property (when no primary grouping is configured).
	 * This treats the sub-group property as primary grouping.
	 */
	private async renderGroupedBySubProperty(taskNotes: TaskInfo[]): Promise<void> {
		const visibleProperties = this.getVisibleProperties();

		// Apply search filter
		const filteredTasks = this.applySearchFilter(taskNotes);

		// Show "no results" if search returned empty but we had tasks
		if (this.isSearchWithNoResults(filteredTasks, taskNotes.length)) {
			this.clearAllTaskElements();
			if (this.itemsContainer) {
				this.renderSearchNoResults(this.itemsContainer);
			}
			return;
		}

		const targetDate = createUTCDateFromLocalCalendarDate(new Date());
		this.currentTargetDate = targetDate;
		const cardOptions = this.getCardOptions(targetDate);

		// Group tasks by sub-property
		const pathToProps = this.buildPathToPropsMap();
		const groupedTasks = this.groupTasksBySubProperty(filteredTasks, this.subGroupPropertyId!, pathToProps);

		// Build flat items array (treat sub-groups as primary groups)
		type RenderItem =
			| { type: 'primary-header'; groupKey: string; groupTitle: string; taskCount: number; groupEntries: any[]; isCollapsed: boolean }
			| { type: 'task'; task: TaskInfo; groupKey: string };

		const items: RenderItem[] = [];
		for (const [groupKey, tasks] of groupedTasks) {
			// Skip empty groups
			if (tasks.length === 0) continue;

			const isCollapsed = this.collapsedGroups.has(groupKey);

			items.push({
				type: 'primary-header',
				groupKey,
				groupTitle: groupKey,
				taskCount: tasks.length,
				groupEntries: [], // No group entries from Bases
				isCollapsed
			});

			if (!isCollapsed) {
				for (const task of tasks) {
					items.push({ type: 'task', task, groupKey });
				}
			}
		}

		// Decide whether to use virtual scrolling
		const shouldUseVirtualScrolling = items.length >= this.VIRTUAL_SCROLL_THRESHOLD;

		// Switch rendering mode if needed
		if (this.useVirtualScrolling && shouldUseVirtualScrolling && this.virtualScroller) {
			this.virtualScroller.updateItems(items);
			this.lastFlatPaths = taskNotes.map((task) => task.path);
			return;
		}

		// Full render needed
		this.itemsContainer!.empty();
		this.currentTaskElements.clear();
		this.clearClickTimeouts();
		this.taskInfoCache.clear();
		this.lastTaskSignatures.clear();

		if (shouldUseVirtualScrolling && !this.useVirtualScrolling) {
			this.cleanupNonVirtualRendering();
			this.useVirtualScrolling = true;
		} else if (!shouldUseVirtualScrolling && this.useVirtualScrolling) {
			this.destroyVirtualScroller();
			this.useVirtualScrolling = false;
		}

		if (this.useVirtualScrolling) {
			await this.renderGroupedVirtual(items, visibleProperties, cardOptions);
		} else {
			await this.renderGroupedNormal(items, visibleProperties, cardOptions);
		}

		this.lastFlatPaths = taskNotes.map((task) => task.path);
	}

	private async renderGrouped(taskNotes: TaskInfo[]): Promise<void> {
		const visibleProperties = this.getVisibleProperties();
		const groups = this.dataAdapter.getGroupedData();

		// Apply search filter
		const filteredTasks = this.applySearchFilter(taskNotes);

		// Show "no results" if search returned empty but we had tasks
		if (this.isSearchWithNoResults(filteredTasks, taskNotes.length)) {
			this.clearAllTaskElements();
			if (this.itemsContainer) {
				this.renderSearchNoResults(this.itemsContainer);
			}
			return;
		}

		const targetDate = createUTCDateFromLocalCalendarDate(new Date());
		this.currentTargetDate = targetDate;
		const cardOptions = this.getCardOptions(targetDate);

		// Build flattened list of items using shared method
		const items = this.buildGroupedRenderItems(groups, filteredTasks);

		// Use virtual scrolling if we have many items
		const shouldUseVirtualScrolling = items.length >= this.VIRTUAL_SCROLL_THRESHOLD;

		// If already using virtual scrolling and still need it, just update items
		if (this.useVirtualScrolling && shouldUseVirtualScrolling && this.virtualScroller) {
			this.virtualScroller.updateItems(items);
			this.lastFlatPaths = taskNotes.map((task) => task.path);
			return;
		}

		// Otherwise, need to switch rendering mode or initial render
		this.itemsContainer!.empty();
		this.currentTaskElements.clear();
		this.clearClickTimeouts();
		this.taskInfoCache.clear();
		this.lastTaskSignatures.clear();

		if (shouldUseVirtualScrolling && !this.useVirtualScrolling) {
			this.cleanupNonVirtualRendering();
			this.useVirtualScrolling = true;
		} else if (!shouldUseVirtualScrolling && this.useVirtualScrolling) {
			this.destroyVirtualScroller();
			this.useVirtualScrolling = false;
		}

		if (this.useVirtualScrolling) {
			await this.renderGroupedVirtual(items, visibleProperties, cardOptions);
		} else {
			await this.renderGroupedNormal(items, visibleProperties, cardOptions);
		}

		this.lastFlatPaths = taskNotes.map((task) => task.path);
	}

	private async renderGroupedVirtual(
		items: any[],
		visibleProperties: string[] | undefined,
		cardOptions: any
	): Promise<void> {
		if (!this.virtualScroller) {
			this.virtualScroller = new VirtualScroller<any>({
				container: this.itemsContainer!,
				items: items,
				// itemHeight omitted - automatically calculated from sample (headers + cards)
				overscan: 5,
				renderItem: (item: any) => {
					if (item.type === 'primary-header' || item.type === 'sub-header') {
						return this.createGroupHeader(item);
					} else {
						const cardEl = createTaskCard(item.task, this.plugin, visibleProperties, cardOptions);
						this.taskInfoCache.set(item.task.path, item.task);
						this.lastTaskSignatures.set(item.task.path, this.buildTaskSignature(item.task));
						return cardEl;
					}
				},
				getItemKey: (item: any) => {
					if (item.type === 'primary-header') {
						return `primary-${item.groupKey}`;
					} else if (item.type === 'sub-header') {
						return `sub-${item.groupKey}:${item.subGroupKey}`;
					} else {
						return item.task.path;
					}
				},
			});

			setTimeout(() => {
				this.virtualScroller?.recalculate();
			}, 0);
		} else {
			this.virtualScroller.updateItems(items);
		}
	}

	private async renderGroupedNormal(
		items: any[],
		visibleProperties: string[] | undefined,
		cardOptions: any
	): Promise<void> {
		for (const item of items) {
			if (item.type === 'primary-header' || item.type === 'sub-header') {
				const headerEl = this.createGroupHeader(item);
				this.itemsContainer!.appendChild(headerEl);
			} else {
				const cardEl = createTaskCard(item.task, this.plugin, visibleProperties, cardOptions);
				this.itemsContainer!.appendChild(cardEl);
				this.currentTaskElements.set(item.task.path, cardEl);
				this.taskInfoCache.set(item.task.path, item.task);
				this.lastTaskSignatures.set(item.task.path, this.buildTaskSignature(item.task));
			}
		}
	}

	private createGroupHeader(headerItem: any): HTMLElement {
		// Use correct document for pop-out window support
		const doc = this.containerEl.ownerDocument;

		const groupHeader = doc.createElement("div");
		groupHeader.className = "task-section task-group";

		// Determine header level and set appropriate data attributes
		const isSubHeader = headerItem.type === 'sub-header';
		const level = isSubHeader ? 'sub' : 'primary';
		groupHeader.dataset.level = level;

		if (isSubHeader) {
			groupHeader.dataset.groupKey = `${headerItem.groupKey}:${headerItem.subGroupKey}`;
			groupHeader.dataset.parentKey = headerItem.parentKey;
		} else {
			groupHeader.dataset.groupKey = headerItem.groupKey;
		}

		// Apply collapsed state
		if (headerItem.isCollapsed) {
			groupHeader.classList.add("is-collapsed");
		}

		const headerElement = doc.createElement("h3");
		headerElement.className = "task-group-header task-list-view__group-header";
		groupHeader.appendChild(headerElement);

		// Add toggle button
		const toggleBtn = doc.createElement("button");
		toggleBtn.className = "task-group-toggle";
		toggleBtn.setAttribute("aria-label", "Toggle group");
		toggleBtn.setAttribute("aria-expanded", String(!headerItem.isCollapsed));
		toggleBtn.dataset.groupKey = groupHeader.dataset.groupKey!;
		headerElement.appendChild(toggleBtn);

		// Add chevron icon
		setIcon(toggleBtn, "chevron-right");
		const svg = toggleBtn.querySelector("svg");
		if (svg) {
			svg.classList.add("chevron");
			svg.setAttribute("width", "16");
			svg.setAttribute("height", "16");
		}

		// Add group title
		const titleContainer = headerElement.createSpan({ cls: "task-group-title" });
		const displayTitle = isSubHeader ? headerItem.subGroupTitle : headerItem.groupTitle;
		this.renderGroupTitle(titleContainer, displayTitle);

		// Add count
		headerElement.createSpan({
			text: ` (${headerItem.taskCount})`,
			cls: "agenda-view__item-count",
		});

		return groupHeader;
	}

	protected async handleTaskUpdate(task: TaskInfo): Promise<void> {
		// Update cache
		this.taskInfoCache.set(task.path, task);
		this.lastTaskSignatures.set(task.path, this.buildTaskSignature(task));

		// For virtual scrolling, just do a full refresh
		// Simple and reliable, performance is still good with virtual scrolling
		if (this.useVirtualScrolling) {
			this.debouncedRefresh();
		} else {
			// Normal mode - update the specific card
			const existingElement = this.currentTaskElements.get(task.path);
			if (existingElement && existingElement.isConnected) {
				const visibleProperties = this.getVisibleProperties();
				const replacement = createTaskCard(task, this.plugin, visibleProperties, this.getCardOptions(this.currentTargetDate));
				existingElement.replaceWith(replacement);
				replacement.classList.add("task-card--updated");
				// Use correct window for pop-out window support
				const win = this.containerEl.ownerDocument.defaultView || window;
				win.setTimeout(() => {
					replacement.classList.remove("task-card--updated");
				}, 1000);
				this.currentTaskElements.set(task.path, replacement);
			} else {
				this.debouncedRefresh();
			}
		}
	}

	private renderEmptyState(): void {
		// Use correct document for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const emptyEl = doc.createElement("div");
		emptyEl.className = "tn-bases-empty";
		emptyEl.style.cssText = "padding: 20px; text-align: center; color: #666;";
		emptyEl.textContent = "No TaskNotes tasks found for this Base.";
		this.itemsContainer!.appendChild(emptyEl);
	}

	renderError(error: Error): void {
		// Use correct document for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const errorEl = doc.createElement("div");
		errorEl.className = "tn-bases-error";
		errorEl.style.cssText =
			"padding: 20px; color: #d73a49; background: #ffeaea; border-radius: 4px; margin: 10px 0;";
		errorEl.textContent = `Error loading tasks: ${error.message || "Unknown error"}`;
		this.itemsContainer!.appendChild(errorEl);
	}

	/**
	 * Render group title using shared utility.
	 * Uses this.app from BasesView (with fallback to plugin.app for safety).
	 */
	private renderGroupTitle(container: HTMLElement, title: string): void {
		// Use this.app if available (set by Bases), otherwise fall back to plugin.app
		const app = this.app || this.plugin.app;

		const linkServices: LinkServices = {
			metadataCache: app.metadataCache,
			workspace: app.workspace,
		};

		renderGroupTitle(container, title, linkServices);
	}

	/**
	 * Component lifecycle: Called when component is unloaded.
	 * Override from Component base class.
	 */
	onunload(): void {
		// Component.register() calls will be automatically cleaned up (including search cleanup)
		// We just need to clean up view-specific state
		this.unregisterContainerListeners();
		this.destroyVirtualScroller();

		this.currentTaskElements.clear();
		this.itemsContainer = null;
		this.lastRenderWasGrouped = false;
		this.clearClickTimeouts();
		this.taskInfoCache.clear();
		this.lastTaskSignatures.clear();
		this.lastFlatPaths = [];
		this.useVirtualScrolling = false;
		this.collapsedGroups.clear();
		this.collapsedSubGroups.clear();
	}

	/**
	 * Get ephemeral state to preserve across view reloads.
	 * Saves scroll position, collapsed groups, and collapsed sub-groups.
	 */
	getEphemeralState(): any {
		return {
			scrollTop: this.rootElement?.scrollTop || 0,
			collapsedGroups: Array.from(this.collapsedGroups),
			collapsedSubGroups: Array.from(this.collapsedSubGroups),
		};
	}

	/**
	 * Restore ephemeral state after view reload.
	 * Restores scroll position, collapsed groups, and collapsed sub-groups.
	 */
	setEphemeralState(state: any): void {
		if (!state) return;

		// Restore collapsed groups immediately
		if (state.collapsedGroups && Array.isArray(state.collapsedGroups)) {
			this.collapsedGroups = new Set(state.collapsedGroups);
		}

		// Restore collapsed sub-groups immediately
		if (state.collapsedSubGroups && Array.isArray(state.collapsedSubGroups)) {
			this.collapsedSubGroups = new Set(state.collapsedSubGroups);
		}

		// Restore scroll position after render completes
		if (state.scrollTop !== undefined && this.rootElement) {
			// Use requestAnimationFrame to ensure DOM is ready
			requestAnimationFrame(() => {
				if (this.rootElement && this.rootElement.isConnected) {
					this.rootElement.scrollTop = state.scrollTop;
				}
			});
		}
	}

	private clearAllTaskElements(): void {
		if (this.useVirtualScrolling) {
			this.destroyVirtualScroller();
			this.useVirtualScrolling = false;
		}
		this.itemsContainer?.empty();
		this.currentTaskElements.forEach((el) => el.remove());
		this.currentTaskElements.clear();
		this.lastFlatPaths = [];
		this.lastTaskSignatures.clear();
		this.taskInfoCache.clear();
		this.clearClickTimeouts();
	}

	private getCardOptions(targetDate: Date) {
		return {
			targetDate,
		};
	}

	private clearClickTimeouts(): void {
		for (const timeout of this.clickTimeouts.values()) {
			if (timeout) {
				clearTimeout(timeout);
			}
		}
		this.clickTimeouts.clear();
	}

	private registerContainerListeners(): void {
		if (!this.itemsContainer || this.containerListenersRegistered) return;

		// Register click listener for group header collapse/expand using Component API
		// This automatically cleans up on component unload
		this.registerDomEvent(this.itemsContainer, "click", this.handleItemClick);
		this.containerListenersRegistered = true;
	}

	private unregisterContainerListeners(): void {
		// No manual cleanup needed - Component.registerDomEvent handles it automatically
		this.containerListenersRegistered = false;
	}

	private getTaskContextFromEvent(event: Event): { task: TaskInfo; card: HTMLElement } | null {
		const target = event.target as HTMLElement | null;
		if (!target) return null;
		const card = target.closest<HTMLElement>(".task-card");
		if (!card) return null;
		const path = card.dataset.taskPath;
		if (!path) return null;
		const task = this.taskInfoCache.get(path);
		if (!task) return null;
		return { task, card };
	}

	private handleItemClick = async (event: MouseEvent) => {
		const target = event.target as HTMLElement;

		// ONLY handle group header clicks - task cards handle their own clicks
		const groupHeader = target.closest<HTMLElement>(".task-group-header");
		if (groupHeader) {
			const groupSection = groupHeader.closest<HTMLElement>(".task-group");
			const groupKey = groupSection?.dataset.groupKey;

			if (groupKey) {
				// Don't toggle if clicking on a link
				if (target.closest("a")) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();
				await this.handleGroupToggle(groupKey);
				return;
			}
		}

		// Don't handle task card clicks here - they have their own handlers
		// This prevents double-firing when clicking on tasks
	};

	private async handleGroupToggle(groupKey: string): Promise<void> {
		// Detect if this is a sub-group toggle (compound key contains colon)
		const isSubGroup = groupKey.includes(':');

		if (isSubGroup) {
			// Toggle sub-group collapsed state
			if (this.collapsedSubGroups.has(groupKey)) {
				this.collapsedSubGroups.delete(groupKey);
			} else {
				this.collapsedSubGroups.add(groupKey);
			}
		} else {
			// Toggle primary group collapsed state
			if (this.collapsedGroups.has(groupKey)) {
				this.collapsedGroups.delete(groupKey);
			} else {
				this.collapsedGroups.add(groupKey);
			}
		}

		// Rebuild items and update virtual scroller without full re-render
		if (this.lastRenderWasGrouped) {
			await this.refreshGroupedView();
		}
	}

	private async refreshGroupedView(): Promise<void> {
		if (!this.data?.data) return;

		const dataItems = this.dataAdapter.extractDataItems();
		await this.computeFormulas(dataItems);
		const taskNotes = await identifyTaskNotesFromBasesData(dataItems, this.plugin);
		const groups = this.dataAdapter.getGroupedData();

		// Build flattened list of items using shared method
		const items = this.buildGroupedRenderItems(groups, taskNotes);

		// Update virtual scroller with new items
		if (this.useVirtualScrolling && this.virtualScroller) {
			this.virtualScroller.updateItems(items);
		} else {
			// If not using virtual scrolling, do full render
			await this.render();
		}
	}

	private handleItemContextMenu = async (event: MouseEvent) => {
		const context = this.getTaskContextFromEvent(event);
		if (!context) return;
		event.preventDefault();
		event.stopPropagation();

		// If multiple tasks are selected, show batch context menu
		const selectionService = this.plugin.taskSelectionService;
		if (selectionService && selectionService.getSelectionCount() > 1) {
			// Ensure the right-clicked task is in the selection
			if (!selectionService.isSelected(context.task.path)) {
				selectionService.addToSelection(context.task.path);
			}
			this.showBatchContextMenu(event);
			return;
		}

		await showTaskContextMenu(event, context.task.path, this.plugin, this.currentTargetDate);
	};

	private handleItemPointerOver = (event: PointerEvent) => {
		if ("pointerType" in event && event.pointerType !== "mouse") {
			return;
		}
		const context = this.getTaskContextFromEvent(event);
		if (!context) return;

		const related = event.relatedTarget as HTMLElement | null;
		if (related && context.card.contains(related)) {
			return;
		}

		const app = this.app || this.plugin.app;
		const file = app.vault.getAbstractFileByPath(context.task.path);
		if (file) {
			app.workspace.trigger("hover-link", {
				event: event as MouseEvent,
				source: "tasknotes-task-card",
				hoverParent: context.card,
				targetEl: context.card,
				linktext: context.task.path,
				sourcePath: context.task.path,
			});
		}
	};

	private async handleActionClick(
		action: string,
		task: TaskInfo,
		target: HTMLElement,
		event: MouseEvent
	): Promise<void> {
		switch (action) {
			case "toggle-status":
				await this.handleToggleStatus(task, event);
				return;
			case "priority-menu":
				this.showPriorityMenu(task, event);
				return;
			case "recurrence-menu":
				this.showRecurrenceMenu(task, event);
				return;
			case "reminder-menu":
				this.showReminderModal(task);
				return;
			case "task-context-menu":
				await showTaskContextMenu(event, task.path, this.plugin, this.getTaskActionDate(task));
				return;
			case "edit-date":
				await this.openDateContextMenu(task, target.dataset.tnDateType as "due" | "scheduled" | undefined, event);
				return;
			case "filter-project-subtasks":
				await this.filterProjectSubtasks(task);
				return;
			case "toggle-subtasks":
				await this.toggleSubtasks(task, target);
				return;
			case "toggle-blocking-tasks":
				await this.toggleBlockingTasks(task, target);
				return;
			default:
				await this.handleCardClick(task, event);
		}
	}

	private async handleToggleStatus(task: TaskInfo, event: MouseEvent): Promise<void> {
		try {
			if (task.recurrence) {
				const actionDate = this.getTaskActionDate(task);
				await this.plugin.toggleRecurringTaskComplete(task, actionDate);
			} else {
				await this.plugin.toggleTaskStatus(task);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("[TaskNotes][TaskListView] Failed to toggle status", {
				error: message,
				taskPath: task.path,
			});
			new Notice(`Failed to toggle task status: ${message}`);
		}
	}

	/**
	 * Determine the date to use when completing a recurring task from Bases.
	 * Prefers the task's scheduled (or due) date to avoid marking the wrong instance.
	 */
	private getTaskActionDate(task: TaskInfo): Date {
		const dateStr = getDatePart(task.scheduled || task.due || "");
		if (dateStr) {
			return parseDateToUTC(dateStr);
		}

		return this.currentTargetDate;
	}

	private showPriorityMenu(task: TaskInfo, event: MouseEvent): void {
		const menu = new PriorityContextMenu({
			currentValue: task.priority,
			onSelect: async (newPriority) => {
				try {
					await this.plugin.updateTaskProperty(task, "priority", newPriority);
				} catch (error) {
					console.error("[TaskNotes][TaskListView] Failed to update priority", error);
					new Notice("Failed to update priority");
				}
			},
			plugin: this.plugin,
		});
		menu.show(event);
	}

	private showRecurrenceMenu(task: TaskInfo, event: MouseEvent): void {
		const menu = new RecurrenceContextMenu({
			currentValue: typeof task.recurrence === "string" ? task.recurrence : undefined,
			currentAnchor: task.recurrence_anchor || 'scheduled',
			onSelect: async (newRecurrence: string | null, anchor?: 'scheduled' | 'completion') => {
				try {
					await this.plugin.updateTaskProperty(
						task,
						"recurrence",
						newRecurrence || undefined
					);
					if (anchor !== undefined) {
						await this.plugin.updateTaskProperty(
							task,
							"recurrence_anchor",
							anchor
						);
					}
				} catch (error) {
					console.error("[TaskNotes][TaskListView] Failed to update recurrence", error);
					new Notice("Failed to update recurrence");
				}
			},
			app: this.plugin.app,
			plugin: this.plugin,
		});
		menu.show(event);
	}

	private showReminderModal(task: TaskInfo): void {
		const modal = new ReminderModal(this.plugin.app, this.plugin, task, async (reminders) => {
			try {
				await this.plugin.updateTaskProperty(
					task,
					"reminders",
					reminders.length > 0 ? reminders : undefined
				);
			} catch (error) {
				console.error("[TaskNotes][TaskListView] Failed to update reminders", error);
				new Notice("Failed to update reminders");
			}
		});
		modal.open();
	}

	private async openDateContextMenu(
		task: TaskInfo,
		dateType: "due" | "scheduled" | undefined,
		event: MouseEvent
	): Promise<void> {
		if (!dateType) return;
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
					await this.plugin.updateTaskProperty(task, dateType, finalValue);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					console.error("[TaskNotes][TaskListView] Failed to update date", {
						error: message,
						taskPath: task.path,
						dateType,
					});
					new Notice(`Failed to update ${dateType} date: ${message}`);
				}
			},
			plugin: this.plugin,
			app: this.app || this.plugin.app,
		});
		menu.show(event);
	}

	private async handleCardClick(task: TaskInfo, event: MouseEvent): Promise<void> {
		// Check if this is a selection click (shift/ctrl/cmd or in selection mode)
		if (this.handleSelectionClick(event, task.path)) {
			return;
		}

		if (this.plugin.settings.doubleClickAction === "none") {
			await this.executeSingleClickAction(task, event);
			return;
		}

		const existingTimeout = this.clickTimeouts.get(task.path);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
			this.clickTimeouts.delete(task.path);
			await this.executeDoubleClickAction(task, event);
		} else {
			// Use correct window for pop-out window support
			const win = this.containerEl.ownerDocument.defaultView || window;
			const timeout = win.setTimeout(async () => {
				this.clickTimeouts.delete(task.path);
				await this.executeSingleClickAction(task, event);
			}, 250);
			this.clickTimeouts.set(task.path, timeout);
		}
	}

	private async executeSingleClickAction(task: TaskInfo, event: MouseEvent): Promise<void> {
		if (event.ctrlKey || event.metaKey) {
			this.openTaskNote(task, true);
			return;
		}

		switch (this.plugin.settings.singleClickAction) {
			case "edit":
				await this.editTask(task);
				break;
			case "openNote":
				this.openTaskNote(task, false);
				break;
			default:
				break;
		}
	}

	private async executeDoubleClickAction(task: TaskInfo, event: MouseEvent): Promise<void> {
		switch (this.plugin.settings.doubleClickAction) {
			case "edit":
				await this.editTask(task);
				break;
			case "openNote":
				this.openTaskNote(task, false);
				break;
			default:
				break;
		}
	}

	private async editTask(task: TaskInfo): Promise<void> {
		await this.plugin.openTaskEditModal(task);
	}

	private openTaskNote(task: TaskInfo, newTab: boolean): void {
		const app = this.app || this.plugin.app;
		const file = app.vault.getAbstractFileByPath(task.path);
		if (file instanceof TFile) {
			if (newTab) {
				app.workspace.openLinkText(task.path, "", true);
			} else {
				app.workspace.getLeaf(false).openFile(file);
			}
		}
	}

	private async filterProjectSubtasks(task: TaskInfo): Promise<void> {
		try {
			await this.plugin.applyProjectSubtaskFilter(task);
		} catch (error) {
			console.error("[TaskNotes][TaskListView] Failed to filter project subtasks", error);
			new Notice("Failed to filter project subtasks");
		}
	}

	private async toggleSubtasks(task: TaskInfo, target: HTMLElement): Promise<void> {
		try {
			if (!this.plugin.expandedProjectsService) {
				console.error("[TaskNotes][TaskListView] ExpandedProjectsService not initialized");
				new Notice("Service not available. Please try reloading the plugin.");
				return;
			}

			const newExpanded = this.plugin.expandedProjectsService.toggle(task.path);
			target.classList.toggle("task-card__chevron--expanded", newExpanded);
			target.setAttribute(
				"aria-label",
				newExpanded ? "Collapse subtasks" : "Expand subtasks"
			);

			// Find the card element and toggle subtasks display
			const card = target.closest<HTMLElement>(".task-card");
			if (card) {
				const { toggleSubtasks } = await import("../ui/TaskCard");
				await toggleSubtasks(card, task, this.plugin, newExpanded);
			}
		} catch (error) {
			console.error("[TaskNotes][TaskListView] Failed to toggle subtasks", error);
			new Notice("Failed to toggle subtasks");
		}
	}

	private async toggleBlockingTasks(task: TaskInfo, target: HTMLElement): Promise<void> {
		try {
			const expanded = target.classList.toggle("task-card__blocking-toggle--expanded");

			// Find the card element and toggle blocking tasks display
			const card = target.closest<HTMLElement>(".task-card");
			if (card) {
				const { toggleBlockingTasks } = await import("../ui/TaskCard");
				await toggleBlockingTasks(card, task, this.plugin, expanded);
			}
		} catch (error) {
			console.error("[TaskNotes][TaskListView] Failed to toggle blocking tasks", error);
			new Notice("Failed to toggle blocking tasks");
		}
	}

	private arePathArraysEqual(taskNotes: TaskInfo[], previousPaths: string[]): boolean {
		if (taskNotes.length !== previousPaths.length) return false;
		for (let i = 0; i < taskNotes.length; i++) {
			if (taskNotes[i].path !== previousPaths[i]) return false;
		}
		return true;
	}

	private cleanupNonVirtualRendering(): void {
		this.itemsContainer?.empty();
		this.currentTaskElements.clear();
		this.clearClickTimeouts();
	}

	private destroyVirtualScroller(): void {
		if (this.virtualScroller) {
			this.virtualScroller.destroy();
			this.virtualScroller = null;
		}
	}

	/**
	 * Build a map of task path -> properties for fast lookup during grouping.
	 * Similar to KanbanView's pattern for swimlane grouping.
	 * Includes both regular properties and formula results.
	 */
	private buildPathToPropsMap(): Map<string, Record<string, any>> {
		const map = new Map<string, Record<string, any>>();
		if (!this.data?.data) return map;

		const dataItems = this.dataAdapter.extractDataItems();
		for (const item of dataItems) {
			if (item.path) {
				// Merge regular properties with formula results
				const props = { ...(item.properties || {}) };

				// Add formula results if available
				const formulaOutputs = item.basesData?.formulaResults?.cachedFormulaOutputs;
				if (formulaOutputs && typeof formulaOutputs === 'object') {
					for (const [formulaName, value] of Object.entries(formulaOutputs)) {
						// Store with formula. prefix for easy lookup
						props[`formula.${formulaName}`] = value;
					}
				}

				map.set(item.path, props);
			}
		}
		return map;
	}

	/**
	 * Get property value from properties object using property ID.
	 * Handles TaskInfo properties, Bases property IDs (note.*, task.*, file.*), and formulas (formula.*).
	 */
	private getPropertyValue(props: Record<string, any>, propertyId: string): any {
		if (!propertyId) return null;

		// Formula properties are stored with their full prefix (formula.NAME)
		if (propertyId.startsWith('formula.')) {
			return props[propertyId] ?? null;
		}

		// Strip prefix (note., task., file.) from property ID
		const cleanPropertyId = propertyId.replace(/^(note\.|task\.|file\.)/, '');

		// Get value from properties
		return props[cleanPropertyId] ?? null;
	}

	/**
	 * Convert a property value to a display string for grouping.
	 * Handles null, undefined, arrays, objects, primitives, and Bases Value objects.
	 */
	private valueToString(value: any): string {
		if (value === null || value === undefined) {
			return "None";
		}

		// Handle Bases Value objects (they have a toString() method and often a type property)
		// Check for Bases Value object by duck-typing (has toString and is an object with constructor)
		if (typeof value === "object" && value !== null && typeof value.toString === "function") {
			// Check if it's a Bases NullValue
			if (value.constructor?.name === "NullValue" || (value.isTruthy && !value.isTruthy())) {
				return "None";
			}

			// Check if it's a Bases ListValue (array-like)
			if (value.constructor?.name === "ListValue" || (Array.isArray(value.value))) {
				const arr = value.value || [];
				if (arr.length === 0) return "None";
				// Recursively convert each item
				return arr.map((v: any) => this.valueToString(v)).join(", ");
			}

			// For other Bases Value types (StringValue, NumberValue, BooleanValue, DateValue, etc.)
			// Use their toString() method
			const str = value.toString();
			return str || "None";
		}

		if (typeof value === "string") {
			return value || "None";
		}

		if (typeof value === "number") {
			return String(value);
		}

		if (typeof value === "boolean") {
			return value ? "True" : "False";
		}

		if (Array.isArray(value)) {
			return value.length > 0 ? value.map((v) => this.valueToString(v)).join(", ") : "None";
		}

		return String(value);
	}

	/**
	 * Group tasks by a sub-property for nested grouping.
	 * Returns a Map of sub-group key -> tasks.
	 */
	private groupTasksBySubProperty(
		tasks: TaskInfo[],
		propertyId: string,
		pathToProps: Map<string, Record<string, any>>
	): Map<string, TaskInfo[]> {
		const subGroups = new Map<string, TaskInfo[]>();

		for (const task of tasks) {
			const props = pathToProps.get(task.path) || {};
			const subValue = this.getPropertyValue(props, propertyId);
			const subKey = this.valueToString(subValue);

			if (!subGroups.has(subKey)) {
				subGroups.set(subKey, []);
			}
			subGroups.get(subKey)!.push(task);
		}

		return subGroups;
	}

	private buildTaskSignature(task: TaskInfo): string {
		// Fast signature using only fields that affect rendering
		return `${task.path}|${task.title}|${task.status}|${task.priority}|${task.due}|${task.scheduled}|${task.recurrence}|${task.archived}|${task.complete_instances?.join(',')}|${task.reminders?.length}|${task.blocking?.length}|${task.blockedBy?.length}`;
	}
}

/**
 * Factory function for Bases registration.
 * Returns an actual TaskListView instance (extends BasesView).
 */
export function buildTaskListViewFactory(plugin: TaskNotesPlugin) {
	return function (controller: any, containerEl: HTMLElement): TaskListView {
		if (!containerEl) {
			console.error("[TaskNotes][TaskListView] No containerEl provided");
			throw new Error("TaskListView requires a containerEl");
		}

		// Create and return the view instance directly
		// TaskListView now properly extends BasesView, so Bases can call its methods directly
		return new TaskListView(controller, containerEl, plugin);
	};
}
