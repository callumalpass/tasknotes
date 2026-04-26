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
import { PomodoroSessionHistory } from "../../../src/types";

const mockedAppHasDailyNotesPluginLoaded =
	appHasDailyNotesPluginLoaded as jest.MockedFunction<typeof appHasDailyNotesPluginLoaded>;
const mockedGetAllDailyNotes = getAllDailyNotes as jest.MockedFunction<typeof getAllDailyNotes>;
const mockedGetDailyNote = getDailyNote as jest.MockedFunction<typeof getDailyNote>;

function createSession(
	id: string,
	startTime: string,
	completed = true
): PomodoroSessionHistory {
	const start = new Date(startTime);
	const end = new Date(start.getTime() + 25 * 60 * 1000).toISOString();

	return {
		id,
		startTime,
		endTime: end,
		plannedDuration: 25,
		type: "work",
		completed,
		activePeriods: [{ startTime, endTime: end }],
	};
}

function dateKeyFromLocalDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function createMockPlugin(options: {
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
	const metadataCache = {
		getFileCache: jest.fn((file: { path: string }) => {
			const dateKey = file.path.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
			return {
				frontmatter: {
					pomodoros: dailyNoteSessions[dateKey] ?? [],
				},
			};
		}),
	};
	const fileManager = {
		processFrontMatter: jest.fn(
			async (file: { path: string }, callback: (frontmatter: any) => void) => {
				const dateKey = file.path.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
				const frontmatter = {
					pomodoros: dailyNoteSessions[dateKey] ?? [],
				};
				callback(frontmatter);
			}
		),
	};

	mockedGetAllDailyNotes.mockReturnValue(dailyNotes as any);
	mockedGetDailyNote.mockImplementation((momentValue: any, notes: Record<string, any>) => {
		const date = momentValue?.date instanceof Date ? momentValue.date : momentValue;
		return notes[dateKeyFromLocalDate(date)];
	});

	return {
		settings: {
			pomodoroWorkDuration: 25,
			pomodoroStorageLocation: "daily-notes",
		},
		i18n: {
			translate: jest.fn((key: string) => key),
		},
		loadData: jest.fn().mockResolvedValue({
			pomodoroHistory: options.pluginHistory ?? [],
		}),
		saveData: jest.fn().mockResolvedValue(undefined),
		app: {
			metadataCache,
			fileManager,
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
	};
}

describe("PomodoroService stats reads", () => {
	const originalMoment = (globalThis.window as any).moment;

	beforeEach(() => {
		mockedAppHasDailyNotesPluginLoaded.mockReturnValue(true);
		(globalThis.window as any).moment = jest.fn((date: Date) => ({ date }));
	});

	afterEach(() => {
		(globalThis.window as any).moment = originalMoment;
		jest.clearAllMocks();
	});

	it("loads date stats from the matching daily note instead of scanning all daily notes", async () => {
		const targetDate = new Date(Date.UTC(2026, 3, 26));
		const todaySession = createSession("today-daily-note", "2026-04-26T09:00:00.000Z");
		const legacyTodaySession = createSession("today-plugin", "2026-04-26T10:00:00.000Z");
		const legacyYesterdaySession = createSession(
			"yesterday-plugin",
			"2026-04-25T10:00:00.000Z"
		);
		const plugin = createMockPlugin({
			pluginHistory: [legacyTodaySession, legacyYesterdaySession],
			dailyNoteSessions: {
				"2026-04-24": [createSession("not-in-range", "2026-04-24T09:00:00.000Z")],
				"2026-04-26": [todaySession],
			},
		});
		const service = new PomodoroService(plugin as any);
		const getSessionHistorySpy = jest.spyOn(service, "getSessionHistory");

		const stats = await service.getStatsForDate(targetDate);

		expect(stats.pomodorosCompleted).toBe(2);
		expect(getSessionHistorySpy).not.toHaveBeenCalled();
		expect(plugin.app.metadataCache.getFileCache).toHaveBeenCalledTimes(1);
		expect(plugin.app.metadataCache.getFileCache).toHaveBeenCalledWith({
			path: "Daily/2026-04-26.md",
		});
	});

	it("loads range stats from only the daily notes in the requested range", async () => {
		const plugin = createMockPlugin({
			dailyNoteSessions: {
				"2026-04-24": [createSession("before", "2026-04-24T09:00:00.000Z")],
				"2026-04-25": [createSession("start", "2026-04-25T09:00:00.000Z")],
				"2026-04-26": [createSession("end", "2026-04-26T09:00:00.000Z")],
				"2026-04-27": [createSession("after", "2026-04-27T09:00:00.000Z")],
			},
		});
		const service = new PomodoroService(plugin as any);

		const stats = await service.getStatsForDateRange(
			new Date(Date.UTC(2026, 3, 25)),
			new Date(Date.UTC(2026, 3, 26))
		);

		expect(stats.pomodorosCompleted).toBe(2);
		expect(plugin.app.metadataCache.getFileCache).toHaveBeenCalledTimes(2);
		expect(plugin.app.metadataCache.getFileCache.mock.calls.map(([file]) => file.path)).toEqual([
			"Daily/2026-04-25.md",
			"Daily/2026-04-26.md",
		]);
	});

	it("writes completed sessions to the daily note matching the recorded timestamp date", async () => {
		const originalTimezone = process.env.TZ;

		try {
			process.env.TZ = "Asia/Tokyo";
			const plugin = createMockPlugin({
				dailyNoteSessions: {
					"2026-04-02": [],
					"2026-04-03": [],
				},
			});
			const service = new PomodoroService(plugin as any);

			await service.addSessionToHistory(
				createSession("evening-session", "2026-04-02T21:09:25.755-04:00") as any
			);

			expect(plugin.app.fileManager.processFrontMatter).toHaveBeenCalledWith(
				{ path: "Daily/2026-04-02.md" },
				expect.any(Function)
			);
			expect(plugin.app.fileManager.processFrontMatter).not.toHaveBeenCalledWith(
				{ path: "Daily/2026-04-03.md" },
				expect.any(Function)
			);
		} finally {
			if (originalTimezone) {
				process.env.TZ = originalTimezone;
			} else {
				delete process.env.TZ;
			}
		}
	});
});
