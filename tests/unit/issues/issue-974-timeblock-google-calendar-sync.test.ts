import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { TFile } from "obsidian";

import { TaskCalendarSyncService } from "../../../src/services/TaskCalendarSyncService";
import {
	createDailyNoteTimeblockSource,
	type TimeblockNoteSource,
} from "../../../src/services/TimeblockCalendarSync";
import type { TimeBlock } from "../../../src/types";
import { createCopiedTimeblock } from "../../../src/utils/helpers";
import { PluginFactory } from "../../helpers/mock-factories";

const CALENDAR_ID = "primary";

type Note = {
	date: string | null;
	timeblocks: TimeBlock[];
	invalidIds?: string[];
	/** False models frontmatter that Obsidian has not parsed or cannot parse */
	indexed?: boolean;
};
type Notes = Map<string, Note>;

const createSource = (notes: Notes, settled: { value: boolean } = { value: true }): TimeblockNoteSource => ({
	read: (notePath) => {
		const note = notes.get(notePath);
		if (!note) return null;
		if (note.indexed === false) return { date: null, timeblocks: [], indexed: false };
		return {
			date: note.date,
			timeblocks: [...note.timeblocks],
			invalidIds: [...(note.invalidIds ?? [])],
			indexed: true,
		};
	},
	listNotePaths: () =>
		Array.from(notes.entries())
			.filter(([, note]) => note.date)
			.map(([notePath]) => notePath),
	findNotesWithTimeblock: (timeblockId) =>
		Array.from(notes.entries())
			.filter(
				([, note]) =>
					note.timeblocks.some((tb) => tb.id === timeblockId) ||
					!!note.invalidIds?.includes(timeblockId)
			)
			.map(([notePath]) => notePath),
	isMetadataSettled: () => settled.value,
});

const createPlugin = (pluginData: Record<string, any>, calendarSettings = {}) => {
	const basePlugin = PluginFactory.createMockPlugin();
	const plugin = PluginFactory.createMockPlugin({
		settings: {
			...basePlugin.settings,
			googleCalendarExport: {
				...basePlugin.settings.googleCalendarExport,
				enabled: false,
				targetCalendarId: CALENDAR_ID,
				includeObsidianLink: false,
				eventColorId: null,
				syncTimeblocks: true,
				timeblockTargetCalendarId: "",
				timeblockEventTitleTemplate: "[TB] {{title}} {{startTime}}-{{endTime}}",
				...calendarSettings,
			},
		},
	});
	plugin.loadData = jest.fn(async () => pluginData);
	plugin.loadPluginDataForSafeWrite = jest.fn(async () => pluginData);
	plugin.saveData = jest.fn(async (data: Record<string, any>) => {
		Object.assign(pluginData, data);
	});
	return plugin;
};

const createGoogle = (calendarId = CALENDAR_ID) => {
	let nextId = 1;
	return {
		getAvailableCalendars: jest.fn().mockReturnValue([{ id: calendarId }]),
		createEvent: jest.fn(async () => ({ id: `google-${calendarId}-event-${nextId++}` })),
		updateEvent: jest.fn(async () => ({})),
		deleteEvent: jest.fn(async () => undefined),
	};
};

const timeblock = (id: string, overrides: Partial<TimeBlock> = {}): TimeBlock => ({
	id,
	title: "Deep work",
	startTime: "09:00",
	endTime: "10:30",
	...overrides,
});

const indexEntry = (notePath: string, timeblockId: string, eventId: string) => ({
	notePath,
	timeblockId,
	calendarId: CALENDAR_ID,
	eventId,
	fingerprint: "stale",
	updatedAt: 1,
});

const setup = (
	notes: Notes,
	pluginData: Record<string, any> = {},
	calendarSettings = {},
	settled = { value: true }
) => {
	const plugin = createPlugin(pluginData, calendarSettings);
	const google = createGoogle(
		(calendarSettings as { targetCalendarId?: string }).targetCalendarId ?? CALENDAR_ID
	);
	const service = new TaskCalendarSyncService(plugin, google as any, {
		timeblockSource: createSource(notes, settled),
	});
	service.timeblocks.initialize();
	return { plugin, google, service, sync: service.timeblocks, pluginData };
};

describe("Issue #974: sync daily-note timeblocks to Google Calendar", () => {
	afterEach(() => {
		TaskCalendarSyncService.clearSharedGoogleCalendarSyncStateForTests();
	});

	it("creates events only for timeblocks added after sync starts, using the timeblock title template", async () => {
		const notes: Notes = new Map([
			["Daily/2026-11-02.md", { date: "2026-11-02", timeblocks: [timeblock("old")] }],
		]);
		const { google, sync, pluginData } = setup(notes);

		notes.get("Daily/2026-11-02.md")!.timeblocks.push(timeblock("new", { title: "Review" }));
		sync.handleNoteChanged("Daily/2026-11-02.md");
		await sync.flush();

		expect(google.createEvent).toHaveBeenCalledTimes(1);
		expect(google.createEvent).toHaveBeenCalledWith(
			CALENDAR_ID,
			expect.objectContaining({
				summary: "[TB] Review 09:00-10:30",
				start: expect.objectContaining({ dateTime: "2026-11-02T09:00:00" }),
				end: expect.objectContaining({ dateTime: "2026-11-02T10:30:00" }),
			}),
			expect.any(Number)
		);
		expect(pluginData.googleCalendarTimeblockEventIndex).toEqual([
			expect.objectContaining({
				notePath: "Daily/2026-11-02.md",
				timeblockId: "new",
				calendarId: CALENDAR_ID,
				eventId: "event-1",
			}),
		]);
	});

	it("creates one event when saves overlap, including across service instances", async () => {
		const notePath = "Daily/2026-11-02.md";
		const notes: Notes = new Map([[notePath, { date: "2026-11-02", timeblocks: [] }]]);
		const pluginData: Record<string, any> = {};
		const first = setup(notes, pluginData);
		const second = setup(notes, pluginData);
		let releaseCreate: () => void = () => undefined;
		const createGate = new Promise<void>((resolve) => {
			releaseCreate = resolve;
		});
		let createStarted: () => void = () => undefined;
		const createInFlight = new Promise<void>((resolve) => {
			createStarted = resolve;
		});
		const createEvent = jest.fn(async () => {
			createStarted();
			await createGate;
			return { id: `google-${CALENDAR_ID}-event-1` };
		});
		first.google.createEvent = createEvent;
		second.google.createEvent = createEvent;

		notes.get(notePath)!.timeblocks.push(timeblock("tb-1"));
		first.sync.handleNoteChanged(notePath);
		second.sync.handleNoteChanged(notePath);
		const firstFlush = first.sync.flush();
		const secondFlush = second.sync.flush();
		// A further edit while the create is still in flight.
		await createInFlight;
		notes.get(notePath)!.timeblocks[0] = timeblock("tb-1", { title: "Renamed" });
		first.sync.handleNoteChanged(notePath);
		const thirdFlush = first.sync.flush();

		releaseCreate();
		await Promise.all([firstFlush, secondFlush, thirdFlush]);

		expect(createEvent).toHaveBeenCalledTimes(1);
		expect(pluginData.googleCalendarTimeblockEventIndex).toHaveLength(1);
		expect(first.google.updateEvent).toHaveBeenLastCalledWith(
			CALENDAR_ID,
			"event-1",
			expect.objectContaining({ summary: "[TB] Renamed 09:00-10:30" }),
			expect.any(Number)
		);
	});

	it("keeps the link and queues a retry when deleting a removed timeblock's event fails", async () => {
		const notePath = "Daily/2026-11-02.md";
		const notes: Notes = new Map([
			[notePath, { date: "2026-11-02", timeblocks: [timeblock("tb-1")] }],
		]);
		const pluginData: Record<string, any> = {
			googleCalendarTimeblockEventIndex: [indexEntry(notePath, "tb-1", "event-1")],
		};
		const { google, service, sync } = setup(notes, pluginData);
		google.deleteEvent.mockRejectedValueOnce(
			Object.assign(new Error("backend error"), { status: 500 })
		);

		notes.get(notePath)!.timeblocks = [];
		sync.handleNoteChanged(notePath);
		await sync.flush();

		expect(pluginData.googleCalendarTimeblockEventIndex).toEqual([
			expect.objectContaining({ timeblockId: "tb-1", eventId: "event-1" }),
		]);
		expect(pluginData.googleCalendarDeletionQueue).toEqual([
			expect.objectContaining({
				taskPath: notePath,
				timeblockId: "tb-1",
				calendarId: CALENDAR_ID,
				eventId: "event-1",
			}),
		]);

		await expect(service.processDeletionQueue()).resolves.toEqual({
			deleted: 1,
			failed: 0,
			remaining: 0,
		});
		expect(google.deleteEvent).toHaveBeenCalledTimes(2);
		expect(pluginData.googleCalendarTimeblockEventIndex).toEqual([]);
	});

	it("does not let a pending update recreate an event after its timeblock is deleted", async () => {
		const notePath = "Daily/2026-11-02.md";
		const notes: Notes = new Map([
			[notePath, { date: "2026-11-02", timeblocks: [timeblock("tb-1")] }],
		]);
		const pluginData: Record<string, any> = {
			googleCalendarTimeblockEventIndex: [indexEntry(notePath, "tb-1", "event-1")],
		};
		const { google, sync } = setup(notes, pluginData);

		// Edit (debounced update pending), then delete the daily note.
		notes.get(notePath)!.timeblocks = [timeblock("tb-1", { title: "Edited" })];
		sync.handleNoteChanged(notePath);
		notes.delete(notePath);
		sync.handleNoteDeleted(notePath);
		await sync.flush();

		expect(google.updateEvent).not.toHaveBeenCalled();
		expect(google.createEvent).not.toHaveBeenCalled();
		expect(google.deleteEvent).toHaveBeenCalledWith(CALENDAR_ID, "event-1", expect.any(Number));
		expect(pluginData.googleCalendarTimeblockEventIndex).toEqual([]);
	});

	it("does not recreate an event whose update 404s after the timeblock was removed", async () => {
		const notePath = "Daily/2026-11-02.md";
		const notes: Notes = new Map([
			[notePath, { date: "2026-11-02", timeblocks: [timeblock("tb-1")] }],
		]);
		const pluginData: Record<string, any> = {
			googleCalendarTimeblockEventIndex: [indexEntry(notePath, "tb-1", "event-1")],
		};
		const { google, sync } = setup(notes, pluginData);
		google.updateEvent.mockImplementationOnce(async () => {
			// The timeblock is deleted while the update request is in flight.
			notes.get(notePath)!.timeblocks = [];
			throw Object.assign(new Error("Not found"), { status: 404 });
		});

		notes.get(notePath)!.timeblocks = [timeblock("tb-1", { title: "Edited" })];
		sync.handleNoteChanged(notePath);
		await sync.flush();

		expect(google.createEvent).not.toHaveBeenCalled();
		expect(pluginData.googleCalendarTimeblockEventIndex).toEqual([]);
	});

	it("gives copied timeblocks their own events, so deleting a copy never deletes the original", async () => {
		const original = timeblock("tb-original");
		const notes: Notes = new Map([
			["Daily/2026-11-02.md", { date: "2026-11-02", timeblocks: [original] }],
			["Daily/2026-11-03.md", { date: "2026-11-03", timeblocks: [] }],
		]);
		const pluginData: Record<string, any> = {
			googleCalendarTimeblockEventIndex: [
				indexEntry("Daily/2026-11-02.md", "tb-original", "original-event"),
			],
		};
		const { google, sync } = setup(notes, pluginData);

		// Copy via the calendar (fresh ID) and by pasting the YAML into another day (same ID).
		notes
			.get("Daily/2026-11-02.md")!
			.timeblocks.push(createCopiedTimeblock(original, "14:00", "15:00"));
		notes.get("Daily/2026-11-03.md")!.timeblocks.push({ ...original });
		sync.handleNoteChanged("Daily/2026-11-02.md");
		sync.handleNoteChanged("Daily/2026-11-03.md");
		await sync.flush();

		expect(google.createEvent).toHaveBeenCalledTimes(2);

		notes.get("Daily/2026-11-02.md")!.timeblocks = [original];
		notes.get("Daily/2026-11-03.md")!.timeblocks = [];
		sync.handleNoteChanged("Daily/2026-11-02.md");
		sync.handleNoteChanged("Daily/2026-11-03.md");
		await sync.flush();

		const deletedEventIds = google.deleteEvent.mock.calls.map((call) => call[1]);
		expect(deletedEventIds.sort()).toEqual(["event-1", "event-2"]);
		expect(pluginData.googleCalendarTimeblockEventIndex).toEqual([
			expect.objectContaining({ timeblockId: "tb-original", eventId: "original-event" }),
		]);
	});

	it("keeps a timeblock's event when it is moved to another day", async () => {
		const moved = timeblock("tb-1");
		const notes: Notes = new Map([
			["Daily/2026-11-02.md", { date: "2026-11-02", timeblocks: [moved] }],
			["Daily/2026-11-03.md", { date: "2026-11-03", timeblocks: [] }],
		]);
		const pluginData: Record<string, any> = {
			googleCalendarTimeblockEventIndex: [indexEntry("Daily/2026-11-02.md", "tb-1", "event-1")],
		};
		const { google, sync } = setup(notes, pluginData);

		notes.get("Daily/2026-11-02.md")!.timeblocks = [];
		notes.get("Daily/2026-11-03.md")!.timeblocks = [moved];
		sync.handleNoteChanged("Daily/2026-11-02.md");
		sync.handleNoteChanged("Daily/2026-11-03.md");
		await sync.flush();
		await sync.flush();

		expect(google.deleteEvent).not.toHaveBeenCalled();
		expect(google.createEvent).not.toHaveBeenCalled();
		expect(google.updateEvent).toHaveBeenCalledWith(
			CALENDAR_ID,
			"event-1",
			expect.objectContaining({
				start: expect.objectContaining({ dateTime: "2026-11-03T09:00:00" }),
			}),
			expect.any(Number)
		);
	});

	it("stores the calendar ID separately so hyphenated calendar IDs round-trip to delete", async () => {
		const calendarId = "team-plans@group.calendar.google.com";
		const notePath = "Daily/2026-11-02.md";
		const notes: Notes = new Map([[notePath, { date: "2026-11-02", timeblocks: [] }]]);
		const { google, sync, pluginData } = setup(notes, {}, { targetCalendarId: calendarId });
		google.createEvent.mockResolvedValueOnce({ id: `google-${calendarId}-abc-123` });

		notes.get(notePath)!.timeblocks.push(timeblock("tb-1"));
		sync.handleNoteChanged(notePath);
		await sync.flush();

		expect(pluginData.googleCalendarTimeblockEventIndex).toEqual([
			expect.objectContaining({ calendarId, eventId: "abc-123" }),
		]);

		notes.get(notePath)!.timeblocks = [];
		sync.handleNoteChanged(notePath);
		await sync.flush();

		expect(google.deleteEvent).toHaveBeenCalledWith(calendarId, "abc-123", expect.any(Number));
	});
	it("reads a note whose frontmatter does not parse, or whose timeblock is mid-edit, as not deleted", () => {
		const caches: Record<string, unknown> = {
			// Obsidian 1.15's cache for invalid YAML: a YAML section but no frontmatter.
			"Daily/broken.md": {
				sections: [
					{ type: "yaml", position: { start: { line: 0 }, end: { line: 5 } } },
					{ type: "paragraph", position: { start: { line: 6 }, end: { line: 6 } } },
				],
			},
			"Daily/empty.md": {
				sections: [{ type: "yaml", position: { start: { line: 0 }, end: { line: 1 } } }],
			},
			// Valid frontmatter with only a blank line or comments parses to nothing
			// but keeps its position.
			"Daily/blank.md": {
				frontmatterPosition: { start: { line: 0 }, end: { line: 3 } },
				sections: [{ type: "yaml", position: { start: { line: 0 }, end: { line: 3 } } }],
			},
			"Daily/editing.md": {
				frontmatter: { timeblocks: [{ id: "tb-1", startTime: "09:00", endTime: "10:00" }] },
			},
		};
		const plugin = {
			app: {
				vault: { getAbstractFileByPath: (path: string) => new TFile(path) },
				metadataCache: { getFileCache: (file: TFile) => caches[file.path] },
			},
		};
		const source = createDailyNoteTimeblockSource(plugin as any);

		expect(source.read("Daily/broken.md")).toEqual(
			expect.objectContaining({ indexed: false, timeblocks: [] })
		);
		expect(source.read("Daily/empty.md")).toEqual(
			expect.objectContaining({ indexed: true, timeblocks: [] })
		);
		expect(source.read("Daily/blank.md")).toEqual(
			expect.objectContaining({ indexed: true, timeblocks: [] })
		);
		expect(source.read("Daily/editing.md")).toEqual(
			expect.objectContaining({ indexed: true, timeblocks: [], invalidIds: ["tb-1"] })
		);
	});

	it("keeps the events of timeblocks that are invalid mid-edit, and copies never adopt an unparseable note's event", async () => {
		const original = timeblock("tb-1");
		const notes: Notes = new Map([
			["Daily/2026-11-02.md", { date: "2026-11-02", timeblocks: [original] }],
			["Daily/2026-11-03.md", { date: "2026-11-03", timeblocks: [] }],
		]);
		const pluginData: Record<string, any> = {
			googleCalendarTimeblockEventIndex: [indexEntry("Daily/2026-11-02.md", "tb-1", "original-event")],
		};
		const { google, sync } = setup(notes, pluginData);

		// The title is cleared while being retyped: the timeblock fails validation.
		notes.set("Daily/2026-11-02.md", { date: null, timeblocks: [], invalidIds: ["tb-1"] });
		sync.handleNoteChanged("Daily/2026-11-02.md");
		await sync.flush();
		expect(google.deleteEvent).not.toHaveBeenCalled();

		// While the original's YAML is broken, a same-ID copy elsewhere gets its own event.
		notes.set("Daily/2026-11-02.md", { date: null, timeblocks: [], indexed: false });
		notes.get("Daily/2026-11-03.md")!.timeblocks.push({ ...original });
		sync.handleNoteChanged("Daily/2026-11-03.md");
		await sync.flush();

		expect(google.deleteEvent).not.toHaveBeenCalled();
		expect(google.createEvent).toHaveBeenCalledTimes(1);
		expect(pluginData.googleCalendarTimeblockEventIndex).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ notePath: "Daily/2026-11-02.md", eventId: "original-event" }),
				expect.objectContaining({ notePath: "Daily/2026-11-03.md", eventId: "event-1" }),
			])
		);
	});

	it("keeps events when a note is moved outside Obsidian as a delete followed by a create", async () => {
		const moved = timeblock("tb-1");
		const notes: Notes = new Map([
			["Daily/2026-11-02.md", { date: "2026-11-02", timeblocks: [moved] }],
		]);
		const pluginData: Record<string, any> = {
			googleCalendarTimeblockEventIndex: [indexEntry("Daily/2026-11-02.md", "tb-1", "event-1")],
		};
		const { google, sync } = setup(notes, pluginData);

		notes.delete("Daily/2026-11-02.md");
		sync.handleNoteDeleted("Daily/2026-11-02.md");
		// The new file is indexed a moment later, outside the daily-notes folder.
		await new Promise((resolve) => setTimeout(resolve, 50));
		notes.set("Archive/2026-11-02.md", { date: null, timeblocks: [moved] });
		sync.handleNoteCreated("Archive/2026-11-02.md");
		sync.handleNoteChanged("Archive/2026-11-02.md");
		await sync.flush();

		expect(google.deleteEvent).not.toHaveBeenCalled();
		expect(google.createEvent).not.toHaveBeenCalled();
		expect(pluginData.googleCalendarTimeblockEventIndex).toEqual([
			expect.objectContaining({ notePath: "Archive/2026-11-02.md", eventId: "event-1" }),
		]);
	});

	it("waits for indexing before startup deletes the events of a note moved while Obsidian was closed", async () => {
		const notes: Notes = new Map();
		const settled = { value: false };
		const pluginData: Record<string, any> = {
			googleCalendarTimeblockEventIndex: [indexEntry("Daily/2026-11-02.md", "tb-1", "event-1")],
		};
		const { google, sync } = setup(notes, pluginData, {}, settled);

		await sync.processRecovery(true);
		expect(google.deleteEvent).not.toHaveBeenCalled();

		notes.set("Archive/2026/2026-11-02.md", { date: null, timeblocks: [timeblock("tb-1")] });
		settled.value = true;
		await sync.processRecovery(false);
		await sync.flush();

		expect(google.deleteEvent).not.toHaveBeenCalled();
		expect(pluginData.googleCalendarTimeblockEventIndex).toEqual([
			expect.objectContaining({ notePath: "Archive/2026/2026-11-02.md", eventId: "event-1" }),
		]);
	});

	it("deletes a removed timeblock's event even when an old note shares its template ID", async () => {
		const notes: Notes = new Map([
			["Daily/2026-10-01.md", { date: "2026-10-01", timeblocks: [timeblock("tb-template")] }],
			["Daily/2026-11-02.md", { date: "2026-11-02", timeblocks: [timeblock("tb-template")] }],
		]);
		const pluginData: Record<string, any> = {
			googleCalendarTimeblockEventIndex: [
				indexEntry("Daily/2026-11-02.md", "tb-template", "event-1"),
			],
		};
		const { google, sync } = setup(notes, pluginData);

		notes.get("Daily/2026-11-02.md")!.timeblocks = [];
		sync.handleNoteChanged("Daily/2026-11-02.md");
		await sync.flush();
		await sync.flush();

		expect(google.updateEvent).not.toHaveBeenCalled();
		expect(google.deleteEvent).toHaveBeenCalledWith(CALENDAR_ID, "event-1", expect.any(Number));
		expect(pluginData.googleCalendarTimeblockEventIndex).toEqual([]);
	});

	it("does not move an event into an existing non-daily note that is first seen this session", async () => {
		const notes: Notes = new Map([
			["Daily/2026-11-02.md", { date: "2026-11-02", timeblocks: [timeblock("tb-template")] }],
			["Projects/Plan.md", { date: null, timeblocks: [timeblock("tb-template")] }],
		]);
		const pluginData: Record<string, any> = {
			googleCalendarTimeblockEventIndex: [
				indexEntry("Daily/2026-11-02.md", "tb-template", "event-1"),
			],
		};
		const { google, sync } = setup(notes, pluginData);

		// An edit to the old project note is its first change this session.
		notes.get("Projects/Plan.md")!.timeblocks[0].title = "Edited";
		sync.handleNoteChanged("Projects/Plan.md");
		notes.get("Daily/2026-11-02.md")!.timeblocks = [];
		sync.handleNoteChanged("Daily/2026-11-02.md");
		await sync.flush();
		await sync.flush();

		expect(google.deleteEvent).toHaveBeenCalledWith(CALENDAR_ID, "event-1", expect.any(Number));
		expect(pluginData.googleCalendarTimeblockEventIndex).toEqual([]);
	});

	it("keeps a queued deletion queued while the note's frontmatter does not parse", async () => {
		const notePath = "Daily/2026-11-02.md";
		const notes: Notes = new Map([
			[notePath, { date: "2026-11-02", timeblocks: [timeblock("tb-1")] }],
		]);
		const pluginData: Record<string, any> = {
			googleCalendarTimeblockEventIndex: [indexEntry(notePath, "tb-1", "event-1")],
		};
		const { google, service, sync } = setup(notes, pluginData);
		google.deleteEvent.mockRejectedValueOnce(
			Object.assign(new Error("backend error"), { status: 500 })
		);
		notes.get(notePath)!.timeblocks = [];
		sync.handleNoteChanged(notePath);
		await sync.flush();
		expect(pluginData.googleCalendarDeletionQueue).toHaveLength(1);

		notes.get(notePath)!.indexed = false;
		await expect(service.processDeletionQueue()).resolves.toEqual(
			expect.objectContaining({ deleted: 0, remaining: 1 })
		);
		expect(google.deleteEvent).toHaveBeenCalledTimes(1);

		notes.get(notePath)!.indexed = true;
		await expect(service.processDeletionQueue()).resolves.toEqual(
			expect.objectContaining({ deleted: 1, remaining: 0 })
		);
	});

	it("does not lose plugin-data writes made concurrently by timeblock and task sync", async () => {
		let stored: Record<string, any> = {};
		const { plugin, service, sync } = setup(new Map());
		const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
		plugin.loadPluginDataForSafeWrite = jest.fn(async () => {
			const copy = JSON.parse(JSON.stringify(stored));
			await tick();
			return copy;
		});
		plugin.saveData = jest.fn(async (data: Record<string, any>) => {
			await tick();
			stored = JSON.parse(JSON.stringify(data));
		});

		await Promise.all([
			(sync as any).upsertIndexEntry(indexEntry("Daily/2026-11-02.md", "tb-1", "event-1")),
			(service as any).queueCalendarDeletion("Tasks/a.md", CALENDAR_ID, "orphan", new Error("x")),
			(sync as any).queueSyncRetry("Daily/2026-11-03.md", "tb-2", new Error("offline")),
		]);

		expect(stored.googleCalendarTimeblockEventIndex).toHaveLength(1);
		expect(stored.googleCalendarDeletionQueue).toHaveLength(1);
		expect(stored.googleCalendarTimeblockSyncQueue).toHaveLength(1);
	});
});
