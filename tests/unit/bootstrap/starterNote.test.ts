import { App, TFile } from "obsidian";
import {
	getStarterNoteContent,
	openStarterNote,
	STARTER_NOTE_PATH,
} from "../../../src/bootstrap/starterNote";

async function removeStarterNoteIfPresent(): Promise<void> {
	const app = new App();
	const existing = app.vault.getAbstractFileByPath(STARTER_NOTE_PATH);
	if (existing instanceof TFile) {
		await app.vault.delete(existing);
	}
}

function createHost() {
	const app = new App();
	const openFile = jest.fn().mockResolvedValue(undefined);
	(app.workspace as unknown as { getLeaf: jest.Mock }).getLeaf = jest.fn(() => ({ openFile }));
	return { app, openFile, host: { app, warn: jest.fn() } };
}

describe("Start Here guide", () => {
	beforeEach(async () => {
		await removeStarterNoteIfPresent();
		jest.clearAllMocks();
	});

	it("creates and opens the guide when the vault does not have it", async () => {
		const { app, host, openFile } = createHost();

		await expect(openStarterNote(host)).resolves.toBe("created");

		const file = app.vault.getAbstractFileByPath(STARTER_NOTE_PATH);
		expect(file).toBeInstanceOf(TFile);
		await expect(app.vault.read(file as TFile)).resolves.toBe(getStarterNoteContent());
		expect(openFile).toHaveBeenCalledTimes(1);
		expect(openFile.mock.calls[0][0].path).toBe(STARTER_NOTE_PATH);
	});

	it("opens an existing guide without overwriting the user's edits", async () => {
		const { app, host, openFile } = createHost();
		await app.vault.create(STARTER_NOTE_PATH, "custom starter note");

		await expect(openStarterNote(host)).resolves.toBe("opened-existing");

		const file = app.vault.getAbstractFileByPath(STARTER_NOTE_PATH) as TFile;
		await expect(app.vault.read(file)).resolves.toBe("custom starter note");
		expect(openFile).toHaveBeenCalledTimes(1);
	});
});
