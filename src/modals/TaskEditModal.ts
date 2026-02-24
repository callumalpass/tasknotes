/* eslint-disable no-console, @typescript-eslint/no-non-null-assertion */
import { App, Notice, TFile, TAbstractFile, Setting, setIcon, setTooltip } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskModal } from "./TaskModal";
import { TaskDependency, TaskInfo } from "../types";
import {
	getCurrentTimestamp,
	formatDateForStorage,
	generateUTCCalendarDates,
	getUTCStartOfWeek,
	getUTCEndOfWeek,
	getUTCStartOfMonth,
	getUTCEndOfMonth,
	getTodayLocal,
	parseDateAsLocal,
	getDatePart,
	getTimePart,
	combineDateAndTime,
} from "../utils/dateUtils";
import { formatTimestampForDisplay } from "../utils/dateUtils";
import { DateContextMenu } from "../components/DateContextMenu";
import {
	generateRecurringInstances,
	extractTaskInfo,
	calculateTotalTimeSpent,
	formatTime,
	updateToNextScheduledOccurrence,
	sanitizeTags,
} from "../utils/helpers";
import { splitListPreservingLinksAndQuotes } from "../utils/stringSplit";
import { ReminderContextMenu } from "../components/ReminderContextMenu";
import { generateLinkWithDisplay, parseLinkToPath } from "../utils/linkUtils";
import { EmbeddableMarkdownEditor } from "../editor/EmbeddableMarkdownEditor";
import { ConfirmationModal } from "./ConfirmationModal";
import {
	type DiscoveredProperty,
	type PropertyType,
	normalizeDateValue,
	keyToDisplayName,
} from "../utils/propertyDiscoveryUtils";
import { createPropertyPicker } from "../ui/PropertyPicker";
import {
	FIELD_OVERRIDE_PROPS,
	OVERRIDABLE_FIELD_LABELS,
	OVERRIDABLE_FIELD_TYPES,
	readFieldOverrides,
	type OverridableField,
} from "../utils/fieldOverrideUtils";

export interface TaskEditOptions {
	task: TaskInfo;
	onTaskUpdated?: (task: TaskInfo) => void;
}

export class TaskEditModal extends TaskModal {
	private task: TaskInfo;
	private options: TaskEditOptions;
	private metadataContainer: HTMLElement;
	private editModalKeyboardHandler: ((e: KeyboardEvent) => void) | null = null;
	private discoveredProperties: DiscoveredProperty[] = [];
	private propertyPickerInstance: { refresh: () => void; destroy: () => void } | null = null;
	private propertyPickerExcludeKeys: Set<string> | null = null;
	/** Per-task field overrides: maps internal field key (e.g., "due") to custom property name (e.g., "deadline") */
	private fieldOverrides: Record<string, string> = {};
	// Changed from Set to array for consistency with other state management
	private completedInstancesChanges: string[] = [];
	private calendarWrapper: HTMLElement | null = null;
	private initialBlockedBy: TaskDependency[] = [];
	private initialBlockingPaths: string[] = [];
	private pendingBlockingUpdates: {
		added: string[];
		removed: string[];
		raw: Record<string, TaskDependency>;
	} = { added: [], removed: [], raw: {} };
	private unresolvedBlockingEntries: string[] = [];
	private initialTags = "";
	private isShowingConfirmation = false;
	private pendingClose = false;

	constructor(app: App, plugin: TaskNotesPlugin, options: TaskEditOptions) {
		super(app, plugin);
		this.task = options.task;
		this.options = options;
	}

	protected getCurrentTaskPath(): string | undefined {
		return this.task.path;
	}

	protected override getTaskPath(): string {
		return this.task.path || "";
	}

	getModalTitle(): string {
		return this.t("modals.taskEdit.title");
	}

	protected isEditMode(): boolean {
		return true;
	}

	async initializeFormData(): Promise<void> {
		// Initialize form fields with current task data
		this.title = this.task.title;
		this.dueDate = this.task.due || "";
		this.scheduledDate = this.task.scheduled || "";
		this.priority = this.task.priority;
		this.status = this.task.status;
		this.contexts = this.task.contexts ? this.task.contexts.join(", ") : "";

		// Initialize projects using the new method that handles both old and new formats
		if (this.task.projects && this.task.projects.length > 0) {
			// Filter out null, undefined, or empty strings before checking if we have valid projects
			const validProjects = this.task.projects.filter(
				(p) => p && typeof p === "string" && p.trim() !== ""
			);
			if (validProjects.length > 0) {
				this.initializeProjectsFromStrings(this.task.projects);
			} else {
				this.projects = "";
				this.selectedProjectItems = [];
			}
		} else {
			this.projects = "";
			this.selectedProjectItems = [];
		}

		const shouldFilterTaskTag =
			this.plugin.settings.taskIdentificationMethod === "tag";
		const rawTags = this.task.tags || [];
		const visibleTags = shouldFilterTaskTag
			? rawTags.filter((tag) => tag !== this.plugin.settings.taskTag)
			: rawTags;
		this.tags = rawTags.length > 0 ? sanitizeTags(visibleTags.join(", ")) : "";
		this.initialTags = this.tags;
		this.timeEstimate = this.task.timeEstimate || 0;

		// Handle recurrence
		this.recurrenceRule = this.task.recurrence || "";

		// Initialize recurrence anchor
		this.recurrenceAnchor = this.task.recurrence_anchor || 'scheduled';

		// Initialize reminders
		this.reminders = this.task.reminders ? [...this.task.reminders] : [];

		this.details = this.normalizeDetails(this.details);
		this.originalDetails = this.details;

		// Initialize subtasks (tasks that have this task as a project)
		await this.initializeSubtasks();

		this.blockedByItems = (this.task.blockedBy ?? []).map((dependency) =>
			this.createDependencyItemFromDependency(dependency, this.task.path)
		);
		this.initialBlockedBy = this.blockedByItems.map((item) => ({ ...item.dependency }));

		this.blockingItems = (this.task.blocking ?? []).map((path) =>
			this.createDependencyItemFromPath(path)
		);
		this.initialBlockingPaths = this.blockingItems
			.filter((item) => item.path)
			.map((item) => item.path!);
		this.pendingBlockingUpdates = { added: [], removed: [], raw: {} };
		this.unresolvedBlockingEntries = [];

		// Initialize user fields from frontmatter
		await this.initializeUserFields();
	}

	private async initializeUserFields(): Promise<void> {
		try {
			// Get the file and read its frontmatter
			const file = this.app.vault.getAbstractFileByPath(this.task.path);
			if (!file || !(file instanceof TFile)) {
				return;
			}

			const metadata = this.app.metadataCache.getFileCache(file);
			const frontmatter = metadata?.frontmatter;

			if (!frontmatter) {
				return;
			}

			// Load user field values from frontmatter
			const userFieldConfigs = this.plugin.settings?.userFields || [];
			for (const field of userFieldConfigs) {
				if (!field || !field.key) continue;

				const value = frontmatter[field.key];
				if (value !== undefined) {
					this.userFields[field.key] = value;
				}
			}

			// Pre-load core assignee/creator fields from frontmatter so that
			// fallback PersonGroupPickers (renderFallbackPersonPickers) find
			// existing values even when these keys aren't registered as user fields.
			const corePersonKeys = [
				this.plugin.settings.assigneeFieldName || "assignee",
				this.plugin.settings.creatorFieldName || "creator",
			];
			for (const key of corePersonKeys) {
				if (key && this.userFields[key] === undefined && frontmatter[key] !== undefined) {
					this.userFields[key] = frontmatter[key];
				}
			}

			// Properties & Anchors section starts empty — user adds via search.
			// Undiscovered frontmatter properties are preserved as-is on save
			// (the save pipeline only writes diffs).

			// Initialize per-task field overrides from existing tracking properties
			this.fieldOverrides = readFieldOverrides(frontmatter);
		} catch (error) {
			console.error("Error initializing user fields:", error);
		}
	}

	private dependenciesEqual(a: TaskDependency[], b: TaskDependency[]): boolean {
		if (a.length !== b.length) {
			return false;
		}

		const sortDependencies = (deps: TaskDependency[]) =>
			[...deps].sort((left, right) => left.uid.localeCompare(right.uid));

		const sortedA = sortDependencies(a);
		const sortedB = sortDependencies(b);

		for (let i = 0; i < sortedA.length; i++) {
			const depA = sortedA[i];
			const depB = sortedB[i];
			if (
				depA.uid !== depB.uid ||
				depA.reltype !== depB.reltype ||
				(depA.gap || "") !== (depB.gap || "")
			) {
				return false;
			}
		}

		return true;
	}

	protected showReminderContextMenu(event: MouseEvent): void {
		// Override parent method to use the actual task with its path
		// Update the task object with current form values before showing menu
		const currentTask: TaskInfo = {
			...this.task,
			title: this.title,
			due: this.dueDate,
			scheduled: this.scheduledDate,
			reminders: this.reminders,
		};

		const menu = new ReminderContextMenu(
			this.plugin,
			currentTask, // Use task with current form values and correct path
			event.target as HTMLElement,
			(updatedTask: TaskInfo) => {
				this.reminders = updatedTask.reminders || [];
				this.updateReminderIconState();
			}
		);

		menu.show(event);
	}

	async onOpen() {
		// Clear any previous completion changes
		this.completedInstancesChanges = [];

		// Refresh task data from file before opening
		await this.refreshTaskData();

		this.containerEl.addClass("tasknotes-plugin", "minimalist-task-modal", "expanded");
		if (this.plugin.settings.enableModalSplitLayout) {
			this.containerEl.addClass("split-layout-enabled");
		}
		this.modalEl.addClass("mod-tasknotes");

		// Set the modal title using the standard Obsidian approach (preserves close button)
		this.titleEl.setText(this.getModalTitle());

		// Add global keyboard shortcut handler for CMD/Ctrl+Enter
		this.editModalKeyboardHandler = async (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				await this.handleSave();
				this.forceClose();
			}
		};
		this.containerEl.addEventListener("keydown", this.editModalKeyboardHandler);

		this.initializeFormData().then(() => {
			this.createModalContent();
			// Render projects list after modal content is created
			this.renderProjectsList();
			// Update icon states after creating the action bar
			this.updateIconStates();
			this.focusTitleInput();
		});
	}

	private async refreshTaskData(): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(this.task.path);
			if (!file || !(file instanceof TFile)) {
				this.plugin.debugLog.warn('TaskEditModal', 'Could not find file for task:', this.task.path);
				return;
			}

			const content = await this.app.vault.read(file);
			this.details = this.extractDetailsFromContent(content);
			this.originalDetails = this.details;

			// Check if this file is actually a task (has task tag/property)
			// If not, keep the original task data (e.g., for "convert note to task" flow)
			const metadata = this.app.metadataCache.getFileCache(file);
			const isRecognizedTask = metadata?.frontmatter &&
				this.plugin.cacheManager.isTaskFile(metadata.frontmatter);

			if (!isRecognizedTask) {
				// File is not yet a task - keep the original task data passed to constructor
				// This preserves user's default settings for status/priority during conversion
				this.task.details = this.details;
				return;
			}

			const cachedTaskInfo = await this.plugin.cacheManager.getTaskInfo(this.task.path);

			if (cachedTaskInfo) {
				cachedTaskInfo.details = this.details;
				this.task = cachedTaskInfo;
				this.options.task = cachedTaskInfo;
			} else {
				const freshTaskInfo = extractTaskInfo(
					this.app,
					content,
					this.task.path,
					file,
					this.plugin.fieldMapper,
					this.plugin.settings.storeTitleInFilename,
					this.plugin.settings.defaultTaskStatus
				);

				if (freshTaskInfo) {
					freshTaskInfo.details = this.details;
					this.task = freshTaskInfo;
					this.options.task = freshTaskInfo;
				}
			}
		} catch (error) {
			this.plugin.debugLog.warn('TaskEditModal', 'Could not refresh task data:', error);
		}
	}

	/**
	 * Edit modal has no primary input at top - title is in the details section
	 */
	protected createPrimaryInput(container: HTMLElement): void {
		// No-op: Edit modal shows title in the details section, not at top
	}

	/**
	 * Add completions calendar, discovered properties, and metadata sections after details.
	 * Properties section is placed inside detailsContainer (where field groups live)
	 * so it appears before the "Blocked By" / dependencies group.
	 */
	protected createAdditionalSections(container: HTMLElement): void {
		// Create properties section in detailsContainer where field groups live,
		// NOT in splitLeftColumn (container), so it's positioned correctly.
		const fieldsTarget = this.detailsContainer || container;

		// Find the dependencies group to insert before it
		const groups = Array.from(fieldsTarget.querySelectorAll(":scope > .task-modal__field-group"));
		let depsGroup: Element | null = null;
		if (this.blockedByList) {
			depsGroup = groups.find(g => g.contains(this.blockedByList!)) || null;
		}
		if (!depsGroup && groups.length >= 3) {
			depsGroup = groups[2]; // Fallback: 3rd group is typically dependencies
		}

		this.createDiscoveredPropertiesSection(fieldsTarget, depsGroup as HTMLElement | null);
		this.createCompletionsCalendarSection(container);
		this.createMetadataSection(container);
	}

	/**
	 * Force close the modal without checking for unsaved changes.
	 * Use this after a successful save or when discarding is intentional.
	 */
	forceClose(): void {
		this.pendingClose = true;
		super.close();
	}

	/**
	 * Override close() to detect unsaved changes and prompt user.
	 * This method is synchronous to match Obsidian's Modal.close() signature.
	 */
	close(): void {
		// If we're already forcing close or showing confirmation, proceed
		if (this.pendingClose) {
			this.pendingClose = false;
			super.close();
			return;
		}

		// Prevent re-entrancy if confirmation is already showing
		if (this.isShowingConfirmation) {
			return;
		}

		// Check for unsaved changes
		const changes = this.getChanges();
		const hasChanges = Object.keys(changes).length > 0;

		if (!hasChanges) {
			// No changes, close immediately
			super.close();
			return;
		}

		// Show confirmation modal asynchronously
		this.showUnsavedChangesConfirmation();
	}

	/**
	 * Show confirmation modal for unsaved changes.
	 * Handles the async flow separately from the synchronous close() method.
	 */
	private async showUnsavedChangesConfirmation(): Promise<void> {
		this.isShowingConfirmation = true;

		try {
			const result = await this.showThreeButtonConfirmation();

			if (result === "save") {
				// User wants to save - attempt save and close on success
				try {
					await this.handleSave();
					this.forceClose();
				} catch (error) {
					// Save failed - stay open so user can fix issues
					// handleSave() already shows a notice with the error
					console.error("Save failed during close confirmation:", error);
				}
			} else if (result === "discard") {
				// User wants to discard changes
				this.forceClose();
			}
			// result === "cancel" - do nothing, user wants to keep editing
		} finally {
			this.isShowingConfirmation = false;
		}
	}

	/**
	 * Show a three-button confirmation dialog for unsaved changes.
	 * Returns: "save" | "discard" | "cancel"
	 */
	private showThreeButtonConfirmation(): Promise<"save" | "discard" | "cancel"> {
		return new Promise((resolve) => {
			const modal = new ConfirmationModal(this.app, {
				title: this.t("modals.task.unsavedChanges.title"),
				message: this.t("modals.task.unsavedChanges.message"),
				confirmText: this.t("modals.task.unsavedChanges.save"),
				cancelText: this.t("modals.task.unsavedChanges.discard"),
				thirdButtonText: this.t("modals.task.unsavedChanges.cancel"),
				defaultToConfirm: true,
				onThirdButton: () => resolve("cancel"),
			});

			modal.show().then((confirmed) => {
				if (confirmed) {
					resolve("save");
				} else {
					resolve("discard");
				}
			});
		});
	}

	onClose(): void {
		// Clean up keyboard handler
		if (this.editModalKeyboardHandler) {
			this.containerEl.removeEventListener("keydown", this.editModalKeyboardHandler);
			this.editModalKeyboardHandler = null;
		}

		// Clean up property picker
		if (this.propertyPickerInstance) {
			this.propertyPickerInstance.destroy();
			this.propertyPickerInstance = null;
		}

		// Base class handles detailsMarkdownEditor cleanup
		super.onClose();
	}

	private createCompletionsCalendarSection(container: HTMLElement): void {
		// Only show calendar for recurring tasks
		if (this.task.recurrence) {
			const calendarContainer = container.createDiv("completions-calendar-container");

			const calendarLabel = calendarContainer.createDiv("detail-label");
			calendarLabel.createSpan().textContent = this.t("modals.taskEdit.sections.completions");

			const compHelp = calendarLabel.createSpan({ cls: "task-edit-modal__help" });
			setIcon(compHelp, "help-circle");
			setTooltip(compHelp, "Recurring task completion history. Green dots mark completed instances.");

			const calendarContent = calendarContainer.createDiv("completions-calendar-content");
			this.createRecurringCalendar(calendarContent);
		}
	}

	private createDiscoveredPropertiesSection(container: HTMLElement, insertBefore?: HTMLElement | null): void {
		// Build the set of configured userField keys to exclude from discovery
		const userFieldConfigs = this.plugin.settings?.userFields || [];
		const configuredKeys = new Set(
			userFieldConfigs.filter((f: any) => f?.key).map((f: any) => f.key)
		);

		const hasDiscovered = this.discoveredProperties.length > 0;

		// Create element manually so we can control insertion point
		const sectionContainer = document.createElement("div");
		sectionContainer.className = "discovered-properties-container user-fields-separator";
		if (insertBefore) {
			container.insertBefore(sectionContainer, insertBefore);
		} else {
			container.appendChild(sectionContainer);
		}

		// Section label matching the bulk modal's "CUSTOM PROPERTIES" heading
		const propLabelRow = sectionContainer.createDiv({ cls: "detail-label-section" });
		propLabelRow.createSpan({ text: "Properties & anchors" });

		const propHelp = propLabelRow.createSpan({ cls: "task-edit-modal__help" });
		setIcon(propHelp, "help-circle");
		setTooltip(propHelp, "Add extra frontmatter to this task, or use \u2018Map to\u2019 to assign custom properties to standard task fields (e.g., Due date, Assignee). Search existing properties or create new ones. Use scope chips to filter by source.");

		// PropertyPicker for adding more (above the fields list, matching bulk modal layout)
		const pickerContainer = sectionContainer.createDiv("discovered-properties-picker");

		// Editable fields for discovered properties (below the picker)
		const fieldsContainer = sectionContainer.createDiv("discovered-properties-fields");

		if (hasDiscovered) {
			this.renderDiscoveredPropertyFields(fieldsContainer, configuredKeys);
		}
		this.propertyPickerExcludeKeys = new Set([...configuredKeys, ...this.discoveredProperties.map(p => p.key)]);
		this.propertyPickerInstance = createPropertyPicker({
			container: pickerContainer,
			plugin: this.plugin,
			currentFilePath: this.task.path,
			excludeKeys: this.propertyPickerExcludeKeys,
			useAsOptions: Object.entries(OVERRIDABLE_FIELD_LABELS).map(([key, label]) => ({
				key,
				label,
				requiresType: (OVERRIDABLE_FIELD_TYPES[key as OverridableField] || "text") as PropertyType,
			})),
			claimedMappings: this.fieldOverrides || {},
			onSelect: (key: string, type: PropertyType, value?: any, useAs?: string) => {
				// Set field override mapping if a "Use as" target was chosen
				if (useAs && this.fieldOverrides) {
					// Clear any old mapping pointing to this property
					for (const [fk, pk] of Object.entries(this.fieldOverrides)) {
						if (pk === key) delete this.fieldOverrides[fk];
					}
					this.fieldOverrides[useAs] = key;
				}

				// Set default value based on type
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

				// Add to userFields for save pipeline
				this.userFields[key] = defaultValue;

				// Add to discoveredProperties for tracking
				this.discoveredProperties.push({
					key,
					displayName: key
						.replace(/_/g, " ")
						.replace(/([a-z])([A-Z])/g, "$1 $2")
						.replace(/^./, (c) => c.toUpperCase()),
					type,
					value: defaultValue,
				});

				// Update picker exclusions and re-render
				this.propertyPickerExcludeKeys?.add(key);
				this.propertyPickerInstance?.refresh();
				fieldsContainer.empty();
				this.renderDiscoveredPropertyFields(fieldsContainer, configuredKeys);
			},
		});

	}

	private renderDiscoveredPropertyFields(
		container: HTMLElement,
		configuredKeys: Set<string>
	): void {
		for (const prop of this.discoveredProperties) {
			if (configuredKeys.has(prop.key)) continue;

			// Build the expandable row wrapper
			const row = container.createDiv({ cls: "tn-prop-row" });

			// Check if this property currently maps to a core field
			const currentMapping = this.findMappingForProperty(prop.key);
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

			// Property key label
			header.createDiv({ cls: "tn-prop-row__key", text: prop.displayName });

			// Type badge
			header.createDiv({ cls: "tn-prop-row__type-badge", text: prop.type });

			// Value area — mapped fields get click-to-edit, unmapped get basic inputs
			const valueContainer = header.createDiv({ cls: "tn-prop-row__value" });
			if (currentMapping) {
				this.createMappedValueDisplay(valueContainer, prop, currentMapping as OverridableField);
			} else {
				this.createPropertyValueInput(valueContainer, prop);
			}

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
			removeBtn.title = "Hide from this view (does not delete from file)";
			removeBtn.addEventListener("click", () => {
				// Clear any mapping this property had
				this.clearMappingForProperty(prop.key);
				// Remove from discovered list — does NOT delete from file
				delete this.userFields[prop.key];
				const idx = this.discoveredProperties.findIndex(p => p.key === prop.key);
				if (idx >= 0) this.discoveredProperties.splice(idx, 1);
				// Update picker exclusions so property reappears in search
				this.propertyPickerExcludeKeys?.delete(prop.key);
				this.propertyPickerInstance?.refresh();
				container.empty();
				this.renderDiscoveredPropertyFields(container, configuredKeys);
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

				// "None" option
				const noneOpt = select.createEl("option", { value: "", text: "None (custom only)" });
				if (!currentMapping) noneOpt.selected = true;

				// One option per overridable field
				for (const [fieldKey, label] of Object.entries(OVERRIDABLE_FIELD_LABELS)) {
					const opt = select.createEl("option", { value: fieldKey, text: label });
					if (currentMapping === fieldKey) opt.selected = true;

					// Disable if another property already maps to this field
					const existingProp = this.findPropertyForMapping(fieldKey);
					if (existingProp && existingProp !== prop.key) {
						opt.disabled = true;
						opt.text = `${label} (used by ${existingProp})`;
					}
				}

				select.addEventListener("change", () => {
					const newField = select.value;

					// Clear old mapping for this property
					this.clearMappingForProperty(prop.key);

					// Set new mapping
					if (newField) {
						this.fieldOverrides[newField] = prop.key;
					}

					// Re-render to update badges and dropdown states
					container.empty();
					this.renderDiscoveredPropertyFields(container, configuredKeys);
				});

				// ── Type mismatch note ────────────────────────
				const expectedType = currentMapping ? (OVERRIDABLE_FIELD_TYPES[currentMapping as OverridableField] || "text") : null;
				if (currentMapping && expectedType && prop.type !== expectedType) {
					const mismatch = panel.createDiv({ cls: "tn-prop-row__type-mismatch" });
					mismatch.createSpan({ cls: "tn-prop-row__type-mismatch-icon", text: "\u26A0" });
					mismatch.createSpan({
						cls: "tn-prop-row__type-mismatch-text",
						text: `Property type is '${prop.type}', but '${OVERRIDABLE_FIELD_LABELS[currentMapping as OverridableField]}' expects '${expectedType}'.`,
					});
					const convertAction = mismatch.createEl("a", {
						cls: "tn-prop-row__type-mismatch-action",
						text: `Convert to ${expectedType}`,
					});
					convertAction.addEventListener("click", (e) => {
						e.preventDefault();
						prop.type = expectedType as PropertyType;
						container.empty();
						this.renderDiscoveredPropertyFields(container, configuredKeys);
					});
				}

				// ── Conflict warning ────────────────────────
				if (currentMapping) {
					const globalPropName = this.plugin.fieldMapper.toUserField(
						currentMapping as any
					);
					// Check if the default property also exists in frontmatter
					const file = this.app.vault.getAbstractFileByPath(this.task.path);
					if (file instanceof TFile) {
						const cache = this.app.metadataCache.getFileCache(file);
						const fm = cache?.frontmatter;
						if (
							fm &&
							globalPropName !== prop.key &&
							fm[globalPropName] !== undefined
						) {
							const conflict = panel.createDiv({
								cls: "tn-prop-row__conflict",
							});
							conflict.createSpan({
								cls: "tn-prop-row__conflict-icon",
								text: "\u26A0",
							});
							conflict.createSpan({
								cls: "tn-prop-row__conflict-text",
								text: `Both '${prop.key}' and '${globalPropName}' exist. Using '${prop.key}' (custom).`,
							});
							const removeAction = conflict.createEl("a", {
								cls: "tn-prop-row__conflict-action",
								text: `Remove '${globalPropName}'`,
							});
							removeAction.addEventListener("click", (e) => {
								e.preventDefault();
								// Mark the default property for deletion on save
								this.userFields[globalPropName] = null;
								// Re-render to remove the conflict warning
								container.empty();
								this.renderDiscoveredPropertyFields(
									container,
									configuredKeys
								);
							});
						}
					}
				}
			}
		}
	}

	/**
	 * Create a type-appropriate value input inside a container element.
	 */
	private createPropertyValueInput(container: HTMLElement, prop: DiscoveredProperty): void {
		switch (prop.type) {
			case "date": {
				const input = container.createEl("input", { type: "date" });
				input.value = this.userFields[prop.key] || "";
				input.addEventListener("change", () => {
					this.userFields[prop.key] = input.value;
				});
				break;
			}
			case "number": {
				const input = container.createEl("input", { type: "number" });
				input.value = this.userFields[prop.key]?.toString() || "";
				input.addEventListener("change", () => {
					const numValue = parseFloat(input.value);
					this.userFields[prop.key] = isNaN(numValue) ? null : numValue;
				});
				break;
			}
			case "boolean": {
				const input = container.createEl("input", { type: "checkbox" });
				input.checked = this.userFields[prop.key] === true;
				input.addEventListener("change", () => {
					this.userFields[prop.key] = input.checked;
				});
				break;
			}
			case "list": {
				const input = container.createEl("input", { type: "text" });
				const currentValue = this.userFields[prop.key];
				input.value = Array.isArray(currentValue) ? currentValue.join(", ") : currentValue || "";
				input.placeholder = "Comma-separated values";
				input.addEventListener("change", () => {
					this.userFields[prop.key] = input.value
						.split(",")
						.map((v) => v.trim())
						.filter((v) => v.length > 0);
				});
				break;
			}
			default: {
				const input = container.createEl("input", { type: "text" });
				input.value = this.userFields[prop.key]?.toString() || "";
				input.addEventListener("change", () => {
					this.userFields[prop.key] = input.value;
				});
				break;
			}
		}
	}

	/**
	 * Create a read-only clickable value display for a mapped property.
	 * Clicking opens the appropriate rich editor (DateContextMenu for dates,
	 * scrolls to PersonGroupPicker for assignee).
	 */
	private createMappedValueDisplay(
		container: HTMLElement,
		prop: DiscoveredProperty,
		mappedField: OverridableField
	): void {
		const isDateField = ["due", "scheduled", "completedDate", "dateCreated"].includes(mappedField);
		const isAssigneeField = mappedField === "assignee";

		const currentValue = this.userFields[prop.key];
		const hasValue = currentValue !== null && currentValue !== undefined && currentValue !== "";

		const display = container.createDiv({ cls: "tn-prop-row__value-display" });
		display.style.cssText = "cursor: pointer; display: flex; align-items: center; gap: 4px;";

		if (isDateField) {
			const valueText = hasValue ? String(currentValue) : "Click to set...";
			const span = display.createSpan({
				text: valueText,
				cls: hasValue ? "tn-prop-row__value-set" : "tn-prop-row__value-placeholder",
			});
			if (!hasValue) span.style.color = "var(--text-faint)";

			display.addEventListener("click", (event) => {
				this.showMappedDatePicker(event, prop.key, mappedField);
			});
		} else if (isAssigneeField) {
			const displayValue = hasValue
				? (Array.isArray(currentValue) ? currentValue.join(", ") : String(currentValue))
				: "Click to set...";
			const span = display.createSpan({
				text: displayValue,
				cls: hasValue ? "tn-prop-row__value-set" : "tn-prop-row__value-placeholder",
			});
			if (!hasValue) span.style.color = "var(--text-faint)";

			display.addEventListener("click", () => {
				this.scrollToAssigneePickerFromProp();
			});
		} else {
			// Fallback for other mapped types: regular input
			this.createPropertyValueInput(container, prop);
		}
	}

	/**
	 * Open DateContextMenu for a mapped date property.
	 * Syncs value to both userFields[propName] AND the corresponding standard field.
	 */
	private showMappedDatePicker(
		event: UIEvent,
		propName: string,
		mappedField: OverridableField
	): void {
		const currentValue = this.userFields[propName] || "";
		const menu = new DateContextMenu({
			currentValue: currentValue ? getDatePart(currentValue) : undefined,
			currentTime: currentValue ? getTimePart(currentValue) : undefined,
			title: `Set ${propName}`,
			plugin: this.plugin,
			app: this.app,
			onSelect: (value: string | null, time: string | null) => {
				const finalValue = value
					? (time ? combineDateAndTime(value, time) : value)
					: "";
				// Store in userFields for the mapped property
				this.userFields[propName] = finalValue;
				// Sync to standard field so action bar icon state updates
				if (mappedField === "due") this.dueDate = finalValue;
				else if (mappedField === "scheduled") this.scheduledDate = finalValue;
				this.updateDateIconState();
				// Re-render to show updated value
				this.reRenderDiscoveredFields();
			},
		});
		menu.show(event);
	}

	/**
	 * Scroll to and highlight the assignee PersonGroupPicker.
	 * Expands the details section if collapsed.
	 */
	private scrollToAssigneePickerFromProp(): void {
		if (!this.isExpanded) {
			this.expandModal();
		}

		setTimeout(() => {
			const assigneeFieldName = this.plugin.settings.assigneeFieldName || "assignee";
			const pickerEl = this.containerEl.querySelector(
				`.tn-task-modal-assignee[data-field-key="${assigneeFieldName}"]`
			) as HTMLElement ?? this.containerEl.querySelector(".tn-task-modal-assignee") as HTMLElement;
			if (pickerEl) {
				pickerEl.scrollIntoView({ behavior: "smooth", block: "center" });
				pickerEl.style.outline = "2px solid var(--interactive-accent)";
				pickerEl.style.outlineOffset = "4px";
				pickerEl.style.borderRadius = "4px";
				setTimeout(() => {
					pickerEl.style.outline = "";
					pickerEl.style.outlineOffset = "";
					pickerEl.style.borderRadius = "";
				}, 1500);
				const searchInput = pickerEl.querySelector("input") as HTMLInputElement;
				if (searchInput) searchInput.focus();
			}
		}, 150);
	}

	/** Re-render discovered property rows to reflect updated values. */
	private reRenderDiscoveredFields(): void {
		const fieldsContainer = this.containerEl.querySelector(".discovered-properties-fields") as HTMLElement;
		if (fieldsContainer) {
			const configuredKeys = new Set(
				(this.plugin.settings?.userFields || [])
					.filter((f: any) => f?.key)
					.map((f: any) => f.key)
			);
			fieldsContainer.empty();
			this.renderDiscoveredPropertyFields(fieldsContainer, configuredKeys);
		}
	}

	/**
	 * Find which core field (if any) a custom property is mapped to.
	 * Returns the OverridableField key or null.
	 */
	private findMappingForProperty(propertyKey: string): OverridableField | null {
		for (const [fieldKey, propName] of Object.entries(this.fieldOverrides)) {
			if (propName === propertyKey) {
				return fieldKey as OverridableField;
			}
		}
		return null;
	}

	/**
	 * Find which custom property (if any) is mapped to a given core field.
	 * Returns the property key or null.
	 */
	private findPropertyForMapping(fieldKey: string): string | null {
		return this.fieldOverrides[fieldKey] || null;
	}

	/**
	 * Clear any mapping that points to a given property key.
	 */
	private clearMappingForProperty(propertyKey: string): void {
		for (const [fieldKey, propName] of Object.entries(this.fieldOverrides)) {
			if (propName === propertyKey) {
				delete this.fieldOverrides[fieldKey];
			}
		}
	}

	private createMetadataSection(container: HTMLElement): void {
		this.metadataContainer = container.createDiv("metadata-container");

		const metadataLabel = this.metadataContainer.createDiv("detail-label");
		metadataLabel.createSpan().textContent = this.t("modals.taskEdit.sections.taskInfo");

		const infoHelp = metadataLabel.createSpan({ cls: "task-edit-modal__help" });
		setIcon(infoHelp, "help-circle");
		setTooltip(infoHelp, "Read-only metadata: tracked time, creation date, and file location.");

		const metadataContent = this.metadataContainer.createDiv("metadata-content");

		// Total tracked time
		const totalTimeSpent = calculateTotalTimeSpent(this.task.timeEntries || []);
		if (totalTimeSpent > 0) {
			const timeDiv = metadataContent.createDiv("metadata-item");
			timeDiv.createSpan("metadata-key").textContent =
				this.t("modals.taskEdit.metadata.totalTrackedTime") + " ";
			timeDiv.createSpan("metadata-value").textContent = formatTime(totalTimeSpent);
		}

		// Created date
		if (this.task.dateCreated) {
			const createdDiv = metadataContent.createDiv("metadata-item");
			createdDiv.createSpan("metadata-key").textContent =
				this.t("modals.taskEdit.metadata.created") + " ";
			createdDiv.createSpan("metadata-value").textContent = formatTimestampForDisplay(
				this.task.dateCreated
			);
		}

		// Modified date
		if (this.task.dateModified) {
			const modifiedDiv = metadataContent.createDiv("metadata-item");
			modifiedDiv.createSpan("metadata-key").textContent =
				this.t("modals.taskEdit.metadata.modified") + " ";
			modifiedDiv.createSpan("metadata-value").textContent = formatTimestampForDisplay(
				this.task.dateModified
			);
		}

		// File path (if available)
		if (this.task.path) {
			const pathDiv = metadataContent.createDiv("metadata-item");
			pathDiv.createSpan("metadata-key").textContent =
				this.t("modals.taskEdit.metadata.file") + " ";
			pathDiv.createSpan("metadata-value").textContent = this.task.path;
		}
	}

	private createRecurringCalendar(container: HTMLElement): void {
		// Calendar wrapper
		this.calendarWrapper = container.createDiv("recurring-calendar");

		// Show current month by default, or the month with most recent completions
		// Use local dates for calendar display
		const currentDate = getTodayLocal();
		let mostRecentCompletion = currentDate;

		if (this.task.complete_instances && this.task.complete_instances.length > 0) {
			const validCompletions = this.task.complete_instances
				.filter((d) => d && typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) // Only valid YYYY-MM-DD dates
				.map((d) => parseDateAsLocal(d).getTime())
				.filter((time) => !isNaN(time)); // Filter out invalid dates

			if (validCompletions.length > 0) {
				mostRecentCompletion = new Date(Math.max(...validCompletions));
			}
		}

		this.renderCalendarMonth(this.calendarWrapper, mostRecentCompletion);
	}

	private renderCalendarMonth(container: HTMLElement, displayDate: Date): void {
		container.empty();

		// Minimalist header
		const header = container.createDiv("recurring-calendar__header");
		const prevButton = header.createEl("button", {
			cls: "recurring-calendar__nav",
			text: "‹",
		});
		const monthLabel = header.createSpan("recurring-calendar__month");
		const locale = this.plugin.i18n.getCurrentLocale() || "en";
		const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
		monthLabel.textContent = monthFormatter.format(displayDate);
		const nextButton = header.createEl("button", {
			cls: "recurring-calendar__nav",
			text: "›",
		});

		// Minimalist grid
		const grid = container.createDiv("recurring-calendar__grid");

		// Get all dates to display (including padding from previous/next month)
		// Use UTC dates consistently to avoid timezone issues
		const monthStart = getUTCStartOfMonth(displayDate);
		const monthEnd = getUTCEndOfMonth(displayDate);

		// Respect the week start setting from calendar view settings
		const firstDaySetting = this.plugin.settings.calendarViewSettings.firstDay || 0;

		const calendarStart = getUTCStartOfWeek(monthStart, firstDaySetting);
		const calendarEnd = getUTCEndOfWeek(monthEnd, firstDaySetting);
		const allDays = generateUTCCalendarDates(calendarStart, calendarEnd);

		// Generate recurring instances for this month (with some buffer)
		const bufferStart = getUTCStartOfMonth(displayDate);
		bufferStart.setUTCMonth(bufferStart.getUTCMonth() - 1);
		const bufferEnd = getUTCEndOfMonth(displayDate);
		bufferEnd.setUTCMonth(bufferEnd.getUTCMonth() + 1);

		const recurringDates = generateRecurringInstances(this.task, bufferStart, bufferEnd);
		const recurringDateStrings = new Set(recurringDates.map((d) => formatDateForStorage(d)));

		// Get current completed instances (original + changes)
		const completedInstances = new Set(this.task.complete_instances || []);
		for (const dateStr of this.completedInstancesChanges) {
			if (completedInstances.has(dateStr)) {
				completedInstances.delete(dateStr);
			} else {
				completedInstances.add(dateStr);
			}
		}

		// Get skipped instances (read-only display)
		const skippedInstances = new Set(this.task.skipped_instances || []);

		// Render each day (no headers, just numbers)
		allDays.forEach((day) => {
			const dayStr = formatDateForStorage(day);
			// FIX: Use UTC-to-UTC comparison instead of mixing local and UTC dates
			const isCurrentMonth = day.getUTCMonth() === displayDate.getUTCMonth();
			const isRecurring = recurringDateStrings.has(dayStr);
			const isCompleted = completedInstances.has(dayStr);
			const isSkipped = skippedInstances.has(dayStr);

			const dayElement = grid.createDiv("recurring-calendar__day");
			// FIX: Use UTC date method instead of timezone-sensitive format()
			dayElement.textContent = String(day.getUTCDate());

			// Apply BEM modifier classes
			if (!isCurrentMonth) {
				dayElement.addClass("recurring-calendar__day--faded");
			}

			// Make all dates clickable
			dayElement.addClass("recurring-calendar__day--clickable");

			if (isRecurring) {
				dayElement.addClass("recurring-calendar__day--recurring");
			}

			if (isCompleted) {
				dayElement.addClass("recurring-calendar__day--completed");
			}

			if (isSkipped) {
				dayElement.addClass("recurring-calendar__day--skipped");
			}

			// Make all dates clickable
			dayElement.addEventListener("click", () => {
				this.toggleCompletedInstance(dayStr);
				this.renderCalendarMonth(container, displayDate);
			});
		});

		// Navigation event handlers
		prevButton.addEventListener("click", () => {
			// FIX: Use UTC methods to prevent timezone drift
			const prevMonth = new Date(displayDate);
			prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
			this.renderCalendarMonth(container, prevMonth);
		});

		nextButton.addEventListener("click", () => {
			// FIX: Use UTC methods to prevent timezone drift
			const nextMonth = new Date(displayDate);
			nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
			this.renderCalendarMonth(container, nextMonth);
		});
	}

	private toggleCompletedInstance(dateStr: string): void {
		const index = this.completedInstancesChanges.indexOf(dateStr);
		if (index !== -1) {
			this.completedInstancesChanges.splice(index, 1);
		} else {
			this.completedInstancesChanges.push(dateStr);
		}
	}

	async handleSave(): Promise<void> {
		if (!this.validateForm()) {
			new Notice(this.t("modals.taskEdit.notices.titleRequired"));
			return;
		}

		try {
			const changes = this.getChanges();
			const hasBlockingChanges =
				this.pendingBlockingUpdates.added.length > 0 ||
				this.pendingBlockingUpdates.removed.length > 0;
			const hasTaskChanges = Object.keys(changes).length > 0;
			const hasSubtaskChanges = this.hasSubtaskChanges();

			if (this.unresolvedBlockingEntries.length > 0 && !hasBlockingChanges) {
				new Notice(
					this.t("modals.taskEdit.notices.blockingUnresolved", {
						entries: this.unresolvedBlockingEntries.join(", "),
					})
				);
				this.unresolvedBlockingEntries = [];
			}

			if (!hasTaskChanges && !hasBlockingChanges && !hasSubtaskChanges) {
				new Notice(this.t("modals.taskEdit.notices.noChanges"));
				this.close();
				return;
			}

			let updatedTask = this.task;

			if (hasTaskChanges) {
				updatedTask = await this.plugin.taskService.updateTask(this.task, changes);
				this.task = updatedTask;
				if (Object.prototype.hasOwnProperty.call(changes as any, "details")) {
					const updatedDetails = ((changes as any).details ?? "").toString();
					this.details = updatedDetails;
					this.originalDetails = updatedDetails;
				}
			}

			if (hasBlockingChanges) {
				await this.plugin.taskService.updateBlockingRelationships(
					updatedTask,
					this.pendingBlockingUpdates.added,
					this.pendingBlockingUpdates.removed,
					this.pendingBlockingUpdates.raw
				);

				const refreshed = await this.plugin.cacheManager.getTaskInfo(updatedTask.path);
				if (refreshed) {
					updatedTask = refreshed;
					this.task = refreshed;
				}
			}

			if (hasSubtaskChanges) {
				await this.applySubtaskChanges(updatedTask);
			}

			if (this.unresolvedBlockingEntries.length > 0) {
				new Notice(
					this.t("modals.taskEdit.notices.blockingUnresolved", {
						entries: this.unresolvedBlockingEntries.join(", "),
					})
				);
			}

			if (this.options.onTaskUpdated) {
				this.options.onTaskUpdated(updatedTask);
			}

			if (hasTaskChanges) {
				new Notice(
					this.t("modals.taskEdit.notices.updateSuccess", { title: updatedTask.title })
				);
			} else if (hasBlockingChanges) {
				new Notice(this.t("modals.taskEdit.notices.dependenciesUpdateSuccess"));
			}

			this.pendingBlockingUpdates = { added: [], removed: [], raw: {} };
			this.unresolvedBlockingEntries = [];
		} catch (error) {
			console.error("Failed to update task:", error);
			const message = error instanceof Error && error.message ? error.message : String(error);
			new Notice(this.t("modals.taskEdit.notices.updateFailure", { message }));
		}
	}

	private getChanges(): Partial<TaskInfo> {
		const changes: Partial<TaskInfo> = {};

		// Check for changes and only include modified fields
		if (this.title.trim() !== this.task.title) {
			changes.title = this.title.trim();
		}

		if (this.dueDate !== (this.task.due || "")) {
			changes.due = this.dueDate || undefined;
		}

		if (this.scheduledDate !== (this.task.scheduled || "")) {
			changes.scheduled = this.scheduledDate || undefined;
		}

		if (this.priority !== this.task.priority) {
			changes.priority = this.priority;
		}

		if (this.status !== this.task.status) {
			changes.status = this.status;
		}

		// Parse and compare contexts
		const newContexts = this.contexts
			.split(",")
			.map((c) => c.trim())
			.filter((c) => c.length > 0);
		const oldContexts = this.task.contexts || [];

		if (JSON.stringify(newContexts.sort()) !== JSON.stringify(oldContexts.sort())) {
			changes.contexts = newContexts.length > 0 ? newContexts : undefined;
		}

		// Parse and compare projects
		const newProjects = splitListPreservingLinksAndQuotes(this.projects);
		const oldProjects = this.task.projects || [];

		const normalizeProjectList = (projects: string[]): string[] =>
			projects
				.map((project) => {
					if (!project || typeof project !== "string") return "";
					const trimmed = project.trim();
					if (!trimmed) return "";
					return parseLinkToPath(trimmed).trim();
				})
				.filter((project) => project.length > 0);

		const normalizedNewProjects = normalizeProjectList(newProjects).sort();
		const normalizedOldProjects = normalizeProjectList(oldProjects).sort();

		if (
			JSON.stringify(normalizedNewProjects) !== JSON.stringify(normalizedOldProjects)
		) {
			changes.projects = newProjects.length > 0 ? newProjects : [];
		}

		// Parse and compare tags
		const tagsUnchanged =
			sanitizeTags(this.tags) === sanitizeTags(this.initialTags);
		const newTags = this.tags
			.split(",")
			.map((t) => t.trim())
			.filter((t) => t.length > 0);

		// Add the task tag if using tag-based identification and it's not already present
		if (
			this.plugin.settings.taskIdentificationMethod === 'tag' &&
			this.plugin.settings.taskTag &&
			!newTags.includes(this.plugin.settings.taskTag)
		) {
			newTags.push(this.plugin.settings.taskTag);
		}

		const oldTags = this.task.tags || [];

		if (!tagsUnchanged && JSON.stringify(newTags.sort()) !== JSON.stringify(oldTags.sort())) {
			changes.tags = newTags.length > 0 ? newTags : undefined;
		}

		// Compare time estimate
		const newTimeEstimate = this.timeEstimate > 0 ? this.timeEstimate : undefined;
		const oldTimeEstimate = this.task.timeEstimate;

		if (newTimeEstimate !== oldTimeEstimate) {
			changes.timeEstimate = newTimeEstimate;
		}

		// Compare recurrence
		const oldRecurrence = typeof this.task.recurrence === "string" ? this.task.recurrence : "";

		if (this.recurrenceRule !== oldRecurrence) {
			changes.recurrence = this.recurrenceRule || undefined;
		}

		// Compare recurrence anchor
		const oldRecurrenceAnchor = this.task.recurrence_anchor || 'scheduled';

		if (this.recurrenceAnchor !== oldRecurrenceAnchor) {
			changes.recurrence_anchor = this.recurrenceAnchor;
		}

		// Compare reminders
		const oldReminders = this.task.reminders || [];
		const newReminders = this.reminders || [];

		if (JSON.stringify(newReminders) !== JSON.stringify(oldReminders)) {
			changes.reminders = newReminders.length > 0 ? newReminders : undefined;
		}

		const newBlockedDependencies = this.blockedByItems.map((item) => ({
			...item.dependency,
		}));
		if (!this.dependenciesEqual(newBlockedDependencies, this.initialBlockedBy)) {
			changes.blockedBy =
				newBlockedDependencies.length > 0 ? newBlockedDependencies : undefined;
		}

		const resolvedBlocking = new Map<string, TaskDependency>();
		const unresolvedEntries: string[] = [];

		this.blockingItems.forEach((item) => {
			if (item.path) {
				resolvedBlocking.set(item.path, { ...item.dependency });
			} else {
				unresolvedEntries.push(item.dependency.uid);
			}
		});

		const newBlockingPaths = Array.from(resolvedBlocking.keys());
		const originalPaths = new Set(this.initialBlockingPaths);
		const newPathSet = new Set(newBlockingPaths);

		const addedPaths = newBlockingPaths.filter((path) => !originalPaths.has(path));
		const removedPaths = this.initialBlockingPaths.filter((path) => !newPathSet.has(path));

		const rawAdditions: Record<string, TaskDependency> = {};
		for (const path of addedPaths) {
			const raw = resolvedBlocking.get(path);
			if (raw) {
				rawAdditions[path] = { ...raw };
			}
		}

		this.pendingBlockingUpdates = {
			added: addedPaths,
			removed: removedPaths,
			raw: rawAdditions,
		};
		this.unresolvedBlockingEntries = unresolvedEntries;

		const normalizedDetails = this.normalizeDetails(this.details);
		const normalizedOriginal = this.normalizeDetails(this.originalDetails);
		if (normalizedDetails !== normalizedOriginal) {
			changes.details = normalizedDetails.trimEnd();
		}

		// Apply completed instances changes
		if (this.completedInstancesChanges.length > 0) {
			const currentCompleted = new Set(this.task.complete_instances || []);
			let latestAddedCompletion: string | null = null;

			for (const dateStr of this.completedInstancesChanges) {
				if (currentCompleted.has(dateStr)) {
					currentCompleted.delete(dateStr);
				} else {
					currentCompleted.add(dateStr);
					// Track the latest date being added (for completion-based recurrence)
					if (!latestAddedCompletion || dateStr > latestAddedCompletion) {
						latestAddedCompletion = dateStr;
					}
				}
			}
			changes.complete_instances = Array.from(currentCompleted);

			// If task has recurrence, handle DTSTART update and scheduled date calculation
			if (this.task.recurrence && typeof this.task.recurrence === 'string') {
				const recurrenceAnchor = this.task.recurrence_anchor || 'scheduled';

				// For completion-based recurrence, update DTSTART when adding a completion
				if (recurrenceAnchor === 'completion' && latestAddedCompletion) {
					const { updateDTSTARTInRecurrenceRule } = require('../utils/helpers');
					const updatedRecurrence = updateDTSTARTInRecurrenceRule(
						this.task.recurrence,
						latestAddedCompletion
					);
					if (updatedRecurrence) {
						changes.recurrence = updatedRecurrence;
					}
				}

				// Calculate next scheduled date
				const tempTask: TaskInfo = {
					...this.task,
					...changes,
					// Use updated recurrence if it was changed
					recurrence: changes.recurrence || this.task.recurrence
				};
				const nextDates = updateToNextScheduledOccurrence(
					tempTask,
					this.plugin.settings.maintainDueDateOffsetInRecurring
				);
				if (nextDates.scheduled) {
					changes.scheduled = nextDates.scheduled;
				}
				if (nextDates.due) {
					changes.due = nextDates.due;
				}
			}
		}

		// Compare user fields and add to changes if modified
		const userFieldsChanges = this.getUserFieldChanges();
		if (Object.keys(userFieldsChanges).length > 0) {
			(changes as any).customFrontmatter = userFieldsChanges;
		}

		// Include field overrides so FieldMapper writes date fields to correct properties
		if (Object.keys(this.fieldOverrides).length > 0) {
			changes.fieldOverrides = { ...this.fieldOverrides };
		}

		// Always update modified timestamp if there are changes
		if (Object.keys(changes).length > 0) {
			changes.dateModified = getCurrentTimestamp();
		}

		return changes;
	}

	private getUserFieldChanges(): Record<string, any> {
		const userFieldsChanges: Record<string, any> = {};

		try {
			// Get current frontmatter values
			const file = this.app.vault.getAbstractFileByPath(this.task.path);
			if (!file || !(file instanceof TFile)) {
				return userFieldsChanges;
			}

			const metadata = this.app.metadataCache.getFileCache(file);
			const frontmatter: Record<string, any> = metadata?.frontmatter || {};

			// Compare current values with original frontmatter (configured user fields)
			const userFieldConfigs = this.plugin.settings?.userFields || [];
			const checkedKeys = new Set<string>();
			for (const field of userFieldConfigs) {
				if (!field || !field.key) continue;
				checkedKeys.add(field.key);

				const newValue = this.userFields[field.key];
				const oldValue = frontmatter[field.key];

				// Check if values are different
				if (this.isDifferent(newValue, oldValue)) {
					// Set to null if empty value, otherwise use the new value
					userFieldsChanges[field.key] =
						newValue === null || newValue === undefined || newValue === ""
							? null
							: newValue;
				}
			}

			// Also check discovered properties (auto-discovered, not in settings)
			for (const prop of this.discoveredProperties) {
				if (checkedKeys.has(prop.key)) continue;
				checkedKeys.add(prop.key);

				const newValue = this.userFields[prop.key];
				const oldValue = frontmatter[prop.key];
				// Normalize Date objects from YAML for comparison
				const normalizedOld = oldValue instanceof Date
					? normalizeDateValue(oldValue) ?? oldValue
					: oldValue;

				if (this.isDifferent(newValue, normalizedOld)) {
					userFieldsChanges[prop.key] =
						newValue === null || newValue === undefined || newValue === ""
							? null
							: newValue;
				}
			}

			// Check for newly-added properties (added via PropertyPicker, not in discoveredProperties)
			for (const [key, value] of Object.entries(this.userFields)) {
				if (checkedKeys.has(key)) continue;
				// This is a new property added during this edit session
				if (value !== null && value !== undefined && value !== "") {
					userFieldsChanges[key] = value;
				}
			}

			// Write per-task field override tracking properties (tnDueDateProp, etc.)
			// Compare current overrides with what's in frontmatter to detect changes
			const originalOverrides = readFieldOverrides(frontmatter);
			for (const [internalKey, trackingProp] of Object.entries(FIELD_OVERRIDE_PROPS)) {
				const newPropName = this.fieldOverrides[internalKey] || null;
				const oldPropName = originalOverrides[internalKey] || null;
				if (newPropName !== oldPropName) {
					// Write the tracking property (or null to remove it)
					userFieldsChanges[trackingProp] = newPropName;
				}
			}
		} catch (error) {
			console.error("Error comparing user fields:", error);
		}

		return userFieldsChanges;
	}

	private isDifferent(newValue: any, oldValue: any): boolean {
		// Handle null/undefined/empty comparisons
		const normalizeEmpty = (value: any) => {
			if (value === null || value === undefined || value === "") {
				return null;
			}
			return value;
		};

		const normalizedNew = normalizeEmpty(newValue);
		const normalizedOld = normalizeEmpty(oldValue);

		// For arrays (list fields), compare as JSON strings
		if (Array.isArray(normalizedNew) || Array.isArray(normalizedOld)) {
			return JSON.stringify(normalizedNew) !== JSON.stringify(normalizedOld);
		}

		// For other values, direct comparison
		return normalizedNew !== normalizedOld;
	}

	private async openTaskNote(): Promise<void> {
		try {
			// Get the file from the task path
			const file = this.app.vault.getAbstractFileByPath(this.task.path);

			if (!file) {
				new Notice(this.t("modals.taskEdit.notices.fileMissing", { path: this.task.path }));
				return;
			}

			// Open the file in a new leaf
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.openFile(file as TFile);

			// Close the modal
			this.close();
		} catch (error) {
			console.error("Failed to open task note:", error);
			new Notice(this.t("modals.taskEdit.notices.openNoteFailure"));
		}
	}

	private async archiveTask(): Promise<void> {
		try {
			const updatedTask = await this.plugin.taskService.toggleArchive(this.task);

			// Update the task reference
			this.task = updatedTask;

			// Notify parent component if callback exists
			if (this.options.onTaskUpdated) {
				this.options.onTaskUpdated(updatedTask);
			}

			// Show success message
			const actionKey = updatedTask.archived
				? "modals.taskEdit.archiveAction.archived"
				: "modals.taskEdit.archiveAction.unarchived";
			const actionText = this.t(actionKey);
			new Notice(this.t("modals.taskEdit.notices.archiveSuccess", { action: actionText }));

			// Close the modal
			this.close();
		} catch (error) {
			console.error("Failed to archive task:", error);
			new Notice(this.t("modals.taskEdit.notices.archiveFailure"));
		}
	}

	protected createActionButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv("modal-button-container");

		// Add "Open note" button
		const openNoteButton = buttonContainer.createEl("button", {
			cls: "open-note-button",
			text: this.t("modals.task.buttons.openNote"),
		});

		openNoteButton.addEventListener("click", async () => {
			await this.openTaskNote();
		});

		// Add "Archive" button
		const archiveButton = buttonContainer.createEl("button", {
			cls: "mod-warning archive-button",
			text: this.task.archived
				? this.t("modals.taskEdit.buttons.unarchive")
				: this.t("modals.taskEdit.buttons.archive"),
		});

		archiveButton.addEventListener("click", async () => {
			await this.archiveTask();
		});

		// Save button (primary action)
		const saveButton = buttonContainer.createEl("button", {
			cls: "mod-cta",
			text: this.t("modals.task.buttons.save"),
		});

		saveButton.addEventListener("click", async () => {
			saveButton.disabled = true;
			try {
				await this.handleSave();
				this.forceClose();
			} finally {
				saveButton.disabled = false;
			}
		});

		// Cancel button
		const cancelButton = buttonContainer.createEl("button", {
			text: this.t("common.cancel"),
		});

		cancelButton.addEventListener("click", () => {
			this.close();
		});
	}

	protected async initializeSubtasks(): Promise<void> {
		try {
			const taskFile = this.app.vault.getAbstractFileByPath(this.task.path);
			if (!(taskFile instanceof TFile)) return;

			const subtasks = await this.plugin.projectSubtasksService.getTasksLinkedToProject(taskFile);
			this.selectedSubtaskFiles = [];
			this.initialSubtaskFiles = [];

			for (const subtask of subtasks) {
				const subtaskFile = this.app.vault.getAbstractFileByPath(subtask.path);
				if (subtaskFile) {
					this.selectedSubtaskFiles.push(subtaskFile);
					this.initialSubtaskFiles.push(subtaskFile);
				}
			}
		} catch (error) {
			console.error("Error initializing subtasks:", error);
		}
	}

	protected hasSubtaskChanges(): boolean {
		// Check if subtasks have changed
		const current = this.selectedSubtaskFiles.map(f => f.path).sort();
		const initial = this.initialSubtaskFiles.map(f => f.path).sort();

		return current.length !== initial.length ||
			   current.some((path, index) => path !== initial[index]);
	}

	protected async applySubtaskChanges(task: TaskInfo): Promise<void> {
		const currentTaskFile = this.app.vault.getAbstractFileByPath(task.path);
		if (!(currentTaskFile instanceof TFile)) return;

		const currentPaths = new Set(this.selectedSubtaskFiles.map(f => f.path));
		const initialPaths = new Set(this.initialSubtaskFiles.map(f => f.path));

		// Remove current task from tasks that should no longer be subtasks
		const toRemove = this.initialSubtaskFiles.filter(f => !currentPaths.has(f.path));
		for (const file of toRemove) {
			await this.removeSubtaskRelation(file, currentTaskFile);
		}

		// Add current task to tasks that should become subtasks
		const toAdd = this.selectedSubtaskFiles.filter(f => !initialPaths.has(f.path));
		for (const file of toAdd) {
			await this.addSubtaskRelation(file, currentTaskFile);
		}

		// Update the initial state to reflect changes
		this.initialSubtaskFiles = [...this.selectedSubtaskFiles];
	}

	protected async addSubtaskRelation(subtaskFile: TAbstractFile, parentTaskFile: TFile): Promise<void> {
		try {
			const subtaskInfo = await this.plugin.cacheManager.getTaskInfo(subtaskFile.path);
			if (!subtaskInfo) return;

			const projectReference = this.buildProjectReference(parentTaskFile, subtaskFile.path);
			const legacyReference = `[[${parentTaskFile.basename}]]`;
			const currentProjects = Array.isArray(subtaskInfo.projects) ? subtaskInfo.projects : [];

			if (
				currentProjects.includes(projectReference) ||
				currentProjects.includes(legacyReference)
			) {
				return;
			}

			const sanitizedProjects = currentProjects.filter((entry) => entry !== legacyReference);
			const updatedProjects = [...sanitizedProjects, projectReference];
			await this.plugin.updateTaskProperty(subtaskInfo, "projects", updatedProjects);
		} catch (error) {
			console.error("Failed to add subtask relation:", error);
		}
	}

	protected async removeSubtaskRelation(subtaskFile: TAbstractFile, parentTaskFile: TFile): Promise<void> {
		try {
			const subtaskInfo = await this.plugin.cacheManager.getTaskInfo(subtaskFile.path);
			if (!subtaskInfo) return;

			const projectReference = this.buildProjectReference(parentTaskFile, subtaskFile.path);
			const legacyReference = `[[${parentTaskFile.basename}]]`;
			const currentProjects = Array.isArray(subtaskInfo.projects) ? subtaskInfo.projects : [];

			const updatedProjects = currentProjects.filter(
				(project) => project !== projectReference && project !== legacyReference
			);
			await this.plugin.updateTaskProperty(subtaskInfo, "projects", updatedProjects);
		} catch (error) {
			console.error("Failed to remove subtask relation:", error);
		}
	}

	// Start expanded for edit modal - override parent property
	protected isExpanded = true;
}
