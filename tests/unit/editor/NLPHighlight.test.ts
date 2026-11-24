import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { createNLPHighlight, getReleasedNLPSpans } from "../../../src/editor/NLPHighlight";
import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";

const parser = new NaturalLanguageParser();
const ordinaryBackspace = jest.fn(() => true);
let view: EditorView;

function setup(text: string, cursor: number) {
	const onInputChange = jest.fn();
	view = new EditorView({
		state: EditorState.create({
			doc: text,
			selection: { anchor: cursor },
			extensions: [
				createNLPHighlight(
					(input, released) => parser.getSpansForModal(input, released),
					onInputChange
				),
				keymap.of([{ key: "Backspace", run: ordinaryBackspace }]),
				EditorState.allowMultipleSelections.of(true),
			],
		}),
		parent: document.body,
	});
	return onInputChange;
}

function backspace() {
	view.contentDOM.dispatchEvent(
		new KeyboardEvent("keydown", {
			key: "Backspace",
			bubbles: true,
			cancelable: true,
		})
	);
}

function highlights() {
	return Array.from(
		view.contentDOM.querySelectorAll(".tn-nlp-highlight"),
		(el) => el.textContent
	);
}

afterEach(() => view.destroy());

it("releases without deleting and hands the next Backspace to the editor", () => {
	const onInputChange = setup("Review #21 draft", 10);
	expect(highlights()).toEqual(["#21"]);
	backspace();
	expect(view.state.doc.toString()).toBe("Review #21 draft");
	expect(view.state.selection.main.head).toBe(10);
	expect(highlights()).toEqual([]);
	expect(onInputChange).toHaveBeenCalledTimes(1);
	expect(ordinaryBackspace).not.toHaveBeenCalled();
	expect(getReleasedNLPSpans(onInputChange.mock.calls[0][0])).toEqual([{ start: 7, end: 10 }]);
	backspace();
	expect(ordinaryBackspace).toHaveBeenCalledTimes(1);
	view.dispatch({ changes: { from: 9, to: 10 } });
	expect(view.state.doc.toString()).toBe("Review #2 draft");
	expect(highlights()).toEqual(["#2"]);
});

it("keeps two released ranges through adjacent edits and parses only the range edited inside", () => {
	setup("Review #2 @office draft", 9);
	backspace();
	view.dispatch({ selection: { anchor: 17 } });
	backspace();
	expect(highlights()).toEqual([]);

	view.dispatch({
		changes: [
			{ from: 7, insert: "draft " },
			{ from: 9, insert: " edition" },
			{ from: view.state.doc.length, insert: " today" },
		],
	});
	expect(getReleasedNLPSpans(view.state)).toEqual([
		{ start: 13, end: 15 },
		{ start: 24, end: 31 },
	]);
	expect(highlights()).toEqual(["today"]);

	view.dispatch({ changes: { from: 26, insert: "main-" } });
	expect(getReleasedNLPSpans(view.state)).toEqual([{ start: 13, end: 15 }]);
	expect(highlights()).toEqual(["@omain-ffice", "today"]);
});

it("leaves Backspace to the editor away from the end of a highlight", () => {
	setup("Review #2 draft", 10);
	backspace();
	expect(ordinaryBackspace).toHaveBeenCalledTimes(1);
	expect(getReleasedNLPSpans(view.state)).toEqual([]);
});

it("leaves Backspace to the editor for a selection or multiple cursors", () => {
	setup("#21 and #43", 3);
	view.dispatch({ selection: { anchor: 2, head: 3 } });
	backspace();
	view.dispatch({
		selection: EditorSelection.create([EditorSelection.cursor(3), EditorSelection.cursor(11)]),
	});
	backspace();
	expect(ordinaryBackspace).toHaveBeenCalledTimes(2);
	expect(getReleasedNLPSpans(view.state)).toEqual([]);
});
