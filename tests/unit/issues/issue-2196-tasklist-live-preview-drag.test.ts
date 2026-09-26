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

	it.each([
		[false, "title"],
		[false, "handle"],
		[true, "title"],
		[true, "handle"],
	])("preserves native drag defaults and isolates presses (embedded=%s, origin=%s)", (embedded, origin) => {
		const view = createView();
		const task = TaskFactory.createTask({ path: "tasks/live-preview-drag.md" });
		const editorParent = document.createElement("div");
		const card = document.createElement("div");
		const title = document.createElement("div");
		const editorPointerDown = jest.fn();
		const editorMouseDown = jest.fn();
		const editorMouseUp = jest.fn();

		if (embedded) editorParent.setAttribute("contenteditable", "true");
		editorParent.addEventListener("pointerdown", editorPointerDown);
		editorParent.addEventListener("mousedown", editorMouseDown);
		editorParent.addEventListener("mouseup", editorMouseUp);
		card.className = "task-card";
		title.className = "task-card__title-text";
		card.appendChild(title);
		editorParent.appendChild(card);

		(view as any).setupCardDragHandlers(card, task, null);

		const target = origin === "handle"
			? card.querySelector<HTMLElement>("[data-tn-drag-handle='true']")!
			: title;
		const pointerDown = new Event("pointerdown", { bubbles: true, cancelable: true });
		target.dispatchEvent(pointerDown);
		const mouseDown = new MouseEvent("mousedown", {
			bubbles: true,
			cancelable: true,
			button: 0,
		});
		target.dispatchEvent(mouseDown);
		target.dispatchEvent(
			new MouseEvent("mouseup", {
				bubbles: true,
				cancelable: true,
				button: 0,
			})
		);

		// #2210: cancelling mousedown prevents the browser from ever firing dragstart.
		expect(pointerDown.defaultPrevented).toBe(false);
		expect(mouseDown.defaultPrevented).toBe(false);
		expect(editorPointerDown).not.toHaveBeenCalled();
		expect(editorMouseDown).not.toHaveBeenCalled();
		expect(editorMouseUp).not.toHaveBeenCalled();
		expect(card.getAttribute("draggable")).toBe("true");
	});
});
