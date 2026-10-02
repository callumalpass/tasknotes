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
	const name = provider === "google" ? "Google Calendar" : "Microsoft Outlook Calendar";
	const unavailable = () =>
		!plugin.oauthService || isCalendarIntegrationDisabledOnMobile(plugin.settings);
	const status: SettingDefinition = {
		name: ctx.t("settings.native.connectionStatus"),
		aliases: [provider, "sync", "OAuth"],
		render: (setting) => {
			let disposed = false;
			setting.setDesc("Checking connection…");
			void (async () => {
				try {
					if (unavailable()) {
						setting.setDesc(
							ctx.t("settings.native.calendarIntegrationIsUnavailableOnThisDevice")
						);
						return;
					}
					const connection = await plugin.oauthService.getConnection(provider);
					if (disposed) return;
					setting.setDesc(
						connection
							? [
									connection.connectedAt
										? ctx.t("settings.native.connectedSince", {
												date: formatDateLabel(new Date(connection.connectedAt), plugin.settings, undefined, true),
											})
										: ctx.t("settings.native.connected"),
									connection.lastRefreshed
										? ctx.t("settings.native.tokenRefreshed", {
												date: formatDateLabel(new Date(connection.lastRefreshed), plugin.settings, undefined, true),
											})
										: "",
								]
									.filter(Boolean)
									.join("\n")
							: ctx.t("settings.native.notConnected")
					);
					if (provider === "microsoft") {
						const sync = plugin.microsoftCalendarService?.getSyncStatus();
						if (sync?.lastError)
							setting.descEl.createDiv({
								text: `Sync failed: ${sync.lastError}`,
								cls: "mod-warning",
							});
						else if (sync?.lastSuccess)
							setting.descEl.createDiv({
								text: `Last synced: ${formatDateLabel(new Date(sync.lastSuccess), plugin.settings, undefined, true)} (${sync.eventsLoaded} events)`,
							});
						for (const error of sync?.calendarErrors ?? [])
							setting.descEl.createDiv({
								text: `${error.calendarName || error.calendarId}: ${error.message}`,
								cls: "mod-warning",
							});
					}
				} catch (error) {
					if (!disposed)
						setting.setDesc(error instanceof Error ? error.message : String(error));
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
				name: ctx.t("settings.native.oAuthCredentials"),
				desc: ctx.t("settings.native.storedInObsidianSecretStorageNotTaskNotesSettings"),
				items: [
					{
						name: ctx.t("settings.native.clientID"),
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
						name: ctx.t("settings.native.clientSecret"),
						desc: ctx.t("settings.native.leaveEmptyToKeepTheSavedSecretEnterA"),
						aliases: [provider, "OAuth", "credentials"],
						render: (setting) => {
							const oauth = plugin.oauthService;
							setting.addText((text) => {
								text.inputEl.type = "password";
								text.inputEl.autocomplete = "new-password";
								text.setDisabled(unavailable()).setPlaceholder(
									oauth?.getCredentials(provider)?.clientSecret
										? ctx.t("settings.native.secretSaved")
										: ctx.t("settings.native.clientSecret")
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
										ctx.t("settings.native.secretSaved")
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
							name: ctx.t("settings.native.forgetSavedCredentials"),
							buttonText: ctx.t("settings.native.forgetCredentials"),
							onClick: async () => {
								if (
									!(await showConfirmationModal(plugin.app, {
										title: ctx.t("settings.native.forgetAccountCredentials", {
											name,
										}),
										message: ctx.t(
											"settings.native.thisRemovesTheSavedClientIDAndClientSecret"
										),
										confirmText: ctx.t("settings.native.forgetCredentials"),
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
					name: ctx.t("settings.native.connectAccount", { name }),
					buttonText: ctx.t("settings.native.connect"),
					onClick: async () => {
						if (unavailable())
							throw new Error(
								ctx.t(
									"settings.native.calendarIntegrationIsUnavailableOnThisDevice"
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
					name: ctx.t("settings.native.refreshCalendarEvents"),
					buttonText: ctx.t("settings.integrations.subscriptionsList.actions.refreshNow"),
					onClick: async () => {
						const service =
							provider === "google"
								? plugin.googleCalendarService
								: plugin.microsoftCalendarService;
						if (!service)
							throw new Error(
								ctx.t("settings.native.calendarSyncServiceUnavailable")
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
					name: ctx.t("settings.native.disconnectAccount", { name }),
					buttonText: ctx.t("settings.native.disconnect"),
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
	const t = plugin.i18n.translate.bind(plugin.i18n);
	const subscriptions = service?.getSubscriptions() ?? [];
	const run = (action: () => Promise<void>) => {
		void action().catch(
			(error) => new Notice(error instanceof Error ? error.message : String(error))
		);
	};
	return {
		type: "list",
		heading: t("settings.integrations.subscriptionsList.header"),
		emptyState: service
			? t("settings.integrations.subscriptionsList.emptyState")
			: t("settings.integrations.subscriptionsList.notices.serviceUnavailable"),
		addItem: {
			name: ctx.t("settings.integrations.subscriptionsList.addSubscription.name"),
			action: () =>
				run(async () => {
					if (!service)
						throw new Error(
							ctx.t("settings.native.calendarSubscriptionServiceUnavailable")
						);
					await service.addSubscription({
						name: t("settings.integrations.subscriptionsList.newCalendarName"),
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
						title: ctx.t("settings.native.deleteEntry", { name: item.name }),
						message: ctx.t(
							"settings.native.theCalendarSubscriptionWillBeRemovedLinkedNotesWill"
						),
						confirmText: ctx.t(
							"settings.integrations.subscriptionsList.actions.deleteSubscription"
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
						ctx.t("settings.native.calendarSubscriptionServiceUnavailable")
					);
				await service.updateSubscription(subscription.id, patch);
			};
			const id = `subscription.${subscription.id}`;
			return {
				type: "page",
				name: subscription.name,
				displayValue: () =>
					read().enabled
						? ctx.t("settings.integrations.subscriptionsList.statusLabels.enabled")
						: ctx.t("settings.integrations.subscriptionsList.statusLabels.disabled"),
				status: () => (service?.getLastError(subscription.id) ? "warning" : null),
				items: [
					ctx.toggle(`${id}.enabled`, {
						name: ctx.t("settings.integrations.subscriptionsList.labels.enabled"),
						getValue: () => read().enabled,
						setValue: async (enabled) => {
							const current = read();
							if (enabled) {
								const error =
									current.type === "remote"
										? validateHttpUrl(
												normalizeCalendarUrl(current.url ?? ""),
												ctx.t("settings.native.enterAnHTTPOrHTTPSURL")
											)
										: !current.filePath?.endsWith(".ics")
											? ctx.t("settings.native.chooseCalendarFile")
											: undefined;
								if (error) throw new Error(error);
							}
							await update({ enabled });
						},
					}),
					ctx.text(`${id}.name`, {
						name: ctx.t(
							"settings.integrations.subscriptionsList.placeholders.calendarName"
						),
						getValue: () => read().name,
						setValue: (name) => update({ name }),
						validate: (value) =>
							!value.trim() ? ctx.t("settings.native.enterCalendarName") : undefined,
					}),
					ctx.dropdown(`${id}.type`, {
						name: ctx.t("settings.native.source"),
						options: [
							{
								value: "remote",
								label: ctx.t(
									"settings.integrations.subscriptionsList.typeOptions.remote"
								),
							},
							{
								value: "local",
								label: ctx.t(
									"settings.integrations.subscriptionsList.typeOptions.local"
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
							name: ctx.t("settings.native.calendarURL"),
							desc: ctx.t("settings.native.hTTPHTTPSWebcalOrWebcalsURL"),
							getValue: () => read().url ?? "",
							setValue: (url) => update({ url: normalizeCalendarUrl(url) }),
							validate: (value) =>
								value.trim()
									? validateHttpUrl(
											normalizeCalendarUrl(value),
											ctx.t("settings.native.enterAnHTTPOrHTTPSURL")
										)
									: read().enabled
										? ctx.t("settings.native.enterAnHTTPOrHTTPSURL")
										: undefined,
						},
						() => read().type !== "remote"
					),
					localFile(ctx, id, read, update),
					ctx.text(`${id}.color`, {
						name: ctx.t("settings.taskProperties.taskStatuses.fields.color"),
						desc: ctx.t("settings.native.aCSSColorOrThemeVariable"),
						getValue: () => read().color ?? "",
						setValue: (color) => update({ color }),
					}),
					ctx.number(
						`${id}.refreshInterval`,
						{
							name: ctx.t("settings.native.refreshIntervalMinutes"),
							min: 5,
							max: 1440,
							getValue: () => read().refreshInterval ?? 60,
							setValue: (refreshInterval) => update({ refreshInterval }),
						},
						() => read().type !== "remote"
					),
					{
						name: ctx.t("settings.native.lastSync"),
						desc:
							service?.getLastError(subscription.id) ??
							service?.getLastFetched(subscription.id) ??
							ctx.t("settings.native.notSyncedYet"),
					},
					ctx.button(
						`${id}.refresh`,
						{
							name: ctx.t("settings.native.refreshSubscription"),
							buttonText: ctx.t(
								"settings.integrations.subscriptionsList.actions.refreshNow"
							),
							onClick: async () => {
								if (!service)
									throw new Error(
										ctx.t(
											"settings.native.calendarSubscriptionServiceUnavailable"
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

function localFile(
	ctx: SettingsContext,
	id: string,
	read: () => ICSSubscription,
	update: (patch: Partial<ICSSubscription>) => Promise<void>
): SettingDefinition {
	const definition = ctx.text(
		`${id}.filePath`,
		{
			name: ctx.t("settings.native.calendarFile"),
			desc: ctx.t("settings.native.anIcsFileInThisVault"),
			getValue: () => read().filePath ?? "",
			setValue: (filePath) => update({ filePath }),
			validate: (value) =>
				value && !value.endsWith(".ics")
					? ctx.t("settings.native.chooseCalendarFile")
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
		heading: ctx.t("settings.integrations.webhooks.header"),
		emptyState: ctx.t("settings.native.noWebhooksConfiguredAddOneToSendTaskEvents"),
		addItem: {
			name: ctx.t("settings.integrations.webhooks.addWebhook.name"),
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
						title: ctx.t("settings.native.deleteWebhook"),
						message: ctx.t("settings.native.eventsWillNoLongerBeSentToThisEndpoint"),
						confirmText: ctx.t("settings.integrations.webhooks.confirmDelete.title"),
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
						? ctx.t("settings.integrations.webhooks.statusLabels.active")
						: ctx.t("settings.integrations.webhooks.statusLabels.inactive"),
				status: () => (hook.failureCount ? "warning" : null),
				items: [
					ctx.toggle(`${id}.active`, {
						name: ctx.t("settings.integrations.webhooks.labels.active"),
						getValue: () => hook.active,
						setValue: (value) => {
							if (value) {
								const error = validateHttpUrl(
									hook.url,
									ctx.t("settings.native.enterAnHTTPOrHTTPSURL")
								);
								if (error) throw new Error(error);
								if (!hook.events.length)
									throw new Error(
										ctx.t(
											"settings.native.selectAtLeastOneEventBeforeEnablingThisWebhook"
										)
									);
							}
							hook.active = value;
							save();
						},
					}),
					ctx.text(`${id}.url`, {
						name: ctx.t("settings.integrations.webhooks.placeholders.url"),
						getValue: () => hook.url,
						validate: (value) =>
							!value && !hook.active
								? undefined
								: validateHttpUrl(
										value,
										ctx.t("settings.native.enterAnHTTPOrHTTPSURL")
									),
						setValue: (value) => {
							hook.url = value;
							save();
						},
					}),
					{
						type: "page",
						name: ctx.t("views.basesCalendar.settings.groups.events"),
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
						ctx.t("settings.integrations.webhooks.modals.edit.transformFile.name"),
						{
							type: "file",
							desc: ctx.t(
								"settings.native.anOptionalJsonTemplateInTheVaultLeaveEmpty"
							),
						}
					),
					ctx.field(
						hook,
						"corsHeaders",
						`${id}.corsHeaders`,
						ctx.t("settings.integrations.webhooks.modals.edit.customHeaders.name"),
						{
							type: "toggle",
							desc: ctx.t(
								"settings.native.includeEventTypeSignatureAndDeliveryIDTurnOff"
							),
						}
					),
					{
						name: ctx.t("settings.native.deliveryStatus"),
						desc: ctx.t("settings.native.deliveryCounts", {
							success: hook.successCount ?? 0,
							failure: hook.failureCount ?? 0,
						}),
					},
					ctx.button(`${id}.secret`, {
						name: ctx.t("settings.native.signingSecret"),
						desc: ctx.t("settings.native.useThisSecretToVerifyPayloadsInTheReceiving"),
						buttonText: ctx.t("settings.native.copySecret"),
						onClick: async () => {
							await navigator.clipboard.writeText(hook.secret);
							new Notice(ctx.t("settings.native.signingSecretCopied"));
						},
					}),
				],
			};
		}),
	};
}
