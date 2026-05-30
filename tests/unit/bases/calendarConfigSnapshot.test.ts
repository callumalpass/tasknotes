import {
	buildCalendarConfigSnapshot,
	getCalendarConfigSnapshotKeys,
	getCalendarConfigValue,
	readCalendarConfigValue,
	type CalendarViewConfigReader,
} from "../../../src/bases/calendarConfigSnapshot";

function createConfig(values: Record<string, unknown>): CalendarViewConfigReader {
	return {
		get: (key: string) => values[key],
	};
}

describe("calendarConfigSnapshot", () => {
	it("reads direct values before nested options values", () => {
		const config = createConfig({
			showScheduled: false,
			options: {
				showScheduled: true,
				calendarView: "listWeek",
			},
		});

		expect(readCalendarConfigValue(config, "showScheduled")).toBe(false);
		expect(readCalendarConfigValue(config, "calendarView")).toBe("listWeek");
		expect(getCalendarConfigValue(config, "missing", "fallback")).toBe("fallback");
	});

	it("builds stable snapshot keys including external provider toggles", () => {
		expect(
			getCalendarConfigSnapshotKeys({
				icsCalendarIds: ["ics-a", "", 42],
				googleCalendarIds: ["google-a"],
				microsoftCalendarIds: ["ms-a"],
			})
		).toEqual(
			expect.arrayContaining([
				"showScheduled",
				"calendarView",
				"snapDuration",
				"createDailyNotesFromDateLinks",
				"showICS_ics-a",
				"showGoogleCalendar_google-a",
				"showMicrosoftCalendar_ms-a",
			])
		);
	});

	it("keeps provider toggle keys stable when providers arrive in a different order", () => {
		const firstKeys = getCalendarConfigSnapshotKeys({
			icsCalendarIds: ["ics-b", "ics-a"],
			googleCalendarIds: ["google-b", "google-a"],
			microsoftCalendarIds: ["ms-b", "ms-a"],
		});
		const secondKeys = getCalendarConfigSnapshotKeys({
			icsCalendarIds: ["ics-a", "ics-b"],
			googleCalendarIds: ["google-a", "google-b"],
			microsoftCalendarIds: ["ms-a", "ms-b"],
		});

		expect(firstKeys).toEqual(secondKeys);
		expect(firstKeys.indexOf("showICS_ics-a")).toBeLessThan(
			firstKeys.indexOf("showICS_ics-b")
		);
		expect(firstKeys.indexOf("showGoogleCalendar_google-a")).toBeLessThan(
			firstKeys.indexOf("showGoogleCalendar_google-b")
		);
		expect(firstKeys.indexOf("showMicrosoftCalendar_ms-a")).toBeLessThan(
			firstKeys.indexOf("showMicrosoftCalendar_ms-b")
		);
	});

	it("builds config snapshots from direct, options, and provider toggle values", () => {
		const config = createConfig({
			showScheduled: true,
			options: {
				calendarView: "timeGridWeek",
				"showICS_ics-a": false,
			},
			"showGoogleCalendar_google-a": true,
			"showMicrosoftCalendar_ms-a": false,
		});
		const snapshot = JSON.parse(
			buildCalendarConfigSnapshot({
				config,
				icsCalendarIds: ["ics-a"],
				googleCalendarIds: ["google-a"],
				microsoftCalendarIds: ["ms-a"],
			})
		);
		const keys = getCalendarConfigSnapshotKeys({
			icsCalendarIds: ["ics-a"],
			googleCalendarIds: ["google-a"],
			microsoftCalendarIds: ["ms-a"],
		});

		expect(snapshot[keys.indexOf("showScheduled")]).toBe(true);
		expect(snapshot[keys.indexOf("calendarView")]).toBe("timeGridWeek");
		expect(snapshot[keys.indexOf("showICS_ics-a")]).toBe(false);
		expect(snapshot[keys.indexOf("showGoogleCalendar_google-a")]).toBe(true);
		expect(snapshot[keys.indexOf("showMicrosoftCalendar_ms-a")]).toBe(false);
	});

	it("returns an empty snapshot when config is unavailable", () => {
		expect(buildCalendarConfigSnapshot({ config: undefined })).toBe("");
	});
});
