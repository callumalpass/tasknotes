import { describe, expect, it, jest } from "@jest/globals";

import { TFile } from "obsidian";

import { createDailyNoteTimeblockSource } from "../../../src/services/TimeblockCalendarSync";

jest.mock("obsidian-daily-notes-interface", () => ({
	appHasDailyNotesPluginLoaded: () => true,
	// What the library throws when the Daily Notes folder doesn't exist.
	getAllDailyNotes: () => {
		throw new Error("Failed to find daily notes folder");
	},
}));

describe("Issue #2478: missing Daily Notes folder", () => {
	it("lists no daily notes instead of throwing during startup timeblock sync", () => {
		const plugin = {
			app: {
				vault: { getAbstractFileByPath: (path: string) => new TFile(path) },
				metadataCache: {
					getFileCache: () => ({
						frontmatter: {
							timeblocks: [{ id: "tb-1", title: "Focus", startTime: "09:00", endTime: "10:00" }],
						},
					}),
				},
			},
		};
		const source = createDailyNoteTimeblockSource(plugin as any);

		expect(source.listNotePaths()).toEqual([]);
		expect(source.read("Elsewhere/note.md")).toEqual(
			expect.objectContaining({ date: null, indexed: true })
		);
	});
});
