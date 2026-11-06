import { msg } from "@lingui/core/macro";
import { calendarNameLabel } from "../../i18n/dataSeedLabels";
import { displayError } from "../../i18n/runtime";
import { uiData } from "../../i18n/dataText";
import {
	Notice,
	type SettingDefinitionList,
	type SettingDefinitionPage,
	type SettingDefinition,
} from "obsidian";
import type { OAuthProvider, WebhookEvent, ICSSubscription } from "../../types";
import { showConfirmationModal } from "../../modals/ConfirmationModal";
import { isCalendarIntegrationDisabledOnMobile } from "../../utils/calendarIntegration";
import { SettingsContext } from "./SettingsContext";
import { relativeSyncTime } from "./relativeSyncTime";
import { formatDateLabel } from "../../utils/dateUtils";

export function validateHttpUrl(
	value: string,
	message = "Enter an HTTP or HTTPS URL."
): string | void {
	try {
		const url = new URL(value);
		if (url.protocol === "http:" || url.protocol === "https:") return;
	} catch {
		/* Report below. */
	}
	return message;
}
export function normalizeCalendarUrl(value: string): string {
	return value
		.trim()
		.replace(/^webcals:/i, "https:")
		.replace(/^webcal:/i, "http:");
}

export function connectionPage(
	ctx: SettingsContext,
	provider: OAuthProvider
): SettingDefinitionPage {
	const { plugin } = ctx;
	const name = uiData(provider === "google" ? "Google Calendar" : "Microsoft Outlook Calendar", "Proper calendar product names");
	const unavailable = () =>
		!plugin.oauthService || isCalendarIntegrationDisabledOnMobile(plugin.settings);
	const status: SettingDefinition = {
		name: ctx.t(msg({ message: "Connection status", context: "settings.native.connectionStatus" })),
		aliases: [provider, "sync", "OAuth"],
		render: (setting) => {
			let disposed = false;
			setting.setDesc(ctx.t(msg({ message: "Checking connection…", context: "settings.integrations.oauth.checking" })));
			void (async () => {
				try {
					if (unavailable()) {
						setting.setDesc(
							ctx.t(msg({ message: "Calendar integration is unavailable on this device.", context: "settings.native.calendarIntegrationIsUnavailableOnThisDevice" }))
						);
						return;
					}
					const connection = await plugin.oauthService.getConnection(provider);
					if (disposed) return;
					setting.setDesc(
						connection
							? [
									connection.connectedAt
										? ctx.t(msg({ message: "Connected: {date}", context: "settings.native.connectedSince" }), {
												date: formatDateLabel(new Date(connection.connectedAt), plugin.settings, undefined, true),
											})
										: ctx.t(msg({ message: "Connected", context: "settings.native.connected" })),
									connection.lastRefreshed
										? ctx.t(msg({ message: "Token refreshed: {date}", context: "settings.native.tokenRefreshed" }), {
												date: formatDateLabel(new Date(connection.lastRefreshed), plugin.settings, undefined, true),
											})
										: "",
								]
									.filter(Boolean)
									.join("\n")
							: ctx.t(msg({ message: "Not connected", context: "settings.native.notConnected" }))
					);
					if (provider === "microsoft") {
						const sync = plugin.microsoftCalendarService?.getSyncStatus();
						if (sync?.lastError)
							setting.descEl.createDiv({
								text: ctx.t(msg({ message: "Sync failed: {message}", context: "settings.integrations.oauth.syncFailed" }), { message: displayError(sync.lastError) }),
								cls: "mod-warning",
							});
						else if (sync?.lastSuccess)
							setting.descEl.createDiv({
								text: ctx.t(msg({ message: "{count, plural, one {Last synced: {date} (# event)} other {Last synced: {date} (# events)}}", context: "settings.integrations.oauth.lastSynced" }), { date: formatDateLabel(new Date(sync.lastSuccess), plugin.settings, undefined, true), count: sync.eventsLoaded }),
							});
						for (const error of sync?.calendarErrors ?? [])
							setting.descEl.createDiv({
								text: `${error.calendarName || error.calendarId}: ${displayError(error.message)}`,
								cls: "mod-warning",
							});
					}
				} catch (error) {
					if (!disposed)
						setting.setDesc(displayError(error));
				}
			})();
			return () => {
				disposed = true;
			};
		},
	};
	return {
		type: "page",
		name,
		items: [
			status,
			{
				type: "page",
				name: ctx.t(msg({ message: "Application credentials", context: "settings.native.oAuthCredentials" })),
				desc: ctx.t(msg({ message: "Stored in Obsidian secret storage, not TaskNotes settings.", context: "settings.native.storedInObsidianSecretStorageNotTaskNotesSettings" })),
				items: [
					{
						name: ctx.t(msg({ message: "Client ID", context: "settings.native.clientID" })),
						aliases: [provider, "OAuth", "credentials"],
						render: (setting) => {
							const oauth = plugin.oauthService;
							setting.addText((text) =>
								text
									.setDisabled(unavailable())
									.setValue(oauth?.getCredentials(provider)?.clientId ?? "")
									.onChange((value) => {
										const current = oauth?.getCredentials(provider);
										oauth?.setCredentials(provider, {
											...current,
											clientId: value.trim(),
										});
									})
							);
						},
					},
					{
						name: ctx.t(msg({ message: "Client secret", context: "settings.native.clientSecret" })),
						desc: ctx.t(msg({ message: "Leave empty to keep the saved secret. Enter a replacement, then leave this field to save it.", context: "settings.native.leaveEmptyToKeepTheSavedSecretEnterA" })),
						aliases: [provider, "OAuth", "credentials"],
						render: (setting) => {
							const oauth = plugin.oauthService;
							setting.addText((text) => {
								text.inputEl.type = "password";
								text.inputEl.autocomplete = "new-password";
								text.setDisabled(unavailable()).setPlaceholder(
									oauth?.getCredentials(provider)?.clientSecret
										? ctx.t(msg({ message: "Secret saved", context: "settings.native.secretSaved" }))
										: ctx.t(msg({ message: "Client secret", context: "settings.native.clientSecret" }))
								);
								const persist = () => {
									const value = text.getValue().trim();
									if (!value || !oauth) return;
									const current = oauth.getCredentials(provider);
									oauth.setCredentials(provider, {
										clientId: current?.clientId ?? "",
										clientSecret: value,
									});
									text.setValue("").setPlaceholder(
										ctx.t(msg({ message: "Secret saved", context: "settings.native.secretSaved" }))
									);
								};
								text.inputEl.addEventListener("change", persist);
								text.inputEl.addEventListener("blur", persist);
							});
						},
					},
					ctx.button(
						`oauth.${provider}.forget`,
						{
							name: ctx.t(msg({ message: "Forget saved credentials", context: "settings.native.forgetSavedCredentials" })),
							buttonText: ctx.t(msg({ message: "Forget credentials", context: "settings.native.forgetCredentials" })),
							onClick: async () => {
								if (
									!(await showConfirmationModal(plugin.app, {
										title: ctx.t(msg({ message: "Forget credentials for {name}?", context: "settings.native.forgetAccountCredentials" }), {
											name,
										}),
										message: ctx.t(
											msg({ message: "This removes the saved client ID and client secret from Obsidian secret storage.", context: "settings.native.thisRemovesTheSavedClientIDAndClientSecret" })
										),
										confirmText: ctx.t(msg({ message: "Forget credentials", context: "settings.native.forgetCredentials" })),
										isDestructive: true,
									}))
								)
									return;
								plugin.oauthService?.clearCredentials(provider);
								ctx.rebuild();
							},
						},
						unavailable
					),
				],
			},
			ctx.button(
				`oauth.${provider}.connect`,
				{
					name: ctx.t(msg({ message: "Connect {name}", context: "settings.native.connectAccount" }), { name }),
					buttonText: ctx.t(msg({ message: "Connect", context: "settings.native.connect" })),
					onClick: async () => {
						if (unavailable())
							throw new Error(
								ctx.t(
									msg({ message: "Calendar integration is unavailable on this device.", context: "settings.native.calendarIntegrationIsUnavailableOnThisDevice" })
								)
							);
						await plugin.oauthService.authenticate(provider);
						if (provider === "google") await plugin.googleCalendarService?.initialize();
						else await plugin.microsoftCalendarService?.initialize();
						ctx.rebuild();
					},
				},
				unavailable
			),
			ctx.button(
				`oauth.${provider}.refresh`,
				{
					name: ctx.t(msg({ message: "Refresh calendar events", context: "settings.native.refreshCalendarEvents" })),
					buttonText: ctx.t(msg({ message: "Refresh now", context: "settings.integrations.subscriptionsList.actions.refreshNow" })),
					onClick: async () => {
						const service =
							provider === "google"
								? plugin.googleCalendarService
								: plugin.microsoftCalendarService;
						if (!service)
							throw new Error(
								ctx.t(msg({ message: "Calendar sync service unavailable.", context: "settings.native.calendarSyncServiceUnavailable" }))
							);
						await service.refresh();
						ctx.rebuild();
					},
				},
				unavailable
			),
			ctx.button(
				`oauth.${provider}.disconnect`,
				{
					name: ctx.t(msg({ message: "Disconnect {name}", context: "settings.native.disconnectAccount" }), { name }),
					buttonText: ctx.t(msg({ message: "Disconnect", context: "settings.native.disconnect" })),
					onClick: async () => {
						await plugin.oauthService?.disconnect(provider);
						if (provider === "google")
							await plugin.googleCalendarService?.handleDisconnect();
						else await plugin.microsoftCalendarService?.disconnect();
						ctx.rebuild();
					},
				},
				unavailable
			),
		],
	};
}

export function subscriptionList(ctx: SettingsContext): SettingDefinitionList {
	const { plugin } = ctx;
	const service = plugin.icsSubscriptionService;
	const t = ctx.t;
	const subscriptions = service?.getSubscriptions() ?? [];
	const run = (action: () => Promise<void>) => {
		void action().catch(
			(error) => new Notice(displayError(error))
		);
	};
	return {
		type: "list",
		heading: t(msg({ message: "Calendar subscriptions list", context: "settings.integrations.subscriptionsList.header" })),
		emptyState: service
			? t(msg({ message: "No calendar subscriptions configured. Add a subscription to sync external calendars.", context: "settings.integrations.subscriptionsList.emptyState" }))
			: t(msg({ message: "ICS subscription service not available", context: "settings.integrations.subscriptionsList.notices.serviceUnavailable" })),
		addItem: {
			name: ctx.t(msg({ message: "Add calendar subscription", context: "settings.integrations.subscriptionsList.addSubscription.name" })),
			action: () =>
				run(async () => {
					if (!service)
						throw new Error(
							ctx.t(msg({ message: "Calendar subscription service unavailable.", context: "settings.native.calendarSubscriptionServiceUnavailable" }))
						);
					await service.addSubscription({
						name: "New calendar",
						url: "",
						color: "var(--text-accent)",
						enabled: false,
						type: "remote",
						refreshInterval: 60,
					});
					ctx.rebuild();
				}),
		},
		onDelete: (index) =>
			run(async () => {
				const item = subscriptions[index];
				if (!item || !service) return;
				if (
					await showConfirmationModal(plugin.app, {
						title: ctx.t(msg({ message: "Delete {name}?", context: "settings.native.deleteEntry" }), { name: item.name }),
						message: ctx.t(
							msg({ message: "The calendar subscription will be removed. Linked notes will be kept.", context: "settings.native.theCalendarSubscriptionWillBeRemovedLinkedNotesWill" })
						),
						confirmText: ctx.t(
							msg({ message: "Delete subscription", context: "settings.integrations.subscriptionsList.actions.deleteSubscription" })
						),
						isDestructive: true,
					})
				) {
					await service.removeSubscription(item.id);
					ctx.rebuild();
				}
			}),
		items: subscriptions.map((subscription) => {
			const read = () =>
				service?.getSubscriptions().find((item) => item.id === subscription.id) ??
				subscription;
			const update = async (patch: Partial<ICSSubscription>) => {
				if (!service)
					throw new Error(
						ctx.t(msg({ message: "Calendar subscription service unavailable.", context: "settings.native.calendarSubscriptionServiceUnavailable" }))
					);
				await service.updateSubscription(subscription.id, patch);
			};
			const id = `subscription.${subscription.id}`;
			const lastFetched = service?.getLastFetched(subscription.id);
			return {
				type: "page",
				name: calendarNameLabel(subscription.name),
				displayValue: () =>
					read().enabled
						? ctx.t(msg({ message: "Enabled", context: "settings.integrations.subscriptionsList.statusLabels.enabled" }))
						: ctx.t(msg({ message: "Disabled", context: "settings.integrations.subscriptionsList.statusLabels.disabled" })),
				status: () => (service?.getLastError(subscription.id) ? "warning" : null),
				items: [
					ctx.toggle(`${id}.enabled`, {
						name: ctx.t(msg({ message: "Enabled:", context: "settings.integrations.subscriptionsList.labels.enabled" })),
						getValue: () => read().enabled,
						setValue: async (enabled) => {
							const current = read();
							if (enabled) {
								const error =
									current.type === "remote"
										? validateHttpUrl(
												normalizeCalendarUrl(current.url ?? ""),
												ctx.t(msg({ message: "Enter an HTTP or HTTPS URL.", context: "settings.native.enterAnHTTPOrHTTPSURL" }))
											)
										: !current.filePath?.endsWith(".ics")
											? ctx.t(msg({ message: "Choose a local .ics file.", context: "settings.native.chooseCalendarFile" }))
											: undefined;
								if (error) throw new Error(error);
							}
							await update({ enabled });
						},
					}),
					ctx.text(`${id}.name`, {
						name: ctx.t(
							msg({ message: "Calendar name", context: "settings.integrations.subscriptionsList.placeholders.calendarName" })
						),
						getValue: () => read().name,
						setValue: (name) => update({ name }),
						validate: (value) =>
							!value.trim() ? ctx.t(msg({ message: "Enter a calendar name.", context: "settings.native.enterCalendarName" })) : undefined,
					}),
					ctx.dropdown(`${id}.type`, {
						name: ctx.t(msg({ message: "Source", context: "settings.native.source" })),
						options: [
							{
								value: "remote",
								label: ctx.t(
									msg({ message: "Remote URL", context: "settings.integrations.subscriptionsList.typeOptions.remote" })
								),
							},
							{
								value: "local",
								label: ctx.t(
									msg({ message: "Local file", context: "settings.integrations.subscriptionsList.typeOptions.local" })
								),
							},
						],
						getValue: () => read().type,
						setValue: async (value) => {
							await update({ type: value as "remote" | "local", enabled: false });
							ctx.refresh();
						},
					}),
					ctx.text(
						`${id}.url`,
						{
							name: ctx.t(msg({ message: "Calendar URL", context: "settings.native.calendarURL" })),
							desc: ctx.t(msg({ message: "HTTP, HTTPS, webcal, or webcals URL.", context: "settings.native.hTTPHTTPSWebcalOrWebcalsURL" })),
							getValue: () => read().url ?? "",
							setValue: (url) => update({ url: normalizeCalendarUrl(url) }),
							validate: (value) =>
								value.trim()
									? validateHttpUrl(
											normalizeCalendarUrl(value),
											ctx.t(msg({ message: "Enter an HTTP or HTTPS URL.", context: "settings.native.enterAnHTTPOrHTTPSURL" }))
										)
									: read().enabled
										? ctx.t(msg({ message: "Enter an HTTP or HTTPS URL.", context: "settings.native.enterAnHTTPOrHTTPSURL" }))
										: undefined,
						},
						() => read().type !== "remote"
					),
					localFile(ctx, id, read, update),
					ctx.text(`${id}.color`, {
						name: ctx.t(msg({ message: "Color:", context: "settings.taskProperties.taskStatuses.fields.color" })),
						desc: ctx.t(msg({ message: "A CSS color or theme variable.", context: "settings.native.aCSSColorOrThemeVariable" })),
						getValue: () => read().color ?? "",
						setValue: (color) => update({ color }),
					}),
					ctx.number(
						`${id}.refreshInterval`,
						{
							name: ctx.t(msg({ message: "Refresh interval (minutes)", context: "settings.native.refreshIntervalMinutes" })),
							min: 5,
							max: 1440,
							getValue: () => read().refreshInterval ?? 60,
							setValue: (refreshInterval) => update({ refreshInterval }),
						},
						() => read().type !== "remote"
					),
					ctx.text(`${id}.filter`, {
						name: ctx.t(msg({ message: "Title contains:", context: "settings.integrations.subscriptionsList.titleFilter.label" })),
						desc: ctx.t(msg({ message: "Case-insensitive text, not regex; empty shows all events", context: "settings.integrations.subscriptionsList.titleFilter.help" })),
						getValue: () => read().filter ?? "",
						setValue: (filter) => update({ filter }),
					}),
					...subscriptionAuthentication(ctx, id, subscription.id, read, update),
					{
						name: ctx.t(msg({ message: "Last sync", context: "settings.native.lastSync" })),
						desc:
							(service?.getLastError(subscription.id) ? displayError(service.getLastError(subscription.id)) : undefined) ??
							(lastFetched ? relativeSyncTime(new Date(lastFetched), ctx) : undefined) ??
							ctx.t(msg({ message: "Not synced yet", context: "settings.native.notSyncedYet" })),
					},
					ctx.button(
						`${id}.refresh`,
						{
							name: ctx.t(msg({ message: "Refresh subscription", context: "settings.native.refreshSubscription" })),
							buttonText: ctx.t(
								msg({ message: "Refresh now", context: "settings.integrations.subscriptionsList.actions.refreshNow" })
							),
							onClick: async () => {
								if (!service)
									throw new Error(
										ctx.t(
											msg({ message: "Calendar subscription service unavailable.", context: "settings.native.calendarSubscriptionServiceUnavailable" })
										)
									);
								await service.refreshSubscription(subscription.id);
								ctx.rebuild();
							},
						},
						() => !read().enabled
					),
				],
			};
		}),
	};
}

function subscriptionAuthentication(
	ctx: SettingsContext,
	id: string,
	subscriptionId: string,
	read: () => ICSSubscription,
	update: (patch: Partial<ICSSubscription>) => Promise<void>
): SettingDefinition[] {
	const service = ctx.plugin.icsSubscriptionService;
	const credentialsHidden = () => read().type !== "remote" || read().authType !== "basic";
	return [
		ctx.dropdown(
			`${id}.authType`,
			{
				name: ctx.t(msg({ message: "Authentication:", context: "settings.integrations.subscriptionsList.labels.authentication" })),
				options: [
					{
						value: "none",
						label: ctx.t(msg({ message: "None", context: "settings.integrations.subscriptionsList.authOptions.none" })),
					},
					{
						value: "basic",
						label: ctx.t(msg({ message: "Username and password (HTTP Basic)", context: "settings.integrations.subscriptionsList.authOptions.basic" })),
					},
				],
				getValue: () => (read().authType === "basic" ? "basic" : "none"),
				setValue: async (value) => {
					await update({ authType: value === "basic" ? "basic" : "none" });
					ctx.refresh();
				},
			},
			() => read().type !== "remote"
		),
		{
			...ctx.text(`${id}.username`, {
				name: ctx.t(msg({ message: "Username:", context: "settings.integrations.subscriptionsList.labels.username" })),
				getValue: () => read().username ?? "",
				setValue: (username) => update({ username: username.trim() }),
			}),
			visible: () => !credentialsHidden(),
		},
		{
			name: ctx.t(msg({ message: "Password:", context: "settings.integrations.subscriptionsList.labels.password" })),
			desc: service?.isPasswordStorageAvailable()
				? ctx.t(msg({ message: "Authenticated feeds must use https://. The password is stored in Obsidian's secure storage, not in plugin settings.", context: "settings.integrations.subscriptionsList.authHelp" }))
				: ctx.t(msg({ message: "Obsidian's secure storage is unavailable, so passwords cannot be saved on this device.", context: "settings.integrations.subscriptionsList.authStorageUnavailable" })),
			visible: () => !credentialsHidden(),
			render: (setting) => {
				setting.addText((text) => {
					const setPlaceholder = () =>
						text.setPlaceholder(
							service?.hasPassword(subscriptionId)
								? ctx.t(msg({ message: "Saved. Enter a new password to replace it", context: "settings.integrations.subscriptionsList.placeholders.passwordSaved" }))
								: ctx.t(msg({ message: "Password", context: "settings.integrations.subscriptionsList.placeholders.password" }))
						);
					text.inputEl.type = "password";
					text.inputEl.autocomplete = "new-password";
					setPlaceholder();
					// The input never shows a stored value.
					text.inputEl.addEventListener("change", () => {
						const password = text.getValue();
						text.setValue("");
						if (!password || !service) return;
						if (!service.isPasswordStorageAvailable()) {
							new Notice(
								ctx.t(msg({ message: "Obsidian's secure storage is unavailable, so passwords cannot be saved on this device.", context: "settings.integrations.subscriptionsList.authStorageUnavailable" }))
							);
							return;
						}
						void service
							.setPassword(subscriptionId, password)
							.catch(() => {
								new Notice(
									ctx.t(msg({ message: "Failed to save the calendar password", context: "settings.integrations.subscriptionsList.notices.passwordSaveFailure" }))
								);
							})
							.then(setPlaceholder);
					});
				});
			},
		},
	];
}

function localFile(
	ctx: SettingsContext,
	id: string,
	read: () => ICSSubscription,
	update: (patch: Partial<ICSSubscription>) => Promise<void>
): SettingDefinition {
	const definition = ctx.text(
		`${id}.filePath`,
		{
			name: ctx.t(msg({ message: "Calendar file", context: "settings.native.calendarFile" })),
			desc: ctx.t(msg({ message: "An .ics file in this vault.", context: "settings.native.anIcsFileInThisVault" })),
			getValue: () => read().filePath ?? "",
			setValue: (filePath) => update({ filePath }),
			validate: (value) =>
				value && !value.endsWith(".ics")
					? ctx.t(msg({ message: "Choose a local .ics file.", context: "settings.native.chooseCalendarFile" }))
					: undefined,
		},
		() => read().type !== "local"
	);
	if (definition.control?.type === "text")
		definition.control = {
			...definition.control,
			type: "file",
			filter: (file) => file.extension === "ics",
		};
	return definition;
}

const WEBHOOK_EVENTS: WebhookEvent[] = [
	"task.created",
	"task.updated",
	"task.completed",
	"task.deleted",
	"task.archived",
	"task.unarchived",
	"time.started",
	"time.stopped",
	"pomodoro.started",
	"pomodoro.completed",
	"pomodoro.interrupted",
	"recurring.instance.completed",
	"reminder.triggered",
];

export function webhookList(ctx: SettingsContext): SettingDefinitionList {
	const { plugin, save } = ctx;
	const hooks = plugin.settings.webhooks ?? [];
	return {
		type: "list",
		heading: ctx.t(msg({ message: "Webhooks", context: "settings.integrations.webhooks.header" })),
		emptyState: ctx.t(msg({ message: "No webhooks configured. Add one to send task events to another service.", context: "settings.native.noWebhooksConfiguredAddOneToSendTaskEvents" })),
		addItem: {
			name: ctx.t(msg({ message: "Add webhook", context: "settings.integrations.webhooks.addWebhook.name" })),
			action: () => {
				plugin.settings.webhooks = [
					...hooks,
					{
						id: crypto.randomUUID(),
						url: "",
						events: [],
						active: false,
						secret: Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
							byte.toString(16).padStart(2, "0")
						).join(""),
						createdAt: new Date().toISOString(),
						failureCount: 0,
						successCount: 0,
						corsHeaders: true,
					},
				];
				save();
				ctx.rebuild();
			},
		},
		onDelete: (index) => {
			void (async () => {
				const hook = hooks[index];
				if (!hook) return;
				if (
					await showConfirmationModal(plugin.app, {
						title: ctx.t(msg({ message: "Delete webhook?", context: "settings.native.deleteWebhook" })),
						message: ctx.t(msg({ message: "Events will no longer be sent to this endpoint.", context: "settings.native.eventsWillNoLongerBeSentToThisEndpoint" })),
						confirmText: ctx.t(msg({ message: "Delete webhook", context: "settings.integrations.webhooks.confirmDelete.title" })),
						isDestructive: true,
					})
				) {
					plugin.settings.webhooks = hooks.filter((h) => h.id !== hook.id);
					save();
					ctx.rebuild();
				}
			})();
		},
		items: hooks.map((hook, index) => {
			const id = `webhook.${hook.id}`;
			return {
				type: "page",
				name: `Webhook ${index + 1}`,
				displayValue: () =>
					hook.active
						? ctx.t(msg({ message: "Active", context: "settings.integrations.webhooks.statusLabels.active" }))
						: ctx.t(msg({ message: "Inactive", context: "settings.integrations.webhooks.statusLabels.inactive" })),
				status: () => (hook.failureCount ? "warning" : null),
				items: [
					ctx.toggle(`${id}.active`, {
						name: ctx.t(msg({ message: "Active:", context: "settings.integrations.webhooks.labels.active" })),
						getValue: () => hook.active,
						setValue: (value) => {
							if (value) {
								const error = validateHttpUrl(
									hook.url,
									ctx.t(msg({ message: "Enter an HTTP or HTTPS URL.", context: "settings.native.enterAnHTTPOrHTTPSURL" }))
								);
								if (error) throw new Error(error);
								if (!hook.events.length)
									throw new Error(
										ctx.t(
											msg({ message: "Select at least one event before enabling this webhook.", context: "settings.native.selectAtLeastOneEventBeforeEnablingThisWebhook" })
										)
									);
							}
							hook.active = value;
							save();
						},
					}),
					ctx.text(`${id}.url`, {
						name: ctx.t(msg({ message: "Webhook URL", context: "settings.integrations.webhooks.placeholders.url" })),
						getValue: () => hook.url,
						validate: (value) =>
							!value && !hook.active
								? undefined
								: validateHttpUrl(
										value,
										ctx.t(msg({ message: "Enter an HTTP or HTTPS URL.", context: "settings.native.enterAnHTTPOrHTTPSURL" }))
									),
						setValue: (value) => {
							hook.url = value;
							save();
						},
					}),
					{
						type: "page",
						name: ctx.t(msg({ message: "What to show", context: "views.basesCalendar.settings.groups.events" })),
						displayValue: () => String(hook.events.length),
						items: WEBHOOK_EVENTS.map((event) =>
							ctx.toggle(`${id}.events.${event}`, {
								name: event,
								getValue: () => hook.events.includes(event),
								setValue: (enabled) => {
									hook.events = enabled
										? [...new Set([...hook.events, event])]
										: hook.events.filter((e) => e !== event);
									if (!hook.events.length) hook.active = false;
									save();
								},
							})
						),
					},
					ctx.field(
						hook,
						"transformFile",
						`${id}.transformFile`,
						ctx.t(msg({ message: "Transform file", context: "settings.integrations.webhooks.modals.edit.transformFile.name" })),
						{
							type: "file",
							desc: ctx.t(
								msg({ message: "An optional .json template in the vault. Leave empty to send raw event data.", context: "settings.native.anOptionalJsonTemplateInTheVaultLeaveEmpty" })
							),
						}
					),
					ctx.field(
						hook,
						"corsHeaders",
						`${id}.corsHeaders`,
						ctx.t(msg({ message: "Include custom headers", context: "settings.integrations.webhooks.modals.edit.customHeaders.name" })),
						{
							type: "toggle",
							desc: ctx.t(
								msg({ message: "Include event type, signature, and delivery ID. Turn off for services with strict CORS policies.", context: "settings.native.includeEventTypeSignatureAndDeliveryIDTurnOff" })
							),
						}
					),
					{
						name: ctx.t(msg({ message: "Delivery status", context: "settings.native.deliveryStatus" })),
						desc: ctx.t(msg({ message: "Successful: {success} · Failed: {failure}", context: "settings.native.deliveryCounts" }), {
							success: hook.successCount ?? 0,
							failure: hook.failureCount ?? 0,
						}),
					},
					ctx.button(`${id}.secret`, {
						name: ctx.t(msg({ message: "Signing secret", context: "settings.native.signingSecret" })),
						desc: ctx.t(msg({ message: "Use this secret to verify payloads in the receiving application.", context: "settings.native.useThisSecretToVerifyPayloadsInTheReceiving" })),
						buttonText: ctx.t(msg({ message: "Copy secret", context: "settings.native.copySecret" })),
						onClick: async () => {
							await navigator.clipboard.writeText(hook.secret);
							new Notice(ctx.t(msg({ message: "Signing secret copied", context: "settings.native.signingSecretCopied" })));
						},
					}),
				],
			};
		}),
	};
}
