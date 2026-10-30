import { msg } from "@lingui/core/macro";
import type { SettingDefinitionItem, SettingDefinitionList, SettingGroupItem } from "obsidian";
import { showConfirmationModal } from "../../modals/ConfirmationModal";
import { ProjectSelectModal } from "../../modals/ProjectSelectModal";
import { splitListPreservingLinksAndQuotes } from "../../utils/stringSplit";
import { initializeFieldConfig } from "../../utils/fieldConfigDefaults";
import { SettingsContext } from "./SettingsContext";
import type { DefaultTaskTime } from "../../types/settings";
import { reorder } from "./properties";

export function filenameDefinitions(ctx: SettingsContext): SettingGroupItem[] {
	const { plugin } = ctx;
	const s = plugin.settings;
	const t = plugin.i18n.translate.bind(plugin.i18n);
	return [
		ctx.field(
			s,
			"storeTitleInFilename",
			"storeTitleInFilename",
			t(msg({ message: "Store title in filename:", context: "settings.taskProperties.titleCard.storeTitleInFilename" }))
		),
		ctx.field(
			s,
			"taskFilenameFormat",
			"taskFilenameFormat",
			t(msg({ message: "Filename format", context: "settings.appearance.taskFilenames.filenameFormat.name" })),
			{
				type: "dropdown",
				disabled: () => s.storeTitleInFilename,
				options: Object.fromEntries(
					(["title", "zettel", "timestamp", "uuid", "custom"] as const).map((value) => [
						value,
						t(`settings.appearance.taskFilenames.filenameFormat.options.${value}`),
					])
				),
			}
		),
		ctx.field(
			s,
			"customFilenameTemplate",
			"customFilenameTemplate",
			t(msg({ message: "Custom template:", context: "settings.taskProperties.titleCard.customTemplate" })),
			{
				disabled: () => s.storeTitleInFilename || s.taskFilenameFormat !== "custom",
				desc: t(msg({ message: "Note: '{{dueDate}}' and '{{scheduledDate}}' are in YYYY-MM-DD format and will be empty if not set.", context: "settings.appearance.taskFilenames.customTemplate.helpText" })),
				validate: (value) =>
					/\{[a-zA-Z]+\}/.test(value.replace(/\{\{[a-zA-Z]+\}\}/g, ""))
						? t(msg({ message: "Single-brace syntax like '{title}' is deprecated. Please use double-brace syntax '{{title}}' instead for consistency with body templates.", context: "settings.taskProperties.titleCard.legacySyntaxWarning" }))
						: undefined,
			}
		),
		ctx.field(
			s,
			"occurrenceFilenameTemplate",
			"occurrenceFilenameTemplate",
			ctx.t(msg({ message: "Occurrence filename template", context: "settings.taskProperties.titleCard.occurrenceFilenameTemplate" })),
			{ desc: ctx.t(msg({ message: "Leave empty to use the normal task filename with a unique suffix.", context: "settings.native.leaveEmptyToUseTheNormalTaskFilenameWith" })) }
		),
		ctx.field(
			s,
			"occurrenceFilenameTemplateProperty",
			"occurrenceFilenameTemplateProperty",
			ctx.t(msg({ message: "Occurrence filename template property", context: "settings.native.occurrenceFilenameTemplateProperty" })),
			{
				desc: ctx.t(msg({ message: "A property on the parent task that overrides the occurrence filename template.", context: "settings.native.aPropertyOnTheParentTaskThatOverridesThe" })),
			}
		),
	];
}

export function creationDefaults(ctx: SettingsContext): SettingGroupItem[] {
	const { plugin, save } = ctx;
	const s = plugin.settings;
	const d = s.taskCreationDefaults;
	const t = plugin.i18n.translate.bind(plugin.i18n);
	const dateOptions = {
		none: t(msg({ message: "None", context: "settings.defaults.options.none" })),
		today: t(msg({ message: "Today", context: "settings.defaults.options.today" })),
		tomorrow: t(msg({ message: "Tomorrow", context: "settings.defaults.options.tomorrow" })),
		"next-week": t(msg({ message: "Next week", context: "settings.defaults.options.nextWeek" })),
	};
	return [
		{
			name: ctx.t(msg({ message: "Defaults apply to new tasks", context: "settings.native.defaultsApplyToNewTasks" })),
			desc: ctx.t(msg({ message: "Changing these values does not update existing task notes.", context: "settings.native.changingTheseValuesDoesNotUpdateExistingTaskNotes" })),
		},
		ctx.field(
			s,
			"defaultTaskStatus",
			"defaultTaskStatus",
			ctx.t(msg({ message: "Default status", context: "settings.defaults.basicDefaults.defaultStatus.name" })),
			{
				type: "dropdown",
				options: Object.fromEntries(
					s.customStatuses.map((status) => [status.value, status.label || status.value])
				),
			}
		),
		ctx.field(
			s,
			"defaultTaskPriority",
			"defaultTaskPriority",
			ctx.t(msg({ message: "Default priority", context: "settings.defaults.basicDefaults.defaultPriority.name" })),
			{
				type: "dropdown",
				options: {
					"": t(msg({ message: "No default", context: "settings.defaults.options.noDefault" })),
					...Object.fromEntries(
						s.customPriorities.map((priority) => [
							priority.value,
							priority.label || priority.value,
						])
					),
				},
			}
		),
		...(["Due", "Scheduled"] as const).flatMap((kind) => {
			const dateKey = `default${kind}Date` as const;
			const timeKey = `default${kind}Time` as const;
			return [
				ctx.field(
					d,
					dateKey,
					`taskCreationDefaults.${dateKey}`,
					t(
						kind === "Due"
							? msg({ message: "Default due date", context: "settings.defaults.dateDefaults.defaultDueDate.name" })
							: msg({ message: "Default scheduled date", context: "settings.defaults.dateDefaults.defaultScheduledDate.name" })
					),
					{ type: "dropdown", options: dateOptions }
				),
				ctx.text(`taskCreationDefaults.${timeKey}`, {
					name: ctx.t(
						kind === "Due"
							? msg({ message: "Default due time", context: "settings.native.defaultDueTime" })
							: msg({ message: "Default scheduled time", context: "settings.native.defaultScheduledTime" })
					),
					desc: ctx.t(msg({ message: "HH:mm. Leave empty for an all-day task.", context: "settings.native.hHMmLeaveEmptyForAnAllDayTask" })),
					getValue: () => (d[timeKey] === "none" ? "" : d[timeKey]),
					validate: (value) =>
						value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
							? ctx.t(msg({ message: "Enter a time from 00:00 to 23:59.", context: "settings.native.validTime" }))
							: undefined,
					setValue: (value) => {
						d[timeKey] = (value || "none") as DefaultTaskTime;
						save();
					},
				}),
			];
		}),
		ctx.field(
			d,
			"defaultContexts",
			"taskCreationDefaults.defaultContexts",
			ctx.t(msg({ message: "Default contexts", context: "settings.defaults.basicDefaults.defaultContexts.name" })),
			{ desc: ctx.t(msg({ message: "Separate contexts with commas.", context: "settings.native.separateContextsWithCommas" })) }
		),
		ctx.field(
			d,
			"defaultTags",
			"taskCreationDefaults.defaultTags",
			ctx.t(msg({ message: "Default tags", context: "settings.defaults.basicDefaults.defaultTags.name" })),
			{
				desc: ctx.t(msg({ message: "Separate tags with commas.", context: "settings.native.separateTagsWithCommas" })),
			}
		),
		ctx.field(
			d,
			"defaultTimeEstimate",
			"taskCreationDefaults.defaultTimeEstimate",
			ctx.t(msg({ message: "Default time estimate (minutes)", context: "settings.native.defaultTimeEstimateMinutes" })),
			{ type: "number", min: 0 }
		),
		ctx.field(
			d,
			"defaultRecurrence",
			"taskCreationDefaults.defaultRecurrence",
			ctx.t(msg({ message: "Default recurrence", context: "settings.defaults.basicDefaults.defaultRecurrence.name" })),
			{
				type: "dropdown",
				options: Object.fromEntries(
					(["none", "daily", "weekly", "monthly", "yearly"] as const).map((value) => [
						value,
						t(`settings.defaults.options.${value}`),
					])
				),
			}
		),
		{
			type: "page",
			name: ctx.t(msg({ message: "Default projects", context: "settings.defaults.basicDefaults.defaultProjects.name" })),
			items: [
				defaultProjects(ctx),
				ctx.field(
					d,
					"useParentNoteForTaskCreation",
					"taskCreationDefaults.useParentNoteForTaskCreation",
					t(msg({ message: "Use active note for new tasks:", context: "settings.taskProperties.projectsCard.useParentNoteForTaskCreation" }))
				),
				ctx.field(
					d,
					"useParentNoteAsProject",
					"taskCreationDefaults.useParentNoteAsProject",
					t(msg({ message: "Use parent note for inline/instant conversion:", context: "settings.taskProperties.projectsCard.useParentNoteForInlineTasks" }))
				),
				ctx.field(
					d,
					"useParentHeaderAsProject",
					"taskCreationDefaults.useParentHeaderAsProject",
					t(msg({ message: "Use parent heading as project:", context: "settings.taskProperties.projectsCard.useParentHeader" }))
				),
				ctx.field(
					d,
					"inheritParentTaskProperties",
					"taskCreationDefaults.inheritParentTaskProperties",
					t(msg({ message: "Inherit parent task properties for subtasks:", context: "settings.taskProperties.projectsCard.inheritParentTaskProperties" }))
				),
			],
		},
		{
			type: "page",
			name: ctx.t(msg({ message: "Default reminders", context: "settings.defaults.header.defaultReminders" })),
			displayValue: () => String(d.defaultReminders?.length ?? 0),
			items: [reminderDefaults(ctx)],
		},
	];
}

function defaultProjects(ctx: SettingsContext): SettingDefinitionList {
	const { plugin, save } = ctx;
	const defaults = plugin.settings.taskCreationDefaults;
	const projects = splitListPreservingLinksAndQuotes(defaults.defaultProjects);
	const set = (values: string[]) => {
		defaults.defaultProjects = values.join(", ");
		save();
		ctx.rebuild();
	};
	return {
		type: "list",
		heading: ctx.t(msg({ message: "Projects", context: "modals.task.organization.projects" })),
		emptyState: ctx.t(msg({ message: "New tasks have no default projects.", context: "settings.native.newTasksHaveNoDefaultProjects" })),
		addItem: {
			name: ctx.t(msg({ message: "Add project", context: "modals.task.projectsAdd" })),
			action: () =>
				new ProjectSelectModal(plugin.app, plugin, (file) => {
					const link = `[[${file.path.replace(/\.md$/, "")}]]`;
					if (!projects.includes(link)) set([...projects, link]);
				}).open(),
		},
		onDelete: (index) => set(projects.filter((_, i) => i !== index)),
		onReorder: (from, to) => set(reorder(projects, from, to)),
		items: projects.map((name) => ({ name })),
	};
}

function reminderDefaults(ctx: SettingsContext): SettingDefinitionList {
	const { plugin, save } = ctx;
	const defaults = plugin.settings.taskCreationDefaults;
	const reminders = defaults.defaultReminders ?? [];
	const commit = () => {
		save();
		ctx.rebuild();
	};
	return {
		type: "list",
		heading: ctx.t(msg({ message: "Reminders", context: "settings.taskProperties.properties.reminders.name" })),
		emptyState: ctx.t(msg({ message: "New tasks have no default reminders.", context: "settings.native.newTasksHaveNoDefaultReminders" })),
		addItem: {
			name: ctx.t(msg({ message: "Add reminder", context: "settings.defaults.reminders.addReminder.buttonText" })),
			action: () => {
				defaults.defaultReminders = [
					...reminders,
					{
						id: crypto.randomUUID(),
						type: "relative",
						relatedTo: "due",
						offset: 1,
						unit: "hours",
						direction: "before",
						description: "",
					},
				];
				commit();
			},
		},
		onDelete: (index) => {
			defaults.defaultReminders = reminders.filter((_, i) => i !== index);
			commit();
		},
		items: reminders.map((reminder, index) => {
			const id = `defaultReminders.${reminder.id}`;
			return {
				type: "page",
				name:
					reminder.description ||
					ctx.t(msg({ message: "Reminder {number}", context: "settings.native.reminderNumber" }), { number: index + 1 }),
				displayValue: () =>
					ctx.t(
						reminder.type === "relative"
							? msg({ message: "Relative (before/after task dates)", context: "settings.defaults.reminders.types.relative" })
							: msg({ message: "Absolute (specific date/time)", context: "settings.defaults.reminders.types.absolute" })
					),
				items: [
					ctx.field(
						reminder,
						"description",
						`${id}.description`,
						ctx.t(msg({ message: "Description:", context: "settings.defaults.reminders.fields.description" }))
					),
					ctx.field(
						reminder,
						"type",
						`${id}.type`,
						ctx.t(msg({ message: "Type:", context: "settings.defaults.reminders.fields.type" })),
						{
							type: "dropdown",
							options: {
								relative: ctx.t(msg({ message: "Relative (before/after task dates)", context: "settings.defaults.reminders.types.relative" })),
								absolute: ctx.t(msg({ message: "Absolute (specific date/time)", context: "settings.defaults.reminders.types.absolute" })),
							},
						}
					),
					ctx.field(
						reminder,
						"offset",
						`${id}.offset`,
						ctx.t(msg({ message: "Offset:", context: "settings.defaults.reminders.fields.offset" })),
						{
							type: "number",
							min: 0,
							disabled: () => reminder.type !== "relative",
						}
					),
					ctx.field(
						reminder,
						"unit",
						`${id}.unit`,
						ctx.t(msg({ message: "Unit:", context: "settings.defaults.reminders.fields.unit" })),
						{
							type: "dropdown",
							options: {
								minutes: ctx.t(msg({ message: "minutes", context: "settings.defaults.reminders.units.minutes" })),
								hours: ctx.t(msg({ message: "hours", context: "settings.defaults.reminders.units.hours" })),
								days: ctx.t(msg({ message: "days", context: "settings.defaults.reminders.units.days" })),
							},
							disabled: () => reminder.type !== "relative",
						}
					),
					ctx.field(
						reminder,
						"direction",
						`${id}.direction`,
						ctx.t(msg({ message: "Direction:", context: "settings.defaults.reminders.fields.direction" })),
						{
							type: "dropdown",
							options: {
								before: ctx.t(msg({ message: "before", context: "settings.defaults.reminders.directions.before" })),
								after: ctx.t(msg({ message: "after", context: "settings.defaults.reminders.directions.after" })),
							},
							disabled: () => reminder.type !== "relative",
						}
					),
					ctx.field(
						reminder,
						"relatedTo",
						`${id}.relatedTo`,
						ctx.t(msg({ message: "Relative to", context: "settings.native.relativeTo" })),
						{
							type: "dropdown",
							options: {
								due: ctx.t(msg({ message: "Due date", context: "settings.taskProperties.properties.due.name" })),
								scheduled: ctx.t(
									msg({ message: "Scheduled date", context: "settings.taskProperties.properties.scheduled.name" })
								),
							},
							disabled: () => reminder.type !== "relative",
						}
					),
					ctx.field(
						reminder,
						"absoluteDate",
						`${id}.absoluteDate`,
						ctx.t(msg({ message: "Date:", context: "settings.defaults.reminders.fields.date" })),
						{
							desc: ctx.t(msg({ message: "YYYY-MM-DD", context: "modals.task.userFields.datePlaceholder" })),
							disabled: () => reminder.type !== "absolute",
							validate: (value) =>
								/^\d{4}-\d{2}-\d{2}$/.test(value) &&
								!Number.isNaN(Date.parse(value)) &&
								new Date(value).toISOString().slice(0, 10) === value
									? undefined
									: ctx.t(msg({ message: "Enter a valid date in YYYY-MM-DD format.", context: "settings.native.validDate" })),
						}
					),
					ctx.field(
						reminder,
						"absoluteTime",
						`${id}.absoluteTime`,
						ctx.t(msg({ message: "Time:", context: "settings.defaults.reminders.fields.time" })),
						{
							desc: ctx.t(msg({ message: "HH:MM", context: "modals.dueDate.inputs.time.placeholder" })),
							disabled: () => reminder.type !== "absolute",
							validate: (value) =>
								/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
									? undefined
									: ctx.t(msg({ message: "Enter a time from 00:00 to 23:59.", context: "settings.native.validTime" })),
						}
					),
				],
			};
		}),
	};
}

export function formDefinitions(ctx: SettingsContext): SettingDefinitionItem[] {
	const { plugin, save } = ctx;
	// Indexing is read-only. A missing configuration is materialised only on change.
	const config = structuredClone(
		initializeFieldConfig(plugin.settings.modalFieldsConfig, plugin.settings.userFields)
	);
	const changed = () => {
		plugin.settings.modalFieldsConfig = config;
	};
	const commit = () => {
		changed();
		save();
		ctx.rebuild();
	};
	return [
		ctx.field(
			plugin.settings,
			"enableModalSplitLayout",
			"enableModalSplitLayout",
			ctx.t(msg({ message: "Split layout on wide screens", context: "settings.native.splitLayoutOnWideScreens" })),
			{ desc: ctx.t(msg({ message: "Show the details editor beside the fields on screens 900px or wider.", context: "settings.native.showTheDetailsEditorBesideTheFieldsOnScreens" })) }
		),
		ctx.field(
			plugin.settings,
			"taskModalTabMovesFocus",
			"taskModalTabMovesFocus",
			ctx.t(msg({ message: "Tab moves focus in details editor", context: "settings.native.tabMovesFocusInDetailsEditor" })),
			{ desc: ctx.t(msg({ message: "When off, the tab key indents text in the Markdown editor.", context: "settings.native.whenOffTabIndentsTextInTheMarkdownEditor" })) }
		),
		ctx.button("form.sync", {
			name: ctx.t(msg({ message: "Sync custom properties", context: "settings.native.syncCustomProperties" })),
			buttonText: ctx.t(msg({ message: "Sync properties", context: "settings.native.syncProperties" })),
			onClick: () => {
				const users = plugin.settings.userFields ?? [];
				config.fields = config.fields.filter(
					(field) =>
						field.fieldType !== "user" || users.some((user) => user.id === field.id)
				);
				for (const user of users) {
					const field = config.fields.find((f) => f.id === user.id);
					if (field) field.displayName = user.displayName;
					else
						config.fields.push({
							id: user.id,
							fieldType: "user",
							group: "custom",
							displayName: user.displayName,
							visibleInCreation: true,
							visibleInEdit: true,
							enabled: true,
							order: config.fields.length,
						});
				}
				commit();
			},
		}),
		...[...config.groups]
			.sort((a, b) => a.order - b.order)
			.map((group) => {
				const fields = config.fields
					.filter((field) => field.group === group.id)
					.sort((a, b) => a.order - b.order);
				return {
					type: "page" as const,
					name: group.displayName,
					items: [
						{
							type: "list" as const,
							heading: group.displayName,
							emptyState: ctx.t(msg({ message: "No fields in this group.", context: "settings.native.noFieldsInThisGroup" })),
							onReorder:
								group.id === "basic"
									? undefined
									: (from: number, to: number) => {
											reorder(fields, from, to).forEach((field, index) => {
												field.order = index;
											});
											commit();
										},
							items: fields.map((field) => ({
								type: "page" as const,
								name: field.displayName || field.id,
								desc:
									field.fieldType === "user"
										? plugin.settings.userFields?.find(
												(user) => user.id === field.id
											)?.key || ctx.t(msg({ message: "No key set", context: "settings.native.noKeySet" }))
										: ctx.t(msg({ message: "ID: {id}", context: "settings.modalFields.manager.fieldId" }), { id: field.id }),
								displayValue: () =>
									field.enabled
										? ctx.t(
												msg({ message: "Enabled", context: "settings.integrations.subscriptionsList.statusLabels.enabled" })
											)
										: ctx.t(
												msg({ message: "Disabled", context: "settings.integrations.subscriptionsList.statusLabels.disabled" })
											),
								items: [
									ctx.field(
										field,
										"enabled",
										`form.${field.id}.enabled`,
										ctx.t(
											msg({ message: "Enabled:", context: "settings.integrations.subscriptionsList.labels.enabled" })
										),
										{
											onChange: changed,
											disabled: () => field.required === true,
										}
									),
									ctx.field(
										field,
										"visibleInCreation",
										`form.${field.id}.creation`,
										ctx.t(msg({ message: "Show when creating tasks", context: "settings.native.showWhenCreatingTasks" })),
										{
											onChange: changed,
											disabled: () =>
												!field.enabled || field.required === true,
										}
									),
									ctx.field(
										field,
										"visibleInEdit",
										`form.${field.id}.edit`,
										ctx.t(msg({ message: "Show when editing tasks", context: "settings.native.showWhenEditingTasks" })),
										{
											onChange: changed,
											disabled: () =>
												!field.enabled || field.required === true,
										}
									),
									ctx.field(
										field,
										"group",
										`form.${field.id}.group`,
										ctx.t(msg({ message: "Group", context: "ui.filterBar.groupMenuHeader" })),
										{
											type: "dropdown",
											options: Object.fromEntries(
												config.groups.map((g) => [g.id, g.displayName])
											),
											disabled: () =>
												field.id === "title" || field.id === "details",
											onChange: () => {
												field.order =
													Math.max(
														-1,
														...config.fields
															.filter(
																(f) =>
																	f.group === field.group &&
																	f.id !== field.id
															)
															.map((f) => f.order)
													) + 1;
												changed();
												ctx.rebuild();
											},
										}
									),
								],
							})),
						},
					],
				};
			}),
		ctx.button("form.reset", {
			name: ctx.t(msg({ message: "Reset form fields", context: "settings.native.resetFormFields" })),
			desc: ctx.t(
				msg({ message: "Restore visibility, grouping, and ordering. Custom properties are kept.", context: "settings.native.restoreVisibilityGroupingAndOrderingCustomPropertiesAreKept" })
			),
			buttonText: ctx.t(msg({ message: "Reset fields", context: "settings.native.resetFields" })),
			onClick: async () => {
				if (
					!(await showConfirmationModal(plugin.app, {
						title: ctx.t(msg({ message: "Reset form fields?", context: "settings.native.resetFormFields2" })),
						message: ctx.t(
							msg({ message: "Your custom field layout will be replaced with the default layout.", context: "settings.native.yourCustomFieldLayoutWillBeReplacedWithThe" })
						),
						confirmText: ctx.t(msg({ message: "Reset fields", context: "settings.native.resetFields" })),
						isDestructive: true,
					}))
				)
					return;
				plugin.settings.modalFieldsConfig = structuredClone(
					initializeFieldConfig(undefined, plugin.settings.userFields)
				);
				save();
				ctx.rebuild();
			},
		}),
	];
}
