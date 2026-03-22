/**
 * Reproduction test for issue #1663.
 *
 * Reported behavior:
 * - Japanese tags (e.g. #テスト) do not receive rounded-corner styling on the
 *   Kanban board, while English tags (#test) render correctly with styling.
 *
 * Root cause:
 * - The normalizeTag() function in tagRenderer.ts should preserve CJK characters,
 *   and the resulting <a class="tag"> element should receive Obsidian's tag styling.
 *   The issue may be in Obsidian's CSS selectors not matching CJK href values.
 */

import { normalizeTag } from '../../../src/ui/renderers/tagRenderer';

describe('Issue #1663: Japanese tag display on Kanban board', () => {
	it.skip('reproduces issue #1663 - normalizeTag should preserve Japanese characters', () => {
		// normalizeTag should handle CJK characters
		expect(normalizeTag('テスト')).toBe('#テスト');
		expect(normalizeTag('#テスト')).toBe('#テスト');

		// Mixed content
		expect(normalizeTag('#test-テスト')).toBe('#test-テスト');
	});

	it.skip('reproduces issue #1663 - rendered tag element should have correct attributes for CJK', () => {
		// When renderTag creates an <a class="tag" href="#テスト"> element,
		// the element should receive the same CSS styling as <a class="tag" href="#test">
		// This may require additional CSS rules or a data attribute for styling
		// rather than relying on Obsidian's href-based selectors
	});
});
