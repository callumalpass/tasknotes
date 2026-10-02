import { App, TFile } from "obsidian";
import { en } from "../../../src/i18n/resources/en";
import { createI18nService } from "../../../src/i18n";
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
	it("uses the current native settings vocabulary and starts with create, review, complete", () => {
		for (const route of [en.settings.native.taskFiles, en.ui.filterBar.properties,
			en.settings.features.taskCreation.header, en.settings.native.formFields,
			en.settings.native.appearanceInteraction]) {
			expect(STARTER_NOTE_CONTENT).toContain(route);
		}
		expect(STARTER_NOTE_CONTENT).not.toMatch(/General|Inline Task Settings|Modal Fields|Task Properties/);
		expect(STARTER_NOTE_CONTENT.indexOf("Create new task")).toBeLessThan(STARTER_NOTE_CONTENT.indexOf("Open today"));
		expect(STARTER_NOTE_CONTENT).toContain("Done");
		expect(STARTER_NOTE_CONTENT.length).toBeLessThan(2200);
	});

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
		expect(openFile).toHaveBeenCalledTimes(1);
		expect(openFile.mock.calls[0][0].path).toBe(STARTER_NOTE_PATH);
	});

	it("writes the activation steps in the configured language", async () => {
		const { app, host } = createHost({ shouldCreateStarterNote: true });
		const i18n = createI18nService({ initialLocale: "fr" });
		await ensureStarterNote({ ...host, translate: i18n.translate.bind(i18n) });
		const text = await app.vault.read(app.vault.getAbstractFileByPath(STARTER_NOTE_PATH) as TFile);
		expect(text).toContain("Premiers pas avec TaskNotes");
		expect(text).toContain("Apparence et interactions");
		expect(text).not.toContain("Tasks are Markdown notes");
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
		expect(openFile).toHaveBeenCalledTimes(1);
		expect(openFile.mock.calls[0][0].path).toBe(STARTER_NOTE_PATH);
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
