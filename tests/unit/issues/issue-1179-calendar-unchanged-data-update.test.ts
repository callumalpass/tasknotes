/**
 * Issue #1179: Calendar view should not repaint for unrelated Bases updates
 * while the user is typing in another pane.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1179
 */

import { CalendarView } from "../../../src/bases/CalendarView";

jest.mock("obsidian");

type SignatureItem = {
	path: string;
	properties: Record<string, unknown>;
};

const FIELD_MAPPING: Record<string, string> = {
	completeInstances: "complete_instances",
	recurrenceAnchor: "recurrence_anchor",
	skippedInstances: "skipped_instances",
};

function createCalendarViewFixture(
	initialItems: SignatureItem[],
	initialVisiblePropertyIds: string[] = []
) {
	let items = initialItems;
	let visiblePropertyIds = initialVisiblePropertyIds;
	const rootElement = document.createElement("div");
	const containerEl = document.createElement("div");
	document.body.appendChild(rootElement);

	const view = Object.create(CalendarView.prototype) as any;
	Object.assign(view, {
		basesController: {},
		config: {
			get: jest.fn((key: string) => (key === "options" ? {} : undefined)),
		},
		containerEl,
		data: {
			data: initialItems.map((item) => ({ file: { path: item.path } })),
		},
		dataAdapter: {
			extractDataItems: jest.fn(() =>
				items.map((item) => ({
					path: item.path,
					properties: item.properties,
				}))
			),
			getVisiblePropertyIds: jest.fn(() => visiblePropertyIds),
		},
		dataUpdateDebounceTimer: null,
		plugin: {
			fieldMapper: {
				toUserField: jest.fn((field: string) => FIELD_MAPPING[field] ?? field),
			},
			googleCalendarService: null,
			icsSubscriptionService: null,
			microsoftCalendarService: null,
		},
		render: jest.fn(),
		renderPreservingEphemeralState: jest.fn(),
		rootElement,
		viewOptions: {
			showPropertyBasedEvents: false,
			startDateProperty: null,
			endDateProperty: null,
			titleProperty: null,
		},
		_expectingImmediateUpdate: false,
		_isFirstDataUpdate: false,
		_previousConfigSnapshot: null,
		_previousControllerViewName: null,
		_previousDataSignature: null,
	});

	view._previousConfigSnapshot = view.getConfigSnapshot();
	view._previousDataSignature = view.getDataSignature();
	view._previousControllerViewName = view.getControllerViewName();

	return {
		view,
		setItems(nextItems: SignatureItem[]) {
			items = nextItems;
			view.data = {
				data: nextItems.map((item) => ({ file: { path: item.path } })),
			};
		},
		setVisiblePropertyIds(nextVisiblePropertyIds: string[]) {
			visiblePropertyIds = nextVisiblePropertyIds;
		},
	};
}

describe("Issue #1179: Calendar unchanged data updates", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		document.body.innerHTML = "";
	});

	it("does not repaint after the debounce when calendar data is unchanged", () => {
		const { view } = createCalendarViewFixture([
			{
				path: "Tasks/A.md",
				properties: {
					due: "2026-06-01",
					status: "open",
					title: "Stable task",
				},
			},
		]);

		view.onDataUpdated();
		jest.advanceTimersByTime(6000);

		expect(view.renderPreservingEphemeralState).not.toHaveBeenCalled();
		expect(view.render).not.toHaveBeenCalled();
	});

	it("repaints immediately when a calendar-relevant task field changes", () => {
		const { setItems, view } = createCalendarViewFixture([
			{
				path: "Tasks/A.md",
				properties: {
					due: "2026-06-01",
					status: "open",
					title: "Stable task",
				},
			},
		]);

		setItems([
			{
				path: "Tasks/A.md",
				properties: {
					due: "2026-06-02",
					status: "open",
					title: "Stable task",
				},
			},
		]);

		view.onDataUpdated();

		expect(view.renderPreservingEphemeralState).toHaveBeenCalledTimes(1);
	});

	it("ignores file metadata churn when the value is not shown in the calendar", () => {
		const { setItems, view } = createCalendarViewFixture([
			{
				path: "Tasks/A.md",
				properties: {
					due: "2026-06-01",
					"file.mtime": 100,
					title: "Stable task",
				},
			},
		]);

		setItems([
			{
				path: "Tasks/A.md",
				properties: {
					due: "2026-06-01",
					"file.mtime": 200,
					title: "Stable task",
				},
			},
		]);

		view.onDataUpdated();
		jest.advanceTimersByTime(6000);

		expect(view.renderPreservingEphemeralState).not.toHaveBeenCalled();
	});

	it("tracks visible custom properties used by list-view task cards", () => {
		const { setItems, setVisiblePropertyIds, view } = createCalendarViewFixture(
			[
				{
					path: "Tasks/A.md",
					properties: {
						due: "2026-06-01",
						estimateLabel: "Short",
						title: "Stable task",
					},
				},
			],
			["note.estimateLabel"]
		);

		setItems([
			{
				path: "Tasks/A.md",
				properties: {
					due: "2026-06-01",
					estimateLabel: "Long",
					title: "Stable task",
				},
			},
		]);
		setVisiblePropertyIds(["note.estimateLabel"]);

		view.onDataUpdated();

		expect(view.renderPreservingEphemeralState).toHaveBeenCalledTimes(1);
	});
});
