/* eslint-disable no-console */
import { Notice, setIcon, WorkspaceLeaf, TFile, parseYaml, stringifyYaml, Menu } from "obsidian";
import TaskNotesPlugin from "../main";
import { BulkTaskCreationModal } from "../bulk/BulkTaskCreationModal";
import type { ViewFieldMapping } from "../identity/BaseIdentityService";

/**
 * Injects TaskNotes "New Task" and "Bulk tasking" buttons into ALL Obsidian Bases toolbars,
 * including non-TaskNotes view types (Table, Board, etc.).
 *
 * TaskNotes-registered views (TaskList, Kanban, Calendar, etc.) already inject buttons via
 * BasesViewBase.setupNewTaskButton() / setupBulkCreationButton(). This service handles the
 * remaining built-in Bases views that TaskNotes doesn't control.
 *
 * Detection: MutationObserver + workspace layout-change event (hybrid).
 * Deduplication: Checks for existing buttons + .tasknotes-view-active before injecting.
 * Cleanup: Removes stale universal buttons when BasesViewBase takes over a view.
 */
export class BasesToolbarInjector {
	private plugin: TaskNotesPlugin;
	private observer: MutationObserver | null = null;
	private layoutChangeRef: any = null;
	private scanDebounceTimer: number | null = null;
	private periodicCheckInterval: number | null = null;
	private scanInProgress = false;
	private contextMenuContainers = new WeakSet<HTMLElement>();

	// Debounce higher than BasesViewBase's 150ms setTimeout to avoid timing races.
	// BasesViewBase injects at 100ms (new task) and 150ms (bulk). By 500ms both have
	// finished, so we can reliably detect their presence and skip TN views.
	private static readonly DEBOUNCE_MS = 500;

	// Periodic safety net: catches view type switches that don't trigger events
	private static readonly PERIODIC_CHECK_MS = 2000;

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Start watching for Bases toolbars and injecting buttons.
	 */
	start(): void {
		if (!this.plugin.settings.enableUniversalBasesButtons) return;

		// Listen for workspace layout changes (tab switches, pane opens, etc.)
		this.layoutChangeRef = this.plugin.app.workspace.on("layout-change", () => {
			this.debouncedScan();
		});
		this.plugin.registerEvent(this.layoutChangeRef);

		// MutationObserver catches async toolbar rendering and view type switches.
		// We watch for:
		// 1. New .bases-toolbar elements being added (initial render)
		// 2. Children removed from .bases-toolbar (BasesViewBase cleanup on view switch)
		// 3. .view-config-menu appearing (Configure view panel opened)
		this.observer = new MutationObserver((mutations) => {
			let hasToolbarMutation = false;
			let hasConfigPanelMutation = false;
			for (const mutation of mutations) {
				// Check for new toolbar elements or configure panels being added
				for (const node of mutation.addedNodes) {
					if (node instanceof HTMLElement) {
						if (
							node.classList?.contains("bases-toolbar") ||
							node.querySelector?.(".bases-toolbar")
						) {
							hasToolbarMutation = true;
						}
						if (
							node.classList?.contains("view-config-menu") ||
							node.querySelector?.(".view-config-menu")
						) {
							hasConfigPanelMutation = true;
						}
					}
				}
				if (hasToolbarMutation && hasConfigPanelMutation) break;

				// Check for buttons removed from a toolbar (view type switch cleanup)
				if (!hasToolbarMutation && mutation.removedNodes.length > 0 && mutation.target instanceof HTMLElement) {
					if (
						mutation.target.classList?.contains("bases-toolbar") ||
						mutation.target.closest?.(".bases-toolbar")
					) {
						hasToolbarMutation = true;
					}
				}
			}
			if (hasToolbarMutation) {
				this.debouncedScan();
				// Also check for Configure panels after a delay — view type switches
				// may reuse an existing .view-config-menu without triggering addedNodes
				setTimeout(() => this.injectIntoConfigurePanels(), 200);
			}
			if (hasConfigPanelMutation) {
				// Inject immediately — panel is visible now, no debounce needed
				this.injectIntoConfigurePanels();
			}
		});

		this.observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		// Periodic safety net: catches view type switches that don't trigger
		// layout-change or detectable DOM mutations (e.g., Bases reusing toolbar elements).
		// Lightweight — just querySelectorAll + a few class checks, runs every 2s.
		this.periodicCheckInterval = window.setInterval(() => {
			this.scanAndInject();
			this.injectIntoConfigurePanels();
		}, BasesToolbarInjector.PERIODIC_CHECK_MS);

		// Initial scan for any already-rendered toolbars
		this.debouncedScan();
	}

	/**
	 * Stop watching and clean up.
	 */
	stop(): void {
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}
		if (this.scanDebounceTimer != null) {
			clearTimeout(this.scanDebounceTimer);
			this.scanDebounceTimer = null;
		}
		if (this.periodicCheckInterval != null) {
			clearInterval(this.periodicCheckInterval);
			this.periodicCheckInterval = null;
		}
		// Remove all universal-injected buttons from the DOM
		this.removeAllUniversalButtons();
		// layoutChangeRef is cleaned up automatically via plugin.registerEvent()
	}

	/**
	 * Remove all universal-injected buttons from the document.
	 */
	private removeAllUniversalButtons(): void {
		const universalBtns = document.querySelectorAll(".tn-universal-injected");
		for (const btn of universalBtns) {
			btn.remove();
		}
	}

	/**
	 * Debounced scan — prevents rapid-fire DOM queries.
	 * Uses 500ms delay to let BasesViewBase (100-150ms) inject first on TN views.
	 */
	private debouncedScan(): void {
		if (this.scanDebounceTimer != null) {
			clearTimeout(this.scanDebounceTimer);
		}
		this.scanDebounceTimer = window.setTimeout(() => {
			this.scanDebounceTimer = null;
			this.scanAndInject();
		}, BasesToolbarInjector.DEBOUNCE_MS);
	}

	/**
	 * Scan all .bases-toolbar elements and inject buttons where missing.
	 * Also cleans up stale universal buttons on toolbars that BasesViewBase has claimed.
	 *
	 * NOTE: No caching (WeakSet etc.) — we check DOM state fresh every scan.
	 * Bases can reuse toolbar elements across view type switches, so cached state
	 * goes stale. With 500ms debounce and typically 1-2 toolbars, this is fine.
	 */
	private async scanAndInject(): Promise<void> {
		if (!this.plugin.settings.enableUniversalBasesButtons) return;
		if (this.scanInProgress) return;
		this.scanInProgress = true;

		try {
			const toolbars = document.querySelectorAll(".bases-toolbar");
			for (const toolbar of toolbars) {
				// toolbar and .bases-view are siblings under the same parent (.bases-page)
				// so use toolbar.parentElement directly (not toolbar.closest(".bases-view")?.parentElement)
				const parentEl = toolbar.parentElement;
				const isTNView = parentEl?.classList.contains("tasknotes-view-active") ?? false;

				// CLEANUP: If BasesViewBase has claimed this view, remove any universal buttons
				if (isTNView) {
					this.cleanupUniversalButtonsFrom(toolbar as HTMLElement);
					continue;
				}

				// Clean up stale BasesViewBase buttons that linger when the user switches
				// from a TN view tab to a native table tab (BasesViewBase doesn't remove
				// its buttons on tab switch). We already know isTNView is false here.
				(toolbar as HTMLElement).querySelectorAll(
					".tn-bases-new-task-btn:not(.tn-universal-injected), .tn-bases-bulk-create-btn:not(.tn-universal-injected)"
				).forEach(btn => btn.remove());

				// Check if user disabled TaskNotes controls for this view
				const showUI = await this.shouldShowTaskNotesUI(toolbar as HTMLElement);

				// If already injected, remove if disabled; otherwise ensure context menu is set up
				if (toolbar.querySelector(".tn-universal-injected")) {
					if (!showUI) {
						this.cleanupUniversalButtonsFrom(toolbar as HTMLElement);
					} else {
						// Ensure context menu is attached (idempotent via WeakSet)
						this.setupRowContextMenu(toolbar as HTMLElement);
					}
					continue;
				}

				if (!showUI) continue;

				this.injectButtons(toolbar as HTMLElement);
			}
		} finally {
			this.scanInProgress = false;
		}
	}

	/**
	 * Check if TaskNotes controls should be shown for the view associated with a toolbar.
	 * Reads the `showTaskNotesUI` per-view config from the .base YAML.
	 * Defaults to true (show) if not configured or if the .base file can't be read.
	 */
	private async shouldShowTaskNotesUI(toolbarEl: HTMLElement): Promise<boolean> {
		const leaf = this.findLeafFromToolbar(toolbarEl);
		if (!leaf) return true;

		const baseFilePath = leaf.getViewState()?.state?.file as string;
		if (!baseFilePath) return true;

		const baseFile = this.plugin.app.vault.getAbstractFileByPath(baseFilePath);
		if (!(baseFile instanceof TFile)) return true;

		try {
			const content = await this.plugin.app.vault.read(baseFile);
			const parsed = parseYaml(content);
			if (!parsed?.views || !Array.isArray(parsed.views)) return true;

			// Find the active view by matching type from leaf state
			const viewState = leaf.getViewState()?.state;
			const activeViewType = viewState?.type as string | undefined;

			let viewConfig: any = null;
			if (activeViewType) {
				viewConfig = parsed.views.find((v: any) => v?.type === activeViewType);
			}
			if (!viewConfig) viewConfig = parsed.views[0];

			return viewConfig?.showTaskNotesUI !== false;
		} catch {
			return true;
		}
	}

	/**
	 * Remove universal-injected buttons from a specific toolbar.
	 * Called when BasesViewBase claims a view that the injector previously handled.
	 */
	private cleanupUniversalButtonsFrom(toolbarEl: HTMLElement): void {
		const universalBtns = toolbarEl.querySelectorAll(".tn-universal-injected");
		if (universalBtns.length === 0) return;

		for (const btn of universalBtns) {
			btn.remove();
		}

		this.plugin.debugLog.log(
			"BasesToolbarInjector",
			"Cleaned up universal buttons — BasesViewBase has taken over this toolbar"
		);
	}

	/**
	 * Inject "New task" and "Bulk tasking" buttons into a non-TaskNotes toolbar.
	 * "New task" opens TaskCreationModal with per-view field mapping (ADR-011).
	 * "Bulk tasking" opens BulkTaskCreationModal for generate/convert operations.
	 */
	private injectButtons(toolbarEl: HTMLElement): void {
		// Idempotent: remove ALL TaskNotes buttons (universal and non-universal) before
		// re-injecting. A non-universal button may remain from a TN view tab (BasesViewBase)
		// when the user switches to a native table tab — cleanupUniversalButtonsFrom misses it.
		toolbarEl.querySelectorAll(".tn-bases-new-task-btn, .tn-bases-bulk-create-btn").forEach(btn => btn.remove());

		const doc = toolbarEl.ownerDocument;

		// Find the native "New" button as insertion anchor
		const nativeNewBtn = toolbarEl.querySelector(
			".bases-toolbar-new-item-menu"
		) as HTMLElement | null;

		// --- "New task" button ---
		const newTaskBtn = doc.createElement("div");
		newTaskBtn.className = "bases-toolbar-item tn-bases-new-task-btn tn-universal-injected";

		const newTaskInner = doc.createElement("div");
		newTaskInner.className = "text-icon-button";
		newTaskInner.tabIndex = 0;

		const newTaskIcon = doc.createElement("span");
		newTaskIcon.className = "text-button-icon";
		setIcon(newTaskIcon, "plus-circle");
		newTaskInner.appendChild(newTaskIcon);

		const newTaskLabel = doc.createElement("span");
		newTaskLabel.className = "text-button-label";
		newTaskLabel.textContent = "New task";
		newTaskInner.appendChild(newTaskLabel);

		newTaskBtn.appendChild(newTaskInner);
		newTaskBtn.addEventListener("click", (e) => this.handleNewTask(e));

		if (nativeNewBtn) {
			nativeNewBtn.after(newTaskBtn);
		} else {
			toolbarEl.appendChild(newTaskBtn);
		}

		// --- "Bulk tasking" button ---
		if (this.plugin.settings.enableBulkActionsButton) {
			const bulkBtn = doc.createElement("div");
			bulkBtn.className = "bases-toolbar-item tn-bases-bulk-create-btn tn-universal-injected";

			const bulkInner = doc.createElement("div");
			bulkInner.className = "text-icon-button";
			bulkInner.tabIndex = 0;

			const bulkIcon = doc.createElement("span");
			bulkIcon.className = "text-button-icon";
			setIcon(bulkIcon, "layers");
			bulkInner.appendChild(bulkIcon);

			const bulkLabel = doc.createElement("span");
			bulkLabel.className = "text-button-label";
			bulkLabel.textContent = "Bulk tasking";
			bulkInner.appendChild(bulkLabel);

			bulkBtn.appendChild(bulkInner);
			bulkBtn.addEventListener("click", (e) => this.handleBulkCreation(e));

			// Insert after the new task button
			newTaskBtn.after(bulkBtn);
		}

		// Set up row context menu on the view container
		this.setupRowContextMenu(toolbarEl);

		this.plugin.debugLog.log(
			"BasesToolbarInjector",
			"Injected New task + Bulk tasking buttons into toolbar"
		);
	}

	/**
	 * Inject only the "Bulk tasking" button into a toolbar (for TN views where
	 * "New task" is managed by BasesViewBase and should never be touched).
	 * Does NOT mark as .tn-universal-injected so the periodic scanner won't
	 * clean it up on TN views. BasesViewBase's own bulk injection is idempotent
	 * and will replace this button if it re-runs.
	 */
	private injectBulkButtonOnly(toolbarEl: HTMLElement): void {
		if (!this.plugin.settings.enableBulkActionsButton) return;

		// Remove existing bulk button first (idempotent)
		toolbarEl.querySelectorAll(".tn-bases-bulk-create-btn").forEach(btn => btn.remove());

		const doc = toolbarEl.ownerDocument;
		const bulkBtn = doc.createElement("div");
		bulkBtn.className = "bases-toolbar-item tn-bases-bulk-create-btn";
		bulkBtn.style.display = "flex"; // Override CSS default display:none

		const bulkInner = doc.createElement("div");
		bulkInner.className = "text-icon-button";
		bulkInner.tabIndex = 0;

		const bulkIcon = doc.createElement("span");
		bulkIcon.className = "text-button-icon";
		setIcon(bulkIcon, "layers");
		bulkInner.appendChild(bulkIcon);

		const bulkLabel = doc.createElement("span");
		bulkLabel.className = "text-button-label";
		bulkLabel.textContent = "Bulk tasking";
		bulkInner.appendChild(bulkLabel);

		bulkBtn.appendChild(bulkInner);
		bulkBtn.addEventListener("click", (e) => this.handleBulkCreation(e));

		// Insert after the "New task" button, or append to end
		const newTaskBtn = toolbarEl.querySelector(".tn-bases-new-task-btn");
		if (newTaskBtn) {
			newTaskBtn.after(bulkBtn);
		} else {
			toolbarEl.appendChild(bulkBtn);
		}
	}

	/**
	 * Set up a delegated contextmenu listener on the Bases view container
	 * associated with a toolbar. Right-clicking a row/card shows:
	 * - TaskContextMenu if the file is a task
	 * - "Edit task" + "Convert to task" otherwise
	 *
	 * Uses event delegation so it survives view re-renders without needing
	 * MutationObserver re-attachment.
	 */
	private setupRowContextMenu(toolbarEl: HTMLElement): void {
		// The view container is the parent of the toolbar (.bases-page or similar)
		const container = toolbarEl.parentElement;
		if (!container) return;

		// Avoid duplicate listeners
		if (this.contextMenuContainers.has(container)) return;
		this.contextMenuContainers.add(container);

		container.addEventListener("contextmenu", async (event: MouseEvent) => {
			// Only handle right-clicks inside the view area, not on the toolbar itself
			const target = event.target as HTMLElement;
			if (!target || toolbarEl.contains(target)) return;

			// Find the file path from the clicked element.
			// Strategy 1: Look for an internal-link with data-href (Table view cells)
			// Strategy 2: Look for a clickable-icon or link inside a card (Board view)
			// Strategy 3: Look for any element with data-path attribute
			const filePath = this.resolveFilePathFromClick(target, container);
			if (!filePath) return; // Not clicking on a recognizable row/card — let native menu handle it

			// Resolve to TFile
			const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) return;

			// Prevent the native context menu
			event.preventDefault();
			event.stopPropagation();

			// Check if this file is a task
			const cache = this.plugin.app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter;
			const isTask = frontmatter ? this.plugin.cacheManager.isTaskFile(frontmatter) : false;

			if (isTask) {
				// Show the full TaskContextMenu
				const { showTaskContextMenu } = await import("../ui/TaskCard");
				await showTaskContextMenu(event, file.path, this.plugin, new Date());
			} else {
				// Show a simple menu with convert option
				const menu = new Menu();
				menu.addItem((item) => {
					item.setTitle("Convert to task")
						.setIcon("check-square")
						.onClick(async () => {
							await this.plugin.convertFileToTask(file);
						});
				});
				menu.addItem((item) => {
					item.setTitle("Open note")
						.setIcon("file-text")
						.onClick(() => {
							this.plugin.app.workspace.getLeaf(false).openFile(file);
						});
				});
				menu.showAtMouseEvent(event);
			}
		});

		this.plugin.debugLog.log(
			"BasesToolbarInjector",
			"Attached row context menu listener to view container"
		);
	}

	/**
	 * Resolve a file path from a right-click target element within a Bases view.
	 * Walks up the DOM looking for recognizable file references.
	 *
	 * Supported patterns:
	 * - `.internal-link[data-href]` — Table view cells with wikilinks
	 * - `a.internal-link[href]` — Rendered markdown links
	 * - Elements with `data-path` — Some view implementations
	 * - Row/card ancestors containing an internal-link — Board cards, etc.
	 */
	private resolveFilePathFromClick(target: HTMLElement, container: HTMLElement): string | null {
		let el: HTMLElement | null = target;

		while (el && el !== container) {
			// Direct internal-link with data-href (most common in Table view)
			if (el.hasAttribute("data-href")) {
				return this.resolveHrefToPath(el.getAttribute("data-href")!);
			}

			// data-path attribute (some views set this on row elements)
			if (el.hasAttribute("data-path")) {
				const dataPath = el.getAttribute("data-path")!;
				if (dataPath.endsWith(".md")) return dataPath;
				return dataPath + ".md";
			}

			// Check if this element is a table row or board card that contains an internal-link
			if (
				el.classList.contains("bases-table-row") ||
				el.classList.contains("bases-board-card") ||
				el.classList.contains("bases-table-cell-text") ||
				el.hasAttribute("data-row-id")
			) {
				const link = el.querySelector(".internal-link[data-href]") as HTMLElement | null;
				if (link) {
					return this.resolveHrefToPath(link.getAttribute("data-href")!);
				}
			}

			el = el.parentElement;
		}

		// Last resort: check if target is inside any element that contains an internal-link
		// Walk back up and look for the nearest row-like container
		el = target;
		while (el && el !== container) {
			// Look for table row containers (tr, div with role=row, etc.)
			const tagName = el.tagName?.toLowerCase();
			if (tagName === "tr" || el.getAttribute("role") === "row") {
				const link = el.querySelector(".internal-link[data-href]") as HTMLElement | null;
				if (link) {
					return this.resolveHrefToPath(link.getAttribute("data-href")!);
				}
			}
			el = el.parentElement;
		}

		return null;
	}

	/**
	 * Resolve an internal-link href (which may be a basename or partial path)
	 * to a full vault file path.
	 */
	private resolveHrefToPath(href: string): string | null {
		if (!href) return null;

		// Try direct path first
		const directFile = this.plugin.app.vault.getAbstractFileByPath(href);
		if (directFile instanceof TFile) return directFile.path;

		// Try with .md extension
		const withMd = href.endsWith(".md") ? href : href + ".md";
		const mdFile = this.plugin.app.vault.getAbstractFileByPath(withMd);
		if (mdFile instanceof TFile) return mdFile.path;

		// Use metadataCache to resolve shortest-path links (wikilink style)
		const resolved = this.plugin.app.metadataCache.getFirstLinkpathDest(href, "");
		if (resolved instanceof TFile) return resolved.path;

		return null;
	}

	/**
	 * Handle "Bulk tasking" click — extract view data and open BulkTaskCreationModal.
	 */
	private async handleBulkCreation(event: MouseEvent): Promise<void> {
		try {
			const button = event.currentTarget as HTMLElement;
			const items = this.extractItemsFromToolbarContext(button);

			if (!items || items.length === 0) {
				new Notice("No items found in this view. Try switching to a different view or waiting for data to load.");
				return;
			}

			// Get base file path from the leaf for Convert mode linking
			const leaf = this.findLeafFromToolbar(button);
			const baseFilePath = leaf ? (leaf.getViewState()?.state?.file as string) : undefined;

			// Resolve per-view field mapping (ADR-011)
			const mappingCtx = await this.resolveViewMappingFromLeaf(leaf, baseFilePath);

			const modal = new BulkTaskCreationModal(
				this.plugin.app,
				this.plugin,
				items,
				{
					onTasksCreated: () => {
						// No view refresh available for non-TaskNotes views
					},
					viewFieldMapping: mappingCtx?.viewFieldMapping,
					sourceBaseId: mappingCtx?.baseId,
					sourceViewId: mappingCtx?.viewId,
					viewIndex: mappingCtx?.viewIndex,
				},
				baseFilePath
			);
			modal.open();
		} catch (error) {
			console.error("[TaskNotes][BasesToolbarInjector] Error opening bulk modal:", error);
			new Notice(
				"Failed to open bulk task creation: " +
					(error instanceof Error ? error.message : String(error))
			);
		}
	}

	/**
	 * Handle "New task" click — resolve view mapping context and open TaskCreationModal.
	 * Reads the .base file's tnFieldMapping for the active view so new tasks get
	 * per-view property remapping (ADR-011 Phase C).
	 */
	private async handleNewTask(event: MouseEvent): Promise<void> {
		try {
			const button = event.currentTarget as HTMLElement;
			const leaf = this.findLeafFromToolbar(button);
			const baseFilePath = leaf ? (leaf.getViewState()?.state?.file as string) : undefined;

			// Resolve per-view field mapping from the .base file
			const mappingCtx = await this.resolveViewMappingFromLeaf(leaf, baseFilePath);

			// Extract item paths from the view for PropertyPicker discovery context
			const viewItems = this.extractItemsFromToolbarContext(button);
			const contextItemPaths = viewItems
				.map((item: any) => item.path)
				.filter((p: any): p is string => typeof p === "string");

			// Dynamically import to avoid circular dependencies
			const { TaskCreationModal } = await import("../modals/TaskCreationModal");

			const modal = new TaskCreationModal(
				this.plugin.app,
				this.plugin,
				{
					onTaskCreated: () => {
						// No view refresh available for non-TaskNotes views
					},
					viewFieldMapping: mappingCtx?.viewFieldMapping,
					sourceBaseId: mappingCtx?.baseId,
					sourceViewId: mappingCtx?.viewId,
					contextItemPaths: contextItemPaths.length > 0 ? contextItemPaths : undefined,
				}
			);
			modal.open();
		} catch (error) {
			console.error("[TaskNotes][BasesToolbarInjector] Error opening new task modal:", error);
			new Notice(
				"Failed to open task creation: " +
					(error instanceof Error ? error.message : String(error))
			);
		}
	}

	/**
	 * Resolve per-view field mapping from a workspace leaf's .base file.
	 * Reads the YAML, finds the active view (by type from leaf state), and returns
	 * tnFieldMapping / tnBaseId / tnViewId if configured.
	 */
	private async resolveViewMappingFromLeaf(
		leaf: WorkspaceLeaf | null,
		baseFilePath?: string
	): Promise<{
		viewFieldMapping?: ViewFieldMapping;
		baseId?: string;
		viewId?: string;
		viewIndex?: number;
	} | null> {
		if (!baseFilePath) return null;

		const baseFile = this.plugin.app.vault.getAbstractFileByPath(baseFilePath);
		if (!(baseFile instanceof TFile)) return null;

		try {
			const content = await this.plugin.app.vault.read(baseFile);
			const parsed = parseYaml(content);
			if (!parsed?.views || !Array.isArray(parsed.views)) return null;

			// Determine the active view type from the leaf's state
			// Native Bases views store the active view index or type in state
			const viewState = leaf?.getViewState()?.state;
			const activeViewType = viewState?.type as string | undefined;

			// Try to match by type; if no type in state, use the first view with tnFieldMapping
			let viewIndex = -1;
			if (activeViewType) {
				viewIndex = parsed.views.findIndex((v: any) => v?.type === activeViewType);
			}
			if (viewIndex < 0) {
				// Fallback: first view that has tnFieldMapping configured
				viewIndex = parsed.views.findIndex((v: any) => v?.tnFieldMapping);
			}

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

	/**
	 * Extract data items from the Bases view associated with a toolbar button.
	 *
	 * Access chain for Bases views (via leaf.view, NOT BasesViewBase):
	 *   leaf.view.basesContainer.controller.results → Map<string, {file, frontmatter, ...}>
	 *
	 * This is the same proven pattern used by BasesQueryWatcher.extractResultsFromView().
	 */
	private extractItemsFromToolbarContext(button: HTMLElement): any[] {
		const leaf = this.findLeafFromToolbar(button);
		if (!leaf) {
			this.plugin.debugLog.log("BasesToolbarInjector", "Could not find workspace leaf for toolbar");
			return [];
		}

		const view = leaf.view as any;
		const items: any[] = [];

		try {
			// Primary path: view.controller.results (direct access — Obsidian 1.9+)
			// Falls back to basesContainer.controller.results for older patterns
			const controller = view.controller ||
				(view.basesContainer || view.container)?.controller;
			if (controller?.results) {
				const results = controller.results;
				for (const [, entry] of results) {
					const file = (entry as any).file;
					if (!file?.path) continue;

					const frontmatter =
						(entry as any).frontmatter ||
						this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;

					items.push({
						path: file.path,
						itemType: "generic" as const,
						title:
							frontmatter?.title ||
							file.basename,
					});
				}
				if (items.length > 0) {
					this.plugin.debugLog.log(
						"BasesToolbarInjector",
						`Extracted ${items.length} items via basesContainer.controller.results`
					);
					return items;
				}
			}

			// Fallback: iterate controller.sources if results is empty/missing
			if (controller?.sources) {
				const sources = controller.sources;
				for (const source of sources) {
					if (source?.results) {
						for (const [, entry] of source.results) {
							const file = (entry as any).file;
							if (!file?.path) continue;

							const frontmatter =
								(entry as any).frontmatter ||
								this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;

							items.push({
								path: file.path,
								itemType: "generic" as const,
								title:
									frontmatter?.title ||
									file.basename,
							});
						}
					}
				}
				if (items.length > 0) {
					this.plugin.debugLog.log(
						"BasesToolbarInjector",
						`Extracted ${items.length} items via controller.sources fallback`
					);
					return items;
				}
			}

			// Last resort: parse the .base file source filter and query metadataCache
			const baseFilePath = leaf.getViewState()?.state?.file as string;
			if (baseFilePath) {
				const baseFile = this.plugin.app.vault.getAbstractFileByPath(baseFilePath);
				if (baseFile instanceof TFile) {
					return this.extractItemsFromBaseFile(baseFile);
				}
			}

			this.plugin.debugLog.log(
				"BasesToolbarInjector",
				`No data source found on view — controller: ${!!controller}, results: ${!!controller?.results}`
			);
		} catch (error) {
			this.plugin.debugLog.error("BasesToolbarInjector", "Error extracting items", error);
		}

		return items;
	}

	/**
	 * Fallback: extract items by parsing the .base file's source filter.
	 * Queries metadataCache for files matching the folder path.
	 */
	private extractItemsFromBaseFile(baseFile: TFile): any[] {
		const items: any[] = [];
		try {
			// Read file synchronously from cache if available
			const cache = this.plugin.app.metadataCache.getFileCache(baseFile);
			const frontmatter = cache?.frontmatter;

			// .base files can have a source filter like 'folder: "TaskNotes/Tasks"'
			// For a generic fallback, just list all markdown files in the vault
			// that the cache knows about — this is a rough approximation
			const allFiles = this.plugin.app.vault.getMarkdownFiles();

			// If we can find the source folder from the base config, filter to that
			// (this is a best-effort heuristic since we can't evaluate the full query)
			for (const file of allFiles.slice(0, 200)) { // Cap at 200 for safety
				const fm = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
				items.push({
					path: file.path,
					itemType: "generic" as const,
					title: fm?.title || file.basename,
				});
			}

			if (items.length > 0) {
				this.plugin.debugLog.log(
					"BasesToolbarInjector",
					`Fallback: extracted ${items.length} items from vault files`
				);
			}
		} catch (error) {
			this.plugin.debugLog.error("BasesToolbarInjector", "Error parsing base file", error);
		}

		return items;
	}

	/**
	 * Find the WorkspaceLeaf that contains the given toolbar button element.
	 */
	private findLeafFromToolbar(button: HTMLElement): WorkspaceLeaf | null {
		// Traverse DOM to find the workspace-leaf container
		const leafEl = button.closest(".workspace-leaf");
		if (!leafEl) return null;

		// Find matching WorkspaceLeaf object
		let matchedLeaf: WorkspaceLeaf | null = null;
		this.plugin.app.workspace.iterateAllLeaves((leaf) => {
			if ((leaf as any).containerEl === leafEl) {
				matchedLeaf = leaf;
			}
		});

		return matchedLeaf;
	}

	/**
	 * Re-query a live toolbar for a given .base file path.
	 * After YAML saves Bases may destroy/recreate toolbar DOM, so the toolbar
	 * reference captured at panel-inject time can go stale.  This walks all
	 * live toolbars and matches by the leaf's file path.
	 */
	private findLiveToolbarForBase(baseFilePath: string | undefined): HTMLElement | null {
		if (!baseFilePath) return null;
		const toolbars = document.querySelectorAll(".bases-toolbar");
		for (const tb of toolbars) {
			const leaf = this.findLeafFromToolbar(tb as HTMLElement);
			if (leaf) {
				const file = (leaf.getViewState()?.state?.file as string) ?? "";
				if (file === baseFilePath) return tb as HTMLElement;
			}
		}
		return null;
	}

	// ── Configure View Panel Injection ─────────────────────────────

	/**
	 * Find all open Configure view panels and inject TaskNotes controls
	 * if not already injected.
	 */
	private async injectIntoConfigurePanels(): Promise<void> {
		if (!this.plugin.settings.enableUniversalBasesButtons) return;

		const panels = document.querySelectorAll(".view-config-menu");
		for (const panel of panels) {
			// Remove stale sections (e.g., from a previous view type before Layout dropdown change)
			const existing = panel.querySelectorAll(".tn-configure-panel-injected");
			if (existing.length > 1) {
				// Multiple sections = stale duplicates; remove all and re-inject
				existing.forEach(el => el.remove());
			} else if (existing.length === 1) {
				continue; // Already injected, skip
			}
			await this.injectConfigurePanelSection(panel as HTMLElement);
		}
	}

	/**
	 * Inject a branded TaskNotes section into a Configure view panel.
	 * Consistent across ALL view types (native + TN-registered):
	 * show toggle, notification toggle + "Notify when" dropdown +
	 * threshold slider, and "Default properties & anchors" link.
	 */
	private async injectConfigurePanelSection(panel: HTMLElement): Promise<void> {
		// Synchronous dedup: if already injected (possibly by a concurrent call), skip
		if (panel.querySelector(".tn-configure-panel-injected")) return;

		// Claim immediately with an empty marker to prevent races from concurrent async calls
		const section = document.createElement("div");
		section.className = "tn-configure-panel-injected";
		panel.appendChild(section);

		// Find the toolbar with the active views menu to identify the leaf
		const activeMenuBtn = document.querySelector(
			".bases-toolbar .bases-toolbar-views-menu .has-active-menu"
		) as HTMLElement | null;
		const toolbar = activeMenuBtn?.closest(".bases-toolbar") as HTMLElement | null;
		if (!toolbar) {
			section.remove(); // Clean up marker on failure
			return;
		}

		const leaf = this.findLeafFromToolbar(toolbar);
		const baseFilePath = leaf ? (leaf.getViewState()?.state?.file as string) : undefined;

		// Resolve view index + mapping context
		const mappingCtx = await this.resolveViewMappingFromLeaf(leaf, baseFilePath);
		const viewIndex = mappingCtx?.viewIndex ?? 0;

		// Read current state from .base YAML (single read for all fields)
		let notifyEnabled = false;
		let notifyOn = "any";
		let notifyThreshold = 1;
		let showControlsEnabled = true;
		let baseFile: TFile | null = null;

		if (baseFilePath) {
			const f = this.plugin.app.vault.getAbstractFileByPath(baseFilePath);
			if (f instanceof TFile) {
				baseFile = f;
				try {
					const config = await this.plugin.baseIdentityService.getViewNotificationConfig(f, viewIndex);
					notifyEnabled = config.notify;
					notifyOn = config.notifyOn;
					notifyThreshold = config.notifyThreshold;
				} catch {
					// Ignore read errors — defaults above
				}
				try {
					const content = await this.plugin.app.vault.read(f);
					const parsed = parseYaml(content);
					const viewConfig = parsed?.views?.[viewIndex];
					if (viewConfig?.showTaskNotesUI === false) showControlsEnabled = false;
				} catch {
					// Ignore — defaults above
				}
			}
		}

		// ── Build section content ──

		// Section heading with TaskNotes icon
		const heading = document.createElement("div");
		heading.className = "tn-configure-panel-heading";
		setIcon(heading.createSpan(), "tasknotes-simple");
		heading.appendText("TaskNotes");
		section.appendChild(heading);

		// "Show toolbar buttons" toggle row
		this.buildShowToolbarRow(section, showControlsEnabled, baseFile, baseFilePath, viewIndex, toolbar);

		// "Notify on matches" toggle row (with conditional sub-controls)
		this.buildNotifyToggleRow(section, notifyEnabled, notifyOn, notifyThreshold, baseFile, baseFilePath, viewIndex, panel);

		// "Default properties & anchors" link
		this.buildPropertiesLinkRow(section, panel, activeMenuBtn, toolbar, mappingCtx, baseFilePath);

		this.plugin.debugLog.log(
			"BasesToolbarInjector",
			`Injected TaskNotes section into Configure view panel for ${baseFilePath || "unknown"}`
		);
	}

	// ── Configure panel helper methods ──────────────────────────────

	/**
	 * Build "Show toolbar buttons" toggle row with "Global setting" link.
	 */
	private buildShowToolbarRow(
		section: HTMLElement,
		showControlsEnabled: boolean,
		baseFile: TFile | null,
		baseFilePath: string | undefined,
		viewIndex: number,
		toolbar: HTMLElement,
	): void {
		const row = document.createElement("div");
		row.className = "tn-configure-panel-row";

		const label = document.createElement("div");
		label.className = "tn-configure-panel-row-label";
		label.createSpan({ text: "Show toolbar buttons" });

		const hint = label.createEl("a", {
			cls: "tn-configure-panel-hint",
			text: "Global setting",
		});
		hint.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			const popupMenu = document.querySelector(".menu.bases-toolbar-views-menu") as HTMLElement | null;
			if (popupMenu) popupMenu.remove();
			(this.plugin.app as any).setting?.open?.();
			(this.plugin.app as any).setting?.openTabById?.(this.plugin.manifest.id);
			setTimeout(() => {
				const featuresBtn = document.querySelector("#tab-button-features") as HTMLElement | null;
				if (featuresBtn) {
					featuresBtn.click();
					setTimeout(() => {
						const tabContent = document.querySelector("#settings-tab-features");
						const headings = tabContent?.querySelectorAll(".setting-item-heading .setting-item-name");
						if (headings) {
							for (const h of headings) {
								if (h.textContent?.includes("Bases views")) {
									h.closest(".setting-item")?.scrollIntoView({ behavior: "smooth", block: "center" });
									break;
								}
							}
						}
					}, 200);
				}
			}, 200);
		});
		row.appendChild(label);

		const toggle = document.createElement("div");
		toggle.className = `checkbox-container${showControlsEnabled ? " is-enabled" : ""}`;
		toggle.tabIndex = 0;
		toggle.addEventListener("click", async () => {
			const newValue = !toggle.classList.contains("is-enabled");
			toggle.classList.toggle("is-enabled", newValue);
			if (baseFile) {
				try {
					const content = await this.plugin.app.vault.read(baseFile);
					const parsed = parseYaml(content);
					if (parsed?.views?.[viewIndex]) {
						if (newValue) {
							delete parsed.views[viewIndex].showTaskNotesUI;
						} else {
							parsed.views[viewIndex].showTaskNotesUI = false;
						}

						// Determine TN vs native from YAML view type (deterministic),
						// NOT from DOM class which depends on unpredictable re-mount timing.
						const viewType: string = parsed.views[viewIndex].type ?? "";
						const isTNView = viewType.startsWith("tasknotes");

						await this.plugin.app.vault.modify(baseFile, stringifyYaml(parsed));

						// If Bases re-mounts after the YAML save, the `toolbar` reference
						// may be stale (detached DOM) — DOM ops become harmless no-ops,
						// and the new BasesViewBase lifecycle handles injection.
						// If Bases does NOT re-mount, `toolbar` is still live and we
						// update it directly.
						if (toolbar) {
							if (isTNView) {
								// TN views: only manage Bulk tasking. "New task" is always
								// present (managed by BasesViewBase lifecycle).
								toolbar.querySelectorAll(".tn-bases-bulk-create-btn").forEach(btn => btn.remove());
								if (newValue) {
									this.injectBulkButtonOnly(toolbar);
								}
							} else {
								// Native views: manage all buttons
								toolbar.querySelectorAll(".tn-bases-new-task-btn, .tn-bases-bulk-create-btn").forEach(btn => btn.remove());
								if (newValue) {
									this.injectButtons(toolbar);
								}
							}
						}
					}

					this.plugin.debugLog.log(
						"BasesToolbarInjector",
						`Toggled showTaskNotesUI ${newValue ? "on" : "off"} for ${baseFilePath} view[${viewIndex}]`
					);
				} catch (error) {
					console.error("[TaskNotes] Failed to save showTaskNotesUI:", error);
					toggle.classList.toggle("is-enabled", !newValue);
				}
			}
		});
		row.appendChild(toggle);
		section.appendChild(row);
	}

	/**
	 * Build notification toggle row, plus conditional "Notify when" dropdown
	 * and "Threshold count" slider.
	 */
	private buildNotifyToggleRow(
		section: HTMLElement,
		notifyEnabled: boolean,
		_notifyOn: string,
		_notifyThreshold: number,
		baseFile: TFile | null,
		_baseFilePath: string | undefined,
		viewIndex: number,
		_panel: HTMLElement,
	): void {
		const row = document.createElement("div");
		row.className = "tn-configure-panel-row";

		const label = document.createElement("div");
		label.className = "tn-configure-panel-row-label";
		label.textContent = "Notify on matches";
		row.appendChild(label);

		const toggle = document.createElement("div");
		toggle.className = `checkbox-container${notifyEnabled ? " is-enabled" : ""}`;
		toggle.tabIndex = 0;
		toggle.addEventListener("click", async () => {
			const newValue = !toggle.classList.contains("is-enabled");
			toggle.classList.toggle("is-enabled", newValue);
			if (baseFile) {
				try {
					await this.plugin.baseIdentityService.setViewNotificationConfig(
						baseFile, viewIndex, { notify: newValue }
					);
				} catch (error) {
					console.error("[TaskNotes] Failed to save notification config:", error);
					toggle.classList.toggle("is-enabled", !newValue);
				}
			}
		});
		row.appendChild(toggle);
		section.appendChild(row);

		// Detailed notification config (Notify when, Threshold) is in the
		// BulkTaskCreationModal's "Base view defaults & settings" tab,
		// accessible via the "Default properties & anchors" link below.
	}

	/**
	 * Build clickable row that opens the BulkTaskCreationModal to the view settings tab.
	 * Acts as the gateway from the compact Configure panel to the full settings modal
	 * where users configure notifications, property mappings, and default values.
	 */
	private buildPropertiesLinkRow(
		section: HTMLElement,
		panel: HTMLElement,
		activeMenuBtn: HTMLElement | null,
		toolbar: HTMLElement,
		mappingCtx: { viewFieldMapping?: ViewFieldMapping; baseId?: string; viewId?: string; viewIndex?: number } | null,
		baseFilePath: string | undefined,
	): void {
		const row = document.createElement("div");
		row.className = "tn-configure-panel-row tn-configure-panel-settings-row";
		row.tabIndex = 0;

		const labelWrap = document.createElement("div");
		labelWrap.className = "tn-configure-panel-row-label";

		const labelText = document.createElement("div");
		labelText.textContent = "View defaults & settings";
		labelWrap.appendChild(labelText);

		const hint = document.createElement("div");
		hint.className = "tn-configure-panel-hint";
		hint.textContent = "Notifications, property mappings, defaults";
		labelWrap.appendChild(hint);

		row.appendChild(labelWrap);

		const arrow = document.createElement("div");
		arrow.className = "tn-configure-panel-settings-arrow";
		setIcon(arrow, "arrow-right");
		row.appendChild(arrow);

		row.addEventListener("click", async () => {
			// Close the popup menu
			const menu = panel.closest(".menu");
			const closeBtn = menu?.querySelector(".modal-close-button") as HTMLElement | null;
			if (closeBtn) {
				closeBtn.click();
			} else {
				activeMenuBtn?.click();
			}

			// Short delay for menu close, then open BulkTaskCreationModal to view settings
			setTimeout(async () => {
				const items = toolbar ? this.extractItemsFromToolbarContext(toolbar) : [];
				const modal = new BulkTaskCreationModal(
					this.plugin.app,
					this.plugin,
					items,
					{
						onTasksCreated: () => {},
						viewFieldMapping: mappingCtx?.viewFieldMapping,
						sourceBaseId: mappingCtx?.baseId,
						sourceViewId: mappingCtx?.viewId,
						viewIndex: mappingCtx?.viewIndex,
						openToViewSettings: true,
					},
					baseFilePath
				);
				modal.open();
			}, 100);
		});
		section.appendChild(row);
	}
}
