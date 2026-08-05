import { CalendarView } from "../../../src/bases/CalendarView";
import { executeBasesTaskCardAction } from "../../../src/bases/basesTaskCardActions";

jest.mock(
	"tasknotes-nlp-core",
	() => ({
		NaturalLanguageParserCore: class {},
	}),
	{ virtual: true }
);
jest.mock("../../../src/bases/basesTaskCardActions", () => ({
	executeBasesTaskCardAction: jest.fn().mockResolvedValue(undefined),
}));

const mockedExecuteAction = executeBasesTaskCardAction as jest.MockedFunction<
	typeof executeBasesTaskCardAction
>;

const proto = CalendarView.prototype as any;

describe("CalendarView.getTaskCardActionsConfig", () => {
	it("returns null in grid modes, which have no card-focus model", () => {
		const mockThis = { isCalendarListMode: () => false };

		expect(proto.getTaskCardActionsConfig.call(mockThis)).toBeNull();
	});

	it("wires the shared keyboard controller to Agenda/list-mode state", () => {
		const showBatchContextMenu = jest.fn();
		const createFileForView = jest.fn();
		const calendarEl = document.createElement("div");
		const rootElement = document.createElement("div");
		const mockThis = {
			isCalendarListMode: () => true,
			plugin: { taskSelectionService: {} },
			app: undefined,
			calendarEl,
			rootElement,
			getVisibleTaskPaths: jest.fn(() => ["a.md"]),
			showBatchContextMenu,
			createFileForView,
		};

		const config = proto.getTaskCardActionsConfig.call(mockThis);
		expect(config).not.toBeNull();
		expect(config.cardAreaElement).toBe(calendarEl);
		expect(config.isActionSupported("delete-tasks")).toBe(true);

		const viewContext = config.buildViewContext();
		expect(viewContext.plugin).toBe(mockThis.plugin);
		expect(viewContext.taskSelectionService).toBe(mockThis.plugin.taskSelectionService);
		expect(viewContext.rootElement).toBe(rootElement);
		expect(viewContext.fallbackAnchor).toBe(calendarEl);
		expect(viewContext.getVisibleTaskPaths()).toEqual(["a.md"]);
		expect(viewContext.isPathVisible("a.md")).toBe(true);
		expect(viewContext.isPathVisible("b.md")).toBe(false);

		viewContext.showBatchContextMenu({} as any);
		expect(showBatchContextMenu).toHaveBeenCalled();
		viewContext.createFileForView();
		expect(createFileForView).toHaveBeenCalled();
	});
});

describe("CalendarView grid-mode hover hotkeys", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	function baseMockThis(overrides: Record<string, unknown> = {}) {
		return {
			isCalendarListMode: () => false,
			plugin: { settings: {} },
			taskCardKeyboardController: { canHandleKeyDown: jest.fn(() => true) },
			hoveredGridTaskPath: "hovered.md",
			hoveredGridTaskElement: document.createElement("div"),
			buildGridHoverActionContext: () => ({} as any),
			...overrides,
		};
	}

	it("dispatches a single-target hotkey against the hovered task", () => {
		const mockThis = baseMockThis();
		const event = new KeyboardEvent("keydown", { key: "d", cancelable: true });

		proto.handleGridHoverActionKeyDown.call(mockThis, event);

		expect(event.defaultPrevented).toBe(true);
		expect(mockedExecuteAction).toHaveBeenCalledWith("edit-due", "hovered.md", expect.anything());
	});

	it("ignores navigation/selection actions that have no meaning without a card model", () => {
		const mockThis = baseMockThis();
		const event = new KeyboardEvent("keydown", { key: "j", cancelable: true });

		proto.handleGridHoverActionKeyDown.call(mockThis, event);

		expect(event.defaultPrevented).toBe(false);
		expect(mockedExecuteAction).not.toHaveBeenCalled();
	});

	it("does nothing when no task is currently hovered", () => {
		const mockThis = baseMockThis({ hoveredGridTaskPath: null });
		const event = new KeyboardEvent("keydown", { key: "d", cancelable: true });

		proto.handleGridHoverActionKeyDown.call(mockThis, event);

		expect(mockedExecuteAction).not.toHaveBeenCalled();
	});

	it("defers to the shared task-card keyboard controller in list mode", () => {
		const mockThis = baseMockThis({ isCalendarListMode: () => true });
		const event = new KeyboardEvent("keydown", { key: "d", cancelable: true });

		proto.handleGridHoverActionKeyDown.call(mockThis, event);

		expect(mockedExecuteAction).not.toHaveBeenCalled();
	});

	it("respects the shared editable-target/open-overlay guard", () => {
		const mockThis = baseMockThis({
			taskCardKeyboardController: { canHandleKeyDown: jest.fn(() => false) },
		});
		const event = new KeyboardEvent("keydown", { key: "d", cancelable: true });

		proto.handleGridHoverActionKeyDown.call(mockThis, event);

		expect(mockedExecuteAction).not.toHaveBeenCalled();
	});

	it("tracks the hovered task element and path as the mouse moves over the grid", () => {
		const root = document.createElement("div");
		const fcEvent = document.createElement("div");
		fcEvent.className = "fc-task-event";
		fcEvent.dataset.taskPath = "grid-task.md";
		root.appendChild(fcEvent);
		document.body.appendChild(root);

		const mockThis: any = {
			hoveredGridTaskPath: null,
			hoveredGridTaskElement: null,
			registerDomEvent: (
				el: HTMLElement,
				type: string,
				cb: EventListener,
				capture?: boolean
			) => el.addEventListener(type, cb, capture),
		};

		proto.registerGridHoverActionListeners.call(mockThis, root);

		const overEvent = new MouseEvent("mousemove", { bubbles: true });
		Object.defineProperty(overEvent, "target", { value: fcEvent });
		root.dispatchEvent(overEvent);
		expect(mockThis.hoveredGridTaskPath).toBe("grid-task.md");
		expect(mockThis.hoveredGridTaskElement).toBe(fcEvent);

		const offEvent = new MouseEvent("mousemove", { bubbles: true });
		Object.defineProperty(offEvent, "target", { value: root });
		root.dispatchEvent(offEvent);
		expect(mockThis.hoveredGridTaskPath).toBeNull();
	});
});
