import { Setting, Notice } from "obsidian";
import TaskNotesPlugin from "../../main";
import type { TranslationKey } from "../../i18n";
import {
	createSectionHeader,
	createTextSetting,
	createToggleSetting,
	createDropdownSetting,
	createNumberSetting,
	createHelpText,
} from "../components/settingHelpers";
import { PropertySelectorModal } from "../../modals/PropertySelectorModal";
import { getAvailableProperties, getPropertyLabels } from "../../utils/propertyHelpers";

/**
 * Renders the Appearance & UI tab - visual customization settings
 */
export function renderAppearanceTab(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	container.empty();

	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	// Task Cards Section
	createSectionHeader(container, translate("settings.appearance.taskCards.header"));
	createHelpText(container, translate("settings.appearance.taskCards.description"));

	// Default visible properties
	const availableProperties = getAvailableProperties(plugin);
	const currentProperties = plugin.settings.defaultVisibleProperties || [];

	new Setting(container)
		.setName(translate("settings.appearance.taskCards.defaultVisibleProperties.name"))
		.setDesc(translate("settings.appearance.taskCards.defaultVisibleProperties.description"))
		.addButton((button) => {
			button.setButtonText("Configure").onClick(() => {
				const modal = new PropertySelectorModal(
					plugin.app,
					availableProperties,
					currentProperties,
					async (selected) => {
						plugin.settings.defaultVisibleProperties = selected;
						save();
						new Notice("Default task card properties updated");
						// Re-render to update display
						renderAppearanceTab(container, plugin, save);
					},
					"Select Default Task Card Properties",
					"Choose which properties to display in task cards (views, kanban, etc.). Selected properties will appear in the order shown below."
				);
				modal.open();
			});
		});

	const currentLabels = getPropertyLabels(plugin, currentProperties);
	createHelpText(container, `Currently showing: ${currentLabels.join(", ")}`);


	// Task Filenames Section
	createSectionHeader(container, translate("settings.appearance.taskFilenames.header"));
	createHelpText(container, translate("settings.appearance.taskFilenames.description"));

	createToggleSetting(container, {
		name: translate("settings.appearance.taskFilenames.storeTitleInFilename.name"),
		desc: translate("settings.appearance.taskFilenames.storeTitleInFilename.description"),
		getValue: () => plugin.settings.storeTitleInFilename,
		setValue: async (value: boolean) => {
			plugin.settings.storeTitleInFilename = value;
			save();
			// Re-render to show/hide other options
			renderAppearanceTab(container, plugin, save);
		},
	});

	if (!plugin.settings.storeTitleInFilename) {
		createDropdownSetting(container, {
			name: translate("settings.appearance.taskFilenames.filenameFormat.name"),
			desc: translate("settings.appearance.taskFilenames.filenameFormat.description"),
			options: [
				{
					value: "title",
					label: translate(
						"settings.appearance.taskFilenames.filenameFormat.options.title"
					),
				},
				{
					value: "zettel",
					label: translate(
						"settings.appearance.taskFilenames.filenameFormat.options.zettel"
					),
				},
				{
					value: "timestamp",
					label: translate(
						"settings.appearance.taskFilenames.filenameFormat.options.timestamp"
					),
				},
				{
					value: "custom",
					label: translate(
						"settings.appearance.taskFilenames.filenameFormat.options.custom"
					),
				},
			],
			getValue: () => plugin.settings.taskFilenameFormat,
			setValue: async (value: string) => {
				plugin.settings.taskFilenameFormat = value as any;
				save();
				// Re-render to update visibility
				renderAppearanceTab(container, plugin, save);
			},
			ariaLabel: "Task filename generation format",
		});

		if (plugin.settings.taskFilenameFormat === "custom") {
			createTextSetting(container, {
				name: translate("settings.appearance.taskFilenames.customTemplate.name"),
				desc: translate("settings.appearance.taskFilenames.customTemplate.description"),
				placeholder: translate(
					"settings.appearance.taskFilenames.customTemplate.placeholder"
				),
				getValue: () => plugin.settings.customFilenameTemplate,
				setValue: async (value: string) => {
					plugin.settings.customFilenameTemplate = value;
					save();
				},
				ariaLabel: "Custom filename template with variables",
			});

			createHelpText(
				container,
				translate("settings.appearance.taskFilenames.customTemplate.helpText")
			);
		}
	}

	// Display Formatting Section
	createSectionHeader(container, translate("settings.appearance.displayFormatting.header"));
	createHelpText(container, translate("settings.appearance.displayFormatting.description"));

	createDropdownSetting(container, {
		name: translate("settings.appearance.displayFormatting.timeFormat.name"),
		desc: translate("settings.appearance.displayFormatting.timeFormat.description"),
		options: [
			{
				value: "12",
				label: translate(
					"settings.appearance.displayFormatting.timeFormat.options.twelveHour"
				),
			},
			{
				value: "24",
				label: translate(
					"settings.appearance.displayFormatting.timeFormat.options.twentyFourHour"
				),
			},
		],
		getValue: () => plugin.settings.calendarViewSettings.timeFormat,
		setValue: async (value: string) => {
			plugin.settings.calendarViewSettings.timeFormat = value as "12" | "24";
			save();
		},
	});

	// Calendar View Section
	createSectionHeader(container, translate("settings.appearance.calendarView.header"));
	createHelpText(container, translate("settings.appearance.calendarView.description"));

	createDropdownSetting(container, {
		name: translate("settings.appearance.calendarView.defaultView.name"),
		desc: translate("settings.appearance.calendarView.defaultView.description"),
		options: [
			{
				value: "dayGridMonth",
				label: translate("settings.appearance.calendarView.defaultView.options.monthGrid"),
			},
			{
				value: "timeGridWeek",
				label: translate(
					"settings.appearance.calendarView.defaultView.options.weekTimeline"
				),
			},
			{
				value: "timeGridDay",
				label: translate(
					"settings.appearance.calendarView.defaultView.options.dayTimeline"
				),
			},
			{
				value: "multiMonthYear",
				label: translate("settings.appearance.calendarView.defaultView.options.yearView"),
			},
			{
				value: "timeGridCustom",
				label: translate(
					"settings.appearance.calendarView.defaultView.options.customMultiDay"
				),
			},
		],
		getValue: () => plugin.settings.calendarViewSettings.defaultView,
		setValue: async (value: string) => {
			plugin.settings.calendarViewSettings.defaultView = value as any;
			save();
			// Re-render to show custom day count if needed
			renderAppearanceTab(container, plugin, save);
		},
	});

	if (plugin.settings.calendarViewSettings.defaultView === "timeGridCustom") {
		createNumberSetting(container, {
			name: translate("settings.appearance.calendarView.customDayCount.name"),
			desc: translate("settings.appearance.calendarView.customDayCount.description"),
			placeholder: translate("settings.appearance.calendarView.customDayCount.placeholder"),
			min: 2,
			max: 10,
			getValue: () => plugin.settings.calendarViewSettings.customDayCount,
			setValue: async (value: number) => {
				plugin.settings.calendarViewSettings.customDayCount = value;
				save();
			},
		});
	}

	createDropdownSetting(container, {
		name: translate("settings.appearance.calendarView.firstDayOfWeek.name"),
		desc: translate("settings.appearance.calendarView.firstDayOfWeek.description"),
		options: [
			{ value: "0", label: translate("common.weekdays.sunday") },
			{ value: "1", label: translate("common.weekdays.monday") },
			{ value: "2", label: translate("common.weekdays.tuesday") },
			{ value: "3", label: translate("common.weekdays.wednesday") },
			{ value: "4", label: translate("common.weekdays.thursday") },
			{ value: "5", label: translate("common.weekdays.friday") },
			{ value: "6", label: translate("common.weekdays.saturday") },
		],
		getValue: () => plugin.settings.calendarViewSettings.firstDay.toString(),
		setValue: async (value: string) => {
			plugin.settings.calendarViewSettings.firstDay = parseInt(value) as any;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.appearance.calendarView.showWeekends.name"),
		desc: translate("settings.appearance.calendarView.showWeekends.description"),
		getValue: () => plugin.settings.calendarViewSettings.showWeekends,
		setValue: async (value: boolean) => {
			plugin.settings.calendarViewSettings.showWeekends = value;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.appearance.calendarView.showWeekNumbers.name"),
		desc: translate("settings.appearance.calendarView.showWeekNumbers.description"),
		getValue: () => plugin.settings.calendarViewSettings.weekNumbers,
		setValue: async (value: boolean) => {
			plugin.settings.calendarViewSettings.weekNumbers = value;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.appearance.calendarView.showTodayHighlight.name"),
		desc: translate("settings.appearance.calendarView.showTodayHighlight.description"),
		getValue: () => plugin.settings.calendarViewSettings.showTodayHighlight,
		setValue: async (value: boolean) => {
			plugin.settings.calendarViewSettings.showTodayHighlight = value;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.appearance.calendarView.showCurrentTimeIndicator.name"),
		desc: translate("settings.appearance.calendarView.showCurrentTimeIndicator.description"),
		getValue: () => plugin.settings.calendarViewSettings.nowIndicator,
		setValue: async (value: boolean) => {
			plugin.settings.calendarViewSettings.nowIndicator = value;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.appearance.calendarView.selectionMirror.name"),
		desc: translate("settings.appearance.calendarView.selectionMirror.description"),
		getValue: () => plugin.settings.calendarViewSettings.selectMirror,
		setValue: async (value: boolean) => {
			plugin.settings.calendarViewSettings.selectMirror = value;
			save();
		},
	});

	// Calendar locale setting with blur validation (not on every keystroke)
	new Setting(container)
		.setName(translate("settings.appearance.calendarView.calendarLocale.name"))
		.setDesc(translate("settings.appearance.calendarView.calendarLocale.description"))
		.addText((text) => {
			text.setPlaceholder(translate("settings.appearance.calendarView.calendarLocale.placeholder"));
			text.setValue(plugin.settings.calendarViewSettings.locale || "");
			text.inputEl.addClass("settings-view__input");

			// Validate and save on blur (when user clicks out of field)
			text.inputEl.addEventListener("blur", () => {
				const trimmed = text.getValue().trim();
				if (trimmed) {
					try {
						// Use Intl.getCanonicalLocales to validate the locale tag
						Intl.getCanonicalLocales(trimmed);
						plugin.settings.calendarViewSettings.locale = trimmed;
						save();
					} catch {
						// Invalid locale - show notice and clear the field
						new Notice(translate("settings.appearance.calendarView.calendarLocale.invalidLocale"));
						plugin.settings.calendarViewSettings.locale = "";
						text.setValue("");
						save();
					}
				} else {
					// Empty string is valid (means auto-detect)
					plugin.settings.calendarViewSettings.locale = "";
					save();
				}
			});
		});

	// Default event visibility section
	createSectionHeader(container, translate("settings.appearance.defaultEventVisibility.header"));
	createHelpText(container, translate("settings.appearance.defaultEventVisibility.description"));

	createToggleSetting(container, {
		name: translate("settings.appearance.defaultEventVisibility.showScheduledTasks.name"),
		desc: translate(
			"settings.appearance.defaultEventVisibility.showScheduledTasks.description"
		),
		getValue: () => plugin.settings.calendarViewSettings.defaultShowScheduled,
		setValue: async (value: boolean) => {
			plugin.settings.calendarViewSettings.defaultShowScheduled = value;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.appearance.defaultEventVisibility.showDueDates.name"),
		desc: translate("settings.appearance.defaultEventVisibility.showDueDates.description"),
		getValue: () => plugin.settings.calendarViewSettings.defaultShowDue,
		setValue: async (value: boolean) => {
			plugin.settings.calendarViewSettings.defaultShowDue = value;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.appearance.defaultEventVisibility.showDueWhenScheduled.name"),
		desc: translate(
			"settings.appearance.defaultEventVisibility.showDueWhenScheduled.description"
		),
		getValue: () => plugin.settings.calendarViewSettings.defaultShowDueWhenScheduled,
		setValue: async (value: boolean) => {
			plugin.settings.calendarViewSettings.defaultShowDueWhenScheduled = value;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.appearance.defaultEventVisibility.showTimeEntries.name"),
		desc: translate("settings.appearance.defaultEventVisibility.showTimeEntries.description"),
		getValue: () => plugin.settings.calendarViewSettings.defaultShowTimeEntries,
		setValue: async (value: boolean) => {
			plugin.settings.calendarViewSettings.defaultShowTimeEntries = value;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.appearance.defaultEventVisibility.showRecurringTasks.name"),
		desc: translate(
			"settings.appearance.defaultEventVisibility.showRecurringTasks.description"
		),
		getValue: () => plugin.settings.calendarViewSettings.defaultShowRecurring,
		setValue: async (value: boolean) => {
			plugin.settings.calendarViewSettings.defaultShowRecurring = value;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.appearance.defaultEventVisibility.showICSEvents.name"),
		desc: translate("settings.appearance.defaultEventVisibility.showICSEvents.description"),
		getValue: () => plugin.settings.calendarViewSettings.defaultShowICSEvents,
		setValue: async (value: boolean) => {
			plugin.settings.calendarViewSettings.defaultShowICSEvents = value;
			save();
		},
	});

	// Time Settings
	createSectionHeader(container, translate("settings.appearance.timeSettings.header"));
	createHelpText(container, translate("settings.appearance.timeSettings.description"));

	createDropdownSetting(container, {
		name: translate("settings.appearance.timeSettings.timeSlotDuration.name"),
		desc: translate("settings.appearance.timeSettings.timeSlotDuration.description"),
		options: [
			{
				value: "00:15:00",
				label: translate(
					"settings.appearance.timeSettings.timeSlotDuration.options.fifteenMinutes"
				),
			},
			{
				value: "00:30:00",
				label: translate(
					"settings.appearance.timeSettings.timeSlotDuration.options.thirtyMinutes"
				),
			},
			{
				value: "01:00:00",
				label: translate(
					"settings.appearance.timeSettings.timeSlotDuration.options.sixtyMinutes"
				),
			},
		],
		getValue: () => plugin.settings.calendarViewSettings.slotDuration,
		setValue: async (value: string) => {
			plugin.settings.calendarViewSettings.slotDuration = value as any;
			save();
		},
	});

	createTextSetting(container, {
		name: translate("settings.appearance.timeSettings.startTime.name"),
		desc: translate("settings.appearance.timeSettings.startTime.description"),
		placeholder: translate("settings.appearance.timeSettings.startTime.placeholder"),
		debounceMs: 500,
		getValue: () => {
			const timeValue = plugin.settings.calendarViewSettings.slotMinTime;
			// Validate and fallback to default if invalid
			if (!timeValue || timeValue.length < 5 || !/^\d{2}:\d{2}:\d{2}$/.test(timeValue)) {
				return "00:00"; // Default start time
			}
			return timeValue.slice(0, 5); // Remove seconds
		},
		setValue: async (value: string) => {
			// Validate time format (HH:MM)
			if (!/^\d{2}:\d{2}$/.test(value)) {
				new Notice("Invalid time format. Please use HH:MM format (e.g., 08:00)");
				return;
			}

			// Validate time range (00:00 to 23:59)
			const [hours, minutes] = value.split(":").map(Number);
			if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
				new Notice("Invalid time. Hours must be 00-23 and minutes must be 00-59");
				return;
			}

			plugin.settings.calendarViewSettings.slotMinTime = value + ":00";
			save();
		},
	});

	createTextSetting(container, {
		name: translate("settings.appearance.timeSettings.endTime.name"),
		desc: translate("settings.appearance.timeSettings.endTime.description"),
		placeholder: translate("settings.appearance.timeSettings.endTime.placeholder"),
		debounceMs: 500,
		getValue: () => {
			const timeValue = plugin.settings.calendarViewSettings.slotMaxTime;
			// Validate and fallback to default if invalid
			if (!timeValue || timeValue.length < 5 || !/^\d{2}:\d{2}:\d{2}$/.test(timeValue)) {
				return "24:00"; // Default end time
			}
			return timeValue.slice(0, 5); // Remove seconds
		},
		setValue: async (value: string) => {
			// Validate time format (HH:MM)
			if (!/^\d{2}:\d{2}$/.test(value)) {
				new Notice("Invalid time format. Please use HH:MM format (e.g., 23:00)");
				return;
			}

			// Validate time range (00:00 to 24:00 for end time)
			const [hours, minutes] = value.split(":").map(Number);
			if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
				new Notice("Invalid time. Hours must be 00-24 and minutes must be 00-59");
				return;
			}

			// Special case: 24:XX is only valid as 24:00
			if (hours === 24 && minutes !== 0) {
				new Notice("When hour is 24, minutes must be 00");
				return;
			}

			plugin.settings.calendarViewSettings.slotMaxTime = value + ":00";
			save();
		},
	});

	createTextSetting(container, {
		name: translate("settings.appearance.timeSettings.initialScrollTime.name"),
		desc: translate("settings.appearance.timeSettings.initialScrollTime.description"),
		placeholder: translate("settings.appearance.timeSettings.initialScrollTime.placeholder"),
		debounceMs: 500,
		getValue: () => {
			const timeValue = plugin.settings.calendarViewSettings.scrollTime;
			// Validate and fallback to default if invalid
			if (!timeValue || timeValue.length < 5 || !/^\d{2}:\d{2}:\d{2}$/.test(timeValue)) {
				return "08:00"; // Default scroll time
			}
			return timeValue.slice(0, 5); // Remove seconds
		},
		setValue: async (value: string) => {
			// Validate time format (HH:MM)
			if (!/^\d{2}:\d{2}$/.test(value)) {
				new Notice("Invalid time format. Please use HH:MM format (e.g., 08:00)");
				return;
			}

			// Validate time range (00:00 to 23:59)
			const [hours, minutes] = value.split(":").map(Number);
			if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
				new Notice("Invalid time. Hours must be 00-23 and minutes must be 00-59");
				return;
			}

			plugin.settings.calendarViewSettings.scrollTime = value + ":00";
			save();
		},
	});

	createNumberSetting(container, {
		name: translate("settings.appearance.timeSettings.eventMinHeight.name"),
		desc: translate("settings.appearance.timeSettings.eventMinHeight.description"),
		placeholder: translate("settings.appearance.timeSettings.eventMinHeight.placeholder"),
		min: 5,
		max: 100,
		debounceMs: 300,
		getValue: () => plugin.settings.calendarViewSettings.eventMinHeight,
		setValue: async (value: number) => {
			plugin.settings.calendarViewSettings.eventMinHeight = value;
			save();
		},
	});

	// UI Elements Section
	createSectionHeader(container, translate("settings.appearance.uiElements.header"));
	createHelpText(container, translate("settings.appearance.uiElements.description"));

	createToggleSetting(container, {
		name: translate("settings.appearance.uiElements.showTrackedTasksInStatusBar.name"),
		desc: translate("settings.appearance.uiElements.showTrackedTasksInStatusBar.description"),
		getValue: () => plugin.settings.showTrackedTasksInStatusBar,
		setValue: async (value: boolean) => {
			plugin.settings.showTrackedTasksInStatusBar = value;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.appearance.uiElements.showRelationshipsWidget.name"),
		desc: translate("settings.appearance.uiElements.showRelationshipsWidget.description"),
		getValue: () => plugin.settings.showRelationships,
		setValue: async (value: boolean) => {
			plugin.settings.showRelationships = value;
			save();
			// Re-render to show position setting
			renderAppearanceTab(container, plugin, save);
		},
	});

	if (plugin.settings.showRelationships) {
		createDropdownSetting(container, {
			name: translate("settings.appearance.uiElements.relationshipsPosition.name"),
			desc: translate("settings.appearance.uiElements.relationshipsPosition.description"),
			options: [
				{
					value: "top",
					label: translate(
						"settings.appearance.uiElements.relationshipsPosition.options.top"
					),
				},
				{
					value: "bottom",
					label: translate(
						"settings.appearance.uiElements.relationshipsPosition.options.bottom"
					),
				},
			],
			getValue: () => plugin.settings.relationshipsPosition,
			setValue: async (value: string) => {
				plugin.settings.relationshipsPosition = value as "top" | "bottom";
				save();
			},
		});
	}

	// Add task card in note setting
	createToggleSetting(container, {
		name: translate("settings.appearance.uiElements.showTaskCardInNote.name"),
		desc: translate("settings.appearance.uiElements.showTaskCardInNote.description"),
		getValue: () => plugin.settings.showTaskCardInNote,
		setValue: async (value: boolean) => {
			plugin.settings.showTaskCardInNote = value;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.appearance.uiElements.showExpandableSubtasks.name"),
		desc: translate("settings.appearance.uiElements.showExpandableSubtasks.description"),
		getValue: () => plugin.settings.showExpandableSubtasks,
		setValue: async (value: boolean) => {
			plugin.settings.showExpandableSubtasks = value;
			save();
			// Re-render to show chevron position setting
			renderAppearanceTab(container, plugin, save);
		},
	});

	if (plugin.settings.showExpandableSubtasks) {
		createDropdownSetting(container, {
			name: translate("settings.appearance.uiElements.subtaskChevronPosition.name"),
			desc: translate("settings.appearance.uiElements.subtaskChevronPosition.description"),
			options: [
				{
					value: "left",
					label: translate(
						"settings.appearance.uiElements.subtaskChevronPosition.options.left"
					),
				},
				{
					value: "right",
					label: translate(
						"settings.appearance.uiElements.subtaskChevronPosition.options.right"
					),
				},
			],
			getValue: () => plugin.settings.subtaskChevronPosition,
			setValue: async (value: string) => {
				plugin.settings.subtaskChevronPosition = value as "left" | "right";
				save();
			},
		});
	}

	createDropdownSetting(container, {
		name: translate("settings.appearance.uiElements.viewsButtonAlignment.name"),
		desc: translate("settings.appearance.uiElements.viewsButtonAlignment.description"),
		options: [
			{
				value: "left",
				label: translate(
					"settings.appearance.uiElements.viewsButtonAlignment.options.left"
				),
			},
			{
				value: "right",
				label: translate(
					"settings.appearance.uiElements.viewsButtonAlignment.options.right"
				),
			},
		],
		getValue: () => plugin.settings.viewsButtonAlignment,
		setValue: async (value: string) => {
			plugin.settings.viewsButtonAlignment = value as "left" | "right";
			save();
		},
	});

	// Task Interaction Section
	createSectionHeader(container, translate("settings.general.taskInteraction.header"));
	createHelpText(container, translate("settings.general.taskInteraction.description"));

	createDropdownSetting(container, {
		name: translate("settings.general.taskInteraction.singleClick.name"),
		desc: translate("settings.general.taskInteraction.singleClick.description"),
		options: [
			{ value: "edit", label: translate("settings.general.taskInteraction.actions.edit") },
			{
				value: "openNote",
				label: translate("settings.general.taskInteraction.actions.openNote"),
			},
		],
		getValue: () => plugin.settings.singleClickAction,
		setValue: async (value: string) => {
			plugin.settings.singleClickAction = value as "edit" | "openNote";
			save();
		},
	});

	createDropdownSetting(container, {
		name: translate("settings.general.taskInteraction.doubleClick.name"),
		desc: translate("settings.general.taskInteraction.doubleClick.description"),
		options: [
			{ value: "edit", label: translate("settings.general.taskInteraction.actions.edit") },
			{
				value: "openNote",
				label: translate("settings.general.taskInteraction.actions.openNote"),
			},
			{ value: "none", label: translate("settings.general.taskInteraction.actions.none") },
		],
		getValue: () => plugin.settings.doubleClickAction,
		setValue: async (value: string) => {
			plugin.settings.doubleClickAction = value as "edit" | "openNote" | "none";
			save();
		},
	});

	// Project Autosuggest Section
	createSectionHeader(container, translate("settings.appearance.projectAutosuggest.header"));
	createHelpText(container, translate("settings.appearance.projectAutosuggest.description"));

	// Tag filtering
	createTextSetting(container, {
		name: translate("settings.appearance.projectAutosuggest.requiredTags.name"),
		desc: translate("settings.appearance.projectAutosuggest.requiredTags.description"),
		placeholder: translate("settings.appearance.projectAutosuggest.requiredTags.placeholder"),
		getValue: () => plugin.settings.projectAutosuggest?.requiredTags?.join(", ") ?? "",
		setValue: async (value: string) => {
			if (!plugin.settings.projectAutosuggest) {
				plugin.settings.projectAutosuggest = {
					enableFuzzy: false,
					rows: [],
					showAdvanced: false,
					requiredTags: [],
					includeFolders: [],
					propertyKey: "",
					propertyValue: "",
				};
			}
			plugin.settings.projectAutosuggest.requiredTags = value
				.split(",")
				.map((tag) => tag.trim())
				.filter((tag) => tag.length > 0);
			save();
		},
		ariaLabel: "Required tags for project suggestions",
	});

	// Folder filtering
	createTextSetting(container, {
		name: translate("settings.appearance.projectAutosuggest.includeFolders.name"),
		desc: translate("settings.appearance.projectAutosuggest.includeFolders.description"),
		placeholder: translate("settings.appearance.projectAutosuggest.includeFolders.placeholder"),
		getValue: () => plugin.settings.projectAutosuggest?.includeFolders?.join(", ") ?? "",
		setValue: async (value: string) => {
			if (!plugin.settings.projectAutosuggest) {
				plugin.settings.projectAutosuggest = {
					enableFuzzy: false,
					rows: [],
					showAdvanced: false,
					requiredTags: [],
					includeFolders: [],
					propertyKey: "",
					propertyValue: "",
				};
			}
			plugin.settings.projectAutosuggest.includeFolders = value
				.split(",")
				.map((folder) => folder.trim())
				.filter((folder) => folder.length > 0);
			save();
		},
		ariaLabel: "Include folders for project suggestions",
	});

	// Property filtering
	createTextSetting(container, {
		name: translate("settings.appearance.projectAutosuggest.requiredPropertyKey.name"),
		desc: translate("settings.appearance.projectAutosuggest.requiredPropertyKey.description"),
		placeholder: translate(
			"settings.appearance.projectAutosuggest.requiredPropertyKey.placeholder"
		),
		getValue: () => plugin.settings.projectAutosuggest?.propertyKey ?? "",
		setValue: async (value: string) => {
			if (!plugin.settings.projectAutosuggest) {
				plugin.settings.projectAutosuggest = {
					enableFuzzy: false,
					rows: [],
					showAdvanced: false,
					requiredTags: [],
					includeFolders: [],
					propertyKey: "",
					propertyValue: "",
				};
			}
			plugin.settings.projectAutosuggest.propertyKey = value.trim();
			save();
		},
		ariaLabel: "Required frontmatter property key for project suggestions",
		debounceMs: 500, // Prevent rapid save calls while typing
	});

	createTextSetting(container, {
		name: translate("settings.appearance.projectAutosuggest.requiredPropertyValue.name"),
		desc: translate("settings.appearance.projectAutosuggest.requiredPropertyValue.description"),
		placeholder: translate(
			"settings.appearance.projectAutosuggest.requiredPropertyValue.placeholder"
		),
		getValue: () => plugin.settings.projectAutosuggest?.propertyValue ?? "",
		setValue: async (value: string) => {
			if (!plugin.settings.projectAutosuggest) {
				plugin.settings.projectAutosuggest = {
					enableFuzzy: false,
					rows: [],
					showAdvanced: false,
					requiredTags: [],
					includeFolders: [],
					propertyKey: "",
					propertyValue: "",
				};
			}
			plugin.settings.projectAutosuggest.propertyValue = value.trim();
			save();
		},
		ariaLabel: "Required frontmatter property value for project suggestions",
		debounceMs: 500, // Prevent rapid save calls while typing
	});

	createToggleSetting(container, {
		name: translate("settings.appearance.projectAutosuggest.customizeDisplay.name"),
		desc: translate("settings.appearance.projectAutosuggest.customizeDisplay.description"),
		getValue: () => plugin.settings.projectAutosuggest?.showAdvanced ?? false,
		setValue: async (value: boolean) => {
			if (!plugin.settings.projectAutosuggest) {
				plugin.settings.projectAutosuggest = {
					enableFuzzy: false,
					rows: [],
					showAdvanced: false,
					requiredTags: [],
					includeFolders: [],
					propertyKey: "",
					propertyValue: "",
				};
			}
			plugin.settings.projectAutosuggest.showAdvanced = value;
			save();
			// Refresh the settings display
			renderAppearanceTab(container, plugin, save);
		},
	});

	// Only show advanced settings if enabled
	if (plugin.settings.projectAutosuggest?.showAdvanced) {
		createToggleSetting(container, {
			name: translate("settings.appearance.projectAutosuggest.enableFuzzyMatching.name"),
			desc: translate(
				"settings.appearance.projectAutosuggest.enableFuzzyMatching.description"
			),
			getValue: () => plugin.settings.projectAutosuggest?.enableFuzzy ?? false,
			setValue: async (value: boolean) => {
				if (!plugin.settings.projectAutosuggest) {
					plugin.settings.projectAutosuggest = {
						enableFuzzy: false,
						rows: [],
						showAdvanced: false,
						requiredTags: [],
						includeFolders: [],
						propertyKey: "",
						propertyValue: "",
					};
				}
				plugin.settings.projectAutosuggest.enableFuzzy = value;
				save();
			},
		});

		// Display rows configuration
		createHelpText(
			container,
			translate("settings.appearance.projectAutosuggest.displayRowsHelp")
		);

		const getRows = (): string[] =>
			(plugin.settings.projectAutosuggest?.rows ?? []).slice(0, 3);

		const setRow = async (idx: number, value: string) => {
			if (!plugin.settings.projectAutosuggest) {
				plugin.settings.projectAutosuggest = {
					enableFuzzy: false,
					rows: [],
					showAdvanced: false,
					requiredTags: [],
					includeFolders: [],
					propertyKey: "",
					propertyValue: "",
				};
			}
			const current = plugin.settings.projectAutosuggest.rows ?? [];
			const next = [...current];
			next[idx] = value;
			plugin.settings.projectAutosuggest.rows = next.slice(0, 3);
			save();
		};

		createTextSetting(container, {
			name: translate("settings.appearance.projectAutosuggest.displayRows.row1.name"),
			desc: translate("settings.appearance.projectAutosuggest.displayRows.row1.description"),
			placeholder: translate(
				"settings.appearance.projectAutosuggest.displayRows.row1.placeholder"
			),
			getValue: () => getRows()[0] || "",
			setValue: async (value: string) => setRow(0, value),
			ariaLabel: "Project autosuggest display row 1",
		});

		createTextSetting(container, {
			name: translate("settings.appearance.projectAutosuggest.displayRows.row2.name"),
			desc: translate("settings.appearance.projectAutosuggest.displayRows.row2.description"),
			placeholder: translate(
				"settings.appearance.projectAutosuggest.displayRows.row2.placeholder"
			),
			getValue: () => getRows()[1] || "",
			setValue: async (value: string) => setRow(1, value),
			ariaLabel: "Project autosuggest display row 2",
		});

		createTextSetting(container, {
			name: translate("settings.appearance.projectAutosuggest.displayRows.row3.name"),
			desc: translate("settings.appearance.projectAutosuggest.displayRows.row3.description"),
			placeholder: translate(
				"settings.appearance.projectAutosuggest.displayRows.row3.placeholder"
			),
			getValue: () => getRows()[2] || "",
			setValue: async (value: string) => setRow(2, value),
			ariaLabel: "Project autosuggest display row 3",
		});

		// Concise help section
		const helpContainer = container.createDiv("tasknotes-settings__help-section");
		helpContainer.createEl("h4", {
			text: translate("settings.appearance.projectAutosuggest.quickReference.header"),
		});
		const helpList = helpContainer.createEl("ul");
		helpList.createEl("li", {
			text: translate("settings.appearance.projectAutosuggest.quickReference.properties"),
		});
		helpList.createEl("li", {
			text: translate("settings.appearance.projectAutosuggest.quickReference.labels"),
		});
		helpList.createEl("li", {
			text: translate("settings.appearance.projectAutosuggest.quickReference.searchable"),
		});
		helpList.createEl("li", {
			text: translate("settings.appearance.projectAutosuggest.quickReference.staticText"),
		});
		helpContainer.createEl("p", {
			text: translate(
				"settings.appearance.projectAutosuggest.quickReference.alwaysSearchable"
			),
			cls: "settings-help-note",
		});
	}
}
