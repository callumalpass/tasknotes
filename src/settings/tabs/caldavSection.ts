/**
 * CalDAV account configuration UI.
 *
 * Kept out of integrationsTab.ts, which is already very large. Rendering is
 * re-entrant: any change that alters which controls apply (adding an account,
 * discovering collections) re-renders the whole section.
 */

import { Setting } from "obsidian";

import type TaskNotesPlugin from "../../main";
import type { CalDavAccountSettings } from "../../types/settings";
import type { TranslationKey } from "../../i18n";
import {
	CalDavClient,
	CalDavError,
	type CalDavCollectionInfo,
} from "../../services/CalDavClient";
import { CalDavSecretStore } from "../../services/CalDavSecretStore";
import { summarizeFirstSyncPlan } from "../../services/caldav/caldavReconciliation";
import { DEFAULT_CALDAV_ACCOUNT } from "../defaults";
import { showConfirmationModal } from "../../modals/ConfirmationModal";
import {
	configureButtonSetting,
	configureDropdownSetting,
	configureNumberSetting,
	configureTextSetting,
	configureToggleSetting,
	createSettingGroup,
} from "../components/settingHelpers";
import { showNotice } from "../../ui/notifications";
import { createTaskNotesLogger } from "../../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Settings/CalDavSection" });

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/**
 * Collections found by the last discovery, per account.
 *
 * Kept outside the render function because the section re-renders on every
 * change, and re-running discovery each time would hammer the server.
 */
const discoveredCollections = new Map<string, CalDavCollectionInfo[]>();

export function renderCalDavSection(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: Translate,
	rerender: () => void
): void {
	const secretStore = new CalDavSecretStore(plugin.app.secretStorage);

	createSettingGroup(
		container,
		{
			heading: translate("settings.integrations.caldav.header"),
			description: translate("settings.integrations.caldav.description"),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate("settings.integrations.caldav.enable.name"),
						desc: translate("settings.integrations.caldav.enable.description"),
						getValue: () => plugin.settings.caldav.enabled,
						setValue: async (value: boolean) => {
							plugin.settings.caldav.enabled = value;
							save();
							// The service and its event listeners are wired up at
							// startup, so this only takes effect after a reload.
							showNotice(
								translate("settings.integrations.caldav.notices.reloadRequired")
							);
							rerender();
						},
					})
			);

			if (!plugin.settings.caldav.enabled) return;

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate("settings.integrations.caldav.pushOnChange.name"),
						desc: translate("settings.integrations.caldav.pushOnChange.description"),
						getValue: () => plugin.settings.caldav.pushOnChange,
						setValue: async (value: boolean) => {
							plugin.settings.caldav.pushOnChange = value;
							save();
						},
					})
			);

			for (const account of plugin.settings.caldav.accounts) {
				renderAccount(group, account);
			}

			group.addSetting(
				(setting) =>
					void configureButtonSetting(setting, {
						name: translate("settings.integrations.caldav.addAccount.name"),
						desc: translate("settings.integrations.caldav.addAccount.description"),
						buttonText: translate("settings.integrations.caldav.addAccount.button"),
						onClick: async () => {
							plugin.settings.caldav.accounts.push({
								...DEFAULT_CALDAV_ACCOUNT,
								id: `caldav-${Date.now().toString(36)}`,
								name: translate("settings.integrations.caldav.addAccount.defaultName"),
							});
							save();
							rerender();
						},
					})
			);
		}
	);

	function renderAccount(
		group: { addSetting(configure: (setting: Setting) => void): unknown },
		account: CalDavAccountSettings
	): void {
		group.addSetting((setting) => {
			setting.setName(account.name || account.id);
			setting.setHeading();
		});

		group.addSetting(
			(setting) =>
				void configureTextSetting(setting, {
					name: translate("settings.integrations.caldav.account.name.name"),
					desc: translate("settings.integrations.caldav.account.name.description"),
					getValue: () => account.name,
					setValue: async (value: string) => {
						account.name = value;
						save();
					},
					debounceMs: 500,
				})
		);

		group.addSetting(
			(setting) =>
				void configureTextSetting(setting, {
					name: translate("settings.integrations.caldav.account.serverUrl.name"),
					desc: translate("settings.integrations.caldav.account.serverUrl.description"),
					placeholder: "https://cloud.example.com/remote.php/dav",
					getValue: () => account.serverUrl,
					setValue: async (value: string) => {
						account.serverUrl = value.trim();
						save();
					},
					debounceMs: 500,
				})
		);

		group.addSetting(
			(setting) =>
				void configureTextSetting(setting, {
					name: translate("settings.integrations.caldav.account.username.name"),
					desc: translate("settings.integrations.caldav.account.username.description"),
					getValue: () => account.username,
					setValue: async (value: string) => {
						account.username = value.trim();
						save();
					},
					debounceMs: 500,
				})
		);

		// The password is write-only from here: it lives in Obsidian's
		// SecretStorage and is never read back into the settings UI.
		group.addSetting((setting) => {
			setting.setName(translate("settings.integrations.caldav.account.password.name"));
			setting.setDesc(
				secretStore.hasCredentials(account.id)
					? translate("settings.integrations.caldav.account.password.stored")
					: translate("settings.integrations.caldav.account.password.description")
			);
			setting.addText((text) => {
				text.inputEl.type = "password";
				text.setPlaceholder(
					translate("settings.integrations.caldav.account.password.placeholder")
				);
				text.onChange((value) => {
					if (!value) return;
					try {
						secretStore.setCredentials(account.id, {
							username: account.username,
							password: value,
						});
					} catch (error) {
						tasknotesLogger.error("Could not store CalDAV credentials", {
							category: "configuration",
							operation: "store-caldav-credentials",
							error,
						});
						showNotice(
							translate("settings.integrations.caldav.notices.credentialsNotStored")
						);
					}
				});
			});
			setting.addButton((button) => {
				button
					.setButtonText(translate("settings.integrations.caldav.account.password.clear"))
					.onClick(() => {
						secretStore.clearCredentials(account.id);
						rerender();
					});
			});
		});

		group.addSetting(
			(setting) =>
				void configureButtonSetting(setting, {
					name: translate("settings.integrations.caldav.account.discover.name"),
					desc: translate("settings.integrations.caldav.account.discover.description"),
					buttonText: translate("settings.integrations.caldav.account.discover.button"),
					onClick: () => discoverCollections(account),
				})
		);

		const discovered = discoveredCollections.get(account.id);
		if (discovered && discovered.length > 1) {
			// Several task lists can share a display name, so the URL is the only
			// thing that reliably tells them apart.
			group.addSetting(
				(setting) =>
					void configureDropdownSetting(setting, {
						name: translate("settings.integrations.caldav.account.collection.name"),
						desc: translate("settings.integrations.caldav.account.collection.choose"),
						options: discovered.map((collection) => ({
							value: collection.url,
							label: `${collection.displayName} (${collection.url})`,
						})),
						getValue: () => account.collectionUrl,
						setValue: async (value: string) => {
							account.collectionUrl = value;
							save();
						},
					})
			);
		} else if (account.collectionUrl) {
			group.addSetting((setting) => {
				setting.setName(
					translate("settings.integrations.caldav.account.collection.name")
				);
				setting.setDesc(account.collectionUrl);
			});
		}

		group.addSetting(
			(setting) =>
				void configureNumberSetting(setting, {
					name: translate("settings.integrations.caldav.account.interval.name"),
					desc: translate("settings.integrations.caldav.account.interval.description"),
					getValue: () => account.syncIntervalMinutes,
					setValue: async (value: number) => {
						account.syncIntervalMinutes = Math.max(1, Math.min(1440, value));
						save();
					},
					min: 1,
					max: 1440,
				})
		);

		group.addSetting(
			(setting) =>
				void configureDropdownSetting(setting, {
					name: translate("settings.integrations.caldav.account.deletionPolicy.name"),
					desc: translate(
						"settings.integrations.caldav.account.deletionPolicy.description"
					),
					options: [
						{
							value: "archive",
							label: translate(
								"settings.integrations.caldav.account.deletionPolicy.archive"
							),
						},
						{
							value: "unlink",
							label: translate(
								"settings.integrations.caldav.account.deletionPolicy.unlink"
							),
						},
						{
							value: "delete",
							label: translate(
								"settings.integrations.caldav.account.deletionPolicy.delete"
							),
						},
					],
					getValue: () => account.remoteDeletionPolicy,
					setValue: async (value: string) => {
						account.remoteDeletionPolicy =
							value as CalDavAccountSettings["remoteDeletionPolicy"];
						save();
					},
				})
		);

		group.addSetting(
			(setting) =>
				void configureToggleSetting(setting, {
					name: translate("settings.integrations.caldav.account.enable.name"),
					desc: translate("settings.integrations.caldav.account.enable.description"),
					getValue: () => account.enabled,
					setValue: async (value: boolean) => {
						account.enabled = value;
						save();
					},
				})
		);

		group.addSetting(
			(setting) =>
				void configureButtonSetting(setting, {
					name: translate("settings.integrations.caldav.account.firstSync.name"),
					desc: translate("settings.integrations.caldav.account.firstSync.description"),
					buttonText: translate("settings.integrations.caldav.account.firstSync.button"),
					onClick: () => runFirstSyncPreview(account),
				})
		);

		group.addSetting(
			(setting) =>
				void configureButtonSetting(setting, {
					name: translate("settings.integrations.caldav.account.remove.name"),
					desc: translate("settings.integrations.caldav.account.remove.description"),
					buttonText: translate("settings.integrations.caldav.account.remove.button"),
					onClick: () => removeAccount(account),
				})
		);
	}

	async function discoverCollections(account: CalDavAccountSettings): Promise<void> {
		const credentials = secretStore.getCredentials(account.id);
		if (!credentials) {
			showNotice(translate("settings.integrations.caldav.notices.missingCredentials"));
			return;
		}

		try {
			const client = new CalDavClient({
				serverUrl: account.serverUrl || account.collectionUrl,
				credentials,
			});
			const collections = await client.discoverCollections();

			if (collections.length === 0) {
				showNotice(translate("settings.integrations.caldav.notices.noCollections"));
				return;
			}

			discoveredCollections.set(account.id, collections);

			// Adopt the first result so a single-list account needs no further
			// input; when there are several, the dropdown lets the user correct it
			// before anything is written.
			if (!collections.some((collection) => collection.url === account.collectionUrl)) {
				account.collectionUrl = collections[0].url;
			}
			if (!account.name) account.name = collections[0].displayName;
			save();
			showNotice(
				translate("settings.integrations.caldav.notices.discovered", {
					count: collections.length,
					name: collections[0].displayName,
				})
			);
			rerender();
		} catch (error) {
			reportError(error);
		}
	}

	async function runFirstSyncPreview(account: CalDavAccountSettings): Promise<void> {
		if (!plugin.caldavSyncService) {
			showNotice(translate("settings.integrations.caldav.notices.reloadRequired"));
			return;
		}
		if (!account.collectionUrl) {
			showNotice(translate("settings.integrations.caldav.notices.noCollectionSelected"));
			return;
		}

		try {
			const plan = await plugin.caldavSyncService.previewFirstSync(account.id);
			const summary = summarizeFirstSyncPlan(plan);

			// The first sync is the one destructive moment: a mis-scoped filter or
			// a wrong collection is cheap to catch here and expensive afterwards.
			const confirmed = await showConfirmationModal(plugin.app, {
				title: translate("settings.integrations.caldav.firstSync.title"),
				message: translate("settings.integrations.caldav.firstSync.summary", {
					upload: summary.upload,
					import: summary.import,
					link: summary.link,
					resolve: summary.resolve,
				}),
				confirmText: translate("settings.integrations.caldav.firstSync.confirm"),
			});
			if (!confirmed) return;

			await plugin.caldavSyncService.applyFirstSync(account.id, plan);
			account.initialSyncCompleted = true;
			save();
			showNotice(translate("settings.integrations.caldav.notices.firstSyncComplete"));
		} catch (error) {
			reportError(error);
		}
	}

	async function removeAccount(account: CalDavAccountSettings): Promise<void> {
		const confirmed = await showConfirmationModal(plugin.app, {
			title: translate("settings.integrations.caldav.remove.title"),
			message: translate("settings.integrations.caldav.remove.message", {
				name: account.name || account.id,
			}),
			confirmText: translate("settings.integrations.caldav.remove.confirm"),
			isDestructive: true,
		});
		if (!confirmed) return;

		secretStore.clearCredentials(account.id);
		plugin.settings.caldav.accounts = plugin.settings.caldav.accounts.filter(
			(candidate) => candidate.id !== account.id
		);
		save();
		rerender();
	}

	function reportError(error: unknown): void {
		tasknotesLogger.error("CalDAV settings action failed", {
			category: "provider",
			operation: "caldav-settings-action",
			error,
		});

		if (error instanceof CalDavError && error.kind === "auth") {
			showNotice(translate("settings.integrations.caldav.notices.authFailed"));
			return;
		}
		showNotice(translate("settings.integrations.caldav.notices.connectionFailed"));
	}
}
