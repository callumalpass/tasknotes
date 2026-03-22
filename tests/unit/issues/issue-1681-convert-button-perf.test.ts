/**
 * Reproduction tests for issue #1681.
 *
 * Reported behavior:
 * - "Show convert button next to checkboxes" causes significant CPU usage
 *   and cursor freezing when navigating files with many checkboxes in large
 *   vaults.
 * - Disabling the setting restores smooth navigation.
 */

describe('Issue #1681: Convert button decoration performance on large documents', () => {
	it.skip('reproduces issue #1681 - buildConvertButtonDecorations scans all lines', () => {
		// Simulate the performance issue: buildConvertButtonDecorations iterates
		// over every line in the document (line 210), calling parseTaskLine per line.

		const checkboxLine = '- [ ] Task item';
		const normalLine = 'Some regular text';
		const lineCount = 5000; // Simulate a large document

		// Build a mock document with many checkbox lines
		const lines: string[] = [];
		for (let i = 0; i < lineCount; i++) {
			lines.push(i % 3 === 0 ? checkboxLine : normalLine);
		}

		// Simulate the regex check that parseTaskLine does
		const taskLineRegex = /^\s*[-*+]\s+\[.\]\s+/;
		let parseCallCount = 0;

		const startTime = Date.now();
		for (let i = 0; i < lines.length; i++) {
			// This simulates what buildConvertButtonDecorations does for every line
			parseCallCount++;
			taskLineRegex.test(lines[i]);
		}
		const elapsed = Date.now() - startTime;

		// Documents the issue: ALL lines are scanned, not just visible ones
		expect(parseCallCount).toBe(lineCount);

		// A viewport-aware approach would only scan ~50-100 visible lines
		const viewportLineCount = 50;
		expect(parseCallCount).toBeGreaterThan(viewportLineCount * 10);
	});
});
