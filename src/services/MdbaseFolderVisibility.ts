import { TFolder } from "obsidian";
import YAML from "yaml";
import type TaskNotesPlugin from "../main";
import { appSettingsSchemasFolder } from "./mdbase/appSettingsResources";

function folder(value: unknown, fallback: string): string {
	if (typeof value !== "string") return fallback;
	const path = value.trim().replace(/\\/g, "/").replace(/\/$/, "");
	if (
		!path ||
		path.startsWith("/") ||
		/^[a-z]:/i.test(path) ||
		path.split("/").some((part) => !part || part === "." || part === "..") ||
		Array.from(path).some((char) => char.charCodeAt(0) < 32)
	)
		return fallback;
	return path;
}

/** Only reserved/configured metadata folders; generic schema folders need ownership evidence. */
export function mdbaseHiddenFolders(
	settings: { types_folder?: unknown; contracts_folder?: unknown },
	hasFolder: (path: string) => boolean
): string[] {
	const types = folder(settings.types_folder, "_types");
	const contracts = folder(settings.contracts_folder, "_contracts");
	const schemas = appSettingsSchemasFolder(contracts);
	const parent = contracts.split("/").slice(0, -1).join("/");
	const taskSchemas = parent ? `${parent}/_schemas` : "_schemas";
	const paths = ["_mdbase", types, contracts, "_settings"];
	// Older plugin versions wrote schemas at the root even with nested contracts.
	for (const path of new Set([schemas, "schemas"])) {
		if (["mdbase.app-settings", "tasknotes.settings"].some((id) => hasFolder(`${path}/${id}`)))
			paths.push(path);
	}
	for (const path of new Set([taskSchemas, "_schemas"])) {
		if (hasFolder(`${path}/tasknotes`)) paths.push(path);
	}
	return [...new Set(paths)]
		.filter((path) => hasFolder(path))
		.filter((path, _, all) => !all.some((other) => path.startsWith(`${other}/`)));
}

export function mdbaseFolderCss(paths: string[]): string {
	return paths
		.map((path) => {
			// Quoted CSS attribute strings need escaping independently of vault path validation.
			const escaped = Array.from(path)
				.map((char) => {
					if (char === '"' || char === "\\") return `\\${char}`;
					const code = char.charCodeAt(0);
					return code < 32 || code === 127 ? `\\${code.toString(16)} ` : char;
				})
				.join("");
			return `.workspace-leaf-content[data-type="file-explorer"] .nav-folder:has(> .nav-folder-title[data-path="${escaped}"]) { display: none !important; }`;
		})
		.join("\n");
}

/** CSS only: files remain available to search, the quick switcher and every other view. */
export function installMdbaseFolderVisibility(plugin: TaskNotesPlugin): void {
	const ownerDocument = plugin.app.workspace.containerEl.ownerDocument;
	const sheet = new (ownerDocument.defaultView?.CSSStyleSheet ?? CSSStyleSheet)();
	ownerDocument.adoptedStyleSheets = [...ownerDocument.adoptedStyleSheets, sheet];
	let revision = 0;
	const refresh = async () => {
		const current = ++revision;
		let css = "";
		try {
			if (
				plugin.settings.hideMdbaseFolders &&
				(await plugin.app.vault.adapter.exists("mdbase.yaml"))
			) {
				const config = YAML.parse(await plugin.app.vault.adapter.read("mdbase.yaml")) as {
					spec_version?: unknown;
					settings?: { types_folder?: unknown; contracts_folder?: unknown };
				} | null;
				if (
					typeof config?.spec_version === "string" &&
					/^0\.[23]\./.test(config.spec_version)
				) {
					css = mdbaseFolderCss(
						mdbaseHiddenFolders(
							config.settings ?? {},
							(path) =>
								plugin.app.vault.getAbstractFileByPath(path) instanceof TFolder
						)
					);
				}
			}
		} catch {
			// An unreadable configuration cannot establish ownership of folders.
		}
		if (current === revision) sheet.replaceSync(css);
	};
	const update = () => {
		void refresh();
	};
	plugin.registerEvent(plugin.app.vault.on("create", update));
	plugin.registerEvent(plugin.app.vault.on("delete", update));
	plugin.registerEvent(plugin.app.vault.on("rename", update));
	plugin.registerEvent(
		plugin.app.vault.on("modify", (file) => {
			if (file.path === "mdbase.yaml") update();
		})
	);
	plugin.registerEvent(plugin.emitter.on("settings-changed", update));
	plugin.register(() => {
		revision++;
		ownerDocument.adoptedStyleSheets = ownerDocument.adoptedStyleSheets.filter(
			(entry) => entry !== sheet
		);
	});
	update();
}
