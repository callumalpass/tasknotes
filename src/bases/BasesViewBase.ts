import { Component, App, Notice, TFile } from "obsidian";
import type { BasesPropertyId, BasesQueryResult, BasesViewConfig, EventRef } from "obsidian";
import TaskNotesPlugin from "../main";
import { BasesDataAdapter } from "./BasesDataAdapter";
import { PropertyMappingService } from "./PropertyMappingService";
import { TaskInfo, EVENT_TASK_DELETED, EVENT_TASK_UPDATED } from "../types";
import { convertInternalToUserProperties } from "../utils/propertyMapping";
import { DEFAULT_INTERNAL_VISIBLE_PROPERTIES } from "../settings/defaults";
import { SearchBox } from "./components/SearchBox";
import { TaskSearchFilter } from "./TaskSearchFilter";
import { BatchContextMenu } from "../components/BatchContextMenu";
import type { TaskCardOptions } from "../ui/TaskCard";
import { identifyTaskNotesFromBasesData } from "./helpers";
import {
	formatTasksForClipboard,
	type ClipboardTask,
	type TaskCopyFormat,
} from "../utils/taskClipboard";
import {
	buildTaskCreationDataFromFrontmatter,
} from "./basesTaskCreation";
import { extractBasesFilterDefaults } from "./basesFilterDefaults";
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
	planBasesTaskUpdatedEvent,
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
import { createTaskNotesLogger, type TaskNotesLogger } from "../utils/tasknotesLogger";

type BasesEphemeralState = {
	scrollTop?: unknown;
};

type BasesViewAction = {
	name: string;
	icon?: string;
	callback: () => void;
};

type BasesConfigChangeController = {
	onConfigChanged?: (...args: unknown[]) => unknown;
	view?: unknown;
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
	protected taskUpdateListener: unknown = null;
	protected updateDebounceTimer: number | null = null;
	protected dataUpdateDebounceTimer: number | null = null;
	private restoreConfigChangeHook: (() => void) | null = null;
	protected relevantPathsCache: Set<string> = new Set();

	// Search functionality (opt-in via enableSearch flag)
	protected enableSearch = false;
	protected searchBox: SearchBox | null = null;
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
		this.propertyMapper = new PropertyMappingService(plugin, plugin.fieldMapper);

		// Bind createFileForView to ensure Bases can find it
		// Some versions of Bases may check hasOwnProperty rather than prototype chain
		this.createFileForView = this.createFileForView.bind(this);
		this.setupConfigChangeHook(controller);
	}

	private setupConfigChangeHook(controller: unknown): void {
		if (!isRecord(controller) || typeof controller.onConfigChanged !== "function") {
			return;
		}

		const basesController = controller as BasesConfigChangeController;
		const originalOnConfigChanged = basesController.onConfigChanged;
		if (!originalOnConfigChanged) {
			return;
		}

		const wrappedOnConfigChanged = (...args: unknown[]): unknown => {
			const result = originalOnConfigChanged.apply(basesController, args);
			this.scheduleConfigRefresh(basesController, result);
			return result;
		};

		basesController.onConfigChanged = wrappedOnConfigChanged;
		this.restoreConfigChangeHook = () => {
			if (basesController.onConfigChanged === wrappedOnConfigChanged) {
				basesController.onConfigChanged = originalOnConfigChanged;
			}
		};
		if (typeof this.register === "function") {
			this.register(() => {
				this.restoreConfigChangeHook?.();
				this.restoreConfigChangeHook = null;
			});
		}
	}

	private scheduleConfigRefresh(
		controller: BasesConfigChangeController,
		result: unknown
	): void {
		const refresh = () => {
			if (controller.view && controller.view !== this) {
				return;
			}
			if (!this.rootElement?.isConnected) {
				return;
			}
			this.debouncedRefresh();
		};

		const maybePromise = result as PromiseLike<unknown> | null;
		if (maybePromise && typeof maybePromise.then === "function") {
			void maybePromise.then(refresh, refresh);
			return;
		}

		const win = this.containerEl.ownerDocument.defaultView || window;
		win.setTimeout(refresh, 0);
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

		// Debounce data updates to avoid freezing during typing
		if (this.dataUpdateDebounceTimer) {
			window.clearTimeout(this.dataUpdateDebounceTimer);
		}

		// Use correct window for pop-out window support
		const win = this.containerEl.ownerDocument.defaultView || window;
		this.dataUpdateDebounceTimer = win.setTimeout(() => {
			this.dataUpdateDebounceTimer = null;
			try {
				this.updateRelevantPathsCache();
				void this.render();
			} catch (error) {
				this.logger.error("Render error during data update", {
					category: "internal",
					operation: "data-update-render",
					error,
				});
				this.renderError(error as Error);
			}
		}, 500); // 500ms debounce for data updates
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
		return [
			{
				name: "Copy task filenames",
				icon: "lucide-file-text",
				callback: () => {
					void this.copyCurrentViewTasks("filenames");
				},
			},
			{
				name: "Copy task links",
				icon: "lucide-link",
				callback: () => {
					void this.copyCurrentViewTasks("markdown-links");
				},
			},
			{
				name: "Copy task titles",
				icon: "lucide-text",
				callback: () => {
					void this.copyCurrentViewTasks("titles");
				},
			},
		];
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

		const taskUpdatedListener = this.plugin.emitter.on(
			EVENT_TASK_UPDATED,
			async (eventData: unknown) => {
				try {
					// Skip if view is not visible (no point updating hidden views)
					if (!this.rootElement?.isConnected) return;

					const updatePlan = planBasesTaskUpdatedEvent(eventData, this.relevantPathsCache);
					if (updatePlan.action === "refresh-renamed-task") {
						this.relevantPathsCache.delete(updatePlan.removePath);
						this.relevantPathsCache.add(updatePlan.addPath);
						this.debouncedRefresh();
						return;
					}
					if (updatePlan.action === "handle-task") {
						await this.handleTaskUpdate(updatePlan.task);
					}
				} catch (error) {
					this.logger.error("Error in task update handler", {
						category: "internal",
						operation: "task-update-handler",
						error,
					});
					this.debouncedRefresh();
				}
			}
		);
		const taskDeletedListener = this.plugin.emitter.on(
			EVENT_TASK_DELETED,
			(eventData: unknown) => {
				this.handleTaskDeletedEvent(eventData);
			}
		);
		const fileDeletedListener = this.plugin.emitter.on("file-deleted", (eventData: unknown) => {
			this.handleTaskDeletedEvent(eventData);
		});

		this.taskUpdateListener = [taskUpdatedListener, taskDeletedListener, fileDeletedListener];

		// Register cleanup using Component lifecycle
		this.register(() => {
			if (this.taskUpdateListener) {
				const listeners = Array.isArray(this.taskUpdateListener)
					? this.taskUpdateListener
					: [this.taskUpdateListener];
				for (const listener of listeners) {
					this.plugin.emitter.offref(listener as EventRef);
				}
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
		if (this.updateDebounceTimer) {
			window.clearTimeout(this.updateDebounceTimer);
		}

		// Use correct window for pop-out window support
		const win = this.containerEl.ownerDocument.defaultView || window;
		this.updateDebounceTimer = win.setTimeout(() => {
			void this.render();
			this.updateDebounceTimer = null;
		}, 300); // Increased from 150ms for better typing performance

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

		const mockFrontmatter = extractBasesFilterDefaults({
			config: this.config,
			fieldMapper: this.plugin.fieldMapper,
			taskTag: this.plugin.settings.taskTag,
			userFields: this.plugin.settings.userFields || [],
			currentFileLink: () => this.getCurrentFileLinkDefault(),
		});

		if (frontmatterProcessor) {
			frontmatterProcessor(mockFrontmatter);
		}

		const taskCreationData = buildTaskCreationDataFromFrontmatter(
			mockFrontmatter,
			this.plugin.fieldMapper,
			this.plugin.settings.userFields || []
		);

		// Open TaskNotes creation modal
		// Use this.app if available (set by Bases), otherwise fall back to plugin.app
		const app = this.app || this.plugin.app;
		const modal = new TaskCreationModal(app, this.plugin, {
			prePopulatedValues: taskCreationData,
			onTaskCreated: (task: TaskInfo) => {
				// Refresh the view after task creation so it appears immediately
				this.refresh();
			},
		});

		modal.open();
	}

	private getCurrentFileLinkDefault(): string | null {
		const app = this.app || this.plugin.app;
		const activeFile = app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension === "base") {
			return null;
		}

		return app.fileManager.generateMarkdownLink(activeFile, activeFile.path);
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

	/**
	 * Initialize search functionality for this view.
	 * Call this from render() in subclasses that want search.
	 * Requires enableSearch to be true and will only create the UI once.
	 */
	protected setupSearch(container: HTMLElement): void {
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

		// Use correct document for pop-out window support
		const doc = this.containerEl.ownerDocument;

		// Create search container
		const searchContainer = doc.createElement("div");
		searchContainer.className = "tn-search-container";

		// Insert search container at the top of the container so it appears above
		// the main items/content (e.g., the task list). This keeps the search box
		// visible while the list itself can scroll independently.
		if (container.firstChild) {
			container.insertBefore(searchContainer, container.firstChild);
		} else {
			container.appendChild(searchContainer);
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
		this.searchFilter = new TaskSearchFilter(visibleProperties);

		// Initialize search box
		this.searchBox = new SearchBox(
			searchContainer,
			(term) => this.handleSearch(term),
			300 // 300ms debounce
		);
		this.searchBox.render();

		// Restore search term if view is being re-initialized with existing search
		if (this.currentSearchTerm) {
			this.searchBox.setValue(this.currentSearchTerm);
		}

		// Register cleanup using Component lifecycle
		this.register(() => {
			if (this.searchBox) {
				this.searchBox.destroy();
				this.searchBox = null;
			}
			this.searchFilter = null;
			this.currentSearchTerm = "";
		});
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
			const tasks = await this.getCurrentViewClipboardTasks();
			if (tasks.length === 0) {
				new Notice("No tasks to copy");
				return;
			}

			const text = formatTasksForClipboard(tasks, format, (task) =>
				this.getMarkdownLinkText(task.path)
			);
			await navigator.clipboard.writeText(text);
			new Notice(`Copied ${tasks.length} tasks`);
		} catch (error) {
			this.logger.error("Failed to copy current view tasks", {
				category: "provider",
				operation: "copy-current-view-tasks",
				error,
			});
			new Notice("Failed to copy tasks");
		}
	}

	private async getCurrentViewClipboardTasks(): Promise<ClipboardTask[]> {
		const dataItems = this.dataAdapter.extractDataItems();
		const taskNotes = await identifyTaskNotesFromBasesData(dataItems, this.plugin);
		const filteredTasks = this.applySearchFilter(taskNotes);

		return filteredTasks.map((task) => ({
			path: task.path,
			title: task.title,
		}));
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

	private getMarkdownLinkText(path: string): string {
		const app = this.app || this.plugin.app;
		const file = app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			return app.metadataCache.fileToLinktext(file, "");
		}
		return path;
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
		return handleBasesSelectionClick({
			event,
			taskPath,
			selectionService,
			getVisibleTaskPaths: () => this.getVisibleTaskPaths(),
			updateSelectionVisuals: () => this.updateSelectionVisuals(),
		});
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
	protected abstract handleTaskUpdate(task: TaskInfo): Promise<void>;

	/**
	 * The view type identifier (required by BasesView).
	 * Must be unique across all registered Bases views.
	 */
	abstract type: string;
}
