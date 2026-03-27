/**
 * PropertyPicker - Inline searchable property selector with type badges and compatibility indicators.
 *
 * Features:
 * - Searchable input with debounce
 * - Properties grouped by type with colored badges
 * - Vault-wide toggle to scan all task files
 * - Type compatibility warnings with conversion actions
 * - "Add new property" inline form
 *
 * Inspired by PersonGroupPicker, designed to embed inline within modals.
 */

import { setIcon, Notice, Modal } from "obsidian";
import type TaskNotesPlugin from "../main";
import {
	type PropertyType,
	type DiscoveredProperty,
	type PropertyCatalogEntry,
	discoverCustomProperties,
	buildPropertyCatalog,
	getAllTaskFilePaths,
	getAllMarkdownFilePaths,
	convertPropertyType,
	keyToDisplayName,
} from "../utils/propertyDiscoveryUtils";

/** A mapping target for the "Use as" popup — represents a core field this property can map to. */
export interface UseAsOption {
	/** Internal field key (e.g., "due", "scheduled") */
	key: string;
	/** Human-readable label (e.g., "Due date") */
	label: string;
	/** Required property type for this mapping (e.g., "date") — auto-converts if mismatched */
	requiresType: PropertyType;
}

/** Discovery scope for the PropertyPicker. */
export type PropertyScope = "currentNote" | "viewItems" | "allTasks" | "allFiles";

export interface PropertyPickerOptions {
	/** Container element to render into */
	container: HTMLElement;
	/** The TaskNotes plugin instance */
	plugin: TaskNotesPlugin;
	/** Current file path (for single-file discovery) */
	currentFilePath?: string;
	/** File paths for bulk/view items */
	itemPaths?: string[];
	/** Keys already rendered elsewhere (to exclude from results) */
	excludeKeys?: Set<string>;
	/** Callback when a property is selected. Optional `useAs` field key when a mapping target is selected. */
	onSelect: (key: string, type: PropertyType, value?: any, useAs?: string) => void;
	/** Callback for type conversion (optional) */
	onConvert?: (
		key: string,
		targetType: PropertyType,
		files: string[],
		strategy: "convert-in-place" | "create-duplicate"
	) => Promise<void>;
	/** Restrict which types can be conversion targets. If unset, all types available. */
	allowedConversionTargets?: PropertyType[];
	/** Mapping targets to show in "Use as" popup. If set, replaces "Convert →" with "Use as →". */
	useAsOptions?: UseAsOption[];
	/** Currently claimed mappings: { fieldKey: propertyKey } — disables claimed options. */
	claimedMappings?: Record<string, string>;
	/** Called when an async conversion flow starts (e.g. confirmation modal opens). */
	onConversionStart?: () => void;
	/** Called when an async conversion flow ends (regardless of outcome). */
	onConversionEnd?: () => void;
	/** Initial scope for property discovery (for restoring across re-renders) */
	initialScope?: PropertyScope;
	/** Called when the scope changes */
	onScopeChange?: (scope: PropertyScope) => void;
	/** @deprecated Use initialScope="allFiles" instead. When true, vault-wide scan includes all markdown files. */
	initialVaultWide?: boolean;
	/** @deprecated Use onScopeChange instead. */
	onVaultWideChange?: (checked: boolean) => void;
	/** @deprecated Use scope chips instead. When true, vault-wide scan includes all markdown files, not just task files */
	includeNonTaskFiles?: boolean;
}

/** Type badge color mapping */
const TYPE_COLORS: Record<PropertyType, string> = {
	date: "var(--color-blue)",
	text: "var(--color-green)",
	number: "var(--color-purple)",
	boolean: "var(--color-orange)",
	list: "var(--color-cyan)",
};

/** Type badge labels */
const TYPE_LABELS: Record<PropertyType, string> = {
	date: "Date",
	text: "Text",
	number: "Num",
	boolean: "Bool",
	list: "List",
};

/**
 * Show a confirmation modal before destructive property type conversion.
 * Shared between PropertyPicker, Settings, and any other conversion sites.
 *
 * If `onConvert` is provided, clicking "Convert" runs the conversion with a
 * progress bar inside the modal. The modal stays open until conversion completes.
 * If omitted, behaves as a simple confirm/cancel dialog.
 */
export function showConversionConfirmation(
	app: InstanceType<typeof import("obsidian").App>,
	key: string,
	targetType: string,
	fileCount: number,
	onConvert?: (onProgress: (completed: number, total: number) => void) => Promise<{ converted: number; failed: number }>,
): Promise<boolean> {
	return new Promise((resolve) => {
		const modal = new Modal(app);
		let resolved = false;
		modal.titleEl.textContent = `Convert "${key}" to ${targetType}?`;
		const content = modal.contentEl;
		content.createEl("p", {
			text: `This will modify frontmatter in ${fileCount} file${fileCount !== 1 ? "s" : ""}. Values that cannot be parsed will be set to defaults.`,
		});
		const warningEl = content.createEl("p", {
			text: "This action cannot be undone.",
		});
		warningEl.style.cssText = "color: var(--text-warning); font-weight: 500;";

		// Progress bar (hidden initially)
		const progressContainer = content.createDiv({ cls: "tn-pp-conversion-progress" });
		progressContainer.style.display = "none";
		const progressLabel = progressContainer.createDiv({ cls: "tn-pp-conversion-progress__label" });
		const progressTrack = progressContainer.createDiv({ cls: "tn-pp-conversion-progress__track" });
		const progressBar = progressTrack.createDiv({ cls: "tn-pp-conversion-progress__bar" });
		progressBar.style.width = "0%";

		const buttonRow = content.createDiv({ cls: "modal-button-container" });
		const cancelBtn = buttonRow.createEl("button", { text: "Cancel" });
		const convertBtn = buttonRow.createEl("button", { text: "Convert", cls: "mod-cta" });

		cancelBtn.addEventListener("click", () => { resolved = true; resolve(false); modal.close(); });

		convertBtn.addEventListener("click", async () => {
			if (!onConvert) {
				resolved = true; resolve(true); modal.close();
				return;
			}
			// Transition to progress state
			cancelBtn.disabled = true;
			convertBtn.disabled = true;
			convertBtn.textContent = "Converting...";
			warningEl.style.display = "none";
			progressContainer.style.display = "block";
			progressLabel.textContent = `Converting 0 / ${fileCount}...`;

			try {
				const result = await onConvert((completed, total) => {
					const pct = Math.round((completed / total) * 100);
					progressBar.style.width = `${pct}%`;
					progressLabel.textContent = `Converting ${completed} / ${total}...`;
				});
				progressBar.style.width = "100%";
				if (result.failed > 0) {
					progressLabel.textContent = `Done: ${result.converted} converted, ${result.failed} failed`;
				} else {
					progressLabel.textContent = `Converted ${result.converted} file${result.converted !== 1 ? "s" : ""} successfully`;
				}
				// Brief pause to show completion before closing
				await new Promise(r => setTimeout(r, 600));
				resolved = true; resolve(true); modal.close();
			} catch (err) {
				progressLabel.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
				progressLabel.style.color = "var(--text-error)";
				cancelBtn.disabled = false;
				cancelBtn.textContent = "Close";
			}
		});

		modal.onClose = () => { if (!resolved) resolve(false); };
		modal.open();
	});
}

/**
 * Create a PropertyPicker component.
 */
export function createPropertyPicker(options: PropertyPickerOptions): {
	refresh: () => void;
	destroy: () => void;
} {
	const {
		container,
		plugin,
		currentFilePath,
		itemPaths,
		excludeKeys = new Set(),
		onSelect,
		onConvert,
		allowedConversionTargets,
		useAsOptions,
		claimedMappings,
		onConversionStart,
		onConversionEnd,
		includeNonTaskFiles,
	} = options;

	// State — resolve initial scope from options (with backward compat for initialVaultWide)
	let searchQuery = "";
	const defaultScope: PropertyScope = options.initialScope
		? options.initialScope
		: options.initialVaultWide
			? (includeNonTaskFiles ? "allFiles" : "allTasks")
			: itemPaths?.length ? "viewItems"
			: currentFilePath ? "currentNote"
			: "allTasks";
	let currentScope: PropertyScope = defaultScope;
	let isDropdownOpen = false;
	let discoveredProps: DiscoveredProperty[] = [];
	let catalogEntries: PropertyCatalogEntry[] = [];
	let showAddForm = false;

	// Create DOM structure
	container.empty();
	container.addClass("tn-property-picker");

	// Header row: search + scope chips
	const headerRow = container.createDiv({ cls: "tn-pp-header" });

	const searchContainer = headerRow.createDiv({ cls: "tn-pp-search-container" });
	const searchIcon = searchContainer.createSpan({ cls: "tn-pp-search-icon" });
	setIcon(searchIcon, "search");
	const searchInput = searchContainer.createEl("input", {
		cls: "tn-pp-search",
		attr: {
			type: "text",
			placeholder: "Search properties...",
		},
	});
	// Inline style to override Obsidian's input padding (higher specificity than class selectors)
	searchInput.style.paddingLeft = "34px";

	// Scope chips — replace the old vault-wide checkbox
	const scopeChipsContainer = headerRow.createDiv({ cls: "tn-pp-scope-chips" });

	type ScopeChipDef = { scope: PropertyScope; label: string; available: boolean };
	const scopeChips: ScopeChipDef[] = [
		{ scope: "currentNote", label: "This note", available: !!currentFilePath },
		{ scope: "viewItems", label: "View items", available: !!(itemPaths?.length) },
		{ scope: "allTasks", label: "All tasks", available: true },
		{ scope: "allFiles", label: "All files", available: true },
	];

	function renderScopeChips() {
		scopeChipsContainer.empty();
		for (const chip of scopeChips) {
			if (!chip.available) continue;
			const el = scopeChipsContainer.createSpan({
				cls: `tn-pp-scope-chip${chip.scope === currentScope ? " tn-pp-scope-chip--active" : ""}`,
				text: chip.label,
			});
			el.addEventListener("click", () => {
				if (chip.scope === currentScope) return;
				currentScope = chip.scope;
				if (options.onScopeChange) options.onScopeChange(currentScope);
				// Backward compat: fire onVaultWideChange if provided
				if (options.onVaultWideChange) {
					options.onVaultWideChange(currentScope === "allTasks" || currentScope === "allFiles");
				}
				renderScopeChips();
				if (isDropdownOpen) {
					loadProperties();
					renderDropdown();
				}
			});
		}
	}
	renderScopeChips();

	// Dropdown container - appended to body to escape modal overflow
	const dropdown = document.body.createDiv({ cls: "tn-pp-dropdown" });
	dropdown.style.display = "none";

	// ── Data loading ──────────────────────────────────

	function loadProperties() {
		switch (currentScope) {
			case "currentNote":
				if (currentFilePath) {
					discoveredProps = discoverCustomProperties(plugin, currentFilePath, excludeKeys);
					catalogEntries = [];
				} else {
					// Shouldn't happen (chip hidden when no currentFilePath), but fall back gracefully
					catalogEntries = buildPropertyCatalog(plugin, getAllTaskFilePaths(plugin), excludeKeys);
					discoveredProps = [];
				}
				break;
			case "viewItems":
				if (itemPaths?.length) {
					catalogEntries = buildPropertyCatalog(plugin, itemPaths, excludeKeys);
					discoveredProps = [];
				} else {
					catalogEntries = buildPropertyCatalog(plugin, getAllTaskFilePaths(plugin), excludeKeys);
					discoveredProps = [];
				}
				break;
			case "allTasks":
				catalogEntries = buildPropertyCatalog(plugin, getAllTaskFilePaths(plugin), excludeKeys);
				discoveredProps = [];
				break;
			case "allFiles":
				catalogEntries = buildPropertyCatalog(plugin, getAllMarkdownFilePaths(plugin), excludeKeys);
				discoveredProps = [];
				break;
		}
	}

	/** Scope-aware empty state message. */
	function scopeEmptyMessage(): string {
		switch (currentScope) {
			case "currentNote":
				return "No additional properties found in this note";
			case "viewItems":
				return "No additional properties found in view items";
			case "allTasks":
				return "No additional properties found across task files";
			case "allFiles":
				return "No additional properties found across vault files";
		}
	}

	// ── Rendering ─────────────────────────────────────

	function renderDropdown() {
		dropdown.empty();

		const query = searchQuery.toLowerCase();

		// Use single-file view for "This note" scope, catalog view for all other scopes
		if (currentScope === "currentNote" && discoveredProps.length > 0) {
			renderSingleFileView(query);
		} else {
			renderCatalogView(query);
		}

		// Add new property option at bottom
		renderAddNewProperty();
	}

	function renderSingleFileView(query: string) {
		const filtered = discoveredProps.filter((p) => {
			if (query && !p.key.toLowerCase().includes(query) && !p.displayName.toLowerCase().includes(query)) {
				return false;
			}
			return true;
		});

		if (filtered.length === 0 && !showAddForm) {
			const emptyMsg = dropdown.createDiv({ cls: "tn-pp-empty" });
			emptyMsg.textContent = query
				? "No matching properties"
				: scopeEmptyMessage();
			return;
		}

		// Group by type
		const groups = groupByType(filtered);
		for (const [type, props] of groups) {
			renderTypeSection(type as PropertyType, props);
		}
	}

	function renderCatalogView(query: string) {
		const filtered = catalogEntries.filter((e) => {
			if (query && !e.key.toLowerCase().includes(query) && !e.displayName.toLowerCase().includes(query)) {
				return false;
			}
			return true;
		});

		if (filtered.length === 0 && !showAddForm) {
			const emptyMsg = dropdown.createDiv({ cls: "tn-pp-empty" });
			emptyMsg.textContent = query
				? "No matching properties"
				: scopeEmptyMessage();
			return;
		}

		// Group by dominant type
		const groups = new Map<PropertyType, PropertyCatalogEntry[]>();
		for (const entry of filtered) {
			const existing = groups.get(entry.dominantType) || [];
			existing.push(entry);
			groups.set(entry.dominantType, existing);
		}

		// Render in type order: date, text, number, boolean, list
		const typeOrder: PropertyType[] = ["date", "text", "number", "boolean", "list"];
		for (const type of typeOrder) {
			const entries = groups.get(type);
			if (!entries?.length) continue;
			renderCatalogTypeSection(type, entries);
		}
	}

	function groupByType(props: DiscoveredProperty[]): Map<string, DiscoveredProperty[]> {
		const groups = new Map<string, DiscoveredProperty[]>();
		const typeOrder: PropertyType[] = ["date", "text", "number", "boolean", "list"];

		for (const type of typeOrder) {
			const matching = props.filter((p) => p.type === type);
			if (matching.length > 0) {
				groups.set(type, matching);
			}
		}
		return groups;
	}

	function renderTypeSection(type: PropertyType, props: DiscoveredProperty[]) {
		const section = dropdown.createDiv({ cls: "tn-pp-section" });

		// Section header with type badge
		const header = section.createDiv({ cls: "tn-pp-section-header" });
		createTypeBadge(header, type);
		header.createSpan({ text: TYPE_LABELS[type] + "s", cls: "tn-pp-section-title" });

		for (const prop of props) {
			const item = section.createDiv({ cls: "tn-pp-item" });

			// Property name (raw key)
			item.createSpan({ cls: "tn-pp-item-key", text: prop.key });

			// Current value (if set)
			const valueText = formatValue(prop.value, prop.type);
			if (valueText) {
				item.createSpan({ cls: "tn-pp-item-value", text: valueText });
			} else {
				item.createSpan({ cls: "tn-pp-item-value tn-pp-item-value--empty", text: "(not set)" });
			}

			// "Use as →" button (only if useAsOptions provided)
			if (useAsOptions?.length) {
				const useAsBtn = item.createSpan({ cls: "tn-pp-convert-btn" });
				useAsBtn.textContent = "Use as \u2192";
				useAsBtn.title = "Choose what to use this property for";
				useAsBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					showUseAsMenuForSingleFile(useAsBtn, prop);
				});
			}

			item.addEventListener("click", () => {
				onSelect(prop.key, prop.type, prop.value);
				closeDropdown();
			});
		}
	}

	function renderCatalogTypeSection(type: PropertyType, entries: PropertyCatalogEntry[]) {
		const section = dropdown.createDiv({ cls: "tn-pp-section" });

		// Section header
		const header = section.createDiv({ cls: "tn-pp-section-header" });
		createTypeBadge(header, type);
		header.createSpan({ text: TYPE_LABELS[type] + "s", cls: "tn-pp-section-title" });

		for (const entry of entries) {
			const item = section.createDiv({ cls: "tn-pp-item" });
			item.dataset.propertyKey = entry.key;

			// Property name (raw key)
			item.createSpan({ cls: "tn-pp-item-key", text: entry.key });

			// File count
			item.createSpan({
				cls: "tn-pp-item-count",
				text: `${entry.fileCount} file${entry.fileCount !== 1 ? "s" : ""}`,
			});

			// Type consistency warning — some files have a different type for this property
			if (!entry.isConsistent) {
				// Build a human-readable breakdown: e.g., "18 date, 1 text"
				const breakdownParts: string[] = [];
				for (const [type, count] of Object.entries(entry.typeBreakdown)) {
					breakdownParts.push(`${count} ${type}`);
				}
				const breakdownText = breakdownParts.join(", ");
				const tooltipText =
					`${entry.mismatchedFiles.length} file${entry.mismatchedFiles.length !== 1 ? "s" : ""} ` +
					`use a different type than ${entry.dominantType}.\n` +
					`Types found: ${breakdownText}.\n` +
					`Click to fix.`;

				const warningContainer = item.createSpan({ cls: "tn-pp-item-warning" });
				warningContainer.title = tooltipText;
				const warningIcon = warningContainer.createSpan({ cls: "tn-pp-warning-icon" });
				setIcon(warningIcon, "alert-triangle");
				warningContainer.createSpan({
					text: `${entry.mismatchedFiles.length} mixed type`,
					cls: "tn-pp-warning-text",
				});

				// Conversion dropdown on warning click
				warningContainer.addEventListener("click", (e) => {
					e.stopPropagation();
					showConversionMenu(warningContainer, entry);
				});
			}

			// "Use as →" button (when useAsOptions provided) or conversion button (fallback)
			if (useAsOptions?.length) {
				const useAsBtn = item.createSpan({ cls: "tn-pp-convert-btn" });
				useAsBtn.textContent = "Use as \u2192";
				useAsBtn.title = "Choose what to use this property for";
				useAsBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					showUseAsMenu(useAsBtn, entry);
				});
			} else {
				const ALL_TYPES: PropertyType[] = ["date", "text", "number", "boolean", "list"];
				const targets = (allowedConversionTargets || ALL_TYPES)
					.filter(t => t !== entry.dominantType);

				if (targets.length === 1) {
					// Single target: simple button (e.g., "→ date" in ReminderModal)
					const convertBtn = item.createSpan({ cls: "tn-pp-convert-btn" });
					convertBtn.textContent = `\u2192 ${targets[0]}`;
					convertBtn.title = `Convert ${entry.fileCount} file(s) to ${targets[0]}`;
					convertBtn.addEventListener("click", async (e) => {
						e.stopPropagation();
						closeDropdown();
						onConversionStart?.();
						try {
							const confirmed = await showConversionConfirmation(
								plugin.app, entry.key, targets[0], entry.allFiles.length,
								async (onProgress) => {
									const result = await convertPropertyType(plugin, entry.key, targets[0], entry.allFiles, "convert-in-place", onProgress);
									return result;
								}
							);
							if (!confirmed) { onConversionEnd?.(); openDropdown(); return; }
							setTimeout(() => refresh(), 500);
							onConversionEnd?.();
							onSelect(entry.key, targets[0]);
						} catch (err) {
							onConversionEnd?.();
							throw err;
						}
					});
				} else if (targets.length > 1) {
					// Multiple targets: button opens popup menu
					const convertBtn = item.createSpan({ cls: "tn-pp-convert-btn" });
					convertBtn.textContent = "Convert \u2192";
					convertBtn.title = `Convert ${entry.fileCount} file(s) to another type`;
					convertBtn.addEventListener("click", (e) => {
						e.stopPropagation();
						showTypeConversionMenu(convertBtn, entry, targets);
					});
				}
			}

			item.addEventListener("click", () => {
				// If this is a non-date property and we're in a date-only context (e.g., ReminderModal),
				// don't close — instead highlight the convert button and show a hint.
				if (allowedConversionTargets?.includes("date") && entry.dominantType !== "date") {
					// Remove any previous hints
					dropdown.querySelectorAll(".tn-pp-convert-hint").forEach(el => el.remove());
					dropdown.querySelectorAll(".tn-pp-convert-btn--flash").forEach(el =>
						el.classList.remove("tn-pp-convert-btn--flash"));
					// Flash the convert button
					const convertBtn = item.querySelector(".tn-pp-convert-btn");
					if (convertBtn) {
						convertBtn.classList.add("tn-pp-convert-btn--flash");
						setTimeout(() => convertBtn.classList.remove("tn-pp-convert-btn--flash"), 2000);
					}
					// Show inline hint below the row
					const hint = item.createDiv({ cls: "tn-pp-convert-hint" });
					hint.textContent = `Convert "${entry.key}" to date to use as a reminder anchor \u2191`;
					setTimeout(() => hint.remove(), 4000);
					return;
				}
				onSelect(entry.key, entry.dominantType);
				closeDropdown();
			});
		}
	}

	function renderAddNewProperty() {
		const addSection = dropdown.createDiv({ cls: "tn-pp-add-section" });

		if (!showAddForm) {
			const addBtn = addSection.createDiv({ cls: "tn-pp-add-btn" });
			const addIcon = addBtn.createSpan({ cls: "tn-pp-add-icon" });
			setIcon(addIcon, "plus");
			addBtn.createSpan({ text: "Add new property" });
			addBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				showAddForm = true;
				renderDropdown();
				positionDropdown();
			});
		} else {
			renderAddForm(addSection);
		}
	}

	function renderAddForm(container: HTMLElement) {
		const form = container.createDiv({ cls: "tn-pp-add-form" });

		// Stop keydown propagation so Obsidian's modal Scope doesn't eat keystrokes.
		// The dropdown lives on document.body (outside the modal DOM), so without this,
		// the modal's keyboard scope intercepts all key events.
		form.addEventListener("keydown", (e) => e.stopPropagation());

		// Key input
		const keyInput = form.createEl("input", {
			cls: "tn-pp-add-key",
			attr: { type: "text", placeholder: "Property name (e.g., review_date)" },
		});

		// Type selector — custom dropdown instead of native <select> to avoid
		// Electron/Obsidian capturing native option-list clicks and closing the picker.
		const types: PropertyType[] = ["text", "date", "number", "boolean", "list"];
		let selectedType: PropertyType = "text";
		const typeWrapper = form.createDiv({ cls: "tn-pp-add-type-wrapper" });
		const typeBtn = typeWrapper.createEl("button", { cls: "tn-pp-add-type" });
		typeBtn.innerHTML = TYPE_LABELS["text"] + ' <span class="tn-pp-add-type-caret">▾</span>';
		const typeMenu = typeWrapper.createDiv({ cls: "tn-pp-add-type-menu" });
		typeMenu.style.display = "none";
		for (const t of types) {
			const opt = typeMenu.createDiv({ cls: "tn-pp-add-type-option" });
			opt.textContent = TYPE_LABELS[t];
			opt.dataset.type = t;
			opt.addEventListener("click", (e) => {
				e.stopPropagation();
				selectedType = t;
				typeBtn.innerHTML = TYPE_LABELS[t] + ' <span class="tn-pp-add-type-caret">▾</span>';
				typeMenu.style.display = "none";
				// Highlight active option
				typeMenu.querySelectorAll(".tn-pp-add-type-option").forEach(el =>
					el.classList.toggle("is-active", (el as HTMLElement).dataset.type === t));
			});
		}
		// Mark initial selection
		(typeMenu.querySelector('[data-type="text"]') as HTMLElement)?.classList.add("is-active");
		typeBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			e.preventDefault();
			const isVisible = typeMenu.style.display !== "none";
			typeMenu.style.display = isVisible ? "none" : "block";
		});
		// Alias for submit handler compatibility
		const typeSelect = { get value() { return selectedType; } };

		// Submit button
		const submitBtn = form.createDiv({ cls: "tn-pp-add-submit" });
		setIcon(submitBtn, "check");
		submitBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			const key = keyInput.value.trim().replace(/\s+/g, "_");
			if (!key) return;
			const type = typeSelect.value as PropertyType;
			onSelect(key, type);
			showAddForm = false;
			closeDropdown();
		});

		// Cancel button
		const cancelBtn = form.createDiv({ cls: "tn-pp-add-cancel" });
		setIcon(cancelBtn, "x");
		cancelBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			showAddForm = false;
			renderDropdown();
		});

		// Focus key input
		setTimeout(() => keyInput.focus(), 50);
	}

	// ── Conversion menu ───────────────────────────────

	function showConversionMenu(anchor: HTMLElement, entry: PropertyCatalogEntry) {
		// Remove any existing conversion menu
		const existing = dropdown.querySelector(".tn-pp-conversion-menu");
		if (existing) existing.remove();
		document.querySelectorAll(".tn-pp-conversion-menu").forEach(el => el.remove());

		const menu = document.createElement("div");
		menu.className = "tn-pp-conversion-menu";

		// Fixed positioning on body to avoid popover overflow clipping
		const anchorRect = anchor.getBoundingClientRect();
		menu.style.position = "fixed";
		menu.style.left = `${anchorRect.left}px`;
		menu.style.right = "auto";
		menu.style.zIndex = "10002";
		const menuHeight = 120;
		const spaceBelow = window.innerHeight - anchorRect.bottom;
		if (spaceBelow < menuHeight && anchorRect.top > menuHeight) {
			menu.style.bottom = `${window.innerHeight - anchorRect.top + 2}px`;
			menu.style.top = "auto";
		} else {
			menu.style.top = `${anchorRect.bottom + 2}px`;
			menu.style.bottom = "auto";
		}
		document.body.appendChild(menu);

		// Convert in-place option
		const convertBtn = menu.createDiv({ cls: "tn-pp-conversion-option" });
		convertBtn.createSpan({
			text: `Fix ${entry.mismatchedFiles.length} \u2192 ${TYPE_LABELS[entry.dominantType].toLowerCase()}`,
		});
		convertBtn.title = `Convert ${entry.mismatchedFiles.length} mismatched files to ${TYPE_LABELS[entry.dominantType].toLowerCase()}`;
		convertBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			menu.remove();
			if (onConvert) {
				await onConvert(entry.key, entry.dominantType, entry.mismatchedFiles, "convert-in-place");
			} else {
				await runConversion(entry.key, entry.dominantType, entry.mismatchedFiles, "convert-in-place");
			}
			refresh();
		});

		// Create duplicate option
		const duplicateBtn = menu.createDiv({ cls: "tn-pp-conversion-option" });
		duplicateBtn.createSpan({
			text: `Duplicate with suffix "_${entry.dominantType}"`,
		});
		duplicateBtn.title = `Create ${entry.key}_${entry.dominantType} copy for mismatched files`;
		duplicateBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			menu.remove();
			if (onConvert) {
				await onConvert(entry.key, entry.dominantType, entry.mismatchedFiles, "create-duplicate");
			} else {
				await runConversion(entry.key, entry.dominantType, entry.mismatchedFiles, "create-duplicate");
			}
			refresh();
		});

		// Show mismatched files
		const showFilesBtn = menu.createDiv({ cls: "tn-pp-conversion-option" });
		showFilesBtn.createSpan({ text: `View ${entry.mismatchedFiles.length} files` });
		showFilesBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			menu.remove();
			showMismatchedFiles(anchor, entry);
		});

		// Close menu on outside click
		const closeHandler = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener("click", closeHandler, true);
			}
		};
		setTimeout(() => document.addEventListener("click", closeHandler, true), 0);
	}

	function showTypeConversionMenu(
		anchor: HTMLElement,
		entry: PropertyCatalogEntry,
		targets: PropertyType[]
	) {
		// Remove any existing menu
		const existing = dropdown.querySelector(".tn-pp-type-conversion-menu");
		if (existing) existing.remove();
		document.querySelectorAll(".tn-pp-type-conversion-menu").forEach(el => el.remove());

		const menu = document.createElement("div");
		menu.className = "tn-pp-conversion-menu tn-pp-type-conversion-menu";

		// Fixed positioning on body to avoid popover overflow clipping
		const anchorRect = anchor.getBoundingClientRect();
		menu.style.position = "fixed";
		menu.style.left = `${anchorRect.left}px`;
		menu.style.right = "auto";
		menu.style.zIndex = "10002";
		const menuHeight = targets.length * 36 + 8;
		const spaceBelow = window.innerHeight - anchorRect.bottom;
		if (spaceBelow < menuHeight && anchorRect.top > menuHeight) {
			menu.style.bottom = `${window.innerHeight - anchorRect.top + 2}px`;
			menu.style.top = "auto";
		} else {
			menu.style.top = `${anchorRect.bottom + 2}px`;
			menu.style.bottom = "auto";
		}
		document.body.appendChild(menu);

		for (const targetType of targets) {
			const option = menu.createDiv({ cls: "tn-pp-conversion-option" });
			// Show "Current → Target" with colored badges for both types
			const srcBadge = option.createSpan({ cls: `tn-pp-type-badge tn-pp-type-badge--${entry.dominantType}` });
			srcBadge.textContent = TYPE_LABELS[entry.dominantType];
			srcBadge.style.setProperty("--badge-color", TYPE_COLORS[entry.dominantType]);
			option.createSpan({ text: " \u2192 ", cls: "tn-pp-conversion-arrow" });
			const tgtBadge = option.createSpan({ cls: `tn-pp-type-badge tn-pp-type-badge--${targetType}` });
			tgtBadge.textContent = TYPE_LABELS[targetType];
			tgtBadge.style.setProperty("--badge-color", TYPE_COLORS[targetType]);

			option.addEventListener("click", async (e) => {
				e.stopPropagation();
				menu.remove();
				closeDropdown();
				onConversionStart?.();
				try {
					const confirmed = await showConversionConfirmation(
						plugin.app, entry.key, targetType, entry.allFiles.length,
						async (onProgress) => {
							const result = await convertPropertyType(plugin, entry.key, targetType, entry.allFiles, "convert-in-place", onProgress);
							return result;
						}
					);
					if (!confirmed) { onConversionEnd?.(); openDropdown(); return; }
					setTimeout(() => refresh(), 500);
					onConversionEnd?.();
					onSelect(entry.key, targetType);
				} catch (err) {
					onConversionEnd?.();
					throw err;
				}
			});
		}

		// Close menu on outside click
		const closeHandler = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener("click", closeHandler, true);
			}
		};
		setTimeout(() => document.addEventListener("click", closeHandler, true), 0);
	}

	function showUseAsMenu(anchor: HTMLElement, entry: PropertyCatalogEntry) {
		// Remove any existing menu
		document.querySelectorAll(".tn-pp-use-as-menu").forEach(el => el.remove());

		const menu = document.createElement("div");
		menu.className = "tn-pp-conversion-menu tn-pp-use-as-menu";

		// Append to body with fixed positioning to avoid dropdown overflow clipping
		const anchorRect = anchor.getBoundingClientRect();
		menu.style.position = "fixed";
		menu.style.left = `${anchorRect.left}px`;
		menu.style.right = "auto";
		menu.style.zIndex = "10002";
		document.body.appendChild(menu);

		// Flip above if menu would overflow viewport bottom
		const menuHeight = 220; // approximate height for 4 options + separator + custom + footer
		const spaceBelow = window.innerHeight - anchorRect.bottom;
		if (spaceBelow < menuHeight && anchorRect.top > menuHeight) {
			menu.style.bottom = `${window.innerHeight - anchorRect.top + 2}px`;
			menu.style.top = "auto";
		} else {
			menu.style.top = `${anchorRect.bottom + 2}px`;
			menu.style.bottom = "auto";
		}

		// Date mapping options
		for (const option of useAsOptions!) {
			const optionEl = menu.createDiv({ cls: "tn-pp-conversion-option" });

			// Check if claimed by another property
			const claimedBy = claimedMappings?.[option.key];
			const isClaimed = !!claimedBy && claimedBy !== entry.key;

			if (isClaimed) {
				optionEl.addClass("tn-pp-conversion-option--disabled");
			}

			// Label
			optionEl.createSpan({ text: option.label });

			// Target type badge
			optionEl.createSpan({ text: " " });
			const badge = optionEl.createSpan({ cls: `tn-pp-type-badge tn-pp-type-badge--${option.requiresType}` });
			badge.textContent = TYPE_LABELS[option.requiresType];
			badge.style.setProperty("--badge-color", TYPE_COLORS[option.requiresType]);

			// Conversion note if type mismatch
			if (entry.dominantType !== option.requiresType) {
				optionEl.createSpan({
					text: ` (converts from ${entry.dominantType})`,
					cls: "tn-pp-use-as-convert-note",
				});
			}

			// Claimed note
			if (isClaimed) {
				optionEl.createSpan({
					text: ` \u2014 used by ${claimedBy}`,
					cls: "tn-pp-use-as-convert-note",
				});
			}

			if (!isClaimed) {
				optionEl.addEventListener("click", async (e) => {
					e.stopPropagation();
					menu.remove();
					closeDropdown();
					try {
						// Auto-convert if type mismatch (with confirmation)
						if (entry.dominantType !== option.requiresType) {
							onConversionStart?.();
							try {
								const confirmed = await showConversionConfirmation(
									plugin.app, entry.key, option.requiresType, entry.allFiles.length,
									async (onProgress) => {
										const result = await convertPropertyType(plugin, entry.key, option.requiresType, entry.allFiles, "convert-in-place", onProgress);
										return result;
									}
								);
								if (!confirmed) { onConversionEnd?.(); openDropdown(); return; }
								setTimeout(() => refresh(), 500);
							} catch (err) {
								onConversionEnd?.();
								throw err;
							}
							onConversionEnd?.();
						}
						onSelect(entry.key, option.requiresType, entry.sampleValue, option.key);
					} catch (err) {
						console.error("[PropertyPicker] Use-as error:", err);
					}
				});
			}
		}

		// Separator
		menu.createDiv({ cls: "tn-pp-use-as-separator" });

		// "Custom field" option — add as-is with no mapping
		const customOption = menu.createDiv({ cls: "tn-pp-conversion-option" });
		customOption.createSpan({ text: "Custom field" });
		customOption.addEventListener("click", (e) => {
			e.stopPropagation();
			menu.remove();
			onSelect(entry.key, entry.dominantType);
			closeDropdown();
		});

		// Footer note
		menu.createDiv({
			cls: "tn-pp-use-as-footer",
			text: "More mapping targets in future releases",
		});

		// Close menu on outside click
		const closeHandler = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener("click", closeHandler, true);
			}
		};
		setTimeout(() => document.addEventListener("click", closeHandler, true), 0);
	}

	function showUseAsMenuForSingleFile(anchor: HTMLElement, prop: DiscoveredProperty) {
		// Remove any existing menu
		document.querySelectorAll(".tn-pp-use-as-menu").forEach(el => el.remove());

		const menu = document.createElement("div");
		menu.className = "tn-pp-conversion-menu tn-pp-use-as-menu";

		// Append to body with fixed positioning to avoid dropdown overflow clipping
		const anchorRect = anchor.getBoundingClientRect();
		menu.style.position = "fixed";
		menu.style.left = `${anchorRect.left}px`;
		menu.style.right = "auto";
		menu.style.zIndex = "10002";
		document.body.appendChild(menu);

		// Flip above if menu would overflow viewport bottom
		const menuHeight = 220;
		const spaceBelow = window.innerHeight - anchorRect.bottom;
		if (spaceBelow < menuHeight && anchorRect.top > menuHeight) {
			menu.style.bottom = `${window.innerHeight - anchorRect.top + 2}px`;
			menu.style.top = "auto";
		} else {
			menu.style.top = `${anchorRect.bottom + 2}px`;
			menu.style.bottom = "auto";
		}

		for (const option of useAsOptions!) {
			const optionEl = menu.createDiv({ cls: "tn-pp-conversion-option" });

			const claimedBy = claimedMappings?.[option.key];
			const isClaimed = !!claimedBy && claimedBy !== prop.key;

			if (isClaimed) {
				optionEl.addClass("tn-pp-conversion-option--disabled");
			}

			optionEl.createSpan({ text: option.label });
			optionEl.createSpan({ text: " " });
			const badge = optionEl.createSpan({ cls: `tn-pp-type-badge tn-pp-type-badge--${option.requiresType}` });
			badge.textContent = TYPE_LABELS[option.requiresType];
			badge.style.setProperty("--badge-color", TYPE_COLORS[option.requiresType]);

			if (prop.type !== option.requiresType) {
				optionEl.createSpan({
					text: ` (converts from ${prop.type})`,
					cls: "tn-pp-use-as-convert-note",
				});
			}

			if (isClaimed) {
				optionEl.createSpan({
					text: ` \u2014 used by ${claimedBy}`,
					cls: "tn-pp-use-as-convert-note",
				});
			}

			if (!isClaimed) {
				optionEl.addEventListener("click", (e) => {
					e.stopPropagation();
					menu.remove();
					// Single-file view: no bulk conversion needed, just select with the target type
					onSelect(prop.key, option.requiresType, prop.value, option.key);
					closeDropdown();
				});
			}
		}

		// Separator
		menu.createDiv({ cls: "tn-pp-use-as-separator" });

		// Custom field option
		const customOption = menu.createDiv({ cls: "tn-pp-conversion-option" });
		customOption.createSpan({ text: "Custom field" });
		customOption.addEventListener("click", (e) => {
			e.stopPropagation();
			menu.remove();
			onSelect(prop.key, prop.type, prop.value);
			closeDropdown();
		});

		menu.createDiv({
			cls: "tn-pp-use-as-footer",
			text: "More mapping targets in future releases",
		});

		const closeHandler = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener("click", closeHandler, true);
			}
		};
		setTimeout(() => document.addEventListener("click", closeHandler, true), 0);
	}

	function showMismatchedFiles(anchor: HTMLElement, entry: PropertyCatalogEntry) {
		const existing = dropdown.querySelector(".tn-pp-files-list");
		if (existing) existing.remove();
		document.querySelectorAll(".tn-pp-files-list-floating").forEach(el => el.remove());

		const list = document.createElement("div");
		list.className = "tn-pp-files-list tn-pp-files-list-floating";

		// Fixed positioning on body to avoid popover overflow clipping
		const anchorRect = anchor.getBoundingClientRect();
		list.style.position = "fixed";
		list.style.left = `${anchorRect.left}px`;
		list.style.right = "auto";
		list.style.zIndex = "10002";
		const listHeight = Math.min(entry.mismatchedFiles.length, 11) * 28 + 40;
		const spaceBelow = window.innerHeight - anchorRect.bottom;
		if (spaceBelow < listHeight && anchorRect.top > listHeight) {
			list.style.bottom = `${window.innerHeight - anchorRect.top + 2}px`;
			list.style.top = "auto";
		} else {
			list.style.top = `${anchorRect.bottom + 2}px`;
			list.style.bottom = "auto";
		}
		document.body.appendChild(list);

		// Back button to return to conversion menu
		const backBtn = list.createDiv({ cls: "tn-pp-conversion-option tn-pp-files-back" });
		backBtn.createSpan({ text: "\u2190 Back" });
		backBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			list.remove();
			showConversionMenu(anchor, entry);
		});

		for (const filePath of entry.mismatchedFiles.slice(0, 10)) {
			const fileName = filePath.split("/").pop()?.replace(".md", "") || filePath;
			list.createDiv({ cls: "tn-pp-file-item", text: fileName });
		}
		if (entry.mismatchedFiles.length > 10) {
			list.createDiv({
				cls: "tn-pp-file-item tn-pp-file-item--more",
				text: `... and ${entry.mismatchedFiles.length - 10} more`,
			});
		}

		// Close on outside click
		const closeHandler = (e: MouseEvent) => {
			if (!list.contains(e.target as Node)) {
				list.remove();
				document.removeEventListener("click", closeHandler, true);
			}
		};
		setTimeout(() => document.addEventListener("click", closeHandler, true), 0);
	}

	async function runConversion(
		key: string,
		targetType: PropertyType,
		files: string[],
		strategy: "convert-in-place" | "create-duplicate"
	) {
		const result = await convertPropertyType(plugin, key, targetType, files, strategy);
		if (result.failed > 0) {
			new Notice(`Converted ${result.converted} files, ${result.failed} failed`);
		} else {
			new Notice(`Converted ${result.converted} file${result.converted !== 1 ? "s" : ""} successfully`);
		}
		// Metadata cache updates asynchronously after file writes — delay a refresh
		// so the PropertyPicker re-reads the updated types on next open.
		setTimeout(() => refresh(), 500);
	}

	// ── Helpers ───────────────────────────────────────

	function createTypeBadge(parent: HTMLElement, type: PropertyType) {
		const badge = parent.createSpan({ cls: `tn-pp-type-badge tn-pp-type-badge--${type}` });
		badge.textContent = TYPE_LABELS[type];
		badge.style.setProperty("--badge-color", TYPE_COLORS[type]);
	}

	function formatValue(value: any, type: PropertyType): string {
		if (value === null || value === undefined || value === "") return "";
		if (type === "date") return String(value);
		if (type === "list" && Array.isArray(value)) return value.join(", ");
		if (type === "boolean") return value ? "Yes" : "No";
		return String(value);
	}

	// ── Dropdown positioning ──────────────────────────

	function positionDropdown() {
		const inputRect = searchInput.getBoundingClientRect();
		const dropdownHeight = 280;
		const viewportHeight = window.innerHeight;

		const spaceBelow = viewportHeight - inputRect.bottom;
		const showAbove = spaceBelow < dropdownHeight && inputRect.top > spaceBelow;

		dropdown.style.left = `${inputRect.left}px`;
		dropdown.style.width = `${Math.max(inputRect.width, 300)}px`;

		if (showAbove) {
			dropdown.style.bottom = `${viewportHeight - inputRect.top + 4}px`;
			dropdown.style.top = "auto";
		} else {
			dropdown.style.top = `${inputRect.bottom + 4}px`;
			dropdown.style.bottom = "auto";
		}
	}

	let lastCloseTime = 0;

	function openDropdown() {
		if (isDropdownOpen) return;
		// Prevent re-open within 300ms of close (guards against focus race conditions)
		if (Date.now() - lastCloseTime < 300) return;
		isDropdownOpen = true;
		loadProperties();
		dropdown.style.display = "block";
		positionDropdown();
		renderDropdown();
	}

	function closeDropdown() {
		if (!isDropdownOpen) return;
		isDropdownOpen = false;
		lastCloseTime = Date.now();
		dropdown.style.display = "none";
		showAddForm = false;
		// Clean up any floating menus appended to body
		document.querySelectorAll(".tn-pp-use-as-menu, .tn-pp-conversion-menu, .tn-pp-type-conversion-menu, .tn-pp-files-list-floating").forEach(el => el.remove());
	}

	// ── Event listeners ───────────────────────────────

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Only open on explicit click (not focus) — focus events cause race conditions
	// with Obsidian's modal focus management that re-open the dropdown after close.
	// Click toggles: open if closed, close if open.
	searchInput.addEventListener("click", () => {
		if (isDropdownOpen) {
			closeDropdown();
		} else {
			openDropdown();
		}
	});

	searchInput.addEventListener("input", () => {
		if (!isDropdownOpen) openDropdown();
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			searchQuery = searchInput.value;
			renderDropdown();
		}, 150);
	});

	searchInput.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			closeDropdown();
			searchInput.blur();
		}
	});

	// (Scope chip click handlers are set up in renderScopeChips() above)

	// Close dropdown when clicking outside.
	// window/document listeners don't receive events inside Obsidian modals,
	// so we listen on the closest ancestor (.modal, .vertical-tab-content, or body).
	const closestAncestor = container.closest(".modal") || container.closest(".vertical-tab-content") || document.body;
	const handleOutsideMousedown = (e: MouseEvent) => {
		if (!isDropdownOpen) return;
		const target = e.target as Node;
		if (container.contains(target) || dropdown.contains(target)) return;
		// Native <select> option lists render outside the DOM tree —
		// don't close if a <select> inside the dropdown is the active element
		const activeEl = document.activeElement;
		if (activeEl instanceof HTMLSelectElement && dropdown.contains(activeEl)) return;
		closeDropdown();
	};
	closestAncestor.addEventListener("mousedown", handleOutsideMousedown, true);

	// Also listen on the dropdown itself for blur (covers clicking outside the modal entirely)
	let blurTimer: ReturnType<typeof setTimeout> | null = null;
	searchInput.addEventListener("blur", () => {
		blurTimer = setTimeout(() => {
			if (!isDropdownOpen) return;
			const active = document.activeElement;
			if (active && (dropdown.contains(active) || container.contains(active))) return;
			// Check if a dropdown element was just clicked (mousedown sets this flag)
			if (dropdownClickedRecently) return;
			closeDropdown();
		}, 200);
	});

	// Prevent blur-close when interacting with dropdown items or scope chips
	let dropdownClickedRecently = false;
	dropdown.addEventListener("mousedown", () => {
		dropdownClickedRecently = true;
		setTimeout(() => { dropdownClickedRecently = false; }, 300);
	});
	scopeChipsContainer.addEventListener("mousedown", () => {
		dropdownClickedRecently = true;
		setTimeout(() => { dropdownClickedRecently = false; }, 300);
	});

	// Reposition on scroll
	const handleScroll = () => {
		if (isDropdownOpen) positionDropdown();
	};
	window.addEventListener("scroll", handleScroll, true);

	// ── Public API ────────────────────────────────────

	function refresh() {
		loadProperties();
		if (isDropdownOpen) {
			renderDropdown();
		}
	}

	return {
		refresh,
		destroy: () => {
			closestAncestor.removeEventListener("mousedown", handleOutsideMousedown, true);
			window.removeEventListener("scroll", handleScroll, true);
			if (debounceTimer) clearTimeout(debounceTimer);
			if (blurTimer) clearTimeout(blurTimer);
			dropdown.remove();
			container.empty();
		},
	};
}
