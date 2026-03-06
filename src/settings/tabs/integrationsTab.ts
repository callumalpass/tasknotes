import { Notice, Platform, Modal, Setting, setIcon, App } from "obsidian";
import TaskNotesPlugin from "../../main";
import type { WebhookConfig, WebhookEvent } from "../../types";
import type { ICSIntegrationSettings } from "../../types/settings";
import { TranslationKey } from "../../i18n";
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
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffDays > 0) {
		return translate("settings.integrations.timeFormats.daysAgo", {
			days: diffDays,
			plural: diffDays > 1 ? "s" : "",
		});
	} else if (diffHours > 0) {
		return translate("settings.integrations.timeFormats.hoursAgo", {
			hours: diffHours,
			plural: diffHours > 1 ? "s" : "",
		});
	} else if (diffMinutes > 0) {
		return translate("settings.integrations.timeFormats.minutesAgo", {
			minutes: diffMinutes,
			plural: diffMinutes > 1 ? "s" : "",
		});
	} else {
		return translate("settings.integrations.timeFormats.justNow");
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

function isRecurringEventRelatedNotesMode(
	value: string
): value is RecurringEventRelatedNotesMode {
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

const WEBHOOK_EVENT_OPTIONS: ReadonlyArray<{
	id: WebhookEvent;
	label: string;
	desc: string;
}> = [
	{ id: "task.created", label: "Task Created", desc: "When new tasks are created" },
	{ id: "task.updated", label: "Task Updated", desc: "When tasks are modified" },
	{ id: "task.completed", label: "Task Completed", desc: "When tasks are marked complete" },
	{ id: "task.deleted", label: "Task Deleted", desc: "When tasks are deleted" },
	{ id: "task.archived", label: "Task Archived", desc: "When tasks are archived" },
	{ id: "task.unarchived", label: "Task Unarchived", desc: "When tasks are unarchived" },
	{ id: "time.started", label: "Time Started", desc: "When time tracking starts" },
	{ id: "time.stopped", label: "Time Stopped", desc: "When time tracking stops" },
	{ id: "pomodoro.started", label: "Pomodoro Started", desc: "When pomodoro sessions begin" },
	{
		id: "pomodoro.completed",
		label: "Pomodoro Completed",
		desc: "When pomodoro sessions finish",
	},
	{
		id: "pomodoro.interrupted",
		label: "Pomodoro Interrupted",
		desc: "When pomodoro sessions are stopped",
	},
	{
		id: "recurring.instance.completed",
		label: "Recurring Instance Completed",
		desc: "When recurring task instances complete",
	},
	{ id: "reminder.triggered", label: "Reminder Triggered", desc: "When task reminders activate" },
];

/**
 * Renders the Integrations tab - external connections and API settings
 */
export function renderIntegrationsTab(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	container.empty();

	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);
	const calendarIntegrationDisabledOnMobile = isCalendarIntegrationDisabledOnMobile(
		plugin.settings
	);

	// mdbase-spec Section
	createSettingGroup(
		container,
		{
			heading: translate("settings.integrations.mdbaseSpec.header"),
		},
		(group) => {
			group.addSetting((setting) => {
				configureToggleSetting(setting, {
					name: translate("settings.integrations.mdbaseSpec.enable.name"),
					desc: "",
					getValue: () => plugin.settings.enableMdbaseSpec,
					setValue: (value: boolean) => {
						plugin.settings.enableMdbaseSpec = value;
						save();
					},
				});
				const descEl = setting.descEl;
				descEl.createSpan({
					text: translate("settings.integrations.mdbaseSpec.enable.description") + " ",
				});
				const link = descEl.createEl("a", {
					text: translate("settings.integrations.mdbaseSpec.learnMore"),
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
			heading: "OAuth Calendar Integration",
		},
		(group) => {
			group.addSetting((setting) => {
				setting.setDesc(
					"Connect your Google calendar or Microsoft outlook to sync events directly into tasknotes."
				);
				const descEl = setting.descEl;
				descEl.createSpan({
					text: " You'll need to create OAuth credentials with Google and/or Microsoft. This takes approximately 15 minutes for initial setup. ",
				});
				const link = descEl.createEl("a", {
					text: "View calendar setup guide",
					href: "https://callumalpass.github.io/tasknotes/calendar-setup",
				});
				link.setAttr("target", "_blank");
			});

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate("settings.integrations.mobileCalendar.disable.name"),
						desc: translate("settings.integrations.mobileCalendar.disable.description"),
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
					setting.setName(translate("settings.integrations.mobileCalendar.status.name"));
					setting.setDesc(
						translate("settings.integrations.mobileCalendar.status.description")
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
					primaryText: "Google Calendar",
					secondaryText: "OAuth service not available",
					meta: [createStatusBadge("Error", "inactive")],
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
			const connectedInfo = activeDocument.createElement("div");
			connectedInfo.className = "tasknotes-calendar-info";
			connectedInfo.textContent = connectedDate ? `Connected ${timeAgo}` : "Connected";

			const lastRefreshInfo = activeDocument.createElement("div");
			lastRefreshInfo.className = "tasknotes-calendar-info";
			if (connection.lastRefreshed) {
				const lastRefreshDate = new Date(connection.lastRefreshed);
				lastRefreshInfo.textContent = `Last refreshed ${getRelativeTime(lastRefreshDate, translate)}`;
			} else {
				lastRefreshInfo.textContent = "Never refreshed";
			}

			createCard(googleCalendarContainer, {
				collapsible: true,
				defaultCollapsed: false,
				colorIndicator: {
					color: "#4285F4", // Google blue
				},
				header: {
					primaryText: "Google Calendar",
					secondaryText: "OAuth 2.0 Connection",
					meta: [createStatusBadge("Connected", "active")],
				},
				content: {
					sections: [
						{
							rows: [
								{ label: "Status:", input: connectedInfo },
								{ label: "Sync:", input: lastRefreshInfo },
							],
						},
					],
				},
				actions: {
					buttons: [
						{
							text: "Refresh Now",
							icon: "refresh-cw",
							variant: "primary",
							onClick: async () => {
								try {
									if (plugin.googleCalendarService) {
										await plugin.googleCalendarService.refresh();
										new Notice("Google calendar refreshed successfully");
										void renderGoogleCalendarCard(); // Re-render to update timestamp
									}
								} catch (error) {
									tasknotesLogger.error("Failed to refresh:", {
										category: "configuration",
										operation: "refresh",
										error: error,
									});
									new Notice("Failed to refresh Google calendar");
								}
							},
						},
						{
							text: "Disconnect",
							icon: "log-out",
							variant: "warning",
							onClick: async () => {
								try {
									const oauthService = plugin.oauthService;
									if (!oauthService) return;
									await oauthService.disconnect("google");
									new Notice("Disconnected from Google calendar");
									void renderGoogleCalendarCard(); // Re-render to show disconnected state
								} catch (error) {
									tasknotesLogger.error("Failed to disconnect:", {
										category: "configuration",
										operation: "disconnect",
										error: error,
									});
									new Notice("Failed to disconnect from Google calendar");
								}
							},
						},
					],
				},
			});
		} else {
			// Disconnected state card
			const helpText = activeDocument.createElement("div");
			helpText.className = "tasknotes-calendar-help";
			helpText.textContent =
				"Connect your Google calendar account to sync events directly into tasknotes. Events will automatically refresh every 15 minutes.";

			// Build sections and credential inputs
			const sections: CardSection[] = [
				{
					rows: [{ label: "Info:", input: helpText, fullWidth: true }],
				},
			];

			const clientIdInput = createCardInput(
				"text",
				"your-client-id.apps.googleusercontent.com",
				plugin.settings.googleOAuthClientId
			);
			clientIdInput.addEventListener("blur", () => {
				runAsyncSettingCallback(async () => {
					plugin.settings.googleOAuthClientId = clientIdInput.value.trim();
					save();
					if (plugin.oauthService) {
						await plugin.oauthService.loadClientIds();
					}
				});
			});

			const clientSecretInput = createCardInput(
				"text",
				"your-client-secret",
				plugin.settings.googleOAuthClientSecret
			);
			clientSecretInput.setAttribute("type", "password");
			clientSecretInput.addEventListener("blur", () => {
				runAsyncSettingCallback(async () => {
					plugin.settings.googleOAuthClientSecret = clientSecretInput.value.trim();
					save();
					if (plugin.oauthService) {
						await plugin.oauthService.loadClientIds();
					}
				});
			});

			const credentialNote = activeDocument.createElement("div");
			credentialNote.className = "tasknotes-credential-note";
			credentialNote.textContent =
				"Enter your OAUTH app credentials from Google cloud console.";

			sections.push({
				rows: [
					{ label: "Client ID:", input: clientIdInput },
					{ label: "Client Secret:", input: clientSecretInput },
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
					primaryText: "Google Calendar",
					secondaryText: "OAuth 2.0 Connection",
					meta: [createStatusBadge("Not Connected", "inactive")],
				},
				content: {
					sections: sections,
				},
				actions: {
					buttons: [
						{
							text: "Connect Google Calendar",
							icon: "link",
							variant: "primary",
							onClick: async () => {
								try {
									const oauthService = plugin.oauthService;
									if (!oauthService) return;
									await oauthService.authenticate("google");
									new Notice("Google calendar connected successfully!");
									void renderGoogleCalendarCard(); // Re-render to show connected state
								} catch (error) {
									tasknotesLogger.error("Failed to connect:", {
										category: "configuration",
										operation: "connect",
										error: error,
									});
									new Notice(`Failed to connect: ${getErrorMessage(error)}`);
								}
							},
						},
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
					primaryText: "Microsoft Outlook Calendar",
					secondaryText: "OAuth service not available",
					meta: [createStatusBadge("Error", "inactive")],
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
			const connectedInfo = activeDocument.createElement("div");
			connectedInfo.className = "tasknotes-calendar-info";
			connectedInfo.textContent = connectedDate ? `Connected ${timeAgo}` : "Connected";

			const tokenRefreshInfo = activeDocument.createElement("div");
			tokenRefreshInfo.className = "tasknotes-calendar-info";
			if (connection.lastRefreshed) {
				const lastRefreshDate = new Date(connection.lastRefreshed);
				tokenRefreshInfo.textContent = `OAuth token refreshed ${getRelativeTime(lastRefreshDate, translate)}`;
			} else {
				tokenRefreshInfo.textContent = "Token not refreshed yet";
			}

			const syncStatus = plugin.microsoftCalendarService?.getSyncStatus();
			const syncInfo = activeDocument.createElement("div");
			syncInfo.className = "tasknotes-calendar-info";
			if (!plugin.microsoftCalendarService) {
				syncInfo.addClass("tasknotes-calendar-info--warning");
				syncInfo.textContent = "Calendar sync service not available";
			} else if (syncStatus?.lastError) {
				syncInfo.addClass("tasknotes-calendar-info--warning");
				const attemptedAt = syncStatus.lastAttempt
					? new Date(syncStatus.lastAttempt)
					: null;
				const attemptedText = attemptedAt
					? ` ${getRelativeTime(attemptedAt, translate)}`
					: "";
				syncInfo.textContent = `Calendar sync failed${attemptedText}: ${syncStatus.lastError}`;
			} else if (syncStatus?.lastSuccess) {
				const lastSyncDate = new Date(syncStatus.lastSuccess);
				syncInfo.textContent = `Calendar sync succeeded ${getRelativeTime(lastSyncDate, translate)} (${syncStatus.eventsLoaded} events)`;
			} else if (syncStatus?.lastAttempt) {
				const lastAttemptDate = new Date(syncStatus.lastAttempt);
				syncInfo.textContent = `Calendar sync checked ${getRelativeTime(lastAttemptDate, translate)}`;
			} else {
				syncInfo.textContent = "Calendar events not refreshed yet";
			}

			const microsoftRows: CardSection["rows"] = [
				{ label: "Status:", input: connectedInfo },
				{ label: "Token:", input: tokenRefreshInfo },
				{ label: "Sync:", input: syncInfo },
			];

			if (syncStatus?.calendarErrors.length) {
				const errorInfo = activeDocument.createElement("div");
				errorInfo.className = "tasknotes-calendar-info tasknotes-calendar-info--warning";
				const firstError = syncStatus.calendarErrors[0];
				const calendarLabel =
					firstError.calendarName || firstError.calendarId || "Microsoft calendar";
				errorInfo.textContent =
					syncStatus.calendarErrors.length === 1
						? `${calendarLabel}: ${firstError.message}`
						: `${syncStatus.calendarErrors.length} calendars failed. First error: ${calendarLabel}: ${firstError.message}`;
				microsoftRows.push({ label: "Issue:", input: errorInfo, fullWidth: true });
			}

			createCard(microsoftCalendarContainer, {
				collapsible: true,
				defaultCollapsed: false,
				colorIndicator: {
					color: "#0078D4", // Microsoft blue
				},
				header: {
					primaryText: "Microsoft Outlook Calendar",
					secondaryText: "OAuth 2.0 Connection",
					meta: [createStatusBadge("Connected", "active")],
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
							text: "Refresh Now",
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
												`Microsoft calendar refresh had errors: ${latestStatus.lastError}`
											);
										} else {
											new Notice("Microsoft calendar refreshed successfully");
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
										`Failed to refresh Microsoft calendar: ${getErrorMessage(error)}`
									);
								}
							},
						},
						{
							text: "Disconnect",
							icon: "log-out",
							variant: "warning",
							onClick: async () => {
								try {
									const oauthService = plugin.oauthService;
									if (!oauthService) return;
									await oauthService.disconnect("microsoft");
									new Notice("Disconnected from Microsoft calendar");
									void renderMicrosoftCalendarCard();
								} catch (error) {
									tasknotesLogger.error("Failed to disconnect:", {
										category: "configuration",
										operation: "disconnect",
										error: error,
									});
									new Notice("Failed to disconnect from Microsoft calendar");
								}
							},
						},
					],
				},
			});
		} else {
			// Disconnected state card
			const helpText = activeDocument.createElement("div");
			helpText.className = "tasknotes-calendar-help";
			helpText.textContent =
				"Connect your Microsoft outlook calendar to sync events directly into tasknotes.";

			// Build sections and credential inputs
			const sections: CardSection[] = [
				{
					rows: [{ label: "Info:", input: helpText, fullWidth: true }],
				},
			];

			const clientIdInput = createCardInput(
				"text",
				"your-microsoft-client-id",
				plugin.settings.microsoftOAuthClientId
			);
			clientIdInput.addEventListener("blur", () => {
				runAsyncSettingCallback(async () => {
					plugin.settings.microsoftOAuthClientId = clientIdInput.value.trim();
					save();
					if (plugin.oauthService) {
						await plugin.oauthService.loadClientIds();
					}
				});
			});

			const clientSecretInput = createCardInput(
				"text",
				"your-microsoft-client-secret",
				plugin.settings.microsoftOAuthClientSecret
			);
			clientSecretInput.setAttribute("type", "password");
			clientSecretInput.addEventListener("blur", () => {
				runAsyncSettingCallback(async () => {
					plugin.settings.microsoftOAuthClientSecret = clientSecretInput.value.trim();
					save();
					if (plugin.oauthService) {
						await plugin.oauthService.loadClientIds();
					}
				});
			});

			const credentialNote = activeDocument.createElement("div");
			credentialNote.className = "tasknotes-credential-note";
			credentialNote.textContent = "Enter your OAUTH app credentials from azure portal.";

			sections.push({
				rows: [
					{ label: "Client ID:", input: clientIdInput },
					{ label: "Client Secret:", input: clientSecretInput },
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
					primaryText: "Microsoft Outlook Calendar",
					secondaryText: "OAuth 2.0 Connection",
					meta: [createStatusBadge("Not Connected", "inactive")],
				},
				content: {
					sections: sections,
				},
				actions: {
					buttons: [
						{
							text: "Connect Microsoft Calendar",
							icon: "link",
							variant: "primary",
							onClick: async () => {
								try {
									const oauthService = plugin.oauthService;
									if (!oauthService) return;
									await oauthService.authenticate("microsoft");
									new Notice("Microsoft calendar connected successfully!");
									void renderMicrosoftCalendarCard();
								} catch (error) {
									tasknotesLogger.error("Failed to connect:", {
										category: "configuration",
										operation: "connect",
										error: error,
									});
									new Notice(`Failed to connect: ${getErrorMessage(error)}`);
								}
							},
						},
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
			heading: translate("settings.integrations.googleCalendarExport.header"),
			description: translate("settings.integrations.googleCalendarExport.description"),
		},
		(group) => {
			// Master toggle
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate("settings.integrations.googleCalendarExport.enable.name"),
						desc: translate(
							"settings.integrations.googleCalendarExport.enable.description"
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
					translate("settings.integrations.googleCalendarExport.targetCalendar.name")
				);
				setting.setDesc(
					translate(
						"settings.integrations.googleCalendarExport.targetCalendar.description"
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
						"settings.integrations.googleCalendarExport.targetCalendar.placeholder"
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
												"settings.integrations.googleCalendarExport.targetCalendar.primarySuffix"
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
								"settings.integrations.googleCalendarExport.targetCalendar.connectFirst"
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
							"settings.integrations.googleCalendarExport.syncTrigger.name"
						),
						desc: translate(
							"settings.integrations.googleCalendarExport.syncTrigger.description"
						),
						options: [
							{
								value: "scheduled",
								label: translate(
									"settings.integrations.googleCalendarExport.syncTrigger.options.scheduled"
								),
							},
							{
								value: "due",
								label: translate(
									"settings.integrations.googleCalendarExport.syncTrigger.options.due"
								),
							},
							{
								value: "both",
								label: translate(
									"settings.integrations.googleCalendarExport.syncTrigger.options.both"
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
							"settings.integrations.googleCalendarExport.allDayEvents.name"
						),
						desc: translate(
							"settings.integrations.googleCalendarExport.allDayEvents.description"
						),
						getValue: () => plugin.settings.googleCalendarExport.createAsAllDay,
						setValue: async (value: boolean) => {
							plugin.settings.googleCalendarExport.createAsAllDay = value;
							save();
						},
					})
			);

			// Default duration (only relevant for timed events)
			group.addSetting(
				(setting) =>
					void configureNumberSetting(setting, {
						name: translate(
							"settings.integrations.googleCalendarExport.defaultDuration.name"
						),
						desc: translate(
							"settings.integrations.googleCalendarExport.defaultDuration.description"
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
							"settings.integrations.googleCalendarExport.eventTitleTemplate.name"
						),
						desc: translate(
							"settings.integrations.googleCalendarExport.eventTitleTemplate.description"
						),
						placeholder: translate(
							"settings.integrations.googleCalendarExport.eventTitleTemplate.placeholder"
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
							"settings.integrations.googleCalendarExport.includeDescription.name"
						),
						desc: translate(
							"settings.integrations.googleCalendarExport.includeDescription.description"
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
							"settings.integrations.googleCalendarExport.includeObsidianLink.name"
						),
						desc: translate(
							"settings.integrations.googleCalendarExport.includeObsidianLink.description"
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
							"settings.integrations.googleCalendarExport.defaultReminder.name"
						),
						desc: translate(
							"settings.integrations.googleCalendarExport.defaultReminder.description"
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
						"settings.integrations.googleCalendarExport.automaticSyncBehavior.header"
					)
				);
				setting.setHeading();
			});

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							"settings.integrations.googleCalendarExport.syncOnCreate.name"
						),
						desc: translate(
							"settings.integrations.googleCalendarExport.syncOnCreate.description"
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
							"settings.integrations.googleCalendarExport.syncOnUpdate.name"
						),
						desc: translate(
							"settings.integrations.googleCalendarExport.syncOnUpdate.description"
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
							"settings.integrations.googleCalendarExport.syncOnComplete.name"
						),
						desc: translate(
							"settings.integrations.googleCalendarExport.syncOnComplete.description"
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
							"settings.integrations.googleCalendarExport.syncOnDelete.name"
						),
						desc: translate(
							"settings.integrations.googleCalendarExport.syncOnDelete.description"
						),
						getValue: () => plugin.settings.googleCalendarExport.syncOnTaskDelete,
						setValue: async (value: boolean) => {
							plugin.settings.googleCalendarExport.syncOnTaskDelete = value;
							save();
						},
					})
			);

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: "Sync timeblocks",
					desc: "Enable syncing timeblocks to Google Calendar.",
					getValue: () => plugin.settings.googleCalendarExport.syncTimeblocks,
					setValue: async (value: boolean) => {
						plugin.settings.googleCalendarExport.syncTimeblocks = value;
						save();
					},
				})
			);

			// Manual sync actions - section header
			group.addSetting((setting) => {
				setting.setName(
					translate("settings.integrations.googleCalendarExport.manualSyncActions.header")
				);
				setting.setHeading();
			});

			group.addSetting(
				(setting) =>
					void configureButtonSetting(setting, {
						name: translate(
							"settings.integrations.googleCalendarExport.syncAllTasks.name"
						),
						desc: translate(
							"settings.integrations.googleCalendarExport.syncAllTasks.description"
						),
						buttonText: translate(
							"settings.integrations.googleCalendarExport.syncAllTasks.buttonText"
						),
						onClick: async () => {
							if (!plugin.taskCalendarSyncService?.isEnabled()) {
								new Notice(
									translate(
										"settings.integrations.googleCalendarExport.notices.notEnabledOrConfigured"
									)
								);
								return;
							}
							const results = await plugin.taskCalendarSyncService.syncAllTasks();
							new Notice(
								translate(
									"settings.integrations.googleCalendarExport.notices.syncResults",
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
							"settings.integrations.googleCalendarExport.unlinkAllTasks.name"
						),
						desc: translate(
							"settings.integrations.googleCalendarExport.unlinkAllTasks.description"
						),
						buttonText: translate(
							"settings.integrations.googleCalendarExport.unlinkAllTasks.buttonText"
						),
						onClick: async () => {
							if (!plugin.taskCalendarSyncService) {
								new Notice(
									translate(
										"settings.integrations.googleCalendarExport.notices.serviceNotAvailable"
									)
								);
								return;
							}
							const confirmed = await showConfirmationModal(plugin.app, {
								title: translate(
									"settings.integrations.googleCalendarExport.unlinkAllTasks.confirmTitle"
								),
								message: translate(
									"settings.integrations.googleCalendarExport.unlinkAllTasks.confirmMessage"
								),
								confirmText: translate(
									"settings.integrations.googleCalendarExport.unlinkAllTasks.confirmButtonText"
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
			heading: translate("settings.integrations.calendarSubscriptions.header"),
			description: translate("settings.integrations.calendarSubscriptions.description"),
		},
		(group) => {
			// Default settings for ICS integration
			group.addSetting(
				(setting) =>
					void configureTextSetting(setting, {
						name: translate(
							"settings.integrations.calendarSubscriptions.defaultNoteTemplate.name"
						),
						desc: translate(
							"settings.integrations.calendarSubscriptions.defaultNoteTemplate.description"
						),
						placeholder: translate(
							"settings.integrations.calendarSubscriptions.defaultNoteTemplate.placeholder"
						),
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
							"settings.integrations.calendarSubscriptions.defaultNoteFolder.name"
						),
						desc: translate(
							"settings.integrations.calendarSubscriptions.defaultNoteFolder.description"
						),
						placeholder: translate(
							"settings.integrations.calendarSubscriptions.defaultNoteFolder.placeholder"
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
							"settings.integrations.calendarSubscriptions.filenameFormat.name"
						),
						desc: translate(
							"settings.integrations.calendarSubscriptions.filenameFormat.description"
						),
						options: [
							{
								value: "title",
								label: translate(
									"settings.integrations.calendarSubscriptions.filenameFormat.options.title"
								),
							},
							{
								value: "zettel",
								label: translate(
									"settings.integrations.calendarSubscriptions.filenameFormat.options.zettel"
								),
							},
							{
								value: "timestamp",
								label: translate(
									"settings.integrations.calendarSubscriptions.filenameFormat.options.timestamp"
								),
							},
							{
								value: "custom",
								label: translate(
									"settings.integrations.calendarSubscriptions.filenameFormat.options.custom"
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
								"settings.integrations.calendarSubscriptions.customTemplate.name"
							),
							desc: translate(
								"settings.integrations.calendarSubscriptions.customTemplate.description"
							),
							placeholder: translate(
								"settings.integrations.calendarSubscriptions.customTemplate.placeholder"
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
							"settings.integrations.calendarSubscriptions.useICSEndAsDue.name"
						),
						desc: translate(
							"settings.integrations.calendarSubscriptions.useICSEndAsDue.description"
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
							"settings.integrations.calendarSubscriptions.recurringEventRelatedNotesMode.name"
						),
						desc: translate(
							"settings.integrations.calendarSubscriptions.recurringEventRelatedNotesMode.description"
						),
						options: [
							{
								value: "series",
								label: translate(
									"settings.integrations.calendarSubscriptions.recurringEventRelatedNotesMode.options.series"
								),
							},
							{
								value: "instance",
								label: translate(
									"settings.integrations.calendarSubscriptions.recurringEventRelatedNotesMode.options.instance"
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
							plugin.settings.icsIntegration.recurringEventRelatedNotesMode =
								value;
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
			heading: translate("settings.integrations.subscriptionsList.header"),
		},
		(group) => {
			// Add subscription button
			group.addSetting(
				(setting) =>
					void configureButtonSetting(setting, {
						name: translate(
							"settings.integrations.subscriptionsList.addSubscription.name"
						),
						desc: translate(
							"settings.integrations.subscriptionsList.addSubscription.description"
						),
						buttonText: translate(
							"settings.integrations.subscriptionsList.addSubscription.buttonText"
						),
						onClick: async () => {
							// Create a new subscription with temporary values
							const newSubscription = {
								name: translate(
									"settings.integrations.subscriptionsList.newCalendarName"
								),
								url: "",
								color: "#6366f1",
								enabled: false, // Start disabled until user fills in details
								type: "remote" as const,
								refreshInterval: 60,
							};

							if (!plugin.icsSubscriptionService) {
								new Notice(
									translate(
										"settings.integrations.subscriptionsList.notices.serviceUnavailable"
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
										"settings.integrations.subscriptionsList.notices.addSuccess"
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
										"settings.integrations.subscriptionsList.notices.addFailure"
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
						name: translate("settings.integrations.subscriptionsList.refreshAll.name"),
						desc: translate(
							"settings.integrations.subscriptionsList.refreshAll.description"
						),
						buttonText: translate(
							"settings.integrations.subscriptionsList.refreshAll.buttonText"
						),
						onClick: async () => {
							if (plugin.icsSubscriptionService) {
								try {
									await plugin.icsSubscriptionService.refreshAllSubscriptions();
									new Notice(
										translate(
											"settings.integrations.subscriptionsList.notices.refreshSuccess"
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
											"settings.integrations.subscriptionsList.notices.refreshFailure"
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
			heading: translate("settings.integrations.autoExport.header"),
			description: translate("settings.integrations.autoExport.description"),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate("settings.integrations.autoExport.enable.name"),
						desc: translate("settings.integrations.autoExport.enable.description"),
						getValue: () => plugin.settings.icsIntegration.enableAutoExport,
						setValue: async (value: boolean) => {
							plugin.settings.icsIntegration.enableAutoExport = value;
							save();
							new Notice(
								translate("settings.integrations.autoExport.notices.reloadRequired")
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
							name: translate("settings.integrations.autoExport.filePath.name"),
							desc: translate(
								"settings.integrations.autoExport.filePath.description"
							),
							placeholder: translate(
								"settings.integrations.autoExport.filePath.placeholder"
							),
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
							name: translate("settings.integrations.autoExport.interval.name"),
							desc: translate(
								"settings.integrations.autoExport.interval.description"
							),
							placeholder: translate(
								"settings.integrations.autoExport.interval.placeholder"
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
							name: translate("settings.integrations.autoExport.useDuration.name"),
							desc: translate(
								"settings.integrations.autoExport.useDuration.description"
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
								"settings.integrations.autoExport.excludeCompleted.name"
							),
							desc: translate(
								"settings.integrations.autoExport.excludeCompleted.description"
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
								"settings.integrations.autoExport.excludeArchived.name"
							),
							desc: translate(
								"settings.integrations.autoExport.excludeArchived.description"
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
							name: translate("settings.integrations.autoExport.requireDueDate.name"),
							desc: translate(
								"settings.integrations.autoExport.requireDueDate.description"
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
								"settings.integrations.autoExport.requireScheduledDate.name"
							),
							desc: translate(
								"settings.integrations.autoExport.requireScheduledDate.description"
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
							name: translate("settings.integrations.autoExport.exportNow.name"),
							desc: translate(
								"settings.integrations.autoExport.exportNow.description"
							),
							buttonText: translate(
								"settings.integrations.autoExport.exportNow.buttonText"
							),
							onClick: async () => {
								if (plugin.autoExportService) {
									try {
										await plugin.autoExportService.exportNow();
										new Notice(
											translate(
												"settings.integrations.autoExport.notices.exportSuccess"
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
												"settings.integrations.autoExport.notices.exportFailure"
											)
										);
									}
								} else {
									new Notice(
										translate(
											"settings.integrations.autoExport.notices.serviceUnavailable"
										)
									);
								}
							},
						})
				);

				// Export status display
				group.addSetting((setting) => {
					setting.setName(translate("settings.integrations.autoExport.status.title"));
					const descEl = setting.descEl;

					if (plugin.autoExportService) {
						const lastExport = plugin.autoExportService.getLastExportTime();
						const nextExport = plugin.autoExportService.getNextExportTime();

						const lastExportText = lastExport
							? translate("settings.integrations.autoExport.status.lastExport", {
									time: lastExport.toLocaleString(),
								})
							: translate("settings.integrations.autoExport.status.noExports");
						const nextExportText = nextExport
							? translate("settings.integrations.autoExport.status.nextExport", {
									time: nextExport.toLocaleString(),
								})
							: translate("settings.integrations.autoExport.status.notScheduled");

						descEl.textContent = lastExportText + "\n" + nextExportText;
					} else {
						descEl.textContent = translate(
							"settings.integrations.autoExport.status.serviceNotInitialized"
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
				heading: translate("settings.integrations.httpApi.header"),
				description: translate("settings.integrations.httpApi.description"),
			},
			(group) => {
				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate("settings.integrations.httpApi.enable.name"),
							desc: translate("settings.integrations.httpApi.enable.description"),
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
								name: translate("settings.integrations.httpApi.port.name"),
								desc: translate("settings.integrations.httpApi.port.description"),
								placeholder: translate(
									"settings.integrations.httpApi.port.placeholder"
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
								name: translate("settings.integrations.httpApi.authToken.name"),
								desc: translate(
									"settings.integrations.httpApi.authToken.description"
								),
								placeholder: translate(
									"settings.integrations.httpApi.authToken.placeholder"
								),
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
								name: translate("settings.integrations.httpApi.mcp.enable.name"),
								desc: translate(
									"settings.integrations.httpApi.mcp.enable.description"
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
				"settings.integrations.httpApi.endpoints.expandIcon"
			);
			apiHeaderContent.createSpan({
				text: translate("settings.integrations.httpApi.endpoints.header"),
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
					? translate("settings.integrations.httpApi.endpoints.expandIcon")
					: translate("settings.integrations.httpApi.endpoints.collapseIcon");
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
				heading: translate("settings.integrations.webhooks.header"),
				description:
					translate("settings.integrations.webhooks.description.overview") +
					" " +
					translate("settings.integrations.webhooks.description.usage"),
			},
			(group) => {
				// Add webhook button
				group.addSetting(
					(setting) =>
						void configureButtonSetting(setting, {
							name: translate("settings.integrations.webhooks.addWebhook.name"),
							desc: translate(
								"settings.integrations.webhooks.addWebhook.description"
							),
							buttonText: translate(
								"settings.integrations.webhooks.addWebhook.buttonText"
							),
							onClick: async () => {
								const modal = new WebhookModal(
									plugin.app,
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
										new SecretNoticeModal(plugin.app, webhook.secret).open();
										new Notice(
											translate(
												"settings.integrations.webhooks.notices.created"
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

	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	if (!plugin.icsSubscriptionService) {
		createHelpText(
			container,
			translate("settings.integrations.subscriptionsList.notices.serviceUnavailable")
		);
		return;
	}

	const subscriptions = plugin.icsSubscriptionService.getSubscriptions();
	if (subscriptions.length === 0) {
		// Empty state with consistent styling
		const emptyState = container.createDiv("tasknotes-webhooks-empty-state");
		emptyState.createSpan("tasknotes-webhooks-empty-icon");
		emptyState.createSpan({
			text: translate("settings.integrations.subscriptionsList.emptyState"),
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

		const nameInput = createCardInput("text", "Calendar name", subscription.name);

		// Create type dropdown
		const typeSelect = activeDocument.createElement("select");
		typeSelect.className = "tasknotes-settings__card-input";

		const remoteOption = activeDocument.createElement("option");
		remoteOption.value = "remote";
		remoteOption.textContent = "Remote URL";
		remoteOption.selected = subscription.type === "remote";
		typeSelect.appendChild(remoteOption);

		const localOption = activeDocument.createElement("option");
		localOption.value = "local";
		localOption.textContent = "Local file";
		localOption.selected = subscription.type === "local";
		typeSelect.appendChild(localOption);

		// Create input based on type
		let sourceInput: HTMLElement;
		if (subscription.type === "remote") {
			sourceInput = createCardUrlInput("ICS/iCal URL", subscription.url);
		} else {
			const fileInput = createCardInput(
				"text",
				"Local file path (e.g., Calendar.ics)",
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
					translate("settings.integrations.subscriptionsList.notices.updateFailure")
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
							newSourceInput = createCardUrlInput("ICS/iCal URL", subscription.url);
						} else {
							const fileInput = createCardInput(
								"text",
								"Local file path (e.g., Calendar.ics)",
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
							labelElement.textContent = newType === "remote" ? "URL:" : "File Path:";
						}

						// Update the secondary text in the header
						const secondaryText = card.querySelector(
							".tasknotes-settings__card-secondary-text"
						);
						if (secondaryText) {
							secondaryText.textContent =
								newType === "remote" ? "Remote Calendar" : "Local File";
						}

						// Update the type badge
						const typeBadge = card.querySelector(
							".tasknotes-settings__card-meta .info-badge"
						); // Assuming info-badge is the class for type badge
						if (typeBadge) {
							typeBadge.textContent = newType === "remote" ? "Remote" : "Local File";
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
			subscription.enabled ? "Enabled" : "Disabled",
			subscription.enabled ? "active" : "inactive"
		);

		const typeBadge = createInfoBadge(subscription.type === "remote" ? "Remote" : "Local File");

		const metaBadges = [statusBadge, typeBadge];

		// Add last sync badge if available
		const lastFetched = plugin.icsSubscriptionService.getLastFetched(subscription.id);
		if (lastFetched) {
			const lastSyncDate = new Date(lastFetched);
			const timeAgo = getRelativeTime(lastSyncDate, translate);
			const syncBadge = createInfoBadge(`Synced ${timeAgo}`);
			metaBadges.push(syncBadge);
		}

		// Add error badge if there's an error
		const lastError = plugin.icsSubscriptionService.getLastError(subscription.id);
		if (lastError) {
			const errorBadge = createStatusBadge("Error", "inactive");
			errorBadge.title = lastError; // Show error on hover
			metaBadges.push(errorBadge);
		}

		// Build content rows
		const contentRows: { label: string; input: HTMLElement; fullWidth?: boolean }[] = [
			{ label: "Enabled:", input: enabledToggle },
			{ label: "Name:", input: nameInput },
			{ label: "Type:", input: typeSelect },
			{
				label: subscription.type === "remote" ? "URL:" : "File Path:",
				input: sourceInput,
			},
			{ label: "Color:", input: colorInput },
			{ label: "Refresh (min):", input: refreshInput },
		];

		createCard(container, {
			id: subscription.id,
			collapsible: true,
			defaultCollapsed: true,
			colorIndicator: {
				color: subscription.color,
			},
			header: {
				primaryText: subscription.name,
				secondaryText: subscription.type === "remote" ? "Remote Calendar" : "Local File",
				meta: metaBadges,
				actions: [
					createDeleteHeaderButton(async () => {
						const confirmed = await showConfirmationModal(plugin.app, {
							title: translate(
								"settings.integrations.subscriptionsList.confirmDelete.title"
							),
							message: translate(
								"settings.integrations.subscriptionsList.confirmDelete.message",
								{ name: subscription.name }
							),
							confirmText: translate(
								"settings.integrations.subscriptionsList.confirmDelete.confirmText"
							),
							cancelText: translate("common.cancel"),
							isDestructive: true,
						});

						if (confirmed) {
							try {
								const subscriptionService = plugin.icsSubscriptionService;
								if (!subscriptionService) return;
								await subscriptionService.removeSubscription(subscription.id);
								new Notice(
									translate(
										"settings.integrations.subscriptionsList.notices.deleteSuccess",
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
										"settings.integrations.subscriptionsList.notices.deleteFailure"
									)
								);
							}
						}
					}, "Delete subscription"),
				],
			},
			content: {
				sections: [{ rows: contentRows }],
			},
			actions: {
				buttons: [
					{
						text: translate("settings.integrations.subscriptionsList.refreshNow"),
						icon: "refresh-cw",
						variant: subscription.enabled ? "primary" : "secondary",
						disabled: !subscription.enabled,
						onClick: async () => {
							if (!subscription.enabled) {
								new Notice(
									translate(
										"settings.integrations.subscriptionsList.notices.enableFirst"
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
										"settings.integrations.subscriptionsList.notices.refreshSuccess",
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
										"settings.integrations.subscriptionsList.notices.refreshFailure"
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
	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
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
			translate("settings.integrations.webhooks.emptyState.message"),
			translate("settings.integrations.webhooks.emptyState.buttonText"),
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
			webhook.active ? "Active" : "Inactive",
			webhook.active ? "active" : "inactive"
		);

		const successBadge = createInfoBadge(`Success: ${webhook.successCount || 0}`);
		const failureBadge = createInfoBadge(`Failed: ${webhook.failureCount || 0}`);

		// Create inputs for inline editing
		const urlInput = createCardUrlInput("Webhook URL", webhook.url);
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
					statusBadge.textContent = webhook.active ? "Active" : "Inactive";
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
					? translate("settings.integrations.webhooks.notices.enabled")
					: translate("settings.integrations.webhooks.notices.disabled")
			);
		});

		// Update handler for URL input
		urlInput.addEventListener("blur", () => {
			if (urlInput.value.trim() !== webhook.url) {
				webhook.url = urlInput.value.trim();
				save();
				new Notice(translate("settings.integrations.webhooks.notices.urlUpdated"));
			}
		});

		// Format webhook creation date
		const createdDate = webhook.createdAt ? new Date(webhook.createdAt) : null;
		const createdText = createdDate
			? translate("settings.integrations.webhooks.statusLabels.created", {
					timeAgo: getRelativeTime(createdDate, translate),
				})
			: "Creation date unknown";

		// Create events display as a formatted string
		const eventsDisplay = activeDocument.createElement("div");
		eventsDisplay.className = "tasknotes-webhook-events";

		if (webhook.events.length === 0) {
			const noEventsSpan = activeDocument.createElement("span");
			noEventsSpan.className = "tasknotes-webhook-events--empty";
			noEventsSpan.textContent = translate(
				"settings.integrations.webhooks.eventsDisplay.noEvents"
			);
			eventsDisplay.appendChild(noEventsSpan);
		} else {
			webhook.events.forEach((event) => {
				eventsDisplay.appendChild(createInfoBadge(event));
			});
		}

		// Create transform file display if exists
		const transformDisplay = activeDocument.createElement("span");
		if (webhook.transformFile) {
			transformDisplay.className = "tasknotes-transform-file";
			transformDisplay.textContent = webhook.transformFile;
		} else {
			transformDisplay.className = "tasknotes-transform-file--empty";
			transformDisplay.textContent = translate(
				"settings.integrations.webhooks.transformDisplay.noTransform"
			);
		}

		createCard(webhooksContainer, {
			id: webhook.id,
			collapsible: true,
			defaultCollapsed: true,
			header: {
				primaryText: translate("settings.integrations.webhooks.cardHeader"),
				secondaryText: createdText,
				meta: [statusBadge, successBadge, failureBadge],
				actions: [
					createDeleteHeaderButton(async () => {
						const confirmed = await showConfirmationModal(plugin.app, {
							title: translate("settings.integrations.webhooks.confirmDelete.title"),
							message: translate(
								"settings.integrations.webhooks.confirmDelete.message",
								{ url: webhook.url }
							),
							confirmText: translate(
								"settings.integrations.webhooks.confirmDelete.confirmText"
							),
							cancelText: translate("common.cancel"),
							isDestructive: true,
						});

						if (confirmed) {
							plugin.settings.webhooks.splice(index, 1);
							save();
							renderWebhookList(container, plugin, save);
							new Notice(translate("settings.integrations.webhooks.notices.deleted"));
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
									"settings.integrations.webhooks.cardFields.active"
								),
								input: activeToggle,
							},
							{
								label: translate("settings.integrations.webhooks.cardFields.url"),
								input: urlInput,
							},
							{
								label: translate(
									"settings.integrations.webhooks.cardFields.events"
								),
								input: eventsDisplay,
							},
							{
								label: translate(
									"settings.integrations.webhooks.cardFields.transform"
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
						text: translate("settings.integrations.webhooks.editEvents"),
						icon: "settings",
						variant: "secondary",
						onClick: async () => {
							const modal = new WebhookEditModal(
								plugin.app,
								webhook,
								(updatedConfig: Partial<WebhookConfig>) => {
									Object.assign(webhook, updatedConfig);
									save();
									renderWebhookList(container, plugin, save);
									new Notice(
										translate("settings.integrations.webhooks.notices.updated")
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

	constructor(app: App, secret: string) {
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
		title.createSpan({ text: "Webhook Secret Generated" });

		const content = notice.createDiv({ cls: "tasknotes-webhook-secret-content" });
		content.createEl("p", {
			text: "Your webhook secret has been generated. Save this secret as you won't be able to view it again:",
		});
		content.createEl("code", { text: this.secret, cls: "tasknotes-webhook-secret-code" });
		content.createEl("p", {
			text: "Use this secret to verify webhook payloads in your receiving application.",
		});

		const buttonContainer = contentEl.createDiv({ cls: "tasknotes-webhook-modal-buttons" });
		const closeBtn = buttonContainer.createEl("button", {
			text: "Got it",
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
		header.createEl("h2", { text: "Edit webhook", cls: "tasknotes-webhook-modal-title" });

		// Events selection section
		const eventsSection = contentEl.createDiv({ cls: "tasknotes-webhook-modal-section" });
		const eventsHeader = eventsSection.createDiv({
			cls: "tasknotes-webhook-modal-subsection-header",
		});
		const eventsIcon = eventsHeader.createSpan();
		setIcon(eventsIcon, "zap");
		eventsHeader.createEl("h3", { text: "Events to subscribe to" });

		const eventsGrid = eventsSection.createDiv({ cls: "tasknotes-webhook-events-list" });
		WEBHOOK_EVENT_OPTIONS.forEach((event) => {
			new Setting(eventsGrid)
				.setName(event.label)
				.setDesc(event.desc)
				.addToggle((toggle) => {
					toggle.toggleEl.setAttribute(
						"aria-label",
						`Subscribe to ${event.label} events`
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
		transformHeader.createEl("h3", { text: "Transform configuration (optional)" });

		new Setting(transformSection)
			.setName("Transform file")
			.setDesc("Path to a .json template file in your vault that transforms webhook payloads")
			.addText((text) => {
				text.inputEl.setAttribute("aria-label", "Transform file path");
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
		corsHeader.createEl("h3", { text: "Headers configuration" });

		new Setting(corsSection)
			.setName("Include custom headers")
			.setDesc(
				"Include tasknotes headers (event type, signature, delivery ID). Turn off for Discord, Slack, and other services with strict cors policies."
			)
			.addToggle((toggle) => {
				toggle.toggleEl.setAttribute("aria-label", "Include custom headers");
				return toggle.setValue(this.corsHeaders).onChange((value) => {
					this.corsHeaders = value;
				});
			});

		// Buttons section
		const buttonContainer = contentEl.createDiv({ cls: "tasknotes-webhook-modal-buttons" });

		const cancelBtn = buttonContainer.createEl("button", {
			text: "Cancel",
			cls: "tasknotes-webhook-modal-btn cancel",
			attr: { "aria-label": "Cancel webhook editing" },
		});
		const cancelIcon = cancelBtn.createSpan({ cls: "tasknotes-webhook-modal-btn-icon" });
		setIcon(cancelIcon, "x");
		cancelBtn.onclick = () => this.close();

		const saveBtn = buttonContainer.createEl("button", {
			text: "Save changes",
			cls: "tasknotes-webhook-modal-btn save mod-cta",
			attr: { "aria-label": "Save webhook changes" },
		});
		const saveIcon = saveBtn.createSpan({ cls: "tasknotes-webhook-modal-btn-icon" });
		setIcon(saveIcon, "save");

		saveBtn.onclick = () => {
			if (this.selectedEvents.length === 0) {
				new Notice("Please select at least one event");
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

	constructor(app: App, onSubmit: (config: Partial<WebhookConfig>) => unknown) {
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
		header.createEl("h2", { text: "Add webhook", cls: "tasknotes-webhook-modal-title" });

		// URL input section
		const urlSection = contentEl.createDiv({ cls: "tasknotes-webhook-modal-section" });
		new Setting(urlSection)
			.setName("Webhook URL")
			.setDesc("The endpoint where webhook payloads will be sent")
			.addText((text) => {
				text.inputEl.setAttribute("aria-label", "Webhook URL");
				return text
					.setPlaceholder("HTTPS://your-service.com/webhook")
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
		eventsHeader.createEl("h3", { text: "Events to subscribe to" });

		const eventsGrid = eventsSection.createDiv({ cls: "tasknotes-webhook-events-list" });

		WEBHOOK_EVENT_OPTIONS.forEach((event) => {
			new Setting(eventsGrid)
				.setName(event.label)
				.setDesc(event.desc)
				.addToggle((toggle) => {
					toggle.toggleEl.setAttribute(
						"aria-label",
						`Subscribe to ${event.label} events`
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
		transformHeader.createEl("h3", { text: "Transform configuration (optional)" });

		new Setting(transformSection)
			.setName("Transform file")
			.setDesc("Path to a .json template file in your vault that transforms webhook payloads")
			.addText((text) => {
				text.inputEl.setAttribute("aria-label", "Transform file path");
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
		helpHeader.createSpan({ text: "JSON transform templates customize webhook payloads:" });

		const helpList = transformHelp.createEl("ul", { cls: "tasknotes-webhook-help-list" });
		const jsonLi = helpList.createEl("li");
		jsonLi.createEl("strong", { text: ".json files:" });
		jsonLi.appendText(" Templates with ");
		jsonLi.createEl("code", { text: "${data.task.title}" });

		const emptyLi = helpList.createEl("li");
		emptyLi.createEl("strong", { text: "Leave empty:" });
		emptyLi.appendText(" Send raw data");

		const helpExample = transformHelp.createDiv({ cls: "tasknotes-webhook-help-example" });
		helpExample.createEl("strong", { text: "Example:" });
		helpExample.appendText(" ");
		helpExample.createEl("code", { text: "simple-template.json" });

		// CORS headers section
		const corsSection = contentEl.createDiv({ cls: "tasknotes-webhook-modal-section" });
		const corsHeader = corsSection.createDiv({
			cls: "tasknotes-webhook-modal-subsection-header",
		});
		const corsIcon = corsHeader.createSpan();
		setIcon(corsIcon, "settings");
		corsHeader.createEl("h3", { text: "Headers configuration" });

		new Setting(corsSection)
			.setName("Include custom headers")
			.setDesc(
				"Include tasknotes headers (event type, signature, delivery ID). Turn off for Discord, Slack, and other services with strict cors policies."
			)
			.addToggle((toggle) => {
				toggle.toggleEl.setAttribute("aria-label", "Include custom headers");
				return toggle.setValue(this.corsHeaders).onChange((value) => {
					this.corsHeaders = value;
				});
			});

		// Buttons section
		const buttonContainer = contentEl.createDiv({ cls: "tasknotes-webhook-modal-buttons" });

		const cancelBtn = buttonContainer.createEl("button", {
			text: "Cancel",
			cls: "tasknotes-webhook-modal-btn cancel",
			attr: { "aria-label": "Cancel webhook creation" },
		});
		const cancelIcon = cancelBtn.createSpan({ cls: "tasknotes-webhook-modal-btn-icon" });
		setIcon(cancelIcon, "x");
		cancelBtn.onclick = () => this.close();

		const saveBtn = buttonContainer.createEl("button", {
			text: "Add webhook",
			cls: "tasknotes-webhook-modal-btn save mod-cta",
			attr: { "aria-label": "Create webhook" },
		});
		const saveIcon = saveBtn.createSpan({ cls: "tasknotes-webhook-modal-btn-icon" });
		setIcon(saveIcon, "plus");

		saveBtn.onclick = () => {
			if (!this.url.trim()) {
				new Notice("Webhook URL is required");
				return;
			}

			if (this.selectedEvents.length === 0) {
				new Notice("Please select at least one event");
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
