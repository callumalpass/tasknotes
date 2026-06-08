import { App, TFile } from "obsidian";
import {
	ensureStarterNote,
	STARTER_NOTE_CONTENT,
	STARTER_NOTE_PATH,
} from "../../../src/bootstrap/starterNote";

async function removeStarterNoteIfPresent(): Promise<void> {
	const app = new App();
	const existing = app.vault.getAbstractFileByPath(STARTER_NOTE_PATH);
	if (existing instanceof TFile) {
		await app.vault.delete(existing);
	}
}

function createHost(options: { shouldCreateStarterNote: boolean; starterNoteCreated?: boolean }) {
	const app = new App();
	const openFile = jest.fn().mockResolvedValue(undefined);
	(app.workspace as unknown as { getLeaf: jest.Mock }).getLeaf = jest.fn(() => ({ openFile }));

	const settings = {
		starterNoteCreated: options.starterNoteCreated ?? false,
	};

	const saveSettings = jest.fn().mockResolvedValue(undefined);
	const warn = jest.fn();

	return {
		app,
		openFile,
		saveSettings,
		settings,
		warn,
		host: {
			app,
			settings,
			shouldCreateStarterNote: options.shouldCreateStarterNote,
			saveSettings,
			warn,
		},
	};
}

describe("starter note onboarding", () => {
	beforeEach(async () => {
		await removeStarterNoteIfPresent();
		jest.clearAllMocks();
	});

	it("creates and opens the starter note when first-install onboarding is requested", async () => {
		const { app, host, openFile, saveSettings, settings } = createHost({
			shouldCreateStarterNote: true,
		});

		await expect(ensureStarterNote(host)).resolves.toBe("created");

		const file = app.vault.getAbstractFileByPath(STARTER_NOTE_PATH);
		expect(file).toBeInstanceOf(TFile);
		await expect(app.vault.read(file as TFile)).resolves.toBe(STARTER_NOTE_CONTENT);
		expect(settings.starterNoteCreated).toBe(true);
		expect(saveSettings).toHaveBeenCalledTimes(1);
		expect(openFile).toHaveBeenCalledWith(expect.objectContaining({ path: STARTER_NOTE_PATH }));
	});

	it("opens an existing starter note without overwriting it", async () => {
		const { app, host, openFile, saveSettings, settings } = createHost({
			shouldCreateStarterNote: true,
		});
		await app.vault.create(STARTER_NOTE_PATH, "custom starter note");

		await expect(ensureStarterNote(host)).resolves.toBe("opened-existing");

		const file = app.vault.getAbstractFileByPath(STARTER_NOTE_PATH) as TFile;
		await expect(app.vault.read(file)).resolves.toBe("custom starter note");
		expect(settings.starterNoteCreated).toBe(true);
		expect(saveSettings).toHaveBeenCalledTimes(1);
		expect(openFile).toHaveBeenCalledWith(expect.objectContaining({ path: STARTER_NOTE_PATH }));
	});

	it("does not create the starter note for an existing install", async () => {
		const { app, host, openFile, saveSettings } = createHost({
			shouldCreateStarterNote: false,
		});

		await expect(ensureStarterNote(host)).resolves.toBe("not-first-install");

		expect(app.vault.getAbstractFileByPath(STARTER_NOTE_PATH)).toBeNull();
		expect(saveSettings).not.toHaveBeenCalled();
		expect(openFile).not.toHaveBeenCalled();
	});

	it("does not recreate the starter note after it has already been handled", async () => {
		const { app, host, openFile, saveSettings } = createHost({
			shouldCreateStarterNote: true,
			starterNoteCreated: true,
		});

		await expect(ensureStarterNote(host)).resolves.toBe("already-created");

		expect(app.vault.getAbstractFileByPath(STARTER_NOTE_PATH)).toBeNull();
		expect(saveSettings).not.toHaveBeenCalled();
		expect(openFile).not.toHaveBeenCalled();
	});
});
