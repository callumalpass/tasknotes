import { type App, type Editor, moment, TFile } from "obsidian";
import type { Moment } from "moment";
import type { EmbeddableMarkdownEditor } from "../editor/EmbeddableMarkdownEditor";

interface PasteImageRenamer {
	settings?: { autoRename?: boolean };
	isExcluded(file: TFile, source: TFile): boolean;
	testExcludeExtension(file: TFile): boolean;
	sourceProtectionReason(source: TFile): string | undefined;
	generateNewName(
		file: TFile,
		source: TFile,
		now: Moment
	): { newName: string; isMeaningful: boolean };
	renameFile(file: TFile, name: string, sourcePath: string): Promise<void>;
}

interface ClipboardImage {
	file: File;
	pastedAt: number;
}

interface DraftImage {
	file: TFile;
	originalPath: string;
	pastes: ClipboardImage[];
}

const draftImages = new WeakMap<EmbeddableMarkdownEditor, DraftImage[]>();

function getAutoRenamer(app: App): PasteImageRenamer | undefined {
	// These methods are present in Paste image rename releases that require indexed source ownership.
	const { plugins } = app as unknown as { plugins?: { getPlugin?(id: string): unknown } };
	const renamer = plugins?.getPlugin?.("obsidian-paste-image-rename") as
		| Partial<PasteImageRenamer>
		| undefined;
	if (
		renamer?.settings?.autoRename === true &&
		typeof renamer.isExcluded === "function" &&
		typeof renamer.testExcludeExtension === "function" &&
		typeof renamer.sourceProtectionReason === "function" &&
		typeof renamer.generateNewName === "function" &&
		typeof renamer.renameFile === "function"
	) {
		return renamer as PasteImageRenamer;
	}
}

export function captureDraftImagePastes(
	app: App,
	editor: EmbeddableMarkdownEditor
): ((file: TFile) => void) | undefined {
	if (!getAutoRenamer(app)) return;

	const pastes: ClipboardImage[] = [];
	const images: DraftImage[] = [];
	draftImages.set(editor, images);
	const nativeEditor = editor.editor as unknown as Editor;
	editor.registerEvent(
		app.workspace.on("editor-paste", (event, target) => {
			const files = event.clipboardData?.files;
			if (target !== nativeEditor || event.defaultPrevented || files?.length !== 1) return;
			const file = files[0];
			if (file.type === "image/png" || file.type === "image/jpeg") {
				pastes.push({ file, pastedAt: Date.now() });
			}
		})
	);

	return (file) => {
		if (!/^Pasted image \d{14,17}(?: \d+)?\.(?:png|jpg)$/i.test(file.name)) return;
		if (file.path.split("/").some((part) => part.startsWith("."))) return;
		const mimeType = file.extension.toLowerCase() === "png" ? "image/png" : "image/jpeg";
		const matching = pastes.filter(
			(paste) => paste.file.type === mimeType && paste.file.size === file.stat.size
		);
		if (matching.length > 0) images.push({ file, originalPath: file.path, pastes: matching });
	};
}

function waitForSavedTaskCache(app: App, task: TFile): Promise<void> {
	if (app.metadataCache.getFileCache(task)) return Promise.resolve();

	return new Promise((resolve) => {
		const finish = () => {
			window.clearTimeout(timeout);
			app.metadataCache.offref(ref);
			resolve();
		};
		const ref = app.metadataCache.on("changed", (file) => {
			if (file === task) finish();
		});
		const timeout = window.setTimeout(finish, 5000);
	});
}

async function matchClipboardImage(
	app: App,
	image: DraftImage
): Promise<ClipboardImage | undefined> {
	const stored = new Uint8Array(await app.vault.readBinary(image.file));
	for (const paste of [...image.pastes].reverse()) {
		const clipboard = new Uint8Array(await paste.file.arrayBuffer());
		if (
			stored.length === clipboard.length &&
			stored.every((byte, index) => byte === clipboard[index])
		) {
			return paste;
		}
	}
}

export async function renameSavedDraftImages(
	app: App,
	task: TFile,
	editor: EmbeddableMarkdownEditor | null
): Promise<void> {
	const candidates = editor && draftImages.get(editor);
	const renamer = candidates?.length ? getAutoRenamer(app) : undefined;
	if (!candidates || !renamer) return;
	const vault = app.vault as unknown as { getConfig?(key: string): unknown };
	if (vault.getConfig?.("alwaysUpdateLinks") === false) return;

	// Use the saved task as the source so Obsidian can update its link when the plugin renames
	// the file. Clipboard bytes distinguish native pastes from other files created in the vault.
	await waitForSavedTaskCache(app, task);
	const referencesImage = (file: TFile) =>
		app.vault.getFileByPath(task.path) === task &&
		app.metadataCache
			.getFileCache(task)
			?.embeds?.some(
				(embed) => app.metadataCache.getFirstLinkpathDest(embed.link, task.path) === file
			);
	const isOriginal = (image: DraftImage) =>
		image.file.path === image.originalPath &&
		app.vault.getFileByPath(image.originalPath) === image.file;

	for (const image of candidates) {
		const { file } = image;
		if (!isOriginal(image) || !referencesImage(file)) continue;
		if (renamer.isExcluded(file, task) || renamer.testExcludeExtension(file)) continue;
		const modifiedAt = file.stat.mtime;
		const pasted = await matchClipboardImage(app, image);
		if (
			!pasted ||
			file.stat.mtime !== modifiedAt ||
			!isOriginal(image) ||
			!referencesImage(file) ||
			renamer.sourceProtectionReason(task)
		) {
			continue;
		}
		const pastedAt = (moment as unknown as (timestamp: number) => Moment)(pasted.pastedAt);
		const { isMeaningful, newName } = renamer.generateNewName(file, task, pastedAt);
		if (isMeaningful) await renamer.renameFile(file, newName, task.path);
	}
}
