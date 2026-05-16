import { CalendarView } from "../../../src/bases/CalendarView";

type CalendarDataEntry = {
	file: {
		path: string;
	};
};

type CalendarViewProbe = {
	onDataUpdated(): void;
	rootElement: HTMLElement | null;
	containerEl: HTMLElement;
	dataUpdateDebounceTimer: number | null;
	_isFirstDataUpdate: boolean;
	_expectingImmediateUpdate: boolean;
	_previousDataSignature: string | null;
	_previousControllerViewName: string | null;
	data: {
		data: CalendarDataEntry[];
	};
	basesController: {
		viewName: string;
	};
	hasConfigChanged: jest.Mock<boolean, []>;
	renderPreservingEphemeralState: jest.Mock<void, []>;
	render: jest.Mock<Promise<void>, []>;
};

function createCalendarViewProbe({
	previousDataSignature,
	currentPaths,
	previousViewName = "Agenda",
	currentViewName = "Agenda",
}: {
	previousDataSignature: string;
	currentPaths: string[];
	previousViewName?: string;
	currentViewName?: string;
}): CalendarViewProbe {
	const rootElement = document.createElement("div");
	const containerEl = document.createElement("div");
	document.body.append(rootElement, containerEl);

	const view = Object.create(CalendarView.prototype) as CalendarViewProbe;
	view.rootElement = rootElement;
	view.containerEl = containerEl;
	view.dataUpdateDebounceTimer = null;
	view._isFirstDataUpdate = false;
	view._expectingImmediateUpdate = false;
	view._previousDataSignature = previousDataSignature;
	view._previousControllerViewName = previousViewName;
	view.data = {
		data: currentPaths.map((path) => ({ file: { path } })),
	};
	view.basesController = {
		viewName: currentViewName,
	};
	view.hasConfigChanged = jest.fn(() => false);
	view.renderPreservingEphemeralState = jest.fn();
	view.render = jest.fn(() => Promise.resolve());

	return view;
}

describe("Issue #1628: CalendarView Bases filter view switching", () => {
	afterEach(() => {
		document.body.replaceChildren();
		jest.useRealTimers();
	});

	it("renders immediately when the Bases result set changes after switching filtered views", () => {
		const view = createCalendarViewProbe({
			previousDataSignature: "_codex/issue-1628/due-task.md",
			currentPaths: ["_codex/issue-1628/scheduled-task.md"],
		});

		view.onDataUpdated();

		expect(view.renderPreservingEphemeralState).toHaveBeenCalledTimes(1);
		expect(view.dataUpdateDebounceTimer).toBeNull();
	});

	it("keeps checking briefly when Bases reports a view switch before filtered data arrives", () => {
		jest.useFakeTimers();
		const view = createCalendarViewProbe({
			previousDataSignature:
				"_codex/issue-1628/due-task.md\u0000_codex/issue-1628/scheduled-task.md",
			currentPaths: [
				"_codex/issue-1628/due-task.md",
				"_codex/issue-1628/scheduled-task.md",
			],
			previousViewName: "Agenda",
			currentViewName: "Due",
		});

		view.onDataUpdated();
		jest.advanceTimersByTime(250);
		expect(view.renderPreservingEphemeralState).not.toHaveBeenCalled();

		view.data = {
			data: [{ file: { path: "_codex/issue-1628/scheduled-task.md" } }],
		};
		jest.advanceTimersByTime(250);

		expect(view.renderPreservingEphemeralState).toHaveBeenCalledTimes(1);
		expect(view.dataUpdateDebounceTimer).toBeNull();
	});

	it("renders after the short check window for a changed view with the same result set", () => {
		jest.useFakeTimers();
		const view = createCalendarViewProbe({
			previousDataSignature: "_codex/issue-1628/shared-task.md",
			currentPaths: ["_codex/issue-1628/shared-task.md"],
			previousViewName: "Agenda",
			currentViewName: "Due",
		});

		view.onDataUpdated();
		jest.advanceTimersByTime(1999);
		expect(view.renderPreservingEphemeralState).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1);
		expect(view.renderPreservingEphemeralState).toHaveBeenCalledTimes(1);
	});

	it("keeps the longer debounce for same-view updates with the same result set", () => {
		jest.useFakeTimers();
		const view = createCalendarViewProbe({
			previousDataSignature: "_codex/issue-1628/shared-task.md",
			currentPaths: ["_codex/issue-1628/shared-task.md"],
		});

		view.onDataUpdated();

		expect(view.renderPreservingEphemeralState).not.toHaveBeenCalled();
		expect(view.dataUpdateDebounceTimer).not.toBeNull();

		jest.advanceTimersByTime(4999);
		expect(view.renderPreservingEphemeralState).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1);
		expect(view.renderPreservingEphemeralState).toHaveBeenCalledTimes(1);
	});
});
