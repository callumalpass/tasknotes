import { Notice, Platform, type SettingDefinitionItem, type SettingDefinitionPage } from "obsidian";
import { SettingsContext } from "./SettingsContext";
import { formatDateLabel } from "../../utils/dateUtils";
import { showConfirmationModal } from "../../modals/ConfirmationModal";
import { loadAPIEndpoints } from "../../api/loadAPIEndpoints";
import { GOOGLE_CALENDAR_CONSTANTS } from "../../services/constants";
import { connectionPage, subscriptionList, webhookList } from "./connections";

export function calendarDefinitions(ctx: SettingsContext): SettingDefinitionItem[] {
	const { plugin } = ctx;
	const s = plugin.settings;
	const t = plugin.i18n.translate.bind(plugin.i18n);
	const ics = s.icsIntegration;
	const google = s.googleCalendarExport;
	const field = <T extends object, K extends keyof T>(
		object: T,
		property: K,
		id: string,
		prefix: string,
		options?: Record<string, string>,
		bounds?: { min: number; max: number }
	) =>
		ctx.field(object, property, id, t(`${prefix}.name`), {
			desc: t(`${prefix}.description`),
			...(options ? { type: "dropdown" as const, options } : {}),
			...bounds,
		});
	const notePrefix = "settings.integrations.calendarSubscriptions";
	const exportPrefix = "settings.integrations.autoExport";
	const formatExportTime = (date: Date | null | undefined): string =>
		date ? formatDateLabel(date, plugin.settings, undefined, true) : "—";
	const googlePrefix = "settings.integrations.googleCalendarExport";
	return [
		{
			name: ctx.t("settings.native.calendarSetupGuide"),
			desc: ctx.t("settings.native.connectAGoogleOrMicrosoftCalendarUsingYourOwn"),
			action: () =>
				window.open("https://callumalpass.github.io/tasknotes/calendar-setup", "_blank"),
		},
		field(
			s,
			"disableCalendarOnMobile",
			"disableCalendarOnMobile",
			"settings.integrations.mobileCalendar.disable"
		),
		connectionPage(ctx, "google"),
		connectionPage(ctx, "microsoft"),
		{
			type: "page",
			name: t("settings.integrations.subscriptionsList.header"),
			displayValue: () =>
				String(plugin.icsSubscriptionService?.getSubscriptions().length ?? 0),
			items: [
				subscriptionList(ctx),
				ctx.button("ics.refreshAll", {
					name: t("settings.integrations.subscriptionsList.refreshAll.name"),
					buttonText: t("settings.integrations.subscriptionsList.refreshAll.buttonText"),
					onClick: async () => {
						if (!plugin.icsSubscriptionService)
							throw new Error(
								ctx.t("settings.native.calendarSubscriptionServiceUnavailable")
							);
						await plugin.icsSubscriptionService.refreshAllSubscriptions();
						ctx.rebuild();
					},
				}),
			],
		},
		{
			type: "page",
			name: t("settings.integrations.calendarSubscriptions.header"),
			desc: t("settings.integrations.calendarSubscriptions.description"),
			items: [
				ctx.field(
					ics,
					"defaultNoteTemplate",
					"icsIntegration.defaultNoteTemplate",
					t(`${notePrefix}.defaultNoteTemplate.name`),
					{ type: "file", desc: t(`${notePrefix}.defaultNoteTemplate.description`) }
				),
				ctx.field(
					ics,
					"defaultNoteFolder",
					"icsIntegration.defaultNoteFolder",
					t(`${notePrefix}.defaultNoteFolder.name`),
					{ type: "folder", desc: t(`${notePrefix}.defaultNoteFolder.description`) }
				),
				field(
					ics,
					"icsNoteFilenameFormat",
					"icsIntegration.icsNoteFilenameFormat",
					`${notePrefix}.filenameFormat`,
					Object.fromEntries(
						(["title", "zettel", "timestamp", "custom"] as const).map((value) => [
							value,
							t(`${notePrefix}.filenameFormat.options.${value}`),
						])
					)
				),
				ctx.field(
					ics,
					"customICSNoteFilenameTemplate",
					"icsIntegration.customICSNoteFilenameTemplate",
					t(`${notePrefix}.customTemplate.name`),
					{
						desc: t(`${notePrefix}.customTemplate.description`),
						disabled: () => ics.icsNoteFilenameFormat !== "custom",
					}
				),
				field(
					ics,
					"useICSEndAsDue",
					"icsIntegration.useICSEndAsDue",
					`${notePrefix}.useICSEndAsDue`
				),
				field(
					ics,
					"recurringEventRelatedNotesMode",
					"icsIntegration.recurringEventRelatedNotesMode",
					`${notePrefix}.recurringEventRelatedNotesMode`,
					{
						series: t(`${notePrefix}.recurringEventRelatedNotesMode.options.series`),
						instance: t(
							`${notePrefix}.recurringEventRelatedNotesMode.options.instance`
						),
					}
				),
			],
		},
		{
			type: "page",
			name: t(`${googlePrefix}.header`),
			desc: t(`${googlePrefix}.description`),
			items: [
				field(google, "enabled", "googleCalendarExport.enabled", `${googlePrefix}.enable`),
				ctx.field(
					google,
					"targetCalendarId",
					"googleCalendarExport.targetCalendarId",
					t(`${googlePrefix}.targetCalendar.name`),
					{
						type: "dropdown",
						desc: t(`${googlePrefix}.targetCalendar.description`),
						options: {
							"": t(`${googlePrefix}.targetCalendar.placeholder`),
							...(google.targetCalendarId
								? { [google.targetCalendarId]: google.targetCalendarId }
								: {}),
							...Object.fromEntries(
								(plugin.googleCalendarService?.getAvailableCalendars() ?? []).map(
									(calendar) => [calendar.id, calendar.summary]
								)
							),
						},
					}
				),
				field(
					google,
					"syncTrigger",
					"googleCalendarExport.syncTrigger",
					`${googlePrefix}.syncTrigger`,
					Object.fromEntries(
						(["scheduled", "due", "both"] as const).map((value) => [
							value,
							t(`${googlePrefix}.syncTrigger.options.${value}`),
						])
					)
				),
				field(
					google,
					"createAsAllDay",
					"googleCalendarExport.createAsAllDay",
					`${googlePrefix}.allDayEvents`
				),
				field(
					google,
					"defaultEventDuration",
					"googleCalendarExport.defaultEventDuration",
					`${googlePrefix}.defaultDuration`,
					undefined,
					{ min: 15, max: 480 }
				),
				field(
					google,
					"eventTitleTemplate",
					"googleCalendarExport.eventTitleTemplate",
					`${googlePrefix}.eventTitleTemplate`
				),
				field(
					google,
					"includeDescription",
					"googleCalendarExport.includeDescription",
					`${googlePrefix}.includeDescription`
				),
				field(
					google,
					"includeObsidianLink",
					"googleCalendarExport.includeObsidianLink",
					`${googlePrefix}.includeObsidianLink`
				),
				ctx.text("googleCalendarExport.defaultReminderMinutes", {
					name: t(`${googlePrefix}.defaultReminder.name`),
					desc: t(`${googlePrefix}.defaultReminder.description`),
					getValue: () =>
						Array.isArray(google.defaultReminderMinutes)
							? google.defaultReminderMinutes.join(", ")
							: String(google.defaultReminderMinutes ?? ""),
					validate: (value) =>
						value.trim() &&
						value
							.split(/[,\s]+/)
							.some(
								(part) =>
									!/^\d+$/.test(part) ||
									Number(part) < 1 ||
									Number(part) > GOOGLE_CALENDAR_CONSTANTS.MAX_REMINDER_MINUTES
							)
							? `Enter reminder offsets from 1 to ${GOOGLE_CALENDAR_CONSTANTS.MAX_REMINDER_MINUTES} minutes, separated by commas.`
							: undefined,
					setValue: (value) => {
						const values = [
							...new Set(
								value
									.trim()
									.split(/[,\s]+/)
									.filter(Boolean)
									.map(Number)
							),
						];
						google.defaultReminderMinutes =
							values.length === 0 ? null : values.length === 1 ? values[0] : values;
						ctx.save();
					},
				}),
				{
					type: "page",
					name: t(`${googlePrefix}.automaticSyncBehavior.header`),
					items: [
						...(
							[
								["syncOnTaskCreate", "syncOnCreate"],
								["syncOnTaskUpdate", "syncOnUpdate"],
								["syncOnTaskComplete", "syncOnComplete"],
								["syncOnTaskDelete", "syncOnDelete"],
							] as const
						).map(([key, name]) =>
							field(
								google,
								key,
								`googleCalendarExport.${key}`,
								`${googlePrefix}.${name}`
							)
						),
					],
				},
				ctx.button("google.syncAll", {
					name: t(`${googlePrefix}.syncAllTasks.name`),
					desc: t(`${googlePrefix}.syncAllTasks.description`),
					buttonText: t(`${googlePrefix}.syncAllTasks.buttonText`),
					onClick: async () => {
						if (!plugin.taskCalendarSyncService?.isEnabled())
							throw new Error(t(`${googlePrefix}.notices.notEnabledOrConfigured`));
						const results = await plugin.taskCalendarSyncService.syncAllTasks();
						new Notice(t(`${googlePrefix}.notices.syncResults`, results));
					},
				}),
				ctx.button("google.unlinkAll", {
					name: t(`${googlePrefix}.unlinkAllTasks.name`),
					desc: t(`${googlePrefix}.unlinkAllTasks.description`),
					buttonText: t(`${googlePrefix}.unlinkAllTasks.buttonText`),
					onClick: async () => {
						if (!plugin.taskCalendarSyncService)
							throw new Error(t(`${googlePrefix}.notices.serviceNotAvailable`));
						if (
							await showConfirmationModal(plugin.app, {
								title: t(`${googlePrefix}.unlinkAllTasks.confirmTitle`),
								message: t(`${googlePrefix}.unlinkAllTasks.confirmMessage`),
								confirmText: t(`${googlePrefix}.unlinkAllTasks.confirmButtonText`),
								isDestructive: true,
							})
						)
							await plugin.taskCalendarSyncService.unlinkAllTasks(false);
					},
				}),
			],
		},
		{
			type: "page",
			name: t(`${exportPrefix}.header`),
			desc: t(`${exportPrefix}.description`),
			items: [
				ctx.field(
					ics,
					"enableAutoExport",
					"icsIntegration.enableAutoExport",
					t(`${exportPrefix}.enable.name`),
					{
						desc: t(`${exportPrefix}.enable.description`),
						onChange: () => new Notice(t(`${exportPrefix}.notices.reloadRequired`)),
					}
				),
				field(
					ics,
					"autoExportPath",
					"icsIntegration.autoExportPath",
					`${exportPrefix}.filePath`
				),
				ctx.number("icsIntegration.autoExportInterval", {
					name: t(`${exportPrefix}.interval.name`),
					desc: t(`${exportPrefix}.interval.description`),
					min: 5,
					max: 1440,
					getValue: () => ics.autoExportInterval,
					setValue: (value) => {
						ics.autoExportInterval = value;
						ctx.save();
						plugin.autoExportService?.updateInterval(value);
					},
				}),
				...(
					[
						["useDurationForExport", "useDuration"],
						["excludeCompletedFromExport", "excludeCompleted"],
						["excludeArchivedFromExport", "excludeArchived"],
						["requireDueDateForExport", "requireDueDate"],
						["requireScheduledDateForExport", "requireScheduledDate"],
					] as const
				).map(([key, name]) =>
					field(ics, key, `icsIntegration.${key}`, `${exportPrefix}.${name}`)
				),
				ctx.button("ics.exportNow", {
					name: t(`${exportPrefix}.exportNow.name`),
					buttonText: t(`${exportPrefix}.exportNow.buttonText`),
					onClick: async () => {
						if (!plugin.autoExportService)
							throw new Error(t(`${exportPrefix}.notices.serviceUnavailable`));
						await plugin.autoExportService.exportNow();
						new Notice(t(`${exportPrefix}.notices.exportSuccess`));
						ctx.rebuild();
					},
				}),
				{
					name: t(`${exportPrefix}.status.title`),
					render: (setting) => {
						setting.setDesc(
							plugin.autoExportService
								? `${t(`${exportPrefix}.status.lastExport`, { time: formatExportTime(plugin.autoExportService.getLastExportTime()) })}\n${t(`${exportPrefix}.status.nextExport`, { time: formatExportTime(plugin.autoExportService.getNextExportTime()) })}`
								: t(`${exportPrefix}.status.serviceNotInitialized`)
						);
					},
				},
			],
		},
	];
}

export function apiDefinitions(ctx: SettingsContext): SettingDefinitionPage {
	const { plugin } = ctx;
	const s = plugin.settings;
	const t = plugin.i18n.translate.bind(plugin.i18n);
	const prefix = "settings.integrations.httpApi";
	return {
		type: "page",
		name: t(`${prefix}.header`),
		visible: () => !Platform.isMobile,
		items: [
			ctx.field(s, "enableAPI", "enableAPI", t(`${prefix}.enable.name`), {
				desc: t(`${prefix}.enable.description`),
			}),
			ctx.field(s, "apiPort", "apiPort", t(`${prefix}.port.name`), {
				type: "number",
				min: 1024,
				max: 65535,
				desc: t(`${prefix}.port.description`),
				disabled: () => !s.enableAPI,
			}),
			{
				name: t(`${prefix}.authToken.name`),
				desc: t(`${prefix}.authToken.description`),
				aliases: ["apiAuthToken", "authentication", "password"],
				render: (setting) => {
					setting.addText((text) => {
						text.inputEl.type = "password";
						text.inputEl.autocomplete = "off";
						text.setValue(s.apiAuthToken).onChange((value) => {
							s.apiAuthToken = value;
							ctx.save();
						});
					});
				},
			},
			ctx.field(s, "enableMCP", "enableMCP", t(`${prefix}.mcp.enable.name`), {
				desc: t(`${prefix}.mcp.enable.description`),
				disabled: () => !s.enableAPI,
			}),
			{
				type: "page",
				name: t(`${prefix}.endpoints.header`),
				items: [
					{
						name: t(`${prefix}.endpoints.header`),
						render: (setting) => {
							const details = setting.descEl.createDiv();
							void loadAPIEndpoints(details, s.apiPort, {
								apiAuthToken: s.apiAuthToken,
							});
						},
					},
				],
			},
			{
				type: "page",
				name: t("settings.integrations.webhooks.header"),
				items: [webhookList(ctx)],
			},
		],
	};
}
