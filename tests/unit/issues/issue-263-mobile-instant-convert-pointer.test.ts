import { Decoration } from "@codemirror/view";
import { MarkdownView } from "obsidian";
import { buildConvertButtonDecorations } from "../../../src/editor/InstantConvertButtons";
import { PluginFactory } from "../../helpers/mock-factories";

type MockLine = {
	number: number;
	from: number;
	to: number;
	text: string;
};

function createMockView(lines: string[]) {
	const mockLines: MockLine[] = [];
	let offset = 0;

	for (let index = 0; index < lines.length; index++) {
		const text = lines[index];
		mockLines.push({
			number: index + 1,
			from: offset,
			to: offset + text.length,
			text,
		});
		offset += text.length + 1;
	}

	const doc = {
		lines: mockLines.length,
		length: Math.max(0, offset - 1),
		line: (lineNumber: number) => mockLines[lineNumber - 1],
		lineAt: (position: number) =>
			mockLines.find((line) => line.from <= position && line.to >= position) ??
			mockLines[mockLines.length - 1],
	};

	return {
		state: { doc },
		visibleRanges: [{ from: 0, to: doc.length }],
	};
}

describe("Issue #263: mobile instant convert activation", () => {
	const originalPointerEvent = window.PointerEvent;
	const originalActiveDocument = (globalThis as { activeDocument?: Document }).activeDocument;

	afterEach(() => {
		jest.restoreAllMocks();
		if (originalPointerEvent === undefined) {
			delete (window as { PointerEvent?: typeof PointerEvent }).PointerEvent;
		} else {
			window.PointerEvent = originalPointerEvent;
		}
		(globalThis as { activeDocument?: Document }).activeDocument = originalActiveDocument;
	});

	it("uses pointerdown so touch activation preserves the current editor selection", async () => {
		(window as { PointerEvent?: typeof Event }).PointerEvent = Event;
		(globalThis as { activeDocument?: Document }).activeDocument = document;
		const widgetSpy = jest.spyOn(Decoration, "widget");
		const editor = {
			lineCount: jest.fn(() => 1),
			getLine: jest.fn(() => "- [ ] Parent task"),
		};
		const instantConvertTask = jest.fn().mockResolvedValue(undefined);
		const plugin = PluginFactory.createMockPlugin({
			settings: {
				enableInstantTaskConvert: true,
			},
		});
		plugin.instantTaskConvertService = { instantConvertTask } as any;
		plugin.app.workspace.getActiveViewOfType = jest.fn((viewType: unknown) =>
			viewType === MarkdownView ? { editor } : null
		);

		buildConvertButtonDecorations(createMockView(["- [ ] Parent task"]), plugin as any);

		const widget = (widgetSpy.mock.calls[0][0] as any).widget;
		const container = widget.toDOM({} as any);
		const button = container.querySelector("button");
		expect(button).not.toBeNull();

		button!.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
		await Promise.resolve();
		await Promise.resolve();

		expect(instantConvertTask).toHaveBeenCalledWith(editor, 0);
	});
});
