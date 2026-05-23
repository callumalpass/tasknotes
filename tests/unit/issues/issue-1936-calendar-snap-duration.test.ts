/**
 * Issue #1936: Calendar drag/drop snapping can be more granular than the
 * visible time slot duration.
 */

import fs from "fs";
import path from "path";

import { CalendarView } from "../../../src/bases/CalendarView";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

function createCalendarViewWithConfig(values: Record<string, unknown>): CalendarView {
	const view = Object.create(CalendarView.prototype) as CalendarView & {
		config: { get(key: string): unknown };
		viewOptions: Record<string, unknown>;
		plugin: Record<string, unknown>;
		containerEl: HTMLElement;
		rootElement: HTMLElement | null;
		calendarEl: HTMLElement | null;
		calendar: null;
		icsCalendarToggles: Map<string, boolean>;
		googleCalendarToggles: Map<string, boolean>;
		microsoftCalendarToggles: Map<string, boolean>;
		readViewOptions(): void;
	};

	Object.assign(view, {
		config: {
			get: (key: string) => values[key],
		},
		plugin: {},
		containerEl: document.createElement("div"),
		rootElement: null,
		calendarEl: null,
		calendar: null,
		icsCalendarToggles: new Map<string, boolean>(),
		googleCalendarToggles: new Map<string, boolean>(),
		microsoftCalendarToggles: new Map<string, boolean>(),
		viewOptions: {
			showScheduled: true,
			showDue: true,
			showScheduledToDueSpan: false,
			showRecurring: true,
			showCompletedRecurringInstances: true,
			showSkippedRecurringInstances: true,
			showTimeEntries: false,
			showTimeblocks: true,
			showPropertyBasedEvents: true,
			initialDate: "",
			initialDateProperty: null,
			initialDateStrategy: "first",
			createDailyNotesFromDateLinks: true,
			calendarView: "timeGridWeek",
			heightMode: "fill",
			customDayCount: 3,
			listDayCount: 7,
			slotMinTime: "00:00:00",
			slotMaxTime: "24:00:00",
			slotDuration: "00:30:00",
			snapDuration: "00:30:00",
			scrollTime: "08:00:00",
			firstDay: 1,
			weekNumbers: false,
			nowIndicator: true,
			showWeekends: true,
			showAllDaySlot: true,
			showTimeGrid: true,
			showTodayHighlight: true,
			todayColumnWidthMultiplier: 1,
			selectMirror: true,
			timeFormat: "24",
			eventMinHeight: 15,
			slotEventOverlap: true,
			eventMaxStack: null,
			dayMaxEvents: true,
			dayMaxEventRows: false,
			locale: "",
			startDateProperty: null,
			endDateProperty: null,
			titleProperty: null,
		},
	});

	return view;
}

describe("Issue #1936: Calendar drag/drop snap duration", () => {
	it("defaults drag/drop snapping to the resolved time slot duration", () => {
		const view = createCalendarViewWithConfig({
			slotDuration: "00:15:00",
		}) as CalendarView & {
			viewOptions: { slotDuration: string; snapDuration: string };
			readViewOptions(): void;
		};

		view.readViewOptions();

		expect(view.viewOptions.slotDuration).toBe("00:15:00");
		expect(view.viewOptions.snapDuration).toBe("00:15:00");
	});

	it("allows per-view drag/drop snapping to be more granular than visible slots", () => {
		const view = createCalendarViewWithConfig({
			slotDuration: "00:30:00",
			snapDuration: "00:05:00",
		}) as CalendarView & {
			viewOptions: { slotDuration: string; snapDuration: string };
			readViewOptions(): void;
		};

		view.readViewOptions();

		expect(view.viewOptions.slotDuration).toBe("00:30:00");
		expect(view.viewOptions.snapDuration).toBe("00:05:00");
	});

	it("falls back to time slot duration when the configured snap duration is invalid", () => {
		const view = createCalendarViewWithConfig({
			slotDuration: "00:30:00",
			snapDuration: "not-a-time",
		}) as CalendarView & {
			viewOptions: { snapDuration: string };
			readViewOptions(): void;
		};

		view.readViewOptions();

		expect(view.viewOptions.snapDuration).toBe("00:30:00");
	});

	it("registers and passes the FullCalendar snapDuration option", () => {
		const calendarSource = readRepoFile("src/bases/CalendarView.ts");
		const registrationSource = readRepoFile("src/bases/registration.ts");
		const englishSource = readRepoFile("src/i18n/resources/en.ts");

		expect(calendarSource).toContain("snapDuration: this.viewOptions.snapDuration");
		expect(registrationSource).toContain('key: "snapDuration"');
		expect(registrationSource).toContain('displayName: t("layout.dragDropResolution")');
		expect(englishSource).toContain('dragDropResolution: "Drag/drop resolution"');
	});
});
