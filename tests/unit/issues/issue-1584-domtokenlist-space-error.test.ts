/**
 * Issue #1584: DOMTokenList error when status value contains spaces
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1584
 *
 * Bug:
 * Task cards with status values containing spaces (e.g., "60-In Progress")
 * throw a DOMTokenList error when cycling the status via the status ring.
 * The error occurs because classList.add() does not accept tokens with
 * whitespace characters.
 *
 * Root cause:
 * In updateCardCompletionState() (src/ui/TaskCard.ts), CSS classes are
 * constructed directly from unsanitized status and priority values:
 *
 *   card.classList.add(`task-card--status-${effectiveStatus}`);
 *   card.classList.add(`task-card--priority-${task.priority}`);
 *
 * When effectiveStatus is "60-In Progress", this evaluates to:
 *   classList.add("task-card--status-60-In Progress")
 *
 * This fails because DOMTokenList tokens cannot contain spaces.
 *
 * Error:
 *   Failed to execute 'add' on 'DOMTokenList': The token provided
 *   ('task-card--status-60-In Progress') contains HTML space characters,
 *   which are not valid in tokens.
 *
 * Reproduction steps:
 * 1. Create a task with status containing spaces (e.g., "In Progress")
 * 2. Render the task card in Task List, Kanban, or any card-based view
 * 3. Click the status ring to cycle the status
 * 4. Error is thrown from updateCardCompletionState()
 *
 * Note: The error only occurs when cycling via the status ring click.
 * Changing status via right-click context menu works fine because the
 * context menu updates the task property without triggering updateCardCompletionState.
 *
 * Suggested fix:
 * Sanitize status/priority strings before using them as CSS class names:
 *   const sanitized = effectiveStatus.replace(/\s+/g, '-').toLowerCase();
 *   card.classList.add(`task-card--status-${sanitized}`);
 *
 * Related files:
 * - src/ui/TaskCard.ts: updateCardCompletionState() (lines 217-255)
 * - src/ui/TaskCard.ts: createStatusCycleHandler() (lines 132-212)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { JSDOM } from 'jsdom';

describe('Issue #1584: DOMTokenList error with spaces in status values', () => {
	let document: Document;
	let card: HTMLElement;

	beforeEach(() => {
		const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
		document = dom.window.document;
		card = document.createElement('div');
		card.classList.add('task-card');
	});

	describe('classList.add with status values containing spaces', () => {
		it.skip('reproduces issue #1584 - status with space throws DOMTokenList error', () => {
			// This simulates what updateCardCompletionState does at line 245:
			//   card.classList.add(`task-card--status-${effectiveStatus}`);
			const effectiveStatus = '60-In Progress';

			// This should throw:
			// "Failed to execute 'add' on 'DOMTokenList': The token provided
			// ('task-card--status-60-In Progress') contains HTML space characters"
			expect(() => {
				card.classList.add(`task-card--status-${effectiveStatus}`);
			}).toThrow(/space characters/);

			// After the fix is implemented:
			// - Status values should be sanitized before being used as CSS classes
			// - Spaces should be replaced with hyphens
			// - The class name should be lowercased for consistency
			//
			// Expected sanitized class: "task-card--status-60-in-progress"
		});

		it.skip('reproduces issue #1584 - simple status with space throws error', () => {
			// Even a simple status like "In Progress" should fail
			const effectiveStatus = 'In Progress';

			expect(() => {
				card.classList.add(`task-card--status-${effectiveStatus}`);
			}).toThrow(/space characters/);
		});

		it.skip('reproduces issue #1584 - status with multiple spaces throws error', () => {
			// Status values with multiple consecutive spaces
			const effectiveStatus = 'Waiting  For  Review';

			expect(() => {
				card.classList.add(`task-card--status-${effectiveStatus}`);
			}).toThrow(/space characters/);
		});
	});

	describe('classList.add with priority values containing spaces', () => {
		it.skip('reproduces issue #1584 - priority with space would also throw error', () => {
			// The same pattern exists for priority at line 236:
			//   card.classList.add(`task-card--priority-${task.priority}`);
			//
			// While current priority values likely don't contain spaces,
			// if they ever did, the same error would occur.
			const priority = 'High Priority';

			expect(() => {
				card.classList.add(`task-card--priority-${priority}`);
			}).toThrow(/space characters/);
		});
	});

	describe('Expected behavior after fix', () => {
		it.skip('reproduces issue #1584 - sanitized status class should work', () => {
			// Demonstrates the expected fix behavior
			const effectiveStatus = '60-In Progress';

			// The fix should sanitize the status before creating the class:
			const sanitized = effectiveStatus.replace(/\s+/g, '-').toLowerCase();

			// This should NOT throw
			expect(() => {
				card.classList.add(`task-card--status-${sanitized}`);
			}).not.toThrow();

			// The sanitized class name should be on the element
			expect(card.classList.contains('task-card--status-60-in-progress')).toBe(true);
		});

		it.skip('reproduces issue #1584 - existing status classes should be removed before adding new ones', () => {
			// The updateCardCompletionState function correctly removes old status classes
			// before adding new ones (lines 239-242), so this pattern should continue
			// working after the fix.
			card.classList.add('task-card--status-open');

			// Remove existing status classes
			for (const className of Array.from(card.classList)) {
				if (className.startsWith('task-card--status-')) {
					card.classList.remove(className);
				}
			}

			// Add new sanitized class
			const newStatus = 'In Progress';
			const sanitized = newStatus.replace(/\s+/g, '-').toLowerCase();
			card.classList.add(`task-card--status-${sanitized}`);

			expect(card.classList.contains('task-card--status-open')).toBe(false);
			expect(card.classList.contains('task-card--status-in-progress')).toBe(true);
		});
	});
});
