import { msg } from "@lingui/core/macro";
import {
	FileSystemAdapter,
	Notice,
	Platform,
	type SettingDefinitionItem,
	type SettingDefinitionPage,
} from "obsidian";
import { uiData } from "../../i18n/dataText";
import { showConfirmationModal } from "../../modals/ConfirmationModal";
import { APP_STORE_QR, GOOGLE_PLAY_QR, type StoreQrCode } from "./storeQrCodes";
import type { SettingsContext } from "./SettingsContext";

export const TASKNOTES_APP_URL = "https://app.tasknotes.dev/";
export const TASKNOTES_APP_STORE_URL = APP_STORE_QR.url;
export const TASKNOTES_GOOGLE_PLAY_URL = GOOGLE_PLAY_QR.url;
export const MDBASE_CONNECT_DOWNLOADS_URL = "https://mdbase.dev/downloads/";
export const MDBASE_SYNC_PLUGIN_URL = "obsidian://show-plugin?id=mdbase-sync";
export const MDBASE_MCP_URL = "https://mdbase.dev/apps/mcp/";
export const TASKNOTES_APP_GUIDE_URL = "https://tasknotes.dev/guides/tasknotes-app/";

/**
 * mdbase Connect keeps its per-folder state here once a folder is added to it on
 * a computer. It says the vault was added, not that sync is currently running.
 */
const CONNECT_STATE_PATH = ".mdbase/state";

function open(url: string): void {
	window.open(url, "_blank");
}

function vaultFolderPath(ctx: SettingsContext): string | null {
	const adapter = ctx.plugin.app.vault.adapter;
	return adapter instanceof FileSystemAdapter ? adapter.getBasePath() : null;
}

function renderQrCode(parent: HTMLElement, code: StoreQrCode, caption: string, label: string): void {
	const figure = parent.createDiv({ cls: "tn-app-qr-figure" });
	const margin = 2;
	const extent = code.size + margin * 2;
	const svg = figure.createSvg("svg", {
		cls: "tn-app-qr",
		attr: {
			viewBox: `${-margin} ${-margin} ${extent} ${extent}`,
			role: "img",
			"aria-label": label,
			"shape-rendering": "crispEdges",
		},
	});
	svg.createSvg("rect", {
		attr: { x: -margin, y: -margin, width: extent, height: extent, class: "tn-app-qr__background" },
	});
	svg.createSvg("path", { attr: { d: code.path, class: "tn-app-qr__modules" } });
	figure.createDiv({ cls: "tn-app-qr-caption", text: caption });
}

/** The TaskNotes App page: what the app is, how to use it with this vault, and mdbase options. */
export function tasknotesAppDefinitions(ctx: SettingsContext): SettingDefinitionPage {
	const { plugin } = ctx;
	const s = plugin.settings;
	const t = ctx.t;
	const folder = vaultFolderPath(ctx);
	const pendingRecovery = () => plugin.mdbaseSpecService?.getPendingV02MigrationRecovery() ?? null;
	const keepCurrentLabel = t(msg({ message: "Keep current files and resume", context: "settings.tasknotesApp.migrationRecovery.keepCurrent.name" }));
	const restoreBackupLabel = t(msg({ message: "Restore v0.2 backup", context: "settings.tasknotesApp.migrationRecovery.restoreBackup.name" }));

	const items: SettingDefinitionItem[] = [
		{
			type: "group",
			heading: t(msg({ message: "Metadata upgrade recovery", context: "settings.tasknotesApp.migrationRecovery.heading" })),
			visible: () => pendingRecovery() !== null,
			items: [
				{
					name: t(msg({ message: "Metadata updates are paused", context: "settings.tasknotesApp.migrationRecovery.status.name" })),
					searchable: false,
					render: (setting) => {
						const recovery = pendingRecovery();
						if (!recovery) return;
						setting.descEl.empty();
						setting.descEl.addClass("tn-migration-recovery-details");

						const summary =
							recovery.blockedPaths.length > 0
								? t(
										msg({
											message:
												"An earlier mdbase v0.2 to v0.3 metadata upgrade was interrupted. TaskNotes paused automatic rollback so it would not overwrite changes to {files}. Your task files were not changed.",
											context: "settings.tasknotesApp.migrationRecovery.status.blockedFiles",
										}),
										{ files: recovery.blockedPaths.join(", ") }
									)
								: recovery.reason === "backup-mismatch"
									? t(
											msg({
												message:
													"An earlier mdbase v0.2 to v0.3 metadata upgrade left a pending recovery record, and its backup files no longer match. TaskNotes left your current files untouched. Your task files were not changed.",
												context: "settings.tasknotesApp.migrationRecovery.status.backupMismatch",
											})
										)
									: t(
											msg({
												message:
													"An earlier mdbase v0.2 to v0.3 metadata upgrade left a pending recovery record that could not be rolled back automatically. TaskNotes left your current files untouched. Your task files were not changed.",
												context: "settings.tasknotesApp.migrationRecovery.status.generic",
											})
										);
						setting.descEl.createDiv({ text: summary, cls: "mod-warning" });

						if (recovery.blockedPaths.length > 0) {
							const blockedRow = setting.descEl.createDiv({ cls: "tn-migration-recovery-path" });
							blockedRow.createSpan({
								text: t(
									msg({
										message: "{count, plural, =1 {Blocked file:} other {Blocked files:}}",
										context: "settings.tasknotesApp.migrationRecovery.status.blockedFilesLabel",
									}),
									{ count: recovery.blockedPaths.length }
								),
							});
							blockedRow.createEl("code", {
								text: uiData(recovery.blockedPaths.join(", "), "Vault-relative metadata path, not UI prose"),
							});
						}

						if (recovery.backupFolder) {
							const backupRow = setting.descEl.createDiv({ cls: "tn-migration-recovery-path" });
							backupRow.createSpan({
								text: t(
									msg({
										message: "Backup folder:",
										context: "settings.tasknotesApp.migrationRecovery.status.backupFolderLabel",
									})
								),
							});
							backupRow.createEl("code", {
								text: uiData(recovery.backupFolder, "Vault-relative backup folder path, not UI prose"),
							});
						}

						setting.descEl.createDiv({
							text: t(
								msg({
									message: "Your backup folder is kept intact whichever option you choose.",
									context: "settings.tasknotesApp.migrationRecovery.status.backupKept",
								})
							),
						});
					},
				},
				ctx.button("mdbase.migrationRecovery.keepCurrent", {
					name: keepCurrentLabel,
					desc: t(
						msg({
							message:
								"Clears the pending upgrade record without modifying your metadata files or backup folder. If mdbase.yaml is valid v0.3, TaskNotes resumes metadata sync.",
							context: "settings.tasknotesApp.migrationRecovery.keepCurrent.description",
						})
					),
					buttonText: keepCurrentLabel,
					onClick: async () => {
						const recovery = pendingRecovery();
						if (!recovery || !plugin.mdbaseSpecService) return;
						const confirmed = await showConfirmationModal(plugin.app, {
							title: t(
								msg({
									message: "Keep current files and resume?",
									context: "settings.tasknotesApp.migrationRecovery.keepCurrent.confirmTitle",
								})
							),
							message: recovery.backupFolder
								? t(
										msg({
											message:
												"TaskNotes will clear the pending upgrade record, keep your current files and the backup in {backupFolder}, and resume metadata sync if mdbase.yaml is valid v0.3.",
											context: "settings.tasknotesApp.migrationRecovery.keepCurrent.confirmMessageWithBackup",
										}),
										{ backupFolder: recovery.backupFolder }
									)
								: t(
										msg({
											message:
												"TaskNotes will clear the pending upgrade record, keep your current files, and resume metadata sync if mdbase.yaml is valid v0.3.",
											context: "settings.tasknotesApp.migrationRecovery.keepCurrent.confirmMessage",
										})
									),
							confirmText: keepCurrentLabel,
							isDestructive: false,
						});
						if (!confirmed) return;
						const result = await plugin.mdbaseSpecService.keepCurrentFilesAndResumeV02Migration();
						ctx.rebuild();
						new Notice(
							result.synced
								? t(
										msg({
											message: "Pending upgrade record cleared. TaskNotes resumed mdbase v0.3 metadata sync.",
											context: "settings.tasknotesApp.migrationRecovery.keepCurrent.resumedNotice",
										})
									)
								: t(
										msg({
											message: "Pending upgrade record cleared. Your current files and backup folder were kept.",
											context: "settings.tasknotesApp.migrationRecovery.keepCurrent.clearedNotice",
										})
									)
						);
					},
				}),
				{
					...ctx.button("mdbase.migrationRecovery.restoreBackup", {
						name: restoreBackupLabel,
						desc: t(
							msg({
								message:
									"Replaces the changed metadata files with the verified v0.2 backup copies and clears the pending upgrade record. The backup folder is kept.",
								context: "settings.tasknotesApp.migrationRecovery.restoreBackup.description",
							})
						),
						buttonText: restoreBackupLabel,
						onClick: async () => {
							const recovery = pendingRecovery();
							if (!recovery || !recovery.canRestoreBackup || !recovery.backupFolder || !plugin.mdbaseSpecService) {
								return;
							}
							const confirmed = await showConfirmationModal(plugin.app, {
								title: t(
									msg({
										message: "Restore v0.2 backup?",
										context: "settings.tasknotesApp.migrationRecovery.restoreBackup.confirmTitle",
									})
								),
								message: t(
									msg({
										message:
											"This will overwrite {files} with the v0.2 backup from {backupFolder}. The backup folder itself will be kept intact.",
										context: "settings.tasknotesApp.migrationRecovery.restoreBackup.confirmMessage",
									}),
									{
										files: recovery.blockedPaths.join(", "),
										backupFolder: recovery.backupFolder,
									}
								),
								confirmText: restoreBackupLabel,
								isDestructive: true,
								defaultToConfirm: false,
							});
							if (!confirmed) return;
							const result = await plugin.mdbaseSpecService.restoreV02MigrationBackup();
							ctx.rebuild();
							new Notice(
								result.backupFolder
									? t(
											msg({
												message: "Restored v0.2 metadata files. Recovery copies remain in {backupFolder}.",
												context: "settings.tasknotesApp.migrationRecovery.restoreBackup.restoredNotice",
											}),
											{ backupFolder: result.backupFolder }
										)
									: t(
											msg({
												message: "Restored v0.2 metadata files.",
												context: "settings.tasknotesApp.migrationRecovery.restoreBackup.restoredNoticeNoFolder",
											})
										)
							);
						},
					}),
					visible: () => pendingRecovery()?.canRestoreBackup === true,
				},
			],
		},
		{
			type: "group",
			items: [
				{
					name: t(msg({ message: "Your tasks on the web, iPhone and Android", context: "settings.tasknotesApp.intro.name" })),
					desc: t(msg({ message: "TaskNotes App works with the same Markdown task notes as this plugin. You can try it in your browser straight away, without an account. To use it with the tasks in this vault, sync the vault with mdbase Connect.", context: "settings.tasknotesApp.intro.description" })),
				},
				{
					name: t(msg({ message: "Open TaskNotes App", context: "settings.tasknotesApp.openApp.name" })),
					desc: uiData("app.tasknotes.dev", "Product web address"),
					aliases: ["web app", "mobile", "iphone", "android"],
					action: () => open(TASKNOTES_APP_URL),
				},
				{
					name: t(msg({ message: "Get TaskNotes for iPhone", context: "settings.tasknotesApp.iphone.name" })),
					desc: t(msg({ message: "Opens the App Store.", context: "settings.tasknotesApp.iphone.description" })),
					aliases: ["ios", "app store"],
					action: () => open(TASKNOTES_APP_STORE_URL),
				},
				{
					name: t(msg({ message: "Get TaskNotes for Android", context: "settings.tasknotesApp.android.name" })),
					desc: t(msg({ message: "Opens Google Play.", context: "settings.tasknotesApp.android.description" })),
					aliases: ["google play", "play store"],
					action: () => open(TASKNOTES_GOOGLE_PLAY_URL),
				},
				{
					name: t(msg({ message: "Scan to get the mobile app", context: "settings.tasknotesApp.qr.name" })),
					desc: t(msg({ message: "Point your phone’s camera at the code for your phone.", context: "settings.tasknotesApp.qr.description" })),
					visible: () => !Platform.isMobile,
					render: (setting) => {
						const codes = setting.controlEl.createDiv({ cls: "tn-app-qr-codes" });
						renderQrCode(
							codes,
							APP_STORE_QR,
							uiData("iPhone", "Product name"),
							t(msg({ message: "QR code for TaskNotes in the App Store", context: "settings.tasknotesApp.qr.label" }))
						);
						renderQrCode(
							codes,
							GOOGLE_PLAY_QR,
							uiData("Android", "Product name"),
							t(msg({ message: "QR code for TaskNotes on Google Play", context: "settings.tasknotesApp.qr.androidLabel" }))
						);
					},
				},
			],
		},
		{
			type: "group",
			heading: t(msg({ message: "Use it with this vault", context: "settings.tasknotesApp.setup.heading" })),
			items: [
				{
					name: t(msg({ message: "This vault", context: "settings.tasknotesApp.status.name" })),
					desc: t(msg({ message: "Type definitions are off. Turn them on in step 1.", context: "settings.tasknotesApp.status.typesOff" })),
					aliases: ["mdbase connect", "sync", "status"],
					visible: () => !s.enableMdbaseSpec,
				},
				{
					name: t(msg({ message: "This vault", context: "settings.tasknotesApp.status.name" })),
					aliases: ["mdbase connect", "sync", "status"],
					visible: () => s.enableMdbaseSpec,
					render: (setting) => {
						setting.setDesc(t(msg({ message: "Checking…", context: "settings.tasknotesApp.status.checking" })));
						void plugin.app.vault.adapter.exists(CONNECT_STATE_PATH).then(
							(added) => {
								setting.setDesc(
									added
										? t(msg({ message: "Added to mdbase Connect on a computer. Open TaskNotes App and sign in with the same account.", context: "settings.tasknotesApp.status.added" }))
										: t(msg({ message: "Use either sync option below.", context: "settings.tasknotesApp.status.notAdded" }))
								);
							},
							() => setting.setDesc("")
						);
					},
				},
				{
					...ctx.field(
						s,
						"enableMdbaseSpec",
						"enableMdbaseSpec",
						t(msg({ message: "1. Turn on type definitions", context: "settings.tasknotesApp.types.name" })),
						{ desc: t(msg({ message: "Writes mdbase.yaml and the task type that TaskNotes App reads, and keeps them up to date as your settings change. Update TaskNotes on every device that uses this vault first: TaskNotes 4 can overwrite them.", context: "settings.tasknotesApp.types.description" })) }
					),
					aliases: [
						"enableMdbaseSpec",
						"mdbase-spec",
						t(msg({ message: "Generate mdbase type definitions", context: "settings.integrations.mdbaseSpec.enable.name" })),
					],
				},
				{
					name: t(msg({ message: "2. Choose a sync option", context: "settings.tasknotesApp.step1.name" })),
					desc: t(msg({ message: "Install either the mdbase desktop app or the mdbase sync plugin for Obsidian. Sign in or create an account; you only need one of them.", context: "settings.tasknotesApp.step1.description" })),
					aliases: ["download", "desktop app", "obsidian plugin", "mdbase-sync"],
					render: (setting) => {
						setting.addButton((button) =>
							button
								.setButtonText(t(msg({ message: "Desktop app", context: "settings.tasknotesApp.step1.desktop" })))
								.onClick(() => open(MDBASE_CONNECT_DOWNLOADS_URL))
						);
						setting.addButton((button) =>
							button
								.setButtonText(t(msg({ message: "Obsidian plugin", context: "settings.tasknotesApp.step1.plugin" })))
								.onClick(() => open(MDBASE_SYNC_PLUGIN_URL))
						);
					},
				},
				{
					name: t(msg({ message: "3. Add this vault", context: "settings.tasknotesApp.step2.name" })),
					desc: t(msg({ message: "Desktop app: add this vault’s folder and turn on sync. Obsidian plugin: follow the setup steps in the plugin to sync this vault.", context: "settings.tasknotesApp.step2.description" })),
					render: (setting) => {
						if (!folder) return;
						setting.descEl.createDiv().createEl("code", { text: uiData(folder, "Vault folder path on this computer") });
						setting.addButton((button) =>
							button
								.setButtonText(t(msg({ message: "Copy folder path", context: "settings.tasknotesApp.step2.copy" })))
								.onClick(() => {
									void navigator.clipboard.writeText(folder).then(
										() => new Notice(t(msg({ message: "Folder path copied", context: "settings.tasknotesApp.step2.copied" }))),
										() => new Notice(t(msg({ message: "Could not copy the folder path", context: "settings.tasknotesApp.step2.copyFailed" })))
									);
								})
						);
					},
				},
				{
					name: t(msg({ message: "4. Open TaskNotes App", context: "settings.tasknotesApp.step3.name" })),
					desc: t(msg({ message: "Sign in with the same account and choose this vault.", context: "settings.tasknotesApp.step3.description" })),
					action: () => open(TASKNOTES_APP_URL),
				},
				{
					name: t(msg({ message: "Use one sync service for this vault", context: "settings.tasknotesApp.oneSync.name" })),
					desc: t(msg({ message: "Once mdbase Connect syncs this vault, stop syncing it with Obsidian Sync, iCloud, Dropbox or another service. Two services syncing the same folder can create conflicting copies.", context: "settings.tasknotesApp.oneSync.description" })),
					aliases: ["obsidian sync", "icloud", "dropbox", "syncthing"],
				},
				{
					name: t(msg({ message: "Setup guide", context: "settings.tasknotesApp.guide.name" })),
					desc: t(msg({ message: "Step-by-step instructions on tasknotes.dev.", context: "settings.tasknotesApp.guide.description" })),
					action: () => open(TASKNOTES_APP_GUIDE_URL),
				},
			],
		},
		{
			type: "group",
			heading: t(msg({ message: "Advanced", context: "settings.native.advanced" })),
			items: [
				ctx.field(
					s,
					"hideMdbaseFolders",
					"hideMdbaseFolders",
					t(msg({ message: "Hide mdbase folders in the file explorer", context: "settings.integrations.mdbaseSpec.hideFolders.name" })),
					{ desc: t(msg({ message: "Hide _mdbase, configured type and contract folders, _settings, and mdbase schema folders. Their files still appear in search and the quick switcher.", context: "settings.integrations.mdbaseSpec.hideFolders.description" })) }
				),
				{
					name: t(msg({ message: "Learn more about mdbase-spec", context: "settings.integrations.mdbaseSpec.learnMore" })),
					action: () => open("https://mdbase.dev"),
				},
			],
		},
	];

	return {
		type: "page",
		name: t(msg({ message: "TaskNotes App", context: "settings.tasknotesApp.page.name" })),
		desc:
			pendingRecovery() !== null
				? t(msg({ message: "Metadata upgrade recovery needed.", context: "settings.tasknotesApp.page.recoveryNeeded" }))
				: t(msg({ message: "Use your tasks on the web, iPhone and Android.", context: "settings.tasknotesApp.page.description" })),
		items,
	};
}
