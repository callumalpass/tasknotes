import { App, MockObsidian } from "../../helpers/obsidian-runtime";
import { TaskListView } from "../../../src/bases/TaskListView";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";

jest.mock(
	"tasknotes-nlp-core",
	() => ({
		NaturalLanguageParserCore: class {},
	}),
	{ virtual: true }
);

function createView(): { view: TaskListView; itemsContainer: HTMLElement } {
	const plugin = {
		app: new App(),
		fieldMapper: new FieldMapper(DEFAULT_FIELD_MAPPING),
		settings: {
			fieldMapping: DEFAULT_FIELD_MAPPING,
		},
	};
	const containerEl = document.createElement("div");
	const rootElement = document.createElement("div");
	const itemsContainer = document.createElement("div");

	rootElement.className = "tn-tasknotesTaskList";
	itemsContainer.className = "tn-bases-items-container";
	rootElement.appendChild(itemsContainer);
	containerEl.appendChild(rootElement);
	document.body.appendChild(containerEl);

	const view = new TaskListView({}, containerEl, plugin as never);
	(view as unknown as { rootElement: HTMLElement }).rootElement = rootElement;
	(view as unknown as { itemsContainer: HTMLElement }).itemsContainer = itemsContainer;

	return { view, itemsContainer };
}

describe("Issue #1982: Task List item scroller preservation", () => {
	beforeEach(() => {
		MockObsidian.reset();
		document.body.innerHTML = "";
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("restores the Task List items container scroll position from ephemeral state", () => {
		const originalRequestAnimationFrame = window.requestAnimationFrame;
		window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		}) as typeof window.requestAnimationFrame;

		try {
			const { view, itemsContainer } = createView();
			itemsContainer.scrollTop = 1728;

			const state = view.getEphemeralState();
			itemsContainer.scrollTop = 0;

			view.setEphemeralState(state);

			expect(itemsContainer.scrollTop).toBe(1728);
		} finally {
			window.requestAnimationFrame = originalRequestAnimationFrame;
		}
	});
});
