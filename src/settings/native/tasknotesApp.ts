import { msg } from "@lingui/core/macro";
import {
	FileSystemAdapter,
	Notice,
	Platform,
	type SettingDefinitionItem,
	type SettingDefinitionPage,
} from "obsidian";
import { uiData } from "../../i18n/dataText";
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

	const items: SettingDefinitionItem[] = [
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
		desc: t(msg({ message: "Use your tasks on the web, iPhone and Android.", context: "settings.tasknotesApp.page.description" })),
		items,
	};
}
