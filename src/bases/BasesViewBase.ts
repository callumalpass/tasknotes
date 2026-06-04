import { Component, App, Notice } from "obsidian";
import type { BasesPropertyId, BasesQueryResult, BasesViewConfig, EventRef } from "obsidian";
import TaskNotesPlugin from "../main";
import { BasesDataAdapter } from "./BasesDataAdapter";
import { PropertyMappingService } from "./PropertyMappingService";
import { TaskInfo } from "../types";
import { convertInternalToUserProperties } from "../utils/propertyMapping";
import { DEFAULT_INTERNAL_VISIBLE_PROPERTIES } from "../settings/defaults";
import { SearchBox } from "./components/SearchBox";
import { TaskSearchFilter } from "./TaskSearchFilter";
import { BatchContextMenu } from "../components/BatchContextMenu";
import type { TaskCardOptions } from "../ui/TaskCard";
import { identifyTaskNotesFromBasesData } from "./helpers";
import type { TaskCopyFormat } from "../utils/taskClipboard";
import {
	buildBasesTaskCreationDataForView,
	getBasesCurrentFileLinkDefault,
} from "./basesCreateFileForView";
import {
	buildBasesExportFileName,
	buildBasesExportTable,
	formatBasesExportAsCsv,
	formatBasesExportAsTsv,
	type BasesExportTable,
} from "./basesExport";
import {
	getRenderedTaskPaths,
	planBasesTaskDeletedEvent,
} from "./basesUpdateEvents";
import {
	cleanupBasesNewTaskButton,
	injectBasesNewTaskButton,
} from "./basesToolbar";
import {
	buildBasesVisibleProperties,
	buildBasesVisiblePropertyLabels,
} from "./basesVisibleProperties";
import {
	createBasesSearchControls,
	isBasesSearchWithNoResults,
	renderBasesSearchNoResults,
} from "./basesSearchUi";
import {
	getVisibleTaskPathsFromBasesRoot,
	handleBasesSelectionClick,
	handleBasesSelectionKeyDown,
	setBasesSelectionModeUi,
	updateBasesSelectionIndicator,
	updateBasesSelectionVisuals,
	clearBasesSelectionVisuals,
} from "./basesSelectionUi";
import {
	installBasesConfigRefreshHook,
	scheduleBasesDataUpdateRender,
	scheduleBasesDebouncedRefresh,
	type BasesTimeoutScheduler,
} from "./basesRefreshLifecycle";
import {
	buildBasesTaskCopyActions,
	copyBasesCurrentViewTasks,
	resolveBasesTaskLinkText,
	type BasesViewAction,
} from "./basesTaskCopyActions";
import {
	cleanupBasesTaskUpdateListeners,
	registerBasesTaskUpdateListeners,
} from "./basesTaskUpdateListeners";
import { filterTopLevelSubtasks } from "./topLevelSubtasks";
import type { BasesTaskUpdateSource } from "./basesUpdateEvents";
import { createTaskNotesLogger, type TaskNotesLogger } from "../utils/tasknotesLogger";

type BasesEphemeralState = {
	scrollTop?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Abstract base class for all TaskNotes Bases views.
 * Extends Component and is adapted to the public BasesView type at registration.
 * Note: Bases types (BasesView, BasesViewConfig) are available from obsidian-api declarations.
 */
export abstract class BasesViewBase extends Component {
	// BasesView properties (provided by Bases when factory returns this instance)
	// These match the BasesView interface from Obsidian's internal Bases API
	app!: App;
	config!: BasesViewConfig;
	data!: BasesQueryResult;
	allProperties!: BasesPropertyId[];
	protected plugin: TaskNotesPlugin;
	protected dataAdapter: BasesDataAdapter;
	protected propertyMapper: PropertyMappingService;
	protected logger: TaskNotesLogger;
	protected containerEl: HTMLElement;
	protected rootElement: HTMLElement | null = null;
	protected taskUpdateListener: EventRef[] | null = null;
	protected updateDebounceTimer: number | null = null;
	protected dataUpdateDebounceTimer: number | null = null;
	private restoreConfigChangeHook: (() => void) | null = null;
	protected relevantPathsCache: Set<string> = new Set();

	// Search functionality (opt-in via enableSearch flag)
	protected enableSearch = false;
	protected searchBox: SearchBox | null = null;
	protected searchContainerEl: HTMLElement | null = null;
	protected searchFilter: TaskSearchFilter | null = null;
	protected currentSearchTerm = "";

	// Selection mode state
	protected selectionModeCleanup: (() => void) | null = null;
	protected selectionIndicatorEl: HTMLElement | null = null;

	constructor(controller: unknown, containerEl: HTMLElement, plugin: TaskNotesPlugin) {
		super();
		this.plugin = plugin;
		this.containerEl = containerEl;

		// Note: app, config, and data will be set by Bases when it creates the view
		// We just need to ensure our types match the BasesView interface

		this.logger = createTaskNotesLogger({
			tag: () => `Bases/${this.type}`,
			isDebugEnabled: () => this.plugin.settings.enableDebugLogging,
		});
		this.dataAdapter = new BasesDataAdapter(this, this.logger.child("DataAdapter"));
		this.propertyMapper = new PropertyMappingService(plugin.fieldMapper);

		// Bind createFileForView to ensure Bases can find it
		// Some versions of Bases may check hasOwnProperty rather than prototype chain
		this.createFileForView = this.createFileForView.bind(this);
		this.setupConfigChangeHook(controller);
	}

	private setupConfigChangeHook(controller: unknown): void {
		const cleanup = installBasesConfigRefreshHook({
			controller,
			view: this,
			isConnected: () => Boolean(this.rootElement?.isConnected),
			refresh: () => this.debouncedRefresh(),
			scheduleTimeout: (callback, delayMs) => {
				const scheduler = this.getTimeoutScheduler();
				scheduler.setTimeout(callback, delayMs);
			},
		});
		if (!cleanup) return;

		this.restoreConfigChangeHook = cleanup;
		if (typeof this.register === "function") {
			this.register(() => {
				this.restoreConfigChangeHook?.();
				this.restoreConfigChangeHook = null;
			});
		}
	}

	private getTimeoutScheduler(): BasesTimeoutScheduler {
		const win = this.containerEl.ownerDocument.defaultView || window;
		return {
			setTimeout: (callback, delayMs) => win.setTimeout(callback, delayMs),
			clearTimeout: (timer) => win.clearTimeout(timer),
		};
	}

	/**
	 * Component lifecycle: Called when view is first loaded.
	 * Override from Component base class.
	 */
	onload(): void {
		this.setupContainer();
		this.setupTaskUpdateListener();
		this.setupSelectionHandling();
		this.updateRelevantPathsCache();
		void this.render();
	}

	/**
	 * BasesView lifecycle: Called when Bases data changes.
	 * Required abstract method implementation.
	 * Debounced to prevent excessive re-renders during rapid file saves.
	 */
	onDataUpdated(): void {
		// Skip if view is not visible
		if (!this.rootElement?.isConnected) {
			return;
		}

		this.dataUpdateDebounceTimer = scheduleBasesDataUpdateRender({
			currentTimer: this.dataUpdateDebounceTimer,
			scheduler: this.getTimeoutScheduler(),
			isConnected: () => Boolean(this.rootElement?.isConnected),
			beforeRender: () => this.updateRelevantPathsCache(),
			render: () => this.render(),
			onTimerCleared: () => {
				this.dataUpdateDebounceTimer = null;
			},
			onRenderError: (error) => {
				this.logger.error("Render error during data update", {
					category: "internal",
					operation: "data-update-render",
					error,
				});
				this.renderError(error as Error);
			},
			delayMs: 500,
		});
	}

	/**
	 * Update the cache of relevant paths for efficient update checking.
	 * Called when data changes to avoid expensive lookups on every task update.
	 */
	protected updateRelevantPathsCache(): void {
		this.relevantPathsCache.clear();

		try {
			const dataItems = this.dataAdapter.extractDataItems();
			for (const item of dataItems) {
				if (item.path) {
					this.relevantPathsCache.add(item.path);
				}
			}
		} catch {
			// Ignore errors - cache will be empty and all updates will be processed
		}
	}

	/**
	 * Lifecycle: Save ephemeral state (scroll position, etc).
	 */
	getEphemeralState(): unknown {
		return {
			scrollTop: this.rootElement?.scrollTop || 0,
		};
	}

	/**
	 * Lifecycle: Restore ephemeral state.
	 */
	setEphemeralState(state: unknown): void {
		if (!isRecord(state) || !this.rootElement || !this.rootElement.isConnected) return;

		try {
			const ephemeralState: BasesEphemeralState = state;
			if (typeof ephemeralState.scrollTop === "number") {
				this.rootElement.scrollTop = ephemeralState.scrollTop;
			}
		} catch (e) {
			this.logger.debug("Failed to restore ephemeral state", {
				category: "stale-data",
				operation: "restore-ephemeral-state",
				error: e,
			});
		}
	}

	/**
	 * Lifecycle: Focus this view.
	 */
	focus(): void {
		try {
			if (this.rootElement?.isConnected && typeof this.rootElement.focus === "function") {
				this.rootElement.focus();
			}
		} catch (e) {
			this.logger.debug("Failed to focus view", {
				category: "internal",
				operation: "focus-view",
				error: e,
			});
		}
	}

	/**
	 * Lifecycle: Refresh/re-render the view.
	 */
	refresh(): void {
		void this.render();
	}

	/**
	 * Native Bases result-count menu hook.
	 * Obsidian invokes this for the built-in Copy action before custom view actions.
	 */
	copyToClipboard(): void {
		void this.copyBasesTableToClipboard();
	}

	/**
	 * Native Bases result-count menu hook.
	 * Obsidian invokes this for the built-in Export CSV action before custom view actions.
	 */
	exportTable(): void {
		void this.exportBasesTableAsCsv();
	}

	/**
	 * Undocumented Bases hook used by the native result-count menu.
	 * Obsidian calls this after its built-in Copy and Export CSV actions.
	 */
	getViewActions(): BasesViewAction[] {
		return buildBasesTaskCopyActions((format) => {
			void this.copyCurrentViewTasks(format);
		});
	}

	/**
	 * Lifecycle: Handle view resize.
	 * Called by Bases when the view container is resized.
	 * Subclasses can override to handle resize events.
	 */
	onResize(): void {
		// Default implementation does nothing
		// Subclasses can override if they need resize handling
	}

	/**
	 * Setup container element for this view.
	 */
	protected setupContainer(): void {
		this.containerEl.empty();

		// Use correct document for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const root = doc.createElement("div");
		root.className = `tn-bases-integration tasknotes-plugin tasknotes-container tn-${this.type}`;
		root.tabIndex = -1; // Make focusable without adding to tab order
		this.containerEl.appendChild(root);
		this.rootElement = root;

		// Add custom "New Task" button and hide the default Bases "New" button
		this.setupNewTaskButton();
	}

	/**
	 * Setup custom "New Task" button that opens TaskNotes creation modal.
	 * Injects the button into the Bases toolbar and hides the default "New" button.
	 */
	protected setupNewTaskButton(): void {
		// Defer to allow Bases to render its toolbar first
		window.setTimeout(() => this.injectNewTaskButton(), 100);

		// Register cleanup to toggle off the active class when view is unloaded
		this.register(() => this.cleanupNewTaskButton());
	}

	/**
	 * Clean up injected toolbar state.
	 */
	private cleanupNewTaskButton(): void {
		cleanupBasesNewTaskButton(this.containerEl);
	}

	/**
	 * Inject the custom "New Task" button into the Bases toolbar.
	 */
	private injectNewTaskButton(): void {
		const result = injectBasesNewTaskButton({
			containerEl: this.containerEl,
			label: this.plugin.i18n.translate("common.new"),
			onClick: (event) => {
				event.preventDefault();
				event.stopPropagation();

				void this.createFileForView("New Task");
			},
		});

		if (result === "missing-bases-view") {
			this.logger.debug("No .bases-view element found", {
				category: "provider",
				operation: "inject-new-task-button",
			});
			return;
		}
		if (result === "missing-parent") {
			this.logger.debug("No parent element found for Bases view", {
				category: "provider",
				operation: "inject-new-task-button",
			});
			return;
		}
		if (result === "missing-toolbar") {
			this.logger.debug("No .bases-toolbar element found", {
				category: "provider",
				operation: "inject-new-task-button",
			});
			return;
		}

		this.logger.debug("Injected New Task button into toolbar", {
			category: "provider",
			operation: "inject-new-task-button",
		});
	}

	/**
	 * Setup listener for real-time task updates.
	 * Uses Component.register() for automatic cleanup on unload.
	 */
	protected setupTaskUpdateListener(): void {
		if (this.taskUpdateListener) return;

		this.taskUpdateListener = registerBasesTaskUpdateListeners({
			emitter: this.plugin.emitter,
			isConnected: () => Boolean(this.rootElement?.isConnected),
			relevantPathsCache: this.relevantPathsCache,
			handleTaskUpdate: (task, source) => this.handleTaskUpdate(task, source),
			handleTaskDeleted: (eventData) => this.handleTaskDeletedEvent(eventData),
			debouncedRefresh: () => this.debouncedRefresh(),
			onError: (error) => {
				this.logger.error("Error in task update handler", {
					category: "internal",
					operation: "task-update-handler",
					error,
				});
			},
		});

		// Register cleanup using Component lifecycle
		this.register(() => {
			if (this.taskUpdateListener) {
				cleanupBasesTaskUpdateListeners(this.plugin.emitter, this.taskUpdateListener);
				this.taskUpdateListener = null;
			}
		});
	}

	private handleTaskDeletedEvent(eventData: unknown): void {
		const deletePlan = planBasesTaskDeletedEvent(eventData, {
			projectsField: this.plugin.fieldMapper.toUserField("projects"),
			renderedTaskPaths: getRenderedTaskPaths(this.rootElement),
		});

		if (deletePlan.deletedPath) {
			this.relevantPathsCache.delete(deletePlan.deletedPath);
		}

		this.plugin.projectSubtasksService?.invalidateIndex();

		if (!this.rootElement?.isConnected) {
			return;
		}

		if (deletePlan.shouldRefresh) {
			this.debouncedRefresh();
		}
	}

	/**
	 * Debounced refresh to prevent multiple rapid re-renders.
	 * Timer is automatically cleaned up on component unload.
	 */
	protected debouncedRefresh(): void {
		this.updateDebounceTimer = scheduleBasesDebouncedRefresh({
			currentTimer: this.updateDebounceTimer,
			scheduler: this.getTimeoutScheduler(),
			render: () => this.render(),
			onTimerCleared: () => {
				this.updateDebounceTimer = null;
			},
			delayMs: 300,
		});

		// Note: We don't need to explicitly register cleanup for this timer
		// because it's short-lived (300ms) and clears itself. If the component
		// unloads before the timer fires, the worst case is a no-op render call.
	}

	/**
	 * Override Bases "New" button to open TaskNotes creation modal instead of default file creation.
	 * Called when user clicks the "New" button in the Bases toolbar.
	 *
	 * NOTE: This requires Obsidian API 1.10.2+ and Bases support for createFileForView.
	 * As of the current implementation, Bases (still in beta) may not yet call this method.
	 * When Obsidian 1.10.2 is released and Bases supports it, this will work automatically.
	 *
	 * @param baseFileName - Suggested filename from Bases (typically unused in TaskNotes)
	 * @param frontmatterProcessor - Optional callback that Bases uses to set default frontmatter values
	 */
	async createFileForView(
		baseFileName?: string,
		frontmatterProcessor?: (frontmatter: Record<string, unknown>) => void
	): Promise<void> {
		const { TaskCreationModal } = await import("../modals/TaskCreationModal");
		const app = this.app || this.plugin.app;
		const taskCreationData = buildBasesTaskCreationDataForView({
			config: this.config,
			fieldMapper: this.plugin.fieldMapper,
			taskTag: this.plugin.settings.taskTag,
			userFields: this.plugin.settings.userFields || [],
			currentFileLink: () => getBasesCurrentFileLinkDefault(app),
			frontmatterProcessor,
		});

		// Open TaskNotes creation modal
		// Use this.app if available (set by Bases), otherwise fall back to plugin.app
		const modal = new TaskCreationModal(app, this.plugin, {
			prePopulatedValues: taskCreationData,
			onTaskCreated: (task: TaskInfo) => {
				// Refresh the view after task creation so it appears immediately
				this.refresh();
			},
		});

		modal.open();
	}

	/**
	 * Get visible properties for rendering task cards.
	 * Uses BasesView's config API directly.
	 */
	protected getVisibleProperties(): string[] {
		const fallbackInternalProperties = this.plugin.settings.defaultVisibleProperties || [
			...DEFAULT_INTERNAL_VISIBLE_PROPERTIES,
			"tags",
		];
		return buildBasesVisibleProperties({
			basesPropertyIds: this.config.getOrder(),
			propertyMapper: this.propertyMapper,
			fallbackInternalProperties,
			toUserProperties: (properties) =>
				convertInternalToUserProperties([...properties], this.plugin),
		});
	}

	/**
	 * Get Bases-configured display labels keyed by the TaskCard property IDs we render.
	 */
	protected getVisiblePropertyLabels(): Record<string, string> {
		return buildBasesVisiblePropertyLabels({
			basesPropertyIds: this.config.getOrder(),
			propertyMapper: this.propertyMapper,
			getDisplayName: (propertyId) =>
				this.config.getDisplayName?.(propertyId as BasesPropertyId),
		});
	}

	protected buildTaskCardOptions(
		options: Partial<TaskCardOptions> = {}
	): Partial<TaskCardOptions> {
		return {
			propertyLabels: this.getVisiblePropertyLabels(),
			...options,
		};
	}

	protected filterTopLevelSubtasks(tasks: readonly TaskInfo[]): TaskInfo[] {
		return filterTopLevelSubtasks(tasks, (linkPath, sourcePath) =>
			this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath)
		);
	}

	/**
	 * Initialize search functionality for this view.
	 * Call this from render() in subclasses that want search.
	 * Requires enableSearch to be true and will only create the UI once.
	 */
	protected setupSearch(container: HTMLElement): void {
		// Tear down search UI if it exists but search has been disabled
		if (this.searchBox && !this.enableSearch) {
			this.teardownSearch();
			return;
		}

		// Idempotency: if search UI is already created, restore value and return
		if (this.searchBox) {
			// Restore search term if it was cleared during re-render
			if (this.currentSearchTerm && this.searchBox.getValue() !== this.currentSearchTerm) {
				this.searchBox.setValue(this.currentSearchTerm);
			}
			return;
		}
		if (!this.enableSearch) {
			return;
		}

		// Initialize search filter with visible properties (if available)
		// Config might not be available yet during initial setup
		let visibleProperties: string[] = [];
		try {
			if (this.config) {
				visibleProperties = this.getVisibleProperties();
			}
		} catch (e) {
			this.logger.debug("Could not get visible properties during search setup", {
				category: "provider",
				operation: "setup-search",
				error: e,
			});
		}
		const searchControls = createBasesSearchControls({
			container,
			visibleProperties,
			currentSearchTerm: this.currentSearchTerm,
			onSearch: (term) => this.handleSearch(term),
		});
		this.searchFilter = searchControls.searchFilter;
		this.searchBox = searchControls.searchBox;
		this.searchContainerEl = searchControls.searchContainer;

		// Register cleanup using Component lifecycle
		this.register(() => this.teardownSearch());
	}

	/**
	 * Remove the search UI and reset search state.
	 * Called when enableSearch is toggled off.
	 */
	protected teardownSearch(): void {
		if (this.searchBox) {
			this.searchBox.destroy();
			this.searchBox = null;
		}
		this.searchContainerEl?.remove();
		this.searchContainerEl = null;
		this.searchFilter = null;
		this.currentSearchTerm = "";
	}

	/**
	 * Handle search term changes.
	 * Subclasses can override for custom behavior.
	 * Includes performance monitoring for search operations.
	 */
	protected handleSearch(term: string): void {
		const startTime = performance.now();
		this.currentSearchTerm = term;

		// Re-render with filtered tasks
		void this.render();

		const filterTime = performance.now() - startTime;

		// Log slow searches for performance monitoring
		if (filterTime > 200) {
			this.logger.warn("Slow search", {
				category: "internal",
				operation: "search",
				details: { elapsedMs: filterTime, term },
			});
		}
	}

	/**
	 * Apply search filter to tasks.
	 * Returns filtered tasks or original if no search term.
	 */
	protected applySearchFilter(tasks: TaskInfo[]): TaskInfo[] {
		if (!this.searchFilter || !this.currentSearchTerm) {
			return tasks;
		}

		const startTime = performance.now();
		const filtered = this.searchFilter.filterTasks(tasks, this.currentSearchTerm);
		const filterTime = performance.now() - startTime;

		// Log filter performance for monitoring
		if (filterTime > 100) {
			this.logger.warn("Slow filter operation", {
				category: "internal",
				operation: "filter",
				details: { elapsedMs: filterTime, taskCount: tasks.length },
			});
		}

		return filtered;
	}

	private async copyCurrentViewTasks(format: TaskCopyFormat): Promise<void> {
		try {
			const app = this.app || this.plugin.app;
			const result = await copyBasesCurrentViewTasks({
				dataItems: this.dataAdapter.extractDataItems(),
				format,
				identifyTaskNotes: (dataItems) =>
					identifyTaskNotesFromBasesData(dataItems, this.plugin),
				filterTasks: (tasks) => this.applySearchFilter(tasks),
				resolveLinkText: (task) => resolveBasesTaskLinkText(app, task.path),
				writeText: (text) => navigator.clipboard.writeText(text),
			});

			if (result.status === "empty") {
				new Notice("No tasks to copy");
				return;
			}

			new Notice(`Copied ${result.count} tasks`);
		} catch (error) {
			this.logger.error("Failed to copy current view tasks", {
				category: "provider",
				operation: "copy-current-view-tasks",
				error,
			});
			new Notice("Failed to copy tasks");
		}
	}

	private getBasesExportTable(): BasesExportTable {
		return buildBasesExportTable(this.data?.data ?? [], this.dataAdapter);
	}

	private getBasesExportFileName(): string {
		const configName =
			typeof this.config?.get === "function" ? this.config.get("name") : "";
		return buildBasesExportFileName(configName, this.type);
	}

	private async copyBasesTableToClipboard(): Promise<void> {
		try {
			const table = this.getBasesExportTable();
			const text = formatBasesExportAsTsv(table);

			await navigator.clipboard.writeText(text);
			new Notice(`Copied ${table.rows.length} rows`);
		} catch (error) {
			this.logger.error("Failed to copy Bases table", {
				category: "provider",
				operation: "copy-bases-table",
				error,
			});
			new Notice("Failed to copy table");
		}
	}

	private async exportBasesTableAsCsv(): Promise<void> {
		try {
			const table = this.getBasesExportTable();
			const csv = formatBasesExportAsCsv(table);

			const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
			const win = this.containerEl.ownerDocument.defaultView ?? window;
			const url = win.URL.createObjectURL(blob);
			const link = this.containerEl.ownerDocument.createElement("a");
			link.href = url;
			link.download = this.getBasesExportFileName();
			link.click();
			win.URL.revokeObjectURL(url);
			new Notice(`Exported ${table.rows.length} rows`);
		} catch (error) {
			this.logger.error("Failed to export Bases table", {
				category: "provider",
				operation: "export-bases-table",
				error,
			});
			new Notice("Failed to export table");
		}
	}

	/**
	 * Check if we're currently filtering with no results.
	 * Returns true if search is active and produced no matches.
	 */
	protected isSearchWithNoResults(filteredTasks: TaskInfo[], originalCount: number): boolean {
		return isBasesSearchWithNoResults(
			this.currentSearchTerm,
			filteredTasks.length,
			originalCount
		);
	}

	/**
	 * Render "no results" message for search.
	 * Call this when search produces no matches.
	 */
	protected renderSearchNoResults(container: HTMLElement): void {
		renderBasesSearchNoResults(container, this.currentSearchTerm);
	}

	// =====================
	// Selection Mode Methods
	// =====================

	/**
	 * Setup selection mode handling (keyboard shortcuts and listeners).
	 */
	protected setupSelectionHandling(): void {
		if (!this.rootElement) return;

		const selectionService = this.plugin.taskSelectionService;
		if (!selectionService) return;

		// Keyboard event handler for selection mode
		const handleKeyDown = (e: KeyboardEvent) => {
			handleBasesSelectionKeyDown({
				event: e,
				selectionService,
				getVisibleTaskPaths: () => this.getVisibleTaskPaths(),
				updateSelectionModeUi: (active) => this.updateSelectionModeUI(active),
				updateSelectionVisuals: () => this.updateSelectionVisuals(),
			});
		};

		// Add listener to the root element
		this.rootElement.addEventListener("keydown", handleKeyDown);

		// Listen for selection changes to update UI
		const unsubscribeSelection = selectionService.onSelectionChange((paths) => {
			this.updateSelectionVisuals();
			this.updateSelectionIndicator(paths.length);
		});

		const unsubscribeMode = selectionService.onSelectionModeChange((active) => {
			this.updateSelectionModeUI(active);
		});

		// Register cleanup
		this.register(() => {
			this.rootElement?.removeEventListener("keydown", handleKeyDown);
			unsubscribeSelection();
			unsubscribeMode();
		});
	}

	/**
	 * Update UI to reflect selection mode state.
	 */
	protected updateSelectionModeUI(active: boolean): void {
		if (!this.rootElement) return;

		setBasesSelectionModeUi(this.rootElement, active);
	}

	/**
	 * Update visual selection state on task cards.
	 */
	protected updateSelectionVisuals(): void {
		if (!this.rootElement) return;

		const selectionService = this.plugin.taskSelectionService;
		if (!selectionService) return;

		updateBasesSelectionVisuals(this.rootElement, selectionService);
	}

	/**
	 * Clear all visual selection indicators.
	 */
	protected clearSelectionVisuals(): void {
		if (!this.rootElement) return;

		clearBasesSelectionVisuals(this.rootElement);
	}

	/**
	 * Update selection count indicator.
	 */
	protected updateSelectionIndicator(count: number): void {
		if (!this.rootElement) return;

		this.selectionIndicatorEl = updateBasesSelectionIndicator({
			rootElement: this.rootElement,
			indicatorEl: this.selectionIndicatorEl,
			count,
			onClearSelection: () => {
				this.plugin.taskSelectionService?.clearSelection();
				this.plugin.taskSelectionService?.exitSelectionMode();
			},
		});
	}

	/**
	 * Handle task card click in selection mode.
	 * Returns true if the click was handled as a selection action.
	 */
	protected handleSelectionClick(event: MouseEvent, taskPath: string): boolean {
		const selectionService = this.plugin.taskSelectionService;
		const handled = handleBasesSelectionClick({
			event,
			taskPath,
			selectionService,
			getVisibleTaskPaths: () => this.getVisibleTaskPaths(),
			updateSelectionVisuals: () => this.updateSelectionVisuals(),
		});

		if (handled) {
			this.rootElement?.focus({ preventScroll: true });
		}

		return handled;
	}

	/**
	 * Show batch context menu for selected tasks.
	 */
	protected showBatchContextMenu(event: MouseEvent): void {
		const selectionService = this.plugin.taskSelectionService;
		if (!selectionService) return;

		const selectedPaths = selectionService.getSelectedPaths();
		if (selectedPaths.length === 0) return;

		const menu = new BatchContextMenu({
			plugin: this.plugin,
			selectedPaths,
			onUpdate: () => {
				void this.render();
			},
		});

		menu.show(event);
	}

	/**
	 * Get paths of all currently visible tasks.
	 * Subclasses should override this to return the correct paths based on their rendering.
	 */
	protected getVisibleTaskPaths(): string[] {
		return getVisibleTaskPathsFromBasesRoot(this.rootElement);
	}

	// Abstract methods that subclasses must implement

	/**
	 * Render the view with current data.
	 * Subclasses implement view-specific rendering (list, kanban, calendar).
	 */
	abstract render(): void | Promise<void>;

	/**
	 * Render an error state when rendering fails.
	 * Subclasses should display user-friendly error messages.
	 * Made public to match abstract method visibility requirements.
	 */
	abstract renderError(error: Error): void;

	/**
	 * Handle a single task update for selective rendering.
	 * Subclasses can implement efficient updates or fall back to full refresh.
	 */
	protected abstract handleTaskUpdate(
		task: TaskInfo,
		source?: BasesTaskUpdateSource
	): Promise<void>;

	/**
	 * The view type identifier (required by BasesView).
	 * Must be unique across all registered Bases views.
	 */
	abstract type: string;
}
