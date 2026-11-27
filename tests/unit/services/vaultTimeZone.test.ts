import type { Vault } from "obsidian";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import { CalendarExportService } from "../../../src/services/CalendarExportService";
import { VaultTimeZoneService } from "../../../src/services/VaultTimeZoneService";
import { NotificationService } from "../../../src/ui/NotificationService";
import {
	addDaysToDateTime,
	formatTimestampForDisplay,
	getDatePart,
	getTodayString,
	isOverdueTimeAware,
	parseDateToLocal,
	parseTimestamp,
} from "../../../src/utils/dateUtils";
import { getPomodoroTimestampDateKey } from "../../../src/utils/pomodoroStats";
import { computeTimeSummary } from "../../../src/utils/timeTrackingUtils";
import { getConfiguredVaultTimeZone, getVaultTimeZone } from "../../../src/utils/vaultTime";

jest.mock("date-fns", () => jest.requireActual("../../../node_modules/date-fns"));

const config = (zone: string) => `spec_version: 0.3.0\nsettings:\n  timezone: ${zone}\n`;
const write = jest.fn();

function createSource(initial: string | undefined, fallback = "") {
	let content = initial;
	const callbacks = new Map<string, (file: { path: string }, oldPath?: string) => void>();
	const adapter = {
		exists: jest.fn(async () => content !== undefined),
		read: jest.fn(async () => content),
		write,
	};
	const vault = {
		adapter,
		on: jest.fn((event: string, callback: (file: { path: string }, oldPath?: string) => void) => {
			callbacks.set(event, callback);
		}),
	} as unknown as Vault;
	const onChange = jest.fn();
	return {
		service: new VaultTimeZoneService(vault, () => fallback, onChange),
		setContent: (value: string | undefined) => { content = value; },
		callbacks,
		onChange,
	};
}

const task: TaskInfo = {
	title: "Collection clock",
	path: "Clock.md",
	status: "open",
	priority: "normal",
	archived: false,
};

describe("TaskNotes vault time zone", () => {
	let service: VaultTimeZoneService;

	async function configure(content: string | undefined, fallback?: string) {
		const source = createSource(content, fallback);
		service = source.service;
		await service.initialize(jest.fn());
		return source;
	}

	beforeEach(() => {
		jest.useFakeTimers();
		write.mockClear();
	});

	afterEach(() => {
		service?.dispose();
		jest.useRealTimers();
	});

	it("uses the collection day for today, overdue, and offset time entries and Pomodoros", async () => {
		jest.setSystemTime(new Date("2026-06-26T16:00:00Z"));
		await configure(config("Australia/Melbourne"), "America/New_York");
		expect(getVaultTimeZone()).toBe("Australia/Melbourne");
		expect(getTodayString()).toBe("2026-06-27");
		expect(isOverdueTimeAware("2026-06-26")).toBe(true);
		expect(isOverdueTimeAware("2026-06-27")).toBe(false);
		expect(isOverdueTimeAware("2026-06-27T01:59")).toBe(true);
		expect(isOverdueTimeAware("2026-06-27T02:01")).toBe(false);
		expect(getDatePart("2026-06-26T16:00:00Z")).toBe("2026-06-27");
		expect(getPomodoroTimestampDateKey("2026-06-26T16:00:00Z")).toBe("2026-06-27");

		const withEntries = { ...task, timeEntries: [
			{ startTime: "2026-06-26T13:30:00Z", endTime: "2026-06-26T13:50:00Z" },
			{ startTime: "2026-06-26T14:30:00Z", endTime: "2026-06-26T14:45:00Z" },
		] };
		expect(computeTimeSummary([withEntries], { period: "today", fromDate: null, toDate: null }, () => false).summary.totalMinutes).toBe(15);
	});

	it("resolves DST overlaps earlier and moves gaps forward for tasks, reminders, and ICS", async () => {
		await configure(config("America/New_York"));
		const scheduled = "2026-11-01T01:30";
		const due = "2026-03-08T02:30";
		expect(parseDateToLocal(scheduled).toISOString()).toBe("2026-11-01T05:30:00.000Z");
		expect(parseDateToLocal(due).toISOString()).toBe("2026-03-08T07:30:00.000Z");
		expect(addDaysToDateTime(due, 1)).toBe("2026-03-09T02:30");
		expect(parseTimestamp("2026-11-01T01:30:00.123456").toISOString())
			.toBe("2026-11-01T05:30:00.123Z");
		expect(parseTimestamp("2026-11-01T01:30:00-05:00").toISOString())
			.toBe("2026-11-01T06:30:00.000Z");
		expect(formatTimestampForDisplay("2026-03-08T07:30:00Z", "yyyy-MM-dd HH:mm"))
			.toBe("2026-03-08 03:30");
		expect(() => parseDateToLocal("2026-02-30T09:00")).toThrow();
		expect(() => parseDateToLocal("2026-11-01T24:00")).toThrow();

		const reminders = new NotificationService({} as TaskNotesPlugin);
		const time = (value: number | null) => new Date(value ?? NaN).toISOString();
		expect(time(reminders["calculateNotificationTime"]({ ...task, scheduled }, {
			id: "relative-scheduled", type: "relative", relatedTo: "scheduled", offset: "-PT15M",
		}))).toBe("2026-11-01T05:15:00.000Z");
		expect(time(reminders["calculateNotificationTime"]({ ...task, due }, {
			id: "relative-due", type: "relative", relatedTo: "due", offset: "-PT30M",
		}))).toBe("2026-03-08T07:00:00.000Z");
		expect(time(reminders["calculateNotificationTime"](task, {
			id: "absolute", type: "absolute", absoluteTime: "2026-11-01T01:30:00-05:00",
		}))).toBe("2026-11-01T06:30:00.000Z");
		expect(CalendarExportService.generateICSContent({ ...task, scheduled }))
			.toContain("DTSTART:20261101T053000Z");
		expect(CalendarExportService.generateICSContent({ ...task, due }))
			.toContain("DTSTART:20260308T073000Z");
		expect(CalendarExportService.generateICSContent({ ...task, due: "2026-03-08" }))
			.toContain("DTSTART;VALUE=DATE:20260308");
	});

	it("rereads collection changes and falls back to the plugin and device without writing config", async () => {
		const source = await configure("spec_version: 0.3.0\n", "Australia/Melbourne");
		expect(getVaultTimeZone()).toBe("Australia/Melbourne");

		source.setContent(config("America/New_York"));
		const changed = source.callbacks.get("modify");
		changed?.({ path: "mdbase.yaml" });
		await jest.advanceTimersByTimeAsync(1);
		expect(getVaultTimeZone()).toBe("America/New_York");
		expect(parseDateToLocal("2026-06-26T09:00").toISOString()).toBe("2026-06-26T13:00:00.000Z");

		source.setContent(config("Not/AZone"));
		await service.refresh();
		expect(getVaultTimeZone()).toBe("Australia/Melbourne");
		source.setContent(undefined);
		await service.refresh();
		expect(source.onChange).toHaveBeenCalledTimes(3);
		expect(write).not.toHaveBeenCalled();

		service.dispose();
		await configure(undefined);
		expect(getConfiguredVaultTimeZone()).toBeUndefined();
		expect(getVaultTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
		expect(parseDateToLocal("2026-06-26T09:00").getTime())
			.toBe(new Date(2026, 5, 26, 9).getTime());
	});
});
