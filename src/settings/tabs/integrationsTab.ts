import { Notice, Platform, Modal, Setting, setIcon, App } from "obsidian";
import TaskNotesPlugin from "../../main";
import { WebhookConfig } from "../../types";
import { TranslationKey } from "../../i18n";
import { loadAPIEndpoints } from "../../api/loadAPIEndpoints";
import {
	createSettingGroup,
	configureTextSetting,
	configureToggleSetting,
	configureDropdownSetting,
	configureNumberSetting,
	configureButtonSetting,
	createHelpText,
} from "../components/settingHelpers";
import { showConfirmationModal } from "../../modals/ConfirmationModal";
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
} from "../components/CardComponent";

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
				descEl.createSpan({ text: translate("settings.integrations.mdbaseSpec.enable.description") + " " });
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
				setting.setDesc("Connect your Google Calendar or Microsoft Outlook to sync events directly into TaskNotes.");
				const descEl = setting.descEl;
				descEl.createSpan({ text: " You'll need to create OAuth credentials with Google and/or Microsoft. This takes approximately 15 minutes for initial setup. " });
				const link = descEl.createEl("a", {
					text: "View Calendar Setup Guide",
					href: "https://callumalpass.github.io/tasknotes/calendar-setup",
				});
				link.setAttr("target", "_blank");
			});
		}
	);

	// TaskNotes License Card (appears before calendar cards)
	// TEMPORARILY DISABLED FOR BETA RELEASE
	// const licenseContainer = container.createDiv("tasknotes-license-container");

	/* const renderLicenseCard = async () => {
		licenseContainer.empty();

		// Setup mode toggle
		const modeToggleContainer = document.createElement("div");
		modeToggleContainer.style.cssText = `
			display: flex;
			gap: 8px;
			margin-bottom: 16px;
			padding: 4px;
			background: var(--background-secondary);
			border-radius: 6px;
			width: fit-content;
		`;

		const createModeButton = (mode: "quick" | "advanced", label: string, icon: string) => {
			const button = document.createElement("button");
			button.className = "tasknotes-mode-toggle-button";
			const isActive = plugin.settings.oauthSetupMode === mode;

			button.style.cssText = `
				padding: 8px 16px;
				border: none;
				border-radius: 4px;
				cursor: pointer;
				font-size: 0.9em;
				font-weight: 500;
				display: flex;
				align-items: center;
				gap: 6px;
				transition: all 0.2s;
				background: ${isActive ? 'var(--interactive-accent)' : 'transparent'};
				color: ${isActive ? 'var(--text-on-accent)' : 'var(--text-normal)'};
			`;

			// Add icon
			const iconEl = document.createElement("span");
			iconEl.textContent = icon;
			button.appendChild(iconEl);

			// Add label
			const labelEl = document.createElement("span");
			labelEl.textContent = label;
			button.appendChild(labelEl);

			button.addEventListener("click", () => {
				plugin.settings.oauthSetupMode = mode;
				save();
				// Reload OAuth credentials when mode changes
				if (plugin.oauthService) {
					plugin.oauthService.loadClientIds();
				}
				renderLicenseCard(); // Re-render to update UI
				// Also re-render calendar cards to show/hide credential inputs
				renderGoogleCalendarCard();
				renderMicrosoftCalendarCard();
			});

			button.addEventListener("mouseenter", () => {
				if (!isActive) {
					button.style.background = "var(--background-modifier-hover)";
				}
			});

			button.addEventListener("mouseleave", () => {
				if (!isActive) {
					button.style.background = "transparent";
				}
			});

			return button;
		};

		modeToggleContainer.appendChild(createModeButton("quick", "Quick Setup", ""));
		modeToggleContainer.appendChild(createModeButton("advanced", "Advanced Setup", ""));

		// Build content based on selected mode
		const sections: any[] = [];
		const mode = plugin.settings.oauthSetupMode;

		if (mode === "quick") {
			// Quick Setup mode - show license key input
			const helpText = document.createElement("div");
			helpText.style.cssText = `
				font-size: 0.9em;
				color: var(--text-muted);
				line-height: 1.5;
				padding: 12px;
				background: var(--background-secondary);
				border-radius: 6px;
				border-left: 3px solid var(--interactive-accent);
			`;
			helpText.innerHTML = "<strong>Quick Setup</strong> - Enter your license key to connect calendars using OAuth Device Flow. This method displays a verification code that you enter on the provider's website. No OAuth application configuration is required on your part.";

			const licenseKeyInput = createCardInput("text", "TN-XXXX-XXXX-XXXX-XXXX", plugin.settings.lemonSqueezyLicenseKey);
			licenseKeyInput.addEventListener("blur", async () => {
				const newKey = licenseKeyInput.value.trim();
				plugin.settings.lemonSqueezyLicenseKey = newKey;
				save();

				// Validate license
				if (plugin.licenseService && newKey) {
					// Clear cache to force fresh validation
					plugin.licenseService.clearCache();
					const valid = await plugin.licenseService.validateLicense(newKey);
					if (valid) {
						new Notice("License activated successfully!");
						// Reload OAuth credentials
						if (plugin.oauthService) {
							await plugin.oauthService.loadClientIds();
						}
						// Re-render to update status
						renderLicenseCard();
					} else {
						new Notice("Invalid or expired license key");
						// Re-render to update status
						renderLicenseCard();
					}
				} else if (plugin.oauthService) {
					// Key was cleared, reload OAuth credentials
					await plugin.oauthService.loadClientIds();
					// Re-render to update status
					renderLicenseCard();
				}
			});

			const getLicenseLink = document.createElement("a");
			getLicenseLink.href = "https://tasknotes.lemonsqueezy.com";
			getLicenseLink.target = "_blank";
			getLicenseLink.style.fontSize = "0.9em";
			getLicenseLink.style.color = "var(--interactive-accent)";
			getLicenseLink.textContent = "Get License Key ($2/month)";

			// Status indicator
			const statusDiv = document.createElement("div");
			statusDiv.style.fontSize = "0.85em";
			statusDiv.style.marginTop = "0.5rem";

			const currentKey = plugin.settings.lemonSqueezyLicenseKey;
			if (currentKey && currentKey.trim()) {
				// Check cached validation status
				const cachedInfo = plugin.licenseService?.getCachedLicenseInfo();
				if (cachedInfo && cachedInfo.key === currentKey && Date.now() < cachedInfo.validUntil) {
					if (cachedInfo.valid) {
						statusDiv.style.color = "var(--text-success)";
						statusDiv.textContent = "License active - valid on unlimited devices";
					} else {
						statusDiv.style.color = "var(--text-error)";
						statusDiv.textContent = "Invalid or expired license key";
					}
				} else {
					statusDiv.style.color = "var(--text-muted)";
					statusDiv.textContent = "License key entered (validation pending)";
				}
			} else {
				statusDiv.style.color = "var(--text-muted)";
				statusDiv.style.fontStyle = "italic";
				statusDiv.textContent = "Enter your license key to enable instant calendar connection.";
			}

			sections.push({
				rows: [
					{ label: "", input: helpText, fullWidth: true }
				]
			});

			const quickSetupGuideLink = document.createElement("a");
			quickSetupGuideLink.href = "https://callumalpass.github.io/tasknotes/calendar-setup";
			quickSetupGuideLink.target = "_blank";
			quickSetupGuideLink.style.fontSize = "0.9em";
			quickSetupGuideLink.style.color = "var(--interactive-accent)";
			quickSetupGuideLink.style.marginTop = "0.5rem";
			quickSetupGuideLink.style.display = "inline-block";
			quickSetupGuideLink.textContent = "View Calendar Setup Guide";

			sections.push({
				rows: [
					{ label: "License Key:", input: licenseKeyInput },
					{ label: "", input: getLicenseLink, fullWidth: true },
					{ label: "", input: statusDiv, fullWidth: true },
					{ label: "", input: quickSetupGuideLink, fullWidth: true }
				]
			});

		} else {
			// Advanced Setup mode - show instructions only (credentials are per-calendar now)
			const helpText = document.createElement("div");
			helpText.style.cssText = `
				font-size: 0.9em;
				color: var(--text-muted);
				line-height: 1.5;
				padding: 12px;
				background: var(--background-secondary);
				border-radius: 6px;
				border-left: 3px solid var(--color-orange);
			`;
			helpText.innerHTML = "<strong>Advanced Setup</strong> - Configure your own OAuth credentials for calendar integration. This requires creating an OAuth application with the calendar provider and entering the Client ID and Secret in each calendar card below. Initial setup takes approximately 15 minutes.<br><br><strong>Benefits of Advanced Setup:</strong><br>• No license subscription required<br>• Uses your own API quota allocation<br>• Direct connection between Obsidian and calendar provider<br>• Complete data privacy (no intermediary servers)";

			const setupGuideLink = document.createElement("a");
			setupGuideLink.href = "https://callumalpass.github.io/tasknotes/calendar-setup";
			setupGuideLink.target = "_blank";
			setupGuideLink.style.fontSize = "0.9em";
			setupGuideLink.style.color = "var(--interactive-accent)";
			setupGuideLink.textContent = "View Calendar Setup Guide";

			sections.push({
				rows: [
					{ label: "", input: helpText, fullWidth: true },
					{ label: "", input: setupGuideLink, fullWidth: true }
				]
			});
		}

		// Determine status badge
		let statusBadge;
		if (mode === "quick") {
			const hasKey = plugin.settings.lemonSqueezyLicenseKey && plugin.settings.lemonSqueezyLicenseKey.trim();
			statusBadge = hasKey ? createStatusBadge("License Active", "active") : createStatusBadge("No License", "inactive");
		} else {
			statusBadge = createStatusBadge("Advanced Mode", "default");
		}

		// Create the card
		const card = createCard(licenseContainer, {
			collapsible: true,
			defaultCollapsed: false,
			colorIndicator: {
				color: mode === "quick" ? "#4A9EFF" : "#FF8C00" // Blue for quick, orange for advanced
			},
			header: {
				primaryText: "OAuth Calendar Setup",
				secondaryText: mode === "quick" ? "License-based instant setup" : "Bring your own OAuth credentials",
				meta: [statusBadge]
			},
			content: {
				sections: sections
			}
		});

		// Insert mode toggle before the card
		licenseContainer.insertBefore(modeToggleContainer, card);
	}; */

	// Initial render
	// TEMPORARILY DISABLED FOR BETA RELEASE
	// renderLicenseCard();

	// Google Calendar container for card-based UI
	const googleCalendarContainer = container.createDiv("google-calendar-integration-container");

	// Check connection status and render card
	const renderGoogleCalendarCard = async () => {
		googleCalendarContainer.empty();

		if (!plugin.oauthService) {
			const errorCard = createCard(googleCalendarContainer, {
				header: {
					primaryText: "Google Calendar",
					secondaryText: "OAuth service not available",
					meta: [createStatusBadge("Error", "inactive")]
				}
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
			const connectedInfo = document.createElement("div");
			connectedInfo.className = "tasknotes-calendar-info";
			connectedInfo.textContent = connectedDate ? `Connected ${timeAgo}` : "Connected";

			const lastRefreshInfo = document.createElement("div");
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
					color: "#4285F4" // Google blue
				},
				header: {
					primaryText: "Google Calendar",
					secondaryText: "OAuth 2.0 Connection",
					meta: [createStatusBadge("Connected", "active")]
				},
				content: {
					sections: [{
						rows: [
							{ label: "Status:", input: connectedInfo },
							{ label: "Sync:", input: lastRefreshInfo }
						]
					}]
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
										new Notice("Google Calendar refreshed successfully");
										renderGoogleCalendarCard(); // Re-render to update timestamp
									}
								} catch (error) {
									console.error("Failed to refresh:", error);
									new Notice("Failed to refresh Google Calendar");
								}
							}
						},
						{
							text: "Disconnect",
							icon: "log-out",
							variant: "warning",
							onClick: async () => {
								try {
									await plugin.oauthService!.disconnect("google");
									new Notice("Disconnected from Google Calendar");
									renderGoogleCalendarCard(); // Re-render to show disconnected state
								} catch (error) {
									console.error("Failed to disconnect:", error);
									new Notice("Failed to disconnect from Google Calendar");
								}
							}
						}
					]
				}
			});
		} else {
			// Disconnected state card
			const helpText = document.createElement("div");
			helpText.className = "tasknotes-calendar-help";
			helpText.innerHTML = "Connect your Google Calendar account to sync events directly into TaskNotes. Events will automatically refresh every 15 minutes.";

			// Build sections based on setup mode
			const sections: any[] = [
				{
					rows: [
						{ label: "Info:", input: helpText, fullWidth: true }
					]
				}
			];

			// Only show credential inputs in Advanced mode
			// TEMPORARILY FORCING ADVANCED MODE FOR BETA RELEASE
			if (true) { // if (plugin.settings.oauthSetupMode === "advanced") {
				// Create credential input fields
				const clientIdInput = createCardInput("text", "your-client-id.apps.googleusercontent.com", plugin.settings.googleOAuthClientId);
				clientIdInput.addEventListener("blur", async () => {
					plugin.settings.googleOAuthClientId = clientIdInput.value.trim();
					save();
					if (plugin.oauthService) {
						await plugin.oauthService.loadClientIds();
					}
				});

				const clientSecretInput = createCardInput("text", "your-client-secret", plugin.settings.googleOAuthClientSecret);
				clientSecretInput.setAttribute("type", "password");
				clientSecretInput.addEventListener("blur", async () => {
					plugin.settings.googleOAuthClientSecret = clientSecretInput.value.trim();
					save();
					if (plugin.oauthService) {
						await plugin.oauthService.loadClientIds();
					}
				});

				const credentialNote = document.createElement("div");
				credentialNote.className = "tasknotes-credential-note";
				credentialNote.textContent = "Enter your OAuth app credentials from Google Cloud Console.";

				sections.push({
					rows: [
						{ label: "Client ID:", input: clientIdInput },
						{ label: "Client Secret:", input: clientSecretInput },
						{ label: "", input: credentialNote, fullWidth: true }
					]
				});
			} else {
				// Quick mode - show reminder about license
				// TEMPORARILY DISABLED FOR BETA RELEASE
				/* const quickModeNote = document.createElement("div");
				quickModeNote.style.fontSize = "0.85em";
				quickModeNote.style.color = "var(--text-accent)";
				quickModeNote.style.fontStyle = "italic";
				quickModeNote.style.padding = "8px";
				quickModeNote.style.background = "var(--background-secondary)";
				quickModeNote.style.borderRadius = "4px";
				quickModeNote.textContent = "Note: A valid license key is required above. Click Connect to authenticate using OAuth Device Flow.";

				sections.push({
					rows: [
						{ label: "", input: quickModeNote, fullWidth: true }
					]
				}); */
			}

			createCard(googleCalendarContainer, {
				collapsible: true,
				defaultCollapsed: false,
				colorIndicator: {
					color: "#9AA0A6" // Google gray
				},
				header: {
					primaryText: "Google Calendar",
					secondaryText: "OAuth 2.0 Connection",
					meta: [createStatusBadge("Not Connected", "inactive")]
				},
				content: {
					sections: sections
				},
				actions: {
					buttons: [
						{
							text: "Connect Google Calendar",
							icon: "link",
							variant: "primary",
							onClick: async () => {
								try {
									await plugin.oauthService!.authenticate("google");
									new Notice("Google Calendar connected successfully!");
									renderGoogleCalendarCard(); // Re-render to show connected state
								} catch (error) {
									console.error("Failed to connect:", error);
									new Notice(`Failed to connect: ${error.message}`);
								}
							}
						}
					]
				}
			});
		}
	};

	// Initial render
	renderGoogleCalendarCard();

	// Microsoft Calendar container for card-based UI
	const microsoftCalendarContainer = container.createDiv("microsoft-calendar-integration-container");

	// Check connection status and render card
	const renderMicrosoftCalendarCard = async () => {
		microsoftCalendarContainer.empty();

		if (!plugin.oauthService) {
			createCard(microsoftCalendarContainer, {
				header: {
					primaryText: "Microsoft Outlook Calendar",
					secondaryText: "OAuth service not available",
					meta: [createStatusBadge("Error", "inactive")]
				}
			});
			return;
		}

		const isConnected = await plugin.oauthService.isConnected("microsoft");
		const connection = isConnected ? await plugin.oauthService.getConnection("microsoft") : null;

		if (isConnected && connection) {
			// Connected state card
			const connectedDate = connection.connectedAt ? new Date(connection.connectedAt) : null;
			const timeAgo = connectedDate ? getRelativeTime(connectedDate, translate) : "";

			// Create info displays
			const connectedInfo = document.createElement("div");
			connectedInfo.className = "tasknotes-calendar-info";
			connectedInfo.textContent = connectedDate ? `Connected ${timeAgo}` : "Connected";

			const lastRefreshInfo = document.createElement("div");
			lastRefreshInfo.className = "tasknotes-calendar-info";
			if (connection.lastRefreshed) {
				const lastRefreshDate = new Date(connection.lastRefreshed);
				lastRefreshInfo.textContent = `Last refreshed ${getRelativeTime(lastRefreshDate, translate)}`;
			} else {
				lastRefreshInfo.textContent = "Never refreshed";
			}

			createCard(microsoftCalendarContainer, {
				collapsible: true,
				defaultCollapsed: false,
				colorIndicator: {
					color: "#0078D4" // Microsoft blue
				},
				header: {
					primaryText: "Microsoft Outlook Calendar",
					secondaryText: "OAuth 2.0 Connection",
					meta: [createStatusBadge("Connected", "active")]
				},
				content: {
					sections: [{
						rows: [
							{ label: "Status:", input: connectedInfo },
							{ label: "Sync:", input: lastRefreshInfo }
						]
					}]
				},
				actions: {
					buttons: [
						{
							text: "Disconnect",
							icon: "log-out",
							variant: "warning",
							onClick: async () => {
								try {
									await plugin.oauthService!.disconnect("microsoft");
									new Notice("Disconnected from Microsoft Calendar");
									renderMicrosoftCalendarCard();
								} catch (error) {
									console.error("Failed to disconnect:", error);
									new Notice("Failed to disconnect from Microsoft Calendar");
								}
							}
						}
					]
				}
			});
		} else {
			// Disconnected state card
			const helpText = document.createElement("div");
			helpText.className = "tasknotes-calendar-help";
			helpText.innerHTML = "Connect your Microsoft Outlook calendar to sync events directly into TaskNotes.";

			// Build sections based on setup mode
			const sections: any[] = [
				{
					rows: [
						{ label: "Info:", input: helpText, fullWidth: true }
					]
				}
			];

			// Only show credential inputs in Advanced mode
			// TEMPORARILY FORCING ADVANCED MODE FOR BETA RELEASE
			if (true) { // if (plugin.settings.oauthSetupMode === "advanced") {
				// Create credential input fields
				const clientIdInput = createCardInput("text", "your-microsoft-client-id", plugin.settings.microsoftOAuthClientId);
				clientIdInput.addEventListener("blur", async () => {
					plugin.settings.microsoftOAuthClientId = clientIdInput.value.trim();
					save();
					if (plugin.oauthService) {
						await plugin.oauthService.loadClientIds();
					}
				});

				const clientSecretInput = createCardInput("text", "your-microsoft-client-secret", plugin.settings.microsoftOAuthClientSecret);
				clientSecretInput.setAttribute("type", "password");
				clientSecretInput.addEventListener("blur", async () => {
					plugin.settings.microsoftOAuthClientSecret = clientSecretInput.value.trim();
					save();
					if (plugin.oauthService) {
						await plugin.oauthService.loadClientIds();
					}
				});

				const credentialNote = document.createElement("div");
				credentialNote.className = "tasknotes-credential-note";
				credentialNote.textContent = "Enter your OAuth app credentials from Azure Portal.";

				sections.push({
					rows: [
						{ label: "Client ID:", input: clientIdInput },
						{ label: "Client Secret:", input: clientSecretInput },
						{ label: "", input: credentialNote, fullWidth: true }
					]
				});
			} else {
				// Quick mode - show reminder about license
				// TEMPORARILY DISABLED FOR BETA RELEASE
				/* const quickModeNote = document.createElement("div");
				quickModeNote.style.fontSize = "0.85em";
				quickModeNote.style.color = "var(--text-accent)";
				quickModeNote.style.fontStyle = "italic";
				quickModeNote.style.padding = "8px";
				quickModeNote.style.background = "var(--background-secondary)";
				quickModeNote.style.borderRadius = "4px";
				quickModeNote.textContent = "Note: A valid license key is required above. Click Connect to authenticate using OAuth Device Flow.";

				sections.push({
					rows: [
						{ label: "", input: quickModeNote, fullWidth: true }
					]
				}); */
			}

			createCard(microsoftCalendarContainer, {
				collapsible: true,
				defaultCollapsed: false,
				colorIndicator: {
					color: "#737373" // Microsoft gray
				},
				header: {
					primaryText: "Microsoft Outlook Calendar",
					secondaryText: "OAuth 2.0 Connection",
					meta: [createStatusBadge("Not Connected", "inactive")]
				},
				content: {
					sections: sections
				},
				actions: {
					buttons: [
						{
							text: "Connect Microsoft Calendar",
							icon: "link",
							variant: "primary",
							onClick: async () => {
								try {
									await plugin.oauthService!.authenticate("microsoft");
									new Notice("Microsoft Calendar connected successfully!");
									renderMicrosoftCalendarCard();
								} catch (error) {
									console.error("Failed to connect:", error);
									new Notice(`Failed to connect: ${error.message}`);
								}
							}
						}
					]
				}
			});
		}
	};

	// Initial render
	renderMicrosoftCalendarCard();

	// Google Calendar Task Export Section
	createSettingGroup(
		container,
		{
			heading: translate("settings.integrations.googleCalendarExport.header"),
			description: translate("settings.integrations.googleCalendarExport.description"),
		},
		(group) => {
			// Master toggle
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.integrations.googleCalendarExport.enable.name"),
					desc: translate("settings.integrations.googleCalendarExport.enable.description"),
					getValue: () => plugin.settings.googleCalendarExport.enabled,
					setValue: async (value: boolean) => {
						plugin.settings.googleCalendarExport.enabled = value;
						save();
					},
				})
			);

			// Target calendar dropdown (populated dynamically)
			group.addSetting((setting) => {
				setting.setName(translate("settings.integrations.googleCalendarExport.targetCalendar.name"));
				setting.setDesc(translate("settings.integrations.googleCalendarExport.targetCalendar.description"));

				const dropdown = setting.controlEl.createEl("select", {
					cls: "dropdown",
				});
				dropdown.style.width = "200px";

				// Add placeholder option
				const placeholderOption = dropdown.createEl("option", {
					text: translate("settings.integrations.googleCalendarExport.targetCalendar.placeholder"),
					value: "",
				});

				// Populate calendars if connected
				const populateCalendars = async () => {
					// Clear existing options except placeholder
					while (dropdown.options.length > 1) {
						dropdown.remove(1);
					}

					const isConnected = plugin.oauthService && await plugin.oauthService.isConnected("google");
					if (isConnected && plugin.googleCalendarService) {
						const calendars = plugin.googleCalendarService.getAvailableCalendars();
						for (const cal of calendars) {
							const option = dropdown.createEl("option", {
								text: cal.summary + (cal.primary ? translate("settings.integrations.googleCalendarExport.targetCalendar.primarySuffix") : ""),
								value: cal.id,
							});
							if (cal.id === plugin.settings.googleCalendarExport.targetCalendarId) {
								option.selected = true;
							}
						}
					} else {
						dropdown.createEl("option", {
							text: translate("settings.integrations.googleCalendarExport.targetCalendar.connectFirst"),
							value: "",
						});
					}
				};

				populateCalendars();

				// Re-populate when calendar data is fetched after startup
				plugin.googleCalendarService?.on("data-changed", populateCalendars);

				dropdown.addEventListener("change", async () => {
					plugin.settings.googleCalendarExport.targetCalendarId = dropdown.value;
					save();
				});

				return setting;
			});

			// Sync trigger
			group.addSetting((setting) =>
				configureDropdownSetting(setting, {
					name: translate("settings.integrations.googleCalendarExport.syncTrigger.name"),
					desc: translate("settings.integrations.googleCalendarExport.syncTrigger.description"),
					options: [
						{ value: "scheduled", label: translate("settings.integrations.googleCalendarExport.syncTrigger.options.scheduled") },
						{ value: "due", label: translate("settings.integrations.googleCalendarExport.syncTrigger.options.due") },
						{ value: "both", label: translate("settings.integrations.googleCalendarExport.syncTrigger.options.both") },
					],
					getValue: () => plugin.settings.googleCalendarExport.syncTrigger,
					setValue: async (value: string) => {
						plugin.settings.googleCalendarExport.syncTrigger = value as "scheduled" | "due" | "both";
						save();
					},
				})
			);

			// Create as all-day
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.integrations.googleCalendarExport.allDayEvents.name"),
					desc: translate("settings.integrations.googleCalendarExport.allDayEvents.description"),
					getValue: () => plugin.settings.googleCalendarExport.createAsAllDay,
					setValue: async (value: boolean) => {
						plugin.settings.googleCalendarExport.createAsAllDay = value;
						save();
					},
				})
			);

			// Default duration (only relevant for timed events)
			group.addSetting((setting) =>
				configureNumberSetting(setting, {
					name: translate("settings.integrations.googleCalendarExport.defaultDuration.name"),
					desc: translate("settings.integrations.googleCalendarExport.defaultDuration.description"),
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
			group.addSetting((setting) =>
				configureTextSetting(setting, {
					name: translate("settings.integrations.googleCalendarExport.eventTitleTemplate.name"),
					desc: translate("settings.integrations.googleCalendarExport.eventTitleTemplate.description"),
					placeholder: translate("settings.integrations.googleCalendarExport.eventTitleTemplate.placeholder"),
					getValue: () => plugin.settings.googleCalendarExport.eventTitleTemplate,
					setValue: async (value: string) => {
						plugin.settings.googleCalendarExport.eventTitleTemplate = value || "{{title}}";
						save();
					},
				})
			);

			// Include description
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.integrations.googleCalendarExport.includeDescription.name"),
					desc: translate("settings.integrations.googleCalendarExport.includeDescription.description"),
					getValue: () => plugin.settings.googleCalendarExport.includeDescription,
					setValue: async (value: boolean) => {
						plugin.settings.googleCalendarExport.includeDescription = value;
						save();
					},
				})
			);

			// Include Obsidian link
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.integrations.googleCalendarExport.includeObsidianLink.name"),
					desc: translate("settings.integrations.googleCalendarExport.includeObsidianLink.description"),
					getValue: () => plugin.settings.googleCalendarExport.includeObsidianLink,
					setValue: async (value: boolean) => {
						plugin.settings.googleCalendarExport.includeObsidianLink = value;
						save();
					},
				})
			);

			// Default reminder minutes
			group.addSetting((setting) =>
				configureNumberSetting(setting, {
					name: translate("settings.integrations.googleCalendarExport.defaultReminder.name"),
					desc: translate("settings.integrations.googleCalendarExport.defaultReminder.description"),
					getValue: () => plugin.settings.googleCalendarExport.defaultReminderMinutes ?? 0,
					setValue: async (value: number) => {
						plugin.settings.googleCalendarExport.defaultReminderMinutes = value === 0 ? null : value;
						save();
					},
					min: 0,
					max: 40320, // 4 weeks in minutes (Google Calendar API limit)
				})
			);

			// Sync behavior toggles - section header
			group.addSetting((setting) => {
				setting.setName(translate("settings.integrations.googleCalendarExport.automaticSyncBehavior.header"));
				setting.setHeading();
			});

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.integrations.googleCalendarExport.syncOnCreate.name"),
					desc: translate("settings.integrations.googleCalendarExport.syncOnCreate.description"),
					getValue: () => plugin.settings.googleCalendarExport.syncOnTaskCreate,
					setValue: async (value: boolean) => {
						plugin.settings.googleCalendarExport.syncOnTaskCreate = value;
						save();
					},
				})
			);

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.integrations.googleCalendarExport.syncOnUpdate.name"),
					desc: translate("settings.integrations.googleCalendarExport.syncOnUpdate.description"),
					getValue: () => plugin.settings.googleCalendarExport.syncOnTaskUpdate,
					setValue: async (value: boolean) => {
						plugin.settings.googleCalendarExport.syncOnTaskUpdate = value;
						save();
					},
				})
			);

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.integrations.googleCalendarExport.syncOnComplete.name"),
					desc: translate("settings.integrations.googleCalendarExport.syncOnComplete.description"),
					getValue: () => plugin.settings.googleCalendarExport.syncOnTaskComplete,
					setValue: async (value: boolean) => {
						plugin.settings.googleCalendarExport.syncOnTaskComplete = value;
						save();
					},
				})
			);

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.integrations.googleCalendarExport.syncOnDelete.name"),
					desc: translate("settings.integrations.googleCalendarExport.syncOnDelete.description"),
					getValue: () => plugin.settings.googleCalendarExport.syncOnTaskDelete,
					setValue: async (value: boolean) => {
						plugin.settings.googleCalendarExport.syncOnTaskDelete = value;
						save();
					},
				})
			);

			// Manual sync actions - section header
			group.addSetting((setting) => {
				setting.setName(translate("settings.integrations.googleCalendarExport.manualSyncActions.header"));
				setting.setHeading();
			});

			group.addSetting((setting) =>
				configureButtonSetting(setting, {
					name: translate("settings.integrations.googleCalendarExport.syncAllTasks.name"),
					desc: translate("settings.integrations.googleCalendarExport.syncAllTasks.description"),
					buttonText: translate("settings.integrations.googleCalendarExport.syncAllTasks.buttonText"),
					onClick: async () => {
						if (!plugin.taskCalendarSyncService?.isEnabled()) {
							new Notice(translate("settings.integrations.googleCalendarExport.notices.notEnabledOrConfigured"));
							return;
						}
						const results = await plugin.taskCalendarSyncService.syncAllTasks();
						new Notice(translate("settings.integrations.googleCalendarExport.notices.syncResults", {
							synced: results.synced,
							failed: results.failed,
							skipped: results.skipped,
						}));
					},
				})
			);

			group.addSetting((setting) =>
				configureButtonSetting(setting, {
					name: translate("settings.integrations.googleCalendarExport.unlinkAllTasks.name"),
					desc: translate("settings.integrations.googleCalendarExport.unlinkAllTasks.description"),
					buttonText: translate("settings.integrations.googleCalendarExport.unlinkAllTasks.buttonText"),
					onClick: async () => {
						if (!plugin.taskCalendarSyncService) {
							new Notice(translate("settings.integrations.googleCalendarExport.notices.serviceNotAvailable"));
							return;
						}
						const confirmed = await showConfirmationModal(plugin.app, {
							title: translate("settings.integrations.googleCalendarExport.unlinkAllTasks.confirmTitle"),
							message: translate("settings.integrations.googleCalendarExport.unlinkAllTasks.confirmMessage"),
							confirmText: translate("settings.integrations.googleCalendarExport.unlinkAllTasks.confirmButtonText"),
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
			group.addSetting((setting) =>
				configureTextSetting(setting, {
					name: translate("settings.integrations.calendarSubscriptions.defaultNoteTemplate.name"),
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

			group.addSetting((setting) =>
				configureTextSetting(setting, {
					name: translate("settings.integrations.calendarSubscriptions.defaultNoteFolder.name"),
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

			group.addSetting((setting) =>
				configureDropdownSetting(setting, {
					name: translate("settings.integrations.calendarSubscriptions.filenameFormat.name"),
					desc: translate("settings.integrations.calendarSubscriptions.filenameFormat.description"),
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
						plugin.settings.icsIntegration.icsNoteFilenameFormat = value as any;
						save();
						// Re-render to show custom template field if needed
						renderIntegrationsTab(container, plugin, save);
					},
				})
			);

			if (plugin.settings.icsIntegration.icsNoteFilenameFormat === "custom") {
				group.addSetting((setting) =>
					configureTextSetting(setting, {
						name: translate("settings.integrations.calendarSubscriptions.customTemplate.name"),
						desc: translate(
							"settings.integrations.calendarSubscriptions.customTemplate.description"
						),
						placeholder: translate(
							"settings.integrations.calendarSubscriptions.customTemplate.placeholder"
						),
						getValue: () => plugin.settings.icsIntegration.customICSNoteFilenameTemplate,
						setValue: async (value: string) => {
							plugin.settings.icsIntegration.customICSNoteFilenameTemplate = value;
							save();
						},
					})
				);
			}

			// Task creation settings
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.integrations.calendarSubscriptions.useICSEndAsDue.name"),
					desc: translate("settings.integrations.calendarSubscriptions.useICSEndAsDue.description"),
					getValue: () => plugin.settings.icsIntegration.useICSEndAsDue ?? false,
					setValue: async (value: boolean) => {
						plugin.settings.icsIntegration.useICSEndAsDue = value;
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
			group.addSetting((setting) =>
				configureButtonSetting(setting, {
					name: translate("settings.integrations.subscriptionsList.addSubscription.name"),
					desc: translate("settings.integrations.subscriptionsList.addSubscription.description"),
					buttonText: translate("settings.integrations.subscriptionsList.addSubscription.buttonText"),
					onClick: async () => {
						// Create a new subscription with temporary values
						const newSubscription = {
							name: translate("settings.integrations.subscriptionsList.newCalendarName"),
							url: "",
							color: "#6366f1",
							enabled: false, // Start disabled until user fills in details
							type: "remote" as const,
							refreshInterval: 60,
						};

						if (!plugin.icsSubscriptionService) {
							new Notice(
								translate("settings.integrations.subscriptionsList.notices.serviceUnavailable")
							);
							return;
						}

						try {
							await plugin.icsSubscriptionService.addSubscription(newSubscription);
							new Notice(translate("settings.integrations.subscriptionsList.notices.addSuccess"));
							// Re-render to show the new subscription card
							renderICSSubscriptionsList(icsContainer, plugin, save);
						} catch (error) {
							console.error("Error adding subscription:", error);
							new Notice(translate("settings.integrations.subscriptionsList.notices.addFailure"));
						}
					},
				})
			);

			// Refresh all subscriptions button
			group.addSetting((setting) =>
				configureButtonSetting(setting, {
					name: translate("settings.integrations.subscriptionsList.refreshAll.name"),
					desc: translate("settings.integrations.subscriptionsList.refreshAll.description"),
					buttonText: translate("settings.integrations.subscriptionsList.refreshAll.buttonText"),
					onClick: async () => {
						if (plugin.icsSubscriptionService) {
							try {
								await plugin.icsSubscriptionService.refreshAllSubscriptions();
								new Notice(
									translate("settings.integrations.subscriptionsList.notices.refreshSuccess")
								);
							} catch (error) {
								console.error("Error refreshing subscriptions:", error);
								new Notice(
									translate("settings.integrations.subscriptionsList.notices.refreshFailure")
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
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.integrations.autoExport.enable.name"),
					desc: translate("settings.integrations.autoExport.enable.description"),
					getValue: () => plugin.settings.icsIntegration.enableAutoExport,
					setValue: async (value: boolean) => {
						plugin.settings.icsIntegration.enableAutoExport = value;
						save();
						new Notice(translate("settings.integrations.autoExport.notices.reloadRequired"));
						// Re-render to show/hide export settings
						renderIntegrationsTab(container, plugin, save);
					},
				})
			);

			if (plugin.settings.icsIntegration.enableAutoExport) {
				group.addSetting((setting) =>
					configureTextSetting(setting, {
						name: translate("settings.integrations.autoExport.filePath.name"),
						desc: translate("settings.integrations.autoExport.filePath.description"),
						placeholder: translate("settings.integrations.autoExport.filePath.placeholder"),
						getValue: () => plugin.settings.icsIntegration.autoExportPath,
						setValue: async (value: string) => {
							plugin.settings.icsIntegration.autoExportPath = value || "tasknotes-calendar.ics";
							save();
						},
					})
				);

				group.addSetting((setting) =>
					configureNumberSetting(setting, {
						name: translate("settings.integrations.autoExport.interval.name"),
						desc: translate("settings.integrations.autoExport.interval.description"),
						placeholder: translate("settings.integrations.autoExport.interval.placeholder"),
						min: 5,
						max: 1440, // 24 hours max
						getValue: () => plugin.settings.icsIntegration.autoExportInterval,
						setValue: async (value: number) => {
							plugin.settings.icsIntegration.autoExportInterval = Math.max(5, value || 60);
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

				group.addSetting((setting) =>
					configureToggleSetting(setting, {
						name: translate("settings.integrations.autoExport.useDuration.name"),
						desc: translate("settings.integrations.autoExport.useDuration.description"),
						getValue: () => plugin.settings.icsIntegration.useDurationForExport ?? false,
						setValue: async (value: boolean) => {
							plugin.settings.icsIntegration.useDurationForExport = value;
							save();
						},
					})
				);

				// Manual export trigger button
				group.addSetting((setting) =>
					configureButtonSetting(setting, {
						name: translate("settings.integrations.autoExport.exportNow.name"),
						desc: translate("settings.integrations.autoExport.exportNow.description"),
						buttonText: translate("settings.integrations.autoExport.exportNow.buttonText"),
						onClick: async () => {
							if (plugin.autoExportService) {
								try {
									await plugin.autoExportService.exportNow();
									new Notice(
										translate("settings.integrations.autoExport.notices.exportSuccess")
									);
									// Re-render to update status
									renderIntegrationsTab(container, plugin, save);
								} catch (error) {
									console.error("Manual export failed:", error);
									new Notice(
										translate("settings.integrations.autoExport.notices.exportFailure")
									);
								}
							} else {
								new Notice(
									translate("settings.integrations.autoExport.notices.serviceUnavailable")
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
							? translate("settings.integrations.autoExport.status.lastExport", { time: lastExport.toLocaleString() })
							: translate("settings.integrations.autoExport.status.noExports");
						const nextExportText = nextExport
							? translate("settings.integrations.autoExport.status.nextExport", { time: nextExport.toLocaleString() })
							: translate("settings.integrations.autoExport.status.notScheduled");

						descEl.textContent = lastExportText + "\n" + nextExportText;
					} else {
						descEl.textContent = translate("settings.integrations.autoExport.status.serviceNotInitialized");
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
				group.addSetting((setting) =>
					configureToggleSetting(setting, {
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
					group.addSetting((setting) =>
						configureNumberSetting(setting, {
							name: translate("settings.integrations.httpApi.port.name"),
							desc: translate("settings.integrations.httpApi.port.description"),
							placeholder: translate("settings.integrations.httpApi.port.placeholder"),
							min: 1024,
							max: 65535,
							getValue: () => plugin.settings.apiPort,
							setValue: async (value: number) => {
								plugin.settings.apiPort = value;
								save();
							},
						})
					);

					group.addSetting((setting) =>
						configureTextSetting(setting, {
							name: translate("settings.integrations.httpApi.authToken.name"),
							desc: translate("settings.integrations.httpApi.authToken.description"),
							placeholder: translate("settings.integrations.httpApi.authToken.placeholder"),
							getValue: () => plugin.settings.apiAuthToken,
							setValue: async (value: string) => {
								plugin.settings.apiAuthToken = value;
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
			apiEndpointsContent.style.display = "none"; // Start collapsed

			// Toggle functionality
			apiHeader.addEventListener("click", () => {
				const isExpanded = apiEndpointsContent.style.display !== "none";
				apiEndpointsContent.style.display = isExpanded ? "none" : "block";
				apiToggleIcon.textContent = isExpanded
					? translate("settings.integrations.httpApi.endpoints.expandIcon")
					: translate("settings.integrations.httpApi.endpoints.collapseIcon");
			});

			// Fetch live API documentation
			loadAPIEndpoints(apiEndpointsContent, plugin.settings.apiPort);
		}

		// Webhooks Section
		createSettingGroup(
			container,
			{
				heading: translate("settings.integrations.webhooks.header"),
				description: translate("settings.integrations.webhooks.description.overview") + " " + translate("settings.integrations.webhooks.description.usage"),
			},
			(group) => {
				// Add webhook button
				group.addSetting((setting) =>
					configureButtonSetting(setting, {
						name: translate("settings.integrations.webhooks.addWebhook.name"),
						desc: translate("settings.integrations.webhooks.addWebhook.description"),
						buttonText: translate("settings.integrations.webhooks.addWebhook.buttonText"),
						onClick: async () => {
							const modal = new WebhookModal(
								plugin.app,
								async (webhookConfig: Partial<WebhookConfig>) => {
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
									new Notice(translate("settings.integrations.webhooks.notices.created"));
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
		const typeSelect = document.createElement("select");
		typeSelect.className = "tasknotes-settings__card-input";

		const remoteOption = document.createElement("option");
		remoteOption.value = "remote";
		remoteOption.textContent = "Remote URL";
		remoteOption.selected = subscription.type === "remote";
		typeSelect.appendChild(remoteOption);

		const localOption = document.createElement("option");
		localOption.value = "local";
		localOption.textContent = "Local File";
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

		const colorInput = createCardInput("color", "", subscription.color);
		const refreshInput = createCardNumberInput(5, 1440, 5, subscription.refreshInterval || 60);

		// Update handlers
		const updateSubscription = async (updates: Partial<typeof subscription>) => {
			try {
				await plugin.icsSubscriptionService!.updateSubscription(subscription.id, updates);
				save();
				renderICSSubscriptionsList(container, plugin, save);
			} catch (error) {
				console.error("Error updating subscription:", error);
				new Notice(
					translate("settings.integrations.subscriptionsList.notices.updateFailure")
				);
				// Revert changes if needed
				renderICSSubscriptionsList(container, plugin, save);
			}
		};

		// Update handlers (enabledToggle handler is now in createCardToggle callback)
		nameInput.addEventListener("blur", () =>
			updateSubscription({ name: nameInput.value.trim() })
		);
		colorInput.addEventListener("change", () =>
			updateSubscription({ color: colorInput.value })
		);
		refreshInput.addEventListener("blur", () => {
			const minutes = parseInt(refreshInput.value) || 60;
			updateSubscription({ refreshInterval: minutes });
		});

		// Type change handler - re-render the subscription list to update input type
		typeSelect.addEventListener("change", async () => {
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
							updateSubscription({ url: normalizedUrl });
						} else {
							updateSubscription({ filePath: value });
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

		// Source input handler (URL or file path)
		sourceInput.addEventListener("blur", () => {
			const value = (sourceInput as HTMLInputElement).value.trim();
			if (subscription.type === "remote") {
				// Normalize webcal:// and webcals:// URLs to http:// and https://
				const normalizedUrl = normalizeCalendarUrl(value);
				updateSubscription({ url: normalizedUrl });
			} else {
				updateSubscription({ filePath: value });
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
								await plugin.icsSubscriptionService!.removeSubscription(
									subscription.id
								);
								new Notice(
									translate(
										"settings.integrations.subscriptionsList.notices.deleteSuccess",
										{ name: subscription.name }
									)
								);
								save();
								renderICSSubscriptionsList(container, plugin, save);
							} catch (error) {
								console.error("Error deleting subscription:", error);
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
								await plugin.icsSubscriptionService!.refreshSubscription(
									subscription.id
								);
								new Notice(
									translate(
										"settings.integrations.subscriptionsList.notices.refreshSuccess",
										{ name: subscription.name }
									)
								);
								// Re-render to show updated sync time
								renderICSSubscriptionsList(container, plugin, save);
							} catch (error) {
								console.error("Error refreshing subscription:", error);
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
		const eventsDisplay = document.createElement("div");
		eventsDisplay.className = "tasknotes-webhook-events";

		if (webhook.events.length === 0) {
			const noEventsSpan = document.createElement("span");
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
		const transformDisplay = document.createElement("span");
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
								async (updatedConfig: Partial<WebhookConfig>) => {
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
	private selectedEvents: string[];
	private transformFile: string;
	private corsHeaders: boolean;
	private onSubmit: (config: Partial<WebhookConfig>) => void;

	constructor(
		app: App,
		webhook: WebhookConfig,
		onSubmit: (config: Partial<WebhookConfig>) => void
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
		header.createEl("h2", { text: "Edit Webhook", cls: "tasknotes-webhook-modal-title" });

		// Events selection section
		const eventsSection = contentEl.createDiv({ cls: "tasknotes-webhook-modal-section" });
		const eventsHeader = eventsSection.createDiv({
			cls: "tasknotes-webhook-modal-subsection-header",
		});
		const eventsIcon = eventsHeader.createSpan();
		setIcon(eventsIcon, "zap");
		eventsHeader.createEl("h3", { text: "Events to subscribe to" });

		const eventsGrid = eventsSection.createDiv({ cls: "tasknotes-webhook-events-list" });
		const availableEvents = [
			{ id: "task.created", label: "Task Created", desc: "When new tasks are created" },
			{ id: "task.updated", label: "Task Updated", desc: "When tasks are modified" },
			{
				id: "task.completed",
				label: "Task Completed",
				desc: "When tasks are marked complete",
			},
			{ id: "task.deleted", label: "Task Deleted", desc: "When tasks are deleted" },
			{ id: "task.archived", label: "Task Archived", desc: "When tasks are archived" },
			{ id: "task.unarchived", label: "Task Unarchived", desc: "When tasks are unarchived" },
			{ id: "time.started", label: "Time Started", desc: "When time tracking starts" },
			{ id: "time.stopped", label: "Time Stopped", desc: "When time tracking stops" },
			{
				id: "pomodoro.started",
				label: "Pomodoro Started",
				desc: "When pomodoro sessions begin",
			},
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
			{
				id: "reminder.triggered",
				label: "Reminder Triggered",
				desc: "When task reminders activate",
			},
		];

		availableEvents.forEach((event) => {
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
		transformHeader.createEl("h3", { text: "Transform Configuration (Optional)" });

		new Setting(transformSection)
			.setName("Transform File")
			.setDesc("Path to a .js or .json file in your vault that transforms webhook payloads")
			.addText((text) => {
				text.inputEl.setAttribute("aria-label", "Transform file path");
				return text
					.setPlaceholder("discord-transform.js")
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
		corsHeader.createEl("h3", { text: "Headers Configuration" });

		new Setting(corsSection)
			.setName("Include custom headers")
			.setDesc(
				"Include TaskNotes headers (event type, signature, delivery ID). Turn off for Discord, Slack, and other services with strict CORS policies."
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
			text: "Save Changes",
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

			this.onSubmit({
				events: this.selectedEvents as any[],
				transformFile: this.transformFile.trim() || undefined,
				corsHeaders: this.corsHeaders,
			});

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
	private selectedEvents: string[] = [];
	private transformFile = "";
	private corsHeaders = true;
	private onSubmit: (config: Partial<WebhookConfig>) => void;

	constructor(app: App, onSubmit: (config: Partial<WebhookConfig>) => void) {
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
		header.createEl("h2", { text: "Add Webhook", cls: "tasknotes-webhook-modal-title" });

		// URL input section
		const urlSection = contentEl.createDiv({ cls: "tasknotes-webhook-modal-section" });
		new Setting(urlSection)
			.setName("Webhook URL")
			.setDesc("The endpoint where webhook payloads will be sent")
			.addText((text) => {
				text.inputEl.setAttribute("aria-label", "Webhook URL");
				return text
					.setPlaceholder("https://your-service.com/webhook")
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
		const availableEvents = [
			{ id: "task.created", label: "Task Created", desc: "When new tasks are created" },
			{ id: "task.updated", label: "Task Updated", desc: "When tasks are modified" },
			{
				id: "task.completed",
				label: "Task Completed",
				desc: "When tasks are marked complete",
			},
			{ id: "task.deleted", label: "Task Deleted", desc: "When tasks are deleted" },
			{ id: "task.archived", label: "Task Archived", desc: "When tasks are archived" },
			{ id: "task.unarchived", label: "Task Unarchived", desc: "When tasks are unarchived" },
			{ id: "time.started", label: "Time Started", desc: "When time tracking starts" },
			{ id: "time.stopped", label: "Time Stopped", desc: "When time tracking stops" },
			{
				id: "pomodoro.started",
				label: "Pomodoro Started",
				desc: "When pomodoro sessions begin",
			},
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
			{
				id: "reminder.triggered",
				label: "Reminder Triggered",
				desc: "When task reminders activate",
			},
		];

		availableEvents.forEach((event) => {
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
		transformHeader.createEl("h3", { text: "Transform Configuration (Optional)" });

		new Setting(transformSection)
			.setName("Transform File")
			.setDesc("Path to a .js or .json file in your vault that transforms webhook payloads")
			.addText((text) => {
				text.inputEl.setAttribute("aria-label", "Transform file path");
				return text
					.setPlaceholder("discord-transform.js")
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
		helpHeader.createSpan({ text: "Transform files allow you to customize webhook payloads:" });

		const helpList = transformHelp.createEl("ul", { cls: "tasknotes-webhook-help-list" });
		const jsLi = helpList.createEl("li");
		jsLi.createEl("strong", { text: ".js files:" });
		jsLi.appendText(" Custom JavaScript transforms");

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
		helpExample.createEl("code", { text: "discord-transform.js" });

		// CORS headers section
		const corsSection = contentEl.createDiv({ cls: "tasknotes-webhook-modal-section" });
		const corsHeader = corsSection.createDiv({
			cls: "tasknotes-webhook-modal-subsection-header",
		});
		const corsIcon = corsHeader.createSpan();
		setIcon(corsIcon, "settings");
		corsHeader.createEl("h3", { text: "Headers Configuration" });

		new Setting(corsSection)
			.setName("Include custom headers")
			.setDesc(
				"Include TaskNotes headers (event type, signature, delivery ID). Turn off for Discord, Slack, and other services with strict CORS policies."
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
			text: "Add Webhook",
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

			this.onSubmit({
				url: this.url.trim(),
				events: this.selectedEvents as any[],
				transformFile: this.transformFile.trim() || undefined,
				corsHeaders: this.corsHeaders,
			});

			this.close();
		};
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
