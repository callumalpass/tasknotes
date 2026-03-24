import { setIcon, setTooltip, Notice } from "obsidian";
import TaskNotesPlugin from "../../../main";
import { migratePropertyName } from "../../../utils/settingsMigration";
import { DefaultReminder, GlobalReminderRule, UserMappedField } from "../../../types/settings";
import { getAvailableDateAnchors, getAnchorDisplayName, type DateAnchor } from "../../../utils/dateAnchorUtils";
import {
	type TimelineMarker,
	normalizeToHours,
	formatShortOffset,
	renderTimelineArea,
	scrollToReminderCard,
} from "../../../utils/reminderTimelineUtils";
import { formatDateForDisplay } from "../../../utils/dateUtils";
import { createPropertyPicker } from "../../../ui/PropertyPicker";
import { getAllTaskFilePaths, convertPropertyType, type PropertyType } from "../../../utils/propertyDiscoveryUtils";
import type { TranslationKey } from "../../../i18n";
import {
	createCard,
	createCardInput,
	createDeleteHeaderButton,
	showCardEmptyState,
	createCardNumberInput,
	createCardSelect,
	CardRow,
} from "../../components/CardComponent";
import { createPropertyDescription, TranslateFn } from "./helpers";
import { initializeFieldConfig } from "../../../utils/fieldConfigDefaults";

// Transient state: tracks recently demoted keys for "Undo" affordance (resets on settings reopen)
const recentlyDemotedKeys = new Set<string>();

/**
 * Renders the Reminders property card with nested default reminders
 */
export function renderRemindersPropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn
): void {
	const propertyKeyInput = createCardInput(
		"text",
		"reminders",
		plugin.settings.fieldMapping.reminders
	);

	propertyKeyInput.addEventListener("change", async () => {
		const newValue = propertyKeyInput.value.trim();
		const oldValue = plugin.settings.fieldMapping.reminders;
		if (newValue && newValue !== oldValue) {
			const result = await migratePropertyName({
				app: plugin.app, plugin, oldPropertyName: oldValue, newPropertyName: newValue, description: "task files",
			});
			if (result === "cancelled") { propertyKeyInput.value = oldValue; return; }
		}
		plugin.settings.fieldMapping.reminders = newValue || oldValue;
		save();
		const secondary = propertyKeyInput.closest("[data-card-id]")?.querySelector(".tasknotes-settings__card-secondary-text");
		if (secondary) secondary.textContent = plugin.settings.fieldMapping.reminders;
	});

	// Create nested content for default reminders
	const nestedContainer = document.createElement("div");
	nestedContainer.addClass("tasknotes-settings__nested-cards");

	// Timeline preview — placed above both sections
	const timelineContainer = nestedContainer.createDiv("tn-reminder-timeline");
	let timelineDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	const refreshTimeline = () => {
		if (timelineDebounceTimer) clearTimeout(timelineDebounceTimer);
		timelineDebounceTimer = setTimeout(() => renderReminderTimeline(timelineContainer, plugin, nestedContainer), 300);
	};
	// Initial render (no debounce)
	renderReminderTimeline(timelineContainer, plugin, nestedContainer);

	// ── Snapshots for reset functionality ──
	const defaultRemindersSnapshot = JSON.parse(
		JSON.stringify(plugin.settings.taskCreationDefaults.defaultReminders || [])
	);
	const globalRulesSnapshot = JSON.parse(
		JSON.stringify(plugin.settings.globalReminderRules || [])
	);

	// Save wrapper that tracks changes for reset buttons
	let defaultResetBtn: HTMLButtonElement | null = null;
	let globalResetBtn: HTMLButtonElement | null = null;
	const trackChanges = () => {
		if (defaultResetBtn) {
			const changed = JSON.stringify(plugin.settings.taskCreationDefaults.defaultReminders || [])
				!== JSON.stringify(defaultRemindersSnapshot);
			defaultResetBtn.disabled = !changed;
		}
		if (globalResetBtn) {
			const changed = JSON.stringify(plugin.settings.globalReminderRules || [])
				!== JSON.stringify(globalRulesSnapshot);
			globalResetBtn.disabled = !changed;
		}
	};
	const saveAndTrack = () => { save(); trackChanges(); };

	// ── Available date properties reference section (also shown at top-level in Date Properties) ──
	renderDatePropertiesReference(nestedContainer, plugin);

	// Create collapsible section for default reminders
	const remindersSection = nestedContainer.createDiv("tasknotes-settings__collapsible-section tn-reminders-section tn-reminders-section--default");

	const remindersHeader = remindersSection.createDiv("tasknotes-settings__collapsible-section-header");
	remindersHeader.createSpan({ text: translate("settings.taskProperties.remindersCard.defaultReminders"), cls: "tasknotes-settings__collapsible-section-title" });
	const chevron = remindersHeader.createSpan("tasknotes-settings__collapsible-section-chevron");
	chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

	const remindersContent = remindersSection.createDiv("tasknotes-settings__collapsible-section-content");

	const defaultDesc = remindersContent.createEl("p", {
		text: "Pre-configured reminders added automatically to every new task. Written to each task's frontmatter at creation time.",
		cls: "setting-item-description",
	});
	defaultDesc.style.cssText = "margin: 0 0 0.5rem 0; font-size: var(--font-ui-smaller); color: var(--text-muted);";

	// Render reminder cards
	const remindersListContainer = remindersContent.createDiv("tasknotes-reminders-container");
	renderRemindersList(remindersListContainer, plugin, saveAndTrack, translate, refreshTimeline);

	// Button row for add + reset
	const defaultButtonRow = remindersContent.createDiv();
	defaultButtonRow.style.cssText = "margin-top: 0.5rem; display: flex; align-items: center; gap: 8px;";

	// Add reminder button
	const addReminderButton = defaultButtonRow.createEl("button", {
		cls: "tn-btn tn-btn--ghost",
	});
	addReminderButton.style.cssText = "display: inline-flex; align-items: center; gap: 4px;";
	const addReminderIcon = addReminderButton.createSpan();
	addReminderIcon.style.cssText = "display: inline-flex; width: 16px; height: 16px;";
	setIcon(addReminderIcon, "plus");
	addReminderButton.createSpan({ text: translate("settings.defaults.reminders.addReminder.buttonText") });
	addReminderButton.onclick = () => {
		const newId = `reminder_${Date.now()}`;
		const newReminder = {
			id: newId,
			type: "relative" as const,
			relatedTo: "due" as const,
			offset: 1,
			unit: "hours" as const,
			direction: "before" as const,
			description: "Reminder",
		};
		plugin.settings.taskCreationDefaults.defaultReminders =
			plugin.settings.taskCreationDefaults.defaultReminders || [];
		plugin.settings.taskCreationDefaults.defaultReminders.push(newReminder);
		saveAndTrack();
		renderRemindersList(remindersListContainer, plugin, saveAndTrack, translate, refreshTimeline);
		refreshTimeline();
	};

	// Reset button for default reminders
	defaultResetBtn = defaultButtonRow.createEl("button", {
		cls: "tn-btn tn-btn--ghost",
		text: "Undo changes",
	});
	defaultResetBtn.style.cssText = "display: inline-flex; align-items: center; gap: 4px; color: var(--text-warning);";
	defaultResetBtn.disabled = true;
	setTooltip(defaultResetBtn, "Revert to the state when settings were opened");
	defaultResetBtn.onclick = () => {
		plugin.settings.taskCreationDefaults.defaultReminders = JSON.parse(JSON.stringify(defaultRemindersSnapshot));
		saveAndTrack();
		renderRemindersList(remindersListContainer, plugin, saveAndTrack, translate, refreshTimeline);
		refreshTimeline();
	};

	// Auto-save note
	const defaultAutoSaveNote = defaultButtonRow.createEl("span");
	defaultAutoSaveNote.style.cssText = "font-size: var(--font-ui-smaller); color: var(--text-faint); margin-left: auto;";
	defaultAutoSaveNote.textContent = "Changes save automatically";

	// Toggle collapse
	remindersHeader.addEventListener("click", () => {
		remindersSection.toggleClass("tasknotes-settings__collapsible-section--collapsed",
			!remindersSection.hasClass("tasknotes-settings__collapsible-section--collapsed"));
	});

	// --- Global reminders section ---
	const globalSection = nestedContainer.createDiv("tasknotes-settings__collapsible-section tn-reminders-section tn-reminders-section--global");

	const globalHeader = globalSection.createDiv("tasknotes-settings__collapsible-section-header");
	globalHeader.createSpan({ text: "Global reminders (all tasks)", cls: "tasknotes-settings__collapsible-section-title" });
	const globalChevron = globalHeader.createSpan("tasknotes-settings__collapsible-section-chevron");
	globalChevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

	const globalContent = globalSection.createDiv("tasknotes-settings__collapsible-section-content");

	const globalDesc = globalContent.createEl("p", {
		text: "Applied to all tasks with matching date fields. Evaluated at notification check time, never written to task files. Useful for vault-wide lead-time or overdue notifications.",
		cls: "setting-item-description",
	});
	globalDesc.style.cssText = "margin: 0 0 0.5rem 0; font-size: var(--font-ui-smaller); color: var(--text-muted);";

	// Cross-link to Features > Notifications
	const notifLinkPara = globalContent.createEl("p", {
		cls: "setting-item-description",
	});
	notifLinkPara.style.cssText = "margin: 0 0 0.5rem 0; font-size: var(--font-ui-smaller);";
	notifLinkPara.appendText("Configure notification delivery and behavior in ");
	const notifLink = notifLinkPara.createEl("a", {
		text: "Features \u2192 Notifications \u2192",
		href: "#",
	});
	notifLink.style.cssText = "cursor: pointer; color: var(--text-accent);";
	notifLink.addEventListener("click", (e) => {
		e.preventDefault();
		navigateToFeatureNotifications(plugin);
	});

	// Cross-link to Team & Attribution > Person preferences
	const personLinkPara = globalContent.createEl("p", {
		cls: "setting-item-description",
	});
	personLinkPara.style.cssText = "margin: 0 0 0.5rem 0; font-size: var(--font-ui-smaller);";
	personLinkPara.appendText("Per-person overrides are available in ");
	const personLink = personLinkPara.createEl("a", {
		text: "Team & Attribution \u2192 Person preferences",
		href: "#",
	});
	personLink.style.cssText = "cursor: pointer; color: var(--text-accent);";
	personLink.addEventListener("click", (e) => {
		e.preventDefault();
		navigateToTeamAttribution(plugin);
	});

	const globalListContainer = globalContent.createDiv("tasknotes-reminders-container");
	renderGlobalRemindersList(globalListContainer, plugin, saveAndTrack, translate, refreshTimeline);

	// Button row for add + reset
	const globalButtonRow = globalContent.createDiv();
	globalButtonRow.style.cssText = "margin-top: 0.5rem; display: flex; align-items: center; gap: 8px;";

	const addGlobalButton = globalButtonRow.createEl("button", {
		cls: "tn-btn tn-btn--ghost",
	});
	addGlobalButton.style.cssText = "display: inline-flex; align-items: center; gap: 4px;";
	const addGlobalIcon = addGlobalButton.createSpan();
	addGlobalIcon.style.cssText = "display: inline-flex; width: 16px; height: 16px;";
	setIcon(addGlobalIcon, "plus");
	addGlobalButton.createSpan({ text: "Add global reminder" });
	addGlobalButton.onclick = () => {
		const newRule: GlobalReminderRule = {
			id: `global_${Date.now()}`,
			enabled: true,
			semanticType: "lead-time",
			description: "New reminder",
			anchorProperty: "due",
			offset: "-P1D",
			skipIfExplicitExists: true,
		};
		plugin.settings.globalReminderRules = plugin.settings.globalReminderRules || [];
		plugin.settings.globalReminderRules.push(newRule);
		saveAndTrack();
		renderGlobalRemindersList(globalListContainer, plugin, saveAndTrack, translate, refreshTimeline);
		refreshTimeline();
	};

	// Reset button for global reminders
	globalResetBtn = globalButtonRow.createEl("button", {
		cls: "tn-btn tn-btn--ghost",
		text: "Undo changes",
	});
	globalResetBtn.style.cssText = "display: inline-flex; align-items: center; gap: 4px; color: var(--text-warning);";
	globalResetBtn.disabled = true;
	setTooltip(globalResetBtn, "Revert to the state when settings were opened");
	globalResetBtn.onclick = () => {
		plugin.settings.globalReminderRules = JSON.parse(JSON.stringify(globalRulesSnapshot));
		saveAndTrack();
		renderGlobalRemindersList(globalListContainer, plugin, saveAndTrack, translate, refreshTimeline);
		refreshTimeline();
	};

	// Auto-save note
	const globalAutoSaveNote = globalButtonRow.createEl("span");
	globalAutoSaveNote.style.cssText = "font-size: var(--font-ui-smaller); color: var(--text-faint); margin-left: auto;";
	globalAutoSaveNote.textContent = "Changes save automatically";

	globalHeader.addEventListener("click", () => {
		globalSection.toggleClass("tasknotes-settings__collapsible-section--collapsed",
			!globalSection.hasClass("tasknotes-settings__collapsible-section--collapsed"));
	});

	// Create description element
	const descriptionEl = createPropertyDescription(
		translate("settings.taskProperties.properties.reminders.description")
	);

	const rows: CardRow[] = [
		{ label: "", input: descriptionEl, fullWidth: true },
		{ label: translate("settings.taskProperties.propertyCard.propertyKey"), input: propertyKeyInput },
		{ label: "", input: nestedContainer, fullWidth: true },
	];

	createCard(container, {
		id: "property-reminders",
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: translate("settings.taskProperties.properties.reminders.name"),
			secondaryText: plugin.settings.fieldMapping.reminders,
		},
		content: {
			sections: [{ rows }],
		},
	});
}

/**
 * Renders the list of default reminder cards
 */
function renderRemindersList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn,
	onTimelineRefresh?: () => void
): void {
	container.empty();

	if (
		!plugin.settings.taskCreationDefaults.defaultReminders ||
		plugin.settings.taskCreationDefaults.defaultReminders.length === 0
	) {
		showCardEmptyState(
			container,
			translate("settings.defaults.reminders.emptyState")
		);
		return;
	}

	plugin.settings.taskCreationDefaults.defaultReminders.forEach((reminder, index) => {
		const timingText = formatReminderTiming(reminder, translate, plugin);

		const descInput = createCardInput(
			"text",
			translate("settings.defaults.reminders.reminderDescription"),
			reminder.description
		);

		const typeSelect = createCardSelect(
			[
				{
					value: "relative",
					label: translate("settings.defaults.reminders.types.relative"),
				},
				{
					value: "absolute",
					label: translate("settings.defaults.reminders.types.absolute"),
				},
			],
			reminder.type
		);

		const updateCallback = (updates: Partial<DefaultReminder>) => {
			Object.assign(reminder, updates);
			save();
			onTimelineRefresh?.();
			const card = container.querySelector(`[data-card-id="${reminder.id}"]`);
			if (card) {
				const secondaryText = card.querySelector(
					".tasknotes-settings__card-secondary-text"
				);
				if (secondaryText) {
					secondaryText.textContent = formatReminderTiming(reminder, translate, plugin);
				}
			}
		};

		const configRows =
			reminder.type === "relative"
				? renderRelativeReminderConfig(reminder, updateCallback, translate, plugin)
				: renderAbsoluteReminderConfig(reminder, updateCallback, translate);

		const card = createCard(container, {
			id: reminder.id,
			collapsible: true,
			defaultCollapsed: true,
			header: {
				primaryText:
					reminder.description ||
					translate("settings.defaults.reminders.unnamedReminder"),
				secondaryText: timingText,
				actions: [
					createDeleteHeaderButton(() => {
						plugin.settings.taskCreationDefaults.defaultReminders.splice(index, 1);
						save();
						onTimelineRefresh?.();
						renderRemindersList(container, plugin, save, translate, onTimelineRefresh);
					}, translate("settings.defaults.reminders.deleteTooltip")),
				],
			},
			content: {
				sections: [
					{
						rows: [
							{
								label: translate("settings.defaults.reminders.fields.description"),
								input: descInput,
							},
							{
								label: translate("settings.defaults.reminders.fields.type"),
								input: typeSelect,
							},
						],
					},
					{
						rows: configRows,
					},
				],
			},
		});

		descInput.addEventListener("input", () => {
			reminder.description = descInput.value;
			save();
			const primaryText = card.querySelector(".tasknotes-settings__card-primary-text");
			if (primaryText) {
				primaryText.textContent =
					reminder.description ||
					translate("settings.defaults.reminders.unnamedReminder");
			}
		});

		typeSelect.addEventListener("change", () => {
			reminder.type = typeSelect.value as "relative" | "absolute";
			save();
			onTimelineRefresh?.();
			renderRemindersList(container, plugin, save, translate, onTimelineRefresh);
		});
	});
}

function renderRelativeReminderConfig(
	reminder: DefaultReminder,
	updateItem: (updates: Partial<DefaultReminder>) => void,
	translate: TranslateFn,
	plugin: TaskNotesPlugin
): CardRow[] {
	const offsetInput = createCardNumberInput(0, undefined, 1, reminder.offset);
	offsetInput.addEventListener("input", () => {
		const offset = parseInt(offsetInput.value);
		if (!isNaN(offset) && offset >= 0) {
			updateItem({ offset });
		}
	});

	const unitSelect = createCardSelect(
		[
			{ value: "minutes", label: translate("settings.defaults.reminders.units.minutes") },
			{ value: "hours", label: translate("settings.defaults.reminders.units.hours") },
			{ value: "days", label: translate("settings.defaults.reminders.units.days") },
		],
		reminder.unit
	);
	unitSelect.addEventListener("change", () => {
		updateItem({ unit: unitSelect.value as "minutes" | "hours" | "days" });
	});

	const directionSelect = createCardSelect(
		[
			{ value: "before", label: translate("settings.defaults.reminders.directions.before") },
			{ value: "after", label: translate("settings.defaults.reminders.directions.after") },
		],
		reminder.direction
	);
	directionSelect.addEventListener("change", () => {
		updateItem({ direction: directionSelect.value as "before" | "after" });
	});

	const anchors = getAvailableDateAnchors(plugin, undefined, { includeVaultWideDiscovery: true });
	const anchorOptions = buildAnchorOptionsWithSeparators(anchors);
	const relatedToSelect = createCardSelect(anchorOptions, reminder.relatedTo);
	disableSeparatorOptions(relatedToSelect);
	relatedToSelect.addEventListener("change", () => {
		if (relatedToSelect.value === "__action_discover__") {
			relatedToSelect.value = reminder.relatedTo ?? "due";
			const wrapper = relatedToSelect.closest(".tasknotes-settings__nested-cards")
				?? relatedToSelect.closest(".tasknotes-settings__card-body");
			const dateProps = wrapper?.querySelector("details.tn-date-props") as HTMLDetailsElement | null;
			if (dateProps) {
				dateProps.open = true;
				dateProps.scrollIntoView({ behavior: "smooth", block: "start" });
			}
			return;
		}
		updateItem({ relatedTo: relatedToSelect.value });
	});

	return [
		{ label: translate("settings.defaults.reminders.fields.offset"), input: offsetInput },
		{ label: translate("settings.defaults.reminders.fields.unit"), input: unitSelect },
		{
			label: translate("settings.defaults.reminders.fields.direction"),
			input: directionSelect,
		},
		{
			label: translate("settings.defaults.reminders.fields.relatedTo"),
			input: relatedToSelect,
		},
	];
}

function renderAbsoluteReminderConfig(
	reminder: DefaultReminder,
	updateItem: (updates: Partial<DefaultReminder>) => void,
	translate: TranslateFn
): CardRow[] {
	const dateInput = createCardInput(
		"date",
		reminder.absoluteDate || new Date().toISOString().split("T")[0]
	);
	dateInput.addEventListener("input", () => {
		updateItem({ absoluteDate: dateInput.value });
	});

	const timeInput = createCardInput("time", reminder.absoluteTime || "09:00");
	timeInput.addEventListener("input", () => {
		updateItem({ absoluteTime: timeInput.value });
	});

	return [
		{ label: translate("settings.defaults.reminders.fields.date"), input: dateInput },
		{ label: translate("settings.defaults.reminders.fields.time"), input: timeInput },
	];
}

function formatReminderTiming(
	reminder: DefaultReminder,
	translate: TranslateFn,
	plugin: TaskNotesPlugin
): string {
	if (reminder.type === "relative") {
		const direction =
			reminder.direction === "before"
				? translate("settings.defaults.reminders.directions.before")
				: translate("settings.defaults.reminders.directions.after");
		const unit = translate(
			`settings.defaults.reminders.units.${reminder.unit || "hours"}` as TranslationKey
		);
		const offset = reminder.offset ?? 1;
		const relatedTo = getAnchorDisplayName(reminder.relatedTo || "due", plugin).toLowerCase();
		return `${offset} ${unit} ${direction} ${relatedTo}`;
	} else {
		const date = reminder.absoluteDate || translate("settings.defaults.reminders.fields.date");
		const time = reminder.absoluteTime || translate("settings.defaults.reminders.fields.time");
		return `${date} at ${time}`;
	}
}

// --- Global Reminders ---

function renderGlobalRemindersList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn,
	onTimelineRefresh?: () => void
): void {
	container.empty();

	const rules = plugin.settings.globalReminderRules;
	if (!rules || rules.length === 0) {
		showCardEmptyState(container, "No global reminders configured");
		return;
	}

	rules.forEach((rule, index) => {
		const statusText = rule.enabled ? "Enabled" : "Disabled";
		const anchors = getAvailableDateAnchors(plugin, undefined, { includeVaultWideDiscovery: true });
		const anchorOptions = buildAnchorOptionsWithSeparators(anchors);

		const parsed = parseISO8601Offset(rule.offset);

		// Enabled toggle
		const enabledSelect = createCardSelect(
			[
				{ value: "true", label: "Enabled" },
				{ value: "false", label: "Disabled" },
			],
			String(rule.enabled)
		);
		enabledSelect.addEventListener("change", () => {
			rule.enabled = enabledSelect.value === "true";
			save();
			onTimelineRefresh?.();
			updateSecondaryText();
		});

		// Description
		const descInput = createCardInput("text", "Description", rule.description);
		descInput.addEventListener("input", () => {
			rule.description = descInput.value;
			save();
			const cardEl = container.querySelector(`[data-card-id="${rule.id}"]`);
			if (cardEl) {
				const primaryText = cardEl.querySelector(".tasknotes-settings__card-primary-text");
				if (primaryText) primaryText.textContent = rule.description || "Unnamed rule";
			}
		});

		// Semantic type
		const typeSelect = createCardSelect(
			[
				{ value: "lead-time", label: "Lead time (fires once)" },
				{ value: "due-date", label: "Due date (persistent)" },
				{ value: "overdue", label: "Overdue (repeating)" },
				{ value: "start-date", label: "Start date (fires once)" },
			],
			rule.semanticType
		);
		typeSelect.addEventListener("change", () => {
			rule.semanticType = typeSelect.value as GlobalReminderRule["semanticType"];
			if (rule.semanticType === "overdue" && !rule.repeatIntervalHours) {
				rule.repeatIntervalHours = 24;
			}
			save();
			onTimelineRefresh?.();
			renderGlobalRemindersList(container, plugin, save, translate, onTimelineRefresh);
		});

		// Anchor
		const anchorSelect = createCardSelect(anchorOptions, rule.anchorProperty);
		disableSeparatorOptions(anchorSelect);
		anchorSelect.addEventListener("change", () => {
			if (anchorSelect.value === "__action_discover__") {
				anchorSelect.value = rule.anchorProperty;
				const wrapper = anchorSelect.closest(".tasknotes-settings__nested-cards")
					?? anchorSelect.closest(".tasknotes-settings__card-body");
				const dateProps = wrapper?.querySelector("details.tn-date-props") as HTMLDetailsElement | null;
				if (dateProps) {
					dateProps.open = true;
					dateProps.scrollIntoView({ behavior: "smooth", block: "start" });
				}
				return;
			}
			rule.anchorProperty = anchorSelect.value;
			save();
			onTimelineRefresh?.();
			updateSecondaryText();
		});

		// Offset number
		const offsetInput = createCardNumberInput(0, undefined, 1, parsed.value);
		offsetInput.addEventListener("input", () => {
			const val = parseInt(offsetInput.value);
			if (!isNaN(val) && val >= 0) {
				parsed.value = val;
				rule.offset = formatToISO8601Offset(val, parsed.unit, parsed.direction);
				save();
				onTimelineRefresh?.();
				updateSecondaryText();
			}
		});

		// Offset unit
		const unitSelect = createCardSelect(
			[
				{ value: "minutes", label: "Minutes" },
				{ value: "hours", label: "Hours" },
				{ value: "days", label: "Days" },
			],
			parsed.unit
		);
		unitSelect.addEventListener("change", () => {
			parsed.unit = unitSelect.value;
			rule.offset = formatToISO8601Offset(parsed.value, parsed.unit, parsed.direction);
			save();
			onTimelineRefresh?.();
			updateSecondaryText();
		});

		// Direction
		const directionSelect = createCardSelect(
			[
				{ value: "before", label: "Before" },
				{ value: "after", label: "After" },
			],
			parsed.direction
		);
		directionSelect.addEventListener("change", () => {
			parsed.direction = directionSelect.value;
			rule.offset = formatToISO8601Offset(parsed.value, parsed.unit, parsed.direction);
			save();
			onTimelineRefresh?.();
			updateSecondaryText();
		});

		// Skip if explicit exists
		const skipCheckbox = document.createElement("input");
		skipCheckbox.type = "checkbox";
		skipCheckbox.checked = rule.skipIfExplicitExists;
		skipCheckbox.addEventListener("change", () => {
			rule.skipIfExplicitExists = skipCheckbox.checked;
			save();
		});
		const skipWrapper = document.createElement("label");
		skipWrapper.style.cssText = "display: flex; align-items: center; gap: 8px; font-size: var(--font-ui-small);";
		skipWrapper.appendChild(skipCheckbox);
		skipWrapper.appendText("Skip if task has explicit reminder of same type");

		// Semantic type help text
		const semanticHelpEl = document.createElement("div");
		semanticHelpEl.style.cssText = "font-size: var(--font-ui-smaller); color: var(--text-muted); line-height: 1.6; padding: 4px 0;";
		semanticHelpEl.innerHTML = [
			"<strong>Types:</strong>",
			"\u2022 <strong>Lead time</strong> \u2014 One-shot notification before the anchor date",
			"\u2022 <strong>Due date</strong> \u2014 Persistent: fires on the date, repeats until task is completed",
			"\u2022 <strong>Overdue</strong> \u2014 Fires after the date passes, repeats at configured interval",
			"\u2022 <strong>Start date</strong> \u2014 One-shot notification on the anchor date",
		].join("<br>");

		const rows: CardRow[] = [
			{ label: "Status", input: enabledSelect },
			{ label: "Description", input: descInput },
			{ label: "Type", input: typeSelect },
			{ label: "", input: semanticHelpEl, fullWidth: true },
			{ label: "Anchor date", input: anchorSelect },
			{ label: "Offset", input: offsetInput },
			{ label: "Unit", input: unitSelect },
			{ label: "Direction", input: directionSelect },
		];

		if (rule.semanticType === "overdue") {
			const repeatInput = createCardNumberInput(1, undefined, 1, rule.repeatIntervalHours || 24);
			repeatInput.addEventListener("input", () => {
				const val = parseInt(repeatInput.value);
				if (!isNaN(val) && val >= 1) {
					rule.repeatIntervalHours = val;
					save();
					onTimelineRefresh?.();
					updateSecondaryText();
				}
			});
			rows.push({ label: "Repeat every (hours)", input: repeatInput });
		}

		rows.push({ label: "", input: skipWrapper, fullWidth: true });

		const anchorDisplayName = getAnchorDisplayName(rule.anchorProperty, plugin).toLowerCase();
		const timingText = formatGlobalRuleTiming(rule, anchorDisplayName);

		const card = createCard(container, {
			id: rule.id,
			collapsible: true,
			defaultCollapsed: true,
			header: {
				primaryText: rule.description || "Unnamed rule",
				secondaryText: `${statusText} \u00b7 ${timingText}`,
				actions: [
					createDeleteHeaderButton(() => {
						plugin.settings.globalReminderRules.splice(index, 1);
						save();
						onTimelineRefresh?.();
						renderGlobalRemindersList(container, plugin, save, translate, onTimelineRefresh);
					}, "Delete rule"),
				],
			},
			content: {
				sections: [{ rows }],
			},
		});

		function updateSecondaryText() {
			const secondaryEl = card.querySelector(".tasknotes-settings__card-secondary-text");
			if (secondaryEl) {
				const newStatus = rule.enabled ? "Enabled" : "Disabled";
				const newAnchor = getAnchorDisplayName(rule.anchorProperty, plugin).toLowerCase();
				const newTiming = formatGlobalRuleTiming(rule, newAnchor);
				secondaryEl.textContent = `${newStatus} \u00b7 ${newTiming}`;
			}
		}
	});
}

/**
 * Renders a collapsible "Available date properties" reference section for the settings UI.
 * Shows vault-wide date properties grouped by origin (Core / Custom / Discovered).
 */
export function renderDatePropertiesReference(container: HTMLElement, plugin: TaskNotesPlugin): void {
	// Find or create wrapper (preserves DOM position on re-renders)
	let wrapper = container.querySelector(":scope > .tn-date-props-section-wrapper") as HTMLElement;
	const wasOpen = wrapper?.querySelector("details.tn-date-props")?.hasAttribute("open") ?? false;
	if (wrapper) {
		wrapper.empty();
	} else {
		wrapper = container.createDiv({ cls: "tn-date-props-section-wrapper" });
	}

	const anchors = getAvailableDateAnchors(plugin, undefined, { includeVaultWideDiscovery: true });
	if (anchors.length === 0) return;

	const details = wrapper.createEl("details", { cls: "tn-date-props" });
	const summary = details.createEl("summary", { cls: "tn-date-props-summary" });
	const headerRow = summary.createSpan({ cls: "tn-date-props-header-row" });
	headerRow.createEl("h3", { text: "Remap properties" });
	const settingsHelp = headerRow.createSpan({ cls: "tn-date-props-help" });
	setIcon(settingsHelp, "help-circle");
	setTooltip(settingsHelp, "Date properties used as reminder anchors. Promote discovered properties to make them available globally. Core properties come from built-in task fields.");
	const setCount = anchors.filter(a => a.currentValue).length;
	summary.createSpan({
		text: `(${anchors.length} found)`,
		cls: "tn-date-props-count",
	});
	(summary.lastElementChild as HTMLElement).style.cssText = "font-size: var(--font-ui-smaller); color: var(--text-muted); font-weight: 400;";

	// Description text
	const desc = details.createEl("p", { cls: "tn-date-props-description" });
	desc.appendText("Properties available as reminder anchors. Core and Global properties appear in the \"Relative to\" dropdowns above and in the ");
	const rmLink = desc.createEl("strong", { text: "Reminder modal" });
	rmLink.style.cssText = "color: var(--text-normal);";
	desc.appendText(" when editing a task\u2019s reminders.");

	const propsContainer = details.createDiv({ cls: "tn-date-props-list" });

	// Group by origin
	const coreAnchors = anchors.filter(a => a.origin === "core");
	const settingsAnchors = anchors.filter(a => a.origin === "settings");
	const discoveredAnchors = anchors.filter(a => a.origin === "discovered");

	const MAX_VISIBLE = 5;
	const renderGroup = (label: string, group: DateAnchor[], originClass: string, helpTip?: string) => {
		if (group.length === 0) return;

		const groupContainer = propsContainer.createDiv({ cls: "tn-date-props-group" });
		const groupHeader = groupContainer.createDiv({ cls: "tn-date-props-group-header" });
		groupHeader.createSpan({ text: label });
		if (helpTip) {
			const helpEl = groupHeader.createSpan({ cls: "tn-date-props-group-help" });
			setIcon(helpEl, "help-circle");
			setTooltip(helpEl, helpTip);
		}

		// Search input for large groups
		let searchInput: HTMLInputElement | null = null;
		if (group.length > MAX_VISIBLE) {
			searchInput = groupContainer.createEl("input", {
				attr: { type: "text", placeholder: "Filter properties..." },
				cls: "tn-date-props-search-input",
			});
		}

		const rowEntries: { el: HTMLElement; anchor: DateAnchor }[] = [];
		for (const anchor of group) {
			const row = groupContainer.createDiv({ cls: `tn-date-prop-row ${originClass}` });
			rowEntries.push({ el: row, anchor });

			// Origin badge (with "Demoted" state for recently demoted properties)
			const badge = row.createSpan({ cls: "tn-date-prop-badge" });
			const isDemoted = anchor.origin === "discovered" && recentlyDemotedKeys.has(anchor.key);
			if (isDemoted) {
				badge.textContent = "Demoted";
				badge.style.cssText = "background: color-mix(in srgb, var(--text-warning) 15%, transparent); color: var(--text-warning);";
			} else {
				badge.textContent = anchor.origin === "core" ? "Core" : anchor.origin === "settings" ? "Global" : "Found";
			}

			// Property name + key hint (shows frontmatter key when mapped differently)
			const nameEl = row.createSpan({ cls: "tn-date-prop-name" });
			nameEl.textContent = anchor.displayName;
			const hintKey = anchor.frontmatterKey || anchor.key;
			if (anchor.displayName !== hintKey) {
				nameEl.createSpan({
					cls: "tn-date-prop-key-hint",
					text: `(${hintKey})`,
				});
			}

			// File count for discovered (vault-wide)
			if (anchor.origin === "discovered" && anchor.vaultFileCount) {
				row.createSpan({
					cls: "tn-date-prop-file-count",
					text: `${anchor.vaultFileCount} tasks`,
				});
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
						recentlyDemotedKeys.delete(anchor.key);
						promoteDiscoveredToUserField(plugin, anchor.key, anchor.displayName);
						renderDatePropertiesReference(container, plugin);
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
						promoteDiscoveredToUserField(plugin, anchor.key, anchor.displayName);
						renderDatePropertiesReference(container, plugin);
					};
				}
			}

			// Demote button (settings/global properties only)
			if (anchor.origin === "settings") {
				const demoteBtn = row.createEl("button", {
					cls: "tn-date-prop-demote-btn",
					text: "Demote",
				});
				setTooltip(demoteBtn, "Remove from global fields. Data stays on individual tasks.");
				demoteBtn.onclick = (e) => {
					e.preventDefault();
					e.stopPropagation();
					recentlyDemotedKeys.add(anchor.key);
					demoteUserField(plugin, anchor.key);
					renderDatePropertiesReference(container, plugin);
				};
			}
		}

		// Search filter + "Show all" for large groups
		if (group.length > MAX_VISIBLE) {
			let showAll = false;
			let showMoreEl: HTMLElement | null = null;

			const applyVisibility = () => {
				const query = searchInput?.value.toLowerCase() || "";
				let visibleCount = 0;
				let totalMatching = 0;

				for (const { el, anchor: a } of rowEntries) {
					const matches = !query ||
						a.displayName.toLowerCase().includes(query) ||
						a.key.toLowerCase().includes(query);
					if (matches) {
						totalMatching++;
						if (showAll || visibleCount < MAX_VISIBLE) {
							el.style.display = "";
							visibleCount++;
						} else {
							el.style.display = "none";
						}
					} else {
						el.style.display = "none";
					}
				}

				if (showMoreEl) { showMoreEl.remove(); showMoreEl = null; }
				if (!showAll && totalMatching > MAX_VISIBLE) {
					showMoreEl = groupContainer.createDiv({ cls: "tn-date-props-show-more" });
					showMoreEl.textContent = `+ ${totalMatching - MAX_VISIBLE} more`;
					showMoreEl.onclick = () => { showAll = true; applyVisibility(); };
				}
			};

			searchInput?.addEventListener("input", () => applyVisibility());
			applyVisibility(); // initial truncation
		}
	};

	renderGroup("Core", coreAnchors, "tn-date-prop-row--core",
		"Built-in task fields (due, scheduled, etc.). These are always available as reminder anchors.");
	renderGroup("Global custom properties", settingsAnchors, "tn-date-prop-row--settings",
		"Properties you've promoted from discovered properties or created manually. They appear in all task modals and can be used as reminder anchors. Demote to remove from global fields (data on individual tasks is preserved).");
	// Discovered & Available section — PropertyPicker for all property types
	{
		const discoveredGroup = propsContainer.createDiv({ cls: "tn-date-props-group" });
		const discoveredHeader = discoveredGroup.createDiv({ cls: "tn-date-props-group-header" });
		discoveredHeader.createSpan({ text: "Discovered & available" });
		const discoverHelp = discoveredHeader.createSpan({ cls: "tn-date-props-group-help" });
		setIcon(discoverHelp, "help-circle");
		setTooltip(discoverHelp, "Properties found across your vault. Click a date property to promote it to a global custom property. Use the \u2192 date button to convert non-date properties first.");

		// Exclude keys already shown in Core and Global sections
		const pickerExcludeKeys = new Set([
			...coreAnchors.map(a => a.key),
			...settingsAnchors.map(a => a.key),
			// Also exclude frontmatter keys (mapped names) to avoid duplicates
			...coreAnchors.filter(a => a.frontmatterKey).map(a => a.frontmatterKey!),
			...settingsAnchors.filter(a => a.frontmatterKey).map(a => a.frontmatterKey!),
		]);

		const pickerContainer = discoveredGroup.createDiv({ cls: "tn-date-props-picker-wrapper" });
		createPropertyPicker({
			container: pickerContainer,
			plugin,
			itemPaths: getAllTaskFilePaths(plugin),
			excludeKeys: pickerExcludeKeys,
			allowedConversionTargets: ["date"],
			onSelect: (key: string, type: PropertyType) => {
				promoteDiscoveredToUserField(plugin, key);
				renderDatePropertiesReference(container, plugin);
			},
			onConvert: async (key: string, targetType: PropertyType, files: string[], strategy: "convert-in-place" | "create-duplicate") => {
				// Confirmation is now handled by PropertyPicker internally
				await convertPropertyType(plugin, key, targetType, files, strategy);
				new Notice(`Converted ${files.length} file${files.length !== 1 ? "s" : ""} to ${targetType}`);
				// After conversion to date, auto-promote
				promoteDiscoveredToUserField(plugin, key);
				renderDatePropertiesReference(container, plugin);
			},
		});

		// In settings, vault-wide is always on — hide the toggle and auto-check it
		const vaultToggle = pickerContainer.querySelector(".tn-pp-toggle-container") as HTMLElement;
		if (vaultToggle) vaultToggle.style.display = "none";
		const vaultCheckbox = pickerContainer.querySelector(".tn-pp-toggle-checkbox") as HTMLInputElement;
		if (vaultCheckbox && !vaultCheckbox.checked) {
			vaultCheckbox.checked = true;
			vaultCheckbox.dispatchEvent(new Event("change"));
		}

		// Help text
		const helpEl = discoveredGroup.createEl("p", { cls: "tn-date-props-picker-help" });
		helpEl.textContent = "Search all properties across your vault. Date properties can be promoted directly. Non-date properties can be converted using the \u2192 date button.";

		// Recently demoted items — show below picker with "Undo" affordance
		if (recentlyDemotedKeys.size > 0) {
			const demotedContainer = discoveredGroup.createDiv({ cls: "tn-date-props-demoted" });
			demotedContainer.createDiv({ cls: "tn-date-props-demoted-header", text: "Recently demoted" });
			for (const key of recentlyDemotedKeys) {
				const row = demotedContainer.createDiv({ cls: "tn-date-prop-row tn-date-prop-row--demoted" });
				const badge = row.createSpan({ cls: "tn-date-prop-badge" });
				badge.textContent = "Demoted";
				badge.style.cssText = "background: color-mix(in srgb, var(--text-warning) 15%, transparent); color: var(--text-warning);";
				row.createSpan({ cls: "tn-date-prop-name", text: key });
				const undoBtn = row.createEl("button", {
					cls: "tn-date-prop-promote-btn",
					text: "Undo",
				});
				setTooltip(undoBtn, "Re-promote to global custom properties");
				undoBtn.onclick = (e) => {
					e.preventDefault();
					e.stopPropagation();
					recentlyDemotedKeys.delete(key);
					promoteDiscoveredToUserField(plugin, key);
					renderDatePropertiesReference(container, plugin);
				};
			}
		}
	}

	// "Add date property" button — creates a new User Field of type date
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
			attr: { type: "text", placeholder: "Property name (e.g., review_date)" },
			cls: "tn-date-props-add-name",
		});

		const submitBtn = form.createEl("button", { cls: "tn-date-props-add-submit" });
		const submitIcon = submitBtn.createSpan();
		setIcon(submitIcon, "check");
		setTooltip(submitBtn, "Create date property");
		submitBtn.onclick = () => {
			const key = nameInput.value.trim().replace(/\s+/g, "_");
			if (!key) {
				new Notice("Please enter a property name");
				return;
			}

			const userFields = plugin.settings.userFields || [];
			if (userFields.some(f => f.key === key)) {
				new Notice(`Property "${key}" already exists`);
				return;
			}

			promoteDiscoveredToUserField(plugin, key);
			renderDatePropertiesReference(container, plugin);
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

	// Restore <details> open state after re-render
	if (wasOpen) details.setAttribute("open", "");
}

/**
 * Promote a discovered property to a custom User Field (date type) in settings.
 */
function promoteDiscoveredToUserField(plugin: TaskNotesPlugin, key: string, displayName?: string): void {
	const userFields = plugin.settings.userFields || [];
	if (userFields.some(f => f.key === key)) {
		new Notice(`"${displayName || key}" is already a global property`);
		return;
	}

	const newField: UserMappedField = {
		id: key,
		displayName: displayName || key,
		key: key,
		type: "date",
	};

	userFields.push(newField);
	plugin.settings.userFields = userFields;

	// Also register in modalFieldsConfig so it appears in task creation/edit modals
	if (!plugin.settings.modalFieldsConfig) {
		plugin.settings.modalFieldsConfig = initializeFieldConfig(
			undefined,
			plugin.settings.userFields
		);
	} else {
		const config = plugin.settings.modalFieldsConfig;
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

	plugin.saveSettings();
	new Notice(`"${displayName || key}" added as a global property`);
}

/**
 * Demote a global property back to discovered — removes from userFields and modalFieldsConfig.
 * Frontmatter data on individual tasks is preserved.
 */
function demoteUserField(plugin: TaskNotesPlugin, key: string): void {
	const userFields = plugin.settings.userFields || [];
	const idx = userFields.findIndex(f => f.key === key);
	if (idx >= 0) userFields.splice(idx, 1);
	plugin.settings.userFields = userFields;

	if (plugin.settings.modalFieldsConfig) {
		const config = plugin.settings.modalFieldsConfig;
		config.fields = config.fields.filter(
			f => !(f.id === key && f.fieldType === "user")
		);
	}

	plugin.saveSettings();
	new Notice(`"${key}" removed from global properties. Data preserved on tasks.`);
}

/**
 * Build dropdown options from DateAnchor[], showing only core + promoted (settings) properties.
 * Discovered properties are excluded — users should promote them first via the date properties section.
 * Adds a "Discover & promote more..." action at the bottom.
 */
function buildAnchorOptionsWithSeparators(anchors: DateAnchor[]): { value: string; label: string }[] {
	const options: { value: string; label: string }[] = [];
	const core = anchors.filter(a => a.origin === "core");
	const settings = anchors.filter(a => a.origin === "settings");

	for (const a of core) {
		options.push({ value: a.key, label: a.displayName });
	}

	if (settings.length > 0) {
		options.push({ value: "__sep_global__", label: "\u2500\u2500 Global custom properties \u2500\u2500" });
		for (const a of settings) {
			options.push({ value: a.key, label: a.displayName });
		}
	}

	options.push({ value: "__action_discover__", label: "+ Discover & promote more..." });

	return options;
}

/**
 * Disable separator options and style action options in a select element.
 * Separators (value starts with "__sep_") are disabled and greyed out.
 * Actions (value starts with "__action_") are styled as accent-colored links.
 */
function disableSeparatorOptions(selectEl: HTMLSelectElement): void {
	for (const opt of Array.from(selectEl.options)) {
		if (opt.value.startsWith("__sep_")) {
			opt.disabled = true;
			opt.style.fontWeight = "600";
			opt.style.color = "var(--text-muted)";
			opt.style.fontSize = "0.85em";
		} else if (opt.value.startsWith("__action_")) {
			opt.style.color = "var(--text-accent)";
			opt.style.fontStyle = "italic";
		}
	}
}

function formatGlobalRuleTiming(rule: GlobalReminderRule, anchorName: string): string {
	const parsed = parseISO8601Offset(rule.offset);
	if (parsed.value === 0) return `At ${anchorName}`;
	const unitLabel = parsed.value === 1 ? parsed.unit.replace(/s$/, "") : parsed.unit;
	const prefix = parsed.direction === "before" ? "before" : "after";
	let text = `${parsed.value} ${unitLabel} ${prefix} ${anchorName}`;
	if (rule.semanticType === "overdue" && rule.repeatIntervalHours) {
		text += `, repeats every ${rule.repeatIntervalHours}h`;
	}
	return text;
}

function parseISO8601Offset(offset: string): { value: number; unit: string; direction: string } {
	const match = offset.match(/^(-?)P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
	if (!match) return { value: 0, unit: "hours", direction: "before" };

	const [, sign, days, hours, minutes] = match;
	const direction = sign === "-" ? "before" : "after";

	if (days && parseInt(days) > 0) return { value: parseInt(days), unit: "days", direction };
	if (hours && parseInt(hours) > 0) return { value: parseInt(hours), unit: "hours", direction };
	if (minutes && parseInt(minutes) > 0) return { value: parseInt(minutes), unit: "minutes", direction };
	return { value: 0, unit: "hours", direction: "before" };
}

function formatToISO8601Offset(value: number, unit: string, direction: string): string {
	if (value === 0) return "PT0S";
	const sign = direction === "before" ? "-" : "";
	switch (unit) {
		case "days": return `${sign}P${value}D`;
		case "hours": return `${sign}PT${value}H`;
		case "minutes": return `${sign}PT${value}M`;
		default: return `${sign}PT${value}H`;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMELINE PREVIEW (types and rendering in ../../../utils/reminderTimelineUtils)
// ═══════════════════════════════════════════════════════════════════════════

function collectTimelineMarkers(plugin: TaskNotesPlugin): TimelineMarker[] {
	const markers: TimelineMarker[] = [];

	// Default reminders
	const defaults = plugin.settings.taskCreationDefaults.defaultReminders || [];
	for (const rem of defaults) {
		if (rem.type !== "relative") continue;
		const hours = normalizeToHours(rem.offset ?? 1, rem.unit || "hours");
		const sign = rem.direction === "after" ? 1 : -1;
		// Always show offset on timeline — description is in the card header
		const label = formatShortOffset(rem.offset ?? 1, rem.unit || "hours", rem.direction || "before");
		markers.push({
			label,
			offsetHours: hours * sign,
			source: "default",
			reminderId: rem.id,
		});
	}

	// Global reminders (enabled only)
	const globals = plugin.settings.globalReminderRules || [];
	for (const rule of globals) {
		if (!rule.enabled) continue;
		const parsed = parseISO8601Offset(rule.offset);
		const hours = normalizeToHours(parsed.value, parsed.unit);
		const sign = parsed.direction === "after" ? 1 : -1;
		// Always show offset on timeline — description is in the card header
		const label = formatShortOffset(parsed.value, parsed.unit, parsed.direction);
		markers.push({
			label,
			offsetHours: hours * sign,
			source: "global",
			semanticType: rule.semanticType,
			repeatIntervalHours: rule.repeatIntervalHours,
			reminderId: rule.id,
		});
	}

	return markers;
}

function renderReminderTimeline(container: HTMLElement, plugin: TaskNotesPlugin, scrollContext?: HTMLElement): void {
	container.empty();

	// Header
	const header = container.createDiv({ cls: "tn-reminder-timeline__header" });
	const iconEl = header.createSpan({ cls: "tn-reminder-timeline__header-icon" });
	setIcon(iconEl, "clock");
	header.createSpan({ text: "Timeline preview", cls: "setting-item-name" });

	const markers = collectTimelineMarkers(plugin);

	if (markers.length === 0) {
		const emptyEl = container.createDiv({ cls: "tn-reminder-timeline__empty" });
		emptyEl.textContent = "Add reminders to see them on the timeline";

		// Still show the bare timeline with anchor
		renderTimelineArea(container, markers, plugin, scrollContext);
		return;
	}

	renderTimelineArea(container, markers, plugin, scrollContext);

	// Legend
	const legend = container.createDiv({ cls: "tn-reminder-timeline__legend" });

	const hasDefaults = markers.some(m => m.source === "default");
	const hasGlobals = markers.some(m => m.source === "global");

	if (hasDefaults) {
		const item = legend.createDiv({ cls: "tn-reminder-timeline__legend-item" });
		item.createDiv({ cls: "tn-reminder-timeline__legend-dot tn-reminder-timeline__legend-dot--default" });
		item.createSpan({ text: "Default (new tasks)" });
	}
	if (hasGlobals) {
		const item = legend.createDiv({ cls: "tn-reminder-timeline__legend-item" });
		item.createDiv({ cls: "tn-reminder-timeline__legend-dot tn-reminder-timeline__legend-dot--global" });
		item.createSpan({ text: "Global (all tasks)" });
	}

	// Note about mixed anchors
	const allAnchors = new Set<string>();
	const defaults = plugin.settings.taskCreationDefaults.defaultReminders || [];
	for (const rem of defaults) {
		if (rem.type === "relative") allAnchors.add(rem.relatedTo || "due");
	}
	const globals = plugin.settings.globalReminderRules || [];
	for (const rule of globals) {
		if (rule.enabled) allAnchors.add(rule.anchorProperty || "due");
	}
	if (allAnchors.size > 1) {
		const note = container.createDiv({ cls: "tn-reminder-timeline__note" });
		const primaryAnchor = getAnchorDisplayName("due", plugin);
		note.textContent = `Showing relative to ${primaryAnchor}. Some reminders target other dates.`;
	}
}

/**
 * Navigate to Features tab and scroll to the Task notifications heading.
 */
function navigateToFeatureNotifications(plugin: TaskNotesPlugin): void {
	const settingsTab = (plugin.app as any).setting?.activeTab;
	if (settingsTab?.containerEl) {
		const tabButton = settingsTab.containerEl.querySelector(
			"#tab-button-features"
		) as HTMLElement;
		if (tabButton) {
			tabButton.click();
			setTimeout(() => {
				const headings = settingsTab.containerEl.querySelectorAll(
					".setting-item-heading .setting-item-name"
				);
				for (const heading of headings) {
					if (heading.textContent?.toLowerCase().includes("task notifications")) {
						(heading as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
						break;
					}
				}
			}, 200);
		}
	}
}

/**
 * Navigate to Team & Attribution tab and scroll to the Person preferences section.
 */
function navigateToTeamAttribution(plugin: TaskNotesPlugin): void {
	const settingsTab = (plugin.app as any).setting?.activeTab;
	if (settingsTab?.containerEl) {
		const tabButton = settingsTab.containerEl.querySelector(
			"#tab-button-team-attribution"
		) as HTMLElement;
		if (tabButton) {
			tabButton.click();
			setTimeout(() => {
				const target = settingsTab.containerEl.querySelector(
					'[data-card-id="person-reminder-preferences"]'
				) as HTMLElement;
				if (target) {
					target.scrollIntoView({ behavior: "smooth", block: "start" });
					target.style.outline = "2px solid var(--text-accent)";
					setTimeout(() => { target.style.outline = ""; }, 2000);
				}
			}, 200);
		}
	}
}

/**
 * Scroll to the "Custom Properties" section on the same Task Properties tab.
 */
function scrollToUserFieldsSection(plugin: TaskNotesPlugin): void {
	const settingsTab = (plugin.app as any).setting?.activeTab;
	if (!settingsTab?.containerEl) return;
	const headings = settingsTab.containerEl.querySelectorAll(
		".setting-item-heading .setting-item-name"
	);
	for (const heading of headings) {
		if (heading.textContent?.includes("Custom Properties")) {
			(heading as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
			const parent = (heading as HTMLElement).closest(".setting-item") as HTMLElement;
			if (parent) {
				parent.style.transition = "background 0.3s ease";
				parent.style.background = "color-mix(in srgb, var(--interactive-accent) 15%, transparent)";
				setTimeout(() => { parent.style.background = ""; }, 1500);
			}
			break;
		}
	}
}
