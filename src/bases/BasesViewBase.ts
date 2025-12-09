import { Component, App, setIcon } from "obsidian";
import TaskNotesPlugin from "../main";
import { BasesDataAdapter } from "./BasesDataAdapter";
import { PropertyMappingService } from "./PropertyMappingService";
import { TaskInfo, EVENT_TASK_UPDATED } from "../types";
import { convertInternalToUserProperties } from "../utils/propertyMapping";
import { DEFAULT_INTERNAL_VISIBLE_PROPERTIES } from "../settings/defaults";
import { SearchBox } from "./components/SearchBox";
import { TaskSearchFilter } from "./TaskSearchFilter";
import { BatchContextMenu } from "../components/BatchContextMenu";

/**
 * Abstract base class for all TaskNotes Bases views.
 * Properly extends Component to leverage lifecycle, and implements BasesView interface.
 * Note: Bases types (BasesView, BasesViewConfig) are available from obsidian-api declarations.
 */
export abstract class BasesViewBase extends Component {
	// BasesView properties (provided by Bases when factory returns this instance)
	// These match the BasesView interface from Obsidian's internal Bases API
	app!: App;
	config!: any; // BasesViewConfig - using any since not exported from public API
	data!: any; // BasesQueryResult - using any since not exported from public API
	protected plugin: TaskNotesPlugin;
	protected dataAdapter: BasesDataAdapter;
	protected propertyMapper: PropertyMappingService;
	protected containerEl: HTMLElement;
	protected rootElement: HTMLElement | null = null;
	protected taskUpdateListener: any = null;
	protected updateDebounceTimer: number | null = null;
	protected dataUpdateDebounceTimer: number | null = null;
	protected relevantPathsCache: Set<string> = new Set();

	// Search functionality (opt-in via enableSearch flag)
	protected enableSearch = false;
	protected searchBox: SearchBox | null = null;
	protected searchFilter: TaskSearchFilter | null = null;
	protected currentSearchTerm = "";

	// Selection mode state
	protected selectionModeCleanup: (() => void) | null = null;
	protected selectionIndicatorEl: HTMLElement | null = null;

	constructor(controller: any, containerEl: HTMLElement, plugin: TaskNotesPlugin) {
		// Call Component constructor
		super();
		this.plugin = plugin;
		this.containerEl = containerEl;

		// Note: app, config, and data will be set by Bases when it creates the view
		// We just need to ensure our types match the BasesView interface

		this.dataAdapter = new BasesDataAdapter(this);
		this.propertyMapper = new PropertyMappingService(plugin, plugin.fieldMapper);

		// Bind createFileForView to ensure Bases can find it
		// Some versions of Bases may check hasOwnProperty rather than prototype chain
		this.createFileForView = this.createFileForView.bind(this);
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
		this.render();
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
			clearTimeout(this.dataUpdateDebounceTimer);
		}

		this.dataUpdateDebounceTimer = window.setTimeout(() => {
			this.dataUpdateDebounceTimer = null;
			try {
				this.render();
			} catch (error) {
				console.error(`[TaskNotes][${this.type}] Render error:`, error);
				this.renderError(error as Error);
			}
		}, 500);  // 500ms debounce for data updates
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
	getEphemeralState(): any {
		return {
			scrollTop: this.rootElement?.scrollTop || 0,
		};
	}

	/**
	 * Lifecycle: Restore ephemeral state.
	 */
	setEphemeralState(state: any): void {
		if (!state || !this.rootElement || !this.rootElement.isConnected) return;

		try {
			if (state.scrollTop !== undefined) {
				this.rootElement.scrollTop = state.scrollTop;
			}
		} catch (e) {
			console.debug("[TaskNotes][Bases] Failed to restore ephemeral state:", e);
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
			console.debug("[TaskNotes][Bases] Failed to focus view:", e);
		}
	}

	/**
	 * Lifecycle: Refresh/re-render the view.
	 */
	refresh(): void {
		this.render();
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

		const root = document.createElement("div");
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
		setTimeout(() => this.injectNewTaskButton(), 100);

		// Register cleanup to toggle off the active class when view is unloaded
		this.register(() => this.cleanupNewTaskButton());
	}

	/**
	 * Clean up: just remove the "active" class, keep the button for reuse.
	 */
	private cleanupNewTaskButton(): void {
		const basesViewEl = this.containerEl.closest(".bases-view");
		const parentEl = basesViewEl?.parentElement;

		// Only remove the "active" class - button stays for potential reuse
		parentEl?.classList.remove("tasknotes-view-active");
	}

	/**
	 * Inject the custom "New Task" button into the Bases toolbar.
	 */
	private injectNewTaskButton(): void {
		// Find the Bases view container
		const basesViewEl = this.containerEl.closest(".bases-view");
		if (!basesViewEl) {
			console.debug("[TaskNotes][Bases] No .bases-view found");
			return;
		}

		// The toolbar is a sibling of .bases-view, not a child
		// Look in the parent container for the toolbar
		const parentEl = basesViewEl.parentElement;
		if (!parentEl) {
			console.debug("[TaskNotes][Bases] No parent element found");
			return;
		}

		// Mark parent as having an active TaskNotes view (controls visibility via CSS)
		parentEl.classList.add("tasknotes-view-active");

		const toolbarEl = parentEl.querySelector(".bases-toolbar");
		if (!toolbarEl) {
			console.debug("[TaskNotes][Bases] No .bases-toolbar found in parent");
			return;
		}

		// Check if we already added the button (reuse existing)
		if (toolbarEl.querySelector(".tn-bases-new-task-btn")) return;

		// Create "New Task" button matching Bases' text-icon-button style
		const newTaskBtn = document.createElement("div");
		newTaskBtn.className = "bases-toolbar-item tn-bases-new-task-btn";

		const innerBtn = document.createElement("div");
		innerBtn.className = "text-icon-button";
		innerBtn.tabIndex = 0;

		// Add icon
		const iconSpan = document.createElement("span");
		iconSpan.className = "text-button-icon";
		setIcon(iconSpan, "plus");
		innerBtn.appendChild(iconSpan);

		// Add label
		const labelSpan = document.createElement("span");
		labelSpan.className = "text-button-label";
		labelSpan.textContent = this.plugin.i18n.translate("common.new");
		innerBtn.appendChild(labelSpan);

		newTaskBtn.appendChild(innerBtn);

		newTaskBtn.addEventListener("click", () => {
			this.createFileForView("New Task");
		});

		// Find the original "New" button position and insert our button there
		const originalNewBtn = toolbarEl.querySelector(".bases-toolbar-new-item-menu");
		if (originalNewBtn) {
			// Insert before the original (which will be hidden by CSS)
			originalNewBtn.before(newTaskBtn);
		} else {
			// Fallback: append to end of toolbar
			toolbarEl.appendChild(newTaskBtn);
		}

		console.debug("[TaskNotes][Bases] Injected New Task button into toolbar");
	}

	/**
	 * Setup listener for real-time task updates.
	 * Uses Component.register() for automatic cleanup on unload.
	 */
	protected setupTaskUpdateListener(): void {
		if (this.taskUpdateListener) return;

		this.taskUpdateListener = this.plugin.emitter.on(EVENT_TASK_UPDATED, async (eventData: any) => {
			try {
				const updatedTask = eventData?.task || eventData?.taskInfo;
				if (!updatedTask?.path) return;

				// Skip if view is not visible (no point updating hidden views)
				if (!this.rootElement?.isConnected) return;

				// Use cached Set for O(1) lookup instead of O(n) iteration
				const isRelevant = this.relevantPathsCache.has(updatedTask.path);

				if (isRelevant) {
					await this.handleTaskUpdate(updatedTask);
				}
			} catch (error) {
				console.error("[TaskNotes][Bases] Error in task update handler:", error);
				this.debouncedRefresh();
			}
		});

		// Register cleanup using Component lifecycle
		this.register(() => {
			if (this.taskUpdateListener) {
				this.plugin.emitter.offref(this.taskUpdateListener);
				this.taskUpdateListener = null;
			}
		});
	}

	/**
	 * Debounced refresh to prevent multiple rapid re-renders.
	 * Timer is automatically cleaned up on component unload.
	 */
	protected debouncedRefresh(): void {
		if (this.updateDebounceTimer) {
			clearTimeout(this.updateDebounceTimer);
		}

		this.updateDebounceTimer = window.setTimeout(() => {
			this.render();
			this.updateDebounceTimer = null;
		}, 300);  // Increased from 150ms for better typing performance

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
		baseFileName: string,
		frontmatterProcessor?: (frontmatter: any) => void
	): Promise<void> {
		const { TaskCreationModal } = await import("../modals/TaskCreationModal");

		// Extract any default values from the frontmatter processor if provided
		const prePopulatedValues: Partial<TaskInfo> = {};
		const customFrontmatter: Record<string, any> = {};

		if (frontmatterProcessor) {
			// Create a mock frontmatter object to extract defaults
			const mockFrontmatter: any = {};
			frontmatterProcessor(mockFrontmatter);

			// Get field mapper for property name mapping
			const fm = this.plugin.fieldMapper;

			// Map core TaskNotes properties from frontmatter
			if (mockFrontmatter[fm.toUserField("title")]) {
				prePopulatedValues.title = String(mockFrontmatter[fm.toUserField("title")]);
			}
			if (mockFrontmatter[fm.toUserField("status")]) {
				prePopulatedValues.status = String(mockFrontmatter[fm.toUserField("status")]);
			}
			if (mockFrontmatter[fm.toUserField("priority")]) {
				prePopulatedValues.priority = String(mockFrontmatter[fm.toUserField("priority")]);
			}
			if (mockFrontmatter[fm.toUserField("due")]) {
				prePopulatedValues.due = String(mockFrontmatter[fm.toUserField("due")]);
			}
			if (mockFrontmatter[fm.toUserField("scheduled")]) {
				prePopulatedValues.scheduled = String(mockFrontmatter[fm.toUserField("scheduled")]);
			}
			if (mockFrontmatter[fm.toUserField("contexts")]) {
				const contexts = mockFrontmatter[fm.toUserField("contexts")];
				prePopulatedValues.contexts = Array.isArray(contexts) ? contexts : [contexts];
			}
			if (mockFrontmatter[fm.toUserField("projects")]) {
				const projects = mockFrontmatter[fm.toUserField("projects")];
				prePopulatedValues.projects = Array.isArray(projects) ? projects : [projects];
			}

			// Tags - check both the standard 'tags' property and archiveTag
			if (mockFrontmatter.tags) {
				const tags = mockFrontmatter.tags;
				prePopulatedValues.tags = Array.isArray(tags) ? tags : [tags];
			}

			// Archived - check for archive tag
			if (mockFrontmatter.tags && Array.isArray(mockFrontmatter.tags)) {
				const archiveTag = fm.toUserField("archiveTag");
				prePopulatedValues.archived = mockFrontmatter.tags.includes(archiveTag);
			}

			if (mockFrontmatter[fm.toUserField("timeEstimate")]) {
				prePopulatedValues.timeEstimate = Number(mockFrontmatter[fm.toUserField("timeEstimate")]);
			}
			if (mockFrontmatter[fm.toUserField("recurrence")]) {
				prePopulatedValues.recurrence = String(mockFrontmatter[fm.toUserField("recurrence")]);
			}
			if (mockFrontmatter[fm.toUserField("completedDate")]) {
				prePopulatedValues.completedDate = String(mockFrontmatter[fm.toUserField("completedDate")]);
			}
			if (mockFrontmatter[fm.toUserField("dateCreated")]) {
				prePopulatedValues.dateCreated = String(mockFrontmatter[fm.toUserField("dateCreated")]);
			}
			if (mockFrontmatter[fm.toUserField("blockedBy")]) {
				const blockedBy = mockFrontmatter[fm.toUserField("blockedBy")];
				prePopulatedValues.blockedBy = Array.isArray(blockedBy) ? blockedBy : [blockedBy];
			}

			// Handle user-defined custom fields
			const userFields = this.plugin.settings.userFields || [];
			for (const userField of userFields) {
				if (mockFrontmatter[userField.key] !== undefined) {
					// Store in customFrontmatter for TaskCreationData
					customFrontmatter[userField.key] = mockFrontmatter[userField.key];
				}
			}

			// Capture any other frontmatter properties that weren't mapped above
			// This ensures we don't lose any Bases-specific values
			const mappedKeys = new Set([
				fm.toUserField("title"),
				fm.toUserField("status"),
				fm.toUserField("priority"),
				fm.toUserField("due"),
				fm.toUserField("scheduled"),
				fm.toUserField("contexts"),
				fm.toUserField("projects"),
				"tags", // Not in FieldMapping
				fm.toUserField("archiveTag"), // For archived status
				fm.toUserField("timeEstimate"),
				fm.toUserField("recurrence"),
				fm.toUserField("completedDate"),
				fm.toUserField("dateCreated"),
				fm.toUserField("blockedBy"),
				...userFields.map(uf => uf.key),
			]);

			for (const [key, value] of Object.entries(mockFrontmatter)) {
				if (!mappedKeys.has(key)) {
					customFrontmatter[key] = value;
				}
			}
		}

		// Build the complete pre-populated values (TaskCreationData structure)
		const taskCreationData: any = { ...prePopulatedValues };
		if (Object.keys(customFrontmatter).length > 0) {
			taskCreationData.customFrontmatter = customFrontmatter;
		}

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

	/**
	 * Get visible properties for rendering task cards.
	 * Uses BasesView's config API directly.
	 */
	protected getVisibleProperties(): string[] {
		// Get ordered properties from Bases config (configured by user in Bases UI)
		const basesPropertyIds = this.config.getOrder();
		let visibleProperties = this.propertyMapper.mapVisibleProperties(basesPropertyIds);

		// Fallback to plugin defaults if no properties configured
		if (!visibleProperties || visibleProperties.length === 0) {
			const internalDefaults = this.plugin.settings.defaultVisibleProperties || [
				...DEFAULT_INTERNAL_VISIBLE_PROPERTIES,
				"tags",
			];
			// Convert internal field names to user-configured property names
			visibleProperties = convertInternalToUserProperties(internalDefaults, this.plugin);
		}

		return visibleProperties;
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

		// Create search container
		const searchContainer = document.createElement("div");
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
			console.debug(`[${this.type}] Could not get visible properties during search setup:`, e);
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
		this.render();

		const filterTime = performance.now() - startTime;

		// Log slow searches for performance monitoring
		if (filterTime > 200) {
			console.warn(
				`[${this.type}] Slow search: ${filterTime.toFixed(2)}ms for search term "${term}"`
			);
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
			console.warn(
				`[${this.type}] Filter operation took ${filterTime.toFixed(2)}ms for ${tasks.length} tasks`
			);
		}

		return filtered;
	}

	/**
	 * Check if we're currently filtering with no results.
	 * Returns true if search is active and produced no matches.
	 */
	protected isSearchWithNoResults(filteredTasks: TaskInfo[], originalCount: number): boolean {
		return this.currentSearchTerm.length > 0 && filteredTasks.length === 0 && originalCount > 0;
	}

	/**
	 * Render "no results" message for search.
	 * Call this when search produces no matches.
	 */
	protected renderSearchNoResults(container: HTMLElement): void {
		const noResultsEl = document.createElement("div");
		noResultsEl.className = "tn-search-no-results";

		const textEl = document.createElement("div");
		textEl.className = "tn-search-no-results__text";
		textEl.textContent = `No tasks match "${this.currentSearchTerm}"`;

		const hintEl = document.createElement("div");
		hintEl.className = "tn-search-no-results__hint";
		hintEl.textContent = "Try a different search term or clear the search";

		noResultsEl.appendChild(textEl);
		noResultsEl.appendChild(hintEl);
		container.appendChild(noResultsEl);
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
			// Escape exits selection mode and clears selection
			if (e.key === "Escape" && selectionService.isSelectionModeActive()) {
				selectionService.exitSelectionMode(true);
				this.updateSelectionModeUI(false);
			}

			// Ctrl/Cmd + A to select all visible tasks (only when in selection mode)
			if ((e.ctrlKey || e.metaKey) && e.key === "a" && selectionService.isSelectionModeActive()) {
				e.preventDefault();
				const visiblePaths = this.getVisibleTaskPaths();
				selectionService.selectAll(visiblePaths);
				this.updateSelectionVisuals();
			}
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

		if (active) {
			this.rootElement.classList.add("tn-selection-mode");
			this.rootElement.setAttribute("data-selection-mode", "true");
		} else {
			this.rootElement.classList.remove("tn-selection-mode");
			this.rootElement.removeAttribute("data-selection-mode");
			// Also clear visual selection indicators
			this.clearSelectionVisuals();
		}
	}

	/**
	 * Update visual selection state on task cards.
	 */
	protected updateSelectionVisuals(): void {
		if (!this.rootElement) return;

		const selectionService = this.plugin.taskSelectionService;
		if (!selectionService) return;

		// Find all task cards and update their selection state
		const primaryPath = selectionService.getPrimarySelectedPath();

		const cards = this.rootElement.querySelectorAll<HTMLElement>(".task-card");
		for (const card of cards) {
			const path = card.dataset.taskPath;
			if (path) {
				if (selectionService.isSelected(path)) {
					card.classList.add("task-card--selected");
					if (path === primaryPath) {
						card.classList.add("task-card--selected-primary");
					} else {
						card.classList.remove("task-card--selected-primary");
					}
				} else {
					card.classList.remove("task-card--selected");
					card.classList.remove("task-card--selected-primary");
				}
			}
		}

		// Also update kanban card wrappers (for visual consistency)
		const cardWrappers = this.rootElement.querySelectorAll<HTMLElement>(".kanban-view__card-wrapper");
		for (const wrapper of cardWrappers) {
			const path = wrapper.dataset.taskPath;
			if (path) {
				if (selectionService.isSelected(path)) {
					wrapper.classList.add("kanban-view__card-wrapper--selected");
					if (path === primaryPath) {
						wrapper.classList.add("kanban-view__card-wrapper--selected-primary");
					} else {
						wrapper.classList.remove("kanban-view__card-wrapper--selected-primary");
					}
				} else {
					wrapper.classList.remove("kanban-view__card-wrapper--selected");
					wrapper.classList.remove("kanban-view__card-wrapper--selected-primary");
				}
			}
		}
	}

	/**
	 * Clear all visual selection indicators.
	 */
	protected clearSelectionVisuals(): void {
		if (!this.rootElement) return;

		const cards = this.rootElement.querySelectorAll<HTMLElement>(".task-card--selected");
		for (const card of cards) {
			card.classList.remove("task-card--selected");
			card.classList.remove("task-card--selected-primary");
		}

		const cardWrappers = this.rootElement.querySelectorAll<HTMLElement>(".kanban-view__card-wrapper--selected");
		for (const wrapper of cardWrappers) {
			wrapper.classList.remove("kanban-view__card-wrapper--selected");
			wrapper.classList.remove("kanban-view__card-wrapper--selected-primary");
		}
	}

	/**
	 * Update selection count indicator.
	 */
	protected updateSelectionIndicator(count: number): void {
		if (!this.rootElement) return;

		if (count > 0) {
			// Create or update indicator
			if (!this.selectionIndicatorEl) {
				this.selectionIndicatorEl = document.createElement("div");
				this.selectionIndicatorEl.className = "tn-selection-indicator";
				this.selectionIndicatorEl.addEventListener("click", () => {
					this.plugin.taskSelectionService?.clearSelection();
					this.plugin.taskSelectionService?.exitSelectionMode();
				});
				this.rootElement.appendChild(this.selectionIndicatorEl);
			}
			this.selectionIndicatorEl.textContent = `${count} selected`;
			this.selectionIndicatorEl.style.display = "block";
		} else if (this.selectionIndicatorEl) {
			this.selectionIndicatorEl.style.display = "none";
		}
	}

	/**
	 * Handle task card click in selection mode.
	 * Returns true if the click was handled as a selection action.
	 */
	protected handleSelectionClick(event: MouseEvent, taskPath: string): boolean {
		const selectionService = this.plugin.taskSelectionService;
		if (!selectionService) return false;

		// If not in selection mode and no modifier keys, don't handle
		if (!selectionService.isSelectionModeActive() && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
			return false;
		}

		// Enter selection mode if shift is pressed
		if (event.shiftKey && !selectionService.isSelectionModeActive()) {
			selectionService.enterSelectionMode();
		}

		// Handle different click modes
		if (event.shiftKey) {
			// Range selection
			const visiblePaths = this.getVisibleTaskPaths();
			selectionService.selectRange(taskPath, visiblePaths);
		} else if (event.ctrlKey || event.metaKey) {
			// Toggle individual selection
			selectionService.toggleSelection(taskPath);
		} else if (selectionService.isSelectionModeActive()) {
			// In selection mode, regular click toggles selection
			selectionService.toggleSelection(taskPath);
		}

		this.updateSelectionVisuals();
		return true;
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
				this.render();
			},
		});

		menu.show(event);
	}

	/**
	 * Get paths of all currently visible tasks.
	 * Subclasses should override this to return the correct paths based on their rendering.
	 */
	protected getVisibleTaskPaths(): string[] {
		// Default implementation: extract from DOM
		if (!this.rootElement) return [];

		const cards = this.rootElement.querySelectorAll<HTMLElement>(".task-card[data-task-path]");
		const paths: string[] = [];
		for (const card of cards) {
			const path = card.dataset.taskPath;
			if (path) {
				paths.push(path);
			}
		}
		return paths;
	}

	// Abstract methods that subclasses must implement

	/**
	 * Render the view with current data.
	 * Subclasses implement view-specific rendering (list, kanban, calendar).
	 */
	abstract render(): void;

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
