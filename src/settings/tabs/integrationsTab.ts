import { Notice, Platform, Modal, Setting, setIcon, App } from "obsidian";
import TaskNotesPlugin from "../../main";
import { WebhookConfig } from "../../types";
import { TranslationKey } from "../../i18n";
import { loadAPIEndpoints } from "../../api/loadAPIEndpoints";
import {
	createSectionHeader,
	createTextSetting,
	createToggleSetting,
	createDropdownSetting,
	createNumberSetting,
	createHelpText,
	createButtonSetting,
	// createValidationNote
} from "../components/settingHelpers";
// import { ListEditorComponent, ListEditorItem } from '../components/ListEditorComponent';
import { showConfirmationModal } from "../../modals/ConfirmationModal";
import {
	createCard,
	createStatusBadge,
	createCardInput,
	createDeleteHeaderButton,
	createCardUrlInput,
	createCardNumberInput,
	createInfoBadge,
	createEditHeaderButton,
	showCardEmptyState,
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

	// Bases Integration Section
	createSectionHeader(container, translate("settings.integrations.basesIntegration.header"));
	createHelpText(container, translate("settings.integrations.basesIntegration.description"));

	// Bases toggle
	createToggleSetting(container, {
		name: translate("settings.integrations.basesIntegration.enable.name"),
		desc: translate("settings.integrations.basesIntegration.enable.description"),
		getValue: () => plugin.settings.enableBases,
		setValue: async (value: boolean) => {
			plugin.settings.enableBases = value;
			save();

			// Show notice about restart requirement
			if (value) {
				new Notice(translate("settings.integrations.basesIntegration.notices.enabled"));
			} else {
				new Notice(translate("settings.integrations.basesIntegration.notices.disabled"));
			}
		},
	});

	// Calendar Subscriptions Section (ICS)
	createSectionHeader(container, translate("settings.integrations.calendarSubscriptions.header"));
	createHelpText(container, translate("settings.integrations.calendarSubscriptions.description"));

	// Default settings for ICS integration
	createTextSetting(container, {
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
	});

	createTextSetting(container, {
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
	});

	createDropdownSetting(container, {
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
	});

	if (plugin.settings.icsIntegration.icsNoteFilenameFormat === "custom") {
		createTextSetting(container, {
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
		});
	}

	// ICS Subscriptions List - Add proper section header
	createSectionHeader(container, translate("settings.integrations.subscriptionsList.header"));
	const icsContainer = container.createDiv("ics-subscriptions-container");
	renderICSSubscriptionsList(icsContainer, plugin, save);

	// Add subscription button
	createButtonSetting(container, {
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
	});

	// Refresh all subscriptions button
	createButtonSetting(container, {
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
	});

	// Automatic ICS Export Section
	createSectionHeader(container, translate("settings.integrations.autoExport.header"));
	createHelpText(container, translate("settings.integrations.autoExport.description"));

	createToggleSetting(container, {
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
	});

	if (plugin.settings.icsIntegration.enableAutoExport) {
		createTextSetting(container, {
			name: translate("settings.integrations.autoExport.filePath.name"),
			desc: translate("settings.integrations.autoExport.filePath.description"),
			placeholder: translate("settings.integrations.autoExport.filePath.placeholder"),
			getValue: () => plugin.settings.icsIntegration.autoExportPath,
			setValue: async (value: string) => {
				plugin.settings.icsIntegration.autoExportPath = value || "tasknotes-calendar.ics";
				save();
			},
		});

		createNumberSetting(container, {
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
		});

		// Show current export status
		const statusContainer = container.createDiv("auto-export-status");
		statusContainer.style.marginTop = "10px";
		statusContainer.style.padding = "10px";
		statusContainer.style.backgroundColor = "var(--background-secondary)";
		statusContainer.style.borderRadius = "4px";

		if (plugin.autoExportService) {
			const lastExport = plugin.autoExportService.getLastExportTime();
			const nextExport = plugin.autoExportService.getNextExportTime();

			statusContainer.innerHTML = `
                <div style="font-weight: 500; margin-bottom: 5px;">${translate("settings.integrations.autoExport.status.title")}:</div>
                <div style="font-size: 0.9em; opacity: 0.8;">
                    ${lastExport ? translate("settings.integrations.autoExport.status.lastExport", { time: lastExport.toLocaleString() }) : translate("settings.integrations.autoExport.status.noExports")}<br>
                    ${nextExport ? translate("settings.integrations.autoExport.status.nextExport", { time: nextExport.toLocaleString() }) : translate("settings.integrations.autoExport.status.notScheduled")}
                </div>
            `;
		} else {
			statusContainer.innerHTML = `
                <div style="font-weight: 500; color: var(--text-warning);">
                    ${translate("settings.integrations.autoExport.status.serviceNotInitialized")}
                </div>
            `;
		}

		// Manual export trigger button
		createButtonSetting(container, {
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
		});
	}

	// HTTP API Section (Skip on mobile)
	if (!Platform.isMobile) {
		createSectionHeader(container, translate("settings.integrations.httpApi.header"));
		createHelpText(container, translate("settings.integrations.httpApi.description"));

		createToggleSetting(container, {
			name: translate("settings.integrations.httpApi.enable.name"),
			desc: translate("settings.integrations.httpApi.enable.description"),
			getValue: () => plugin.settings.enableAPI,
			setValue: async (value: boolean) => {
				plugin.settings.enableAPI = value;
				save();
				// Re-render to show API settings
				renderIntegrationsTab(container, plugin, save);
			},
		});

		if (plugin.settings.enableAPI) {
			createNumberSetting(container, {
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
			});

			createTextSetting(container, {
				name: translate("settings.integrations.httpApi.authToken.name"),
				desc: translate("settings.integrations.httpApi.authToken.description"),
				placeholder: translate("settings.integrations.httpApi.authToken.placeholder"),
				getValue: () => plugin.settings.apiAuthToken,
				setValue: async (value: string) => {
					plugin.settings.apiAuthToken = value;
					save();
				},
			});

			// API endpoint info
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
		createSectionHeader(container, translate("settings.integrations.webhooks.header"));

		// Webhook description
		const webhookDescEl = container.createDiv("setting-item-description");
		webhookDescEl.createEl("p", {
			text: translate("settings.integrations.webhooks.description.overview"),
		});
		webhookDescEl.createEl("p", {
			text: translate("settings.integrations.webhooks.description.usage"),
		});

		// Webhook management
		renderWebhookList(container, plugin, save);

		// Add webhook button
		createButtonSetting(container, {
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
		});
	}

	// Other Integrations Section
	createSectionHeader(container, translate("settings.integrations.otherIntegrations.header"));
	createHelpText(container, translate("settings.integrations.otherIntegrations.description"));
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
		const enabledToggle = createCardInput("checkbox");
		enabledToggle.checked = subscription.enabled;

		const nameInput = createCardInput("text", "Calendar name", subscription.name);

		// Create type dropdown
		const typeSelect = document.createElement("select");
		typeSelect.className = "tasknotes-settings__card-input";
		typeSelect.innerHTML = `
            <option value="remote" ${subscription.type === "remote" ? "selected" : ""}>Remote URL</option>
            <option value="local" ${subscription.type === "local" ? "selected" : ""}>Local File</option>
        `;

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

		// Update handlers
		enabledToggle.addEventListener("change", () =>
			updateSubscription({ enabled: enabledToggle.checked })
		);
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
			const oldType = subscription.type;

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
							updateSubscription({ url: value });
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
				updateSubscription({ url: value });
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
		if (subscription.lastFetched) {
			const lastSyncDate = new Date(subscription.lastFetched);
			const timeAgo = getRelativeTime(lastSyncDate, translate);
			const syncBadge = createInfoBadge(`Synced ${timeAgo}`);
			metaBadges.push(syncBadge);
		}

		// Add error badge if there's an error
		if (subscription.lastError) {
			const errorBadge = createStatusBadge("Error", "inactive");
			errorBadge.title = subscription.lastError; // Show error on hover
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

		const card = createCard(container, {
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

		const successBadge = createInfoBadge(`✓ ${webhook.successCount || 0}`);
		const failureBadge = createInfoBadge(`✗ ${webhook.failureCount || 0}`);

		// Create inputs for inline editing
		const urlInput = createCardUrlInput("Webhook URL", webhook.url);
		const activeToggle = createCardInput("checkbox");
		activeToggle.checked = webhook.active;

		// Update handlers
		urlInput.addEventListener("blur", () => {
			if (urlInput.value.trim() !== webhook.url) {
				webhook.url = urlInput.value.trim();
				save();
				new Notice(translate("settings.integrations.webhooks.notices.urlUpdated"));
			}
		});

		activeToggle.addEventListener("change", () => {
			webhook.active = activeToggle.checked;
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

		// Format webhook creation date
		const createdDate = webhook.createdAt ? new Date(webhook.createdAt) : null;
		const createdText = createdDate
			? translate("settings.integrations.webhooks.statusLabels.created", {
					timeAgo: getRelativeTime(createdDate, translate),
				})
			: "Creation date unknown";

		// Create events display as a formatted string
		const eventsDisplay = document.createElement("div");
		eventsDisplay.style.display = "flex";
		eventsDisplay.style.flexWrap = "wrap";
		eventsDisplay.style.gap = "0.5rem";
		eventsDisplay.style.alignItems = "center";
		eventsDisplay.style.minHeight = "1.5rem";
		eventsDisplay.style.lineHeight = "1.5rem";

		if (webhook.events.length === 0) {
			const noEventsSpan = document.createElement("span");
			noEventsSpan.textContent = translate(
				"settings.integrations.webhooks.eventsDisplay.noEvents"
			);
			noEventsSpan.style.color = "var(--text-muted)";
			noEventsSpan.style.fontStyle = "italic";
			noEventsSpan.style.lineHeight = "1.5rem";
			eventsDisplay.appendChild(noEventsSpan);
		} else {
			webhook.events.forEach((event, i) => {
				const eventBadge = createInfoBadge(event);
				eventBadge.style.marginBottom = "0";
				eventBadge.style.flexShrink = "0";
				eventsDisplay.appendChild(eventBadge);
			});
		}

		// Create transform file display if exists
		const transformDisplay = webhook.transformFile
			? (() => {
					const span = document.createElement("span");
					span.textContent = webhook.transformFile;
					span.style.fontFamily = "monospace";
					span.style.fontSize = "0.85rem";
					span.style.color = "var(--text-muted)";
					span.style.lineHeight = "1.5rem";
					span.style.padding = "0.25rem 0.5rem";
					span.style.background = "var(--background-modifier-form-field)";
					span.style.borderRadius = "4px";
					span.style.border = "1px solid var(--background-modifier-border)";
					return span;
				})()
			: (() => {
					const span = document.createElement("span");
					span.textContent = translate(
						"settings.integrations.webhooks.transformDisplay.noTransform"
					);
					span.style.color = "var(--text-muted)";
					span.style.fontStyle = "italic";
					span.style.lineHeight = "1.5rem";
					return span;
				})();

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
	private webhook: WebhookConfig;
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
		this.webhook = webhook;
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
