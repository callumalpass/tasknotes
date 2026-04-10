/**
 * Reproduction test for issue #1668.
 *
 * Reported behavior:
 * - Custom properties with trigger characters (e.g. & for system, ^ for use case)
 *   are recognized in the task title preview but not populated into the form
 *   when the magic wand (NLP auto-populate) button is clicked.
 *
 * Root cause:
 * - The NLP parser correctly extracts trigger-prefixed values into parsed.userFields,
 *   but the auto-populate handler in the modal may not correctly map these values
 *   back to the form fields (possible id vs key mismatch).
 */

import { NaturalLanguageParser } from '../../../src/services/NaturalLanguageParser';
import { DEFAULT_STATUSES, DEFAULT_PRIORITIES } from '../../../src/settings/defaults';

describe('Issue #1668: NLP trigger not working for additional properties', () => {
	it.skip('reproduces issue #1668 - custom trigger characters should populate userFields', () => {
		const userFields = [
			{ id: 'system', key: 'system', displayName: 'System', triggerChar: '&', type: 'text' },
			{ id: 'useCase', key: 'use_case', displayName: 'Use Case', triggerChar: '^', type: 'text' },
		];

		const parser = new NaturalLanguageParser(
			DEFAULT_STATUSES,
			DEFAULT_PRIORITIES,
			true, // defaultToScheduled
			'en',
			undefined,
			userFields as any
		);

		const result = parser.parseInput('Fix login bug &backend ^authentication');

		// Expect userFields to be populated from trigger characters
		expect(result.userFields).toBeDefined();
		expect(result.userFields?.['system']).toBe('backend');
		expect(result.userFields?.['useCase']).toBe('authentication');
	});
});
