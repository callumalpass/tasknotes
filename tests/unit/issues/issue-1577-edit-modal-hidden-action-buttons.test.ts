/**
 * Skipped reproduction tests for Issue #1577:
 * Edit Note modal hides action buttons (no scroll available)
 *
 * Bug Description:
 * In the Edit Note / Edit Task modal, the Open Notes, Archive, Save, and
 * Cancel buttons are not visible. The modal cannot be scrolled, so the
 * buttons are unreachable.
 *
 * Steps to reproduce:
 * 1. Open any note/task
 * 2. Click Edit
 * 3. Observe the bottom of the modal — action buttons are hidden below viewport
 *
 * Root Cause:
 * The expanded modal's .modal-content had overflow: hidden and no flex layout,
 * so when content exceeded 85vh the button container was pushed below the
 * visible area with no way to scroll to it.
 *
 * Fix (commit 54d9873c):
 * - Set .modal-content as a flex column container with max-height: 85vh
 * - Make .minimalist-modal-container a flex child (flex: 1, min-height: 0)
 * - Add overflow-y: auto to .modal-split-content for scrollable form fields
 * - Keep .modal-button-container pinned at bottom with flex-shrink: 0
 * - Add visual separator (border-top) on button container
 * - On wide screens (split-layout), reset overflow to visible since columns
 *   handle their own scrolling
 *
 * Relevant CSS: styles/task-modal.css lines 567-598
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Issue #1577: Edit Note modal hides action buttons', () => {
	const cssFilePath = path.resolve(__dirname, '../../../styles/task-modal.css');

	let cssContent: string;

	beforeAll(() => {
		cssContent = fs.readFileSync(cssFilePath, 'utf-8');
	});

	describe('expanded modal-content flex layout', () => {
		it.skip('reproduces issue #1577 - modal-content should be a flex column container', () => {
			// Without display: flex and flex-direction: column on .modal-content,
			// the button container cannot be pinned at the bottom of the modal.
			// The original CSS only had overflow: hidden which clipped the buttons.

			const expandedModalContentBlock = extractCssBlock(
				cssContent,
				'.tasknotes-plugin.minimalist-task-modal.expanded .modal-content'
			);

			expect(expandedModalContentBlock).toContain('display: flex');
			expect(expandedModalContentBlock).toContain('flex-direction: column');
		});

		it.skip('reproduces issue #1577 - modal-content should constrain height', () => {
			// max-height: 85vh ensures the modal doesn't exceed viewport
			const expandedModalContentBlock = extractCssBlock(
				cssContent,
				'.tasknotes-plugin.minimalist-task-modal.expanded .modal-content'
			);

			expect(expandedModalContentBlock).toMatch(/max-height:\s*85vh/);
		});
	});

	describe('minimalist-modal-container as flex child', () => {
		it.skip('reproduces issue #1577 - modal container should fill available space with flex: 1', () => {
			// The .minimalist-modal-container needs flex: 1 and min-height: 0
			// so it fills the space between header and buttons while allowing
			// the flex layout to properly constrain its size.
			const containerBlock = extractCssBlock(
				cssContent,
				'.tasknotes-plugin.minimalist-task-modal.expanded .minimalist-modal-container'
			);

			expect(containerBlock).toContain('flex: 1');
			expect(containerBlock).toContain('min-height: 0');
		});
	});

	describe('scrollable split-content area', () => {
		it.skip('reproduces issue #1577 - split-content should have overflow-y: auto', () => {
			// This is the critical fix: the form content area needs overflow-y: auto
			// so that when content exceeds the available space, users can scroll
			// to see all fields while buttons remain pinned below.
			const splitContentBlock = extractCssBlock(
				cssContent,
				'.tasknotes-plugin.minimalist-task-modal.expanded .modal-split-content'
			);

			expect(splitContentBlock).toMatch(/overflow-y:\s*auto/);
		});
	});

	describe('button container pinned at bottom', () => {
		it.skip('reproduces issue #1577 - button container should not shrink', () => {
			// flex-shrink: 0 ensures the button container always stays at its
			// natural size and never gets compressed or pushed out of view.
			const buttonBlock = extractCssBlock(
				cssContent,
				'.tasknotes-plugin.minimalist-task-modal.expanded .modal-button-container'
			);

			expect(buttonBlock).toContain('flex-shrink: 0');
		});

		it.skip('reproduces issue #1577 - button container should have visual separator', () => {
			// A border-top provides visual separation between scrollable content
			// and the pinned action buttons.
			const buttonBlock = extractCssBlock(
				cssContent,
				'.tasknotes-plugin.minimalist-task-modal.expanded .modal-button-container'
			);

			expect(buttonBlock).toMatch(/border-top:/);
		});
	});
});

/**
 * Extracts the CSS block for a given selector from the full CSS content.
 * Returns the content between the opening { and closing } of the first
 * matching rule block.
 */
function extractCssBlock(css: string, selector: string): string {
	// Escape special regex characters in the selector
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	// Match the selector followed by its block (handling nested braces is not
	// needed here since these are simple property blocks)
	const regex = new RegExp(escapedSelector + '\\s*\\{([^}]*?)\\}', 's');
	const match = css.match(regex);
	return match ? match[1] : '';
}
