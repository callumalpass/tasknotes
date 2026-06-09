import { Menu, type TFile } from "obsidian";
import {
	createDailyNote,
	createWeeklyNote,
	getDailyNote,
	getWeeklyNote,
} from "obsidian-daily-notes-interface";
import { MiniCalendarView } from "../../../src/bases/MiniCalendarView";
import { PluginFactory } from "../../helpers/mock-factories";
jest.mock("obsidian-daily-notes-interface", () => ({
	appHasDailyNotesPluginLoaded: jest.fn(() => true),
	createDailyNote: jest.fn(),
	getAllDailyNotes: jest.fn(() => ({})),
	getDailyNote: jest.fn(),
	appHasWeeklyNotesPluginLoaded: jest.fn(() => true),
	createWeeklyNote: jest.fn(),
	getAllWeeklyNotes: jest.fn(() => ({})),
	getWeeklyNote: jest.fn(),
}));

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
	renderWeekRow(calendarGrid: HTMLElement, weekDays: Date[]): void;
};

type MockMenuItem = {
	setTitle: jest.Mock;
	setIcon: jest.Mock;
	onClick: jest.Mock;
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

function getLatestMenuItem(): MockMenuItem {
	const menuMock = Menu as unknown as jest.Mock;
	const lastResult = menuMock.mock.results[menuMock.mock.results.length - 1];
	const menu = lastResult?.value as { items: MockMenuItem[] };
	const item = menu.items[0];

	if (!item) {
		throw new Error("Expected Mini Calendar context menu item");
	}

	return item;
}

function createView() {
	const openFile = jest.fn().mockResolvedValue(undefined);
	const basePlugin = PluginFactory.createMockPlugin();
	const plugin = PluginFactory.createMockPlugin({
		app: {
			...basePlugin.app,
			workspace: {
				...basePlugin.app.workspace,
				getLeaf: jest.fn(() => ({ openFile })),
			},
		},
		i18n: {
			translate: jest.fn((key: string) => {
				const translations: Record<string, string> = {
					"views.miniCalendar.contextMenu.openDailyNote": "Open daily note",
					"views.miniCalendar.contextMenu.openWeeklyNote": "Open weekly note",
				};
				return translations[key] ?? key;
			}),
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
				dateProperty: "file.mtime",
				titleProperty: "file.name",
			};
			return values[key];
		}),
	};
	view.readViewOptions();

	return { view, openFile };
}

describe("Issue #1377: Mini Calendar daily and weekly note actions", () => {
	beforeEach(() => {
		installObsidianElementPolyfills();
		jest.clearAllMocks();
	});

	it("adds a day context action that opens or creates the daily note", async () => {
		const dailyNote = { path: "Daily/2026-03-16.md" } as TFile;
		(getDailyNote as jest.Mock).mockReturnValue(undefined);
		(createDailyNote as jest.Mock).mockResolvedValue(dailyNote);
		const { view, openFile } = createView();
		const date = new Date(Date.UTC(2026, 2, 16));
		const weekRow = document.createElement("div");

		view.renderDay(weekRow, date, 16, false);
		const dayEl = weekRow.querySelector(".mini-calendar-view__day") as HTMLElement;
		dayEl.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));

		const item = getLatestMenuItem();
		expect(item.setTitle).toHaveBeenCalledWith("Open daily note");
		expect(item.setIcon).toHaveBeenCalledWith("calendar-days");

		await item.onClick.mock.calls[0][0]();

		expect(createDailyNote).toHaveBeenCalledTimes(1);
		expect(openFile).toHaveBeenCalledWith(dailyNote);
	});

	it("adds a week-number context action that opens or creates the weekly note", async () => {
		const weeklyNote = { path: "Weekly/2026-W12.md" } as TFile;
		(getWeeklyNote as jest.Mock).mockReturnValue(undefined);
		(createWeeklyNote as jest.Mock).mockResolvedValue(weeklyNote);
		const { view, openFile } = createView();
		const calendarGrid = document.createElement("div");
		const weekDays = Array.from(
			{ length: 7 },
			(_, index) => new Date(Date.UTC(2026, 2, 16 + index))
		);

		view.renderWeekRow(calendarGrid, weekDays);
		const weekCell = calendarGrid.querySelector(".mini-calendar-week-number") as HTMLElement;
		weekCell.dispatchEvent(
			new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
		);

		const item = getLatestMenuItem();
		expect(item.setTitle).toHaveBeenCalledWith("Open weekly note");
		expect(item.setIcon).toHaveBeenCalledWith("calendar-range");

		await item.onClick.mock.calls[0][0]();

		expect(createWeeklyNote).toHaveBeenCalledTimes(1);
		expect(openFile).toHaveBeenCalledWith(weeklyNote);
	});
});
