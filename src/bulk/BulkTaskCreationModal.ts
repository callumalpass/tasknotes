/**
 * Modal for bulk task operations from Bases view items.
 * Supports three action modes plus view settings:
 *   - Generate: Create new task files linked to source items
 *   - Convert: Add task metadata to existing notes in-place
 *   - Bulk Edit: Modify properties on existing task files
 */

import { App, Modal, Notice, Setting, TFile, setIcon, setTooltip } from "obsidian";
import TaskNotesPlugin from "../main";
import { BasesDataItem } from "../bases/helpers";
import { BulkTaskEngine, BulkCreationOptions, BulkCreationResult } from "./bulk-task-engine";
import { BulkConvertEngine, BulkConvertOptions, BulkConvertResult, ConvertPreCheckResult } from "./bulk-convert-engine";
import { BulkEditEngine, BulkEditOptions, BulkEditResult, EditPreCheckResult } from "./bulk-edit-engine";
import { PersonNoteInfo } from "../identity/PersonNoteService";
import { GroupNoteMapping } from "../identity/GroupRegistry";
import { createPersonGroupPicker } from "../ui/PersonGroupPicker";
import { DateContextMenu } from "../components/DateContextMenu";
import { StatusContextMenu } from "../components/StatusContextMenu";
import { PriorityContextMenu } from "../components/PriorityContextMenu";
import { ReminderContextMenu } from "../components/ReminderContextMenu";
import { Reminder, TaskInfo } from "../types";
import { type PropertyType, keyToDisplayName, getAllTaskFilePaths } from "../utils/propertyDiscoveryUtils";
import { createPropertyPicker } from "../ui/PropertyPicker";
import {
	FIELD_OVERRIDE_PROPS,
	OVERRIDABLE_FIELD_LABELS,
	OVERRIDABLE_FIELD_TYPES,
	OVERRIDABLE_FIELD_EDITORS,
	OVERRIDABLE_FIELD_PICKER_TITLES,
	type OverridableField,
} from "../utils/fieldOverrideUtils";


type BulkMode = "generate" | "convert" | "bulkEdit" | "viewSettings";

export interface BulkTaskCreationModalOptions {
	/** Called when tasks are created, converted, or edited successfully */
	onTasksCreated?: (result: BulkCreationResult | BulkConvertResult | BulkEditResult) => void;
	/** Per-view field mapping from a .base file (ADR-011). */
	viewFieldMapping?: import("../identity/BaseIdentityService").ViewFieldMapping;
	/** Source base ID for provenance tracking (ADR-011). */
	sourceBaseId?: string;
	/** Source view ID for provenance tracking (ADR-011). */
	sourceViewId?: string;
	/** Index of the active view in the .base file's views array */
	viewIndex?: number;
	/** If true, open directly to View Settings tab */
	openToViewSettings?: boolean;
}

/**
 * Modal for configuring and executing bulk task operations from Bases items.
 * Supports Generate (create new files) and Convert (modify existing notes) modes.
 */
export class BulkTaskCreationModal extends Modal {
	private items: BasesDataItem[];
	private plugin: TaskNotesPlugin;
	private modalOptions: BulkTaskCreationModalOptions;
	private engine: BulkTaskEngine;
	private convertEngine: BulkConvertEngine;
	private editEngine: BulkEditEngine;
	private baseFilePath: string | undefined;

	// Mode state
	private mode: BulkMode;

	// Generate-mode options
	private skipExisting = true;
	private useParentAsProject = true;
	private selectedAssignees: string[] = []; // Paths to person/group notes

	// PersonGroupPicker instance for cleanup
	private assigneePicker: { getSelection: () => string[]; setSelection: (paths: string[]) => void; destroy: () => void } | null = null;

	// Discovered persons and groups for assignee dropdown
	private discoveredPersons: PersonNoteInfo[] = [];
	private discoveredGroups: GroupNoteMapping[] = [];

	// Convert-mode options
	private skipAlreadyTasks = true;
	private applyDefaults = true;
	private linkToBase = true;
	private dueDate = "";
	private scheduledDate = "";

	// Bulk values (shared across modes where applicable)
	private bulkStatus = "";
	private bulkPriority = "";
	private bulkReminders: Reminder[] = []; // Stackable reminders via ReminderModal
	private bulkCustomProperties: Record<string, { type: PropertyType; value: any }> = {}; // Custom properties from PropertyPicker
	private bulkFieldOverrides: Record<string, string> = {}; // Per-task field overrides (e.g., { due: "deadline" })
	private propertyPickerInstance: { refresh: () => void; destroy: () => void } | null = null;
	private customPropsPanel: HTMLElement | null = null; // Picker lives here (createPropertyPicker takes it over)
	private activeListEl: HTMLElement | null = null; // Property rows — sibling of panel, safe from picker's container.empty()
	private excludeKeysSet = new Set<string>(); // Shared mutable set — picker's refresh() reuses it
	private bulkPreloadedFromView = false; // Whether view mappings+defaults have been loaded into bulk state

	// View Settings state
	private viewSettingsContainer: HTMLElement | null = null;
	private notifyEnabled = false;
	private notifyOn: "any" | "new_items" | "count_threshold" = "any";
	private notifyThreshold = 1;
	private viewSettingsLoaded = false;
	private viewDefaultProperties: Record<string, { type: PropertyType; value: any }> = {};
	private viewFieldMapping: Record<string, string> = {};
	private viewPropertiesPickerInstance: { refresh: () => void; destroy: () => void } | null = null;
	private viewPropertiesActiveListEl: HTMLElement | null = null;

	// UI element references
	private topSectionsWrapper: HTMLElement | null = null;
	private bodyContainer: HTMLElement | null = null;
	private optionsContainer: HTMLElement | null = null;
	private itemsContainer: HTMLElement | null = null;
	private itemsListContainer: HTMLElement | null = null;
	private itemsExpanded = false;
	private statusContainer: HTMLElement | null = null;
	private compatContainer: HTMLElement | null = null;
	private actionButton: HTMLButtonElement | null = null;
	private progressBar: HTMLElement | null = null;
	private progressBarInner: HTMLElement | null = null;
	private summarySpan: HTMLElement | null = null;

	// Action bar icon references (for visual state updates)
	private dueIcon: HTMLElement | null = null;
	private scheduledIcon: HTMLElement | null = null;
	private statusIcon: HTMLElement | null = null;
	private priorityIcon: HTMLElement | null = null;
	private reminderIcon: HTMLElement | null = null;
	private assigneeIcon: HTMLElement | null = null;
	private reminderWarning: HTMLElement | null = null;

	constructor(
		app: App,
		plugin: TaskNotesPlugin,
		items: BasesDataItem[],
		options: BulkTaskCreationModalOptions = {},
		baseFilePath?: string
	) {
		super(app);
		this.plugin = plugin;
		this.items = items;
		this.modalOptions = options;
		this.baseFilePath = baseFilePath;
		this.engine = new BulkTaskEngine(plugin);
		this.convertEngine = new BulkConvertEngine(plugin);
		this.editEngine = new BulkEditEngine(plugin);
		const requestedMode = options.openToViewSettings ? "viewSettings" : (plugin.settings.defaultBulkMode || "generate");
		// Fall back from viewSettings if no base file context (e.g., opened from file explorer)
		this.mode = (requestedMode === "viewSettings" && !baseFilePath) ? "generate" : requestedMode;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		contentEl.empty();

		// Add modal classes for new styling
		modalEl.addClass("tn-bulk-modal");
		contentEl.addClass("tn-bulk-modal__content");
		contentEl.addClass("tasknotes-plugin");

		// Discover persons synchronously (fast - reads from cache/files)
		this.discoveredPersons = this.plugin.personNoteService?.discoverPersons() || [];
		// Start with empty groups - will update async
		this.discoveredGroups = [];

		// Header with icon, title, and summary
		this.renderHeader(contentEl);

		// Mode tabs (segmented control)
		this.renderModeTabs(contentEl);

		// Scrollable body container
		this.bodyContainer = contentEl.createDiv({ cls: "tn-bulk-modal__body" });

		// Top sections wrapper (action bar + custom props + date props + assignees)
		// Using a wrapper makes cleanup deterministic during mode switches
		this.topSectionsWrapper = this.bodyContainer.createDiv({ cls: "tn-bulk-modal__top-sections" });
		this.renderTopSections();

		// Items section (expandable)
		this.renderItemsSection(this.bodyContainer);

		// Options section (dynamic per mode)
		this.optionsContainer = this.bodyContainer.createDiv({ cls: "tn-bulk-modal__section" });
		this.rebuildOptions();

		// Compatibility section (inline badges, Convert mode only)
		this.compatContainer = this.bodyContainer.createDiv({ cls: "tn-bulk-modal__section" });
		this.compatContainer.style.display = this.mode === "convert" ? "block" : "none";

		// Sticky footer with status, progress, and buttons
		this.renderFooter(contentEl);

		// If opened in viewSettings mode, switch to that immediately
		if (this.mode === "viewSettings") {
			this.onModeChanged();
		} else {
			// Initial pre-check (only for generate/convert modes)
			this.runPreCheck();
		}

		// Discover groups asynchronously and rebuild options when done
		this.discoverGroupsAsync();
	}

	/**
	 * Discover groups asynchronously and rebuild the assignee section.
	 */
	private async discoverGroupsAsync() {
		if (this.plugin.groupRegistry) {
			this.discoveredGroups = await this.plugin.groupRegistry.discoverGroups();
			// Rebuild assignee section to include groups in the picker
			if (this.discoveredGroups.length > 0) {
				this.rebuildActionBarAndAssignees();
			}
		}
	}

	/**
	 * Render the modal header with icon, title, and summary.
	 */
	private renderHeader(container: HTMLElement) {
		const header = container.createDiv({ cls: "tn-bulk-modal__header" });

		// Icon
		const iconEl = header.createDiv({ cls: "tn-bulk-modal__icon" });
		setIcon(iconEl, "list-plus");

		// Title
		header.createEl("h2", {
			cls: "tn-bulk-modal__title",
			text: "Bulk tasking",
		});

		// Summary
		this.summarySpan = header.createSpan({
			cls: "tn-bulk-modal__summary",
			text: `${this.items.length} item${this.items.length !== 1 ? "s" : ""}`,
		});
	}

	/**
	 * Render mode tabs as a segmented control.
	 */
	private renderModeTabs(container: HTMLElement) {
		const tabsContainer = container.createDiv({ cls: "tn-bulk-modal__mode-tabs" });

		// Generate tab
		const generateTab = tabsContainer.createEl("button", {
			cls: `tn-bulk-modal__tab ${this.mode === "generate" ? "tn-bulk-modal__tab--active" : ""}`,
			text: "Generate new tasks",
			attr: { "data-mode": "generate" },
		});
		generateTab.addEventListener("click", () => {
			if (this.mode !== "generate") {
				this.mode = "generate";
				this.onModeChanged();
				this.updateTabStyles(tabsContainer);
			}
		});

		// Convert tab
		const convertTab = tabsContainer.createEl("button", {
			cls: `tn-bulk-modal__tab ${this.mode === "convert" ? "tn-bulk-modal__tab--active" : ""}`,
			text: "Convert to tasks",
			attr: { "data-mode": "convert" },
		});
		convertTab.addEventListener("click", () => {
			if (this.mode !== "convert") {
				this.mode = "convert";
				this.onModeChanged();
				this.updateTabStyles(tabsContainer);
			}
		});

		// Bulk Edit tab
		const editTab = tabsContainer.createEl("button", {
			cls: `tn-bulk-modal__tab ${this.mode === "bulkEdit" ? "tn-bulk-modal__tab--active" : ""}`,
			text: "Edit existing tasks",
			attr: { "data-mode": "bulkEdit" },
		});
		editTab.addEventListener("click", () => {
			if (this.mode !== "bulkEdit") {
				this.mode = "bulkEdit";
				this.onModeChanged();
				this.updateTabStyles(tabsContainer);
			}
		});

		// View Settings tab — only shown when opened from a Bases view (has baseFilePath)
		if (this.baseFilePath) {
			const settingsTab = tabsContainer.createEl("button", {
				cls: `tn-bulk-modal__tab ${this.mode === "viewSettings" ? "tn-bulk-modal__tab--active" : ""}`,
				attr: { "data-mode": "viewSettings" },
			});
			setIcon(settingsTab.createSpan({ cls: "tn-bulk-modal__tab-icon" }), "settings");
			settingsTab.appendText("Base view defaults & settings");
			settingsTab.addEventListener("click", () => {
				if (this.mode !== "viewSettings") {
					this.mode = "viewSettings";
					this.onModeChanged();
					this.updateTabStyles(tabsContainer);
				}
			});
		}
	}

	/**
	 * Update tab active states.
	 */
	private updateTabStyles(tabsContainer: HTMLElement) {
		const tabs = tabsContainer.querySelectorAll(".tn-bulk-modal__tab");
		tabs.forEach((tab) => {
			const tabMode = (tab as HTMLElement).dataset.mode;
			tab.toggleClass("tn-bulk-modal__tab--active", tabMode === this.mode);
		});
	}

	/**
	 * Render all top sections (action bar + custom props + date props + assignees)
	 * into the topSectionsWrapper. Called from onOpen() and rebuildActionBarAndAssignees().
	 */
	private renderTopSections() {
		if (!this.topSectionsWrapper) return;

		// 1. Action bar (Bulk Values)
		const actionBarSection = this.topSectionsWrapper.createDiv({ cls: "tn-bulk-modal__section" });
		this.renderActionBarInto(actionBarSection);

		// 2. Custom Properties
		const customSection = this.topSectionsWrapper.createDiv({ cls: "tn-bulk-modal__section" });
		this.renderCustomPropertiesSection(customSection);

		// 3. Assignees
		const assigneeSection = this.topSectionsWrapper.createDiv({ cls: "tn-bulk-modal__section" });
		this.renderAssigneeSectionInto(assigneeSection);
	}

	/**
	 * Create an action icon button.
	 */
	private createActionIcon(
		container: HTMLElement,
		iconName: string,
		tooltip: string,
		onClick: () => void
	): HTMLElement {
		const iconBtn = container.createEl("button", { cls: "tn-bulk-modal__action-icon" });
		setIcon(iconBtn, iconName);
		setTooltip(iconBtn, tooltip);
		iconBtn.addEventListener("click", onClick);
		return iconBtn;
	}

	/**
	 * Update visual state of action icons (show dot when value is set).
	 */
	private updateActionIconStates() {
		// Due date
		if (this.dueIcon) {
			this.dueIcon.toggleClass("has-value", !!this.dueDate);
			setTooltip(this.dueIcon, this.dueDate ? `Due: ${this.dueDate}` : "Due date");
		}

		// Scheduled date
		if (this.scheduledIcon) {
			this.scheduledIcon.toggleClass("has-value", !!this.scheduledDate);
			setTooltip(this.scheduledIcon, this.scheduledDate ? `Scheduled: ${this.scheduledDate}` : "Scheduled date");
		}

		// Status
		if (this.statusIcon) {
			this.statusIcon.toggleClass("has-value", !!this.bulkStatus);
			setTooltip(this.statusIcon, this.bulkStatus ? `Status: ${this.bulkStatus}` : "Status");
		}

		// Priority
		if (this.priorityIcon) {
			this.priorityIcon.toggleClass("has-value", !!this.bulkPriority);
			setTooltip(this.priorityIcon, this.bulkPriority ? `Priority: ${this.bulkPriority}` : "Priority");
		}

		// Reminders (stackable)
		if (this.reminderIcon) {
			const hasReminders = this.bulkReminders.length > 0;
			this.reminderIcon.toggleClass("has-value", hasReminders);

			// Update tooltip with count
			const count = this.bulkReminders.length;
			const tooltip = count > 0
				? `${count} reminder${count !== 1 ? "s" : ""} set`
				: "Reminders";
			setTooltip(this.reminderIcon, tooltip);

			// Update data-count attribute for CSS badge (optional)
			this.reminderIcon.setAttribute("data-count", String(count));
		}

		// Assignee
		if (this.assigneeIcon) {
			this.assigneeIcon.toggleClass("has-value", this.selectedAssignees.length > 0);
			const count = this.selectedAssignees.length;
			setTooltip(this.assigneeIcon, count > 0 ? `${count} assignee${count !== 1 ? "s" : ""} selected` : "Assignee");
		}

		// Show/hide reminder warning (when reminders set but no dates)
		if (this.reminderWarning) {
			const hasReminders = this.bulkReminders.length > 0;
			const hasDate = !!this.dueDate || !!this.scheduledDate;
			const showWarning = hasReminders && !hasDate;
			this.reminderWarning.style.display = showWarning ? "block" : "none";
		}
	}

	/**
	 * Render the custom properties section with heading, help tip, and PropertyPicker.
	 * Follows the same pattern as BULK VALUES and ASSIGNEES sections.
	 */
	private renderCustomPropertiesSection(parentSection: HTMLElement) {
		// Clean up existing picker if re-rendering
		if (this.propertyPickerInstance) {
			this.propertyPickerInstance.destroy();
			this.propertyPickerInstance = null;
		}

		// Subsection header with label and help icon
		const header = parentSection.createDiv({ cls: "tn-bulk-modal__section-header" });
		header.createSpan({ cls: "tn-bulk-modal__section-label", text: "PROPERTIES & ANCHORS" });

		const helpIcon = header.createSpan({ cls: "tn-bulk-modal__help" });
		setIcon(helpIcon, "help-circle");
		setTooltip(helpIcon, "Add extra frontmatter to every item in this batch, or use \u2018Map to\u2019 to assign custom properties to standard task fields (e.g., Due date, Assignee). Search existing properties or create new ones.");

		// PropertyPicker container — createPropertyPicker takes this over entirely
		// (it calls container.empty() + container.addClass("tn-property-picker"))
		this.customPropsPanel = parentSection.createDiv({ cls: "tn-bulk-modal__custom-props-panel" });

		// Active property rows — SIBLING of the picker panel in parentSection,
		// completely safe from createPropertyPicker's container.empty() call
		this.activeListEl = parentSection.createDiv({ cls: "tn-bulk-modal__custom-props-active" });

		// Sync the shared excludeKeys set with current state
		this.syncExcludeKeys();

		this.propertyPickerInstance = createPropertyPicker({
			container: this.customPropsPanel,
			plugin: this.plugin,
			itemPaths: this.items.map(i => i.path).filter((p): p is string => !!p),
			excludeKeys: this.excludeKeysSet,
			useAsOptions: Object.entries(OVERRIDABLE_FIELD_LABELS).map(([key, label]) => ({
				key,
				label,
				requiresType: (OVERRIDABLE_FIELD_TYPES[key as OverridableField] || "text") as PropertyType,
			})),
			claimedMappings: this.bulkFieldOverrides,
			onSelect: (key: string, type: PropertyType, value?: any, useAs?: string) => {
				// Set field override mapping if a "Use as" target was chosen
				if (useAs) {
					this.clearBulkMappingForProperty(key);
					this.bulkFieldOverrides[useAs] = key;
				}
				this.handleCustomPropertySelected(key, type, value);
			},
		});

		// Render active custom properties (if any were set before a re-render)
		this.renderCustomPropsActiveList();

		// Pre-load view field mappings + defaults into bulk state (once).
		// Copies modalOptions.viewFieldMapping → bulkFieldOverrides and loads
		// default property values from .base YAML → bulkCustomProperties.
		// After async loading completes, refreshes the picker and active list.
		if (!this.bulkPreloadedFromView) {
			this.preloadBulkFromViewSettings();
		}
	}

	/**
	 * Render the list of currently-set custom properties with expandable mapping rows.
	 */
	private renderCustomPropsActiveList() {
		if (!this.activeListEl) return;
		this.activeListEl.empty();

		const keys = Object.keys(this.bulkCustomProperties);
		if (keys.length === 0) return;

		for (const key of keys) {
			const entry = this.bulkCustomProperties[key];
			const row = this.activeListEl!.createDiv({ cls: "tn-prop-row" });
			const currentMapping = this.findBulkMappingForProperty(key);
			if (currentMapping) {
				row.classList.add("tn-prop-row--expanded");
			}

			// ── Header row ──────────────────────────────────
			const header = row.createDiv({ cls: "tn-prop-row__header" });

			// Expand toggle
			{
				const toggle = header.createDiv({ cls: "tn-prop-row__expand-toggle" });
				const svgNS = "http://www.w3.org/2000/svg";
				const chevronSvg = document.createElementNS(svgNS, "svg");
				chevronSvg.setAttribute("width", "12");
				chevronSvg.setAttribute("height", "12");
				chevronSvg.setAttribute("viewBox", "0 0 24 24");
				chevronSvg.setAttribute("fill", "none");
				chevronSvg.setAttribute("stroke", "currentColor");
				chevronSvg.setAttribute("stroke-width", "2");
				chevronSvg.setAttribute("stroke-linecap", "round");
				chevronSvg.setAttribute("stroke-linejoin", "round");
				const path = document.createElementNS(svgNS, "path");
				path.setAttribute("d", "M9 18l6-6-6-6");
				chevronSvg.appendChild(path);
				toggle.appendChild(chevronSvg);
				toggle.addEventListener("click", () => {
					row.classList.toggle("tn-prop-row--expanded");
				});
			}

			// Property key label (raw key, matching PropertyPicker display)
			header.createDiv({ cls: "tn-prop-row__key", text: key });

			// Type badge
			header.createDiv({ cls: "tn-prop-row__type-badge", text: entry.type });

			// Value input
			const valueContainer = header.createDiv({ cls: "tn-prop-row__value" });
			this.renderCustomPropValueInput(valueContainer, key, entry);

			// Mapping badge
			if (currentMapping) {
				const badge = header.createDiv({ cls: "tn-prop-row__mapping-badge" });
				const pinSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
				pinSvg.setAttribute("width", "10");
				pinSvg.setAttribute("height", "10");
				pinSvg.setAttribute("viewBox", "0 0 24 24");
				pinSvg.setAttribute("fill", "none");
				pinSvg.setAttribute("stroke", "currentColor");
				pinSvg.setAttribute("stroke-width", "2");
				const pinPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
				pinPath.setAttribute("d", "M12 17v5M9 2h6l-1 7h4l-8 8 2-7H8l1-8z");
				pinSvg.appendChild(pinPath);
				badge.appendChild(pinSvg);
				badge.createSpan({ text: OVERRIDABLE_FIELD_LABELS[currentMapping] });
			}

			// Remove button
			const removeBtn = header.createDiv({ cls: "tn-prop-row__remove" });
			const removeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			removeSvg.setAttribute("width", "14");
			removeSvg.setAttribute("height", "14");
			removeSvg.setAttribute("viewBox", "0 0 24 24");
			removeSvg.setAttribute("fill", "none");
			removeSvg.setAttribute("stroke", "currentColor");
			removeSvg.setAttribute("stroke-width", "2");
			const removePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
			removePath.setAttribute("d", "M18 6L6 18M6 6l12 12");
			removeSvg.appendChild(removePath);
			removeBtn.appendChild(removeSvg);
			removeBtn.title = "Remove from batch";
			removeBtn.addEventListener("click", () => {
				this.clearBulkMappingForProperty(key);
				delete this.bulkCustomProperties[key];
				this.updateActionIconStates();
				this.renderCustomPropsActiveList();
				this.refreshPropertyPicker();
			});

			// ── Mapping panel ────
			{
				const panel = row.createDiv({ cls: "tn-prop-row__mapping-panel" });
				const mappingRow = panel.createDiv({ cls: "tn-prop-row__mapping-row" });
				mappingRow.createDiv({ cls: "tn-prop-row__mapping-label", text: "Map to:" });

				const select = mappingRow.createEl("select", { cls: "tn-prop-row__mapping-dropdown" });

				const mappingHelp = mappingRow.createSpan({ cls: "tn-prop-row__mapping-help" });
				setIcon(mappingHelp, "help-circle");
				setTooltip(mappingHelp, "Map this property to a core task field. The mapping is saved per-task. Global default mappings can be configured in Settings \u2192 Task properties.");

				const noneOpt = select.createEl("option", { value: "", text: "None (custom only)" });
				if (!currentMapping) noneOpt.selected = true;

				for (const [fieldKey, label] of Object.entries(OVERRIDABLE_FIELD_LABELS)) {
					const opt = select.createEl("option", { value: fieldKey, text: label });
					if (currentMapping === fieldKey) opt.selected = true;

					const existingProp = this.bulkFieldOverrides[fieldKey];
					if (existingProp && existingProp !== key) {
						opt.disabled = true;
						opt.text = `${label} (used by ${existingProp})`;
					}
				}

				select.addEventListener("change", () => {
					const newField = select.value;
					this.clearBulkMappingForProperty(key);
					if (newField) {
						this.bulkFieldOverrides[newField] = key;
					}
					this.renderCustomPropsActiveList();
				});

				// ── Type mismatch note ────────────────────────
				const expectedType = currentMapping ? (OVERRIDABLE_FIELD_TYPES[currentMapping as OverridableField] || "text") : null;
				if (currentMapping && expectedType && entry.type !== expectedType) {
					const mismatch = panel.createDiv({ cls: "tn-prop-row__type-mismatch" });
					mismatch.createSpan({ cls: "tn-prop-row__type-mismatch-icon", text: "\u26A0" });
					mismatch.createSpan({
						cls: "tn-prop-row__type-mismatch-text",
						text: `Property type is '${entry.type}', but '${OVERRIDABLE_FIELD_LABELS[currentMapping as OverridableField]}' expects '${expectedType}'.`,
					});
					const convertAction = mismatch.createEl("a", {
						cls: "tn-prop-row__type-mismatch-action",
						text: `Convert to ${expectedType}`,
					});
					convertAction.addEventListener("click", (e) => {
						e.preventDefault();
						entry.type = expectedType as PropertyType;
						this.renderCustomPropsActiveList();
					});
				}
			}
		}
	}

	/** Find which core field (if any) a bulk custom property is mapped to. */
	private findBulkMappingForProperty(propertyKey: string): OverridableField | null {
		for (const [fieldKey, propName] of Object.entries(this.bulkFieldOverrides)) {
			if (propName === propertyKey) {
				return fieldKey as OverridableField;
			}
		}
		return null;
	}

	/** Clear any bulk mapping that points to a given property key. */
	private clearBulkMappingForProperty(propertyKey: string): void {
		for (const [fieldKey, propName] of Object.entries(this.bulkFieldOverrides)) {
			if (propName === propertyKey) {
				delete this.bulkFieldOverrides[fieldKey];
			}
		}
	}

	/**
	 * Shared "Click to set..." pattern for property value inputs.
	 * Shows a clickable placeholder that reveals the actual input on click,
	 * matching Create/Edit modal UX. If a value already exists, shows it as text.
	 */
	private renderClickToSetInput(
		container: HTMLElement,
		entry: { type: PropertyType; value: any },
		callbacks: { getValue: () => any; setValue: (val: any) => void }
	) {
		const rawValue = entry.value;
		const hasValue = rawValue !== null && rawValue !== undefined && rawValue !== "" &&
			!(Array.isArray(rawValue) && rawValue.length === 0);

		// Format display text for current value
		const formatValue = (val: any): string => {
			if (val instanceof Date) return val.toISOString().slice(0, 10);
			if (Array.isArray(val)) return val.join(", ");
			return String(val ?? "");
		};

		const display = container.createDiv({ cls: "tn-prop-row__value-display" });
		display.style.cssText = "cursor: pointer; display: flex; align-items: center; gap: 4px;";

		const valueText = hasValue ? formatValue(rawValue) : "Click to set...";
		const span = display.createSpan({
			text: valueText,
			cls: hasValue ? "tn-prop-row__value-set" : "tn-prop-row__value-placeholder",
		});
		if (!hasValue) span.style.color = "var(--text-faint)";

		// On click, replace display with the actual input
		display.addEventListener("click", () => {
			display.style.display = "none";

			let inputType: string;
			let placeholder: string;
			switch (entry.type) {
				case "date": inputType = "date"; placeholder = ""; break;
				case "number": inputType = "number"; placeholder = "0"; break;
				case "list": inputType = "text"; placeholder = "Comma-separated values"; break;
				default: inputType = "text"; placeholder = "Value"; break;
			}

			const input = container.createEl("input", {
				cls: "tn-bulk-modal__custom-prop-input",
				attr: { type: inputType, placeholder },
			});

			// Set initial value
			const current = callbacks.getValue();
			if (entry.type === "date" && current instanceof Date) {
				input.value = current.toISOString().slice(0, 10);
			} else if (Array.isArray(current)) {
				input.value = current.join(", ");
			} else {
				input.value = current != null ? String(current) : "";
			}

			// Commit on change (blur/enter for text, native change for date/number)
			const commitValue = () => {
				const val = input.value;
				if (entry.type === "number") {
					callbacks.setValue(parseFloat(val) || 0);
				} else if (entry.type === "list") {
					callbacks.setValue(val.split(",").map((s: string) => s.trim()).filter(Boolean));
				} else {
					callbacks.setValue(val);
				}
				// Update display text and swap back
				const newVal = callbacks.getValue();
				const newHasValue = newVal !== null && newVal !== undefined && newVal !== "" &&
					!(Array.isArray(newVal) && newVal.length === 0);
				span.textContent = newHasValue ? formatValue(newVal) : "Click to set...";
				span.className = newHasValue ? "tn-prop-row__value-set" : "tn-prop-row__value-placeholder";
				span.style.color = newHasValue ? "" : "var(--text-faint)";
				input.remove();
				display.style.display = "";
			};

			input.addEventListener("change", commitValue);
			input.addEventListener("blur", () => {
				// Small delay to let change fire first
				setTimeout(() => {
					if (input.parentElement) commitValue();
				}, 100);
			});

			input.focus();
		});
	}

	/**
	 * Render a type-appropriate value input for a custom property.
	 * Uses a "Click to set..." pattern: shows a clickable placeholder that reveals
	 * the actual input on click, matching Create/Edit modal UX.
	 * For mapped date properties, uses DateContextMenu (calendar popup) like Create/Edit modals.
	 */
	private renderCustomPropValueInput(
		container: HTMLElement,
		key: string,
		entry: { type: PropertyType; value: any }
	) {
		// Boolean: always show checkbox inline (no click-to-set needed)
		if (entry.type === "boolean") {
			const toggle = container.createEl("input", {
				attr: { type: "checkbox" },
				cls: "tn-bulk-modal__custom-prop-checkbox",
			});
			toggle.checked = !!entry.value;
			toggle.addEventListener("change", () => {
				this.bulkCustomProperties[key].value = toggle.checked;
			});
			return;
		}

		// Check if this property is mapped to a standard field
		const mapping = this.findBulkMappingForProperty(key);

		if (mapping) {
			// Mapped properties: use the centralized editor type config
			const editorType = OVERRIDABLE_FIELD_EDITORS[mapping];
			switch (editorType) {
				case "date-picker":
					this.renderDateClickToSet(
						container, key, entry,
						OVERRIDABLE_FIELD_PICKER_TITLES[mapping] || "Set date",
						mapping
					);
					return;
				case "assignee-picker":
					this.renderAssigneeClickToSet(container);
					return;
				// Future editor types (e.g., "status-picker", "priority-picker") go here
				default:
					break; // Fall through to generic inline input
			}
		}

		// Unmapped properties (or mapped fields with "inline" editor): generic "Click to set..."
		this.renderClickToSetInput(container, entry, {
			getValue: () => this.bulkCustomProperties[key]?.value,
			setValue: (val: any) => { this.bulkCustomProperties[key].value = val; },
		});
	}

	/**
	 * Render a "Click to set..." display that opens DateContextMenu on click.
	 * Matches Create/Edit modal behavior for date-mapped properties.
	 * Syncs the selected value to the corresponding bulk action bar field.
	 */
	private renderDateClickToSet(
		container: HTMLElement,
		key: string,
		entry: { type: PropertyType; value: any },
		title: string,
		mapping?: OverridableField
	) {
		const rawValue = entry.value;
		const hasValue = rawValue !== null && rawValue !== undefined && rawValue !== "";

		const formatDate = (val: any): string => {
			if (val instanceof Date) return val.toISOString().slice(0, 10);
			return String(val ?? "");
		};

		const display = container.createDiv({ cls: "tn-prop-row__value-display" });
		display.style.cssText = "cursor: pointer; display: flex; align-items: center; gap: 4px;";

		const valueText = hasValue ? formatDate(rawValue) : "Click to set...";
		const span = display.createSpan({
			text: valueText,
			cls: hasValue ? "tn-prop-row__value-set" : "tn-prop-row__value-placeholder",
		});
		if (!hasValue) span.style.color = "var(--text-faint)";

		display.addEventListener("click", () => {
			const currentVal = this.bulkCustomProperties[key]?.value;
			const menu = new DateContextMenu({
				currentValue: currentVal instanceof Date ? currentVal.toISOString().slice(0, 10) : (currentVal || undefined),
				title,
				plugin: this.plugin,
				app: this.app,
				onSelect: (date: string | null) => {
					const dateStr = date || "";
					this.bulkCustomProperties[key].value = dateStr;

					// Sync to the corresponding bulk action bar field
					if (mapping === "due") {
						this.dueDate = dateStr;
					} else if (mapping === "scheduled") {
						this.scheduledDate = dateStr;
					}
					this.updateActionIconStates();

					const newHasValue = !!date;
					span.textContent = newHasValue ? date! : "Click to set...";
					span.className = newHasValue ? "tn-prop-row__value-set" : "tn-prop-row__value-placeholder";
					span.style.color = newHasValue ? "" : "var(--text-faint)";
				},
			});
			menu.showAtElement(display);
		});
	}

	/**
	 * Render a "Click to set..." display that scrolls to and flashes the ASSIGNEES section.
	 * Matches Create/Edit modal behavior where clicking an assignee-mapped field focuses the picker.
	 */
	private renderAssigneeClickToSet(container: HTMLElement) {
		const display = container.createDiv({ cls: "tn-prop-row__value-display" });
		display.style.cssText = "cursor: pointer; display: flex; align-items: center; gap: 4px;";

		const span = display.createSpan({
			text: "Click to set...",
			cls: "tn-prop-row__value-placeholder",
		});
		span.style.color = "var(--text-faint)";

		display.addEventListener("click", () => {
			// Find the ASSIGNEES section in the top sections wrapper
			if (!this.topSectionsWrapper) return;
			const sections = this.topSectionsWrapper.querySelectorAll(".tn-bulk-modal__section");
			for (const section of sections) {
				const label = section.querySelector(".tn-bulk-modal__section-label");
				if (label && label.textContent === "ASSIGNEES") {
					// Scroll into view
					section.scrollIntoView({ behavior: "smooth", block: "center" });
					// Flash highlight to draw attention
					(section as HTMLElement).style.transition = "background-color 0.3s";
					(section as HTMLElement).style.backgroundColor = "var(--background-modifier-hover)";
					setTimeout(() => {
						(section as HTMLElement).style.backgroundColor = "";
					}, 800);
					// Focus the search input if available
					const searchInput = section.querySelector("input") as HTMLInputElement | null;
					if (searchInput) {
						setTimeout(() => searchInput.focus(), 300);
					}
					break;
				}
			}
		});
	}

	/**
	 * Flatten bulkCustomProperties to { key: value } for the engine's customFrontmatter.
	 * Also includes field override tracking properties (tnDueDateProp, etc.).
	 */
	private getFlatCustomProperties(): Record<string, any> {
		const flat: Record<string, any> = {};
		for (const [key, entry] of Object.entries(this.bulkCustomProperties)) {
			flat[key] = entry.value;
		}
		// Include tracking properties for field overrides
		for (const [internalKey, trackingProp] of Object.entries(FIELD_OVERRIDE_PROPS)) {
			if (this.bulkFieldOverrides[internalKey]) {
				flat[trackingProp] = this.bulkFieldOverrides[internalKey];
			}
		}
		return flat;
	}

	/**
	 * Rebuild the PropertyPicker to update excludeKeys after adding/removing properties.
	 */
	/**
	 * Handle a property selection from the PropertyPicker.
	 * Shared callback used by both initial render and rebuild paths.
	 */
	private handleCustomPropertySelected(key: string, type: PropertyType, value?: any) {
		let defaultValue: any = value ?? null;
		if (defaultValue === null) {
			switch (type) {
				case "date": defaultValue = ""; break;
				case "number": defaultValue = 0; break;
				case "boolean": defaultValue = false; break;
				case "list": defaultValue = []; break;
				default: defaultValue = ""; break;
			}
		}
		this.bulkCustomProperties[key] = { type, value: defaultValue };
		this.renderCustomPropsActiveList();
		// Update exclude set and refresh picker in-place (no destroy/recreate)
		this.refreshPropertyPicker();
	}

	/**
	 * Sync the shared excludeKeysSet with current bulkCustomProperties keys.
	 */
	private syncExcludeKeys() {
		this.excludeKeysSet.clear();
		for (const key of Object.keys(this.bulkCustomProperties)) {
			this.excludeKeysSet.add(key);
		}
	}

	/**
	 * Refresh the PropertyPicker in-place by updating the exclude set and
	 * calling refresh(). No DOM destruction — the picker stays mounted.
	 */
	private refreshPropertyPicker() {
		this.syncExcludeKeys();
		this.propertyPickerInstance?.refresh();
	}

	/**
	 * Pre-populate bulkFieldOverrides and bulkCustomProperties from the view's
	 * field mapping and default properties (ADR-011). Called once before the
	 * Generate/Convert PropertyPicker is first created so mapped properties
	 * appear as active rows with "Use as" badges.
	 *
	 * Synchronously copies modalOptions.viewFieldMapping into bulkFieldOverrides,
	 * then async-loads view defaults from the .base YAML into bulkCustomProperties.
	 */
	private async preloadBulkFromViewSettings() {
		if (this.bulkPreloadedFromView) return;
		this.bulkPreloadedFromView = true;

		// 1. Copy view field mapping into bulk overrides
		if (this.modalOptions.viewFieldMapping) {
			for (const [fieldKey, propName] of Object.entries(this.modalOptions.viewFieldMapping)) {
				if (propName && !this.bulkFieldOverrides[fieldKey]) {
					this.bulkFieldOverrides[fieldKey] = propName;
				}
			}
		}

		// 2. Load view default properties from .base YAML
		if (this.baseFilePath) {
			const file = this.app.vault.getAbstractFileByPath(this.baseFilePath);
			if (file instanceof TFile) {
				const viewIndex = this.modalOptions.viewIndex ?? 0;
				try {
					const defaults = await this.plugin.baseIdentityService?.getViewDefaults(file, viewIndex);
					if (defaults) {
						for (const [key, value] of Object.entries(defaults)) {
							if (!this.bulkCustomProperties[key]) {
								this.bulkCustomProperties[key] = {
									type: this.inferPropertyType(value),
									value,
								};
							}
						}
					}
				} catch {
					// Defaults are optional — silently continue
				}
			}
		}

		// 3. Ensure mapped properties have entries in bulkCustomProperties
		//    so they appear as active rows (even without a default value)
		for (const [fieldKey, propName] of Object.entries(this.bulkFieldOverrides)) {
			if (propName && !this.bulkCustomProperties[propName]) {
				const expectedType = OVERRIDABLE_FIELD_TYPES[fieldKey as OverridableField] || "text";
				this.bulkCustomProperties[propName] = {
					type: expectedType as PropertyType,
					value: "",
				};
			}
		}

		// 4. Refresh the PropertyPicker and active list to reflect new state
		this.refreshPropertyPicker();
		this.renderCustomPropsActiveList();
	}

	/**
	 * Render the expandable items section.
	 */
	private renderItemsSection(container: HTMLElement) {
		const section = container.createDiv({ cls: "tn-bulk-modal__section" });

		// Section header
		const header = section.createDiv({ cls: "tn-bulk-modal__section-header" });
		header.createSpan({ cls: "tn-bulk-modal__section-label", text: "ITEMS" });

		// Summary row (clickable to expand)
		this.itemsContainer = section.createDiv({ cls: "tn-bulk-modal__items-summary" });
		this.updateItemsSummary();

		// Expandable list
		this.itemsListContainer = section.createDiv({ cls: "tn-bulk-modal__items-list" });
		this.populateItemsList();

		// Click to expand/collapse
		this.itemsContainer.addEventListener("click", () => {
			this.itemsExpanded = !this.itemsExpanded;
			this.itemsListContainer?.toggleClass("is-expanded", this.itemsExpanded);
			const expandBtn = this.itemsContainer?.querySelector(".tn-bulk-modal__expand-btn");
			expandBtn?.toggleClass("is-expanded", this.itemsExpanded);
		});
	}

	/**
	 * Update the items summary display.
	 */
	private updateItemsSummary() {
		if (!this.itemsContainer) return;
		this.itemsContainer.empty();

		const countSpan = this.itemsContainer.createSpan({ cls: "tn-bulk-modal__items-count" });
		countSpan.textContent = `${this.items.length} item${this.items.length !== 1 ? "s" : ""} selected`;

		// Expand button (text chevron - setIcon SVG doesn't render reliably here)
		const expandBtn = this.itemsContainer.createEl("button", {
			cls: `tn-bulk-modal__expand-btn ${this.itemsExpanded ? "is-expanded" : ""}`,
			text: "▾",
		});
	}

	/**
	 * Populate the expandable items list.
	 */
	private populateItemsList() {
		if (!this.itemsListContainer) return;
		this.itemsListContainer.empty();

		const maxItems = 20;
		const itemsToShow = this.items.slice(0, maxItems);

		for (const item of itemsToShow) {
			const itemEl = this.itemsListContainer.createDiv({ cls: "tn-bulk-modal__item" });
			const title = this.extractTitle(item);
			itemEl.createSpan({ cls: "tn-bulk-modal__item-title", text: title });
		}

		if (this.items.length > maxItems) {
			this.itemsListContainer.createDiv({
				cls: "tn-bulk-modal__items-more",
				text: `...and ${this.items.length - maxItems} more`,
			});
		}
	}

	/**
	 * Update items list with skip badges based on pre-check results.
	 */
	private updateItemsWithSkipBadges(skipPaths: Set<string>, badgeText: string) {
		if (!this.itemsListContainer) return;

		const items = this.itemsListContainer.querySelectorAll(".tn-bulk-modal__item");
		const maxItems = 20;

		for (let i = 0; i < Math.min(this.items.length, maxItems); i++) {
			const item = this.items[i];
			const itemEl = items[i] as HTMLElement;
			if (!itemEl) continue;

			const isSkipped = item.path && skipPaths.has(item.path);

			if (isSkipped) {
				itemEl.addClass("tn-bulk-modal__item--skipped");
				let badge = itemEl.querySelector(".tn-bulk-modal__item-badge") as HTMLElement;
				if (!badge) {
					badge = itemEl.createSpan({ cls: "tn-bulk-modal__item-badge", text: badgeText });
				} else {
					badge.textContent = badgeText;
				}
			} else {
				itemEl.removeClass("tn-bulk-modal__item--skipped");
				const badge = itemEl.querySelector(".tn-bulk-modal__item-badge");
				if (badge) badge.remove();
			}
		}
	}

	/**
	 * Render the sticky footer with status, progress, and buttons.
	 */
	private renderFooter(container: HTMLElement) {
		const footer = container.createDiv({ cls: "tn-bulk-modal__footer" });

		// Status message
		this.statusContainer = footer.createDiv({ cls: "tn-bulk-modal__status" });

		// Progress bar (hidden initially)
		this.progressBar = footer.createDiv({ cls: "tn-bulk-modal__progress" });
		this.progressBarInner = this.progressBar.createDiv({ cls: "tn-bulk-modal__progress-bar" });

		// Buttons
		const buttonsContainer = footer.createDiv({ cls: "tn-bulk-modal__buttons" });

		// Cancel button
		const cancelBtn = buttonsContainer.createEl("button", {
			text: "Cancel",
		});
		cancelBtn.addEventListener("click", () => this.close());

		// Action button
		this.actionButton = buttonsContainer.createEl("button", {
			text: this.getActionButtonText(),
			cls: "mod-cta",
		});
		this.actionButton.addEventListener("click", () => this.executeAction());
	}

	// ============================================================
	// Picker methods for action bar icons
	// ============================================================

	/**
	 * Sync a bulk action bar value to any mapped custom property.
	 * When the user sets Due date via the action bar icon, this updates
	 * the corresponding mapped property (e.g., "deadline") and re-renders.
	 */
	private syncActionBarToMappedProperty(fieldKey: OverridableField, value: string) {
		const mappedPropKey = this.bulkFieldOverrides[fieldKey];
		if (mappedPropKey && this.bulkCustomProperties[mappedPropKey]) {
			this.bulkCustomProperties[mappedPropKey].value = value;
			this.renderCustomPropsActiveList();
		}
	}

	/**
	 * Open the due date picker.
	 */
	private openDueDatePicker() {
		if (!this.dueIcon) return;

		const menu = new DateContextMenu({
			currentValue: this.dueDate || undefined,
			title: "Set due date",
			plugin: this.plugin,
			app: this.app,
			onSelect: (date: string | null) => {
				this.dueDate = date || "";
				this.updateActionIconStates();
				this.syncActionBarToMappedProperty("due", this.dueDate);
			},
		});
		menu.showAtElement(this.dueIcon);
	}

	/**
	 * Open the scheduled date picker.
	 */
	private openScheduledDatePicker() {
		if (!this.scheduledIcon) return;

		const menu = new DateContextMenu({
			currentValue: this.scheduledDate || undefined,
			title: "Set scheduled date",
			plugin: this.plugin,
			app: this.app,
			onSelect: (date: string | null) => {
				this.scheduledDate = date || "";
				this.updateActionIconStates();
				this.syncActionBarToMappedProperty("scheduled", this.scheduledDate);
			},
		});
		menu.showAtElement(this.scheduledIcon);
	}

	/**
	 * Open the status picker.
	 */
	private openStatusPicker() {
		if (!this.statusIcon) return;

		const menu = new StatusContextMenu({
			currentValue: this.bulkStatus,
			plugin: this.plugin,
			onSelect: (status: string) => {
				this.bulkStatus = status;
				this.updateActionIconStates();
			},
		});
		menu.showAtElement(this.statusIcon);
	}

	/**
	 * Open the priority picker.
	 */
	private openPriorityPicker() {
		if (!this.priorityIcon) return;

		const menu = new PriorityContextMenu({
			currentValue: this.bulkPriority,
			plugin: this.plugin,
			onSelect: (priority: string) => {
				this.bulkPriority = priority;
				this.updateActionIconStates();
			},
		});
		menu.showAtElement(this.priorityIcon);
	}

	/**
	 * Open the reminder picker using ReminderModal for stackable reminders.
	 */
	private openReminderPicker() {
		if (!this.reminderIcon) return;

		// Create a temporary TaskInfo for the context menu
		const tempTask: TaskInfo = {
			title: "Bulk Task",
			status: this.bulkStatus || "",
			priority: this.bulkPriority || "",
			due: this.dueDate || undefined,
			scheduled: this.scheduledDate || undefined,
			path: "", // No path - this is a bulk operation
			archived: false,
			reminders: [...this.bulkReminders],
		};

		if (!this.dueDate && !this.scheduledDate) {
			new Notice("Set a due or scheduled date to add relative reminders");
		}

		const menu = new ReminderContextMenu(
			this.plugin,
			tempTask,
			this.reminderIcon,
			(updatedTask: TaskInfo) => {
				this.bulkReminders = updatedTask.reminders || [];
				this.updateActionIconStates();
			},
			this.items.map(i => i.path).filter((p): p is string => !!p)
		);

		const rect = this.reminderIcon.getBoundingClientRect();
		const event = new MouseEvent("click", {
			clientX: rect.left,
			clientY: rect.bottom,
		});
		menu.show(event);
	}

	/**
	 * Open the assignee picker.
	 */
	private openAssigneePicker() {
		// For assignees, we need a modal or popover with the PersonGroupPicker
		// For now, use a simple approach - create a temporary container
		// TODO: Implement proper popover with PersonGroupPicker

		const { Menu } = require("obsidian");
		const menu = new Menu();

		// Add persons
		for (const person of this.discoveredPersons) {
			const isSelected = this.selectedAssignees.includes(person.path);
			menu.addItem((item: any) => {
				item.setTitle(person.displayName);
				if (isSelected) {
					item.setIcon("check");
				}
				item.onClick(() => {
					if (isSelected) {
						this.selectedAssignees = this.selectedAssignees.filter(p => p !== person.path);
					} else {
						this.selectedAssignees.push(person.path);
					}
					this.updateActionIconStates();
				});
			});
		}

		// Separator if both exist
		if (this.discoveredPersons.length > 0 && this.discoveredGroups.length > 0) {
			menu.addSeparator();
		}

		// Add groups
		for (const group of this.discoveredGroups) {
			const isSelected = this.selectedAssignees.includes(group.notePath);
			menu.addItem((item: any) => {
				item.setTitle(`👥 ${group.displayName}`);
				if (isSelected) {
					item.setIcon("check");
				}
				item.onClick(() => {
					if (isSelected) {
						this.selectedAssignees = this.selectedAssignees.filter(p => p !== group.notePath);
					} else {
						this.selectedAssignees.push(group.notePath);
					}
					this.updateActionIconStates();
				});
			});
		}

		// Clear option
		if (this.selectedAssignees.length > 0) {
			menu.addSeparator();
			menu.addItem((item: any) => {
				item.setTitle("Clear all");
				item.onClick(() => {
					this.selectedAssignees = [];
					this.updateActionIconStates();
				});
			});
		}

		if (this.assigneeIcon) {
			const rect = this.assigneeIcon.getBoundingClientRect();
			menu.showAtPosition({ x: rect.left, y: rect.bottom });
		}
	}

	/**
	 * Show or create the View Settings body.
	 * Lazily loads notification config from .base YAML on first open.
	 */
	private async showViewSettingsBody() {
		if (!this.bodyContainer) return;

		// Create container on first use
		if (!this.viewSettingsContainer) {
			this.viewSettingsContainer = this.bodyContainer.createDiv({ cls: "tn-bulk-modal__view-settings" });
		}
		this.viewSettingsContainer.style.display = "";

		// Load config from YAML on first open
		if (!this.viewSettingsLoaded) {
			await this.loadViewNotificationConfig();
			await this.loadViewFieldMapping();
			await this.loadViewDefaults();
			this.viewSettingsLoaded = true;
		}

		// Re-render the settings UI
		this.viewSettingsContainer.empty();
		this.renderViewSettingsBody(this.viewSettingsContainer);
	}

	/**
	 * Load notification config from the .base file's per-view YAML.
	 */
	private async loadViewNotificationConfig() {
		if (!this.baseFilePath) return;

		const file = this.app.vault.getAbstractFileByPath(this.baseFilePath);
		if (!(file instanceof TFile)) return;

		const viewIndex = this.modalOptions.viewIndex ?? 0;
		try {
			const config = await this.plugin.baseIdentityService?.getViewNotificationConfig(
				file,
				viewIndex
			);
			if (config) {
				this.notifyEnabled = config.notify;
				this.notifyOn = config.notifyOn as "any" | "new_items" | "count_threshold";
				this.notifyThreshold = config.notifyThreshold;
			}
		} catch (error) {
			this.plugin.debugLog?.warn("BulkTaskCreationModal", "Failed to load notification config", error);
		}
	}

	/**
	 * Save notification config to the .base file's per-view YAML.
	 */
	private async saveViewNotificationConfig() {
		if (!this.baseFilePath) return;

		const file = this.app.vault.getAbstractFileByPath(this.baseFilePath);
		if (!(file instanceof TFile)) return;

		const viewIndex = this.modalOptions.viewIndex ?? 0;
		try {
			await this.plugin.baseIdentityService?.setViewNotificationConfig(
				file,
				viewIndex,
				{
					notify: this.notifyEnabled,
					notifyOn: this.notifyOn,
					notifyThreshold: this.notifyThreshold,
				}
			);
			// BasesQueryWatcher picks up .base file changes via metadata cache events
		} catch (error) {
			this.plugin.debugLog?.warn("BulkTaskCreationModal", "Failed to save notification config", error);
		}
	}

	/**
	 * Load per-view field mapping from the .base file's YAML.
	 * Must be called BEFORE loadViewDefaults() so mapping entries can be merged.
	 */
	private async loadViewFieldMapping() {
		if (!this.baseFilePath) return;

		const file = this.app.vault.getAbstractFileByPath(this.baseFilePath);
		if (!(file instanceof TFile)) return;

		const viewIndex = this.modalOptions.viewIndex ?? 0;
		try {
			const mapping = await this.plugin.baseIdentityService?.getViewFieldMapping(
				file,
				viewIndex
			);
			if (mapping) {
				this.viewFieldMapping = {};
				for (const [key, value] of Object.entries(mapping)) {
					if (value) this.viewFieldMapping[key] = value;
				}
			}
		} catch (error) {
			this.plugin.debugLog?.warn("BulkTaskCreationModal", "Failed to load view field mapping", error);
		}
	}

	/**
	 * Save per-view field mapping to the .base file's YAML.
	 */
	private async saveViewFieldMapping() {
		if (!this.baseFilePath) return;

		const file = this.app.vault.getAbstractFileByPath(this.baseFilePath);
		if (!(file instanceof TFile)) return;

		const viewIndex = this.modalOptions.viewIndex ?? 0;
		try {
			const mapping: import("../identity/BaseIdentityService").ViewFieldMapping = {};
			for (const [key, value] of Object.entries(this.viewFieldMapping)) {
				(mapping as any)[key] = value;
			}
			await this.plugin.baseIdentityService?.setViewFieldMapping(
				file,
				viewIndex,
				mapping
			);
			// Update modal options so Generate/Convert tabs use updated mapping
			this.modalOptions.viewFieldMapping = mapping;
		} catch (error) {
			this.plugin.debugLog?.warn("BulkTaskCreationModal", "Failed to save view field mapping", error);
		}
	}

	/**
	 * Load per-view defaults from the .base file's YAML.
	 * Populates viewDefaultProperties with type inference.
	 * Also includes mapped properties (from viewFieldMapping) that have no default value.
	 */
	private async loadViewDefaults() {
		if (!this.baseFilePath) return;

		const file = this.app.vault.getAbstractFileByPath(this.baseFilePath);
		if (!(file instanceof TFile)) return;

		const viewIndex = this.modalOptions.viewIndex ?? 0;
		try {
			const defaults = await this.plugin.baseIdentityService?.getViewDefaults(
				file,
				viewIndex
			);
			if (defaults) {
				for (const [key, value] of Object.entries(defaults)) {
					this.viewDefaultProperties[key] = {
						type: this.inferPropertyType(value),
						value,
					};
				}
			}
			// Include mapped properties that don't already have a default entry
			for (const [, propName] of Object.entries(this.viewFieldMapping)) {
				if (propName && !this.viewDefaultProperties[propName]) {
					const expectedField = Object.entries(this.viewFieldMapping).find(([, v]) => v === propName)?.[0];
					const expectedType = expectedField ? (OVERRIDABLE_FIELD_TYPES[expectedField as OverridableField] || "text") : "text";
					this.viewDefaultProperties[propName] = {
						type: expectedType as PropertyType,
						value: "",
					};
				}
			}
		} catch (error) {
			this.plugin.debugLog?.warn("BulkTaskCreationModal", "Failed to load view defaults", error);
		}
	}

	/**
	 * Infer PropertyType from a raw YAML value.
	 */
	private inferPropertyType(value: any): PropertyType {
		if (typeof value === "boolean") return "boolean";
		if (typeof value === "number") return "number";
		if (Array.isArray(value)) return "list";
		if (value instanceof Date) return "date";
		if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return "date";
		return "text";
	}

	/**
	 * Save per-view defaults to the .base file's YAML.
	 * Flattens viewDefaultProperties to { key: value } for storage.
	 */
	private async saveViewDefaults() {
		if (!this.baseFilePath) return;

		const file = this.app.vault.getAbstractFileByPath(this.baseFilePath);
		if (!(file instanceof TFile)) return;

		const viewIndex = this.modalOptions.viewIndex ?? 0;
		try {
			const flat: Record<string, any> = {};
			for (const [key, entry] of Object.entries(this.viewDefaultProperties)) {
				// Only save entries with non-empty values
				if (entry.value !== "" && entry.value !== undefined && entry.value !== null) {
					flat[key] = entry.value;
				}
			}
			await this.plugin.baseIdentityService?.setViewDefaults(
				file,
				viewIndex,
				flat
			);
		} catch (error) {
			this.plugin.debugLog?.warn("BulkTaskCreationModal", "Failed to save view defaults", error);
		}
	}

	/** Find which core field (if any) a view property is mapped to. */
	private findViewMappingForProperty(propertyKey: string): OverridableField | null {
		for (const [fieldKey, propName] of Object.entries(this.viewFieldMapping)) {
			if (propName === propertyKey) {
				return fieldKey as OverridableField;
			}
		}
		return null;
	}

	/** Clear any view mapping that points to a given property key. */
	private clearViewMappingForProperty(propertyKey: string): void {
		for (const [fieldKey, propName] of Object.entries(this.viewFieldMapping)) {
			if (propName === propertyKey) {
				delete this.viewFieldMapping[fieldKey];
			}
		}
	}

	/**
	 * Render the unified Default Properties & Anchors section for View Settings.
	 * Same visual pattern as the Generate/Convert "PROPERTIES & ANCHORS" section.
	 */
	private renderViewPropertiesSection(container: HTMLElement) {
		const section = container.createDiv({ cls: "tn-bulk-modal__section" });
		const header = section.createDiv({ cls: "tn-bulk-modal__section-header" });
		header.createSpan({ cls: "tn-bulk-modal__section-label", text: "DEFAULT PROPERTIES & ANCHORS" });

		const helpIcon = header.createSpan({ cls: "tn-bulk-modal__help" });
		setIcon(helpIcon, "help-circle");
		setTooltip(helpIcon, "These properties and values are automatically applied to every task created from this view (Generate, Convert, or New Task button). Use 'Map to' to assign custom properties to standard task fields like Due date or Assignee.");

		section.createDiv({
			cls: "tn-bulk-modal__section-subtitle",
			text: "Properties pre-populated on tasks created from this view. Use \u2018Map to\u2019 to assign custom properties to standard task fields (e.g., Due date, Scheduled date, Assignee).",
		});

		// PropertyPicker for adding new properties
		if (this.viewPropertiesPickerInstance) {
			this.viewPropertiesPickerInstance.destroy();
			this.viewPropertiesPickerInstance = null;
		}

		const pickerContainer = section.createDiv({ cls: "tn-bulk-modal__custom-props-panel" });

		// Active property rows — sibling of picker, safe from picker's container.empty()
		this.viewPropertiesActiveListEl = section.createDiv({ cls: "tn-bulk-modal__custom-props-active" });

		this.viewPropertiesPickerInstance = createPropertyPicker({
			container: pickerContainer,
			plugin: this.plugin,
			itemPaths: this.items.map(i => i.path).filter((p): p is string => !!p),
			excludeKeys: new Set(Object.keys(this.viewDefaultProperties)),
			includeNonTaskFiles: true,
			useAsOptions: Object.entries(OVERRIDABLE_FIELD_LABELS).map(([key, label]) => ({
				key,
				label,
				requiresType: (OVERRIDABLE_FIELD_TYPES[key as OverridableField] || "text") as PropertyType,
			})),
			claimedMappings: this.viewFieldMapping,
			onSelect: (key: string, type: PropertyType, value?: any, useAs?: string) => {
				if (useAs) {
					this.clearViewMappingForProperty(key);
					this.viewFieldMapping[useAs] = key;
					this.saveViewFieldMapping();
				}
				this.viewDefaultProperties[key] = { type, value: value ?? "" };
				this.saveViewDefaults();
				this.renderViewPropertiesActiveList();
				this.viewPropertiesPickerInstance?.refresh();
			},
		});

		// Render active properties (if any were loaded from YAML)
		this.renderViewPropertiesActiveList();
	}

	/**
	 * Render the active view properties list with expandable mapping rows.
	 * Follows the same pattern as renderCustomPropsActiveList() for Generate/Convert.
	 */
	private renderViewPropertiesActiveList() {
		if (!this.viewPropertiesActiveListEl) return;
		this.viewPropertiesActiveListEl.empty();

		const keys = Object.keys(this.viewDefaultProperties);
		if (keys.length === 0) return;

		for (const key of keys) {
			const entry = this.viewDefaultProperties[key];
			const row = this.viewPropertiesActiveListEl.createDiv({ cls: "tn-prop-row" });
			const currentMapping = this.findViewMappingForProperty(key);
			if (currentMapping) {
				row.classList.add("tn-prop-row--expanded");
			}

			// ── Header row ──
			const rowHeader = row.createDiv({ cls: "tn-prop-row__header" });

			// Expand toggle
			{
				const toggle = rowHeader.createDiv({ cls: "tn-prop-row__expand-toggle" });
				const svgNS = "http://www.w3.org/2000/svg";
				const chevronSvg = document.createElementNS(svgNS, "svg");
				chevronSvg.setAttribute("width", "12");
				chevronSvg.setAttribute("height", "12");
				chevronSvg.setAttribute("viewBox", "0 0 24 24");
				chevronSvg.setAttribute("fill", "none");
				chevronSvg.setAttribute("stroke", "currentColor");
				chevronSvg.setAttribute("stroke-width", "2");
				chevronSvg.setAttribute("stroke-linecap", "round");
				chevronSvg.setAttribute("stroke-linejoin", "round");
				const path = document.createElementNS(svgNS, "path");
				path.setAttribute("d", "M9 18l6-6-6-6");
				chevronSvg.appendChild(path);
				toggle.appendChild(chevronSvg);
				toggle.addEventListener("click", () => {
					row.classList.toggle("tn-prop-row--expanded");
				});
			}

			// Property key label (raw key, matching PropertyPicker display)
			rowHeader.createDiv({ cls: "tn-prop-row__key", text: key });

			// Type badge
			rowHeader.createDiv({ cls: "tn-prop-row__type-badge", text: entry.type });

			// Value input — only for unmapped properties (mapped properties get their value from the task field)
			const valueContainer = rowHeader.createDiv({ cls: "tn-prop-row__value" });
			if (currentMapping) {
				// Mapped properties: show read-only hint instead of editable input
				valueContainer.createSpan({
					text: "set via task field",
					cls: "tn-prop-row__value-placeholder",
				});
				valueContainer.style.color = "var(--text-faint)";
				valueContainer.style.fontStyle = "italic";
				valueContainer.style.fontSize = "var(--font-smallest)";
			} else {
				this.renderViewPropValueInput(valueContainer, key, entry);
			}

			// Mapping badge
			if (currentMapping) {
				const badge = rowHeader.createDiv({ cls: "tn-prop-row__mapping-badge" });
				const pinSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
				pinSvg.setAttribute("width", "10");
				pinSvg.setAttribute("height", "10");
				pinSvg.setAttribute("viewBox", "0 0 24 24");
				pinSvg.setAttribute("fill", "none");
				pinSvg.setAttribute("stroke", "currentColor");
				pinSvg.setAttribute("stroke-width", "2");
				const pinPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
				pinPath.setAttribute("d", "M12 17v5M9 2h6l-1 7h4l-8 8 2-7H8l1-8z");
				pinSvg.appendChild(pinPath);
				badge.appendChild(pinSvg);
				badge.createSpan({ text: OVERRIDABLE_FIELD_LABELS[currentMapping] });
			}

			// Remove button
			const removeBtn = rowHeader.createDiv({ cls: "tn-prop-row__remove" });
			const removeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			removeSvg.setAttribute("width", "14");
			removeSvg.setAttribute("height", "14");
			removeSvg.setAttribute("viewBox", "0 0 24 24");
			removeSvg.setAttribute("fill", "none");
			removeSvg.setAttribute("stroke", "currentColor");
			removeSvg.setAttribute("stroke-width", "2");
			const removePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
			removePath.setAttribute("d", "M18 6L6 18M6 6l12 12");
			removeSvg.appendChild(removePath);
			removeBtn.appendChild(removeSvg);
			removeBtn.title = "Remove default";
			removeBtn.addEventListener("click", () => {
				this.clearViewMappingForProperty(key);
				this.saveViewFieldMapping();
				delete this.viewDefaultProperties[key];
				this.saveViewDefaults();
				this.renderViewPropertiesActiveList();
				this.viewPropertiesPickerInstance?.refresh();
			});

			// ── Mapping panel ──
			{
				const panel = row.createDiv({ cls: "tn-prop-row__mapping-panel" });
				const mappingRow = panel.createDiv({ cls: "tn-prop-row__mapping-row" });
				mappingRow.createDiv({ cls: "tn-prop-row__mapping-label", text: "Map to:" });

				const select = mappingRow.createEl("select", { cls: "tn-prop-row__mapping-dropdown" });

				const mappingHelp = mappingRow.createSpan({ cls: "tn-prop-row__mapping-help" });
				setIcon(mappingHelp, "help-circle");
				setTooltip(mappingHelp, "Map this property to a standard task field. Saved to the .base file for this view.");

				const noneOpt = select.createEl("option", { value: "", text: "None (custom only)" });
				if (!currentMapping) noneOpt.selected = true;

				for (const [fieldKey, label] of Object.entries(OVERRIDABLE_FIELD_LABELS)) {
					const opt = select.createEl("option", { value: fieldKey, text: label });
					if (currentMapping === fieldKey) opt.selected = true;

					const existingProp = this.viewFieldMapping[fieldKey];
					if (existingProp && existingProp !== key) {
						opt.disabled = true;
						opt.text = `${label} (used by ${existingProp})`;
					}
				}

				select.addEventListener("change", () => {
					const newField = select.value;
					this.clearViewMappingForProperty(key);
					if (newField) {
						this.viewFieldMapping[newField] = key;
					}
					this.saveViewFieldMapping();
					this.renderViewPropertiesActiveList();
				});

				// ── Type mismatch note ──
				const expectedType = currentMapping ? (OVERRIDABLE_FIELD_TYPES[currentMapping as OverridableField] || "text") : null;
				if (currentMapping && expectedType && entry.type !== expectedType) {
					const mismatch = panel.createDiv({ cls: "tn-prop-row__type-mismatch" });
					mismatch.createSpan({ cls: "tn-prop-row__type-mismatch-icon", text: "\u26A0" });
					mismatch.createSpan({
						cls: "tn-prop-row__type-mismatch-text",
						text: `Property type is '${entry.type}', but '${OVERRIDABLE_FIELD_LABELS[currentMapping as OverridableField]}' expects '${expectedType}'.`,
					});
					const convertAction = mismatch.createEl("a", {
						cls: "tn-prop-row__type-mismatch-action",
						text: `Convert to ${expectedType}`,
					});
					convertAction.addEventListener("click", (e) => {
						e.preventDefault();
						entry.type = expectedType as PropertyType;
						this.renderViewPropertiesActiveList();
					});
				}
			}
		}
	}

	/**
	 * Render a type-appropriate value input for a view default property.
	 * Uses plain inline inputs (default values are a future feature;
	 * "Click to set..." is only for Generate/Convert custom properties).
	 */
	private renderViewPropValueInput(
		container: HTMLElement,
		key: string,
		entry: { type: PropertyType; value: any }
	) {
		switch (entry.type) {
			case "date": {
				const input = container.createEl("input", {
					cls: "tn-bulk-modal__custom-prop-input",
					attr: { type: "date" },
				});
				const rawValue = entry.value;
				input.value = rawValue instanceof Date ? rawValue.toISOString().slice(0, 10) : (rawValue || "");
				input.addEventListener("change", () => {
					this.viewDefaultProperties[key].value = input.value;
					this.saveViewDefaults();
				});
				break;
			}
			case "number": {
				const input = container.createEl("input", {
					cls: "tn-bulk-modal__custom-prop-input",
					attr: { type: "number" },
				});
				input.value = String(entry.value ?? 0);
				input.addEventListener("change", () => {
					this.viewDefaultProperties[key].value = parseFloat(input.value) || 0;
					this.saveViewDefaults();
				});
				break;
			}
			case "boolean": {
				const toggle = container.createEl("input", {
					attr: { type: "checkbox" },
					cls: "tn-bulk-modal__custom-prop-checkbox",
				});
				toggle.checked = !!entry.value;
				toggle.addEventListener("change", () => {
					this.viewDefaultProperties[key].value = toggle.checked;
					this.saveViewDefaults();
				});
				break;
			}
			default: {
				const input = container.createEl("input", {
					cls: "tn-bulk-modal__custom-prop-input",
					attr: {
						type: "text",
						placeholder: entry.type === "list" ? "comma-separated" : "value",
					},
				});
				input.value = Array.isArray(entry.value) ? entry.value.join(", ") : (entry.value || "");
				input.addEventListener("change", () => {
					if (entry.type === "list") {
						this.viewDefaultProperties[key].value = input.value.split(",").map(s => s.trim()).filter(Boolean);
					} else {
						this.viewDefaultProperties[key].value = input.value;
					}
					this.saveViewDefaults();
				});
				break;
			}
		}
	}

	/**
	 * Render the View Settings body with notification config controls.
	 */
	private renderViewSettingsBody(container: HTMLElement) {
		// No base file warning
		if (!this.baseFilePath) {
			const warning = container.createDiv({ cls: "tn-bulk-modal__section" });
			warning.createEl("p", {
				text: "No base file associated with this view. View settings are not available.",
				cls: "tn-bulk-modal__section-summary",
			});
			return;
		}

		// ── Default Properties & Anchors (unified section) ──
		this.renderViewPropertiesSection(container);

		// ── Notifications section ──
		const notifSection = container.createDiv({ cls: "tn-bulk-modal__section" });
		const notifHeader = notifSection.createDiv({ cls: "tn-bulk-modal__section-header" });
		notifHeader.createSpan({ cls: "tn-bulk-modal__section-label", text: "NOTIFICATIONS" });

		const helpIcon = notifHeader.createSpan({ cls: "tn-bulk-modal__help" });
		setIcon(helpIcon, "help-circle");
		setTooltip(helpIcon, "Configure when this view triggers notifications. Changes are saved to the .base file automatically.");

		notifSection.createDiv({
			cls: "tn-bulk-modal__section-subtitle",
			text: "Get notified when items match this view\u2019s filters",
		});

		const notifOptions = notifSection.createDiv({ cls: "tn-bulk-modal__options" });

		// Enable notifications toggle
		new Setting(notifOptions)
			.setName("Enable notifications")
			.setDesc("Notify when items match this view's filters")
			.addToggle((toggle) =>
				toggle.setValue(this.notifyEnabled).onChange(async (value) => {
					this.notifyEnabled = value;
					await this.saveViewNotificationConfig();
					// Re-render to show/hide dependent controls
					if (this.viewSettingsContainer) {
						this.viewSettingsContainer.empty();
						this.renderViewSettingsBody(this.viewSettingsContainer);
					}
				})
			);

		// Only show mode/threshold when notifications are enabled
		if (this.notifyEnabled) {
			// Notify mode dropdown
			new Setting(notifOptions)
				.setName("Notify when")
				.setDesc("Choose what triggers a notification")
				.addDropdown((dropdown) =>
					dropdown
						.addOption("any", "Any results match")
						.addOption("new_items", "New items appear")
						.addOption("count_threshold", "Count exceeds threshold")
						.setValue(this.notifyOn)
						.onChange(async (value) => {
							this.notifyOn = value as "any" | "new_items" | "count_threshold";
							await this.saveViewNotificationConfig();
							// Re-render to show/hide threshold
							if (this.viewSettingsContainer) {
								this.viewSettingsContainer.empty();
								this.renderViewSettingsBody(this.viewSettingsContainer);
							}
						})
				);

			// Threshold slider (only for count_threshold mode)
			if (this.notifyOn === "count_threshold") {
				new Setting(notifOptions)
					.setName("Threshold count")
					.setDesc(`Notify when results exceed ${this.notifyThreshold} items`)
					.addSlider((slider) =>
						slider
							.setLimits(1, 100, 1)
							.setValue(this.notifyThreshold)
							.setDynamicTooltip()
							.onChange(async (value) => {
								this.notifyThreshold = value;
								// Update description dynamically
								const descEl = slider.sliderEl.closest(".setting-item")?.querySelector(".setting-item-description");
								if (descEl) descEl.textContent = `Notify when results exceed ${value} items`;
								await this.saveViewNotificationConfig();
							})
					);
			}
		}

		// ── Info callout ──
		const infoSection = container.createDiv({ cls: "tn-bulk-modal__section tn-bulk-modal__view-settings-info" });
		const infoEl = infoSection.createDiv({ cls: "tn-bulk-modal__info-callout" });
		setIcon(infoEl.createSpan({ cls: "tn-bulk-modal__info-icon" }), "info");
		infoEl.createSpan({
			text: "Layout and display options (columns, grouping, sorting) are managed by Obsidian\u2019s built-in view controls. ",
		});
		const configLink = infoEl.createEl("a", {
			cls: "tn-bulk-modal__config-link",
			text: "Open Configure view panel",
		});
		setIcon(configLink.createSpan({ cls: "tn-bulk-modal__config-link-arrow" }), "arrow-up-right");
		configLink.addEventListener("click", (e) => {
			e.preventDefault();
			this.openNativeConfigureViewPanel();
		});
	}

	/**
	 * Close this modal and open the native "Configure view" panel
	 * for the Bases view that launched it.
	 *
	 * Flow: close modal → wait for DOM cleanup → open views popup → navigate to configure sub-panel.
	 * Uses polling instead of fixed timeouts for robustness.
	 */
	private openNativeConfigureViewPanel(): void {
		// Find the workspace leaf showing this .base file BEFORE closing the modal
		let targetLeafEl: HTMLElement | null = null;

		if (this.baseFilePath) {
			this.app.workspace.iterateAllLeaves((leaf) => {
				const state = leaf.getViewState()?.state;
				if (state?.file === this.baseFilePath) {
					targetLeafEl = (leaf as any).containerEl as HTMLElement;
				}
			});
		}

		// Close the modal first
		this.close();

		// Poll until modal containers are gone from DOM, then proceed
		const pollInterval = 50;
		const maxWait = 2000;
		let elapsed = 0;

		const waitForModalClose = () => {
			if (document.querySelector(".modal-container") && elapsed < maxWait) {
				elapsed += pollInterval;
				setTimeout(waitForModalClose, pollInterval);
				return;
			}
			this.openConfigureViewAfterModalClose(targetLeafEl);
		};

		// Start polling on next frame to let close() take effect
		requestAnimationFrame(waitForModalClose);
	}

	/**
	 * After the BulkTaskCreationModal is fully closed, open the Configure view popup.
	 */
	private openConfigureViewAfterModalClose(targetLeafEl: HTMLElement | null): void {
		if (!targetLeafEl) {
			new Notice("Could not find the Bases view. Open the view and use the toolbar to configure it.");
			return;
		}

		// Check if the configure view popup is already open (user may have left it open)
		const existingPopup = document.querySelector(
			".menu.bases-toolbar-views-menu"
		);
		if (existingPopup) {
			// Popup is open — check if already on configure view sub-panel
			if (existingPopup.querySelector(".view-config-menu")) {
				// Already showing the configure view panel — nothing to do
				return;
			}
			// Popup is on the views list — click the chevron icon to navigate to configure view
			const chevron = existingPopup.querySelector(
				".bases-toolbar-menu-item.is-selected .bases-toolbar-menu-item-icon"
			) as HTMLElement | null;
			if (chevron) {
				chevron.click();
			}
			return;
		}

		// Popup is closed — click the views menu button to open it
		const viewsMenuBtn = targetLeafEl.querySelector(
			".bases-toolbar-views-menu .text-icon-button"
		) as HTMLElement | null;

		if (!viewsMenuBtn) {
			new Notice("Configure view panel is not available for this view type. Use the toolbar controls instead.");
			return;
		}

		viewsMenuBtn.click();

		// Poll for the popup to appear, then click the selected view item
		const pollInterval = 50;
		const maxWait = 2000;
		let elapsed = 0;

		const waitForPopup = () => {
			const popup = document.querySelector(".menu.bases-toolbar-views-menu");
			if (popup) {
				// Popup appeared — check if it went straight to configure view
				if (popup.querySelector(".view-config-menu")) {
					return; // Already on configure view
				}
				// On views list — click the chevron icon to navigate to configure view
				const chevron = popup.querySelector(
					".bases-toolbar-menu-item.is-selected .bases-toolbar-menu-item-icon"
				) as HTMLElement | null;
				if (chevron) {
					chevron.click();
					return;
				}
			}
			// Keep polling if popup hasn't appeared yet
			elapsed += pollInterval;
			if (elapsed < maxWait) {
				setTimeout(waitForPopup, pollInterval);
			}
		};

		setTimeout(waitForPopup, pollInterval);
	}

	onClose() {
		// Clean up PersonGroupPicker
		this.assigneePicker?.destroy();
		this.assigneePicker = null;

		// Clean up PropertyPicker
		if (this.propertyPickerInstance) {
			this.propertyPickerInstance.destroy();
			this.propertyPickerInstance = null;
		}

		// Clean up view properties PropertyPicker
		if (this.viewPropertiesPickerInstance) {
			this.viewPropertiesPickerInstance.destroy();
			this.viewPropertiesPickerInstance = null;
		}

		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Get action button text for the current mode.
	 */
	private getActionButtonText(): string {
		if (this.mode === "viewSettings") return "Save";
		if (this.mode === "bulkEdit") return "Edit tasks";
		return this.mode === "generate" ? "Generate tasks" : "Convert to tasks";
	}

	/**
	 * Handle mode change: update UI, rebuild sections, and re-run pre-check.
	 */
	private onModeChanged() {
		const isViewSettings = this.mode === "viewSettings";

		// Toggle visibility of bulk-tasking sections vs view settings
		if (this.topSectionsWrapper) {
			this.topSectionsWrapper.style.display = isViewSettings ? "none" : "";
		}
		if (this.itemsContainer?.closest(".tn-bulk-modal__section")) {
			(this.itemsContainer.closest(".tn-bulk-modal__section") as HTMLElement).style.display = isViewSettings ? "none" : "";
		}
		if (this.itemsListContainer?.closest(".tn-bulk-modal__section")) {
			// Items section is the parent of itemsContainer — already handled above
		}
		if (this.optionsContainer) {
			this.optionsContainer.style.display = isViewSettings ? "none" : "";
		}
		if (this.compatContainer) {
			this.compatContainer.style.display = (!isViewSettings && this.mode === "convert") ? "block" : "none";
			if (this.mode !== "convert") {
				this.compatContainer.empty();
			}
		}

		// Hide footer status, progress, and header summary in viewSettings mode
		if (this.statusContainer) {
			this.statusContainer.style.display = isViewSettings ? "none" : "";
		}
		if (this.progressBar) {
			this.progressBar.style.display = isViewSettings ? "none" : "";
		}
		if (this.summarySpan) {
			this.summarySpan.style.display = isViewSettings ? "none" : "";
		}

		// Update action button
		if (this.actionButton) {
			if (isViewSettings) {
				this.actionButton.textContent = "Save";
				this.actionButton.disabled = false;
			} else {
				this.actionButton.textContent = this.getActionButtonText();
				this.actionButton.disabled = false;
			}
		}

		if (isViewSettings) {
			// Show view settings
			this.showViewSettingsBody();
		} else {
			// Hide view settings container
			if (this.viewSettingsContainer) {
				this.viewSettingsContainer.style.display = "none";
			}

			// Rebuild action bar and assignee section for new mode
			this.rebuildActionBarAndAssignees();

			// Rebuild options for new mode
			this.rebuildOptions();

			// Re-run pre-check
			this.runPreCheck();
		}
	}

	/**
	 * Rebuild the action bar and assignee sections.
	 * Used on mode change and when groups are discovered async.
	 */
	private rebuildActionBarAndAssignees() {
		if (!this.topSectionsWrapper) return;

		// Clean up existing pickers before emptying the wrapper
		this.assigneePicker?.destroy();
		this.assigneePicker = null;
		if (this.propertyPickerInstance) {
			this.propertyPickerInstance.destroy();
			this.propertyPickerInstance = null;
		}
		this.customPropsPanel = null;
		this.activeListEl = null;

		// Empty the wrapper and re-render all top sections fresh
		this.topSectionsWrapper.empty();
		this.renderTopSections();
	}

	/**
	 * Render assignee section content into a container.
	 */
	private renderAssigneeSectionInto(section: HTMLElement) {
		// Section header
		const header = section.createDiv({ cls: "tn-bulk-modal__section-header" });
		header.createSpan({ cls: "tn-bulk-modal__section-label", text: "ASSIGNEES" });

		const helpIcon = header.createSpan({ cls: "tn-bulk-modal__help" });
		setIcon(helpIcon, "help-circle");
		setTooltip(helpIcon, "Assign tasks to people or groups. Supports multiple assignees.");

		// Check if persons/groups available
		const hasAssignees = this.discoveredPersons.length > 0 || this.discoveredGroups.length > 0;

		if (!hasAssignees) {
			const emptyMsg = section.createDiv({ cls: "tn-bulk-modal__section-summary" });
			emptyMsg.textContent = "No person or group notes found in vault.";
			return;
		}

		// Picker container
		const pickerContainer = section.createDiv({ cls: "tn-bulk-modal__assignee-picker" });

		// Create the PersonGroupPicker
		this.assigneePicker = createPersonGroupPicker({
			container: pickerContainer,
			persons: this.discoveredPersons,
			groups: this.discoveredGroups,
			multiSelect: true,
			placeholder: "Search people or groups...",
			initialSelection: this.selectedAssignees,
			onChange: (paths) => {
				this.selectedAssignees = paths;
			},
		});
	}

	/**
	 * Render action bar content into a container.
	 * Shows same icons for both modes - unified bulk values.
	 */
	private renderActionBarInto(section: HTMLElement) {
		// Section header with label and help icon
		const header = section.createDiv({ cls: "tn-bulk-modal__section-header" });
		header.createSpan({ cls: "tn-bulk-modal__section-label", text: "BULK VALUES" });

		const helpIcon = header.createSpan({ cls: "tn-bulk-modal__help" });
		setIcon(helpIcon, "help-circle");
		setTooltip(helpIcon, "Set values to apply to all items. Click an icon to set a value.");

		// Action bar with icons - same for both modes
		const actionBar = section.createDiv({ cls: "tn-bulk-modal__action-bar" });

		// Date icons
		this.dueIcon = this.createActionIcon(actionBar, "calendar", "Due date", () => this.openDueDatePicker());
		this.scheduledIcon = this.createActionIcon(actionBar, "calendar-clock", "Scheduled date", () => this.openScheduledDatePicker());

		actionBar.createDiv({ cls: "tn-bulk-modal__action-separator" });

		// Status and Priority
		this.statusIcon = this.createActionIcon(actionBar, "circle-dot", "Status", () => this.openStatusPicker());
		this.priorityIcon = this.createActionIcon(actionBar, "flag", "Priority", () => this.openPriorityPicker());

		actionBar.createDiv({ cls: "tn-bulk-modal__action-separator" });

		// Reminders
		this.reminderIcon = this.createActionIcon(actionBar, "bell", "Reminders", () => this.openReminderPicker());

		// Reminder warning (hidden by default, shown when reminders set but no dates)
		this.reminderWarning = section.createDiv({
			cls: "tn-bulk-modal__reminder-warning",
			text: "⚠ Set a due or scheduled date for relative reminders to work",
		});
		this.reminderWarning.style.display = "none";

		// Update icon states
		this.updateActionIconStates();
	}

	/**
	 * Rebuild the options section based on current mode.
	 */
	private rebuildOptions() {
		if (!this.optionsContainer) return;
		this.optionsContainer.empty();

		if (this.mode === "generate") {
			this.renderGenerateOptions(this.optionsContainer);
		} else if (this.mode === "bulkEdit") {
			this.renderBulkEditOptions(this.optionsContainer);
		} else {
			this.renderConvertOptions(this.optionsContainer);
		}
	}

	/**
	 * Render Generate-mode options.
	 * Note: Assignees are now set via the action bar icon.
	 */
	private renderGenerateOptions(container: HTMLElement) {
		// Section header
		const header = container.createDiv({ cls: "tn-bulk-modal__section-header" });
		header.createSpan({ cls: "tn-bulk-modal__section-label", text: "OPTIONS" });

		const helpIcon = header.createSpan({ cls: "tn-bulk-modal__help" });
		setIcon(helpIcon, "help-circle");
		setTooltip(helpIcon, "Configure how new task files are created. See Settings → Task properties for defaults.");

		// Options container
		const optionsBox = container.createDiv({ cls: "tn-bulk-modal__options" });

		new Setting(optionsBox)
			.setName("Skip existing")
			.setDesc("Skip items that already have tasks linked to them")
			.addToggle((toggle) =>
				toggle.setValue(this.skipExisting).onChange((value) => {
					this.skipExisting = value;
					this.runPreCheck();
				})
			);

		new Setting(optionsBox)
			.setName("Link to source")
			.setDesc("Add source note as project in each created task")
			.addToggle((toggle) =>
				toggle.setValue(this.useParentAsProject).onChange((value) => {
					this.useParentAsProject = value;
				})
			);
	}

	/**
	 * Render Convert-mode options.
	 * Note: Date/reminder values are now set via the action bar icons.
	 */
	private renderConvertOptions(container: HTMLElement) {
		// Section header
		const header = container.createDiv({ cls: "tn-bulk-modal__section-header" });
		header.createSpan({ cls: "tn-bulk-modal__section-label", text: "OPTIONS" });

		const helpIcon = header.createSpan({ cls: "tn-bulk-modal__help" });
		setIcon(helpIcon, "help-circle");
		setTooltip(helpIcon, "Configure how notes are converted to tasks. See Settings → Task properties for defaults.");

		// Options container
		const optionsBox = container.createDiv({ cls: "tn-bulk-modal__options" });

		new Setting(optionsBox)
			.setName("Skip notes already recognized as tasks")
			.setDesc("Skip items that TaskNotes already identifies as tasks")
			.addToggle((toggle) =>
				toggle.setValue(this.skipAlreadyTasks).onChange((value) => {
					this.skipAlreadyTasks = value;
					this.runPreCheck();
				})
			);

		new Setting(optionsBox)
			.setName("Apply default values")
			.setDesc("Add default status, priority, and creation date")
			.addToggle((toggle) =>
				toggle.setValue(this.applyDefaults).onChange((value) => {
					this.applyDefaults = value;
				})
			);

		// Only show "Link to base view" if we know the base file path
		if (this.baseFilePath) {
			new Setting(optionsBox)
				.setName("Link to base view")
				.setDesc("Add a project link to this base view")
				.addToggle((toggle) =>
					toggle.setValue(this.linkToBase).onChange((value) => {
						this.linkToBase = value;
					})
				);
		}
	}

	/**
	 * Render Bulk Edit-mode options.
	 */
	private renderBulkEditOptions(container: HTMLElement) {
		const header = container.createDiv({ cls: "tn-bulk-modal__section-header" });
		header.createSpan({ cls: "tn-bulk-modal__section-label", text: "OPTIONS" });

		const helpIcon = header.createSpan({ cls: "tn-bulk-modal__help" });
		setIcon(helpIcon, "help-circle");
		setTooltip(helpIcon, "Modify properties on existing task files. Only the fields you set above will be changed. Non-task items are skipped.");

		const optionsBox = container.createDiv({ cls: "tn-bulk-modal__options" });

		// Warning callout
		const warningEl = optionsBox.createDiv({ cls: "tn-bulk-modal__edit-warning" });
		warningEl.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 6px; background: var(--background-modifier-error-hover); color: var(--text-normal); font-size: var(--font-ui-small); margin-bottom: 8px;";
		const warningIconEl = warningEl.createSpan();
		setIcon(warningIconEl, "alert-triangle");
		warningEl.createSpan({ text: "This will overwrite selected properties on existing task files. Only fields you've set above will be changed." });
	}

	/**
	 * Run pre-check based on current mode.
	 */
	private async runPreCheck() {
		if (!this.statusContainer) return;

		this.statusContainer.empty();
		this.statusContainer.createSpan({ text: "Checking..." });

		try {
			if (this.mode === "generate") {
				await this.runGeneratePreCheck();
			} else if (this.mode === "bulkEdit") {
				await this.runEditPreCheck();
			} else {
				await this.runConvertPreCheck();
			}
		} catch (error) {
			this.statusContainer.empty();
			this.statusContainer.createSpan({
				text: "Error during pre-check",
				cls: "tn-bulk-status-error",
			});
		}
	}

	/**
	 * Pre-check for Generate mode: check for existing tasks.
	 */
	private async runGeneratePreCheck() {
		if (!this.statusContainer) return;

		const preCheck = await this.engine.preCheck(this.items, this.skipExisting);

		this.statusContainer.empty();
		if (preCheck.toSkip > 0) {
			this.statusContainer.createSpan({
				text: `Ready to create ${preCheck.toCreate} task${preCheck.toCreate !== 1 ? "s" : ""}, skip ${preCheck.toSkip} existing`,
			});
		} else {
			this.statusContainer.createSpan({
				text: `Ready to create ${preCheck.toCreate} task${preCheck.toCreate !== 1 ? "s" : ""}`,
			});
		}

		// Update items list with skip badges
		this.updateItemsWithSkipBadges(preCheck.existing, "exists");

		// Update items summary with skip count
		this.updateItemsSummaryWithSkips(preCheck.toSkip);

		if (this.actionButton) {
			this.actionButton.disabled = preCheck.toCreate === 0;
		}
	}

	/**
	 * Pre-check for Convert mode: check which items are already tasks.
	 */
	private async runConvertPreCheck() {
		if (!this.statusContainer) return;

		const preCheck = await this.convertEngine.preCheck(this.items);

		// Update status with ready count
		this.statusContainer.empty();
		this.statusContainer.createSpan({
			text: `Ready to convert ${preCheck.toConvert} markdown file${preCheck.toConvert !== 1 ? "s" : ""}`,
		});

		// Render the inline compatibility badges
		this.renderCompatibilityBadges(preCheck);

		// Calculate total skips
		const totalSkips = (this.skipAlreadyTasks ? preCheck.alreadyTasks : 0) + preCheck.nonMarkdown;

		// Update items with skip badges
		const allSkipPaths = new Set<string>();
		if (this.skipAlreadyTasks) {
			preCheck.alreadyTaskPaths.forEach(p => allSkipPaths.add(p));
		}
		preCheck.nonMarkdownPaths.forEach(p => allSkipPaths.add(p));

		// Repopulate items list with badges
		this.populateItemsListWithBadges(preCheck.alreadyTaskPaths, preCheck.nonMarkdownPaths);

		// Update items summary
		this.updateItemsSummaryWithSkips(totalSkips);

		if (this.actionButton) {
			this.actionButton.disabled = preCheck.toConvert === 0;
		}
	}

	/**
	 * Pre-check for Bulk Edit mode: check which items are tasks (editable) vs non-tasks (skipped).
	 */
	private async runEditPreCheck() {
		if (!this.statusContainer) return;

		const preCheck = await this.editEngine.preCheck(this.items);

		this.statusContainer.empty();
		this.statusContainer.createSpan({
			text: `Ready to edit ${preCheck.toEdit} task${preCheck.toEdit !== 1 ? "s" : ""}`,
		});

		// Show skip info if any
		const totalSkips = preCheck.notTasks + preCheck.nonMarkdown;

		// Populate items list with badges (reuse: notTaskPaths shown as "not a task", nonMarkdown as usual)
		this.populateItemsListWithEditBadges(preCheck.notTaskPaths, preCheck.nonMarkdownPaths);
		this.updateItemsSummaryWithSkips(totalSkips);

		if (this.actionButton) {
			this.actionButton.disabled = preCheck.toEdit === 0;
		}
	}

	/**
	 * Populate items list with skip badges for bulk edit mode.
	 */
	private populateItemsListWithEditBadges(notTaskPaths: Set<string>, nonMarkdownPaths: Set<string>) {
		if (!this.itemsListContainer) return;
		this.itemsListContainer.empty();

		const maxItems = 20;
		const itemsToShow = this.items.slice(0, maxItems);

		for (const item of itemsToShow) {
			const isNotTask = item.path && notTaskPaths.has(item.path);
			const isNonMarkdown = item.path && nonMarkdownPaths.has(item.path);
			const isSkipped = isNotTask || isNonMarkdown;

			const itemEl = this.itemsListContainer.createDiv({
				cls: `tn-bulk-modal__item ${isSkipped ? "tn-bulk-modal__item--skipped" : ""}`,
			});

			const title = this.extractTitle(item);
			itemEl.createSpan({ cls: "tn-bulk-modal__item-title", text: title });

			if (isNonMarkdown) {
				const badge = itemEl.createSpan({ cls: "tn-bulk-modal__item-badge tn-bulk-modal__item-badge--skip" });
				badge.textContent = "non-markdown";
			} else if (isNotTask) {
				const badge = itemEl.createSpan({ cls: "tn-bulk-modal__item-badge tn-bulk-modal__item-badge--skip" });
				badge.textContent = "not a task";
			} else {
				const badge = itemEl.createSpan({ cls: "tn-bulk-modal__item-badge tn-bulk-modal__item-badge--task" });
				badge.textContent = "task";
			}
		}

		if (this.items.length > maxItems) {
			this.itemsListContainer.createDiv({
				cls: "tn-bulk-modal__item tn-bulk-modal__item--more",
				text: `... and ${this.items.length - maxItems} more`,
			});
		}
	}

	/**
	 * Update items summary to show skip count.
	 */
	private updateItemsSummaryWithSkips(skipCount: number) {
		if (!this.itemsContainer) return;

		const countSpan = this.itemsContainer.querySelector(".tn-bulk-modal__items-count");
		if (countSpan) {
			countSpan.textContent = `${this.items.length} item${this.items.length !== 1 ? "s" : ""} selected`;
		}

		// Add or update skip count span
		let skipSpan = this.itemsContainer.querySelector(".tn-bulk-modal__items-skip-count") as HTMLElement;
		if (skipCount > 0) {
			if (!skipSpan) {
				skipSpan = this.itemsContainer.createSpan({ cls: "tn-bulk-modal__items-skip-count" });
				// Insert before expand button
				const expandBtn = this.itemsContainer.querySelector(".tn-bulk-modal__expand-btn");
				if (expandBtn) {
					this.itemsContainer.insertBefore(skipSpan, expandBtn);
				}
			}
			skipSpan.textContent = `(${skipCount} will be skipped)`;
		} else if (skipSpan) {
			skipSpan.remove();
		}
	}

	/**
	 * Populate items list with appropriate skip badges for convert mode.
	 */
	private populateItemsListWithBadges(alreadyTaskPaths: Set<string>, nonMarkdownPaths: Set<string>) {
		if (!this.itemsListContainer) return;
		this.itemsListContainer.empty();

		const maxItems = 20;
		const itemsToShow = this.items.slice(0, maxItems);

		for (const item of itemsToShow) {
			const isAlreadyTask = item.path && alreadyTaskPaths.has(item.path);
			const isNonMarkdown = item.path && nonMarkdownPaths.has(item.path);
			const isSkipped = (isAlreadyTask && this.skipAlreadyTasks) || isNonMarkdown;

			const itemEl = this.itemsListContainer.createDiv({
				cls: `tn-bulk-modal__item ${isSkipped ? "tn-bulk-modal__item--skipped" : ""}`,
			});

			const title = this.extractTitle(item);
			itemEl.createSpan({ cls: "tn-bulk-modal__item-title", text: title });

			if (isNonMarkdown) {
				itemEl.createSpan({ cls: "tn-bulk-modal__item-badge", text: "non-markdown" });
			} else if (isAlreadyTask && this.skipAlreadyTasks) {
				itemEl.createSpan({ cls: "tn-bulk-modal__item-badge", text: "already task" });
			}
		}

		if (this.items.length > maxItems) {
			this.itemsListContainer.createDiv({
				cls: "tn-bulk-modal__items-more",
				text: `...and ${this.items.length - maxItems} more`,
			});
		}
	}

	/**
	 * Render inline compatibility badges (Convert mode).
	 */
	private renderCompatibilityBadges(preCheck: ConvertPreCheckResult) {
		if (!this.compatContainer) return;
		this.compatContainer.empty();

		// Section header
		const header = this.compatContainer.createDiv({ cls: "tn-bulk-modal__section-header" });
		header.createSpan({ cls: "tn-bulk-modal__section-label", text: "COMPATIBILITY" });

		// Badges container
		const badgesContainer = this.compatContainer.createDiv({ cls: "tn-bulk-modal__compat" });

		// Ready badge
		const readyBadge = badgesContainer.createSpan({ cls: "tn-bulk-modal__compat-badge tn-bulk-modal__compat-badge--ready" });
		readyBadge.createSpan({ text: `${preCheck.toConvert} ready ✓` });

		// Skip badge (if any)
		const skipCount = (this.skipAlreadyTasks ? preCheck.alreadyTasks : 0) + preCheck.nonMarkdown;
		if (skipCount > 0) {
			const skipBadge = badgesContainer.createSpan({ cls: "tn-bulk-modal__compat-badge tn-bulk-modal__compat-badge--skip" });
			skipBadge.createSpan({ text: `${skipCount} skipped` });
		}

		// Show details button (if non-markdown files exist)
		if (preCheck.nonMarkdown > 0) {
			const detailsBtn = badgesContainer.createEl("button", {
				cls: "tn-bulk-modal__compat-details-btn",
				text: "Show details",
			});

			const detailsContainer = this.compatContainer.createDiv({ cls: "tn-bulk-modal__compat-details" });

			detailsBtn.addEventListener("click", () => {
				const isExpanded = detailsContainer.hasClass("is-expanded");
				detailsContainer.toggleClass("is-expanded", !isExpanded);
				detailsBtn.textContent = isExpanded ? "Show details" : "Hide details";

				if (!isExpanded && detailsContainer.childElementCount === 0) {
					// Populate details
					this.populateFileBreakdown(detailsContainer, preCheck.fileTypeBreakdown);
				}
			});
		}

		// Warning if high skip ratio
		const totalItems = this.items.length;
		const skipRatio = totalItems > 0 ? skipCount / totalItems : 0;

		if (skipRatio > 0.5 && skipCount > 0) {
			const warningEl = this.compatContainer.createDiv({ cls: "tn-bulk-modal__compat-warning" });
			const percent = Math.round(skipRatio * 100);
			warningEl.textContent = `⚠ ${percent}% of selected files will be skipped`;
		}
	}

	/**
	 * Populate the file breakdown section with filenames grouped by extension.
	 */
	private populateFileBreakdown(container: HTMLElement, breakdown: Map<string, string[]>) {
		const MAX_FILES = 5;
		let totalShown = 0;
		const overflow: { ext: string; count: number }[] = [];

		// Flatten all files into a single list for display
		const allFiles: { name: string; ext: string }[] = [];
		for (const [ext, files] of breakdown) {
			for (const name of files) {
				allFiles.push({ name, ext });
			}
		}

		// Show first MAX_FILES
		for (let i = 0; i < Math.min(allFiles.length, MAX_FILES); i++) {
			const file = allFiles[i];
			container.createDiv({
				cls: "tn-bulk-compatibility-file",
				text: `${file.name}.${file.ext}`,
			});
			totalShown++;
		}

		// Calculate overflow
		if (allFiles.length > MAX_FILES) {
			const remaining = allFiles.length - MAX_FILES;
			// Get unique extensions in overflow
			const overflowExts = new Set<string>();
			for (let i = MAX_FILES; i < allFiles.length; i++) {
				overflowExts.add(`.${allFiles[i].ext}`);
			}
			const extList = Array.from(overflowExts).join(", ");
			container.createDiv({
				cls: "tn-bulk-compatibility-overflow",
				text: `...and ${remaining} more (${extList})`,
			});
		}
	}

	/**
	 * Dispatch execution based on current mode.
	 */
	private async executeAction() {
		if (this.mode === "viewSettings") {
			// Save all view settings to .base file (don't close — user closes with X)
			await this.saveViewFieldMapping();
			await this.saveViewDefaults();
			await this.saveViewNotificationConfig();
			// Reset bulk preload guard + state so viewSettings changes propagate
			// to Generate/Convert tabs without requiring modal close/reopen
			this.bulkPreloadedFromView = false;
			this.bulkCustomProperties = {};
			this.bulkFieldOverrides = {};
			await this.preloadBulkFromViewSettings();
			// Brief "Saved!" feedback on the button
			if (this.actionButton) {
				this.actionButton.textContent = "Saved!";
				this.actionButton.disabled = true;
				setTimeout(() => {
					if (this.actionButton) {
						this.actionButton.textContent = "Save";
						this.actionButton.disabled = false;
					}
				}, 1500);
			}
			return;
		}
		if (this.mode === "generate") {
			await this.executeGeneration();
		} else if (this.mode === "bulkEdit") {
			await this.executeBulkEdit();
		} else {
			await this.executeConversion();
		}
	}

	/**
	 * Execute bulk task generation (create new files).
	 */
	private async executeGeneration() {
		if (!this.actionButton || !this.progressBar || !this.statusContainer) return;

		this.actionButton.disabled = true;
		this.actionButton.textContent = "Generating...";
		this.progressBar.addClass("is-visible");

		const options: BulkCreationOptions = {
			skipExisting: this.skipExisting,
			useParentAsProject: this.useParentAsProject,
			assignees: this.selectedAssignees.length > 0 ? this.selectedAssignees : undefined,
			// Unified bulk values
			dueDate: this.dueDate || undefined,
			scheduledDate: this.scheduledDate || undefined,
			status: this.bulkStatus || undefined,
			priority: this.bulkPriority || undefined,
			reminders: this.bulkReminders.length > 0 ? this.bulkReminders : undefined,
			customFrontmatter: Object.keys(this.bulkCustomProperties).length > 0 ? this.getFlatCustomProperties() : undefined,
			// Per-view field mapping and provenance (ADR-011)
			viewFieldMapping: this.modalOptions.viewFieldMapping,
			sourceBaseId: this.modalOptions.sourceBaseId,
			sourceViewId: this.modalOptions.sourceViewId,
			onProgress: (current, total, status) => {
				const percent = Math.round((current / total) * 100);
				if (this.progressBarInner) {
					this.progressBarInner.style.width = `${percent}%`;
				}
				if (this.statusContainer) {
					this.statusContainer.empty();
					this.statusContainer.createSpan({ text: status });
				}
			},
		};

		try {
			const result = await this.engine.createTasks(this.items, options);

			this.statusContainer.empty();

			let resultText = `Created ${result.created} task${result.created !== 1 ? "s" : ""}`;
			if (result.skipped > 0) {
				resultText += `, skipped ${result.skipped}`;
			}
			if (result.failed > 0) {
				resultText += `, ${result.failed} failed`;
			}

			this.statusContainer.createSpan({
				text: resultText,
				cls: result.failed > 0 ? "tn-bulk-modal__status--warning" : "tn-bulk-modal__status--success",
			});

			new Notice(resultText);
			this.modalOptions.onTasksCreated?.(result);
			setTimeout(() => this.close(), 1500);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);

			this.statusContainer.empty();
			this.statusContainer.createSpan({
				text: `Error: ${errorMsg}`,
				cls: "tn-bulk-modal__status--error",
			});

			new Notice(`Bulk task generation failed: ${errorMsg}`);

			this.actionButton.disabled = false;
			this.actionButton.textContent = "Retry";
			this.progressBar.removeClass("is-visible");
		}
	}

	/**
	 * Execute bulk conversion (modify existing notes in-place).
	 */
	private async executeConversion() {
		if (!this.actionButton || !this.progressBar || !this.statusContainer) return;

		this.actionButton.disabled = true;
		this.actionButton.textContent = "Converting...";
		this.progressBar.addClass("is-visible");

		const options: BulkConvertOptions = {
			applyDefaults: this.applyDefaults,
			linkToBase: this.linkToBase && !!this.baseFilePath,
			baseFilePath: this.baseFilePath,
			dueDate: this.dueDate || undefined,
			scheduledDate: this.scheduledDate || undefined,
			status: this.bulkStatus || undefined,
			priority: this.bulkPriority || undefined,
			reminders: this.bulkReminders.length > 0 ? this.bulkReminders : undefined,
			customFrontmatter: Object.keys(this.bulkCustomProperties).length > 0 ? this.getFlatCustomProperties() : undefined,
			// Per-view field mapping and provenance (ADR-011)
			viewFieldMapping: this.modalOptions.viewFieldMapping,
			sourceBaseId: this.modalOptions.sourceBaseId,
			sourceViewId: this.modalOptions.sourceViewId,
			onProgress: (current, total, status) => {
				const percent = Math.round((current / total) * 100);
				if (this.progressBarInner) {
					this.progressBarInner.style.width = `${percent}%`;
				}
				if (this.statusContainer) {
					this.statusContainer.empty();
					this.statusContainer.createSpan({ text: status });
				}
			},
		};

		try {
			const result = await this.convertEngine.convertNotes(this.items, options);

			this.statusContainer.empty();

			let resultText = `Converted ${result.converted} note${result.converted !== 1 ? "s" : ""}`;
			if (result.skipped > 0) {
				resultText += `, skipped ${result.skipped}`;
			}
			if (result.failed > 0) {
				resultText += `, ${result.failed} failed`;
			}

			this.statusContainer.createSpan({
				text: resultText,
				cls: result.failed > 0 ? "tn-bulk-modal__status--warning" : "tn-bulk-modal__status--success",
			});

			new Notice(resultText);
			this.modalOptions.onTasksCreated?.(result);
			setTimeout(() => this.close(), 1500);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);

			this.statusContainer.empty();
			this.statusContainer.createSpan({
				text: `Error: ${errorMsg}`,
				cls: "tn-bulk-modal__status--error",
			});

			new Notice(`Bulk conversion failed: ${errorMsg}`);

			this.actionButton.disabled = false;
			this.actionButton.textContent = "Retry";
			this.progressBar.removeClass("is-visible");
		}
	}

	/**
	 * Execute bulk edit on existing task files.
	 */
	private async executeBulkEdit() {
		if (!this.actionButton || !this.progressBar || !this.statusContainer) return;

		// Show confirmation dialog unless suppressed
		if (!this.plugin.settings.suppressBulkEditConfirmation) {
			const confirmed = await this.showBulkEditConfirmation();
			if (!confirmed) return;
		}

		this.actionButton.disabled = true;
		this.actionButton.textContent = "Editing...";
		this.progressBar.addClass("is-visible");

		const options: BulkEditOptions = {
			status: this.bulkStatus || undefined,
			priority: this.bulkPriority || undefined,
			dueDate: this.dueDate || undefined,
			scheduledDate: this.scheduledDate || undefined,
			assignees: this.selectedAssignees.length > 0 ? this.selectedAssignees.map(p => {
				const file = this.app.vault.getAbstractFileByPath(p);
				if (file instanceof TFile) {
					const linktext = this.app.metadataCache.fileToLinktext(file, "", true);
					return `[[${linktext}]]`;
				}
				return `[[${p.replace(/\.md$/, "")}]]`;
			}) : undefined,
			reminders: this.bulkReminders.length > 0 ? this.bulkReminders : undefined,
			customFrontmatter: Object.keys(this.bulkCustomProperties).length > 0 ? this.getFlatCustomProperties() : undefined,
			viewFieldMapping: this.modalOptions.viewFieldMapping,
			sourceBaseId: this.modalOptions.sourceBaseId,
			sourceViewId: this.modalOptions.sourceViewId,
			onProgress: (current, total, status) => {
				const percent = Math.round((current / total) * 100);
				if (this.progressBarInner) {
					this.progressBarInner.style.width = `${percent}%`;
				}
				if (this.statusContainer) {
					this.statusContainer.empty();
					this.statusContainer.createSpan({ text: status });
				}
			},
		};

		try {
			const result = await this.editEngine.editTasks(this.items, options);

			this.statusContainer.empty();

			let resultText = `Edited ${result.edited} task${result.edited !== 1 ? "s" : ""}`;
			if (result.skipped > 0) {
				resultText += `, skipped ${result.skipped}`;
			}
			if (result.failed > 0) {
				resultText += `, ${result.failed} failed`;
			}

			this.statusContainer.createSpan({
				text: resultText,
				cls: result.failed > 0 ? "tn-bulk-modal__status--warning" : "tn-bulk-modal__status--success",
			});

			new Notice(resultText);
			this.modalOptions.onTasksCreated?.(result);
			setTimeout(() => this.close(), 1500);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);

			this.statusContainer.empty();
			this.statusContainer.createSpan({
				text: `Error: ${errorMsg}`,
				cls: "tn-bulk-modal__status--error",
			});

			new Notice(`Bulk edit failed: ${errorMsg}`);

			this.actionButton.disabled = false;
			this.actionButton.textContent = "Retry";
			this.progressBar.removeClass("is-visible");
		}
	}

	/**
	 * Show confirmation dialog before bulk edit. Returns true if user confirms.
	 */
	private showBulkEditConfirmation(): Promise<boolean> {
		return new Promise((resolve) => {
			const confirmModal = new Modal(this.app);
			confirmModal.titleEl.setText("Confirm bulk edit");
			confirmModal.contentEl.createEl("p", {
				text: "This will modify frontmatter properties on multiple task files. Only the fields you've explicitly set will be changed.",
			});

			let dontShowAgain = false;
			new Setting(confirmModal.contentEl)
				.setName("Don't show this again")
				.addToggle((toggle) => toggle.onChange((v) => { dontShowAgain = v; }));

			const btnRow = new Setting(confirmModal.contentEl);
			btnRow.addButton((b) =>
				b.setButtonText("Cancel").onClick(() => {
					confirmModal.close();
					resolve(false);
				})
			);
			btnRow.addButton((b) =>
				b.setButtonText("Edit tasks").setCta().onClick(async () => {
					if (dontShowAgain) {
						this.plugin.settings.suppressBulkEditConfirmation = true;
						await this.plugin.saveSettings();
					}
					confirmModal.close();
					resolve(true);
				})
			);

			confirmModal.open();
		});
	}

	/**
	 * Extract a title from a Bases data item.
	 */
	private extractTitle(item: BasesDataItem): string {
		const props = item.properties || {};

		if (props.title && typeof props.title === "string") {
			return props.title;
		}

		if (item.file?.basename) {
			return item.file.basename;
		}

		if (item.name) {
			return item.name;
		}

		if (item.path) {
			const basename = item.path.split("/").pop() || item.path;
			return basename.replace(/\.md$/i, "");
		}

		return "Untitled";
	}
}
