import { EventEmitter } from "events";
import momentModule from "moment";
import type {
	App as ObsidianApp,
	DataWriteOptions,
	FileStats,
	TFile as ObsidianTFile,
} from "obsidian";
import {
	App as RuntimeAppClass,
	Menu,
	Notice,
	Platform,
	TFile as RuntimeTFileClass,
	TAbstractFile,
	TFolder,
	parseYaml,
	stringifyYaml,
	type Vault,
} from "./obsidian-bridge";

export * from "./obsidian-bridge";

type RuntimeApp = RuntimeAppClass;
type RuntimeTFile = RuntimeTFileClass;

export const moment = momentModule;
export { Platform };

let currentApp: RuntimeApp = RuntimeAppClass.createConfigured__();
const vaultEvents = new EventEmitter();
const legacyContent = new Map<string, string>();

function setCurrentApp(app: RuntimeApp): RuntimeApp {
	stabilizeStrictProxy(app);
	stabilizeApp(app);
	stabilizeMetadataCache(app);
	currentApp = app;
	(globalThis as { app?: ObsidianApp }).app = app.asOriginalType__();
	return app;
}

function stabilizeApp(app: RuntimeApp): void {
	const appRecord = app as unknown as { renderContext?: Record<string, never> };
	appRecord.renderContext = {};
}

function stabilizeStrictProxy<T extends object>(value: T): T {
	const record = value as Record<string, unknown>;
	record.$$typeof = undefined;
	record.asymmetricMatch = undefined;
	record.nodeType = undefined;
	return value;
}

function stabilizeFile<T extends RuntimeTFile>(file: T): T {
	return stabilizeStrictProxy(file);
}

function stabilizeMetadataCache(app: RuntimeApp): void {
	const metadataCache = app.metadataCache as typeof app.metadataCache & {
		setCache?: typeof app.metadataCache.setCache__;
		deleteCache?: (path: string) => void;
	};
	metadataCache.setCache = (path, cache) => {
		app.metadataCache.cache__.set(path, cache);
		const file = app.vault.getAbstractFileByPath(path);
		if (file) {
			app.metadataCache.trigger("changed", file, "", cache);
			return;
		}
		app.metadataCache.trigger("changed");
	};
	metadataCache.deleteCache = (path: string) => {
		app.metadataCache.cache__.delete(path);
	};
}

function cacheFrontmatterFromContent(app: RuntimeApp, path: string, content: string): void {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	if (!match) {
		return;
	}

	try {
		const frontmatter = parseYaml(match[1] || "");
		if (frontmatter && typeof frontmatter === "object" && !Array.isArray(frontmatter)) {
			app.metadataCache.cache__.set(path, { frontmatter });
		}
	} catch {
		// Tests that cover malformed YAML call the parser path directly.
	}
}

export function resetObsidianRuntime(files: Record<string, string> = {}): RuntimeApp {
	vaultEvents.removeAllListeners();
	legacyContent.clear();
	for (const [path, content] of Object.entries(files)) {
		legacyContent.set(path, content);
	}
	return setCurrentApp(RuntimeAppClass.createConfigured__({ files }));
}

export function getObsidianRuntimeApp(): RuntimeApp {
	return currentApp;
}

export function createMockApp(files: Record<string, string> = {}): RuntimeApp {
	legacyContent.clear();
	for (const [path, content] of Object.entries(files)) {
		legacyContent.set(path, content);
	}
	return setCurrentApp(RuntimeAppClass.createConfigured__({ files }));
}

export function createOriginalApp(files: Record<string, string> = {}): ObsidianApp {
	return createMockApp(files).asOriginalType__();
}

export function createTestFile(
	path: string,
	content = "",
	app: RuntimeApp = currentApp
): RuntimeTFile {
	const existing = app.vault.getFileByPath(path);
	if (existing) {
		if (content && !legacyContent.has(existing.path)) {
			legacyContent.set(existing.path, content);
		}
		return stabilizeFile(existing);
	}
	const file = app.vault.createSync__(path, content);
	legacyContent.set(file.path, content);
	cacheFrontmatterFromContent(app, file.path, content);
	vaultEvents.emit("create", file);
	return stabilizeFile(file);
}

export function getTestFile(
	path: string,
	app: RuntimeApp = currentApp
): RuntimeTFile | null {
	return app.vault.getFileByPath(path);
}

export function createOriginalTestFile(
	path: string,
	content = "",
	app: RuntimeApp = currentApp
): ObsidianTFile {
	return createTestFile(path, content, app).asOriginalType2__();
}

export function readTestFile(path: string, app: RuntimeApp = currentApp): Promise<string> {
	const file = app.vault.getFileByPath(path);
	if (!file) {
		throw new Error(`Test file not found: ${path}`);
	}
	return app.vault.read(file);
}

export function runtimeVault(app: RuntimeApp = currentApp): Vault {
	return app.vault;
}

const AppFacade = function App(files: Record<string, string> = {}) {
	return createMockApp(files);
} as unknown as typeof RuntimeAppClass & {
	new (files?: Record<string, string>): RuntimeApp;
};
Object.setPrototypeOf(AppFacade, RuntimeAppClass);
AppFacade.prototype = RuntimeAppClass.prototype;
export { AppFacade as App };

const TFileFacade = function TFile(path = "", app: RuntimeApp = currentApp) {
	return stabilizeFile(RuntimeTFileClass.create__(app.vault, path));
} as unknown as typeof RuntimeTFileClass & {
	new (path?: string, app?: RuntimeApp): RuntimeTFile;
};
Object.setPrototypeOf(TFileFacade, RuntimeTFileClass);
TFileFacade.prototype = RuntimeTFileClass.prototype;
export { TFileFacade as TFile };

type LegacyMockFile = {
	path: string;
	name: string;
	basename: string;
	extension: string;
	content: string;
	stat: FileStats;
};

function legacyFile(path: string, content = ""): LegacyMockFile {
	const file = currentApp.vault.getFileByPath(path) ?? createTestFile(path, content);
	const fileContent = legacyContent.get(file.path) ?? content;
	return {
		path: file.path,
		name: file.name,
		basename: file.basename,
		extension: file.extension,
		content: fileContent,
		stat: file.stat,
	};
}

function createLegacyFileSystem() {
	return {
		create(path: string, content: string): LegacyMockFile {
			const file = createTestFile(path, content);
			return legacyFile(file.path, content);
		},
		modify(file: { path: string }, content: string): void {
			const existing = currentApp.vault.getFileByPath(file.path) ?? createTestFile(file.path);
			const adapter = currentApp.vault.adapter as typeof currentApp.vault.adapter & {
				writeSync__?: (path: string, data: string, options?: DataWriteOptions) => void;
			};
			if (adapter.writeSync__) {
				adapter.writeSync__(existing.path, content);
				legacyContent.set(existing.path, content);
				vaultEvents.emit("modify", existing);
				return;
			}
			void currentApp.vault.modify(existing, content);
			legacyContent.set(existing.path, content);
			vaultEvents.emit("modify", existing);
		},
		delete(path: string): void {
			const file = currentApp.vault.getFileByPath(path);
			if (file) {
				currentApp.vault.deleteVaultAbstractFile__(file.path);
				legacyContent.delete(file.path);
				vaultEvents.emit("delete", file);
			}
		},
		exists(path: string): boolean {
			return currentApp.vault.getAbstractFileByPath(path) !== null;
		},
		read(path: string): string {
			if (legacyContent.has(path)) {
				return legacyContent.get(path) ?? "";
			}
			const adapter = currentApp.vault.adapter as typeof currentApp.vault.adapter & {
				readSync__?: (path: string) => string;
			};
			if (adapter.readSync__) {
				return adapter.readSync__(path);
			}
			const file = currentApp.vault.getFileByPath(path);
			if (!file) {
				throw new Error(`File not found: ${path}`);
			}
			throw new Error(`Synchronous read unavailable for ${file.path}; use vault.read in runtime tests.`);
		},
		getFile(path: string): LegacyMockFile | undefined {
			const file = currentApp.vault.getFileByPath(path);
			return file ? legacyFile(file.path) : undefined;
		},
		getFiles(): LegacyMockFile[] {
			return currentApp.vault.getFiles().map((file) => legacyFile(file.path));
		},
		on(event: string, callback: (...args: unknown[]) => void): void {
			vaultEvents.on(event, callback);
		},
		off(event: string, callback: (...args: unknown[]) => void): void {
			vaultEvents.off(event, callback);
		},
		reset(): void {
			resetObsidianRuntime();
		},
	};
}

export const MockObsidian = {
	reset: () => {
		resetObsidianRuntime();
		Menu.mockClear();
		Notice.mockClear();
	},
	getFileSystem: createLegacyFileSystem,
	createTestFile: (path: string, content = "") => {
		const file = createTestFile(path, content);
		return legacyFile(file.path, content);
	},
	getTestFiles: () => createLegacyFileSystem().getFiles(),
	createMockApp: () => createMockApp(),
	Menu,
	Notice,
};

export { TAbstractFile, TFolder, parseYaml, stringifyYaml };
