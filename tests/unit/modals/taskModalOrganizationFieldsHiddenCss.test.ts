/**
 * The organization row header/empty-button/details-toggle rules set an
 * unconditional `display` value, which has the same specificity as the
 * browser's default `[hidden] { display: none }` rule. Without an explicit
 * `[hidden]` override, toggling the `hidden` DOM property does not actually
 * hide the element, causing the "Add X" button, the (empty) section header,
 * and its "+" button to all render at once for empty organization sections.
 */

import * as fs from "fs";
import * as path from "path";

const cssFilePath = path.resolve(__dirname, "../../../styles/task-modal-sheet.css");

describe("task modal organization/details hidden-state CSS", () => {
	const cssContent = fs.readFileSync(cssFilePath, "utf-8");

	it("hides the organization header when marked hidden", () => {
		expect(cssContent).toMatch(
			/\.tn-task-modal__org-header\[hidden\]\s*\{\s*display:\s*none;\s*\}/
		);
	});

	it("hides the organization empty row when marked hidden", () => {
		expect(cssContent).toMatch(
			/\.tn-task-modal__org-empty-row\[hidden\]\s*\{\s*display:\s*none;\s*\}/
		);
	});

	it("hides the details show-more toggle when marked hidden", () => {
		expect(cssContent).toMatch(
			/\.tn-task-modal__details-toggle\[hidden\]\s*\{\s*display:\s*none;\s*\}/
		);
	});
});
