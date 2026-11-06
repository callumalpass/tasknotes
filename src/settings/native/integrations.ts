import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "../../i18n";
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
	const t = ctx.t;
	const ics = s.icsIntegration;
	const google = s.googleCalendarExport;
	const field = <T extends object, K extends keyof T>(
		object: T,
		property: K,
		id: string,
		labels: { name: MessageDescriptor; description: MessageDescriptor },
		options?: Record<string, string>,
		bounds?: { min: number; max: number }
	) =>
		ctx.field(object, property, id, t(labels.name), {
			desc: t(labels.description),
			...(options ? { type: "dropdown" as const, options } : {}),
			...bounds,
		});
	const formatExportTime = (date: Date | null | undefined): string =>
		date ? formatDateLabel(date, plugin.settings, undefined, true) : "—";
	return [
		{
			name: ctx.t(msg({ message: "Calendar setup guide", context: "settings.native.calendarSetupGuide" })),
			desc: ctx.t(msg({ message: "Connect a Google or Microsoft calendar using credentials from your own developer application.", context: "settings.native.connectAGoogleOrMicrosoftCalendarUsingYourOwn" })),
			action: () =>
				window.open("https://callumalpass.github.io/tasknotes/calendar-setup", "_blank"),
		},
		field(
			s,
			"disableCalendarOnMobile",
			"disableCalendarOnMobile",
			{ name: msg({ message: "Disable calendar integrations on mobile", context: "settings.integrations.mobileCalendar.disable.name" }), description: msg({ message: "Skip Google, Microsoft, and ICS calendar loading on Obsidian mobile. Desktop calendar integrations are unchanged.", context: "settings.integrations.mobileCalendar.disable.description" }) }
		),
		connectionPage(ctx, "google"),
		connectionPage(ctx, "microsoft"),
		{
			type: "page",
			name: t(msg({ message: "Calendar subscriptions list", context: "settings.integrations.subscriptionsList.header" })),
			displayValue: () =>
				String(plugin.icsSubscriptionService?.getSubscriptions().length ?? 0),
			items: [
				subscriptionList(ctx),
				ctx.button("ics.refreshAll", {
					name: t(msg({ message: "Refresh all subscriptions", context: "settings.integrations.subscriptionsList.refreshAll.name" })),
					buttonText: t(msg({ message: "Refresh all", context: "settings.integrations.subscriptionsList.refreshAll.buttonText" })),
					onClick: async () => {
						if (!plugin.icsSubscriptionService)
							throw new Error(
								ctx.t(msg({ message: "Calendar subscription service unavailable.", context: "settings.native.calendarSubscriptionServiceUnavailable" }))
							);
						await plugin.icsSubscriptionService.refreshAllSubscriptions();
						ctx.rebuild();
					},
				}),
			],
		},
		{
			type: "page",
			name: t(msg({ message: "Calendar subscriptions", context: "settings.integrations.calendarSubscriptions.header" })),
			desc: t(msg({ message: "Subscribe to external calendars via ICS/iCal URLs to view events alongside your tasks.", context: "settings.integrations.calendarSubscriptions.description" })),
			items: [
				ctx.field(
					ics,
					"defaultNoteTemplate",
					"icsIntegration.defaultNoteTemplate",
					t(msg({ message: "Default note template", context: "settings.integrations.calendarSubscriptions.defaultNoteTemplate.name" })),
					{ type: "file", desc: t(msg({ message: "Path to template file for notes created from ICS events", context: "settings.integrations.calendarSubscriptions.defaultNoteTemplate.description" })) }
				),
				ctx.field(
					ics,
					"defaultNoteFolder",
					"icsIntegration.defaultNoteFolder",
					t(msg({ message: "Default note folder", context: "settings.integrations.calendarSubscriptions.defaultNoteFolder.name" })),
					{ type: "folder", desc: t(msg({ message: "Folder for notes created from ICS events", context: "settings.integrations.calendarSubscriptions.defaultNoteFolder.description" })) }
				),
				field(
					ics,
					"icsNoteFilenameFormat",
					"icsIntegration.icsNoteFilenameFormat",
					{ name: msg({ message: "ICS note filename format", context: "settings.integrations.calendarSubscriptions.filenameFormat.name" }), description: msg({ message: "How filenames are generated for notes created from ICS events", context: "settings.integrations.calendarSubscriptions.filenameFormat.description" }) },
					Object.fromEntries(
						(["title", "zettel", "timestamp", "custom"] as const).map((value) => [
							value,
							t({ "title": msg({ message: "Event title", context: "settings.integrations.calendarSubscriptions.filenameFormat.options.title" }), "zettel": msg({ message: "Zettelkasten format", context: "settings.integrations.calendarSubscriptions.filenameFormat.options.zettel" }), "timestamp": msg({ message: "Timestamp", context: "settings.integrations.calendarSubscriptions.filenameFormat.options.timestamp" }), "custom": msg({ message: "Custom template", context: "settings.integrations.calendarSubscriptions.filenameFormat.options.custom" }) }[value]),
						])
					)
				),
				ctx.field(
					ics,
					"customICSNoteFilenameTemplate",
					"icsIntegration.customICSNoteFilenameTemplate",
					t(msg({ message: "Custom ICS filename template", context: "settings.integrations.calendarSubscriptions.customTemplate.name" })),
					{
						desc: t(msg({ message: "Template for custom ICS event filenames", context: "settings.integrations.calendarSubscriptions.customTemplate.description" })),
						disabled: () => ics.icsNoteFilenameFormat !== "custom",
					}
				),
				field(
					ics,
					"useICSEndAsDue",
					"icsIntegration.useICSEndAsDue",
					{ name: msg({ message: "Use ICS event end time as task due date", context: "settings.integrations.calendarSubscriptions.useICSEndAsDue.name" }), description: msg({ message: "When enabled, tasks created from calendar events will have their due date set to the event''s end time. For all-day events, the due date will be set to the event date. For timed events, the due date will include the end time.", context: "settings.integrations.calendarSubscriptions.useICSEndAsDue.description" }) }
				),
				field(
					ics,
					"recurringEventRelatedNotesMode",
					"icsIntegration.recurringEventRelatedNotesMode",
					{ name: msg({ message: "Recurring event related notes", context: "settings.integrations.calendarSubscriptions.recurringEventRelatedNotesMode.name" }), description: msg({ message: "Choose whether notes linked to one recurrence of an external calendar event appear across the loaded series or only on the selected instance.", context: "settings.integrations.calendarSubscriptions.recurringEventRelatedNotesMode.description" }) },
					{
						series: t(msg({ message: "Series-wide", context: "settings.integrations.calendarSubscriptions.recurringEventRelatedNotesMode.options.series" })),
						instance: t(
							msg({ message: "Selected instance only", context: "settings.integrations.calendarSubscriptions.recurringEventRelatedNotesMode.options.instance" })
						),
					}
				),
			],
		},
		{
			type: "page",
			name: t(msg({ message: "Export tasks to Google Calendar", context: "settings.integrations.googleCalendarExport.header" })),
			desc: t(msg({ message: "Automatically sync your tasks to Google Calendar as events. Requires Google Calendar to be connected above.", context: "settings.integrations.googleCalendarExport.description" })),
			items: [
				field(google, "enabled", "googleCalendarExport.enabled", { name: msg({ message: "Enable task export", context: "settings.integrations.googleCalendarExport.enable.name" }), description: msg({ message: "When enabled, tasks with dates will be automatically synced to Google Calendar as events.", context: "settings.integrations.googleCalendarExport.enable.description" }) }),
				ctx.field(
					google,
					"targetCalendarId",
					"googleCalendarExport.targetCalendarId",
					t(msg({ message: "Target calendar", context: "settings.integrations.googleCalendarExport.targetCalendar.name" })),
					{
						type: "dropdown",
						desc: t(msg({ message: "Select which calendar to create task events in.", context: "settings.integrations.googleCalendarExport.targetCalendar.description" })),
						options: {
							"": t(msg({ message: "Select a calendar...", context: "settings.integrations.googleCalendarExport.targetCalendar.placeholder" })),
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
					{ name: msg({ message: "Sync trigger", context: "settings.integrations.googleCalendarExport.syncTrigger.name" }), description: msg({ message: "Which task date should trigger calendar event creation.", context: "settings.integrations.googleCalendarExport.syncTrigger.description" }) },
					Object.fromEntries(
						(["scheduled", "due", "both"] as const).map((value) => [
							value,
							t({ "scheduled": msg({ message: "Scheduled date", context: "settings.integrations.googleCalendarExport.syncTrigger.options.scheduled" }), "due": msg({ message: "Due date", context: "settings.integrations.googleCalendarExport.syncTrigger.options.due" }), "both": msg({ message: "Both (prefer scheduled)", context: "settings.integrations.googleCalendarExport.syncTrigger.options.both" }) }[value]),
						])
					)
				),
				field(
					google,
					"createAsAllDay",
					"googleCalendarExport.createAsAllDay",
					{ name: msg({ message: "Create as all-day events", context: "settings.integrations.googleCalendarExport.allDayEvents.name" }), description: msg({ message: "When enabled, tasks are created as all-day events. When disabled, uses time estimate for duration.", context: "settings.integrations.googleCalendarExport.allDayEvents.description" }) }
				),
				field(
					google,
					"showAllDayAsFree",
					"googleCalendarExport.showAllDayAsFree",
					{ name: msg({ message: "Show all-day task events as free", context: "settings.integrations.googleCalendarExport.showAllDayAsFree.name" }), description: msg({ message: "All-day task exports do not block availability, including tasks converted to all-day. Timed events stay busy. Run sync all tasks to apply changes to existing events.", context: "settings.integrations.googleCalendarExport.showAllDayAsFree.description" }) }
				),
				field(
					google,
					"defaultEventDuration",
					"googleCalendarExport.defaultEventDuration",
					{ name: msg({ message: "Default event duration", context: "settings.integrations.googleCalendarExport.defaultDuration.name" }), description: msg({ message: "Duration in minutes for timed events (used when task has no time estimate).", context: "settings.integrations.googleCalendarExport.defaultDuration.description" }) },
					undefined,
					{ min: 15, max: 480 }
				),
				field(
					google,
					"eventTitleTemplate",
					"googleCalendarExport.eventTitleTemplate",
					{ name: msg({ message: "Event title template", context: "settings.integrations.googleCalendarExport.eventTitleTemplate.name" }), description: msg({ message: "Template for event titles. Available variables: '{{title}}', '{{status}}', '{{priority}}'", context: "settings.integrations.googleCalendarExport.eventTitleTemplate.description" }) }
				),
				field(
					google,
					"includeDescription",
					"googleCalendarExport.includeDescription",
					{ name: msg({ message: "Include task details in description", context: "settings.integrations.googleCalendarExport.includeDescription.name" }), description: msg({ message: "Add task metadata (priority, status, tags, etc.) to the event description.", context: "settings.integrations.googleCalendarExport.includeDescription.description" }) }
				),
				field(
					google,
					"includeObsidianLink",
					"googleCalendarExport.includeObsidianLink",
					{ name: msg({ message: "Include Obsidian link", context: "settings.integrations.googleCalendarExport.includeObsidianLink.name" }), description: msg({ message: "Add a link back to the task in Obsidian in the event description.", context: "settings.integrations.googleCalendarExport.includeObsidianLink.description" }) }
				),
				ctx.text("googleCalendarExport.defaultReminderMinutes", {
					name: t(msg({ message: "Default reminder", context: "settings.integrations.googleCalendarExport.defaultReminder.name" })),
					desc: t(msg({ message: "Add popup reminders to timed Google Calendar events. Enter minutes before the event, separated by commas. Leave empty to use calendar defaults. Common values: 15, 30, 60, 1440.", context: "settings.integrations.googleCalendarExport.defaultReminder.description" })),
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
							? t(msg({ message: "Enter reminder offsets from 1 to {max} minutes, separated by commas.", context: "settings.native.reminderOffsetRange" }), { max: GOOGLE_CALENDAR_CONSTANTS.MAX_REMINDER_MINUTES })
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
					name: t(msg({ message: "Automatic sync behavior", context: "settings.integrations.googleCalendarExport.automaticSyncBehavior.header" })),
					items: [
						...(
							[
								["syncOnTaskCreate", { name: msg({ message: "Sync on task create", context: "settings.integrations.googleCalendarExport.syncOnCreate.name" }), description: msg({ message: "Automatically create calendar event when a new task is created.", context: "settings.integrations.googleCalendarExport.syncOnCreate.description" }) }],
								["syncOnTaskUpdate", { name: msg({ message: "Sync on task update", context: "settings.integrations.googleCalendarExport.syncOnUpdate.name" }), description: msg({ message: "Automatically update calendar event when a task is modified.", context: "settings.integrations.googleCalendarExport.syncOnUpdate.description" }) }],
								["syncOnTaskComplete", { name: msg({ message: "Sync on task complete", context: "settings.integrations.googleCalendarExport.syncOnComplete.name" }), description: msg({ message: "Update calendar event when a task is completed (adds checkmark to title).", context: "settings.integrations.googleCalendarExport.syncOnComplete.description" }) }],
								["syncOnTaskDelete", { name: msg({ message: "Delete event on task delete", context: "settings.integrations.googleCalendarExport.syncOnDelete.name" }), description: msg({ message: "Remove calendar event when the corresponding task is deleted.", context: "settings.integrations.googleCalendarExport.syncOnDelete.description" }) }],
							] as const
						).map(([key, name]) =>
							field(
								google,
								key,
								`googleCalendarExport.${key}`,
								name
							)
						),
					],
				},
				ctx.button("google.syncAll", {
					name: t(msg({ message: "Sync all tasks", context: "settings.integrations.googleCalendarExport.syncAllTasks.name" })),
					desc: t(msg({ message: "Sync all existing tasks to Google Calendar. This will create events for tasks that haven''t been synced yet.", context: "settings.integrations.googleCalendarExport.syncAllTasks.description" })),
					buttonText: t(msg({ message: "Sync all", context: "settings.integrations.googleCalendarExport.syncAllTasks.buttonText" })),
					onClick: async () => {
						if (!plugin.taskCalendarSyncService?.isEnabled())
							throw new Error(t(msg({ message: "Google Calendar export is not enabled or configured", context: "settings.integrations.googleCalendarExport.notices.notEnabledOrConfigured" })));
						const results = await plugin.taskCalendarSyncService.syncAllTasks();
						new Notice(t(msg({ message: "Synced: {synced}, Failed: {failed}, Skipped: {skipped}", context: "settings.integrations.googleCalendarExport.notices.syncResults" }), results));
					},
				}),
				ctx.button("google.unlinkAll", {
					name: t(msg({ message: "Unlink all tasks", context: "settings.integrations.googleCalendarExport.unlinkAllTasks.name" })),
					desc: t(msg({ message: "Remove all task-event links without deleting calendar events.", context: "settings.integrations.googleCalendarExport.unlinkAllTasks.description" })),
					buttonText: t(msg({ message: "Unlink all", context: "settings.integrations.googleCalendarExport.unlinkAllTasks.buttonText" })),
					onClick: async () => {
						if (!plugin.taskCalendarSyncService)
							throw new Error(t(msg({ message: "Task calendar sync service not available", context: "settings.integrations.googleCalendarExport.notices.serviceNotAvailable" })));
						if (
							await showConfirmationModal(plugin.app, {
								title: t(msg({ message: "Unlink all tasks", context: "settings.integrations.googleCalendarExport.unlinkAllTasks.confirmTitle" })),
								message: t(msg({ message: "This will remove all links between tasks and calendar events. The calendar events will remain but will no longer be updated when tasks change. Are you sure?", context: "settings.integrations.googleCalendarExport.unlinkAllTasks.confirmMessage" })),
								confirmText: t(msg({ message: "Unlink all", context: "settings.integrations.googleCalendarExport.unlinkAllTasks.confirmButtonText" })),
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
			name: t(msg({ message: "Export timeblocks to Google Calendar", context: "settings.integrations.googleCalendarTimeblockExport.header" })),
			desc: t(msg({ message: "Sync timeblocks from your daily notes to Google Calendar as events. Requires Google Calendar to be connected above.", context: "settings.integrations.googleCalendarTimeblockExport.description" })),
			items: [
				field(google, "syncTimeblocks", "googleCalendarExport.syncTimeblocks", { name: msg({ message: "Sync timeblocks", context: "settings.integrations.googleCalendarTimeblockExport.enable.name" }), description: msg({ message: "Create, update and delete calendar events as you add, edit and remove timeblocks. Existing timeblocks are synced the next time you edit them.", context: "settings.integrations.googleCalendarTimeblockExport.enable.description" }) }),
				ctx.field(
					google,
					"timeblockTargetCalendarId",
					"googleCalendarExport.timeblockTargetCalendarId",
					t(msg({ message: "Timeblock calendar", context: "settings.integrations.googleCalendarTimeblockExport.targetCalendar.name" })),
					{
						type: "dropdown",
						desc: t(msg({ message: "Select which calendar to create timeblock events in.", context: "settings.integrations.googleCalendarTimeblockExport.targetCalendar.description" })),
						options: {
							"": t(msg({ message: "Same as task calendar", context: "settings.integrations.googleCalendarTimeblockExport.targetCalendar.sameAsTasks" })),
							...(google.timeblockTargetCalendarId
								? { [google.timeblockTargetCalendarId]: google.timeblockTargetCalendarId }
								: {}),
							...Object.fromEntries(
								(plugin.googleCalendarService?.getAvailableCalendars() ?? []).map(
									(calendar) => [calendar.id, calendar.summary]
								)
							),
						},
					}
				),
				ctx.text("googleCalendarExport.timeblockEventTitleTemplate", {
					name: t(msg({ message: "Timeblock event title template", context: "settings.integrations.googleCalendarTimeblockExport.eventTitleTemplate.name" })),
					desc: t(msg({ message: "Template for timeblock event titles. Available variables: '{{title}}', '{{date}}', '{{startTime}}', '{{endTime}}'", context: "settings.integrations.googleCalendarTimeblockExport.eventTitleTemplate.description" })),
					placeholder: t(msg({ message: "'{{title}}'", context: "settings.integrations.googleCalendarExport.eventTitleTemplate.placeholder" })),
					getValue: () => google.timeblockEventTitleTemplate,
					setValue: (value) => {
						google.timeblockEventTitleTemplate = value || "{{title}}";
						ctx.save();
					},
				}),
			],
		},
		{
			type: "page",
			name: t(msg({ message: "Automatic ICS export", context: "settings.integrations.autoExport.header" })),
			desc: t(msg({ message: "Automatically export all your tasks to an ICS file.", context: "settings.integrations.autoExport.description" })),
			items: [
				ctx.field(
					ics,
					"enableAutoExport",
					"icsIntegration.enableAutoExport",
					t(msg({ message: "Enable automatic export", context: "settings.integrations.autoExport.enable.name" })),
					{
						desc: t(msg({ message: "Automatically keep an ICS file updated with all your tasks", context: "settings.integrations.autoExport.enable.description" })),
						onChange: () => new Notice(t(msg({ message: "Please reload Obsidian for the automatic export changes to take effect.", context: "settings.integrations.autoExport.notices.reloadRequired" }))),
					}
				),
				field(
					ics,
					"autoExportPath",
					"icsIntegration.autoExportPath",
					{ name: msg({ message: "Export file path", context: "settings.integrations.autoExport.filePath.name" }), description: msg({ message: "Path where the ICS file will be saved (relative to vault root)", context: "settings.integrations.autoExport.filePath.description" }) }
				),
				ctx.number("icsIntegration.autoExportInterval", {
					name: t(msg({ message: "Update interval (between 5 and 1440 minutes)", context: "settings.integrations.autoExport.interval.name" })),
					desc: t(msg({ message: "How often to update the export file", context: "settings.integrations.autoExport.interval.description" })),
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
						["useDurationForExport", { name: msg({ message: "Use task duration for event length", context: "settings.integrations.autoExport.useDuration.name" }), description: msg({ message: "When enabled, uses the task''s time estimate (duration) instead of due date for the calendar event end time. This is useful for GTD workflows where scheduled + duration represents work planning, while due date represents deadlines.", context: "settings.integrations.autoExport.useDuration.description" }) }],
						["excludeCompletedFromExport", { name: msg({ message: "Exclude completed tasks", context: "settings.integrations.autoExport.excludeCompleted.name" }), description: msg({ message: "When enabled, completed tasks are omitted from ICS exports. Completed statuses are taken from your task statuses settings.", context: "settings.integrations.autoExport.excludeCompleted.description" }) }],
						["excludeArchivedFromExport", { name: msg({ message: "Exclude archived tasks", context: "settings.integrations.autoExport.excludeArchived.name" }), description: msg({ message: "When enabled, archived tasks are omitted from ICS exports.", context: "settings.integrations.autoExport.excludeArchived.description" }) }],
						["requireDueDateForExport", { name: msg({ message: "Require due date", context: "settings.integrations.autoExport.requireDueDate.name" }), description: msg({ message: "When enabled, only tasks with a due date are included in ICS exports.", context: "settings.integrations.autoExport.requireDueDate.description" }) }],
						["requireScheduledDateForExport", { name: msg({ message: "Require scheduled date", context: "settings.integrations.autoExport.requireScheduledDate.name" }), description: msg({ message: "When enabled, only tasks with a scheduled date are included in ICS exports.", context: "settings.integrations.autoExport.requireScheduledDate.description" }) }],
					] as const
				).map(([key, name]) =>
					field(ics, key, `icsIntegration.${key}`, name)
				),
				ctx.button("ics.exportNow", {
					name: t(msg({ message: "Export now", context: "settings.integrations.autoExport.exportNow.name" })),
					buttonText: t(msg({ message: "Export now", context: "settings.integrations.autoExport.exportNow.buttonText" })),
					onClick: async () => {
						if (!plugin.autoExportService)
							throw new Error(t(msg({ message: "Auto export service not available", context: "settings.integrations.autoExport.notices.serviceUnavailable" })));
						await plugin.autoExportService.exportNow();
						new Notice(t(msg({ message: "Tasks exported successfully", context: "settings.integrations.autoExport.notices.exportSuccess" })));
						ctx.rebuild();
					},
				}),
				{
					name: t(msg({ message: "Export status:", context: "settings.integrations.autoExport.status.title" })),
					render: (setting) => {
						setting.setDesc(
							plugin.autoExportService
								? `${t(msg({ message: "Last export: {time}", context: "settings.integrations.autoExport.status.lastExport" }), { time: formatExportTime(plugin.autoExportService.getLastExportTime()) })}\n${t(msg({ message: "Next export: {time}", context: "settings.integrations.autoExport.status.nextExport" }), { time: formatExportTime(plugin.autoExportService.getNextExportTime()) })}`
								: t(msg({ message: "Service not initialized - please restart Obsidian", context: "settings.integrations.autoExport.status.serviceNotInitialized" }))
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
	const t = ctx.t;
	return {
		type: "page",
		name: t(msg({ message: "HTTP API", context: "settings.integrations.httpApi.header" })),
		visible: () => !Platform.isMobile,
		items: [
			ctx.field(s, "enableAPI", "enableAPI", t(msg({ message: "Enable HTTP API", context: "settings.integrations.httpApi.enable.name" })), {
				desc: t(msg({ message: "Start local HTTP server for API access", context: "settings.integrations.httpApi.enable.description" })),
			}),
			ctx.field(s, "apiPort", "apiPort", t(msg({ message: "API port", context: "settings.integrations.httpApi.port.name" })), {
				type: "number",
				min: 1024,
				max: 65535,
				desc: t(msg({ message: "Port number for the HTTP API server", context: "settings.integrations.httpApi.port.description" })),
				disabled: () => !s.enableAPI,
			}),
			{
				name: t(msg({ message: "API authentication token", context: "settings.integrations.httpApi.authToken.name" })),
				desc: t(msg({ message: "TaskNotes token, not your AI provider''s API key. To generate one, enable HTTP API, leave this field empty, and restart Obsidian. Then copy the generated token into your client''s bearer authentication settings. Update clients whenever this token changes.", context: "settings.integrations.httpApi.authToken.description" })),
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
			ctx.field(s, "enableMCP", "enableMCP", t(msg({ message: "Enable MCP server", context: "settings.integrations.httpApi.mcp.enable.name" })), {
				desc: t(msg({ message: "Expose TaskNotes tools via Model Context Protocol at /mcp endpoint. Requires HTTP API to be enabled.", context: "settings.integrations.httpApi.mcp.enable.description" })),
				disabled: () => !s.enableAPI,
			}),
			{
				type: "page",
				name: t(msg({ message: "Available API endpoints", context: "settings.integrations.httpApi.endpoints.header" })),
				items: [
					{
						name: t(msg({ message: "Available API endpoints", context: "settings.integrations.httpApi.endpoints.header" })),
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
				name: t(msg({ message: "Webhooks", context: "settings.integrations.webhooks.header" })),
				items: [webhookList(ctx)],
			},
		],
	};
}
