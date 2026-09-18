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
			t("settings.taskProperties.titleCard.storeTitleInFilename")
		),
		ctx.field(
			s,
			"taskFilenameFormat",
			"taskFilenameFormat",
			t("settings.appearance.taskFilenames.filenameFormat.name"),
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
			t("settings.taskProperties.titleCard.customTemplate"),
			{
				disabled: () => s.storeTitleInFilename || s.taskFilenameFormat !== "custom",
				desc: t("settings.appearance.taskFilenames.customTemplate.helpText"),
				validate: (value) =>
					/\{[a-zA-Z]+\}/.test(value.replace(/\{\{[a-zA-Z]+\}\}/g, ""))
						? t("settings.taskProperties.titleCard.legacySyntaxWarning")
						: undefined,
			}
		),
		ctx.field(
			s,
			"occurrenceFilenameTemplate",
			"occurrenceFilenameTemplate",
			ctx.t("settings.taskProperties.titleCard.occurrenceFilenameTemplate"),
			{ desc: ctx.t("settings.native.leaveEmptyToUseTheNormalTaskFilenameWith") }
		),
		ctx.field(
			s,
			"occurrenceFilenameTemplateProperty",
			"occurrenceFilenameTemplateProperty",
			ctx.t("settings.native.occurrenceFilenameTemplateProperty"),
			{
				desc: ctx.t("settings.native.aPropertyOnTheParentTaskThatOverridesThe"),
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
		none: t("settings.defaults.options.none"),
		today: t("settings.defaults.options.today"),
		tomorrow: t("settings.defaults.options.tomorrow"),
		"next-week": t("settings.defaults.options.nextWeek"),
	};
	return [
		{
			name: ctx.t("settings.native.defaultsApplyToNewTasks"),
			desc: ctx.t("settings.native.changingTheseValuesDoesNotUpdateExistingTaskNotes"),
		},
		ctx.field(
			s,
			"defaultTaskStatus",
			"defaultTaskStatus",
			ctx.t("settings.defaults.basicDefaults.defaultStatus.name"),
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
			ctx.t("settings.defaults.basicDefaults.defaultPriority.name"),
			{
				type: "dropdown",
				options: {
					"": t("settings.defaults.options.noDefault"),
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
							? "settings.defaults.dateDefaults.defaultDueDate.name"
							: "settings.defaults.dateDefaults.defaultScheduledDate.name"
					),
					{ type: "dropdown", options: dateOptions }
				),
				ctx.text(`taskCreationDefaults.${timeKey}`, {
					name: ctx.t(
						kind === "Due"
							? "settings.native.defaultDueTime"
							: "settings.native.defaultScheduledTime"
					),
					desc: ctx.t("settings.native.hHMmLeaveEmptyForAnAllDayTask"),
					getValue: () => (d[timeKey] === "none" ? "" : d[timeKey]),
					validate: (value) =>
						value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
							? ctx.t("settings.native.validTime")
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
			ctx.t("settings.defaults.basicDefaults.defaultContexts.name"),
			{ desc: ctx.t("settings.native.separateContextsWithCommas") }
		),
		ctx.field(
			d,
			"defaultTags",
			"taskCreationDefaults.defaultTags",
			ctx.t("settings.defaults.basicDefaults.defaultTags.name"),
			{
				desc: ctx.t("settings.native.separateTagsWithCommas"),
			}
		),
		ctx.field(
			d,
			"defaultTimeEstimate",
			"taskCreationDefaults.defaultTimeEstimate",
			ctx.t("settings.native.defaultTimeEstimateMinutes"),
			{ type: "number", min: 0 }
		),
		ctx.field(
			d,
			"defaultRecurrence",
			"taskCreationDefaults.defaultRecurrence",
			ctx.t("settings.defaults.basicDefaults.defaultRecurrence.name"),
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
			name: ctx.t("settings.defaults.basicDefaults.defaultProjects.name"),
			items: [
				defaultProjects(ctx),
				ctx.field(
					d,
					"useParentNoteForTaskCreation",
					"taskCreationDefaults.useParentNoteForTaskCreation",
					t("settings.taskProperties.projectsCard.useParentNoteForTaskCreation")
				),
				ctx.field(
					d,
					"useParentNoteAsProject",
					"taskCreationDefaults.useParentNoteAsProject",
					t("settings.taskProperties.projectsCard.useParentNoteForInlineTasks")
				),
				ctx.field(
					d,
					"useParentHeaderAsProject",
					"taskCreationDefaults.useParentHeaderAsProject",
					t("settings.taskProperties.projectsCard.useParentHeader")
				),
				ctx.field(
					d,
					"inheritParentTaskProperties",
					"taskCreationDefaults.inheritParentTaskProperties",
					t("settings.taskProperties.projectsCard.inheritParentTaskProperties")
				),
			],
		},
		{
			type: "page",
			name: ctx.t("settings.defaults.header.defaultReminders"),
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
		heading: ctx.t("views.stats.labels.projects"),
		emptyState: ctx.t("settings.native.newTasksHaveNoDefaultProjects"),
		addItem: {
			name: ctx.t("modals.task.projectsAdd"),
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
		heading: ctx.t("settings.taskProperties.properties.reminders.name"),
		emptyState: ctx.t("settings.native.newTasksHaveNoDefaultReminders"),
		addItem: {
			name: ctx.t("settings.defaults.reminders.addReminder.buttonText"),
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
					ctx.t("settings.native.reminderNumber", { number: index + 1 }),
				displayValue: () =>
					ctx.t(
						reminder.type === "relative"
							? "settings.defaults.reminders.types.relative"
							: "settings.defaults.reminders.types.absolute"
					),
				items: [
					ctx.field(
						reminder,
						"description",
						`${id}.description`,
						ctx.t("settings.defaults.reminders.fields.description")
					),
					ctx.field(
						reminder,
						"type",
						`${id}.type`,
						ctx.t("settings.defaults.reminders.fields.type"),
						{
							type: "dropdown",
							options: {
								relative: ctx.t("settings.defaults.reminders.types.relative"),
								absolute: ctx.t("settings.defaults.reminders.types.absolute"),
							},
						}
					),
					ctx.field(
						reminder,
						"offset",
						`${id}.offset`,
						ctx.t("settings.defaults.reminders.fields.offset"),
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
						ctx.t("settings.defaults.reminders.fields.unit"),
						{
							type: "dropdown",
							options: {
								minutes: ctx.t("views.pomodoroStats.stats.minutes"),
								hours: ctx.t("settings.defaults.reminders.units.hours"),
								days: ctx.t("settings.defaults.reminders.units.days"),
							},
							disabled: () => reminder.type !== "relative",
						}
					),
					ctx.field(
						reminder,
						"direction",
						`${id}.direction`,
						ctx.t("settings.defaults.reminders.fields.direction"),
						{
							type: "dropdown",
							options: {
								before: ctx.t("settings.defaults.reminders.directions.before"),
								after: ctx.t("settings.defaults.reminders.directions.after"),
							},
							disabled: () => reminder.type !== "relative",
						}
					),
					ctx.field(
						reminder,
						"relatedTo",
						`${id}.relatedTo`,
						ctx.t("settings.native.relativeTo"),
						{
							type: "dropdown",
							options: {
								due: ctx.t("settings.taskProperties.properties.due.name"),
								scheduled: ctx.t(
									"settings.taskProperties.properties.scheduled.name"
								),
							},
							disabled: () => reminder.type !== "relative",
						}
					),
					ctx.field(
						reminder,
						"absoluteDate",
						`${id}.absoluteDate`,
						ctx.t("settings.defaults.reminders.fields.date"),
						{
							desc: ctx.t("modals.task.userFields.datePlaceholder"),
							disabled: () => reminder.type !== "absolute",
							validate: (value) =>
								/^\d{4}-\d{2}-\d{2}$/.test(value) &&
								!Number.isNaN(Date.parse(value)) &&
								new Date(value).toISOString().slice(0, 10) === value
									? undefined
									: ctx.t("settings.native.validDate"),
						}
					),
					ctx.field(
						reminder,
						"absoluteTime",
						`${id}.absoluteTime`,
						ctx.t("settings.defaults.reminders.fields.time"),
						{
							desc: ctx.t("modals.dueDate.inputs.time.placeholder"),
							disabled: () => reminder.type !== "absolute",
							validate: (value) =>
								/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
									? undefined
									: ctx.t("settings.native.validTime"),
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
			ctx.t("settings.native.splitLayoutOnWideScreens"),
			{ desc: ctx.t("settings.native.showTheDetailsEditorBesideTheFieldsOnScreens") }
		),
		ctx.field(
			plugin.settings,
			"taskModalTabMovesFocus",
			"taskModalTabMovesFocus",
			ctx.t("settings.native.tabMovesFocusInDetailsEditor"),
			{ desc: ctx.t("settings.native.whenOffTabIndentsTextInTheMarkdownEditor") }
		),
		ctx.button("form.sync", {
			name: ctx.t("settings.native.syncCustomProperties"),
			buttonText: ctx.t("settings.native.syncProperties"),
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
							emptyState: ctx.t("settings.native.noFieldsInThisGroup"),
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
											)?.key || ctx.t("settings.native.noKeySet")
										: `ID: ${field.id}`,
								displayValue: () =>
									field.enabled
										? ctx.t(
												"settings.integrations.subscriptionsList.statusLabels.enabled"
											)
										: ctx.t(
												"settings.integrations.subscriptionsList.statusLabels.disabled"
											),
								items: [
									ctx.field(
										field,
										"enabled",
										`form.${field.id}.enabled`,
										ctx.t(
											"settings.integrations.subscriptionsList.labels.enabled"
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
										ctx.t("settings.native.showWhenCreatingTasks"),
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
										ctx.t("settings.native.showWhenEditingTasks"),
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
										ctx.t("ui.filterBar.groupMenuHeader"),
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
			name: ctx.t("settings.native.resetFormFields"),
			desc: ctx.t(
				"settings.native.restoreVisibilityGroupingAndOrderingCustomPropertiesAreKept"
			),
			buttonText: ctx.t("settings.native.resetFields"),
			onClick: async () => {
				if (
					!(await showConfirmationModal(plugin.app, {
						title: ctx.t("settings.native.resetFormFields2"),
						message: ctx.t(
							"settings.native.yourCustomFieldLayoutWillBeReplacedWithThe"
						),
						confirmText: ctx.t("settings.native.resetFields"),
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
