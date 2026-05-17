import {
	DEFAULT_MINI_CALENDAR_HEAT_MAP_MAX_COUNT,
	MiniCalendarView,
	getMiniCalendarHeatMapIntensity,
	normalizeMiniCalendarHeatMapMaxCount,
} from "../../../src/bases/MiniCalendarView";
import { PluginFactory } from "../../helpers/mock-factories";

type TestMiniCalendarView = {
	app: unknown;
	config: { get: jest.Mock };
	data: { data: unknown[] };
	readViewOptions(): void;
	renderDay(
		weekRow: HTMLElement,
		dayDate: Date,
		dayNum: number,
		isOutsideMonth: boolean
	): void;
	notesByDate: Map<string, Array<Record<string, unknown>>>;
	selectedDate: Date;
	displayedMonth: number;
	displayedYear: number;
};

function installObsidianElementPolyfills(): void {
	const proto = HTMLElement.prototype as typeof HTMLElement.prototype & {
		createDiv?: (options?: {
			cls?: string;
			text?: string;
			attr?: Record<string, string | null>;
		}) => HTMLElement;
		addClass?: (className: string) => void;
	};

	proto.createDiv ??= function createDiv(this: HTMLElement, options?: {
		cls?: string;
		text?: string;
		attr?: Record<string, string | null>;
	}) {
		const element = document.createElement("div");
		if (options?.cls) element.className = options.cls;
		if (options?.text) element.textContent = options.text;
		if (options?.attr) {
			for (const [key, value] of Object.entries(options.attr)) {
				if (value !== null) {
					element.setAttribute(key, value);
				}
			}
		}
		this.appendChild(element);
		return element;
	};

	proto.addClass ??= function addClass(this: HTMLElement, className: string) {
		this.classList.add(className);
	};
}

function createView(configOverrides: Record<string, unknown> = {}): TestMiniCalendarView {
	const plugin = PluginFactory.createMockPlugin();
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

function notes(count: number): Array<Record<string, unknown>> {
	return Array.from({ length: count }, (_, index) => ({
		kind: "note",
		title: `Note ${index + 1}`,
		path: `Notes/Note ${index + 1}.md`,
		dateValue: "2026-03-16",
	}));
}

describe("Issue #1151: Mini Calendar configurable max color intensity", () => {
	beforeEach(() => {
		installObsidianElementPolyfills();
	});

	it("keeps the default Mini Calendar heat map thresholds", () => {
		const defaultMaxCount = DEFAULT_MINI_CALENDAR_HEAT_MAP_MAX_COUNT;

		expect(getMiniCalendarHeatMapIntensity(0, defaultMaxCount)).toBe("none");
		expect(getMiniCalendarHeatMapIntensity(1, defaultMaxCount)).toBe("low");
		expect(getMiniCalendarHeatMapIntensity(2, defaultMaxCount)).toBe("medium");
		expect(getMiniCalendarHeatMapIntensity(3, defaultMaxCount)).toBe("medium");
		expect(getMiniCalendarHeatMapIntensity(4, defaultMaxCount)).toBe("high");
		expect(getMiniCalendarHeatMapIntensity(5, defaultMaxCount)).toBe("high");
		expect(getMiniCalendarHeatMapIntensity(6, defaultMaxCount)).toBe("very-high");
		expect(getMiniCalendarHeatMapIntensity(10, defaultMaxCount)).toBe("very-high");
	});

	it("lets one note reach maximum intensity when the max count is one", () => {
		expect(getMiniCalendarHeatMapIntensity(1, 1)).toBe("very-high");
		expect(getMiniCalendarHeatMapIntensity(5, 1)).toBe("very-high");
	});

	it("normalizes invalid max-count config values", () => {
		expect(normalizeMiniCalendarHeatMapMaxCount(undefined)).toBe(
			DEFAULT_MINI_CALENDAR_HEAT_MAP_MAX_COUNT
		);
		expect(normalizeMiniCalendarHeatMapMaxCount("")).toBe(
			DEFAULT_MINI_CALENDAR_HEAT_MAP_MAX_COUNT
		);
		expect(normalizeMiniCalendarHeatMapMaxCount("not-a-number")).toBe(
			DEFAULT_MINI_CALENDAR_HEAT_MAP_MAX_COUNT
		);
		expect(normalizeMiniCalendarHeatMapMaxCount(0)).toBe(1);
		expect(normalizeMiniCalendarHeatMapMaxCount("2.4")).toBe(2);
	});

	it("renders a one-note day at maximum intensity when configured", () => {
		const view = createView({ heatMapMaxCount: 1 });
		const day = new Date(Date.UTC(2026, 2, 16));
		const weekRow = document.createElement("div");

		view.selectedDate = day;
		view.displayedMonth = 2;
		view.displayedYear = 2026;
		view.notesByDate.set("2026-03-16", notes(1));
		view.renderDay(weekRow, day, 16, false);

		expect(
			weekRow.querySelector(".mini-calendar-view__day--intensity-very-high")
		).not.toBeNull();
	});
});
