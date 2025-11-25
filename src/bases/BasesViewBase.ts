import { Component, App } from "obsidian";
import TaskNotesPlugin from "../main";
import { BasesDataAdapter } from "./BasesDataAdapter";
import { PropertyMappingService } from "./PropertyMappingService";
import { TaskInfo, EVENT_TASK_UPDATED } from "../types";
import { convertInternalToUserProperties } from "../utils/propertyMapping";
import { DEFAULT_INTERNAL_VISIBLE_PROPERTIES } from "../settings/defaults";
import { SearchBox } from "./components/SearchBox";
import { TaskSearchFilter } from "./TaskSearchFilter";

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

	// Search functionality (opt-in via enableSearch flag)
	protected enableSearch = false;
	protected searchBox: SearchBox | null = null;
	protected searchFilter: TaskSearchFilter | null = null;
	protected currentSearchTerm = "";

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
		this.render();
	}

	/**
	 * BasesView lifecycle: Called when Bases data changes.
	 * Required abstract method implementation.
	 */
	onDataUpdated(): void {
		try {
			this.render();
		} catch (error) {
			console.error(`[TaskNotes][${this.type}] Render error:`, error);
			this.renderError(error as Error);
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

				// Check if this task is in our current view
				const dataItems = this.dataAdapter.extractDataItems();
				const isRelevant = dataItems.some((item) => item.path === updatedTask.path);

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
		}, 150);

		// Note: We don't need to explicitly register cleanup for this timer
		// because it's short-lived (150ms) and clears itself. If the component
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
		const modal = new TaskCreationModal(this.app, this.plugin, {
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
		// Idempotency: if search UI is already created, do nothing
		if (this.searchBox) {
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
