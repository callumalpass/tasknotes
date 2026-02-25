import { App, Modal, Setting, setIcon, Notice, setTooltip, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskInfo, Reminder } from "../types";
import { formatDateForDisplay } from "../utils/dateUtils";
import { getAvailableDateAnchors, resolveAnchorDate, getAnchorDisplayName, type DateAnchor, type DateAnchorOrigin } from "../utils/dateAnchorUtils";
import { keyToDisplayName, type PropertyType } from "../utils/propertyDiscoveryUtils";
import { createPropertyPicker } from "../ui/PropertyPicker";
import {
	type TimelineMarker,
	normalizeToHours,
	formatShortOffset,
	parseISO8601Offset,
	renderTimelineArea,
} from "../utils/reminderTimelineUtils";
import type { UserMappedField } from "../types/settings";
import { initializeFieldConfig } from "../utils/fieldConfigDefaults";

export class ReminderModal extends Modal {
	private plugin: TaskNotesPlugin;
	private task: TaskInfo;
	private reminders: Reminder[];
	private onSave: (reminders: Reminder[]) => void;
	private originalReminders: Reminder[];
	private saveBtn: HTMLButtonElement;
	private itemPaths?: string[];

	// Form state
	private selectedType: "absolute" | "relative" = "relative";
	private relativeAnchor: string = "due";
	private relativeOffset = 15;
	private relativeUnit: "minutes" | "hours" | "days" = "minutes";
	private relativeDirection: "before" | "after" = "before";
	private absoluteDate = "";
	private absoluteTime = "";
	private description = "";

	// Edit state: index of the reminder being edited, or null for "add" mode
	private editingIndex: number | null = null;

	// Transient state: tracks recently demoted keys for "Undo" affordance
	private recentlyDemotedKeys = new Set<string>();
	// Persist vault-wide checkbox across PropertyPicker re-renders
	private pickerScope: import("../ui/PropertyPicker").PropertyScope | undefined;

	constructor(
		app: App,
		plugin: TaskNotesPlugin,
		task: TaskInfo,
		onSave: (reminders: Reminder[]) => void,
		itemPaths?: string[]
	) {
		super(app);
		this.plugin = plugin;
		this.task = task;
		this.reminders = task.reminders ? [...task.reminders] : [];
		this.originalReminders = task.reminders ? [...task.reminders] : [];
		this.onSave = onSave;
		this.itemPaths = itemPaths;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-plugin");
		contentEl.addClass("tasknotes-reminder-modal");

		// Show loading state while we fetch fresh data
		const loadingContainer = contentEl.createDiv({ cls: "reminder-modal__loading" });
		loadingContainer.createEl("div", { text: "Loading reminders..." });

		// Fetch fresh data and render the modal
		this.initializeWithFreshData().catch((error) => {
			console.error("Failed to initialize reminder modal:", error);
			contentEl.empty();
			contentEl.addClass("tasknotes-plugin");
			contentEl.addClass("tasknotes-reminder-modal");
			contentEl.createDiv({
				cls: "reminder-modal__error",
				text: "Failed to load task data. Please try again.",
			});
		});
	}

	private async initializeWithFreshData(): Promise<void> {
		const { contentEl } = this;

		// Fetch fresh task data to avoid working with stale data
		if (this.task.path && this.task.path.trim() !== "") {
			const freshTask = await this.plugin.cacheManager.getTaskInfo(this.task.path);
			if (freshTask) {
				this.task = freshTask;
				this.reminders = freshTask.reminders ? [...freshTask.reminders] : [];
				this.originalReminders = freshTask.reminders ? [...freshTask.reminders] : [];
			} else {
				// Task path exists but not found in cache - use provided task data
				// This can happen during edit when changes haven't been saved yet
				this.reminders = this.task.reminders ? [...this.task.reminders] : [];
				this.originalReminders = this.task.reminders ? [...this.task.reminders] : [];
			}
		} else {
			// Task doesn't have a path yet (new task being created)
			// Use the provided task data
			this.reminders = this.task.reminders ? [...this.task.reminders] : [];
			this.originalReminders = this.task.reminders ? [...this.task.reminders] : [];
		}

		// Clear loading state and render the actual modal content
		contentEl.empty();
		contentEl.addClass("tasknotes-plugin");
		contentEl.addClass("tasknotes-reminder-modal");

		// Compact header
		const headerContainer = contentEl.createDiv({ cls: "reminder-modal__header" });
		headerContainer.createEl("h2", { text: "Task Reminders" });

		headerContainer.createDiv({
			cls: "reminder-modal__task-title",
			text: this.task.title,
		});

		// Add task dates context if available
		const contextInfo = this.getTaskContextInfo();
		if (contextInfo) {
			const taskDates = headerContainer.createDiv({ cls: "reminder-modal__task-dates" });
			taskDates.textContent = contextInfo;
		}

		// Main content area - more compact
		const contentContainer = contentEl.createDiv({ cls: "reminder-modal__content" });

		// Existing reminders section
		this.renderExistingReminders(contentContainer);

		// Available date properties section (collapsible)
		this.renderDatePropertiesSection(contentContainer);

		// Timeline preview
		this.renderTimelinePreview(contentContainer);

		// Add new reminder section
		this.renderAddReminderForm(contentContainer);

		// Action buttons
		this.renderActionButtons(contentEl);

		// Set up keyboard handlers and update save button state
		this.setupKeyboardHandlers();
		this.updateSaveButtonState();
	}

	private renderActionButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv({ cls: "reminder-modal__actions" });

		// Save button (initially disabled)
		this.saveBtn = buttonContainer.createEl("button", {
			text: "Save Changes",
			cls: "mod-cta reminder-modal__save-btn",
		});
		this.saveBtn.disabled = true;
		this.saveBtn.onclick = async () => {
			await this.save();
		};

		const cancelBtn = buttonContainer.createEl("button", {
			text: "Cancel",
			cls: "reminder-modal__cancel-btn",
		});
		cancelBtn.onclick = () => {
			this.cancel();
		};
	}

	private getTaskContextInfo(): string | null {
		const parts: string[] = [];

		if (this.task.due) {
			parts.push(`Due: ${formatDateForDisplay(this.task.due)}`);
		}

		if (this.task.scheduled) {
			parts.push(`Scheduled: ${formatDateForDisplay(this.task.scheduled)}`);
		}

		return parts.length > 0 ? parts.join(" • ") : null;
	}

	private setupKeyboardHandlers(): void {
		const handleKeydown = async (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !this.saveBtn.disabled) {
				e.preventDefault();
				await this.save();
			} else if (e.key === "Escape") {
				e.preventDefault();
				this.cancel();
			}
		};

		this.contentEl.addEventListener("keydown", handleKeydown);
		this.onClose = () => {
			this.contentEl.removeEventListener("keydown", handleKeydown);
			const { contentEl } = this;
			contentEl.empty();
		};
	}

	private updateSaveButtonState(): void {
		if (!this.saveBtn) return;

		const hasChanges = this.remindersHaveChanged();
		this.saveBtn.disabled = !hasChanges;
		this.saveBtn.textContent = hasChanges ? "Save Changes" : "No Changes";
	}

	private renderExistingReminders(container: HTMLElement): void {
		const section = container.createDiv({ cls: "reminder-modal__section" });

		const sectionHeader = section.createDiv({ cls: "reminder-modal__section-header" });
		sectionHeader.createEl("h3", { text: "Current Reminders" });

		const helpIcon = sectionHeader.createSpan({ cls: "reminder-modal__help" });
		setIcon(helpIcon, "help-circle");
		setTooltip(helpIcon, "Edit or delete reminders. Click the pencil to edit, trash to delete. Configure defaults in Settings → Task Properties → Reminders.", { placement: "top" });

		if (this.reminders.length > 0) {
			sectionHeader.createSpan({
				cls: "reminder-modal__reminder-count",
				text: `(${this.reminders.length})`,
			});
		}

		if (this.reminders.length === 0) {
			const emptyState = section.createDiv({ cls: "reminder-modal__empty-state" });
			setIcon(emptyState.createDiv({ cls: "reminder-modal__empty-icon" }), "bell-off");
			emptyState.createEl("div", {
				cls: "reminder-modal__empty-text",
				text: "No reminders set",
			});
			return;
		}

		const reminderList = section.createDiv({ cls: "reminder-modal__reminder-list" });

		this.reminders.forEach((reminder, index) => {
			const reminderCard = reminderList.createDiv({ cls: "reminder-modal__reminder-card" });
			if (this.editingIndex === index) reminderCard.addClass("reminder-modal__reminder-card--editing");
			if (reminder.id) reminderCard.setAttribute("data-card-id", reminder.id);

			// Reminder type icon
			const iconContainer = reminderCard.createDiv({ cls: "reminder-modal__reminder-icon" });
			const iconName = reminder.type === "absolute" ? "calendar-clock" : "timer";
			setIcon(iconContainer, iconName);

			// Main content area
			const content = reminderCard.createDiv({ cls: "reminder-modal__reminder-content" });

			// Primary info (timing with time for absolute reminders)
			const primaryInfo = content.createDiv({ cls: "reminder-modal__reminder-primary" });
			primaryInfo.textContent = this.formatReminderDisplayText(reminder);

			// Semantic type badge
			if (reminder.semanticType && reminder.semanticType !== "custom") {
				const badgeLabels: Record<string, string> = {
					"lead-time": "Lead time",
					"due-date": "Persistent",
					"overdue": "Repeating",
					"start-date": "Start date",
				};
				const badge = content.createSpan({ cls: "reminder-modal__semantic-badge" });
				badge.textContent = badgeLabels[reminder.semanticType] || reminder.semanticType;
				if (reminder.semanticType === "due-date" || reminder.semanticType === "overdue") {
					badge.addClass("reminder-modal__semantic-badge--persistent");
				}
			}

			// Custom description (if any)
			if (reminder.description) {
				const description = content.createDiv({
					cls: "reminder-modal__reminder-description",
				});
				description.textContent = `"${reminder.description}"`;
			}

			// Actions area
			const actions = reminderCard.createDiv({ cls: "reminder-modal__reminder-actions" });

			// Edit button
			const editBtn = actions.createEl("button", {
				cls: "reminder-modal__action-btn reminder-modal__edit-btn",
			});
			setIcon(editBtn, "pencil");
			setTooltip(editBtn, "Edit this reminder");
			editBtn.onclick = (e) => {
				e.stopPropagation();
				this.startEditingReminder(index);
			};

			// Remove button
			const removeBtn = actions.createEl("button", {
				cls: "reminder-modal__action-btn reminder-modal__remove-btn",
			});
			setIcon(removeBtn, "trash-2");
			setTooltip(removeBtn, "Delete this reminder");
			removeBtn.onclick = async (e) => {
				e.stopPropagation();
				await this.removeReminder(index);
			};
		});
	}

	/**
	 * Write a date property value directly to the task's frontmatter.
	 * For core fields, resolves the user-configured key via FieldMapper.
	 */
	private async writePropertyToFrontmatter(anchorKey: string, value: string): Promise<void> {
		if (!this.task.path) return;
		const file = this.plugin.app.vault.getAbstractFileByPath(this.task.path);
		if (!(file instanceof TFile)) return;

		// For core fields, use FieldMapper to get the user-configured frontmatter key
		let fmKey = anchorKey;
		const coreKeys = ["due", "scheduled", "dateCreated", "dateModified", "completedDate"];
		if (coreKeys.includes(anchorKey) && this.plugin.fieldMapper) {
			try {
				const mapped = this.plugin.fieldMapper.toUserField(anchorKey as any);
				if (mapped) fmKey = mapped;
			} catch { /* not a FieldMapping key, use as-is */ }
		}

		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			if (value) {
				fm[fmKey] = value;
			} else {
				delete fm[fmKey];
			}
		});

		// Update in-memory task data
		if (coreKeys.includes(anchorKey)) {
			(this.task as any)[anchorKey] = value || undefined;
		} else {
			if (!this.task.customProperties) this.task.customProperties = {};
			if (value) {
				this.task.customProperties[anchorKey] = value;
			} else {
				delete this.task.customProperties[anchorKey];
			}
		}
	}

	/**
	 * Promote a discovered property to a custom User Field (date type).
	 */
	private promoteToUserField(key: string, displayName?: string): void {
		const userFields = this.plugin.settings.userFields || [];
		if (userFields.some(f => f.key === key)) {
			new Notice(`"${displayName || key}" is already a global custom property`);
			return;
		}

		const newField: UserMappedField = {
			id: key,
			displayName: displayName || key,
			key: key,
			type: "date",
		};

		userFields.push(newField);
		this.plugin.settings.userFields = userFields;

		// Also register in modalFieldsConfig so it appears in task creation/edit modals
		if (!this.plugin.settings.modalFieldsConfig) {
			this.plugin.settings.modalFieldsConfig = initializeFieldConfig(
				undefined,
				this.plugin.settings.userFields
			);
		} else {
			const config = this.plugin.settings.modalFieldsConfig;
			const alreadyExists = config.fields.some(f => f.id === key && f.fieldType === "user");
			if (!alreadyExists) {
				const customGroupFields = config.fields.filter(f => f.group === "custom");
				const maxOrder = customGroupFields.length > 0
					? Math.max(...customGroupFields.map(f => f.order))
					: -1;
				config.fields.push({
					id: key,
					fieldType: "user",
					group: "custom",
					displayName: displayName || key,
					visibleInCreation: true,
					visibleInEdit: true,
					order: maxOrder + 1,
					enabled: true,
				});
			}
		}

		this.plugin.saveSettings();
		new Notice(`"${displayName || key}" added as a global property`);
	}

	/**
	 * Demote a global property back to discovered (remove from settings).
	 * Data stays on individual tasks — only the settings registration is removed.
	 */
	private demoteUserField(key: string): void {
		// Remove from userFields
		const userFields = this.plugin.settings.userFields || [];
		const idx = userFields.findIndex(f => f.key === key);
		if (idx >= 0) userFields.splice(idx, 1);
		this.plugin.settings.userFields = userFields;

		// Remove from modalFieldsConfig
		if (this.plugin.settings.modalFieldsConfig) {
			const config = this.plugin.settings.modalFieldsConfig;
			config.fields = config.fields.filter(
				f => !(f.id === key && f.fieldType === "user")
			);
		}

		this.plugin.saveSettings();
		new Notice(`"${key}" removed from global properties. Data preserved on tasks.`);
	}

	private renderDatePropertiesSection(container: HTMLElement): void {
		// Find or create wrapper (preserves DOM position on re-renders)
		let wrapper = container.querySelector(":scope > .tn-date-props-section-wrapper") as HTMLElement;
		const wasOpen = wrapper?.querySelector("details.tn-date-props")?.hasAttribute("open") ?? false;
		if (wrapper) {
			wrapper.empty();
		} else {
			wrapper = container.createDiv({ cls: "tn-date-props-section-wrapper" });
		}

		const includeVaultWide = !this.task.path || this.task.path.trim() === "";
		const anchors = getAvailableDateAnchors(this.plugin, this.task, {
			includeVaultWideDiscovery: includeVaultWide && !this.itemPaths?.length,
			itemPaths: this.itemPaths,
		});

		// Ensure recently demoted keys still appear (may not be in vault-wide discovery)
		for (const key of this.recentlyDemotedKeys) {
			if (!anchors.some(a => a.key === key)) {
				anchors.push({
					key,
					displayName: keyToDisplayName(key),
					origin: "discovered" as DateAnchorOrigin,
				});
			}
		}

		if (anchors.length === 0) return;

		const section = wrapper.createDiv({ cls: "reminder-modal__section" });

		// Collapsible header — default collapsed
		const details = section.createEl("details", { cls: "tn-date-props" });
		const summary = details.createEl("summary", { cls: "tn-date-props-summary" });
		summary.createEl("h3", { text: "Remap properties" });
		const countSpan = summary.createSpan({
			cls: "reminder-modal__reminder-count",
			text: `(${anchors.length} available)`,
		});

		// Description text
		const desc = details.createEl("p", { cls: "tn-date-props-description" });
		desc.appendText("Properties that can anchor reminders. Click \"Use \u2192\" to set as the \"Relative to\" date.");
		if (this.task.path) {
			const saveNote = desc.createEl("span");
			saveNote.style.cssText = "color: var(--text-faint); font-style: italic;";
			saveNote.textContent = " Changes save to file immediately.";
		}

		const settingsNote = details.createEl("p", { cls: "tn-date-props-settings-note" });
		settingsNote.textContent = "Promote and Demote change global settings immediately. Reminder changes require Save.";

		// PropertyPicker for searching vault-wide properties
		const pickerContainer = details.createDiv({ cls: "tn-reminder-property-picker" });
		const anchorKeySet = new Set(anchors.map(a => a.key));
		createPropertyPicker({
			container: pickerContainer,
			plugin: this.plugin,
			currentFilePath: this.task.path || undefined,
			itemPaths: this.itemPaths,
			excludeKeys: anchorKeySet,
			allowedConversionTargets: ["date"],
			initialScope: this.pickerScope,
			onScopeChange: (scope) => { this.pickerScope = scope; },
			onSelect: (key: string, type: PropertyType) => {
				if (type === "date") {
					// Set as the "Relative to" anchor directly
					this.relativeAnchor = key;
					new Notice(`Set "${key}" as reminder anchor`);
					// Re-render sections so the new anchor is reflected
					this.renderDatePropertiesSection(container);
					this.renderAddReminderForm(container);
					// Auto-scroll to "Relative to" so the user sees the selection took effect
					setTimeout(() => {
						const formWrapper = container.querySelector(".reminder-modal__add-form-wrapper");
						if (formWrapper) formWrapper.scrollIntoView({ behavior: "smooth", block: "center" });
					}, 150);
				}
				// Non-date clicks are handled inline by PropertyPicker (flash + hint)
			},
			onConvert: async (key: string, targetType: string, files: string[], strategy: "convert-in-place" | "create-duplicate") => {
				const { convertPropertyType } = await import("../utils/propertyDiscoveryUtils");
				await convertPropertyType(this.plugin, key, targetType as PropertyType, files, strategy);
				new Notice(`Converted "${key}" to ${targetType} in ${files.length} file(s)`);
			},
		});
		// Vault-wide toggle visible — user controls whether to search all tasks or just this task's properties

		const propsContainer = details.createDiv({ cls: "tn-date-props-list" });

		// Group by origin
		const coreAnchors = anchors.filter(a => a.origin === "core");
		const settingsAnchors = anchors.filter(a => a.origin === "settings");
		const discoveredAnchors = anchors.filter(a => a.origin === "discovered");

		const renderGroup = (label: string, group: typeof anchors, originClass: string) => {
			if (group.length === 0) return;

			const groupContainer = propsContainer.createDiv({ cls: "tn-date-props-group" });
			const groupHeader = groupContainer.createDiv({ cls: "tn-date-props-group-header" });
			groupHeader.textContent = label;

			const rowEntries: { el: HTMLElement; anchor: DateAnchor }[] = [];
			for (const anchor of group) {
				const row = groupContainer.createDiv({ cls: `tn-date-prop-row ${originClass}` });
				rowEntries.push({ el: row, anchor });

				// Origin badge (with "Demoted" state for recently demoted properties)
				const badge = row.createSpan({ cls: "tn-date-prop-badge" });
				const isDemoted = anchor.origin === "discovered" && this.recentlyDemotedKeys.has(anchor.key);
				if (isDemoted) {
					badge.textContent = "Demoted";
					badge.style.cssText = "background: color-mix(in srgb, var(--text-warning) 15%, transparent); color: var(--text-warning);";
				} else {
					badge.textContent = anchor.origin === "core" ? "Core" : anchor.origin === "settings" ? "Global" : "Found";
				}

				// Property name: core shows display name + key hint; others show raw key
				const nameEl = row.createSpan({ cls: "tn-date-prop-name" });
				if (anchor.origin === "core") {
					nameEl.textContent = anchor.displayName;
					const hintKey = anchor.frontmatterKey || anchor.key;
					if (anchor.displayName !== hintKey) {
						nameEl.createSpan({
							cls: "tn-date-prop-key-hint",
							text: ` (${hintKey})`,
						});
					}
				} else {
					nameEl.textContent = anchor.key;
				}

				// Editable date value (or read-only if no task path)
				const valueEl = row.createSpan({ cls: "tn-date-prop-value" });
				if (this.task.path) {
					const dateInput = valueEl.createEl("input", {
						attr: { type: "date" },
						cls: "tn-date-prop-date-input",
					});
					dateInput.value = anchor.currentValue || "";
					if (!anchor.currentValue) {
						dateInput.classList.add("tn-date-prop-date-input--empty");
					}
					dateInput.addEventListener("change", async () => {
						const newValue = dateInput.value;
						await this.writePropertyToFrontmatter(anchor.key, newValue);
						anchor.currentValue = newValue || undefined;
						dateInput.classList.toggle("tn-date-prop-date-input--empty", !newValue);
						countSpan.textContent = `(${anchors.length} available)`;
					});
				} else {
					if (anchor.currentValue) {
						valueEl.textContent = formatDateForDisplay(anchor.currentValue);
						valueEl.addClass("tn-date-prop-value--set");
					} else {
						valueEl.textContent = "(not set)";
						valueEl.addClass("tn-date-prop-value--empty");
					}
				}

				// Promote or Undo button (discovered properties only)
				if (anchor.origin === "discovered") {
					if (isDemoted) {
						// "Undo" button for recently demoted properties
						const undoBtn = row.createEl("button", {
							cls: "tn-date-prop-promote-btn",
							text: "Undo",
						});
						setTooltip(undoBtn, "Re-promote to global custom properties");
						undoBtn.onclick = (e) => {
							e.preventDefault();
							e.stopPropagation();
							this.recentlyDemotedKeys.delete(anchor.key);
							this.promoteToUserField(anchor.key, anchor.displayName);
							this.renderDatePropertiesSection(container);
						};
					} else {
						const promoteBtn = row.createEl("button", {
							cls: "tn-date-prop-promote-btn",
							text: "Promote",
						});
						setTooltip(promoteBtn, "Save as global property. Appears in all task modals and reminder anchors. Reversible.");
						promoteBtn.onclick = (e) => {
							e.preventDefault();
							e.stopPropagation();
							this.promoteToUserField(anchor.key, anchor.displayName);
							this.renderDatePropertiesSection(container);
						};
					}
				}

				// Demote button (global/settings properties only)
				if (anchor.origin === "settings") {
					const demoteBtn = row.createEl("button", {
						cls: "tn-date-prop-demote-btn",
						text: "Demote",
					});
					setTooltip(demoteBtn, "Remove from global fields. Data stays on individual tasks.");
					demoteBtn.onclick = (e) => {
						e.preventDefault();
						e.stopPropagation();
						this.recentlyDemotedKeys.add(anchor.key);
						this.demoteUserField(anchor.key);
						this.renderDatePropertiesSection(container);
					};
				}

				// "Use as anchor" button
				const useBtn = row.createEl("button", {
					cls: "tn-date-prop-use-btn",
					text: "Use \u2192",
				});
				useBtn.onclick = (e) => {
					e.preventDefault();
					this.relativeAnchor = anchor.key;
					this.selectedType = "relative";

					// Update the dropdown in the form
					const dropdown = container.querySelector(
						".relative-fields .setting-item:nth-child(3) select"
					) as HTMLSelectElement;
					if (dropdown) {
						// If key isn't in dropdown (discovered), add as ad-hoc option
						const exists = Array.from(dropdown.options).some(opt => opt.value === anchor.key);
						if (!exists) {
							for (const opt of Array.from(dropdown.options)) {
								if (opt.dataset.adhoc === "true") opt.remove();
							}
							const newOpt = document.createElement("option");
							newOpt.value = anchor.key;
							newOpt.textContent = `${anchor.displayName} (discovered)`;
							newOpt.dataset.adhoc = "true";
							dropdown.appendChild(newOpt);
						}
						dropdown.value = anchor.key;
					}

					// Update type tabs
					const relativeTab = container.querySelector(
						'.reminder-modal__type-tab[data-type="relative"]'
					) as HTMLElement;
					const absoluteTab = container.querySelector(
						'.reminder-modal__type-tab[data-type="absolute"]'
					) as HTMLElement;
					if (relativeTab) relativeTab.classList.add("reminder-modal__type-tab--active");
					if (absoluteTab) absoluteTab.classList.remove("reminder-modal__type-tab--active");

					// Show relative fields
					const form = container.querySelector(".reminder-modal__form") as HTMLElement;
					if (form) this.updateFormVisibility(form, "relative");

					// Scroll to the form
					const formSection = container.querySelector(".reminder-modal__form");
					formSection?.scrollIntoView({ behavior: "smooth", block: "center" });
				};
			}

			// Search filter + "Show all" for large groups
		};

		renderGroup("Core", coreAnchors, "tn-date-prop-row--core");
		renderGroup("Global custom properties", settingsAnchors, "tn-date-prop-row--settings");
		if (discoveredAnchors.length > 0) {
			let discoveredLabel: string;
			if (this.itemPaths?.length) {
				discoveredLabel = `Discovered across ${this.itemPaths.length} task files`;
			} else if (!this.task.path || this.task.path.trim() === "") {
				discoveredLabel = "Discovered across task files";
			} else {
				discoveredLabel = "Discovered on this task";
			}
			renderGroup(discoveredLabel, discoveredAnchors, "tn-date-prop-row--discovered");
		}

		// "Add new date property" form (only if task has a file path)
		if (this.task.path) {
			const addContainer = propsContainer.createDiv({ cls: "tn-date-props-add" });

			const addBtn = addContainer.createEl("button", {
				cls: "tn-date-prop-add-btn",
			});
			const addBtnIcon = addBtn.createSpan({ cls: "tn-date-prop-add-icon" });
			setIcon(addBtnIcon, "plus");
			addBtn.createSpan({ text: "Add date property" });

			addBtn.onclick = () => {
				addBtn.style.display = "none";

				const form = addContainer.createDiv({ cls: "tn-date-props-add-form" });
				const nameInput = form.createEl("input", {
					attr: { type: "text", placeholder: "Property name" },
					cls: "tn-date-props-add-name",
				});
				const dateInput = form.createEl("input", {
					attr: { type: "date" },
					cls: "tn-date-props-add-date",
				});
				dateInput.value = new Date().toISOString().slice(0, 10);

				const submitBtn = form.createEl("button", { cls: "tn-date-props-add-submit" });
				const submitIcon = submitBtn.createSpan();
				setIcon(submitIcon, "check");
				setTooltip(submitBtn, "Create property");
				submitBtn.onclick = async () => {
					const key = nameInput.value.trim().replace(/\s+/g, "_");
					if (!key) {
						new Notice("Please enter a property name");
						return;
					}
					if (anchors.some(a => a.key === key)) {
						new Notice(`Property "${key}" already exists`);
						return;
					}

					await this.writePropertyToFrontmatter(key, dateInput.value);
					this.promoteToUserField(key);
					new Notice(`Added "${key}" to task and global custom properties`);
					this.renderDatePropertiesSection(container);
				};

				const cancelBtn = form.createEl("button", { cls: "tn-date-props-add-cancel" });
				const cancelIcon = cancelBtn.createSpan();
				setIcon(cancelIcon, "x");
				setTooltip(cancelBtn, "Cancel");
				cancelBtn.onclick = () => {
					form.remove();
					addBtn.style.display = "";
				};

				setTimeout(() => nameInput.focus(), 50);
			};
		}

		// Restore <details> open state after re-render
		if (wasOpen) details.setAttribute("open", "");
	}

	private formatReminderDisplayText(reminder: Reminder): string {
		if (reminder.type === "absolute") {
			// For absolute reminders, show the full date and time
			if (reminder.absoluteTime) {
				try {
					const date = new Date(reminder.absoluteTime);
					return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
				} catch (error) {
					return `At ${reminder.absoluteTime}`;
				}
			}
			return "Absolute reminder";
		} else {
			// For relative reminders, show the timing relative to task date
			const anchor = getAnchorDisplayName(reminder.relatedTo || "due", this.plugin).toLowerCase();
			const offset = this.formatOffset(reminder.offset || "");
			return `${offset} ${anchor}`;
		}
	}

	private renderQuickActions(section: HTMLElement): void {
		// Only show quick actions if task has at least one date anchor with a value
		const anchors = getAvailableDateAnchors(this.plugin, this.task);
		const firstAnchorWithValue = anchors.find((a) => a.currentValue);
		if (!firstAnchorWithValue) return;

		const quickActions = section.createDiv({ cls: "reminder-modal__quick-actions" });

		const buttonsContainer = quickActions.createDiv({ cls: "reminder-modal__quick-buttons" });

		const commonReminders = [
			{ label: "5m", fullLabel: "5 minutes before", offset: "-PT5M", icon: "clock" },
			{ label: "15m", fullLabel: "15 minutes before", offset: "-PT15M", icon: "clock" },
			{ label: "1h", fullLabel: "1 hour before", offset: "-PT1H", icon: "clock" },
			{ label: "1d", fullLabel: "1 day before", offset: "-P1D", icon: "calendar" },
		];

		const anchor = firstAnchorWithValue.key;
		const anchorLabel = firstAnchorWithValue.displayName.toLowerCase();

		commonReminders.forEach(({ label, fullLabel, offset, icon }) => {
			const quickBtn = buttonsContainer.createEl("button", {
				cls: "reminder-modal__quick-btn",
			});

			const iconEl = quickBtn.createSpan({ cls: "reminder-modal__quick-btn-icon" });
			setIcon(iconEl, icon);

			quickBtn.createSpan({
				cls: "reminder-modal__quick-btn-label",
				text: label,
			});

			// Use Obsidian's native tooltip
			setTooltip(quickBtn, `Add reminder ${fullLabel} ${anchorLabel}`);

			quickBtn.onclick = async () => {
				await this.addQuickReminder(anchor, offset, fullLabel);
			};
		});

		// Semantic type preset buttons
		const semanticPresets = quickActions.createDiv({ cls: "reminder-modal__semantic-presets" });
		const semanticButtons = semanticPresets.createDiv({ cls: "reminder-modal__quick-buttons" });

		const presets = [
			{ label: "1d before", subtitle: "One-shot", semanticType: "lead-time" as const, offset: "-P1D", icon: "alarm-clock", description: "1 day before due" },
			{ label: "On due", subtitle: "Persistent", semanticType: "due-date" as const, offset: "PT0S", icon: "calendar-check", description: "On due date (persistent)" },
			{ label: "Overdue", subtitle: "Repeating", semanticType: "overdue" as const, offset: "P1D", icon: "alert-triangle", description: "Daily when overdue", repeatIntervalHours: 24 },
		];

		for (const preset of presets) {
			const btn = semanticButtons.createEl("button", {
				cls: "reminder-modal__quick-btn reminder-modal__semantic-btn",
			});

			const iconEl = btn.createSpan({ cls: "reminder-modal__quick-btn-icon" });
			setIcon(iconEl, preset.icon);
			const labelWrap = btn.createDiv({ cls: "reminder-modal__quick-btn-label-wrap" });
			labelWrap.createSpan({ cls: "reminder-modal__quick-btn-label", text: preset.label });
			labelWrap.createSpan({ cls: "reminder-modal__quick-btn-subtitle", text: preset.subtitle });
			setTooltip(btn, preset.description);

			btn.onclick = async () => {
				const reminder: Reminder = {
					id: `rem_${Date.now()}`,
					type: "relative",
					relatedTo: anchor,
					offset: preset.offset,
					description: preset.description,
					semanticType: preset.semanticType,
					...(preset.repeatIntervalHours ? { repeatIntervalHours: preset.repeatIntervalHours } : {}),
				};
				await this.addReminder(reminder);
				new Notice(`Added ${preset.description} reminder`);
			};
		}
	}

	private async addQuickReminder(
		anchor: string,
		offset: string,
		description: string
	): Promise<void> {
		const reminder: Reminder = {
			id: `rem_${Date.now()}`,
			type: "relative",
			relatedTo: anchor,
			offset,
			description,
		};

		await this.addReminder(reminder);
		new Notice(`Added reminder: ${description}`);
	}

	/**
	 * Collect timeline markers from this task's current reminders.
	 */
	private collectTaskReminderMarkers(): TimelineMarker[] {
		const markers: TimelineMarker[] = [];

		// Find anchor date for computing absolute reminder offsets
		const anchorDateStr = resolveAnchorDate(this.task, "due", this.plugin)
			|| resolveAnchorDate(this.task, "scheduled", this.plugin);
		const anchorDate = anchorDateStr ? new Date(anchorDateStr) : null;

		for (const rem of this.reminders) {
			if (rem.type === "relative" && rem.offset) {
				const parsed = parseISO8601Offset(rem.offset);
				const hours = normalizeToHours(parsed.value, parsed.unit);
				const sign = parsed.direction === "after" ? 1 : -1;
				const label = formatShortOffset(parsed.value, parsed.unit, parsed.direction);

				markers.push({
					label,
					offsetHours: hours * sign,
					source: "default",
					semanticType: rem.semanticType,
					repeatIntervalHours: rem.repeatIntervalHours,
					reminderId: rem.id,
				});
			} else if (rem.type === "absolute" && rem.absoluteTime && anchorDate) {
				const absDate = new Date(rem.absoluteTime);
				const diffHours = (absDate.getTime() - anchorDate.getTime()) / (1000 * 60 * 60);
				const label = absDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });

				markers.push({
					label,
					offsetHours: diffHours,
					source: "default",
					semanticType: rem.semanticType,
					reminderId: rem.id,
				});
			}
		}

		return markers;
	}

	/**
	 * Render a timeline preview showing the task's reminders visually.
	 */
	private renderTimelinePreview(container: HTMLElement): void {
		const cls = "tn-reminder-timeline-wrapper";
		let wrapper = container.querySelector(`:scope > .${cls}`) as HTMLElement;
		if (wrapper) {
			wrapper.empty();
		} else {
			wrapper = container.createDiv({ cls });
		}

		const timelineContainer = wrapper.createDiv("tn-reminder-timeline");

		// Header
		const header = timelineContainer.createDiv({ cls: "tn-reminder-timeline__header" });
		const iconEl = header.createSpan({ cls: "tn-reminder-timeline__header-icon" });
		setIcon(iconEl, "clock");
		header.createSpan({ text: "Reminder timeline", cls: "setting-item-name" });

		const markers = this.collectTaskReminderMarkers();

		if (markers.length === 0) {
			const emptyEl = timelineContainer.createDiv({ cls: "tn-reminder-timeline__empty" });
			emptyEl.textContent = "Add reminders to see them on the timeline";
		}

		renderTimelineArea(timelineContainer, markers, this.plugin, container);
	}

	private renderAddReminderForm(container: HTMLElement): void {
		// Find or create wrapper (preserves DOM position on re-renders)
		let section = container.querySelector(":scope > .reminder-modal__add-form-wrapper") as HTMLElement;
		if (section) {
			section.empty();
		} else {
			section = container.createDiv({ cls: "reminder-modal__add-form-wrapper reminder-modal__section" });
		}

		const sectionHeader = section.createDiv({ cls: "reminder-modal__section-header" });
		const isEditing = this.editingIndex !== null;
		sectionHeader.createEl("h3", { text: isEditing ? "Edit Reminder" : "Add New Reminder" });

		if (!isEditing) {
			const formHelp = sectionHeader.createSpan({ cls: "reminder-modal__help" });
			setIcon(formHelp, "help-circle");
			setTooltip(formHelp, "Relative reminders fire before/after a date property. Absolute reminders fire at a specific date and time. Quick presets are above the form.");
		}

		if (isEditing) {
			const cancelLink = sectionHeader.createEl("a", {
				text: "Cancel edit",
				cls: "reminder-modal__cancel-edit",
			});
			cancelLink.style.cssText = "cursor: pointer; color: var(--text-accent); font-size: 0.85em; margin-left: 8px;";
			cancelLink.onclick = () => this.cancelEditing();
		}

		// Add quick actions for common reminders (hide in edit mode)
		if (!isEditing) this.renderQuickActions(section);

		const form = section.createDiv({ cls: "reminder-modal__form" });

		// Compact type selector
		const typeSelector = form.createDiv({ cls: "reminder-modal__type-selector" });

		const relativeTab = typeSelector.createEl("button", {
			cls: "reminder-modal__type-tab reminder-modal__type-tab--active",
			text: "Relative",
			attr: { "data-type": "relative" },
		});

		const absoluteTab = typeSelector.createEl("button", {
			cls: "reminder-modal__type-tab",
			text: "Absolute",
			attr: { "data-type": "absolute" },
		});

		// Set initial state based on instance variables
		relativeTab.classList.toggle(
			"reminder-modal__type-tab--active",
			this.selectedType === "relative"
		);
		absoluteTab.classList.toggle(
			"reminder-modal__type-tab--active",
			this.selectedType === "absolute"
		);

		// Tab switching logic
		const switchToType = (type: "relative" | "absolute") => {
			this.selectedType = type;

			// Update tab appearance
			relativeTab.classList.toggle("reminder-modal__type-tab--active", type === "relative");
			absoluteTab.classList.toggle("reminder-modal__type-tab--active", type === "absolute");

			// Update form visibility
			this.updateFormVisibility(form, this.selectedType);
		};

		relativeTab.onclick = () => switchToType("relative");
		absoluteTab.onclick = () => switchToType("absolute");

		// Relative reminder fields
		const relativeContainer = form.createDiv({ cls: "relative-fields" });

		new Setting(relativeContainer)
			.setName("Time")
			.addText((text) => {
				text.setPlaceholder("15")
					.setValue(String(this.relativeOffset))
					.onChange((value) => {
						this.relativeOffset = parseInt(value) || 0;
					});
			})
			.addDropdown((dropdown) => {
				dropdown
					.addOption("minutes", "minutes")
					.addOption("hours", "hours")
					.addOption("days", "days")
					.setValue(this.relativeUnit)
					.onChange((value) => {
						this.relativeUnit = value as "minutes" | "hours" | "days";
					});
			});

		new Setting(relativeContainer).setName("Direction").addDropdown((dropdown) => {
			dropdown
				.addOption("before", "Before")
				.addOption("after", "After")
				.setValue(this.relativeDirection)
				.onChange((value) => {
					this.relativeDirection = value as "before" | "after";
				});
		});

		new Setting(relativeContainer).setName("Relative to").addDropdown((dropdown) => {
			const includeVaultWideForDropdown = !this.task.path || this.task.path.trim() === "";
			const anchors = getAvailableDateAnchors(this.plugin, this.task, {
				includeVaultWideDiscovery: includeVaultWideForDropdown && !this.itemPaths?.length,
				itemPaths: this.itemPaths,
			});

			// Group anchors by origin — only show core + promoted (settings)
			const coreAnchors = anchors.filter((a) => a.origin === "core");
			const settingsAnchors = anchors.filter((a) => a.origin === "settings");

			// Helper to format an anchor label with date value
			// Show raw key for non-core anchors so users see the actual property name
			const formatLabel = (anchor: typeof anchors[0]) => {
				const dateInfo = anchor.currentValue
					? ` (${formatDateForDisplay(anchor.currentValue)})`
					: " (not set)";
				const label = anchor.origin === "core" ? anchor.displayName : anchor.key;
				return `${label}${dateInfo}`;
			};

			// Add core anchors (always present)
			for (const anchor of coreAnchors) {
				dropdown.addOption(anchor.key, formatLabel(anchor));
			}

			// Add settings-defined (promoted) anchors with separator
			if (settingsAnchors.length > 0) {
				dropdown.addOption("__sep_global__", "\u2500\u2500 Global custom properties \u2500\u2500");
				for (const anchor of settingsAnchors) {
					dropdown.addOption(anchor.key, formatLabel(anchor));
				}
			}

			// Add discovered anchors (from task frontmatter or vault-wide)
			const discoveredAnchors = anchors.filter((a) => a.origin === "discovered");
			if (discoveredAnchors.length > 0) {
				dropdown.addOption("__sep_discovered__", "\u2500\u2500 Discovered \u2500\u2500");
				for (const anchor of discoveredAnchors) {
					dropdown.addOption(anchor.key, formatLabel(anchor));
				}
			}

			// Style separator and action options
			const selectEl = dropdown.selectEl;
			for (const opt of Array.from(selectEl.options)) {
				if (opt.value.startsWith("__sep_")) {
					opt.disabled = true;
					opt.style.fontWeight = "600";
					opt.style.color = "var(--text-muted)";
					opt.style.fontSize = "0.85em";
				}
			}

			// If the selected anchor (e.g., from PropertyPicker vault-wide search)
			// isn't already in the dropdown, add it so the selection isn't blank.
			const allKeys = anchors.map(a => a.key);
			if (this.relativeAnchor && !allKeys.includes(this.relativeAnchor)) {
				const fallbackLabel = this.relativeAnchor + " (selected)";
				dropdown.addOption("__sep_selected__", "── Selected ──");
				dropdown.addOption(this.relativeAnchor, fallbackLabel);
				// Style separator
				const selSep = selectEl.querySelector('option[value="__sep_selected__"]') as HTMLOptionElement | null;
				if (selSep) {
					selSep.disabled = true;
					selSep.style.fontWeight = "600";
					selSep.style.color = "var(--text-muted)";
					selSep.style.fontSize = "0.85em";
				}
			}

			dropdown.setValue(this.relativeAnchor);
			dropdown.onChange((value) => {
				this.relativeAnchor = value;
			});
		});

		// Expandable help text for anchor date groupings (placed after "Relative to" dropdown)
		const anchorHelp = relativeContainer.createEl("details", { cls: "reminder-modal__help-text" });
		anchorHelp.createEl("summary", { text: "What are these date groups?" });
		const anchorHelpBody = anchorHelp.createDiv();
		anchorHelpBody.innerHTML = [
			"<strong>Core</strong> \u2014 Built-in properties (Due, Scheduled, etc.). Always available on every task.",
			"",
			"<strong>Global custom properties</strong> \u2014 Properties you\u2019ve configured in Settings \u2192 Task Properties. Available vault-wide: used by global reminders, appear in task creation/edit modals, and support NLP triggers.",
			"",
			"<strong>Discovered</strong> \u2014 Properties found on <em>this</em> task that aren\u2019t configured globally. Use \u201CPromote\u201D to make them global, or \u201CUse \u2192\u201D for a quick one-off reminder anchor.",
			"",
			"<em>Tip:</em> Promoting a property is reversible \u2014 use \u201CDemote\u201D to remove it from global fields. Task data is always preserved.",
		].join("<br>");

		// Absolute reminder fields
		const absoluteContainer = form.createDiv({ cls: "absolute-fields" });

		new Setting(absoluteContainer).setName("Date").addText((text) => {
			text.setPlaceholder("YYYY-MM-DD")
				.setValue(this.absoluteDate)
				.onChange((value) => {
					this.absoluteDate = value;
				});
			text.inputEl.type = "date";
		});

		new Setting(absoluteContainer).setName("Time").addText((text) => {
			text.setPlaceholder("HH:MM")
				.setValue(this.absoluteTime)
				.onChange((value) => {
					this.absoluteTime = value;
				});
			text.inputEl.type = "time";
		});

		// Description field (common)
		new Setting(form).setName("Description (optional)").addText((text) => {
			text.setPlaceholder("Custom reminder message")
				.setValue(this.description)
				.onChange((value) => {
					this.description = value;
				});
		});

		// Add/Update button with icon
		const actionBtn = form.createEl("button", {
			cls: isEditing ? "reminder-add-btn reminder-add-btn--edit" : "reminder-add-btn",
		});

		const actionIcon = actionBtn.createSpan({ cls: "reminder-add-btn-icon" });
		setIcon(actionIcon, isEditing ? "check" : "plus");
		actionBtn.createSpan({
			cls: "reminder-add-btn-text",
			text: isEditing ? "Update Reminder" : "Add Reminder",
		});
		actionBtn.onclick = async () => {
			// Add loading state
			actionBtn.disabled = true;
			actionBtn.classList.add("reminder-add-btn--loading");

			try {
				const newReminder = this.createReminder(
					this.selectedType,
					this.relativeAnchor,
					this.relativeOffset,
					this.relativeUnit,
					this.relativeDirection,
					this.absoluteDate,
					this.absoluteTime,
					this.description
				);

				if (newReminder) {
					if (isEditing && this.editingIndex !== null) {
						// Update existing reminder in-place, preserving the original ID
						newReminder.id = this.reminders[this.editingIndex].id;
						this.reminders[this.editingIndex] = newReminder;
						this.editingIndex = null;

						// Reset form to add mode
						this.selectedType = "relative";
						this.relativeOffset = 15;
						this.relativeUnit = "minutes";
						this.relativeDirection = "before";
						this.relativeAnchor = "due";
						this.absoluteDate = "";
						this.absoluteTime = "";
						this.description = "";

						// Re-render form (exits edit mode) and refresh list
						const contentContainer = this.contentEl.querySelector(".reminder-modal__content") as HTMLElement;
						if (contentContainer) {
							this.renderAddReminderForm(contentContainer);
							this.refreshRemindersListOnly();
						}
						this.updateSaveButtonState();

						new Notice("Reminder updated");
					} else {
						await this.addReminder(newReminder);

						// Reset form values for next reminder
						if (this.selectedType === "relative") {
							this.relativeOffset = 15;
							this.relativeUnit = "minutes";
							this.description = "";
						} else {
							this.absoluteDate = "";
							this.absoluteTime = "";
							this.description = "";
						}

						// Reset the form inputs to match the instance variables
						this.resetFormInputs(form);
					}
				}
			} catch (error) {
				console.error("Error adding reminder:", error);
				new Notice("Failed to add reminder. Please check your inputs.");
			} finally {
				// Remove loading state
				actionBtn.disabled = false;
				actionBtn.classList.remove("reminder-add-btn--loading");
			}
		};

		// Set initial form visibility
		this.updateFormVisibility(form, this.selectedType);
	}

	private updateFormVisibility(form: HTMLElement, type: "absolute" | "relative"): void {
		const relativeFields = form.querySelector(".relative-fields") as HTMLElement;
		const absoluteFields = form.querySelector(".absolute-fields") as HTMLElement;

		if (type === "relative") {
			relativeFields.style.display = "block";
			absoluteFields.style.display = "none";
		} else {
			relativeFields.style.display = "none";
			absoluteFields.style.display = "block";
		}
	}

	private createReminder(
		type: "absolute" | "relative",
		anchor: string,
		offset: number,
		unit: "minutes" | "hours" | "days",
		direction: "before" | "after",
		date: string,
		time: string,
		description: string
	): Reminder | null {
		const id = `rem_${Date.now()}`;

		if (type === "relative") {
			// Warn if anchor date doesn't exist yet (e.g., bulk task creation)
			const anchorDate = resolveAnchorDate(this.task, anchor, this.plugin);
			if (!anchorDate) {
				const anchorName = getAnchorDisplayName(anchor, this.plugin);
				new Notice(`Note: "${anchorName}" is not set yet. Reminder will activate when the date is added.`);
			}

			// Convert offset to ISO 8601 duration
			let duration = "PT";
			if (unit === "days") {
				duration = `P${offset}D`;
			} else if (unit === "hours") {
				duration = `PT${offset}H`;
			} else {
				duration = `PT${offset}M`;
			}

			// Add negative sign for "before"
			if (direction === "before") {
				duration = "-" + duration;
			}

			return {
				id,
				type: "relative",
				relatedTo: anchor,
				offset: duration,
				description: description || undefined,
			};
		} else {
			// Absolute reminder
			if (!date || !time) {
				new Notice("Please specify both date and time for absolute reminder");
				return null;
			}

			const absoluteTime = `${date}T${time}:00`;

			return {
				id,
				type: "absolute",
				absoluteTime,
				description: description || undefined,
			};
		}
	}

	private formatReminderTiming(reminder: Reminder): string {
		if (reminder.type === "absolute") {
			return "Absolute reminder";
		} else {
			const anchor = getAnchorDisplayName(reminder.relatedTo || "due", this.plugin).toLowerCase();
			const offset = this.formatOffset(reminder.offset || "");
			return `${offset} ${anchor}`;
		}
	}

	private formatReminderDetails(reminder: Reminder): string {
		if (reminder.type === "absolute") {
			return `At ${formatDateForDisplay(reminder.absoluteTime || "")}`;
		} else {
			const anchor = reminder.relatedTo === "due" ? this.task.due : this.task.scheduled;
			if (!anchor) {
				return `Relative to ${reminder.relatedTo} date (not set)`;
			}
			return `When ${reminder.relatedTo} date is ${formatDateForDisplay(anchor)}`;
		}
	}

	private formatReminderDescription(reminder: Reminder): string {
		if (reminder.description) {
			return reminder.description;
		}

		if (reminder.type === "absolute") {
			return `At ${formatDateForDisplay(reminder.absoluteTime || "")}`;
		} else {
			const anchor = getAnchorDisplayName(reminder.relatedTo || "due", this.plugin).toLowerCase();
			const offset = this.formatOffset(reminder.offset || "");
			return `${offset} ${anchor}`;
		}
	}

	private formatOffset(offset: string): string {
		const isNegative = offset.startsWith("-");
		const cleanOffset = isNegative ? offset.substring(1) : offset;

		const match = cleanOffset.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/);
		if (!match) return offset;

		const [, days, hours, minutes] = match;

		let parts: string[] = [];
		if (days) parts.push(`${days} day${days !== "1" ? "s" : ""}`);
		if (hours) parts.push(`${hours} hour${hours !== "1" ? "s" : ""}`);
		if (minutes) parts.push(`${minutes} minute${minutes !== "1" ? "s" : ""}`);

		if (parts.length === 0) {
			return "At time of";
		}

		const formatted = parts.join(" ");
		return isNegative ? `${formatted} before` : `${formatted} after`;
	}

	private isDuplicateReminder(newReminder: Reminder): boolean {
		return this.reminders.some(existing => {
			if (existing.type !== newReminder.type) return false;
			if (newReminder.type === "relative") {
				return existing.relatedTo === newReminder.relatedTo
					&& existing.offset === newReminder.offset;
			} else {
				return existing.absoluteTime === newReminder.absoluteTime;
			}
		});
	}

	private async addReminder(reminder: Reminder): Promise<void> {
		if (this.isDuplicateReminder(reminder)) {
			new Notice("This reminder already exists");
			return;
		}
		this.reminders.push(reminder);
		this.refreshRemindersListOnly();

		// Emit immediate event for live UI updates (optional, for real-time feedback)
		if (this.task.path) {
			this.plugin.emitter.trigger("reminder-preview-changed", {
				taskPath: this.task.path,
				currentReminders: [...this.reminders],
				action: "added",
				reminder: reminder,
			});
		}
	}

	private async removeReminder(index: number): Promise<void> {
		const removedReminder = this.reminders[index];
		this.reminders.splice(index, 1);
		this.refreshRemindersListOnly();

		// Emit immediate event for live UI updates (optional, for real-time feedback)
		if (this.task.path && removedReminder) {
			this.plugin.emitter.trigger("reminder-preview-changed", {
				taskPath: this.task.path,
				currentReminders: [...this.reminders],
				action: "removed",
				reminder: removedReminder,
			});
		}
	}

	private startEditingReminder(index: number): void {
		const reminder = this.reminders[index];
		if (!reminder) return;

		this.editingIndex = index;

		// Populate form state from the reminder
		if (reminder.type === "relative") {
			this.selectedType = "relative";
			this.relativeAnchor = reminder.relatedTo || "due";
			this.description = reminder.description || "";

			// Parse ISO 8601 offset back into value/unit/direction
			if (reminder.offset) {
				const parsed = parseISO8601Offset(reminder.offset);
				this.relativeOffset = parsed.value;
				this.relativeUnit = parsed.unit as "minutes" | "hours" | "days";
				this.relativeDirection = parsed.direction as "before" | "after";
			} else {
				this.relativeOffset = 15;
				this.relativeUnit = "minutes";
				this.relativeDirection = "before";
			}
		} else {
			this.selectedType = "absolute";
			this.description = reminder.description || "";

			// Parse absoluteTime (ISO 8601 timestamp) into date and time parts
			if (reminder.absoluteTime) {
				const dt = new Date(reminder.absoluteTime);
				if (!isNaN(dt.getTime())) {
					this.absoluteDate = dt.toISOString().slice(0, 10);
					this.absoluteTime = dt.toISOString().slice(11, 16);
				} else {
					this.absoluteDate = "";
					this.absoluteTime = "";
				}
			} else {
				this.absoluteDate = "";
				this.absoluteTime = "";
			}
		}

		// Re-render the form section to reflect edit state, then scroll to it
		const contentContainer = this.contentEl.querySelector(".reminder-modal__content") as HTMLElement;
		if (contentContainer) {
			this.renderAddReminderForm(contentContainer);

			// Highlight the card being edited
			this.refreshRemindersListOnly();

			// Scroll to the form
			const formWrapper = contentContainer.querySelector(".reminder-modal__add-form-wrapper");
			if (formWrapper) {
				setTimeout(() => {
					formWrapper.scrollIntoView({ behavior: "smooth", block: "center" });
				}, 100);
			}
		}
	}

	private cancelEditing(): void {
		this.editingIndex = null;

		// Reset form to defaults
		this.selectedType = "relative";
		this.relativeOffset = 15;
		this.relativeUnit = "minutes";
		this.relativeDirection = "before";
		this.relativeAnchor = "due";
		this.absoluteDate = "";
		this.absoluteTime = "";
		this.description = "";

		// Re-render to exit edit mode
		const contentContainer = this.contentEl.querySelector(".reminder-modal__content") as HTMLElement;
		if (contentContainer) {
			this.renderAddReminderForm(contentContainer);
			this.refreshRemindersListOnly();
		}
	}

	private async refresh(): Promise<void> {
		await this.initializeWithFreshData();
	}

	private refreshRemindersListOnly(): void {
		// Only refresh the existing reminders section, not the entire modal
		const contentContainer = this.contentEl.querySelector(".reminder-modal__content");
		if (contentContainer) {
			// Find and remove existing reminders section
			const existingRemindersSection = contentContainer.querySelector(
				".reminder-modal__section"
			);
			if (existingRemindersSection) {
				existingRemindersSection.remove();
			}

			// Re-render only the existing reminders section at the top
			const tempContainer = document.createElement("div");
			this.renderExistingReminders(tempContainer);
			const newRemindersSection = tempContainer.firstChild as HTMLElement;
			if (newRemindersSection) {
				contentContainer.insertBefore(newRemindersSection, contentContainer.firstChild);
			}

			// Refresh timeline preview
			this.renderTimelinePreview(contentContainer as HTMLElement);
		}

		this.updateSaveButtonState();
	}

	private resetFormInputs(form: HTMLElement): void {
		// Update text inputs to match instance variables
		const timeInput = form.querySelector('input[placeholder="15"]') as HTMLInputElement;
		if (timeInput) timeInput.value = String(this.relativeOffset);

		const descInput = form.querySelector(
			'input[placeholder="Custom reminder message"]'
		) as HTMLInputElement;
		if (descInput) descInput.value = this.description;

		const dateInput = form.querySelector('input[type="date"]') as HTMLInputElement;
		if (dateInput) dateInput.value = this.absoluteDate;

		const timeAbsInput = form.querySelector('input[type="time"]') as HTMLInputElement;
		if (timeAbsInput) timeAbsInput.value = this.absoluteTime;

		// Update dropdowns to match instance variables
		const unitDropdown = form.querySelector(
			'.setting-item:has(input[placeholder="15"]) select'
		) as HTMLSelectElement;
		if (unitDropdown) unitDropdown.value = this.relativeUnit;

		const directionDropdown = form.querySelector(
			".setting-item:nth-child(2) select"
		) as HTMLSelectElement;
		if (directionDropdown) directionDropdown.value = this.relativeDirection;

		const anchorDropdown = form.querySelector(
			".setting-item:nth-child(3) select"
		) as HTMLSelectElement;
		if (anchorDropdown) anchorDropdown.value = this.relativeAnchor;
	}

	private async save(): Promise<void> {
		this.saveBtn.disabled = true;
		this.saveBtn.textContent = "Saving...";

		try {
			// Clear processed reminders for this task so they can trigger again if needed
			if (this.task.path && this.task.path.trim() !== "") {
				this.plugin.notificationService?.clearProcessedRemindersForTask(this.task.path);
			}

			// Check if reminders have actually changed
			const hasChanges = this.remindersHaveChanged();

			// Always call onSave to maintain existing behavior, but indicate if changes occurred
			this.onSave(this.reminders);

			// Emit a custom event to notify about reminder changes for immediate UI updates
			if (hasChanges && this.task.path) {
				this.plugin.emitter.trigger("reminder-changed", {
					taskPath: this.task.path,
					oldReminders: this.originalReminders,
					newReminders: [...this.reminders],
				});
			}

			this.close();
		} catch (error) {
			console.error("Failed to save reminders:", error);
			new Notice("Failed to save reminders. Please try again.");
			this.saveBtn.disabled = false;
			this.saveBtn.textContent = "Save Changes";
		}
	}

	private cancel(): void {
		// Emit cancellation event to reset any preview changes
		if (this.remindersHaveChanged() && this.task.path) {
			this.plugin.emitter.trigger("reminder-preview-changed", {
				taskPath: this.task.path,
				currentReminders: [...this.originalReminders],
				action: "cancelled",
			});
		}

		this.close();
	}

	private remindersHaveChanged(): boolean {
		// Quick reference check first
		if (this.reminders.length !== this.originalReminders.length) {
			return true;
		}

		// Deep comparison of reminder arrays
		return !this.reminders.every((reminder, index) => {
			const original = this.originalReminders[index];
			if (!original) return false;

			return (
				reminder.id === original.id &&
				reminder.type === original.type &&
				reminder.relatedTo === original.relatedTo &&
				reminder.offset === original.offset &&
				reminder.absoluteTime === original.absoluteTime &&
				reminder.description === original.description
			);
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
