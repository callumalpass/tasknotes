import { MiniCalendarView } from "../../../src/bases/MiniCalendarView";
import { ICSEvent } from "../../../src/types";
import { PluginFactory } from "../../helpers/mock-factories";

type TestMiniCalendarView = {
	app: unknown;
	config: { get: jest.Mock };
	data: { data: unknown[] };
	readViewOptions(): void;
	indexNotesByDate(data: unknown[]): void;
	renderDay(
		weekRow: HTMLElement,
		dayDate: Date,
		dayNum: number,
		isOutsideMonth: boolean
	): void;
	notesByDate: Map<string, Array<Record<string, unknown>>>;
	displayedMonth: number;
	displayedYear: number;
	selectedDate: Date;
};

function installObsidianElementPolyfills(): void {
	const proto = HTMLElement.prototype as any;

	proto.createDiv ??= function createDiv(options?: {
		cls?: string;
		text?: string;
		attr?: Record<string, string | null>;
	}) {
		const element = document.createElement("div");
		applyOptions(element, options);
		this.appendChild(element);
		return element;
	};

	proto.createSpan ??= function createSpan(options?: {
		cls?: string;
		text?: string;
		attr?: Record<string, string | null>;
	}) {
		const element = document.createElement("span");
		applyOptions(element, options);
		this.appendChild(element);
		return element;
	};

	proto.addClass ??= function addClass(className: string) {
		this.classList.add(className);
	};
}

function applyOptions(
	element: HTMLElement,
	options?: { cls?: string; text?: string; attr?: Record<string, string | null> }
): void {
	if (!options) return;
	if (options.cls) element.className = options.cls;
	if (options.text) element.textContent = options.text;
	if (options.attr) {
		for (const [key, value] of Object.entries(options.attr)) {
			if (value !== null) {
				element.setAttribute(key, value);
			}
		}
	}
}

function createGoogleEvent(overrides: Partial<ICSEvent> = {}): ICSEvent {
	return {
		id: "google-event-1",
		subscriptionId: "google-primary",
		title: "Design review",
		start: "2026-03-16",
		end: "2026-03-17",
		allDay: true,
		color: "#34A853",
		...overrides,
	};
}

function createView(configOverrides: Record<string, unknown> = {}): TestMiniCalendarView {
	const googleEvent = createGoogleEvent();
	const plugin = PluginFactory.createMockPlugin({
		googleCalendarService: {
			getAvailableCalendars: jest.fn(() => [{ id: "primary", summary: "Work" }]),
			getAllEvents: jest.fn(() => [googleEvent]),
		},
	});
	const view = new MiniCalendarView(
		{},
		document.createElement("div"),
		plugin
	) as unknown as TestMiniCalendarView;

	view.app = plugin.app;
	view.data = { data: [] };
	view.config = {
		get: jest.fn((key: string) => {
			const values: Record<string, unknown> = {
				dateProperty: "note.due",
				titleProperty: "file.name",
				...configOverrides,
			};
			return values[key];
		}),
	};
	view.readViewOptions();

	return view;
}

describe("Issue #1697: Mini Calendar external calendar events", () => {
	beforeEach(() => {
		installObsidianElementPolyfills();
	});

	it("indexes cached Google Calendar events into Mini Calendar days", () => {
		const view = createView();

		view.indexNotesByDate([]);

		expect(view.notesByDate.get("2026-03-16")).toEqual([
			expect.objectContaining({
				kind: "external",
				title: "Design review",
				sourceName: "Work",
				color: "#34A853",
			}),
		]);
	});

	it("honors per-calendar Google visibility toggles", () => {
		const view = createView({ showGoogleCalendar_primary: false });

		view.indexNotesByDate([]);

		expect(view.notesByDate.get("2026-03-16")).toBeUndefined();
	});

	it("renders one colored dot for each external event on the day", () => {
		const view = createView();
		const day = new Date(Date.UTC(2026, 2, 16));
		const weekRow = document.createElement("div");

		view.selectedDate = day;
		view.displayedMonth = 2;
		view.displayedYear = 2026;
		view.indexNotesByDate([]);
		view.renderDay(weekRow, day, 16, false);

		expect(
			weekRow.querySelectorAll(".mini-calendar-view__external-event-dot")
		).toHaveLength(1);
	});
});
