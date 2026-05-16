/**
 * Regression coverage for issue #1681.
 *
 * The instant convert button should not scan every line in a large document
 * when CodeMirror only needs decorations for the visible viewport.
 */

import { buildConvertButtonDecorations } from "../../../src/editor/InstantConvertButtons";
import { TasksPluginParser } from "../../../src/utils/TasksPluginParser";

type MockLine = {
	number: number;
	from: number;
	to: number;
	text: string;
};

function createMockView(lines: string[], visibleStartLine: number, visibleEndLine: number) {
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
		line: (lineNumber: number) => {
			const line = mockLines[lineNumber - 1];
			if (!line) {
				throw new Error(`No line ${lineNumber}`);
			}
			return line;
		},
		lineAt: (position: number) => {
			const line = mockLines.find((candidate) => (
				candidate.from <= position && candidate.to >= position
			));

			if (line) {
				return line;
			}

			return mockLines[mockLines.length - 1];
		},
	};

	return {
		state: { doc },
		visibleRanges: [
			{
				from: doc.line(visibleStartLine).from,
				to: doc.line(visibleEndLine).to,
			},
		],
	};
}

describe("Issue #1681: convert button decorations stay viewport-scoped", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("parses only visible lines instead of every line in a large document", () => {
		const lineCount = 5000;
		const lines = Array.from({ length: lineCount }, (_, index) =>
			index % 3 === 0 ? "- [ ] Task item" : "Some regular text"
		);
		const visibleLineCount = 50;
		const view = createMockView(lines, 100, 149);
		const parseSpy = jest.spyOn(TasksPluginParser, "parseTaskLine");

		buildConvertButtonDecorations(view, {} as any);

		expect(parseSpy).toHaveBeenCalledTimes(visibleLineCount);
		expect(parseSpy).not.toHaveBeenCalledTimes(lineCount);
	});
});
