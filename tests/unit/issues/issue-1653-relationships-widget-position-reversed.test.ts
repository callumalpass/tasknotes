/**
 * Reproduction tests for Issue #1653: Setting for position of relationships
 * widget may be reversed.
 *
 * Bug: The "top" and "bottom" options for the relationships widget position
 * setting produce the opposite visual result from what the user expects.
 *
 * Root cause:
 * - `src/editor/RelationshipsDecorations.ts` reads `plugin.settings.relationshipsPosition`
 *   (default: "bottom") at lines 346 (source mode) and 485 (reading mode).
 * - The `position === "top"` branch inserts after metadata-container/task-card,
 *   and the `else` branch inserts before backlinks or at the end.
 * - The code logic appears correct semantically, but the visual result may be
 *   inverted due to the specific DOM insertion points chosen.
 *
 * Related files:
 * - src/editor/RelationshipsDecorations.ts (lines 346-380, 485-520)
 * - src/settings/tabs/appearanceTab.ts (dropdown setting, lines 551-566)
 * - src/settings/defaults.ts (default: "bottom", line 332)
 */

import { describe, it, expect } from '@jest/globals';

describe('Issue #1653: Relationships widget position setting may be reversed', () => {
	it.skip('reproduces issue #1653 - "top" position should place widget near the top of the note', () => {
		// Simulates the DOM insertion logic from RelationshipsDecorations.ts
		// Source mode handler (lines ~364-380)

		const position = 'top';
		const sizerChildren = ['metadata-container', 'cm-contentContainer', 'backlinks'];

		// Current "top" logic: insert after metadata-container or task-card
		let insertionIndex: number;
		const metadataIdx = sizerChildren.indexOf('metadata-container');
		if (metadataIdx !== -1) {
			insertionIndex = metadataIdx + 1; // After metadata = index 1
		} else {
			insertionIndex = 0; // Beginning
		}

		// Widget is inserted at index 1 (after metadata, before content)
		// This should visually appear at the top, right after the frontmatter properties
		expect(insertionIndex).toBeLessThan(sizerChildren.indexOf('cm-contentContainer'));

		// If the user reports this appears at the bottom, the DOM structure
		// may differ from expectations, or the metadata-container is not found
		// and the fallback places it incorrectly.
	});

	it.skip('reproduces issue #1653 - "bottom" position should place widget at end of note', () => {
		const position = 'bottom';
		const sizerChildren = ['metadata-container', 'cm-contentContainer', 'backlinks'];

		// Current "bottom" logic: insert before backlinks or at the end
		const backlinksIdx = sizerChildren.indexOf('backlinks');
		let insertionIndex: number;
		if (backlinksIdx !== -1) {
			insertionIndex = backlinksIdx; // Before backlinks
		} else {
			insertionIndex = sizerChildren.length; // At the end
		}

		// Widget should be at or near the end
		expect(insertionIndex).toBeGreaterThanOrEqual(sizerChildren.indexOf('cm-contentContainer'));
	});
});
