jest.mock("obsidian-daily-notes-interface", () => ({
	appHasDailyNotesPluginLoaded: jest.fn(),
	createDailyNote: jest.fn(),
	getAllDailyNotes: jest.fn(),
	getDailyNote: jest.fn(),
}));

import {
	appHasDailyNotesPluginLoaded,
	getAllDailyNotes,
	getDailyNote,
} from "obsidian-daily-notes-interface";
import { PomodoroService } from "../../../src/services/PomodoroService";
import type { PomodoroSessionHistory } from "../../../src/types";

const mockedAppHasDailyNotesPluginLoaded =
	appHasDailyNotesPluginLoaded as jest.MockedFunction<typeof appHasDailyNotesPluginLoaded>;
const mockedGetAllDailyNotes = getAllDailyNotes as jest.MockedFunction<typeof getAllDailyNotes>;
const mockedGetDailyNote = getDailyNote as jest.MockedFunction<typeof getDailyNote>;

function createSession(id: string, startTime: string): PomodoroSessionHistory {
	const endTime = new Date(new Date(startTime).getTime() + 25 * 60 * 1000).toISOString();

	return {
		id,
		startTime,
		endTime,
		plannedDuration: 25,
		type: "work",
		taskPath: `Tasks/${id}.md`,
		completed: true,
		activePeriods: [{ startTime, endTime }],
	};
}

function dateKeyFromLocalDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function createPlugin(options: {
	storageLocation: "plugin" | "daily-notes";
	pluginHistory?: PomodoroSessionHistory[];
	dailyNoteSessions?: Record<string, PomodoroSessionHistory[]>;
}) {
	const dailyNoteSessions = options.dailyNoteSessions ?? {};
	const dailyNotes = Object.fromEntries(
		Object.keys(dailyNoteSessions).map((dateKey) => [
			dateKey,
			{ path: `Daily/${dateKey}.md` },
		])
	);
	let pluginData = { pomodoroHistory: options.pluginHistory ?? [] };

	mockedGetAllDailyNotes.mockReturnValue(dailyNotes as any);
	mockedGetDailyNote.mockImplementation((momentValue: any, notes: Record<string, any>) => {
		const date =
			typeof momentValue?.toDate === "function"
				? momentValue.toDate()
				: momentValue?.date instanceof Date
					? momentValue.date
					: momentValue;
		return notes[dateKeyFromLocalDate(date)];
	});

	return {
		settings: {
			pomodoroWorkDuration: 25,
			pomodoroStorageLocation: options.storageLocation,
		},
		i18n: {
			translate: jest.fn((key: string) => key),
		},
		loadData: jest.fn(async () => pluginData),
		saveData: jest.fn(async (data: typeof pluginData) => {
			pluginData = data;
		}),
		app: {
			fileManager: {
				processFrontMatter: jest.fn(
					async (file: { path: string }, callback: (frontmatter: any) => void) => {
						const dateKey = file.path.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
						const frontmatter = {
							pomodoros: [...(dailyNoteSessions[dateKey] ?? [])],
						};
						callback(frontmatter);
						dailyNoteSessions[dateKey] = frontmatter.pomodoros;
					}
				),
			},
			metadataCache: {
				getFileCache: jest.fn(),
			},
		},
		fieldMapper: {
			toUserField: jest.fn(() => "pomodoros"),
		},
		emitter: {
			trigger: jest.fn(),
		},
		taskService: {
			startTimeTracking: jest.fn(),
			stopTimeTracking: jest.fn(),
		},
		_dailyNoteSessions: dailyNoteSessions,
	};
}

describe("Issue #1147: deleting Pomodoro session history", () => {
	beforeEach(() => {
		mockedAppHasDailyNotesPluginLoaded.mockReturnValue(true);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it("removes a session from plugin storage", async () => {
		const deletedSession = createSession("delete-me", "2026-04-26T09:00:00.000Z");
		const keptSession = createSession("keep-me", "2026-04-26T10:00:00.000Z");
		const plugin = createPlugin({
			storageLocation: "plugin",
			pluginHistory: [deletedSession, keptSession],
		});
		const service = new PomodoroService(plugin as any);

		await expect(service.deleteSessionFromHistory(deletedSession)).resolves.toBe(true);

		expect(plugin.saveData).toHaveBeenCalledWith({ pomodoroHistory: [keptSession] });
	});

	it("removes a session from daily-note storage and legacy plugin history", async () => {
		const deletedSession = createSession("delete-me", "2026-04-26T09:00:00.000Z");
		const keptSession = createSession("keep-me", "2026-04-26T10:00:00.000Z");
		const plugin = createPlugin({
			storageLocation: "daily-notes",
			pluginHistory: [deletedSession],
			dailyNoteSessions: {
				"2026-04-26": [deletedSession, keptSession],
			},
		});
		const service = new PomodoroService(plugin as any);

		await expect(service.deleteSessionFromHistory(deletedSession)).resolves.toBe(true);

		expect(plugin.saveData).toHaveBeenCalledWith({ pomodoroHistory: [] });
		expect(plugin._dailyNoteSessions["2026-04-26"]).toEqual([keptSession]);
	});
});
