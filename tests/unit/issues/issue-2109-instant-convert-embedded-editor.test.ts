import { Decoration } from "@codemirror/view";
import { buildConvertButtonDecorations } from "../../../src/editor/InstantConvertButtons";
import { PluginFactory } from "../../helpers/mock-factories";

type MockLine = {
	number: number;
	from: number;
	to: number;
	text: string;
};

function createMockView(lines: string[], options: { embedded?: boolean } = {}) {
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

	const dom = document.createElement("div");
	const containerEl = document.createElement("div");

	if (options.embedded) {
		containerEl.className = "bases-view";
	}

	return {
		dom,
		state: {
			doc,
			field: jest.fn(() => ({
				file: { path: "Recipes/Test Recipe 2.md" },
				leaf: options.embedded ? { parent: null } : { parent: {} },
				containerEl,
			})),
		},
		visibleRanges: [{ from: 0, to: doc.length }],
	};
}

describe("Issue #2109: instant convert in embedded mobile editors", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("does not decorate checkbox lines inside detached embedded editors", () => {
		const widgetSpy = jest.spyOn(Decoration, "widget");
		const plugin = PluginFactory.createMockPlugin({
			settings: {
				enableInstantTaskConvert: true,
			},
		});

		buildConvertButtonDecorations(
			createMockView(["- [ ] Now it fails!"], { embedded: true }),
			plugin as any
		);

		expect(widgetSpy).not.toHaveBeenCalled();
	});

	it("continues to decorate checkbox lines in a normal note editor", () => {
		const widgetSpy = jest.spyOn(Decoration, "widget");
		const plugin = PluginFactory.createMockPlugin({
			settings: {
				enableInstantTaskConvert: true,
			},
		});

		buildConvertButtonDecorations(createMockView(["- [ ] Normal task"]), plugin as any);

		expect(widgetSpy).toHaveBeenCalledTimes(1);
	});
});
