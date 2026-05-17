import fs from "fs";
import path from "path";

const cssFilePath = path.resolve(__dirname, "../../../styles/task-modal.css");

describe("Issue #1228: details editor heading colors", () => {
	it("maps Obsidian heading color variables into the details CodeMirror editor", () => {
		const css = fs.readFileSync(cssFilePath, "utf-8");

		for (const level of [1, 2, 3, 4, 5, 6]) {
			expect(css).toContain(
				`.tn-task-modal__markdown-editor--details .HyperMD-header-${level},`
			);
			expect(css).toContain(`.tn-task-modal__markdown-editor--details .cm-header-${level}`);
			expect(css).toContain(`color: var(--h${level}-color, var(--text-normal));`);
		}
	});
});
