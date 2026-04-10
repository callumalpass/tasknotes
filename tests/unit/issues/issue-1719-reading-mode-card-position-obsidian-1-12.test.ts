/**
 * Issue #1719: Inline task card mispositioned in reading mode on Obsidian 1.12.x
 *
 * Bug Description:
 * Obsidian 1.12.x changed the reading mode DOM structure by wrapping .inline-title and
 * .metadata-container in a new .mod-header.mod-ui element. This breaks the task card
 * injection logic in TaskCardNoteDecorations.ts which assumes .metadata-container is a
 * direct child of .markdown-preview-sizer.
 *
 * Root cause:
 * In injectTaskCardInReadingMode() (TaskCardNoteDecorations.ts lines 468-480):
 * - querySelector('.metadata-container') finds the element inside .mod-header.mod-ui
 * - metadataContainer.nextSibling is null (last child of .mod-header, not of sizer)
 * - Fallback inserts as firstChild of sizer, placing card above title/properties
 * - Card also disappears on tab switch because reading mode re-render doesn't re-trigger injection
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1719
 */

import { describe, it, expect } from '@jest/globals';

describe('Issue #1719: Reading mode task card position on Obsidian 1.12.x', () => {
	/**
	 * Simulates the DOM structure and injection logic to demonstrate the bug.
	 */
	function simulateOldDOMInjection(): { insertedBefore: string | null } {
		// Old Obsidian DOM structure (pre-1.12)
		// .markdown-preview-sizer > .metadata-container + content
		const metadataContainer = { nextSibling: 'content-section', parentElement: 'sizer' };
		if (metadataContainer.nextSibling) {
			return { insertedBefore: metadataContainer.nextSibling };
		}
		return { insertedBefore: null }; // firstChild fallback
	}

	function simulateNewDOMInjection(): { insertedBefore: string | null } {
		// New Obsidian 1.12.x DOM structure
		// .markdown-preview-sizer > .mod-header.mod-ui > .metadata-container
		// .metadata-container is now LAST child of .mod-header, so nextSibling is null
		const metadataContainer = { nextSibling: null, parentElement: 'mod-header' };
		if (metadataContainer.nextSibling) {
			return { insertedBefore: metadataContainer.nextSibling };
		}
		return { insertedBefore: null }; // firstChild fallback - BUG: inserts above title
	}

	it.skip('reproduces issue #1719: card injected above title in Obsidian 1.12.x reading mode', () => {
		const oldResult = simulateOldDOMInjection();
		const newResult = simulateNewDOMInjection();

		// Old DOM: correctly inserts before content section
		expect(oldResult.insertedBefore).toBe('content-section');

		// New DOM: BUG - falls back to firstChild (above title)
		// Expected: should insert after .mod-header.mod-ui element
		// Actual: insertedBefore is null, meaning firstChild fallback is used
		expect(newResult.insertedBefore).not.toBeNull();
	});

	it.skip('reproduces issue #1719: should handle both old and new DOM structures', () => {
		// The fix should detect .mod-header.mod-ui and insert after it
		// when .metadata-container.nextSibling is null

		// Simulated fix logic:
		function simulateFixedInjection(hasModHeader: boolean): string {
			if (hasModHeader) {
				// New DOM: insert after .mod-header.mod-ui in sizer
				return 'after-mod-header';
			} else {
				// Old DOM: insert after .metadata-container in sizer
				return 'after-metadata-container';
			}
		}

		expect(simulateFixedInjection(true)).toBe('after-mod-header');
		expect(simulateFixedInjection(false)).toBe('after-metadata-container');
	});
});
