import { App, MockObsidian } from "../../helpers/obsidian-runtime";
import { TaskListView } from "../../../src/bases/TaskListView";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import { TaskFactory } from "../../helpers/mock-factories";

jest.mock(
	"tasknotes-nlp-core",
	() => ({
		NaturalLanguageParserCore: class {},
	}),
	{ virtual: true }
);

describe("Issue #2196: embedded Task List Live Preview drag", () => {
	const createView = () => {
		const plugin = {
			app: new App(),
			fieldMapper: new FieldMapper(DEFAULT_FIELD_MAPPING),
			settings: {
				fieldMapping: DEFAULT_FIELD_MAPPING,
			},
		};
		const containerEl = document.createElement("div");
		document.body.appendChild(containerEl);
		return new TaskListView({}, containerEl, plugin as any);
	};

	beforeEach(() => {
		MockObsidian.reset();
		document.body.className = "";
		document.body.innerHTML = "";
	});

	afterEach(() => {
		document.body.className = "";
		document.body.innerHTML = "";
	});

	it("keeps reorder-card press events from reaching the Live Preview editor", () => {
		const view = createView();
		const task = TaskFactory.createTask({ path: "tasks/live-preview-drag.md" });
		const editorParent = document.createElement("div");
		const card = document.createElement("div");
		const title = document.createElement("div");
		const editorPointerDown = jest.fn();
		const editorMouseDown = jest.fn();
		const editorMouseUp = jest.fn();

		editorParent.setAttribute("contenteditable", "true");
		editorParent.addEventListener("pointerdown", editorPointerDown);
		editorParent.addEventListener("mousedown", editorMouseDown);
		editorParent.addEventListener("mouseup", editorMouseUp);
		card.className = "task-card";
		title.className = "task-card__title-text";
		card.appendChild(title);
		editorParent.appendChild(card);

		(view as any).setupCardDragHandlers(card, task, null);

		title.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
		const mouseDown = new MouseEvent("mousedown", {
			bubbles: true,
			cancelable: true,
			button: 0,
		});
		title.dispatchEvent(mouseDown);
		title.dispatchEvent(
			new MouseEvent("mouseup", {
				bubbles: true,
				cancelable: true,
				button: 0,
			})
		);

		expect(mouseDown.defaultPrevented).toBe(true);
		expect(editorPointerDown).not.toHaveBeenCalled();
		expect(editorMouseDown).not.toHaveBeenCalled();
		expect(editorMouseUp).not.toHaveBeenCalled();
		expect(card.getAttribute("draggable")).toBe("true");
	});
});
