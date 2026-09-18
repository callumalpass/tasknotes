import {
	Notice,
	type SettingDefinitionItem,
	type SettingDefinitionList,
	type SettingDefinitionPage,
} from "obsidian";
import type { FieldMapping, StatusConfig, PriorityConfig } from "../../types";
import type { UserMappedField } from "../../types/settings";
import type { FileFilterConfig } from "../../suggest/FileSuggestHelper";
import { showConfirmationModal } from "../../modals/ConfirmationModal";
import { initializeFieldConfig } from "../../utils/fieldConfigDefaults";
import { SettingsContext } from "./SettingsContext";

export function reorder<T>(items: readonly T[], from: number, to: number): T[] {
	const result = [...items];
	if (from < 0 || to < 0 || from >= result.length || to >= result.length) return result;
	result.splice(to, 0, result.splice(from, 1)[0]);
	return result;
}

export function validatePropertyKey(
	ctx: SettingsContext,
	value: string,
	ownId: string
): string | void {
	if (!value.trim()) return ctx.t("settings.native.enterAPropertyKey");
	if (value !== value.trim() || /[\n\r:#[\]{}]/.test(value))
		return ctx.t("settings.native.useAPropertyKeyWithoutSurroundingSpacesLineBreaks");
	const mapping = ctx.plugin.settings.fieldMapping;
	const reservedTags = ownId === "archiveTag" || ownId === "icsEventTag";
	if (reservedTags) return;
	if (value.toLowerCase() === "tags")
		return ctx.t("settings.native.theTagsPropertyIsReservedByObsidian");
	if (
		Object.entries(mapping).some(
			([id, key]) =>
				id !== ownId &&
				id !== "archiveTag" &&
				id !== "icsEventTag" &&
				key.toLowerCase() === value.toLowerCase()
		) ||
		ctx.plugin.settings.userFields?.some(
			(field) => field.id !== ownId && field.key.toLowerCase() === value.toLowerCase()
		)
	)
		return ctx.t("settings.native.anotherPropertyAlreadyUsesThisKey");
}

function triggerPage(ctx: SettingsContext, id: string, fallback: string): SettingDefinitionPage {
	const { plugin, save } = ctx;
	const t = plugin.i18n.translate.bind(plugin.i18n);
	const read = () =>
		plugin.settings.nlpTriggers.triggers.find((trigger) => trigger.propertyId === id);
	const change = (patch: { enabled?: boolean; trigger?: string }) => {
		let trigger = read();
		if (!trigger) {
			trigger = { propertyId: id, enabled: id !== "priority", trigger: fallback };
			plugin.settings.nlpTriggers.triggers.push(trigger);
		}
		Object.assign(trigger, patch);
		save();
	};
	return {
		type: "page",
		name: t("settings.taskProperties.propertyCard.nlpTrigger"),
		displayValue: () => read()?.trigger ?? fallback,
		items: [
			ctx.toggle(`nlp.${id}.enabled`, {
				name: t("settings.taskProperties.propertyCard.nlpTrigger"),
				getValue: () => read()?.enabled ?? id !== "priority",
				setValue: (enabled) => change({ enabled }),
			}),
			ctx.text(`nlp.${id}.trigger`, {
				name: t("settings.taskProperties.propertyCard.triggerChar"),
				getValue: () => read()?.trigger ?? fallback,
				setValue: (trigger) => change({ trigger }),
				validate: (value) =>
					!value.trim()
						? t("settings.taskProperties.propertyCard.triggerEmpty")
						: value.length > 10
							? t("settings.taskProperties.propertyCard.triggerTooLong")
							: undefined,
			}),
		],
	};
}

export function filterPage(
	ctx: SettingsContext,
	id: string,
	read: () => FileFilterConfig | undefined,
	write: (value: FileFilterConfig) => void
): SettingDefinitionPage {
	const t = ctx.plugin.i18n.translate.bind(ctx.plugin.i18n);
	const set = (patch: Partial<FileFilterConfig>) => {
		write({ ...read(), ...patch });
		ctx.save();
	};
	return {
		type: "page",
		name: t("settings.taskProperties.customUserFields.autosuggestFilters.header"),
		displayValue: () => {
			const value = read();
			return value?.requiredTags?.length ||
				value?.includeFolders?.length ||
				value?.propertyKey
				? ctx.t("settings.taskProperties.projectsCard.filtersOn")
				: ctx.t("settings.native.allNotes");
		},
		items: [
			...(["requiredTags", "includeFolders"] as const).map((key) =>
				ctx.text(`${id}.${key}`, {
					name:
						key === "requiredTags"
							? ctx.t("settings.appearance.projectAutosuggest.requiredTags.name")
							: ctx.t("settings.native.includedFolders"),
					desc: ctx.t("settings.native.separateValuesWithCommas"),
					getValue: () => read()?.[key]?.join(", ") ?? "",
					setValue: (value) =>
						set({
							[key]: value
								.split(",")
								.map((item) => item.trim())
								.filter(Boolean),
						}),
				})
			),
			ctx.text(`${id}.propertyKey`, {
				name: ctx.t("settings.native.propertyName"),
				getValue: () => read()?.propertyKey ?? "",
				setValue: (propertyKey) => set({ propertyKey }),
			}),
			ctx.text(`${id}.propertyValue`, {
				name: ctx.t("settings.native.propertyValue"),
				desc: ctx.t("settings.native.leaveEmptyToMatchAnyNoteWithThisProperty"),
				getValue: () => read()?.propertyValue ?? "",
				setValue: (propertyValue) => set({ propertyValue }),
			}),
		],
	};
}

function configuredValues(
	ctx: SettingsContext,
	kind: "status" | "priority"
): SettingDefinitionList {
	const { plugin, save } = ctx;
	const t = plugin.i18n.translate.bind(plugin.i18n);
	const isStatus = kind === "status";
	const values: Array<StatusConfig | PriorityConfig> = isStatus
		? [...plugin.settings.customStatuses].sort((a, b) => a.order - b.order)
		: [...plugin.settings.customPriorities].sort((a, b) => b.weight - a.weight);
	const commit = () => {
		save();
		ctx.rebuild();
	};
	const labelKey = isStatus ? "taskStatuses" : "taskPriorities";
	return {
		type: "list",
		heading: isStatus ? ctx.t("settings.native.statuses") : ctx.t("settings.native.priorities"),
		emptyState: ctx.t("settings.native.noValuesConfigured"),
		addItem: {
			name: isStatus
				? ctx.t("settings.taskProperties.taskStatuses.addNew.buttonText")
				: ctx.t("settings.taskProperties.taskPriorities.addNew.buttonText"),
			action: () => {
				const id = crypto.randomUUID();
				let value = isStatus ? "new-status" : "new-priority";
				let suffix = 2;
				while (values.some((item) => item.value === value)) value = `${kind}-${suffix++}`;
				if (isStatus)
					plugin.settings.customStatuses.push({
						id,
						value,
						label: value,
						color: "var(--text-muted)",
						isCompleted: false,
						order: values.length,
						autoArchive: false,
						autoArchiveDelay: 5,
					});
				else
					plugin.settings.customPriorities.push({
						id,
						value,
						label: value,
						color: "var(--text-muted)",
						weight:
							Math.max(
								0,
								...plugin.settings.customPriorities.map((item) => item.weight)
							) + 1,
					});
				commit();
			},
		},
		onReorder: (from, to) => {
			if (isStatus)
				plugin.settings.customStatuses = reorder(values as StatusConfig[], from, to).map(
					(item, order) => ({ ...item, order })
				);
			else
				plugin.settings.customPriorities = reorder(
					values as PriorityConfig[],
					from,
					to
				).map((item, index) => ({ ...item, weight: values.length - index }));
			commit();
		},
		onDelete: (index) => {
			void (async () => {
				const item = values[index];
				if (!item) return;
				if (values.length <= 1) {
					new Notice(ctx.t("settings.native.keepAtLeastOneConfiguredValue"));
					return;
				}
				if (
					!(await showConfirmationModal(plugin.app, {
						title: ctx.t("settings.native.deleteEntry", {
							name: item.label || item.value,
						}),
						message: ctx.t(
							"settings.native.existingTaskNotesWillNotBeChangedTasksUsing"
						),
						confirmText: ctx.t("views.advancedCalendar.contextMenus.deleteButton"),
						isDestructive: true,
					}))
				)
					return;
				if (isStatus) {
					plugin.settings.customStatuses = plugin.settings.customStatuses.filter(
						(s) => s.id !== item.id
					);
					plugin.settings.customStatuses.forEach((status, order) => {
						status.order = order;
						if (status.nextStatus === item.value) delete status.nextStatus;
					});
					if (plugin.settings.defaultTaskStatus === item.value)
						plugin.settings.defaultTaskStatus = plugin.settings.customStatuses[0].value;
				} else {
					plugin.settings.customPriorities = plugin.settings.customPriorities.filter(
						(p) => p.id !== item.id
					);
					if (plugin.settings.defaultTaskPriority === item.value)
						plugin.settings.defaultTaskPriority = "";
				}
				commit();
			})();
		},
		items: values.map((item) => {
			const id = `${kind}.${item.id}`;
			const fields: SettingDefinitionItem[] = [
				ctx.text(`${id}.value`, {
					name: t(`settings.taskProperties.${labelKey}.fields.value`),
					desc: ctx.t("settings.native.storedInTaskNotesChangingThisDoesNotRename"),
					getValue: () => item.value,
					validate: (value) =>
						!value.trim()
							? ctx.t("settings.native.enterValue")
							: values.some((other) => other.id !== item.id && other.value === value)
								? ctx.t("settings.native.duplicateValue")
								: undefined,
					setValue: (value) => {
						const previous = item.value;
						item.value = value;
						if (isStatus) {
							if (plugin.settings.defaultTaskStatus === previous)
								plugin.settings.defaultTaskStatus = value;
							plugin.settings.customStatuses.forEach((status) => {
								if (status.nextStatus === previous) status.nextStatus = value;
							});
						} else if (plugin.settings.defaultTaskPriority === previous)
							plugin.settings.defaultTaskPriority = value;
						save();
						ctx.rebuild();
					},
				}),
				ctx.field(
					item,
					"label",
					`${id}.label`,
					ctx.t("settings.taskProperties.taskStatuses.fields.label"),
					{ onChange: ctx.rebuild }
				),
				ctx.field(
					item,
					"color",
					`${id}.color`,
					ctx.t("settings.taskProperties.taskStatuses.fields.color"),
					{
						desc: ctx.t("settings.native.aCSSColorOrThemeVariableSuchAsVar"),
					}
				),
				ctx.field(
					item,
					"icon",
					`${id}.icon`,
					ctx.t("settings.taskProperties.taskStatuses.fields.icon"),
					{
						desc: ctx.t(
							"settings.native.lucideIconNameLeaveEmptyForTheDefaultIndicator"
						),
					}
				),
			];
			if ("isCompleted" in item)
				fields.push(
					ctx.field(
						item,
						"isCompleted",
						`${id}.isCompleted`,
						ctx.t("settings.native.countsAsCompleted")
					),
					ctx.field(
						item,
						"isSkipped",
						`${id}.isSkipped`,
						ctx.t("settings.native.countsAsSkipped"),
						{
							type: "toggle",
						}
					),
					ctx.field(
						item,
						"excludeFromCycle",
						`${id}.excludeFromCycle`,
						ctx.t("settings.native.excludeFromStatusCycle"),
						{ type: "toggle" }
					),
					ctx.field(
						item,
						"nextStatus",
						`${id}.nextStatus`,
						ctx.t("settings.taskProperties.taskStatuses.fields.nextStatus"),
						{
							type: "dropdown",
							options: {
								"": ctx.t("settings.native.nextInOrder"),
								...Object.fromEntries(
									values
										.filter((other) => other.id !== item.id)
										.map((other) => [other.value, other.label || other.value])
								),
							},
						}
					),
					{
						type: "page",
						name: ctx.t("settings.native.automaticArchiving"),
						displayValue: () =>
							item.autoArchive
								? ctx.t("settings.native.minutesValue", {
										minutes: item.autoArchiveDelay ?? 0,
									})
								: ctx.t("settings.native.off"),
						items: [
							ctx.field(
								item,
								"autoArchive",
								`${id}.autoArchive`,
								ctx.t("settings.native.automaticallyArchive")
							),
							ctx.field(
								item,
								"autoArchiveDelay",
								`${id}.autoArchiveDelay`,
								ctx.t("settings.taskProperties.taskStatuses.fields.delayMinutes"),
								{
									type: "number",
									min: 1,
									max: 1440,
									disabled: () => !item.autoArchive,
								}
							),
						],
					}
				);
			else
				fields.push(
					ctx.field(item, "weight", `${id}.weight`, ctx.t("settings.native.sortWeight"), {
						type: "number",
						desc: ctx.t("settings.native.higherValuesSortFirst"),
					})
				);
			return {
				type: "page",
				name: item.label || item.value,
				desc: item.value,
				items: fields,
			};
		}),
	};
}

export function customProperties(ctx: SettingsContext): SettingDefinitionList {
	const { plugin, save } = ctx;
	const t = plugin.i18n.translate.bind(plugin.i18n);
	const fields = plugin.settings.userFields ?? [];
	return {
		type: "list",
		heading: t("settings.taskProperties.customUserFields.header"),
		emptyState: t("settings.taskProperties.customUserFields.emptyState"),
		addItem: {
			name: t("settings.taskProperties.customUserFields.addNew.buttonText"),
			action: () => {
				const id = crypto.randomUUID();
				let key = "custom";
				let n = 2;
				while (validatePropertyKey(ctx, key, id)) key = `custom_${n++}`;
				const field: UserMappedField = {
					id,
					key,
					displayName: ctx.t("settings.native.newProperty"),
					type: "text",
				};
				plugin.settings.userFields = [...fields, field];
				const config = structuredClone(
					initializeFieldConfig(plugin.settings.modalFieldsConfig, fields)
				);
				config.fields.push({
					id,
					fieldType: "user",
					group: "custom",
					displayName: field.displayName,
					visibleInCreation: true,
					visibleInEdit: true,
					enabled: true,
					order:
						Math.max(
							-1,
							...config.fields.filter((f) => f.group === "custom").map((f) => f.order)
						) + 1,
				});
				plugin.settings.modalFieldsConfig = config;
				save();
				ctx.rebuild();
			},
		},
		onReorder: (from, to) => {
			plugin.settings.userFields = reorder(fields, from, to);
			save();
			ctx.rebuild();
		},
		onDelete: (index) => {
			void (async () => {
				const field = fields[index];
				if (!field) return;
				if (
					!(await showConfirmationModal(plugin.app, {
						title: ctx.t("settings.native.deleteEntry", {
							name: field.displayName || field.key,
						}),
						message: ctx.t(
							"settings.native.thisRemovesThePropertyFromTaskNotesFormsNotFrom"
						),
						confirmText: ctx.t("settings.native.deleteProperty"),
						isDestructive: true,
					}))
				)
					return;
				plugin.settings.userFields = fields.filter((f) => f.id !== field.id);
				if (plugin.settings.modalFieldsConfig)
					plugin.settings.modalFieldsConfig.fields =
						plugin.settings.modalFieldsConfig.fields.filter((f) => f.id !== field.id);
				plugin.settings.nlpTriggers.triggers = plugin.settings.nlpTriggers.triggers.filter(
					(trigger) => trigger.propertyId !== field.id
				);
				save();
				ctx.rebuild();
			})();
		},
		items: fields.map((field) => {
			const id = `userFields.${field.id}`;
			return {
				type: "page",
				name:
					field.displayName ||
					field.key ||
					t("settings.taskProperties.customUserFields.defaultNames.unnamedField"),
				desc: field.key,
				displayValue: () =>
					t(`settings.taskProperties.customUserFields.types.${field.type}`),
				items: [
					ctx.field(
						field,
						"displayName",
						`${id}.displayName`,
						t("settings.taskProperties.customUserFields.fields.displayName"),
						{
							onChange: () => {
								const modalField = plugin.settings.modalFieldsConfig?.fields.find(
									(f) => f.id === field.id
								);
								if (modalField) modalField.displayName = field.displayName;
								ctx.rebuild();
							},
						}
					),
					ctx.field(
						field,
						"key",
						`${id}.key`,
						t("settings.taskProperties.customUserFields.fields.propertyKey"),
						{
							validate: (value) => validatePropertyKey(ctx, value, field.id),
							onChange: ctx.rebuild,
							desc: ctx.t(
								"settings.native.changingThisKeyDoesNotMigrateExistingNotes"
							),
						}
					),
					ctx.field(
						field,
						"type",
						`${id}.type`,
						t("settings.taskProperties.customUserFields.fields.type"),
						{
							type: "dropdown",
							options: Object.fromEntries(
								(["text", "number", "boolean", "date", "list"] as const).map(
									(type) => [
										type,
										t(`settings.taskProperties.customUserFields.types.${type}`),
									]
								)
							),
							onChange: () => {
								field.defaultValue = field.type === "boolean" ? false : undefined;
								ctx.rebuild();
							},
						}
					),
					customDefault(ctx, field),
					triggerPage(ctx, field.id, `${field.key.slice(0, 9) || "field"}:`),
					filterPage(
						ctx,
						id,
						() => field.autosuggestFilter,
						(value) => {
							field.autosuggestFilter = value;
						}
					),
				],
			};
		}),
	};
}

function customDefault(ctx: SettingsContext, field: UserMappedField): SettingDefinitionItem {
	const name = ctx.plugin.i18n.translate(
		"settings.taskProperties.customUserFields.fields.defaultValue"
	);
	const key = `userFields.${field.id}.defaultValue`;
	if (field.type === "boolean")
		return ctx.field(field, "defaultValue", key, name, { type: "toggle" });
	if (field.type === "date")
		return ctx.dropdown(key, {
			name,
			options: ["none", "today", "tomorrow", "next-week"].map((value) => ({
				value,
				label: ctx.t(
					`settings.defaults.options.${value === "next-week" ? "nextWeek" : value}`
				),
			})),
			getValue: () => String(field.defaultValue ?? "none"),
			setValue: (value) => {
				field.defaultValue = value === "none" ? undefined : value;
				ctx.save();
			},
		});
	return ctx.text(key, {
		name,
		desc:
			field.type === "list"
				? ctx.t("settings.native.separateValuesWithCommas")
				: ctx.t("settings.native.noDefaultHint"),
		getValue: () =>
			Array.isArray(field.defaultValue)
				? field.defaultValue.join(", ")
				: String(field.defaultValue ?? ""),
		validate: (value) =>
			field.type === "number" && value.trim() && !Number.isFinite(Number(value))
				? ctx.t("settings.native.optionalNumber")
				: undefined,
		setValue: (value) => {
			field.defaultValue = !value.trim()
				? undefined
				: field.type === "list"
					? value
							.split(",")
							.map((v) => v.trim())
							.filter(Boolean)
					: field.type === "number"
						? Number(value)
						: value;
			ctx.save();
		},
	});
}

export function propertyDefinitions(ctx: SettingsContext): SettingDefinitionItem[] {
	const { plugin } = ctx;
	const t = plugin.i18n.translate.bind(plugin.i18n);
	const mapping = plugin.settings.fieldMapping;
	const labels: Partial<Record<keyof FieldMapping, string>> = {
		title: ctx.t("settings.taskProperties.properties.title.name"),
		status: ctx.t("settings.taskProperties.properties.status.name"),
		priority: ctx.t("settings.taskProperties.properties.priority.name"),
		due: ctx.t("settings.taskProperties.properties.due.name"),
		scheduled: ctx.t("settings.taskProperties.properties.scheduled.name"),
		contexts: ctx.t("settings.taskProperties.properties.contexts.name"),
		projects: ctx.t("views.stats.labels.projects"),
		timeEstimate: ctx.t("settings.taskProperties.properties.timeEstimate.name"),
		recurrence: ctx.t("settings.taskProperties.properties.recurrence.name"),
		reminders: ctx.t("settings.taskProperties.properties.reminders.name"),
	};
	const triggers: Record<string, string> = {
		status: "status:",
		priority: "!",
		contexts: "@",
		projects: "+",
	};
	const pages: SettingDefinitionPage[] = Object.keys(mapping).map((key) => {
		const property = key as keyof FieldMapping;
		const items: SettingDefinitionItem[] = [
			ctx.field(
				mapping,
				property,
				`fieldMapping.${property}`,
				t("settings.taskProperties.propertyCard.propertyKey"),
				{
					validate: (value) => validatePropertyKey(ctx, value, property),
					onChange: ctx.rebuild,
					disabled: () => property === "title" && plugin.settings.storeTitleInFilename,
					desc: ctx.t(
						"settings.native.changingThisMappingDoesNotRenamePropertiesInExisting"
					),
				}
			),
		];
		if (property in triggers) items.push(triggerPage(ctx, property, triggers[property]));
		if (property === "status" || property === "priority")
			items.push(configuredValues(ctx, property));
		if (property === "projects") {
			const get = () => plugin.settings.projectAutosuggest;
			items.push(
				filterPage(ctx, "projectAutosuggest", get, (value) => {
					plugin.settings.projectAutosuggest = {
						enableFuzzy: false,
						rows: [],
						...get(),
						...value,
					};
				}),
				{
					type: "page",
					name: t("settings.taskProperties.projectsCard.customizeDisplay"),
					items: [
						ctx.toggle("projectAutosuggest.enableFuzzy", {
							name: t(
								"settings.appearance.projectAutosuggest.enableFuzzyMatching.name"
							),
							getValue: () => get()?.enableFuzzy ?? false,
							setValue: (enableFuzzy) => {
								plugin.settings.projectAutosuggest = {
									rows: [],
									...get(),
									enableFuzzy,
								};
								ctx.save();
							},
						}),
						...[0, 1, 2].map((index) =>
							ctx.text(`projectAutosuggest.rows.${index}`, {
								name: ctx.t("settings.native.displayRow", { number: index + 1 }),
								desc: t("settings.appearance.projectAutosuggest.displayRowsHelp"),
								getValue: () => get()?.rows[index] ?? "",
								setValue: (value) => {
									const config = {
										enableFuzzy: false,
										...get(),
										rows: [...(get()?.rows ?? [])],
									};
									config.rows[index] = value;
									plugin.settings.projectAutosuggest = config;
									ctx.save();
								},
							})
						),
					],
				}
			);
		}
		return {
			type: "page",
			name:
				labels[property] ??
				property.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
			displayValue: () => mapping[property],
			items,
		};
	});
	const core = new Set(Object.keys(labels));
	return [
		{
			type: "group",
			heading: t("settings.taskProperties.sections.coreProperties"),
			items: pages.filter((_, index) => core.has(Object.keys(mapping)[index])),
		},
		{
			type: "page",
			name: ctx.t("settings.native.metadataIntegrationProperties"),
			desc: ctx.t(
				"settings.native.timestampsRecurrenceRecordsOrderingAndLinkedCalendarEvents"
			),
			items: pages.filter((_, index) => !core.has(Object.keys(mapping)[index])),
		},
		{
			type: "page",
			name: ctx.t("settings.taskProperties.properties.tags.name"),
			items: [triggerPage(ctx, "tags", "#")],
		},
		customProperties(ctx),
	];
}
