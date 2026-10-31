import { displayError } from "../../i18n/runtime";
import { calendarNameLabel } from "../../i18n/dataSeedLabels";
import { uiData } from "../../i18n/dataText";
import { uiLocale } from "../../i18n/runtime";
import { uiText } from "../../i18n/runtime";
import { uiRichText } from "../../i18n/richText";
import { messageForKey } from "../../i18n/messages";
import { msg } from "@lingui/core/macro";
import { Notice, Platform, Modal, Setting, setIcon, App } from "obsidian";
import TaskNotesPlugin from "../../main";
import type { OAuthProvider, WebhookConfig, WebhookEvent } from "../../types";
import type { ICSIntegrationSettings } from "../../types/settings";
import { MessageDescriptor } from "../../i18n";
import { loadAPIEndpoints } from "../../api/loadAPIEndpoints";
import { GOOGLE_CALENDAR_CONSTANTS } from "../../services/constants";
import {
	createSettingGroup,
	configureTextSetting,
	configureToggleSetting,
	configureDropdownSetting,
	configureNumberSetting,
	configureButtonSetting,
	createHelpText,
	runAsyncSettingCallback,
} from "../components/settingHelpers";
import { showConfirmationModal } from "../../modals/ConfirmationModal";
import { isCalendarIntegrationDisabledOnMobile } from "../../utils/calendarIntegration";
import {
	createCard,
	createStatusBadge,
	createCardInput,
	createCardToggle,
	createDeleteHeaderButton,
	createCardUrlInput,
	createCardNumberInput,
	createInfoBadge,
	showCardEmptyState,
	normalizeCalendarUrl,
	createThemeColorInput,
	readThemeColorInput,
	type CardSection,
} from "../components/CardComponent";
import { createTaskNotesLogger } from "../../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Settings/Tabs/IntegrationsTab" });

// interface WebhookItem extends ListEditorItem, WebhookConfig {}
// interface ICSSubscriptionItem extends ListEditorItem {
//     id: string;
//     name: string;
//     url: string;
//     enabled: boolean;
//     color: string;
//     lastSync?: string;
// }

/**
 * Helper function to format relative time (e.g., "2 hours ago", "5 minutes ago")
 */
function getRelativeTime(
	date: Date,
	translate: (key: MessageDescriptor, params?: Record<string, string | number>) => string
): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffDays > 0) {
		return translate(msg({ message: "{days, plural, one {{days, number} day ago} other {{days, number} days ago}}", context: "settings.integrations.timeFormats.daysAgo" }), {
			days: diffDays,
		});
	} else if (diffHours > 0) {
		return translate(msg({ message: "{hours, plural, one {{hours, number} hour ago} other {{hours, number} hours ago}}", context: "settings.integrations.timeFormats.hoursAgo" }), {
			hours: diffHours,
		});
	} else if (diffMinutes > 0) {
		return translate(msg({ message: "{minutes, plural, one {{minutes, number} minute ago} other {{minutes, number} minutes ago}}", context: "settings.integrations.timeFormats.minutesAgo" }), {
			minutes: diffMinutes,
		});
	} else {
		return translate(msg({ message: "Just now", context: "settings.integrations.timeFormats.justNow" }));
	}
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

type ICSNoteFilenameFormat = ICSIntegrationSettings["icsNoteFilenameFormat"];
type RecurringEventRelatedNotesMode = ICSIntegrationSettings["recurringEventRelatedNotesMode"];

const ICS_NOTE_FILENAME_FORMATS: readonly ICSNoteFilenameFormat[] = [
	"title",
	"zettel",
	"timestamp",
	"custom",
];
const RECURRING_EVENT_RELATED_NOTES_MODES: readonly RecurringEventRelatedNotesMode[] = [
	"series",
	"instance",
];

function isICSNoteFilenameFormat(value: string): value is ICSNoteFilenameFormat {
	return ICS_NOTE_FILENAME_FORMATS.some((format) => format === value);
}

function isRecurringEventRelatedNotesMode(value: string): value is RecurringEventRelatedNotesMode {
	return RECURRING_EVENT_RELATED_NOTES_MODES.some((mode) => mode === value);
}

function formatDefaultReminderMinutes(value: number | number[] | null | undefined): string {
	if (Array.isArray(value)) {
		return value.filter((minutes) => minutes > 0).join(", ");
	}
	return typeof value === "number" && value > 0 ? value.toString() : "";
}

function parseDefaultReminderMinutes(value: string): number | number[] | null {
	const minutes = value
		.split(/[,\s]+/)
		.map((part) => Math.trunc(Number(part.trim())))
		.filter((part) => Number.isFinite(part) && part > 0)
		.map((part) => Math.min(part, GOOGLE_CALENDAR_CONSTANTS.MAX_REMINDER_MINUTES));

	const uniqueMinutes = Array.from(new Set(minutes));
	if (uniqueMinutes.length === 0) {
		return null;
	}
	if (uniqueMinutes.length === 1) {
		return uniqueMinutes[0];
	}
	return uniqueMinutes;
}

type OAuthCredentialControls = {
	clientIdInput: HTMLInputElement;
	clientSecretInput: HTMLInputElement;
	persistPendingValues(): void;
	hasStoredCredentials: boolean;
};

function createOAuthCredentialControls(
	plugin: TaskNotesPlugin,
	provider: OAuthProvider,
	clientIdPlaceholder: string,
	clientSecretPlaceholder: string
): OAuthCredentialControls {
	const oauthService = plugin.oauthService;
	const storedCredentials = oauthService?.getCredentials(provider);
	const clientIdInput = createCardInput(
		"text",
		clientIdPlaceholder,
		storedCredentials?.clientId ?? ""
	);
	const clientSecretInput = createCardInput(
		"text",
		storedCredentials?.clientSecret
			? plugin.i18n.translate(msg({ message: "Stored securely - enter a new value to replace", context: "settings.integrations.oauth.stored" }))
			: clientSecretPlaceholder,
		""
	);
	clientSecretInput.setAttribute("type", "password");

	const persistClientId = () => {
		if (!oauthService) return;
		const existing = oauthService.getCredentials(provider);
		const clientId = clientIdInput.value.trim();
		if (!clientId && !existing?.clientSecret) return;
		oauthService.setCredentials(provider, {
			clientId,
			...(existing?.clientSecret ? { clientSecret: existing.clientSecret } : {}),
		});
	};

	const persistClientSecret = () => {
		if (!oauthService) return;
		const clientSecret = clientSecretInput.value.trim();
		if (!clientSecret) return;
		oauthService.setCredentials(provider, {
			clientId: clientIdInput.value.trim(),
			clientSecret,
		});
		clientSecretInput.value = "";
		clientSecretInput.placeholder = plugin.i18n.translate(msg({ message: "Stored securely - enter a new value to replace", context: "settings.integrations.oauth.stored" }));
	};

	clientIdInput.addEventListener("blur", persistClientId);
	clientSecretInput.addEventListener("blur", persistClientSecret);

	return {
		clientIdInput,
		clientSecretInput,
		persistPendingValues: () => {
			persistClientSecret();
			persistClientId();
		},
		hasStoredCredentials: storedCredentials !== null,
	};
}

type Translate = (key: MessageDescriptor, params?: Record<string, string | number>) => string;

const WEBHOOK_EVENT_OPTIONS = [
	{ id: "task.created", translation: "settings.integrations.webhooks.events.taskCreated" },
	{ id: "task.updated", translation: "settings.integrations.webhooks.events.taskUpdated" },
	{ id: "task.completed", translation: "settings.integrations.webhooks.events.taskCompleted" },
	{ id: "task.deleted", translation: "settings.integrations.webhooks.events.taskDeleted" },
	{ id: "task.archived", translation: "settings.integrations.webhooks.events.taskArchived" },
	{ id: "task.unarchived", translation: "settings.integrations.webhooks.events.taskUnarchived" },
	{ id: "time.started", translation: "settings.integrations.webhooks.events.timeStarted" },
	{ id: "time.stopped", translation: "settings.integrations.webhooks.events.timeStopped" },
	{
		id: "pomodoro.started",
		translation: "settings.integrations.webhooks.events.pomodoroStarted",
	},
	{
		id: "pomodoro.completed",
		translation: "settings.integrations.webhooks.events.pomodoroCompleted",
	},
	{
		id: "pomodoro.interrupted",
		translation: "settings.integrations.webhooks.events.pomodoroInterrupted",
	},
	{
		id: "recurring.instance.completed",
		translation: "settings.integrations.webhooks.events.recurringCompleted",
	},
	{
		id: "reminder.triggered",
		translation: "settings.integrations.webhooks.events.reminderTriggered",
	},
] as const satisfies ReadonlyArray<{ id: WebhookEvent; translation: string }>;

/**
 * Renders the Integrations tab - external connections and API settings
 */
export function renderIntegrationsTab(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	container.empty();

	const translate = (key: MessageDescriptor, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);
	const calendarIntegrationDisabledOnMobile = isCalendarIntegrationDisabledOnMobile(
		plugin.settings
	);

	// mdbase-spec Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "mdbase type definitions", context: "settings.integrations.mdbaseSpec.header" })),
		},
		(group) => {
			group.addSetting((setting) => {
				configureToggleSetting(setting, {
					name: translate(msg({ message: "Generate mdbase type definitions", context: "settings.integrations.mdbaseSpec.enable.name" })),
					desc: "",
					getValue: () => plugin.settings.enableMdbaseSpec,
					setValue: (value: boolean) => {
						plugin.settings.enableMdbaseSpec = value;
						save();
					},
				});
				const descEl = setting.descEl;
				descEl.createSpan({
					text: translate(msg({ message: "Generate and maintain mdbase type files (mdbase.yaml and _types/task.md) at the vault root as your settings change.", context: "settings.integrations.mdbaseSpec.enable.description" })) + " ",
				});
				const link = descEl.createEl("a", {
					text: translate(msg({ message: "Learn more about mdbase-spec", context: "settings.integrations.mdbaseSpec.learnMore" })),
					href: "https://mdbase.dev",
				});
				link.setAttr("target", "_blank");
			});
		}
	);

	// OAuth Calendar Integration Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "OAUTH calendar integration", context: "settings.integrations.oauth.header" })),
		},
		(group) => {
			group.addSetting((setting) => {
				setting.setDesc(translate(msg({ message: "Connect Google Calendar or Microsoft Outlook to sync events into TaskNotes.", context: "settings.integrations.oauth.description" })));
				const descEl = setting.descEl;
				descEl.createSpan({
					text: " " + translate(msg({ message: "Create OAUTH credentials with Google or Microsoft first. Initial setup takes about 15 minutes.", context: "settings.integrations.oauth.setup" })) + " ",
				});
				const link = descEl.createEl("a", {
					text: translate(msg({ message: "View calendar setup guide", context: "settings.integrations.oauth.guide" })),
					href: "https://callumalpass.github.io/tasknotes/calendar-setup",
				});
				link.setAttr("target", "_blank");
			});

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Disable calendar integrations on mobile", context: "settings.integrations.mobileCalendar.disable.name" })),
						desc: translate(msg({ message: "Skip Google, Microsoft, and ICS calendar loading on Obsidian mobile. Desktop calendar integrations are unchanged.", context: "settings.integrations.mobileCalendar.disable.description" })),
						getValue: () => plugin.settings.disableCalendarOnMobile,
						setValue: async (value: boolean) => {
							plugin.settings.disableCalendarOnMobile = value;
							save();
							if (Platform.isMobile) {
								renderIntegrationsTab(container, plugin, save);
							}
						},
					})
			);

			if (calendarIntegrationDisabledOnMobile) {
				group.addSetting((setting) => {
					setting.setName(translate(msg({ message: "Calendar integrations are disabled on this mobile device", context: "settings.integrations.mobileCalendar.status.name" })));
					setting.setDesc(
						translate(msg({ message: "Turn this setting off and reload Obsidian mobile to resume calendar loading.", context: "settings.integrations.mobileCalendar.status.description" }))
					);
				});
			}
		}
	);

	// Google Calendar container for card-based UI
	const googleCalendarContainer = container.createDiv("google-calendar-integration-container");

	// Check connection status and render card
	const renderGoogleCalendarCard = async () => {
		googleCalendarContainer.empty();

		if (!plugin.oauthService) {
			createCard(googleCalendarContainer, {
				header: {
					primaryText: translate(msg({ message: "Google Calendar", context: "contextMenus.task.calendar.google" })),
					secondaryText: translate(msg({ message: "OAUTH service not available", context: "settings.integrations.oauth.unavailable" })),
					meta: [
						createStatusBadge(
							translate(msg({ message: "Error", context: "settings.integrations.subscriptionsList.statusLabels.error" })),
							"inactive"
						),
					],
				},
			});
			return;
		}

		const isConnected = await plugin.oauthService.isConnected("google");
		const connection = isConnected ? await plugin.oauthService.getConnection("google") : null;

		if (isConnected && connection) {
			// Connected state card
			const connectedDate = connection.connectedAt ? new Date(connection.connectedAt) : null;
			const timeAgo = connectedDate ? getRelativeTime(connectedDate, translate) : "";

			// Create info displays
			const connectedInfo = activeWindow.createDiv();
			connectedInfo.className = "tasknotes-calendar-info";
			connectedInfo.textContent = connectedDate
				? translate(msg({ message: "Connected {time}", context: "settings.integrations.oauth.connectedAt" }), { time: timeAgo })
				: translate(msg({ message: "Connected", context: "settings.integrations.oauth.connected" }));

			const lastRefreshInfo = activeWindow.createDiv();
			lastRefreshInfo.className = "tasknotes-calendar-info";
			if (connection.lastRefreshed) {
				const lastRefreshDate = new Date(connection.lastRefreshed);
				lastRefreshInfo.textContent = translate(msg({ message: "Last refreshed {time}", context: "settings.integrations.oauth.refreshedAt" }), {
					time: getRelativeTime(lastRefreshDate, translate),
				});
			} else {
				lastRefreshInfo.textContent = translate(
					msg({ message: "Never refreshed", context: "settings.integrations.oauth.neverRefreshed" })
				);
			}

			createCard(googleCalendarContainer, {
				collapsible: true,
				defaultCollapsed: false,
				colorIndicator: {
					color: "#4285F4", // Google blue
				},
				header: {
					primaryText: translate(msg({ message: "Google Calendar", context: "contextMenus.task.calendar.google" })),
					secondaryText: translate(msg({ message: "OAuth 2.0 connection", context: "settings.integrations.oauth.connection" })),
					meta: [
						createStatusBadge(
							translate(msg({ message: "Connected", context: "settings.integrations.oauth.connected" })),
							"active"
						),
					],
				},
				content: {
					sections: [
						{
							rows: [
								{
									label: translate(
										msg({ message: "Status", context: "settings.taskProperties.properties.status.name" })
									),
									input: connectedInfo,
								},
								{
									label: translate(msg({ message: "Sync:", context: "settings.integrations.oauth.syncLabel" })),
									input: lastRefreshInfo,
								},
							],
						},
					],
				},
				actions: {
					buttons: [
						{
							text: translate(msg({ message: "Refresh now", context: "settings.integrations.oauth.refresh" })),
							icon: "refresh-cw",
							variant: "primary",
							onClick: async () => {
								try {
									if (plugin.googleCalendarService) {
										await plugin.googleCalendarService.refresh();
										new Notice(
											translate(
												msg({ message: "{provider} refreshed successfully", context: "settings.integrations.oauth.refreshSuccess" }),
												{ provider: uiData("Google Calendar", "Upstream product or console name; not plugin-authored prose") }
											)
										);
										void renderGoogleCalendarCard(); // Re-render to update timestamp
									}
								} catch (error) {
									tasknotesLogger.error("Failed to refresh:", {
										category: "configuration",
										operation: "refresh",
										error: error,
									});
									new Notice(
										translate(msg({ message: "Failed to refresh {provider}", context: "settings.integrations.oauth.refreshFailed" }), {
											provider: uiData("Google Calendar", "Upstream product or console name; not plugin-authored prose"),
										})
									);
								}
							},
						},
						{
							text: translate(msg({ message: "Disconnect", context: "settings.integrations.oauth.disconnect" })),
							icon: "log-out",
							variant: "warning",
							onClick: async () => {
								try {
									const oauthService = plugin.oauthService;
									if (!oauthService) return;
									await oauthService.disconnect("google");
									new Notice(
										translate(msg({ message: "Disconnected from {provider}", context: "settings.integrations.oauth.disconnectSuccess" }), {
											provider: uiData("Google Calendar", "Upstream product or console name; not plugin-authored prose"),
										})
									);
									void renderGoogleCalendarCard(); // Re-render to show disconnected state
								} catch (error) {
									tasknotesLogger.error("Failed to disconnect:", {
										category: "configuration",
										operation: "disconnect",
										error: error,
									});
									new Notice(
										translate(msg({ message: "Failed to disconnect from {provider}", context: "settings.integrations.oauth.disconnectFailed" }), {
											provider: uiData("Google Calendar", "Upstream product or console name; not plugin-authored prose"),
										})
									);
								}
							},
						},
					],
				},
			});
		} else {
			// Disconnected state card
			const helpText = activeWindow.createDiv();
			helpText.className = "tasknotes-calendar-help";
			helpText.textContent =
				translate(msg({ message: "Connect your {provider} account to sync events into TaskNotes.", context: "settings.integrations.oauth.help" }), { provider: uiData("Google Calendar", "Upstream product or console name; not plugin-authored prose") }) +
				" " +
				translate(msg({ message: "Events refresh automatically every 15 minutes.", context: "settings.integrations.oauth.googleRefreshInterval" }));

			// Build sections and credential inputs
			const sections: CardSection[] = [
				{
					rows: [
						{
							label: translate(msg({ message: "Info:", context: "settings.integrations.oauth.infoLabel" })),
							input: helpText,
							fullWidth: true,
						},
					],
				},
			];

			const credentialControls = createOAuthCredentialControls(
				plugin,
				"google",
				uiData("your-client-id.apps.googleusercontent.com", "Example OAuth credential syntax; credential identifiers must not be translated"),
				uiData("your-client-secret", "Example OAuth credential syntax; credential identifiers must not be translated")
			);

			const credentialNote = activeWindow.createDiv();
			credentialNote.className = "tasknotes-credential-note";
			credentialNote.textContent = translate(msg({ message: "Enter OAuth app credentials from {portal}. Obsidian Secret Storage encrypts credentials at rest when supported by the operating system.", context: "settings.integrations.oauth.credentialNote" }), {
				portal: uiData("Google Cloud Console", "Upstream product or console name; not plugin-authored prose"),
			});

			sections.push({
				rows: [
					{
						label: translate(msg({ message: "Client ID:", context: "settings.integrations.oauth.clientIdLabel" })),
						input: credentialControls.clientIdInput,
					},
					{
						label: translate(msg({ message: "Client secret:", context: "settings.integrations.oauth.clientSecretLabel" })),
						input: credentialControls.clientSecretInput,
					},
					{ label: "", input: credentialNote, fullWidth: true },
				],
			});

			createCard(googleCalendarContainer, {
				collapsible: true,
				defaultCollapsed: false,
				colorIndicator: {
					color: "#9AA0A6", // Google gray
				},
				header: {
					primaryText: translate(msg({ message: "Google Calendar", context: "contextMenus.task.calendar.google" })),
					secondaryText: translate(msg({ message: "OAuth 2.0 connection", context: "settings.integrations.oauth.connection" })),
					meta: [
						createStatusBadge(
							translate(msg({ message: "Not connected", context: "settings.integrations.oauth.disconnected" })),
							"inactive"
						),
					],
				},
				content: {
					sections: sections,
				},
				actions: {
					buttons: [
						{
							text: translate(msg({ message: "Connect {provider}", context: "settings.integrations.oauth.connect" }), {
								provider: uiData("Google Calendar", "Upstream product or console name; not plugin-authored prose"),
							}),
							icon: "link",
							variant: "primary",
							onClick: async () => {
								try {
									const oauthService = plugin.oauthService;
									if (!oauthService) return;
									credentialControls.persistPendingValues();
									await oauthService.authenticate("google");
									new Notice(
										translate(msg({ message: "{provider} connected successfully!", context: "settings.integrations.oauth.connectSuccess" }), {
											provider: uiData("Google Calendar", "Upstream product or console name; not plugin-authored prose"),
										})
									);
									void renderGoogleCalendarCard(); // Re-render to show connected state
								} catch (error) {
									tasknotesLogger.error("Failed to connect:", {
										category: "configuration",
										operation: "connect",
										error: error,
									});
									new Notice(
										translate(msg({ message: "Failed to connect: {message}", context: "settings.integrations.oauth.connectFailed" }), {
											message: displayError(getErrorMessage(error)),
										})
									);
								}
							},
						},
						...(credentialControls.hasStoredCredentials
							? [
									{
										text: translate(msg({ message: "Forget saved credentials", context: "settings.integrations.oauth.forget" })),
										icon: "trash-2",
										variant: "warning" as const,
										onClick: async () => {
											const confirmed = await showConfirmationModal(
												plugin.app,
												{
													title: translate(
														msg({ message: "Forget OAuth credentials for {provider}?", context: "settings.integrations.oauth.forgetTitle" }),
														{ provider: uiData("Google Calendar", "Upstream product or console name; not plugin-authored prose") }
													),
													message: translate(
														msg({ message: "This removes the saved client ID and client secret from Obsidian secret storage.", context: "settings.integrations.oauth.forgetMessage" })
													),
													confirmText: translate(
														msg({ message: "Forget credentials", context: "settings.integrations.oauth.forgetConfirm" })
													),
													isDestructive: true,
												}
											);
											if (!confirmed) return;
											plugin.oauthService.clearCredentials("google");
											new Notice(
												translate(msg({ message: "Forgot OAuth credentials for {provider}", context: "settings.integrations.oauth.forgotten" }), {
													provider: uiData("Google Calendar", "Upstream product or console name; not plugin-authored prose"),
												})
											);
											void renderGoogleCalendarCard();
										},
									},
								]
							: []),
					],
				},
			});
		}
	};

	// Initial render
	void renderGoogleCalendarCard();

	// Microsoft Calendar container for card-based UI
	const microsoftCalendarContainer = container.createDiv(
		"microsoft-calendar-integration-container"
	);

	// Check connection status and render card
	const renderMicrosoftCalendarCard = async () => {
		microsoftCalendarContainer.empty();

		if (!plugin.oauthService) {
			createCard(microsoftCalendarContainer, {
				header: {
					primaryText: uiData("Microsoft Outlook Calendar", "Proper Microsoft product name, not translatable UI copy"),
					secondaryText: translate(msg({ message: "OAUTH service not available", context: "settings.integrations.oauth.unavailable" })),
					meta: [
						createStatusBadge(
							translate(msg({ message: "Error", context: "settings.integrations.subscriptionsList.statusLabels.error" })),
							"inactive"
						),
					],
				},
			});
			return;
		}

		const isConnected = await plugin.oauthService.isConnected("microsoft");
		const connection = isConnected
			? await plugin.oauthService.getConnection("microsoft")
			: null;

		if (isConnected && connection) {
			// Connected state card
			const connectedDate = connection.connectedAt ? new Date(connection.connectedAt) : null;
			const timeAgo = connectedDate ? getRelativeTime(connectedDate, translate) : "";

			// Create info displays
			const connectedInfo = activeWindow.createDiv();
			connectedInfo.className = "tasknotes-calendar-info";
			connectedInfo.textContent = connectedDate
				? translate(msg({ message: "Connected {time}", context: "settings.integrations.oauth.connectedAt" }), { time: timeAgo })
				: translate(msg({ message: "Connected", context: "settings.integrations.oauth.connected" }));

			const tokenRefreshInfo = activeWindow.createDiv();
			tokenRefreshInfo.className = "tasknotes-calendar-info";
			if (connection.lastRefreshed) {
				const lastRefreshDate = new Date(connection.lastRefreshed);
				tokenRefreshInfo.textContent = translate(
					msg({ message: "OAuth token refreshed {time}", context: "settings.integrations.oauth.tokenRefreshed" }),
					{ time: getRelativeTime(lastRefreshDate, translate) }
				);
			} else {
				tokenRefreshInfo.textContent = translate(
					msg({ message: "Token not refreshed yet", context: "settings.integrations.oauth.tokenNotRefreshed" })
				);
			}

			const syncStatus = plugin.microsoftCalendarService?.getSyncStatus();
			const syncInfo = activeWindow.createDiv();
			syncInfo.className = "tasknotes-calendar-info";
			if (!plugin.microsoftCalendarService) {
				syncInfo.addClass("tasknotes-calendar-info--warning");
				syncInfo.textContent = translate(msg({ message: "Calendar sync service not available", context: "settings.integrations.oauth.syncUnavailable" }));
			} else if (syncStatus?.lastError) {
				syncInfo.addClass("tasknotes-calendar-info--warning");
				const attemptedAt = syncStatus.lastAttempt
					? new Date(syncStatus.lastAttempt)
					: null;
				const attemptedText = attemptedAt
					? ` ${getRelativeTime(attemptedAt, translate)}`
					: "";
				syncInfo.textContent = translate(msg({ message: "Calendar sync failed {time}: {message}", context: "settings.integrations.oauth.syncFailed" }), {
					time: attemptedText.trim(),
					message: displayError(syncStatus.lastError),
				});
			} else if (syncStatus?.lastSuccess) {
				const lastSyncDate = new Date(syncStatus.lastSuccess);
				syncInfo.textContent = translate(msg({ message: "Calendar sync succeeded {time} (events: {count})", context: "settings.integrations.oauth.syncSuccess" }), {
					time: getRelativeTime(lastSyncDate, translate),
					count: syncStatus.eventsLoaded,
				});
			} else if (syncStatus?.lastAttempt) {
				const lastAttemptDate = new Date(syncStatus.lastAttempt);
				syncInfo.textContent = translate(msg({ message: "Calendar sync checked {time}", context: "settings.integrations.oauth.syncChecked" }), {
					time: getRelativeTime(lastAttemptDate, translate),
				});
			} else {
				syncInfo.textContent = translate(msg({ message: "Calendar events not refreshed yet", context: "settings.integrations.oauth.eventsNotRefreshed" }));
			}

			const microsoftRows: CardSection["rows"] = [
				{
					label: translate(msg({ message: "Status", context: "settings.taskProperties.properties.status.name" })),
					input: connectedInfo,
				},
				{
					label: translate(msg({ message: "Token:", context: "settings.integrations.oauth.tokenLabel" })),
					input: tokenRefreshInfo,
				},
				{ label: translate(msg({ message: "Sync:", context: "settings.integrations.oauth.syncLabel" })), input: syncInfo },
			];

			if (syncStatus?.calendarErrors.length) {
				const errorInfo = activeWindow.createDiv();
				errorInfo.className = "tasknotes-calendar-info tasknotes-calendar-info--warning";
				const firstError = syncStatus.calendarErrors[0];
				const calendarLabel =
					firstError.calendarName || firstError.calendarId || uiText(msg({ message: "Microsoft calendar", context: "settings/tabs/integrationsTab: renderIntegrationsTab.renderMicrosoftCalendarCard display" }));
				errorInfo.textContent =
					syncStatus.calendarErrors.length === 1
						? uiText(msg({ message: "{calendar}: {message}", context: "calendar sync single error" }), { calendar: calendarLabel, message: displayError(firstError.message) })
						: translate(msg({ message: "Calendars with errors: {count}. First error: {calendar}: {message}", context: "settings.integrations.oauth.calendarErrors" }), {
								count: syncStatus.calendarErrors.length,
								calendar: calendarLabel,
								message: displayError(firstError.message),
							});
				microsoftRows.push({
					label: translate(msg({ message: "Issue:", context: "settings.integrations.oauth.issueLabel" })),
					input: errorInfo,
					fullWidth: true,
				});
			}

			createCard(microsoftCalendarContainer, {
				collapsible: true,
				defaultCollapsed: false,
				colorIndicator: {
					color: "#0078D4", // Microsoft blue
				},
				header: {
					primaryText: uiData("Microsoft Outlook Calendar", "Proper Microsoft product name, not translatable UI copy"),
					secondaryText: translate(msg({ message: "OAuth 2.0 connection", context: "settings.integrations.oauth.connection" })),
					meta: [
						createStatusBadge(
							translate(msg({ message: "Connected", context: "settings.integrations.oauth.connected" })),
							"active"
						),
					],
				},
				content: {
					sections: [
						{
							rows: microsoftRows,
						},
					],
				},
				actions: {
					buttons: [
						{
							text: translate(msg({ message: "Refresh now", context: "settings.integrations.oauth.refresh" })),
							icon: "refresh-cw",
							variant: "primary",
							onClick: async () => {
								try {
									if (plugin.microsoftCalendarService) {
										await plugin.microsoftCalendarService.refresh();
										const latestStatus =
											plugin.microsoftCalendarService.getSyncStatus();
										if (latestStatus.lastError) {
											new Notice(
												translate(
													msg({ message: "{provider} refresh had errors: {message}", context: "settings.integrations.oauth.refreshErrors" }),
													{
														provider: uiData("Microsoft Outlook Calendar", "Upstream product or console name; not plugin-authored prose"),
														message: displayError(latestStatus.lastError),
													}
												)
											);
										} else {
											new Notice(
												translate(
													msg({ message: "{provider} refreshed successfully", context: "settings.integrations.oauth.refreshSuccess" }),
													{ provider: uiData("Microsoft Outlook Calendar", "Upstream product or console name; not plugin-authored prose") }
												)
											);
										}
										void renderMicrosoftCalendarCard();
									}
								} catch (error) {
									tasknotesLogger.error("Failed to refresh:", {
										category: "configuration",
										operation: "refresh",
										error: error,
									});
									new Notice(
										translate(msg({ message: "{provider} refresh had errors: {message}", context: "settings.integrations.oauth.refreshErrors" }), {
											provider: uiData("Microsoft Outlook Calendar", "Upstream product or console name; not plugin-authored prose"),
											message: displayError(getErrorMessage(error)),
										})
									);
								}
							},
						},
						{
							text: translate(msg({ message: "Disconnect", context: "settings.integrations.oauth.disconnect" })),
							icon: "log-out",
							variant: "warning",
							onClick: async () => {
								try {
									const oauthService = plugin.oauthService;
									if (!oauthService) return;
									await oauthService.disconnect("microsoft");
									await plugin.microsoftCalendarService?.disconnect();
									new Notice(
										translate(msg({ message: "Disconnected from {provider}", context: "settings.integrations.oauth.disconnectSuccess" }), {
											provider: uiData("Microsoft Outlook Calendar", "Upstream product or console name; not plugin-authored prose"),
										})
									);
									void renderMicrosoftCalendarCard();
								} catch (error) {
									tasknotesLogger.error("Failed to disconnect:", {
										category: "configuration",
										operation: "disconnect",
										error: error,
									});
									new Notice(
										translate(msg({ message: "Failed to disconnect from {provider}", context: "settings.integrations.oauth.disconnectFailed" }), {
											provider: uiData("Microsoft Outlook Calendar", "Upstream product or console name; not plugin-authored prose"),
										})
									);
								}
							},
						},
					],
				},
			});
		} else {
			// Disconnected state card
			const helpText = activeWindow.createDiv();
			helpText.className = "tasknotes-calendar-help";
			helpText.textContent = translate(msg({ message: "Connect your {provider} account to sync events into TaskNotes.", context: "settings.integrations.oauth.help" }), {
				provider: uiData("Microsoft Outlook", "Upstream product or console name; not plugin-authored prose"),
			});

			// Build sections and credential inputs
			const sections: CardSection[] = [
				{
					rows: [
						{
							label: translate(msg({ message: "Info:", context: "settings.integrations.oauth.infoLabel" })),
							input: helpText,
							fullWidth: true,
						},
					],
				},
			];

			const credentialControls = createOAuthCredentialControls(
				plugin,
				"microsoft",
				uiData("your-microsoft-client-id", "Example OAuth credential syntax; credential identifiers must not be translated"),
				uiData("your-microsoft-client-secret", "Example OAuth credential syntax; credential identifiers must not be translated")
			);

			const credentialNote = activeWindow.createDiv();
			credentialNote.className = "tasknotes-credential-note";
			credentialNote.textContent = translate(msg({ message: "Enter OAuth app credentials from {portal}. Obsidian Secret Storage encrypts credentials at rest when supported by the operating system.", context: "settings.integrations.oauth.credentialNote" }), {
				portal: uiData("Azure Portal", "Upstream product or console name; not plugin-authored prose"),
			});

			sections.push({
				rows: [
					{
						label: translate(msg({ message: "Client ID:", context: "settings.integrations.oauth.clientIdLabel" })),
						input: credentialControls.clientIdInput,
					},
					{
						label: translate(msg({ message: "Client secret:", context: "settings.integrations.oauth.clientSecretLabel" })),
						input: credentialControls.clientSecretInput,
					},
					{ label: "", input: credentialNote, fullWidth: true },
				],
			});

			createCard(microsoftCalendarContainer, {
				collapsible: true,
				defaultCollapsed: false,
				colorIndicator: {
					color: "#737373", // Microsoft gray
				},
				header: {
					primaryText: uiData("Microsoft Outlook Calendar", "Proper Microsoft product name, not translatable UI copy"),
					secondaryText: translate(msg({ message: "OAuth 2.0 connection", context: "settings.integrations.oauth.connection" })),
					meta: [
						createStatusBadge(
							translate(msg({ message: "Not connected", context: "settings.integrations.oauth.disconnected" })),
							"inactive"
						),
					],
				},
				content: {
					sections: sections,
				},
				actions: {
					buttons: [
						{
							text: translate(msg({ message: "Connect {provider}", context: "settings.integrations.oauth.connect" }), {
								provider: uiData("Microsoft Outlook Calendar", "Upstream product or console name; not plugin-authored prose"),
							}),
							icon: "link",
							variant: "primary",
							onClick: async () => {
								try {
									const oauthService = plugin.oauthService;
									if (!oauthService) return;
									credentialControls.persistPendingValues();
									await oauthService.authenticate("microsoft");
									await plugin.microsoftCalendarService?.initialize();
									new Notice(
										translate(msg({ message: "{provider} connected successfully!", context: "settings.integrations.oauth.connectSuccess" }), {
											provider: uiData("Microsoft Outlook Calendar", "Upstream product or console name; not plugin-authored prose"),
										})
									);
									void renderMicrosoftCalendarCard();
								} catch (error) {
									tasknotesLogger.error("Failed to connect:", {
										category: "configuration",
										operation: "connect",
										error: error,
									});
									new Notice(
										translate(msg({ message: "Failed to connect: {message}", context: "settings.integrations.oauth.connectFailed" }), {
											message: displayError(getErrorMessage(error)),
										})
									);
								}
							},
						},
						...(credentialControls.hasStoredCredentials
							? [
									{
										text: translate(msg({ message: "Forget saved credentials", context: "settings.integrations.oauth.forget" })),
										icon: "trash-2",
										variant: "warning" as const,
										onClick: async () => {
											const confirmed = await showConfirmationModal(
												plugin.app,
												{
													title: translate(
														msg({ message: "Forget OAuth credentials for {provider}?", context: "settings.integrations.oauth.forgetTitle" }),
														{ provider: uiData("Microsoft Outlook Calendar", "Upstream product or console name; not plugin-authored prose") }
													),
													message: translate(
														msg({ message: "This removes the saved client ID and client secret from Obsidian secret storage.", context: "settings.integrations.oauth.forgetMessage" })
													),
													confirmText: translate(
														msg({ message: "Forget credentials", context: "settings.integrations.oauth.forgetConfirm" })
													),
													isDestructive: true,
												}
											);
											if (!confirmed) return;
											plugin.oauthService.clearCredentials("microsoft");
											new Notice(
												translate(msg({ message: "Forgot OAuth credentials for {provider}", context: "settings.integrations.oauth.forgotten" }), {
													provider: uiData("Microsoft Outlook Calendar", "Upstream product or console name; not plugin-authored prose"),
												})
											);
											void renderMicrosoftCalendarCard();
										},
									},
								]
							: []),
					],
				},
			});
		}
	};

	// Initial render
	void renderMicrosoftCalendarCard();

	// Google Calendar Task Export Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Export tasks to Google Calendar", context: "settings.integrations.googleCalendarExport.header" })),
			description: translate(msg({ message: "Automatically sync your tasks to Google Calendar as events. Requires Google Calendar to be connected above.", context: "settings.integrations.googleCalendarExport.description" })),
		},
		(group) => {
			// Master toggle
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Enable task export", context: "settings.integrations.googleCalendarExport.enable.name" })),
						desc: translate(
							msg({ message: "When enabled, tasks with dates will be automatically synced to Google Calendar as events.", context: "settings.integrations.googleCalendarExport.enable.description" })
						),
						getValue: () => plugin.settings.googleCalendarExport.enabled,
						setValue: async (value: boolean) => {
							plugin.settings.googleCalendarExport.enabled = value;
							save();
						},
					})
			);

			// Target calendar dropdown (populated dynamically)
			group.addSetting((setting) => {
				setting.setName(
					translate(msg({ message: "Target calendar", context: "settings.integrations.googleCalendarExport.targetCalendar.name" }))
				);
				setting.setDesc(
					translate(
						msg({ message: "Select which calendar to create task events in.", context: "settings.integrations.googleCalendarExport.targetCalendar.description" })
					)
				);

				const dropdown = setting.controlEl.createEl("select", {
					cls: "dropdown",
				});
				dropdown.classList.remove(
					"tn-static-width-100-0466783d",
					"tn-static-width-12px-fbf353fb",
					"tn-static-width-16px-7375d50b",
					"tn-static-width-1px-aa77e27e",
					"tn-static-width-60px-bd09c419",
					"tn-static-width-80px-8573bae3"
				);
				dropdown.classList.add("tn-static-width-200px-2acaf3b5");

				// Add placeholder option
				dropdown.createEl("option", {
					text: translate(
						msg({ message: "Select a calendar...", context: "settings.integrations.googleCalendarExport.targetCalendar.placeholder" })
					),
					value: "",
				});

				// Populate calendars if connected
				const populateCalendars = async () => {
					// Clear existing options except placeholder
					while (dropdown.options.length > 1) {
						dropdown.remove(1);
					}

					const isConnected =
						plugin.oauthService && (await plugin.oauthService.isConnected("google"));
					if (isConnected && plugin.googleCalendarService) {
						const calendars = plugin.googleCalendarService.getAvailableCalendars();
						for (const cal of calendars) {
							const option = dropdown.createEl("option", {
								text:
									cal.summary +
									(cal.primary
										? translate(
												msg({ message: " (Primary)", context: "settings.integrations.googleCalendarExport.targetCalendar.primarySuffix" })
											)
										: ""),
								value: cal.id,
							});
							if (cal.id === plugin.settings.googleCalendarExport.targetCalendarId) {
								option.selected = true;
							}
						}
					} else {
						dropdown.createEl("option", {
							text: translate(
								msg({ message: "Connect Google Calendar first", context: "settings.integrations.googleCalendarExport.targetCalendar.connectFirst" })
							),
							value: "",
						});
					}
				};

				void populateCalendars();

				// Re-populate when calendar data is fetched after startup.
				// Clean up the listener automatically when this settings control is detached.
				let unsubscribeGoogleCalendarDataChanged: (() => void) | null = null;
				let detachObserver: MutationObserver | null = null;
				const cleanupGoogleCalendarDataChanged = () => {
					if (unsubscribeGoogleCalendarDataChanged) {
						unsubscribeGoogleCalendarDataChanged();
						unsubscribeGoogleCalendarDataChanged = null;
					}
					if (detachObserver) {
						detachObserver.disconnect();
						detachObserver = null;
					}
				};

				unsubscribeGoogleCalendarDataChanged = plugin.googleCalendarService.on(
					"data-changed",
					() => {
						if (!dropdown.isConnected) {
							cleanupGoogleCalendarDataChanged();
							return;
						}
						void populateCalendars();
					}
				);

				detachObserver = new MutationObserver(() => {
					if (!dropdown.isConnected) {
						cleanupGoogleCalendarDataChanged();
					}
				});
				detachObserver.observe(container.ownerDocument.body, {
					childList: true,
					subtree: true,
				});

				dropdown.addEventListener("change", () => {
					plugin.settings.googleCalendarExport.targetCalendarId = dropdown.value;
					save();
				});
			});

			// Sync trigger
			group.addSetting(
				(setting) =>
					void configureDropdownSetting(setting, {
						name: translate(
							msg({ message: "Sync trigger", context: "settings.integrations.googleCalendarExport.syncTrigger.name" })
						),
						desc: translate(
							msg({ message: "Which task date should trigger calendar event creation.", context: "settings.integrations.googleCalendarExport.syncTrigger.description" })
						),
						options: [
							{
								value: "scheduled",
								label: translate(
									msg({ message: "Scheduled date", context: "settings.integrations.googleCalendarExport.syncTrigger.options.scheduled" })
								),
							},
							{
								value: "due",
								label: translate(
									msg({ message: "Due date", context: "settings.integrations.googleCalendarExport.syncTrigger.options.due" })
								),
							},
							{
								value: "both",
								label: translate(
									msg({ message: "Both (prefer scheduled)", context: "settings.integrations.googleCalendarExport.syncTrigger.options.both" })
								),
							},
						],
						getValue: () => plugin.settings.googleCalendarExport.syncTrigger,
						setValue: async (value: string) => {
							plugin.settings.googleCalendarExport.syncTrigger = value as
								| "scheduled"
								| "due"
								| "both";
							save();
						},
					})
			);

			// Create as all-day
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Create as all-day events", context: "settings.integrations.googleCalendarExport.allDayEvents.name" })
						),
						desc: translate(
							msg({ message: "When enabled, tasks are created as all-day events. When disabled, uses time estimate for duration.", context: "settings.integrations.googleCalendarExport.allDayEvents.description" })
						),
						getValue: () => plugin.settings.googleCalendarExport.createAsAllDay,
						setValue: async (value: boolean) => {
							plugin.settings.googleCalendarExport.createAsAllDay = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Show all-day task events as free", context: "settings.integrations.googleCalendarExport.showAllDayAsFree.name" })
						),
						desc: translate(
							msg({ message: "All-day task exports do not block availability, including tasks converted to all-day. Timed events stay busy. Run sync all tasks to apply changes to existing events.", context: "settings.integrations.googleCalendarExport.showAllDayAsFree.description" })
						),
						getValue: () => plugin.settings.googleCalendarExport.showAllDayAsFree,
						setValue: async (value: boolean) => {
							plugin.settings.googleCalendarExport.showAllDayAsFree = value;
							save();
						},
					})
			);

			// Default duration (only relevant for timed events)
			group.addSetting(
				(setting) =>
					void configureNumberSetting(setting, {
						name: translate(
							msg({ message: "Default event duration", context: "settings.integrations.googleCalendarExport.defaultDuration.name" })
						),
						desc: translate(
							msg({ message: "Duration in minutes for timed events (used when task has no time estimate).", context: "settings.integrations.googleCalendarExport.defaultDuration.description" })
						),
						getValue: () => plugin.settings.googleCalendarExport.defaultEventDuration,
						setValue: async (value: number) => {
							plugin.settings.googleCalendarExport.defaultEventDuration = value;
							save();
						},
						min: 15,
						max: 480,
					})
			);

			// Event title template
			group.addSetting(
				(setting) =>
					void configureTextSetting(setting, {
						name: translate(
							msg({ message: "Event title template", context: "settings.integrations.googleCalendarExport.eventTitleTemplate.name" })
						),
						desc: translate(
							msg({ message: "Template for event titles. Available variables: '{{title}}', '{{status}}', '{{priority}}'", context: "settings.integrations.googleCalendarExport.eventTitleTemplate.description" })
						),
						placeholder: translate(
							msg({ message: "'{{title}}'", context: "settings.integrations.googleCalendarExport.eventTitleTemplate.placeholder" })
						),
						getValue: () => plugin.settings.googleCalendarExport.eventTitleTemplate,
						setValue: async (value: string) => {
							plugin.settings.googleCalendarExport.eventTitleTemplate =
								value || "{{title}}";
							save();
						},
					})
			);

			// Include description
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Include task details in description", context: "settings.integrations.googleCalendarExport.includeDescription.name" })
						),
						desc: translate(
							msg({ message: "Add task metadata (priority, status, tags, etc.) to the event description.", context: "settings.integrations.googleCalendarExport.includeDescription.description" })
						),
						getValue: () => plugin.settings.googleCalendarExport.includeDescription,
						setValue: async (value: boolean) => {
							plugin.settings.googleCalendarExport.includeDescription = value;
							save();
						},
					})
			);

			// Include Obsidian link
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Include Obsidian link", context: "settings.integrations.googleCalendarExport.includeObsidianLink.name" })
						),
						desc: translate(
							msg({ message: "Add a link back to the task in Obsidian in the event description.", context: "settings.integrations.googleCalendarExport.includeObsidianLink.description" })
						),
						getValue: () => plugin.settings.googleCalendarExport.includeObsidianLink,
						setValue: async (value: boolean) => {
							plugin.settings.googleCalendarExport.includeObsidianLink = value;
							save();
						},
					})
			);

			// Default reminder minutes
			group.addSetting(
				(setting) =>
					void configureTextSetting(setting, {
						name: translate(
							msg({ message: "Default reminder", context: "settings.integrations.googleCalendarExport.defaultReminder.name" })
						),
						desc: translate(
							msg({ message: "Add popup reminders to timed Google Calendar events. Enter minutes before the event, separated by commas. Leave empty to use calendar defaults. Common values: 15, 30, 60, 1440.", context: "settings.integrations.googleCalendarExport.defaultReminder.description" })
						),
						getValue: () =>
							formatDefaultReminderMinutes(
								plugin.settings.googleCalendarExport.defaultReminderMinutes
							),
						setValue: async (value: string) => {
							plugin.settings.googleCalendarExport.defaultReminderMinutes =
								parseDefaultReminderMinutes(value);
							save();
						},
						placeholder: "60, 1440",
					})
			);

			// Sync behavior toggles - section header
			group.addSetting((setting) => {
				setting.setName(
					translate(
						msg({ message: "Automatic sync behavior", context: "settings.integrations.googleCalendarExport.automaticSyncBehavior.header" })
					)
				);
				setting.setHeading();
			});

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Sync on task create", context: "settings.integrations.googleCalendarExport.syncOnCreate.name" })
						),
						desc: translate(
							msg({ message: "Automatically create calendar event when a new task is created.", context: "settings.integrations.googleCalendarExport.syncOnCreate.description" })
						),
						getValue: () => plugin.settings.googleCalendarExport.syncOnTaskCreate,
						setValue: async (value: boolean) => {
							plugin.settings.googleCalendarExport.syncOnTaskCreate = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Sync on task update", context: "settings.integrations.googleCalendarExport.syncOnUpdate.name" })
						),
						desc: translate(
							msg({ message: "Automatically update calendar event when a task is modified.", context: "settings.integrations.googleCalendarExport.syncOnUpdate.description" })
						),
						getValue: () => plugin.settings.googleCalendarExport.syncOnTaskUpdate,
						setValue: async (value: boolean) => {
							plugin.settings.googleCalendarExport.syncOnTaskUpdate = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Sync on task complete", context: "settings.integrations.googleCalendarExport.syncOnComplete.name" })
						),
						desc: translate(
							msg({ message: "Update calendar event when a task is completed (adds checkmark to title).", context: "settings.integrations.googleCalendarExport.syncOnComplete.description" })
						),
						getValue: () => plugin.settings.googleCalendarExport.syncOnTaskComplete,
						setValue: async (value: boolean) => {
							plugin.settings.googleCalendarExport.syncOnTaskComplete = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Delete event on task delete", context: "settings.integrations.googleCalendarExport.syncOnDelete.name" })
						),
						desc: translate(
							msg({ message: "Remove calendar event when the corresponding task is deleted.", context: "settings.integrations.googleCalendarExport.syncOnDelete.description" })
						),
						getValue: () => plugin.settings.googleCalendarExport.syncOnTaskDelete,
						setValue: async (value: boolean) => {
							plugin.settings.googleCalendarExport.syncOnTaskDelete = value;
							save();
						},
					})
			);

			// Manual sync actions - section header
			group.addSetting((setting) => {
				setting.setName(
					translate(msg({ message: "Manual sync actions", context: "settings.integrations.googleCalendarExport.manualSyncActions.header" }))
				);
				setting.setHeading();
			});

			group.addSetting(
				(setting) =>
					void configureButtonSetting(setting, {
						name: translate(
							msg({ message: "Sync all tasks", context: "settings.integrations.googleCalendarExport.syncAllTasks.name" })
						),
						desc: translate(
							msg({ message: "Sync all existing tasks to Google Calendar. This will create events for tasks that haven''t been synced yet.", context: "settings.integrations.googleCalendarExport.syncAllTasks.description" })
						),
						buttonText: translate(
							msg({ message: "Sync all", context: "settings.integrations.googleCalendarExport.syncAllTasks.buttonText" })
						),
						onClick: async () => {
							if (!plugin.taskCalendarSyncService?.isEnabled()) {
								new Notice(
									translate(
										msg({ message: "Google Calendar export is not enabled or configured", context: "settings.integrations.googleCalendarExport.notices.notEnabledOrConfigured" })
									)
								);
								return;
							}
							const results = await plugin.taskCalendarSyncService.syncAllTasks();
							new Notice(
								translate(
									msg({ message: "Synced: {synced}, Failed: {failed}, Skipped: {skipped}", context: "settings.integrations.googleCalendarExport.notices.syncResults" }),
									{
										synced: results.synced,
										failed: results.failed,
										skipped: results.skipped,
									}
								)
							);
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureButtonSetting(setting, {
						name: translate(
							msg({ message: "Unlink all tasks", context: "settings.integrations.googleCalendarExport.unlinkAllTasks.name" })
						),
						desc: translate(
							msg({ message: "Remove all task-event links without deleting calendar events.", context: "settings.integrations.googleCalendarExport.unlinkAllTasks.description" })
						),
						buttonText: translate(
							msg({ message: "Unlink all", context: "settings.integrations.googleCalendarExport.unlinkAllTasks.buttonText" })
						),
						onClick: async () => {
							if (!plugin.taskCalendarSyncService) {
								new Notice(
									translate(
										msg({ message: "Task calendar sync service not available", context: "settings.integrations.googleCalendarExport.notices.serviceNotAvailable" })
									)
								);
								return;
							}
							const confirmed = await showConfirmationModal(plugin.app, {
								title: translate(
									msg({ message: "Unlink all tasks", context: "settings.integrations.googleCalendarExport.unlinkAllTasks.confirmTitle" })
								),
								message: translate(
									msg({ message: "This will remove all links between tasks and calendar events. The calendar events will remain but will no longer be updated when tasks change. Are you sure?", context: "settings.integrations.googleCalendarExport.unlinkAllTasks.confirmMessage" })
								),
								confirmText: translate(
									msg({ message: "Unlink all", context: "settings.integrations.googleCalendarExport.unlinkAllTasks.confirmButtonText" })
								),
								isDestructive: true,
							});
							if (confirmed) {
								await plugin.taskCalendarSyncService.unlinkAllTasks(false);
							}
						},
					})
			);
		}
	);

	// Calendar Subscriptions Section (ICS)
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Calendar subscriptions", context: "settings.integrations.calendarSubscriptions.header" })),
			description: translate(msg({ message: "Subscribe to external calendars via ICS/iCal URLs to view events alongside your tasks.", context: "settings.integrations.calendarSubscriptions.description" })),
		},
		(group) => {
			// Default settings for ICS integration
			group.addSetting(
				(setting) =>
					void configureTextSetting(setting, {
						name: translate(
							msg({ message: "Default note template", context: "settings.integrations.calendarSubscriptions.defaultNoteTemplate.name" })
						),
						desc: translate(
							msg({ message: "Path to template file for notes created from ICS events", context: "settings.integrations.calendarSubscriptions.defaultNoteTemplate.description" })
						),
						placeholder: uiData("Templates/Event Template.md", "Literal vault template-path example; existing configured ICS template locations are not translated"),
						getValue: () => plugin.settings.icsIntegration.defaultNoteTemplate,
						setValue: async (value: string) => {
							plugin.settings.icsIntegration.defaultNoteTemplate = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureTextSetting(setting, {
						name: translate(
							msg({ message: "Default note folder", context: "settings.integrations.calendarSubscriptions.defaultNoteFolder.name" })
						),
						desc: translate(
							msg({ message: "Folder for notes created from ICS events", context: "settings.integrations.calendarSubscriptions.defaultNoteFolder.description" })
						),
						placeholder: translate(
							msg({ message: "Calendar/Events", context: "settings.integrations.calendarSubscriptions.defaultNoteFolder.placeholder" })
						),
						getValue: () => plugin.settings.icsIntegration.defaultNoteFolder,
						setValue: async (value: string) => {
							plugin.settings.icsIntegration.defaultNoteFolder = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureDropdownSetting(setting, {
						name: translate(
							msg({ message: "ICS note filename format", context: "settings.integrations.calendarSubscriptions.filenameFormat.name" })
						),
						desc: translate(
							msg({ message: "How filenames are generated for notes created from ICS events", context: "settings.integrations.calendarSubscriptions.filenameFormat.description" })
						),
						options: [
							{
								value: "title",
								label: translate(
									msg({ message: "Event title", context: "settings.integrations.calendarSubscriptions.filenameFormat.options.title" })
								),
							},
							{
								value: "zettel",
								label: translate(
									msg({ message: "Zettelkasten format", context: "settings.integrations.calendarSubscriptions.filenameFormat.options.zettel" })
								),
							},
							{
								value: "timestamp",
								label: translate(
									msg({ message: "Timestamp", context: "settings.integrations.calendarSubscriptions.filenameFormat.options.timestamp" })
								),
							},
							{
								value: "custom",
								label: translate(
									msg({ message: "Custom template", context: "settings.integrations.calendarSubscriptions.filenameFormat.options.custom" })
								),
							},
						],
						getValue: () => plugin.settings.icsIntegration.icsNoteFilenameFormat,
						setValue: async (value: string) => {
							if (!isICSNoteFilenameFormat(value)) {
								return;
							}
							plugin.settings.icsIntegration.icsNoteFilenameFormat = value;
							save();
							// Re-render to show custom template field if needed
							renderIntegrationsTab(container, plugin, save);
						},
					})
			);

			if (plugin.settings.icsIntegration.icsNoteFilenameFormat === "custom") {
				group.addSetting(
					(setting) =>
						void configureTextSetting(setting, {
							name: translate(
								msg({ message: "Custom ICS filename template", context: "settings.integrations.calendarSubscriptions.customTemplate.name" })
							),
							desc: translate(
								msg({ message: "Template for custom ICS event filenames", context: "settings.integrations.calendarSubscriptions.customTemplate.description" })
							),
							placeholder: translate(
								msg({ message: "'{date}'-'{title}'", context: "settings.integrations.calendarSubscriptions.customTemplate.placeholder" })
							),
							getValue: () =>
								plugin.settings.icsIntegration.customICSNoteFilenameTemplate,
							setValue: async (value: string) => {
								plugin.settings.icsIntegration.customICSNoteFilenameTemplate =
									value;
								save();
							},
						})
				);
			}

			// Task creation settings
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Use ICS event end time as task due date", context: "settings.integrations.calendarSubscriptions.useICSEndAsDue.name" })
						),
						desc: translate(
							msg({ message: "When enabled, tasks created from calendar events will have their due date set to the event''s end time. For all-day events, the due date will be set to the event date. For timed events, the due date will include the end time.", context: "settings.integrations.calendarSubscriptions.useICSEndAsDue.description" })
						),
						getValue: () => plugin.settings.icsIntegration.useICSEndAsDue ?? false,
						setValue: async (value: boolean) => {
							plugin.settings.icsIntegration.useICSEndAsDue = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureDropdownSetting(setting, {
						name: translate(
							msg({ message: "Recurring event related notes", context: "settings.integrations.calendarSubscriptions.recurringEventRelatedNotesMode.name" })
						),
						desc: translate(
							msg({ message: "Choose whether notes linked to one recurrence of an external calendar event appear across the loaded series or only on the selected instance.", context: "settings.integrations.calendarSubscriptions.recurringEventRelatedNotesMode.description" })
						),
						options: [
							{
								value: "series",
								label: translate(
									msg({ message: "Series-wide", context: "settings.integrations.calendarSubscriptions.recurringEventRelatedNotesMode.options.series" })
								),
							},
							{
								value: "instance",
								label: translate(
									msg({ message: "Selected instance only", context: "settings.integrations.calendarSubscriptions.recurringEventRelatedNotesMode.options.instance" })
								),
							},
						],
						getValue: () =>
							plugin.settings.icsIntegration.recurringEventRelatedNotesMode ??
							"series",
						setValue: async (value: string) => {
							if (!isRecurringEventRelatedNotesMode(value)) {
								return;
							}
							plugin.settings.icsIntegration.recurringEventRelatedNotesMode = value;
							save();
						},
					})
			);
		}
	);

	// ICS Subscriptions List - buttons first, then cards
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Calendar subscriptions list", context: "settings.integrations.subscriptionsList.header" })),
		},
		(group) => {
			// Add subscription button
			group.addSetting(
				(setting) =>
					void configureButtonSetting(setting, {
						name: translate(
							msg({ message: "Add calendar subscription", context: "settings.integrations.subscriptionsList.addSubscription.name" })
						),
						desc: translate(
							msg({ message: "Add a new calendar subscription from ICS/iCal URL or local file", context: "settings.integrations.subscriptionsList.addSubscription.description" })
						),
						buttonText: translate(
							msg({ message: "Add subscription", context: "settings.integrations.subscriptionsList.addSubscription.buttonText" })
						),
						onClick: async () => {
							// Create a new subscription with temporary values
							const newSubscription = {
								name: uiData("New calendar", "Persisted calendar subscription seed; display-only translation"),
								url: "",
								color: "#6366f1",
								enabled: false, // Start disabled until user fills in details
								type: "remote" as const,
								refreshInterval: 60,
							};

							if (!plugin.icsSubscriptionService) {
								new Notice(
									translate(
										msg({ message: "ICS subscription service not available", context: "settings.integrations.subscriptionsList.notices.serviceUnavailable" })
									)
								);
								return;
							}

							try {
								await plugin.icsSubscriptionService.addSubscription(
									newSubscription
								);
								new Notice(
									translate(
										msg({ message: "New calendar subscription added - please configure the details", context: "settings.integrations.subscriptionsList.notices.addSuccess" })
									)
								);
								// Re-render to show the new subscription card
								renderICSSubscriptionsList(icsContainer, plugin, save);
							} catch (error) {
								tasknotesLogger.error("Error adding subscription:", {
									category: "provider",
									operation: "adding-subscription",
									error: error,
								});
								new Notice(
									translate(
										msg({ message: "Failed to add subscription", context: "settings.integrations.subscriptionsList.notices.addFailure" })
									)
								);
							}
						},
					})
			);

			// Refresh all subscriptions button
			group.addSetting(
				(setting) =>
					void configureButtonSetting(setting, {
						name: translate(msg({ message: "Refresh all subscriptions", context: "settings.integrations.subscriptionsList.refreshAll.name" })),
						desc: translate(
							msg({ message: "Manually refresh all enabled calendar subscriptions", context: "settings.integrations.subscriptionsList.refreshAll.description" })
						),
						buttonText: translate(
							msg({ message: "Refresh all", context: "settings.integrations.subscriptionsList.refreshAll.buttonText" })
						),
						onClick: async () => {
							if (plugin.icsSubscriptionService) {
								try {
									await plugin.icsSubscriptionService.refreshAllSubscriptions();
									new Notice(
										translate(
											msg({ message: "All calendar subscriptions refreshed successfully", context: "settings.integrations.subscriptionsList.notices.refreshSuccess" })
										)
									);
								} catch (error) {
									tasknotesLogger.error("Error refreshing subscriptions:", {
										category: "provider",
										operation: "refreshing-subscriptions",
										error: error,
									});
									new Notice(
										translate(
											msg({ message: "Failed to refresh some calendar subscriptions", context: "settings.integrations.subscriptionsList.notices.refreshFailure" })
										)
									);
								}
							}
						},
					})
			);
		}
	);

	const icsContainer = container.createDiv("ics-subscriptions-container");
	renderICSSubscriptionsList(icsContainer, plugin, save);

	// Automatic ICS Export Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Automatic ICS export", context: "settings.integrations.autoExport.header" })),
			description: translate(msg({ message: "Automatically export all your tasks to an ICS file.", context: "settings.integrations.autoExport.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Enable automatic export", context: "settings.integrations.autoExport.enable.name" })),
						desc: translate(msg({ message: "Automatically keep an ICS file updated with all your tasks", context: "settings.integrations.autoExport.enable.description" })),
						getValue: () => plugin.settings.icsIntegration.enableAutoExport,
						setValue: async (value: boolean) => {
							plugin.settings.icsIntegration.enableAutoExport = value;
							save();
							new Notice(
								translate(msg({ message: "Please reload Obsidian for the automatic export changes to take effect.", context: "settings.integrations.autoExport.notices.reloadRequired" }))
							);
							// Re-render to show/hide export settings
							renderIntegrationsTab(container, plugin, save);
						},
					})
			);

			if (plugin.settings.icsIntegration.enableAutoExport) {
				group.addSetting(
					(setting) =>
						void configureTextSetting(setting, {
							name: translate(msg({ message: "Export file path", context: "settings.integrations.autoExport.filePath.name" })),
							desc: translate(
								msg({ message: "Path where the ICS file will be saved (relative to vault root)", context: "settings.integrations.autoExport.filePath.description" })
							),
							placeholder: uiData("tasknotes-calendar.ics", "Literal export filename, also the unchanged empty-input fallback used by the file writer"),
							getValue: () => plugin.settings.icsIntegration.autoExportPath,
							setValue: async (value: string) => {
								plugin.settings.icsIntegration.autoExportPath =
									value || "tasknotes-calendar.ics";
								save();
							},
						})
				);

				group.addSetting(
					(setting) =>
						void configureNumberSetting(setting, {
							name: translate(msg({ message: "Update interval (between 5 and 1440 minutes)", context: "settings.integrations.autoExport.interval.name" })),
							desc: translate(
								msg({ message: "How often to update the export file", context: "settings.integrations.autoExport.interval.description" })
							),
							placeholder: translate(
								msg({ message: "60", context: "settings.integrations.autoExport.interval.placeholder" })
							),
							min: 5,
							max: 1440, // 24 hours max
							getValue: () => plugin.settings.icsIntegration.autoExportInterval,
							setValue: async (value: number) => {
								plugin.settings.icsIntegration.autoExportInterval = Math.max(
									5,
									value || 60
								);
								save();
								// Restart the auto export service with new interval
								if (plugin.autoExportService) {
									plugin.autoExportService.updateInterval(
										plugin.settings.icsIntegration.autoExportInterval
									);
								}
							},
						})
				);

				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate(msg({ message: "Use task duration for event length", context: "settings.integrations.autoExport.useDuration.name" })),
							desc: translate(
								msg({ message: "When enabled, uses the task''s time estimate (duration) instead of due date for the calendar event end time. This is useful for GTD workflows where scheduled + duration represents work planning, while due date represents deadlines.", context: "settings.integrations.autoExport.useDuration.description" })
							),
							getValue: () =>
								plugin.settings.icsIntegration.useDurationForExport ?? false,
							setValue: async (value: boolean) => {
								plugin.settings.icsIntegration.useDurationForExport = value;
								save();
							},
						})
				);

				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate(
								msg({ message: "Exclude completed tasks", context: "settings.integrations.autoExport.excludeCompleted.name" })
							),
							desc: translate(
								msg({ message: "When enabled, completed tasks are omitted from ICS exports. Completed statuses are taken from your task statuses settings.", context: "settings.integrations.autoExport.excludeCompleted.description" })
							),
							getValue: () =>
								plugin.settings.icsIntegration.excludeCompletedFromExport ?? false,
							setValue: async (value: boolean) => {
								plugin.settings.icsIntegration.excludeCompletedFromExport = value;
								save();
							},
						})
				);

				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate(
								msg({ message: "Exclude archived tasks", context: "settings.integrations.autoExport.excludeArchived.name" })
							),
							desc: translate(
								msg({ message: "When enabled, archived tasks are omitted from ICS exports.", context: "settings.integrations.autoExport.excludeArchived.description" })
							),
							getValue: () =>
								plugin.settings.icsIntegration.excludeArchivedFromExport ?? false,
							setValue: async (value: boolean) => {
								plugin.settings.icsIntegration.excludeArchivedFromExport = value;
								save();
							},
						})
				);

				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate(msg({ message: "Require due date", context: "settings.integrations.autoExport.requireDueDate.name" })),
							desc: translate(
								msg({ message: "When enabled, only tasks with a due date are included in ICS exports.", context: "settings.integrations.autoExport.requireDueDate.description" })
							),
							getValue: () =>
								plugin.settings.icsIntegration.requireDueDateForExport ?? false,
							setValue: async (value: boolean) => {
								plugin.settings.icsIntegration.requireDueDateForExport = value;
								save();
							},
						})
				);

				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate(
								msg({ message: "Require scheduled date", context: "settings.integrations.autoExport.requireScheduledDate.name" })
							),
							desc: translate(
								msg({ message: "When enabled, only tasks with a scheduled date are included in ICS exports.", context: "settings.integrations.autoExport.requireScheduledDate.description" })
							),
							getValue: () =>
								plugin.settings.icsIntegration.requireScheduledDateForExport ??
								false,
							setValue: async (value: boolean) => {
								plugin.settings.icsIntegration.requireScheduledDateForExport =
									value;
								save();
							},
						})
				);

				// Manual export trigger button
				group.addSetting(
					(setting) =>
						void configureButtonSetting(setting, {
							name: translate(msg({ message: "Export now", context: "settings.integrations.autoExport.exportNow.name" })),
							desc: translate(
								msg({ message: "Manually trigger an immediate export", context: "settings.integrations.autoExport.exportNow.description" })
							),
							buttonText: translate(
								msg({ message: "Export now", context: "settings.integrations.autoExport.exportNow.buttonText" })
							),
							onClick: async () => {
								if (plugin.autoExportService) {
									try {
										await plugin.autoExportService.exportNow();
										new Notice(
											translate(
												msg({ message: "Tasks exported successfully", context: "settings.integrations.autoExport.notices.exportSuccess" })
											)
										);
										// Re-render to update status
										renderIntegrationsTab(container, plugin, save);
									} catch (error) {
										tasknotesLogger.error("Manual export failed:", {
											category: "provider",
											operation: "manual-export",
											error: error,
										});
										new Notice(
											translate(
												msg({ message: "Export failed - check console for details", context: "settings.integrations.autoExport.notices.exportFailure" })
											)
										);
									}
								} else {
									new Notice(
										translate(
											msg({ message: "Auto export service not available", context: "settings.integrations.autoExport.notices.serviceUnavailable" })
										)
									);
								}
							},
						})
				);

				// Export status display
				group.addSetting((setting) => {
					setting.setName(translate(msg({ message: "Export status:", context: "settings.integrations.autoExport.status.title" })));
					const descEl = setting.descEl;

					if (plugin.autoExportService) {
						const lastExport = plugin.autoExportService.getLastExportTime();
						const nextExport = plugin.autoExportService.getNextExportTime();

						const lastExportText = lastExport
							? translate(msg({ message: "Last export: {time}", context: "settings.integrations.autoExport.status.lastExport" }), {
									time: lastExport.toLocaleString(uiLocale()),
								})
							: translate(msg({ message: "No exports yet", context: "settings.integrations.autoExport.status.noExports" }));
						const nextExportText = nextExport
							? translate(msg({ message: "Next export: {time}", context: "settings.integrations.autoExport.status.nextExport" }), {
									time: nextExport.toLocaleString(uiLocale()),
								})
							: translate(msg({ message: "Not scheduled", context: "settings.integrations.autoExport.status.notScheduled" }));

						descEl.textContent = lastExportText + "\n" + nextExportText;
					} else {
						descEl.textContent = translate(
							msg({ message: "Service not initialized - please restart Obsidian", context: "settings.integrations.autoExport.status.serviceNotInitialized" })
						);
						descEl.addClass("tasknotes-auto-export-status__error");
					}
				});
			}
		}
	);

	// HTTP API Section (Skip on mobile)
	if (!Platform.isMobile) {
		createSettingGroup(
			container,
			{
				heading: translate(msg({ message: "HTTP API", context: "settings.integrations.httpApi.header" })),
				description: translate(msg({ message: "Enable HTTP API for external integrations and automations.", context: "settings.integrations.httpApi.description" })),
			},
			(group) => {
				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate(msg({ message: "Enable HTTP API", context: "settings.integrations.httpApi.enable.name" })),
							desc: translate(msg({ message: "Start local HTTP server for API access", context: "settings.integrations.httpApi.enable.description" })),
							getValue: () => plugin.settings.enableAPI,
							setValue: async (value: boolean) => {
								plugin.settings.enableAPI = value;
								save();
								// Re-render to show API settings
								renderIntegrationsTab(container, plugin, save);
							},
						})
				);

				if (plugin.settings.enableAPI) {
					group.addSetting(
						(setting) =>
							void configureNumberSetting(setting, {
								name: translate(msg({ message: "API port", context: "settings.integrations.httpApi.port.name" })),
								desc: translate(msg({ message: "Port number for the HTTP API server", context: "settings.integrations.httpApi.port.description" })),
								placeholder: translate(
									msg({ message: "3000", context: "settings.integrations.httpApi.port.placeholder" })
								),
								min: 1024,
								max: 65535,
								getValue: () => plugin.settings.apiPort,
								setValue: async (value: number) => {
									plugin.settings.apiPort = value;
									save();
								},
							})
					);

					group.addSetting(
						(setting) =>
							void configureTextSetting(setting, {
								name: translate(msg({ message: "API authentication token", context: "settings.integrations.httpApi.authToken.name" })),
								desc: translate(
									msg({ message: "TaskNotes token, not your AI provider''s API key. To generate one, enable HTTP API, leave this field empty, and restart Obsidian. Then copy the generated token into your client''s bearer authentication settings. Update clients whenever this token changes.", context: "settings.integrations.httpApi.authToken.description" })
								),
								placeholder: uiData("your-secret-token", "Dummy credential-shape example, not a translated token or an actual credential"),
								getValue: () => plugin.settings.apiAuthToken,
								setValue: async (value: string) => {
									plugin.settings.apiAuthToken = value;
									save();
								},
							})
					);

					group.addSetting(
						(setting) =>
							void configureToggleSetting(setting, {
								name: translate(msg({ message: "Enable MCP server", context: "settings.integrations.httpApi.mcp.enable.name" })),
								desc: translate(
									msg({ message: "Expose TaskNotes tools via Model Context Protocol at /mcp endpoint. Requires HTTP API to be enabled.", context: "settings.integrations.httpApi.mcp.enable.description" })
								),
								getValue: () => plugin.settings.enableMCP,
								setValue: async (value: boolean) => {
									plugin.settings.enableMCP = value;
									save();
								},
							})
					);
				}
			}
		);

		// API endpoint info (outside group, as a collapsible dynamic element)
		if (plugin.settings.enableAPI) {
			const apiInfoContainer = container.createDiv("tasknotes-settings__help-section");
			const apiHeader = apiInfoContainer.createDiv("tasknotes-settings__collapsible-header");
			const apiHeaderContent = apiHeader.createDiv(
				"tasknotes-settings__collapsible-header-content"
			);
			const apiToggleIcon = apiHeaderContent.createSpan(
				"tasknotes-settings__collapsible-icon"
			);
			apiToggleIcon.textContent = translate(
				msg({ message: "▶", context: "settings.integrations.httpApi.endpoints.expandIcon" })
			);
			apiHeaderContent.createSpan({
				text: translate(msg({ message: "Available API endpoints", context: "settings.integrations.httpApi.endpoints.header" })),
				cls: "tasknotes-settings__collapsible-title",
			});

			const apiEndpointsContent = apiInfoContainer.createDiv(
				"tasknotes-settings__collapsible-content"
			);
			apiEndpointsContent.classList.remove(
				"tn-static-display-block-2a1b75c9",
				"tn-static-display-flex-4d51fc62",
				"tn-static-display-flex-75816cae",
				"tn-static-display-flex-8bb39979",
				"tn-static-display-inline-block-60e32dcb",
				"tn-static-display-inline-cccfa456",
				"tn-static-display-inline-flex-f984c520",
				"tn-static-min-height-800px-997b4c8c"
			);
			apiEndpointsContent.classList.add("tn-static-display-none-6b99de8b");
			// Start collapsed

			// Toggle functionality
			apiHeader.addEventListener("click", () => {
				const isExpanded = apiEndpointsContent.style.display !== "none";
				apiEndpointsContent.style.display = isExpanded ? "none" : "block";
				apiToggleIcon.textContent = isExpanded
					? translate(msg({ message: "▶", context: "settings.integrations.httpApi.endpoints.expandIcon" }))
					: translate(msg({ message: "▼", context: "settings.integrations.httpApi.endpoints.collapseIcon" }));
			});

			// Fetch live API documentation
			void loadAPIEndpoints(apiEndpointsContent, plugin.settings.apiPort, {
				apiAuthToken: plugin.settings.apiAuthToken,
			});
		}

		// Webhooks Section
		createSettingGroup(
			container,
			{
				heading: translate(msg({ message: "Webhooks", context: "settings.integrations.webhooks.header" })),
				description:
					translate(msg({ message: "Webhooks send real-time notifications to external services when TaskNotes events occur.", context: "settings.integrations.webhooks.description.overview" })) +
					" " +
					translate(msg({ message: "Configure webhooks to integrate with automation tools, sync services, or custom applications.", context: "settings.integrations.webhooks.description.usage" })),
			},
			(group) => {
				// Add webhook button
				group.addSetting(
					(setting) =>
						void configureButtonSetting(setting, {
							name: translate(msg({ message: "Add webhook", context: "settings.integrations.webhooks.addWebhook.name" })),
							desc: translate(
								msg({ message: "Register a new webhook endpoint", context: "settings.integrations.webhooks.addWebhook.description" })
							),
							buttonText: translate(
								msg({ message: "Add webhook", context: "settings.integrations.webhooks.addWebhook.buttonText" })
							),
							onClick: async () => {
								const modal = new WebhookModal(
									plugin.app,
									translate,
									(webhookConfig: Partial<WebhookConfig>) => {
										// Generate ID and secret
										const webhook: WebhookConfig = {
											id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
											url: webhookConfig.url || "",
											events: webhookConfig.events || [],
											secret: generateWebhookSecret(),
											active: true,
											createdAt: new Date().toISOString(),
											failureCount: 0,
											successCount: 0,
											transformFile: webhookConfig.transformFile,
											corsHeaders: webhookConfig.corsHeaders,
										};

										if (!plugin.settings.webhooks) {
											plugin.settings.webhooks = [];
										}

										plugin.settings.webhooks.push(webhook);
										save();

										// Re-render webhook list to show the new webhook
										renderWebhookList(
											container.querySelector(".tasknotes-webhooks-container")
												?.parentElement || container,
											plugin,
											save
										);

										// Show success message with secret
										new SecretNoticeModal(
											plugin.app,
											translate,
											webhook.secret
										).open();
										new Notice(
											translate(
												msg({ message: "Webhook created successfully", context: "settings.integrations.webhooks.notices.created" })
											)
										);
									}
								);
								modal.open();
							},
						})
				);
			}
		);

		// Webhook cards (rendered after the heading/button group)
		renderWebhookList(container, plugin, save);
	}
}

function renderICSSubscriptionsList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	container.empty();

	const translate = (key: MessageDescriptor, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	if (!plugin.icsSubscriptionService) {
		createHelpText(
			container,
			translate(msg({ message: "ICS subscription service not available", context: "settings.integrations.subscriptionsList.notices.serviceUnavailable" }))
		);
		return;
	}

	const subscriptions = plugin.icsSubscriptionService.getSubscriptions();
	if (subscriptions.length === 0) {
		// Empty state with consistent styling
		const emptyState = container.createDiv("tasknotes-webhooks-empty-state");
		emptyState.createSpan("tasknotes-webhooks-empty-icon");
		emptyState.createSpan({
			text: translate(msg({ message: "No calendar subscriptions configured. Add a subscription to sync external calendars.", context: "settings.integrations.subscriptionsList.emptyState" })),
			cls: "tasknotes-webhooks-empty-text",
		});
		return;
	}

	subscriptions.forEach((subscription) => {
		// Create input elements
		const enabledToggle = createCardToggle(subscription.enabled, (value) => {
			subscription.enabled = value;
			save();
		});

		const nameInput = createCardInput("text", uiText(msg({ message: "Calendar name", context: "settings/tabs/integrationsTab: renderICSSubscriptionsList display" })), calendarNameLabel(subscription.name));

		// Create type dropdown
		const typeSelect = activeWindow.createEl("select");
		typeSelect.className = "tasknotes-settings__card-input";

		const remoteOption = activeWindow.createEl("option");
		remoteOption.value = "remote";
		remoteOption.textContent = translate(
			msg({ message: "Remote URL", context: "settings.integrations.subscriptionsList.typeOptions.remote" })
		);
		remoteOption.selected = subscription.type === "remote";
		typeSelect.appendChild(remoteOption);

		const localOption = activeWindow.createEl("option");
		localOption.value = "local";
		localOption.textContent = translate(
			msg({ message: "Local file", context: "settings.integrations.subscriptionsList.typeOptions.local" })
		);
		localOption.selected = subscription.type === "local";
		typeSelect.appendChild(localOption);

		// Create input based on type
		let sourceInput: HTMLElement;
		if (subscription.type === "remote") {
			sourceInput = createCardUrlInput(uiText(msg({ message: "ICS/iCal URL", context: "settings/tabs/integrationsTab: renderICSSubscriptionsList display" })), subscription.url);
		} else {
			const fileInput = createCardInput(
				"text",
				uiText(msg({ message: "Local file path (e.g., Calendar.ics)", context: "settings/tabs/integrationsTab: renderICSSubscriptionsList display" })),
				subscription.filePath || ""
			);
			fileInput.setAttribute("placeholder", "Calendar.ics");
			sourceInput = fileInput;
		}

		const colorInput = createThemeColorInput(subscription.color);
		const refreshInput = createCardNumberInput(5, 1440, 5, subscription.refreshInterval || 60);

		// Update handlers
		const updateSubscription = async (updates: Partial<typeof subscription>) => {
			try {
				const subscriptionService = plugin.icsSubscriptionService;
				if (!subscriptionService) return;
				await subscriptionService.updateSubscription(subscription.id, updates);
				save();
				renderICSSubscriptionsList(container, plugin, save);
			} catch (error) {
				tasknotesLogger.error("Error updating subscription:", {
					category: "provider",
					operation: "updating-subscription",
					error: error,
				});
				new Notice(
					translate(msg({ message: "Failed to update subscription", context: "settings.integrations.subscriptionsList.notices.updateFailure" }))
				);
				// Revert changes if needed
				renderICSSubscriptionsList(container, plugin, save);
			}
		};

		// Update handlers (enabledToggle handler is now in createCardToggle callback)
		nameInput.addEventListener("blur", () => {
			void updateSubscription({ name: nameInput.value.trim() });
		});
		colorInput.addEventListener("change", () => {
			void updateSubscription({
				color: readThemeColorInput(colorInput, subscription.color || "#3788d8"),
			});
		});
		refreshInput.addEventListener("blur", () => {
			const minutes = parseInt(refreshInput.value) || 60;
			void updateSubscription({ refreshInterval: minutes });
		});

		// Type change handler - re-render the subscription list to update input type
		typeSelect.addEventListener("change", () => {
			runAsyncSettingCallback(async () => {
				const newType = typeSelect.value as "remote" | "local";

				// Update the subscription object
				subscription.type = newType;
				if (newType === "remote") {
					subscription.url = subscription.filePath || ""; // Transfer old local path to url if exists
					subscription.filePath = undefined;
				} else {
					subscription.filePath = subscription.url || ""; // Transfer old url to local path if exists
					subscription.url = undefined;
				}
				save();

				// Dynamically replace the source input element
				const card = typeSelect.closest(".tasknotes-settings__card");
				if (card) {
					const sourceInputContainer = card.querySelector(
						".tasknotes-settings__card-config-row:nth-child(4)"
					); // Assuming it's the 4th row
					if (sourceInputContainer) {
						const oldSourceInput = sourceInputContainer.querySelector("input");
						if (oldSourceInput) {
							oldSourceInput.remove();
						}

						let newSourceInput: HTMLElement;
						if (newType === "remote") {
							newSourceInput = createCardUrlInput(uiText(msg({ message: "ICS/iCal URL", context: "settings/tabs/integrationsTab: renderICSSubscriptionsList display" })), subscription.url);
						} else {
							const fileInput = createCardInput(
								"text",
								uiText(msg({ message: "Local file path (e.g., Calendar.ics)", context: "settings/tabs/integrationsTab: renderICSSubscriptionsList display" })),
								subscription.filePath || ""
							);
							fileInput.setAttribute("placeholder", "Calendar.ics");
							newSourceInput = fileInput;
						}

						// Re-add event listener for the new input
						newSourceInput.addEventListener("blur", () => {
							const value = (newSourceInput as HTMLInputElement).value.trim();
							if (subscription.type === "remote") {
								// Normalize webcal:// and webcals:// URLs to http:// and https://
								const normalizedUrl = normalizeCalendarUrl(value);
								void updateSubscription({ url: normalizedUrl });
							} else {
								void updateSubscription({ filePath: value });
							}
						});

						sourceInputContainer.appendChild(newSourceInput);

						// Update the label for the source input
						const labelElement = sourceInputContainer.querySelector(
							".tasknotes-settings__card-config-label"
						);
						if (labelElement) {
							labelElement.textContent =
								newType === "remote"
									? translate(
											msg({ message: "URL:", context: "settings.integrations.subscriptionsList.labels.url" })
										)
									: translate(
											msg({ message: "File path:", context: "settings.integrations.subscriptionsList.labels.filePath" })
										);
						}

						// Update the secondary text in the header
						const secondaryText = card.querySelector(
							".tasknotes-settings__card-secondary-text"
						);
						if (secondaryText) {
							secondaryText.textContent =
								newType === "remote"
									? translate(
											msg({ message: "Remote calendar", context: "settings.integrations.subscriptionsList.statusLabels.remoteCalendar" })
										)
									: translate(
											msg({ message: "Local file", context: "settings.integrations.subscriptionsList.typeOptions.local" })
										);
						}

						// Update the type badge
						const typeBadge = card.querySelector(
							".tasknotes-settings__card-meta .info-badge"
						); // Assuming info-badge is the class for type badge
						if (typeBadge) {
							typeBadge.textContent =
								newType === "remote"
									? translate(
											msg({ message: "Remote", context: "settings.integrations.subscriptionsList.statusLabels.remote" })
										)
									: translate(
											msg({ message: "Local file", context: "settings.integrations.subscriptionsList.typeOptions.local" })
										);
						}
					}
				}
			});
		});

		// Source input handler (URL or file path)
		sourceInput.addEventListener("blur", () => {
			const value = (sourceInput as HTMLInputElement).value.trim();
			if (subscription.type === "remote") {
				// Normalize webcal:// and webcals:// URLs to http:// and https://
				const normalizedUrl = normalizeCalendarUrl(value);
				void updateSubscription({ url: normalizedUrl });
			} else {
				void updateSubscription({ filePath: value });
			}
		});

		// Create meta badges
		const statusBadge = createStatusBadge(
			subscription.enabled
				? translate(msg({ message: "Enabled:", context: "settings.modalFields.manager.enabled" }))
				: translate(msg({ message: "Disabled", context: "settings.integrations.subscriptionsList.statusLabels.disabled" })),
			subscription.enabled ? "active" : "inactive"
		);

		const typeBadge = createInfoBadge(subscription.type === "remote" ? uiText(msg({ message: "Remote", context: "settings/tabs/integrationsTab: renderICSSubscriptionsList display" })) : uiText(msg({ message: "Local File", context: "settings/tabs/integrationsTab: renderICSSubscriptionsList display" })));

		const metaBadges = [statusBadge, typeBadge];

		// Add last sync badge if available
		const lastFetched = plugin.icsSubscriptionService.getLastFetched(subscription.id);
		if (lastFetched) {
			const lastSyncDate = new Date(lastFetched);
			const timeAgo = getRelativeTime(lastSyncDate, translate);
			const syncBadge = createInfoBadge(uiText(msg({ message: "Synced {timeAgo}", context: "settings/tabs/integrationsTab: renderICSSubscriptionsList display" }), { timeAgo: timeAgo }));
			metaBadges.push(syncBadge);
		}

		// Add error badge if there's an error
		const lastError = plugin.icsSubscriptionService.getLastError(subscription.id);
		if (lastError) {
			const errorBadge = createStatusBadge(
				translate(msg({ message: "Error", context: "settings.integrations.subscriptionsList.statusLabels.error" })),
				"inactive"
			);
			errorBadge.title = lastError; // Show error on hover
			metaBadges.push(errorBadge);
		}

		// Build content rows
		const contentRows: { label: string; input: HTMLElement; fullWidth?: boolean }[] = [
			{ label: translate(msg({ message: "Enabled:", context: "settings.modalFields.manager.enabled" })), input: enabledToggle },
			{
				label: translate(msg({ message: "Name:", context: "settings.integrations.subscriptionsList.labels.name" })),
				input: nameInput,
			},
			{ label: translate(msg({ message: "Type:", context: "settings.defaults.reminders.fields.type" })), input: typeSelect },
			{
				label:
					subscription.type === "remote"
						? translate(msg({ message: "URL:", context: "settings.integrations.subscriptionsList.labels.url" }))
						: translate(msg({ message: "File path:", context: "settings.integrations.subscriptionsList.labels.filePath" })),
				input: sourceInput,
			},
			{
				label: translate(msg({ message: "Color:", context: "settings.taskProperties.taskStatuses.fields.color" })),
				input: colorInput,
			},
			{
				label: translate(msg({ message: "Refresh (min):", context: "settings.integrations.subscriptionsList.labels.refreshMinutes" })),
				input: refreshInput,
			},
		];

		createCard(container, {
			id: subscription.id,
			collapsible: true,
			defaultCollapsed: true,
			colorIndicator: {
				color: subscription.color,
			},
			header: {
				primaryText: calendarNameLabel(subscription.name),
				secondaryText:
					subscription.type === "remote"
						? translate(
								msg({ message: "Remote calendar", context: "settings.integrations.subscriptionsList.statusLabels.remoteCalendar" })
							)
						: translate(msg({ message: "Local file", context: "settings.integrations.subscriptionsList.typeOptions.local" })),
				meta: metaBadges,
				actions: [
					createDeleteHeaderButton(async () => {
						const confirmed = await showConfirmationModal(plugin.app, {
							title: translate(
								msg({ message: "Delete subscription", context: "settings.integrations.subscriptionsList.confirmDelete.title" })
							),
							message: translate(
								msg({ message: "Are you sure you want to delete the subscription \"{name}\"? This action cannot be undone.", context: "settings.integrations.subscriptionsList.confirmDelete.message" }),
								{ name: subscription.name }
							),
							confirmText: translate(
								msg({ message: "Delete", context: "settings.integrations.subscriptionsList.confirmDelete.confirmText" })
							),
							cancelText: translate(msg({ message: "Cancel", context: "common.cancel" })),
							isDestructive: true,
						});

						if (confirmed) {
							try {
								const subscriptionService = plugin.icsSubscriptionService;
								if (!subscriptionService) return;
								await subscriptionService.removeSubscription(subscription.id);
								new Notice(
									translate(
										msg({ message: "Deleted subscription \"{name}\"", context: "settings.integrations.subscriptionsList.notices.deleteSuccess" }),
										{ name: subscription.name }
									)
								);
								save();
								renderICSSubscriptionsList(container, plugin, save);
							} catch (error) {
								tasknotesLogger.error("Error deleting subscription:", {
									category: "provider",
									operation: "deleting-subscription",
									error: error,
								});
								new Notice(
									translate(
										msg({ message: "Failed to delete subscription", context: "settings.integrations.subscriptionsList.notices.deleteFailure" })
									)
								);
							}
						}
					}, uiText(msg({ message: "Delete subscription", context: "settings/tabs/integrationsTab: renderICSSubscriptionsList actions" }))),
				],
			},
			content: {
				sections: [{ rows: contentRows }],
			},
			actions: {
				buttons: [
					{
						text: translate(msg({ message: "Refresh now", context: "settings.integrations.subscriptionsList.refreshNow" })),
						icon: "refresh-cw",
						variant: subscription.enabled ? "primary" : "secondary",
						disabled: !subscription.enabled,
						onClick: async () => {
							if (!subscription.enabled) {
								new Notice(
									translate(
										msg({ message: "Enable the subscription first", context: "settings.integrations.subscriptionsList.notices.enableFirst" })
									)
								);
								return;
							}

							try {
								const subscriptionService = plugin.icsSubscriptionService;
								if (!subscriptionService) return;
								await subscriptionService.refreshSubscription(subscription.id);
								new Notice(
									translate(
										msg({ message: "All calendar subscriptions refreshed successfully", context: "settings.integrations.subscriptionsList.notices.refreshSuccess" }),
										{ name: subscription.name }
									)
								);
								// Re-render to show updated sync time
								renderICSSubscriptionsList(container, plugin, save);
							} catch (error) {
								tasknotesLogger.error("Error refreshing subscription:", {
									category: "provider",
									operation: "refreshing-subscription",
									error: error,
								});
								new Notice(
									translate(
										msg({ message: "Failed to refresh some calendar subscriptions", context: "settings.integrations.subscriptionsList.notices.refreshFailure" })
									)
								);
							}
						},
					},
				],
			},
		});
	});
}

function renderWebhookList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	const translate = (key: MessageDescriptor, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	// Clear existing webhook content
	const existingContainer = container.querySelector(".tasknotes-webhooks-container");
	if (existingContainer) {
		existingContainer.remove();
	}

	const webhooksContainer = container.createDiv("tasknotes-webhooks-container");

	if (!plugin.settings.webhooks || plugin.settings.webhooks.length === 0) {
		showCardEmptyState(
			webhooksContainer,
			translate(msg({ message: "No webhooks configured. Add a webhook to receive real-time notifications.", context: "settings.integrations.webhooks.emptyState.message" })),
			translate(msg({ message: "Add webhook", context: "settings.integrations.webhooks.emptyState.buttonText" })),
			() => {
				// This is a bit of a hack, but it's the easiest way to trigger the add webhook modal
				const addWebhookButton = container
					.closest(".settings-tab-content")
					?.querySelector("button.tn-btn--primary");
				if (addWebhookButton) {
					(addWebhookButton as HTMLElement).click();
				}
			}
		);
		return;
	}

	plugin.settings.webhooks.forEach((webhook, index) => {
		const statusBadge = createStatusBadge(
			webhook.active
				? translate(msg({ message: "Active:", context: "settings.integrations.webhooks.labels.active" }))
				: translate(msg({ message: "Inactive", context: "settings.integrations.webhooks.statusLabels.inactive" })),
			webhook.active ? "active" : "inactive"
		);

		const successBadge = createInfoBadge(uiText(msg({ message: "Success: {value1, number}", context: "settings/tabs/integrationsTab: renderWebhookList display" }), { value1: webhook.successCount || 0 }));
		const failureBadge = createInfoBadge(uiText(msg({ message: "Failed: {value1, number}", context: "settings/tabs/integrationsTab: renderWebhookList display" }), { value1: webhook.failureCount || 0 }));

		// Create inputs for inline editing
		const urlInput = createCardUrlInput(uiText(msg({ message: "Webhook URL", context: "settings/tabs/integrationsTab: renderWebhookList display" })), webhook.url);
		const activeToggle = createCardToggle(webhook.active, (value) => {
			webhook.active = value;
			save();

			// Update the status badge in place instead of re-rendering entire list
			const card = activeToggle.closest(".tasknotes-settings__card");
			if (card) {
				const statusBadge = card.querySelector(
					".tasknotes-settings__card-status-badge--active, .tasknotes-settings__card-status-badge--inactive"
				);
				if (statusBadge) {
					statusBadge.textContent = webhook.active
						? translate(msg({ message: "Active:", context: "settings.integrations.webhooks.labels.active" }))
						: translate(msg({ message: "Inactive", context: "settings.integrations.webhooks.statusLabels.inactive" }));
					statusBadge.className = webhook.active
						? "tasknotes-settings__card-status-badge tasknotes-settings__card-status-badge--active"
						: "tasknotes-settings__card-status-badge tasknotes-settings__card-status-badge--inactive";
				}

				// Update test button disabled state
				const testButton = card.querySelector('[aria-label*="Test"]') as HTMLButtonElement;
				if (testButton) {
					testButton.disabled = !webhook.active || !webhook.url;
				}
			}

			new Notice(
				webhook.active
					? translate(msg({ message: "Webhook enabled", context: "settings.integrations.webhooks.notices.enabled" }))
					: translate(msg({ message: "Webhook disabled", context: "settings.integrations.webhooks.notices.disabled" }))
			);
		});

		// Update handler for URL input
		urlInput.addEventListener("blur", () => {
			if (urlInput.value.trim() !== webhook.url) {
				webhook.url = urlInput.value.trim();
				save();
				new Notice(translate(msg({ message: "Webhook URL updated", context: "settings.integrations.webhooks.notices.urlUpdated" })));
			}
		});

		// Format webhook creation date
		const createdDate = webhook.createdAt ? new Date(webhook.createdAt) : null;
		const createdText = createdDate
			? translate(msg({ message: "Created {timeAgo}", context: "settings.integrations.webhooks.statusLabels.created" }), {
					timeAgo: getRelativeTime(createdDate, translate),
				})
			: uiText(msg({ message: "Creation date unknown", context: "settings/tabs/integrationsTab: renderWebhookList display" }));

		// Create events display as a formatted string
		const eventsDisplay = activeWindow.createDiv();
		eventsDisplay.className = "tasknotes-webhook-events";

		if (webhook.events.length === 0) {
			const noEventsSpan = activeWindow.createSpan();
			noEventsSpan.className = "tasknotes-webhook-events--empty";
			noEventsSpan.textContent = translate(
				msg({ message: "No events selected", context: "settings.integrations.webhooks.eventsDisplay.noEvents" })
			);
			eventsDisplay.appendChild(noEventsSpan);
		} else {
			webhook.events.forEach((event) => {
				eventsDisplay.appendChild(createInfoBadge(event));
			});
		}

		// Create transform file display if exists
		const transformDisplay = activeWindow.createSpan();
		if (webhook.transformFile) {
			transformDisplay.className = "tasknotes-transform-file";
			transformDisplay.textContent = webhook.transformFile;
		} else {
			transformDisplay.className = "tasknotes-transform-file--empty";
			transformDisplay.textContent = translate(
				msg({ message: "Raw payload (no transform)", context: "settings.integrations.webhooks.transformDisplay.noTransform" })
			);
		}

		createCard(webhooksContainer, {
			id: webhook.id,
			collapsible: true,
			defaultCollapsed: true,
			header: {
				primaryText: translate(msg({ message: "Webhook", context: "settings.integrations.webhooks.cardHeader" })),
				secondaryText: createdText,
				meta: [statusBadge, successBadge, failureBadge],
				actions: [
					createDeleteHeaderButton(async () => {
						const confirmed = await showConfirmationModal(plugin.app, {
							title: translate(msg({ message: "Delete webhook", context: "settings.integrations.webhooks.confirmDelete.title" })),
							message: translate(
								msg({ message: "Are you sure you want to delete this webhook?\n\nURL: {url}\n\nThis action cannot be undone.", context: "settings.integrations.webhooks.confirmDelete.message" }),
								{ url: webhook.url }
							),
							confirmText: translate(
								msg({ message: "Delete", context: "settings.integrations.webhooks.confirmDelete.confirmText" })
							),
							cancelText: translate(msg({ message: "Cancel", context: "common.cancel" })),
							isDestructive: true,
						});

						if (confirmed) {
							plugin.settings.webhooks.splice(index, 1);
							save();
							renderWebhookList(container, plugin, save);
							new Notice(translate(msg({ message: "Webhook deleted", context: "settings.integrations.webhooks.notices.deleted" })));
						}
					}),
				],
			},
			content: {
				sections: [
					{
						rows: [
							{
								label: translate(
									msg({ message: "Active:", context: "settings.integrations.webhooks.cardFields.active" })
								),
								input: activeToggle,
							},
							{
								label: translate(msg({ message: "URL:", context: "settings.integrations.webhooks.cardFields.url" })),
								input: urlInput,
							},
							{
								label: translate(
									msg({ message: "Events:", context: "settings.integrations.webhooks.cardFields.events" })
								),
								input: eventsDisplay,
							},
							{
								label: translate(
									msg({ message: "Transform:", context: "settings.integrations.webhooks.cardFields.transform" })
								),
								input: transformDisplay,
							},
						],
					},
				],
			},
			actions: {
				buttons: [
					{
						text: translate(msg({ message: "Edit events", context: "settings.integrations.webhooks.editEvents" })),
						icon: "settings",
						variant: "secondary",
						onClick: async () => {
							const modal = new WebhookEditModal(
								plugin.app,
								translate,
								webhook,
								(updatedConfig: Partial<WebhookConfig>) => {
									Object.assign(webhook, updatedConfig);
									save();
									renderWebhookList(container, plugin, save);
									new Notice(
										translate(msg({ message: "Webhook updated", context: "settings.integrations.webhooks.notices.updated" }))
									);
								}
							);
							modal.open();
						},
					},
				],
			},
		});
	});
}

/**
 * Generate secure webhook secret
 */
function generateWebhookSecret(): string {
	return Array.from(crypto.getRandomValues(new Uint8Array(32)))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * Modal for displaying webhook secret after creation
 */
class SecretNoticeModal extends Modal {
	private secret: string;

	constructor(
		app: App,
		private readonly translate: Translate,
		secret: string
	) {
		super(app);
		this.secret = secret;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-webhook-modal");

		const notice = contentEl.createDiv({ cls: "tasknotes-webhook-secret-notice" });

		const title = notice.createDiv({ cls: "tasknotes-webhook-secret-title" });
		const titleIcon = title.createSpan();
		setIcon(titleIcon, "shield-check");
		title.createSpan({
			text: this.translate(msg({ message: "Webhook secret generated", context: "settings.integrations.webhooks.secretModal.title" })),
		});

		const content = notice.createDiv({ cls: "tasknotes-webhook-secret-content" });
		content.createEl("p", {
			text: this.translate(msg({ message: "Your webhook secret has been generated. Save this secret as you won''t be able to view it again:", context: "settings.integrations.webhooks.secretModal.description" })),
		});
		content.createEl("code", { text: this.secret, cls: "tasknotes-webhook-secret-code" });
		content.createEl("p", {
			text: this.translate(msg({ message: "Use this secret to verify webhook payloads in your receiving application.", context: "settings.integrations.webhooks.secretModal.usage" })),
		});

		const buttonContainer = contentEl.createDiv({ cls: "tasknotes-webhook-modal-buttons" });
		const closeBtn = buttonContainer.createEl("button", {
			text: this.translate(msg({ message: "Got it", context: "settings.integrations.webhooks.secretModal.gotIt" })),
			cls: "tasknotes-webhook-modal-btn save",
		});
		closeBtn.onclick = () => this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for editing existing webhooks
 */
class WebhookEditModal extends Modal {
	private selectedEvents: WebhookEvent[];
	private transformFile: string;
	private corsHeaders: boolean;
	private onSubmit: (config: Partial<WebhookConfig>) => unknown;

	constructor(
		app: App,
		private readonly translate: Translate,
		webhook: WebhookConfig,
		onSubmit: (config: Partial<WebhookConfig>) => unknown
	) {
		super(app);
		this.selectedEvents = [...webhook.events];
		this.transformFile = webhook.transformFile || "";
		this.corsHeaders = webhook.corsHeaders ?? true;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-webhook-modal");

		// Modal header with icon
		const header = contentEl.createDiv({ cls: "tasknotes-webhook-modal-header" });
		const headerIcon = header.createSpan({ cls: "tasknotes-webhook-modal-icon" });
		setIcon(headerIcon, "webhook");
		header.createEl("h2", {
			text: this.translate(msg({ message: "Edit webhook", context: "settings.integrations.webhooks.modals.edit.title" })),
			cls: "tasknotes-webhook-modal-title",
		});

		// Events selection section
		const eventsSection = contentEl.createDiv({ cls: "tasknotes-webhook-modal-section" });
		const eventsHeader = eventsSection.createDiv({
			cls: "tasknotes-webhook-modal-subsection-header",
		});
		const eventsIcon = eventsHeader.createSpan();
		setIcon(eventsIcon, "zap");
		eventsHeader.createEl("h3", {
			text: this.translate(msg({ message: "Events to subscribe to", context: "settings.integrations.webhooks.modals.edit.eventsSection" })),
		});

		const eventsGrid = eventsSection.createDiv({ cls: "tasknotes-webhook-events-list" });
		WEBHOOK_EVENT_OPTIONS.forEach((event) => {
			new Setting(eventsGrid)
				.setName(this.translate(messageForKey(`${event.translation}.label`)))
				.setDesc(this.translate(messageForKey(`${event.translation}.description`)))
				.addToggle((toggle) => {
					toggle.toggleEl.setAttribute(
						"aria-label",
						this.translate(messageForKey(`${event.translation}.label`))
					);
					return toggle
						.setValue(this.selectedEvents.includes(event.id))
						.onChange((value) => {
							if (value) {
								this.selectedEvents.push(event.id);
							} else {
								const index = this.selectedEvents.indexOf(event.id);
								if (index > -1) {
									this.selectedEvents.splice(index, 1);
								}
							}
						});
				});
		});

		// Transform file section
		const transformSection = contentEl.createDiv({ cls: "tasknotes-webhook-modal-section" });
		const transformHeader = transformSection.createDiv({
			cls: "tasknotes-webhook-modal-subsection-header",
		});
		const transformIcon = transformHeader.createSpan();
		setIcon(transformIcon, "file-code");
		transformHeader.createEl("h3", {
			text: this.translate(msg({ message: "Transform configuration (optional)", context: "settings.integrations.webhooks.modals.edit.transformSection" })),
		});

		new Setting(transformSection)
			.setName(
				this.translate(msg({ message: "Transform file", context: "settings.integrations.webhooks.modals.edit.transformFile.name" }))
			)
			.setDesc(
				this.translate(
					msg({ message: "Path to a .json template file in your vault that transforms webhook payloads", context: "settings.integrations.webhooks.modals.edit.transformFile.description" })
				)
			)
			.addText((text) => {
				text.inputEl.setAttribute("aria-label", uiText(msg({ message: "Transform file path", context: "settings/tabs/integrationsTab: WebhookEditModal.onOpen display" })));
				return text
					.setPlaceholder("simple-template.json")
					.setValue(this.transformFile)
					.onChange((value) => {
						this.transformFile = value;
					});
			});

		// CORS headers section
		const corsSection = contentEl.createDiv({ cls: "tasknotes-webhook-modal-section" });
		const corsHeader = corsSection.createDiv({
			cls: "tasknotes-webhook-modal-subsection-header",
		});
		const corsIcon = corsHeader.createSpan();
		setIcon(corsIcon, "settings");
		corsHeader.createEl("h3", {
			text: this.translate(msg({ message: "Headers configuration", context: "settings.integrations.webhooks.modals.edit.headersSection" })),
		});

		new Setting(corsSection)
			.setName(
				this.translate(msg({ message: "Include custom headers", context: "settings.integrations.webhooks.modals.edit.customHeaders.name" }))
			)
			.setDesc(
				this.translate(
					msg({ message: "Include TaskNotes headers (event type, signature, delivery ID). Turn off for Discord, Slack, and other services with strict CORS policies.", context: "settings.integrations.webhooks.modals.edit.customHeaders.description" })
				)
			)
			.addToggle((toggle) => {
				toggle.toggleEl.setAttribute(
					"aria-label",
					this.translate(msg({ message: "Include custom headers", context: "settings.integrations.webhooks.modals.edit.customHeaders.name" }))
				);
				return toggle.setValue(this.corsHeaders).onChange((value) => {
					this.corsHeaders = value;
				});
			});

		// Buttons section
		const buttonContainer = contentEl.createDiv({ cls: "tasknotes-webhook-modal-buttons" });

		const cancelBtn = buttonContainer.createEl("button", {
			text: this.translate(msg({ message: "Cancel", context: "settings.integrations.webhooks.modals.edit.buttons.cancel" })),
			cls: "tasknotes-webhook-modal-btn cancel",
			attr: { "aria-label": this.translate(msg({ message: "Cancel", context: "common.cancel" })) },
		});
		const cancelIcon = cancelBtn.createSpan({ cls: "tasknotes-webhook-modal-btn-icon" });
		setIcon(cancelIcon, "x");
		cancelBtn.onclick = () => this.close();

		const saveBtn = buttonContainer.createEl("button", {
			text: this.translate(msg({ message: "Save changes", context: "settings.integrations.webhooks.modals.edit.buttons.save" })),
			cls: "tasknotes-webhook-modal-btn save mod-cta",
			attr: {
				"aria-label": this.translate(
					msg({ message: "Save changes", context: "settings.integrations.webhooks.modals.edit.buttons.save" })
				),
			},
		});
		const saveIcon = saveBtn.createSpan({ cls: "tasknotes-webhook-modal-btn-icon" });
		setIcon(saveIcon, "save");

		saveBtn.onclick = () => {
			if (this.selectedEvents.length === 0) {
				new Notice(
					this.translate(
						msg({ message: "Please select at least one event", context: "settings.integrations.webhooks.modals.edit.notices.selectAtLeastOneEvent" })
					)
				);
				return;
			}

			runAsyncSettingCallback(() =>
				this.onSubmit({
					events: this.selectedEvents,
					transformFile: this.transformFile.trim() || undefined,
					corsHeaders: this.corsHeaders,
				})
			);

			this.close();
		};
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for adding/editing webhooks
 */
class WebhookModal extends Modal {
	private url = "";
	private selectedEvents: WebhookEvent[] = [];
	private transformFile = "";
	private corsHeaders = true;
	private onSubmit: (config: Partial<WebhookConfig>) => unknown;

	constructor(
		app: App,
		private readonly translate: Translate,
		onSubmit: (config: Partial<WebhookConfig>) => unknown
	) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-webhook-modal");

		// Modal header with icon
		const header = contentEl.createDiv({ cls: "tasknotes-webhook-modal-header" });
		const headerIcon = header.createSpan({ cls: "tasknotes-webhook-modal-icon" });
		setIcon(headerIcon, "webhook");
		header.createEl("h2", {
			text: this.translate(msg({ message: "Add webhook", context: "settings.integrations.webhooks.modals.add.title" })),
			cls: "tasknotes-webhook-modal-title",
		});

		// URL input section
		const urlSection = contentEl.createDiv({ cls: "tasknotes-webhook-modal-section" });
		new Setting(urlSection)
			.setName(this.translate(msg({ message: "Webhook URL", context: "settings.integrations.webhooks.modals.add.url.name" })))
			.setDesc(this.translate(msg({ message: "The endpoint where webhook payloads will be sent", context: "settings.integrations.webhooks.modals.add.url.description" })))
			.addText((text) => {
				text.inputEl.setAttribute(
					"aria-label",
					this.translate(msg({ message: "Webhook URL", context: "settings.integrations.webhooks.modals.add.url.name" }))
				);
				return text
					.setPlaceholder(
						uiData("https://your-service.com/webhook", "Literal endpoint URL example; host/path syntax must not be translated")
					)
					.setValue(this.url)
					.onChange((value) => {
						this.url = value;
					});
			});

		// Events selection section
		const eventsSection = contentEl.createDiv({ cls: "tasknotes-webhook-modal-section" });
		const eventsHeader = eventsSection.createDiv({
			cls: "tasknotes-webhook-modal-subsection-header",
		});
		const eventsIcon = eventsHeader.createSpan();
		setIcon(eventsIcon, "zap");
		eventsHeader.createEl("h3", {
			text: this.translate(msg({ message: "Events to subscribe to", context: "settings.integrations.webhooks.modals.add.eventsSection" })),
		});

		const eventsGrid = eventsSection.createDiv({ cls: "tasknotes-webhook-events-list" });

		WEBHOOK_EVENT_OPTIONS.forEach((event) => {
			new Setting(eventsGrid)
				.setName(this.translate(messageForKey(`${event.translation}.label`)))
				.setDesc(this.translate(messageForKey(`${event.translation}.description`)))
				.addToggle((toggle) => {
					toggle.toggleEl.setAttribute(
						"aria-label",
						this.translate(messageForKey(`${event.translation}.label`))
					);
					return toggle
						.setValue(this.selectedEvents.includes(event.id))
						.onChange((value) => {
							if (value) {
								this.selectedEvents.push(event.id);
							} else {
								const index = this.selectedEvents.indexOf(event.id);
								if (index > -1) {
									this.selectedEvents.splice(index, 1);
								}
							}
						});
				});
		});

		// Transform file section
		const transformSection = contentEl.createDiv({ cls: "tasknotes-webhook-modal-section" });
		const transformHeader = transformSection.createDiv({
			cls: "tasknotes-webhook-modal-subsection-header",
		});
		const transformIcon = transformHeader.createSpan();
		setIcon(transformIcon, "file-code");
		transformHeader.createEl("h3", {
			text: this.translate(msg({ message: "Transform configuration (optional)", context: "settings.integrations.webhooks.modals.add.transformSection" })),
		});

		new Setting(transformSection)
			.setName(this.translate(msg({ message: "Transform file", context: "settings.integrations.webhooks.modals.add.transformFile.name" })))
			.setDesc(
				this.translate(
					msg({ message: "Path to a .json template file in your vault that transforms webhook payloads", context: "settings.integrations.webhooks.modals.add.transformFile.description" })
				)
			)
			.addText((text) => {
				text.inputEl.setAttribute("aria-label", uiText(msg({ message: "Transform file path", context: "settings/tabs/integrationsTab: WebhookModal.onOpen display" })));
				return text
					.setPlaceholder("simple-template.json")
					.setValue(this.transformFile)
					.onChange((value) => {
						this.transformFile = value;
					});
			});

		// Transform help section
		const transformHelp = transformSection.createDiv({
			cls: "tasknotes-webhook-transform-help",
		});
		const helpHeader = transformHelp.createDiv({ cls: "tasknotes-webhook-help-header" });
		const helpIcon = helpHeader.createSpan();
		setIcon(helpIcon, "info");
		helpHeader.createSpan({
			text: this.translate(msg({ message: "JSON transform templates customize webhook payloads:", context: "settings.integrations.webhooks.modals.add.transformHelp.title" })),
		});

		const helpList = transformHelp.createEl("ul", { cls: "tasknotes-webhook-help-list" });
		const jsonLi = helpList.createEl("li");
		uiRichText(jsonLi,
			msg({ message: "<0>.json files:</0> Templates with <1>{example}</1>", context: "webhook JSON template help" }),
			{ example: "${data.task.title}" }, { "0": "strong", "1": "code" });

		const emptyLi = helpList.createEl("li");
		uiRichText(emptyLi,
			msg({ message: "<0>Leave empty:</0> Send raw data", context: "webhook untransformed payload help" }),
			{}, { "0": "strong" });

		const helpExample = transformHelp.createDiv({ cls: "tasknotes-webhook-help-example" });
		helpExample.createEl("strong", {
			text: this.translate(msg({ message: "Example:", context: "settings.integrations.webhooks.modals.add.transformHelp.example" })),
		});
		helpExample.appendText(" ");
		helpExample.createEl("code", { text: "simple-template.json" });

		// CORS headers section
		const corsSection = contentEl.createDiv({ cls: "tasknotes-webhook-modal-section" });
		const corsHeader = corsSection.createDiv({
			cls: "tasknotes-webhook-modal-subsection-header",
		});
		const corsIcon = corsHeader.createSpan();
		setIcon(corsIcon, "settings");
		corsHeader.createEl("h3", {
			text: this.translate(msg({ message: "Headers configuration", context: "settings.integrations.webhooks.modals.add.headersSection" })),
		});

		new Setting(corsSection)
			.setName(this.translate(msg({ message: "Include custom headers", context: "settings.integrations.webhooks.modals.add.customHeaders.name" })))
			.setDesc(
				this.translate(
					msg({ message: "Include TaskNotes headers (event type, signature, delivery ID). Turn off for Discord, Slack, and other services with strict CORS policies.", context: "settings.integrations.webhooks.modals.add.customHeaders.description" })
				)
			)
			.addToggle((toggle) => {
				toggle.toggleEl.setAttribute(
					"aria-label",
					this.translate(msg({ message: "Include custom headers", context: "settings.integrations.webhooks.modals.add.customHeaders.name" }))
				);
				return toggle.setValue(this.corsHeaders).onChange((value) => {
					this.corsHeaders = value;
				});
			});

		// Buttons section
		const buttonContainer = contentEl.createDiv({ cls: "tasknotes-webhook-modal-buttons" });

		const cancelBtn = buttonContainer.createEl("button", {
			text: this.translate(msg({ message: "Cancel", context: "settings.integrations.webhooks.modals.add.buttons.cancel" })),
			cls: "tasknotes-webhook-modal-btn cancel",
			attr: { "aria-label": this.translate(msg({ message: "Cancel", context: "common.cancel" })) },
		});
		const cancelIcon = cancelBtn.createSpan({ cls: "tasknotes-webhook-modal-btn-icon" });
		setIcon(cancelIcon, "x");
		cancelBtn.onclick = () => this.close();

		const saveBtn = buttonContainer.createEl("button", {
			text: this.translate(msg({ message: "Add webhook", context: "settings.integrations.webhooks.modals.add.title" })),
			cls: "tasknotes-webhook-modal-btn save mod-cta",
			attr: {
				"aria-label": this.translate(
					msg({ message: "Add webhook", context: "settings.integrations.webhooks.modals.add.buttons.add" })
				),
			},
		});
		const saveIcon = saveBtn.createSpan({ cls: "tasknotes-webhook-modal-btn-icon" });
		setIcon(saveIcon, "plus");

		saveBtn.onclick = () => {
			if (!this.url.trim()) {
				new Notice(
					this.translate(msg({ message: "Webhook URL is required", context: "settings.integrations.webhooks.modals.add.notices.urlRequired" }))
				);
				return;
			}

			if (this.selectedEvents.length === 0) {
				new Notice(
					this.translate(
						msg({ message: "Please select at least one event", context: "settings.integrations.webhooks.modals.add.notices.selectAtLeastOneEvent" })
					)
				);
				return;
			}

			runAsyncSettingCallback(() =>
				this.onSubmit({
					url: this.url.trim(),
					events: this.selectedEvents,
					transformFile: this.transformFile.trim() || undefined,
					corsHeaders: this.corsHeaders,
				})
			);

			this.close();
		};
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
