import { Component, App, setIcon, TFile, parseYaml, Notice } from "obsidian";
import TaskNotesPlugin from "../main";
import { BasesDataAdapter } from "./BasesDataAdapter";
import { PropertyMappingService } from "./PropertyMappingService";
import { TaskInfo, EVENT_TASK_UPDATED } from "../types";
import { convertInternalToUserProperties } from "../utils/propertyMapping";
import { DEFAULT_INTERNAL_VISIBLE_PROPERTIES } from "../settings/defaults";
import { SearchBox } from "./components/SearchBox";
import { TaskSearchFilter } from "./TaskSearchFilter";
import { BatchContextMenu } from "../components/BatchContextMenu";
import type { NotificationItem } from "../modals/BasesNotificationModal";
import { BulkTaskCreationModal } from "../bulk/BulkTaskCreationModal";

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

	// Filtered items cache — updated by subclass render(), consumed by handleBulkCreation()
	protected lastFilteredDataItems: import("./helpers").BasesDataItem[] = [];

	// Notification state - prevent duplicate notifications per session
	private notifyChecked = false;

	// Store reference to toolbar parent for cleanup
	private toolbarParentEl: HTMLElement | null = null;

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

		// Use correct window for pop-out window support
		const win = this.containerEl.ownerDocument.defaultView || window;
		this.dataUpdateDebounceTimer = win.setTimeout(() => {
			this.dataUpdateDebounceTimer = null;
			try {
				this.render();
				// DISABLED: Old BasesNotificationModal auto-trigger
				// Replaced by new Upcoming View + Toast system (see ADR-009)
				// this.checkAndTriggerNotification();
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
			this.plugin.debugLog.log("BasesViewBase", "Failed to restore ephemeral state", e);
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
			this.plugin.debugLog.log("BasesViewBase", "Failed to focus view", e);
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

		// Use correct document for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const root = doc.createElement("div");
		root.className = `tn-bases-integration tasknotes-plugin tasknotes-container tn-${this.type}`;
		root.tabIndex = -1; // Make focusable without adding to tab order
		this.containerEl.appendChild(root);
		this.rootElement = root;

		// Add custom "New Task" button and hide the default Bases "New" button
		this.setupNewTaskButton();

		// Add "Generate Tasks" button for bulk task creation from Bases items
		this.setupBulkCreationButton();
	}

	/**
	 * Setup custom "New Task" button that opens TaskNotes creation modal.
	 * Injects the button into the Bases toolbar and hides the default "New" button.
	 */
	protected setupNewTaskButton(): void {
		// Defer to allow Bases to render its toolbar first.
		// Retry a few times -- after YAML changes Bases may re-mount the toolbar
		// asynchronously, so it may not exist at the first attempt.
		let attempts = 0;
		const tryInject = (): void => {
			attempts++;
			const basesViewEl = this.containerEl.closest(".bases-view");
			const toolbar = basesViewEl?.parentElement?.querySelector(".bases-toolbar");
			if (toolbar || attempts >= 5) {
				this.injectNewTaskButton();
			} else {
				setTimeout(tryInject, 200);
			}
		};
		setTimeout(tryInject, 100);

		// Register cleanup to remove buttons and class when view is unloaded
		this.register(() => this.cleanupToolbarButtons());
	}

	/**
	 * Clean up: remove buttons and active class when view unloads.
	 * This ensures buttons don't persist when switching to non-TaskNotes view types.
	 *
	 * Uses a deferred check: when Bases re-mounts (e.g. YAML change), the old view
	 * unloads while a new TN view may be loading into the SAME toolbar.  If we
	 * immediately remove buttons the new view just injected, the "New task" button
	 * disappears.  Instead we remove the active class immediately, defer button
	 * removal 300ms, and check if a new TN view has reclaimed the toolbar
	 * (indicated by `tasknotes-view-active` being re-added by the new view).
	 */
	private cleanupToolbarButtons(): void {
		const parent = this.toolbarParentEl;
		this.toolbarParentEl = null; // Release reference immediately

		if (!parent) return;

		// Remove active class immediately — if a new TN view mounts it will re-add
		// it within ~100ms.  This lets the deferred check distinguish "TN→TN remount"
		// (class re-added) from "TN→Table switch" (class stays gone).
		parent.classList.remove("tasknotes-view-active");

		// Defer button removal to avoid racing with the new view's injection
		setTimeout(() => {
			// If a new TN view has already reclaimed this toolbar, skip cleanup
			if (parent.classList.contains("tasknotes-view-active")) return;

			// No TN view owns this toolbar any more — safe to remove
			parent.querySelectorAll(".tn-bases-new-task-btn").forEach(btn => btn.remove());
			parent.querySelectorAll(".tn-bases-bulk-create-btn").forEach(btn => btn.remove());
		}, 300);
	}

	/**
	 * Check if TaskNotes UI should be shown for this view by reading the .base YAML directly.
	 * Defaults to true if the .base file can't be read or showTaskNotesUI is not set.
	 */
	private async shouldShowUI(): Promise<boolean> {
		const baseFile = this.findBaseFile();
		if (!baseFile) return true;
		try {
			const content = await this.plugin.app.vault.read(baseFile);
			const parsed = parseYaml(content);
			if (!parsed?.views || !Array.isArray(parsed.views)) return true;
			const myType = (this as any).type as string;
			const viewConfig = parsed.views.find((v: any) => v?.type === myType);
			return viewConfig?.showTaskNotesUI !== false;
		} catch {
			return true;
		}
	}

	/**
	 * Inject the custom "New Task" button into the Bases toolbar.
	 * Always injected on TaskNotes-managed views (TaskList, Kanban, etc.)
	 * regardless of showTaskNotesUI -- this is the primary create action
	 * and hiding it leaves users with no way to create tasks.
	 */
	private async injectNewTaskButton(): Promise<void> {
		// Find the Bases view container
		const basesViewEl = this.containerEl.closest(".bases-view");
		if (!basesViewEl) {
			this.plugin.debugLog.log("BasesViewBase", "No .bases-view found");
			return;
		}

		// The toolbar is a sibling of .bases-view, not a child
		// Look in the parent container for the toolbar
		const parentEl = basesViewEl.parentElement;
		if (!parentEl) {
			this.plugin.debugLog.log("BasesViewBase", "No parent element found");
			return;
		}

		// Mark parent as having an active TaskNotes view (controls visibility via CSS)
		parentEl.classList.add("tasknotes-view-active");

		// Store reference for cleanup
		this.toolbarParentEl = parentEl as HTMLElement;

		const toolbarEl = parentEl.querySelector(".bases-toolbar");
		if (!toolbarEl) {
			this.plugin.debugLog.log("BasesViewBase", "No .bases-toolbar found in parent");
			return;
		}

		// Idempotent: remove ALL TaskNotes buttons (universal or ours) before injecting.
		// Bases can re-render toolbars in ways that bypass dedup checks, so always start clean.
		toolbarEl.querySelectorAll(".tn-universal-injected").forEach(btn => btn.remove());
		toolbarEl.querySelectorAll(".tn-bases-new-task-btn").forEach(btn => btn.remove());

		// Use correct document for pop-out window support
		const doc = this.containerEl.ownerDocument;

		// Create "New Task" button matching Bases' text-icon-button style.
		// Inline display:flex overrides the CSS rule `.tn-bases-new-task-btn { display: none }`
		// which normally requires `.tasknotes-view-active` on the parent. This ensures the
		// button is always visible on TN views regardless of parent class state.
		const newTaskBtn = doc.createElement("div");
		newTaskBtn.className = "bases-toolbar-item tn-bases-new-task-btn";
		newTaskBtn.style.display = "flex";

		const innerBtn = doc.createElement("div");
		innerBtn.className = "text-icon-button";
		innerBtn.tabIndex = 0;

		// Add icon
		const iconSpan = doc.createElement("span");
		iconSpan.className = "text-button-icon";
		setIcon(iconSpan, "plus");
		innerBtn.appendChild(iconSpan);

		// Add label
		const labelSpan = doc.createElement("span");
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

		this.plugin.debugLog.log("BasesViewBase", "Injected New Task button into toolbar");
	}

	/**
	 * Setup the "Bulk tasking" button for bulk task creation/conversion.
	 * Injects the button into the Bases toolbar.
	 */
	protected setupBulkCreationButton(): void {
		// Defer to allow Bases to render its toolbar first.
		// Retry like setupNewTaskButton — toolbar may not exist yet after YAML changes.
		let attempts = 0;
		const tryInject = (): void => {
			attempts++;
			const basesViewEl = this.containerEl.closest(".bases-view");
			const toolbar = basesViewEl?.parentElement?.querySelector(".bases-toolbar");
			if (toolbar || attempts >= 5) {
				this.injectBulkCreationButton();
			} else {
				setTimeout(tryInject, 200);
			}
		};
		setTimeout(tryInject, 150);
	}

	/**
	 * Inject the "Bulk tasking" button into the Bases toolbar.
	 */
	private async injectBulkCreationButton(): Promise<void> {
		// Respect settings toggle
		if (!this.plugin.settings.enableBulkActionsButton) return;

		// Check if TaskNotes UI is disabled for this view
		const showUI = await this.shouldShowUI();
		if (!showUI) return;

		// Find the Bases view container
		const basesViewEl = this.containerEl.closest(".bases-view");
		if (!basesViewEl) {
			return;
		}

		const parentEl = basesViewEl.parentElement;
		if (!parentEl) {
			return;
		}

		const toolbarEl = parentEl.querySelector(".bases-toolbar");
		if (!toolbarEl) {
			return;
		}

		// Idempotent: remove existing bulk button before re-injecting
		toolbarEl.querySelectorAll(".tn-bases-bulk-create-btn").forEach(btn => btn.remove());

		// Use correct document for pop-out window support
		const doc = this.containerEl.ownerDocument;

		// Create "Bulk tasking" button matching Bases' text-icon-button style.
		// Inline display:flex to override CSS default `display: none`.
		const bulkBtn = doc.createElement("div");
		bulkBtn.className = "bases-toolbar-item tn-bases-bulk-create-btn";
		bulkBtn.style.display = "flex";

		const innerBtn = doc.createElement("div");
		innerBtn.className = "text-icon-button";
		innerBtn.tabIndex = 0;

		// Add icon (layers icon to represent multiple items)
		const iconSpan = doc.createElement("span");
		iconSpan.className = "text-button-icon";
		setIcon(iconSpan, "layers");
		innerBtn.appendChild(iconSpan);

		// Add label
		const labelSpan = doc.createElement("span");
		labelSpan.className = "text-button-label";
		labelSpan.textContent = "Bulk tasking";
		innerBtn.appendChild(labelSpan);

		bulkBtn.appendChild(innerBtn);

		bulkBtn.addEventListener("click", () => {
			this.handleBulkCreation();
		});

		// Find our "New Task" button and insert after it
		const newTaskBtn = toolbarEl.querySelector(".tn-bases-new-task-btn");
		if (newTaskBtn) {
			newTaskBtn.after(bulkBtn);
		} else {
			// Fallback: append to end of toolbar
			toolbarEl.appendChild(bulkBtn);
		}

		this.plugin.debugLog.log("BasesViewBase", "Injected Bulk tasking button into toolbar");
	}

	/**
	 * Handle click on the "Bulk tasking" button.
	 * Opens the bulk task modal with current Bases items.
	 */
	private async handleBulkCreation(): Promise<void> {
		try {
			// Use filtered items from last render (matches what user sees).
			// Falls back to unfiltered if view hasn't rendered yet.
			const dataItems = this.lastFilteredDataItems.length > 0
				? this.lastFilteredDataItems
				: this.dataAdapter.extractDataItems();

			if (dataItems.length === 0) {
				new Notice("No items in this view to create tasks from");
				return;
			}

			// Get the .base file path for Convert mode linking
			const baseFile = this.findBaseFile();
			const baseFilePath = baseFile?.path;

			// Resolve per-view field mapping context (ADR-011)
			const mappingCtx = await this.resolveViewMappingContext();

			// Open the bulk tasking modal
			const app = this.app || this.plugin.app;
			const modal = new BulkTaskCreationModal(app, this.plugin, dataItems, {
				onTasksCreated: () => {
					// Refresh the view after tasks are created/converted
					this.refresh();
				},
				viewFieldMapping: mappingCtx?.viewFieldMapping,
				sourceBaseId: mappingCtx?.baseId,
				sourceViewId: mappingCtx?.viewId,
				viewIndex: mappingCtx?.viewIndex,
			}, baseFilePath);

			modal.open();
		} catch (error) {
			console.error("[TaskNotes][Bases] Error opening bulk creation modal:", error);
			new Notice("Failed to open bulk task creation: " + (error instanceof Error ? error.message : String(error)));
		}
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

		// Use correct window for pop-out window support
		const win = this.containerEl.ownerDocument.defaultView || window;
		this.updateDebounceTimer = win.setTimeout(() => {
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

		// Inject per-view field mapping context (ADR-011)
		const mappingCtx = await this.resolveViewMappingContext();
		if (mappingCtx?.viewFieldMapping) {
			taskCreationData.viewFieldMapping = mappingCtx.viewFieldMapping;
		}
		if (mappingCtx?.baseId) {
			taskCreationData.sourceBaseId = mappingCtx.baseId;
		}
		if (mappingCtx?.viewId) {
			taskCreationData.sourceViewId = mappingCtx.viewId;
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
			this.plugin.debugLog.log("BasesViewBase", `Could not get visible properties during search setup (${this.type})`, e);
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
			this.plugin.debugLog.warn("BasesViewBase", `Slow search (${this.type}): ${filterTime.toFixed(2)}ms for search term "${term}"`);
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
			this.plugin.debugLog.warn("BasesViewBase", `Filter operation (${this.type}) took ${filterTime.toFixed(2)}ms for ${tasks.length} tasks`);
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
		// Use correct document for pop-out window support
		const doc = container.ownerDocument;

		const noResultsEl = doc.createElement("div");
		noResultsEl.className = "tn-search-no-results";

		const textEl = doc.createElement("div");
		textEl.className = "tn-search-no-results__text";
		textEl.textContent = `No tasks match "${this.currentSearchTerm}"`;

		const hintEl = doc.createElement("div");
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
				// Use correct document for pop-out window support
				const doc = this.rootElement.ownerDocument;
				this.selectionIndicatorEl = doc.createElement("div");
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

	// =====================
	// Notification Methods
	// =====================

	/**
	 * Check if this view's .base file has `notify: true` and trigger notification.
	 * Only fires once per view session to avoid notification spam.
	 *
	 * IMPORTANT: The notifyChecked flag is set AFTER successful validation to allow
	 * retry if initial checks fail (e.g., due to race conditions with view loading).
	 */
	private async checkAndTriggerNotification(): Promise<void> {
		// Only check once per view session (after successful completion)
		if (this.notifyChecked) return;

		// Ensure watcher is available
		if (!this.plugin.basesQueryWatcher) {
			this.plugin.debugLog.log("BasesViewBase", "No basesQueryWatcher available, will retry on next update");
			return;
		}

		try {
			// Find the .base file for this view
			const baseFile = this.findBaseFile();
			if (!baseFile) {
				this.plugin.debugLog.log("BasesViewBase", "findBaseFile() returned null, will retry on next update");
				return; // Don't set notifyChecked - allow retry
			}

			// Read the file and check for notify: true (either top-level or in views[])
			const content = await this.plugin.app.vault.read(baseFile);
			const parsed = parseYaml(content);

			// Check both top-level notify and per-view notify
			let hasNotify = parsed?.notify === true;
			if (!hasNotify && Array.isArray(parsed?.views)) {
				hasNotify = parsed.views.some((v: any) => v?.notify === true);
			}

			if (!hasNotify) {
				// No notify setting - mark as checked so we don't keep re-reading the file
				this.notifyChecked = true;
				return;
			}

			// Extract data items from the view
			const dataItems = this.dataAdapter.extractDataItems();
			if (!dataItems || dataItems.length === 0) {
				this.plugin.debugLog.log("BasesViewBase", "No data items yet, will retry on next update");
				return; // Don't set notifyChecked - allow retry when data arrives
			}

			// SUCCESS: We have a valid base file with notify:true and data
			// Now we can set the flag to prevent duplicate notifications
			this.notifyChecked = true;

			// Build notification items from the Bases data
			const items: NotificationItem[] = [];
			for (const item of dataItems) {
				const frontmatter =
					item.properties ||
					(item.file instanceof TFile
						? this.plugin.app.metadataCache.getFileCache(item.file)?.frontmatter
						: null);

				const isTask = frontmatter
					? this.plugin.cacheManager.isTaskFile(frontmatter)
					: false;

				const title =
					(frontmatter as any)?.title ||
					(frontmatter as any)?.[this.plugin.fieldMapper.toUserField("title")] ||
					item.file?.basename ||
					item.path ||
					"Untitled";

				items.push({
					path: item.path || "",
					title,
					isTask,
					status: isTask ? (frontmatter as any)?.status : undefined,
				});
			}

			// Register with watcher for background monitoring AND show notification
			const baseName = parsed.name || baseFile.basename;
			this.plugin.debugLog.log("BasesViewBase", `Registering view with watcher: ${baseFile.path} (${items.length} items)`);
			this.plugin.basesQueryWatcher.registerViewForNotifications(
				baseFile.path,
				baseName,
				items
			);
		} catch (error) {
			this.plugin.debugLog.log("BasesViewBase", "Notification check failed:", error);
			// Don't set notifyChecked on error - allow retry
		}
	}

	/**
	 * Find the .base file associated with this view by traversing workspace leaves.
	 */
	private findBaseFile(): TFile | null {
		const app = this.app || this.plugin.app;
		let foundFile: TFile | null = null;
		let leafsChecked = 0;
		const viewTypesFound: string[] = [];

		app.workspace.iterateAllLeaves((leaf) => {
			if (foundFile) return; // Already found
			leafsChecked++;

			const viewType = leaf.view?.getViewType?.();
			if (viewType) {
				viewTypesFound.push(viewType);
			}

			// Check for bases view type
			if (viewType === "bases") {
				const view = leaf.view as any;
				// Check if this leaf's DOM contains our container
				if (view.containerEl?.contains(this.containerEl)) {
					if (view.file instanceof TFile) {
						foundFile = view.file;
						this.plugin.debugLog.log("BasesViewBase", `Found base file: ${view.file.path}`);
					} else {
						this.plugin.debugLog.log("BasesViewBase", "Found bases view but no file attached");
					}
				}
			}
		});

		if (!foundFile) {
			// Log diagnostic info to help debug view type issues
			const uniqueTypes = [...new Set(viewTypesFound)];
			this.plugin.debugLog.log("BasesViewBase", `findBaseFile found no match. Checked ${leafsChecked} leaves. View types present: ${uniqueTypes.join(", ") || "none"}`);
		}

		return foundFile;
	}

	/**
	 * Resolve the current view's tnFieldMapping and identity from the .base file.
	 * Matches by view type; falls back to first view of matching type.
	 * Returns null if no .base file found or no tnFieldMapping configured.
	 */
	protected async resolveViewMappingContext(): Promise<{
		viewFieldMapping?: import("../identity/BaseIdentityService").ViewFieldMapping;
		baseId?: string;
		viewId?: string;
		viewIndex?: number;
	} | null> {
		const baseFile = this.findBaseFile();
		if (!baseFile) return null;

		try {
			const content = await this.plugin.app.vault.read(baseFile);
			const parsed = parseYaml(content);
			if (!parsed?.views || !Array.isArray(parsed.views)) return null;

			// Find the view that matches this view's type
			// Subclasses define `type` (e.g., "tasknotesTaskList")
			const myType = (this as any).type as string;
			const viewIndex = parsed.views.findIndex(
				(v: any) => v?.type === myType
			);
			const matchingView = viewIndex >= 0 ? parsed.views[viewIndex] : null;

			if (!matchingView) return null;

			return {
				viewFieldMapping: matchingView.tnFieldMapping || undefined,
				baseId: parsed.tnBaseId || undefined,
				viewId: matchingView.tnViewId || undefined,
				viewIndex,
			};
		} catch {
			return null;
		}
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
