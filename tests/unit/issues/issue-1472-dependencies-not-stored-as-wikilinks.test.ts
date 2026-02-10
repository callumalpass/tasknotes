/**
 * Issue #1472: [Bug] Task dependencies are not stored as wikilinks
 *
 * Bug Description:
 * When adding task dependencies (blockedBy) through the modal or context menu,
 * the uid values are stored as plain text (e.g., `uid: Task1`) instead of as
 * wikilinks (e.g., `uid: "[[Task1]]"`). This means dependencies break when a
 * dependent file is renamed, because Obsidian cannot track plain text references.
 *
 * Actual result (in YAML frontmatter):
 *   blockedBy:
 *     - uid: Task1
 *       reltype: FINISHTOSTART
 *
 * Expected result:
 *   blockedBy:
 *     - uid: "[[Task1]]"
 *       reltype: FINISHTOSTART
 *
 * Root cause:
 * In FieldMapper.mapToFrontmatter(), blockedBy entries are first normalized via
 * normalizeDependencyEntry() which calls parseLinkToPath() — this strips the
 * wikilink brackets from the uid. Then serializeDependencies() writes the bare
 * uid without re-wrapping it in wikilink brackets.
 *
 * Relevant code:
 * - src/utils/dependencyUtils.ts:23-46 — normalizeDependencyEntry() strips brackets via parseLinkToPath()
 * - src/utils/dependencyUtils.ts:65-76 — serializeDependencies() writes bare uid
 * - src/services/FieldMapper.ts:272-283 — mapToFrontmatter() calls normalize then serialize
 * - src/utils/dependencyUtils.ts:158-167 — formatDependencyLink() correctly generates wikilinks (unused at serialization)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1472
 */

import { describe, it, expect } from '@jest/globals';
import {
	normalizeDependencyEntry,
	normalizeDependencyList,
	serializeDependencies,
} from '../../../src/utils/dependencyUtils';
import type { TaskDependency } from '../../../src/types';

describe('Issue #1472: Task dependencies not stored as wikilinks', () => {
	/**
	 * Core reproduction: serializeDependencies should output wikilink-formatted UIDs.
	 *
	 * When a dependency has a bare uid (after normalization strips brackets),
	 * serialization should re-wrap it in wikilink brackets.
	 */
	it('reproduces issue #1472: serializeDependencies should output uids as wikilinks', () => {
		const dependencies: TaskDependency[] = [
			{ uid: 'Task1', reltype: 'FINISHTOSTART' },
		];

		const serialized = serializeDependencies(dependencies);

		expect(serialized[0].uid).toBe('[[Task1]]');
	});

	/**
	 * Round-trip test: wikilink uid should survive normalization + serialization.
	 *
	 * This is the exact flow that happens in FieldMapper.mapToFrontmatter():
	 * 1. blockedBy entry with uid "[[Task1]]" arrives
	 * 2. normalizeDependencyEntry() strips brackets → uid becomes "Task1"
	 * 3. serializeDependencies() should re-wrap → "[[Task1]]"
	 */
	it('reproduces issue #1472: wikilink uid preserved through normalize → serialize round-trip', () => {
		const rawBlockedBy = [
			{ uid: '[[Task1]]', reltype: 'FINISHTOSTART' },
		];

		const normalized = rawBlockedBy
			.map((item) => normalizeDependencyEntry(item))
			.filter((item): item is NonNullable<ReturnType<typeof normalizeDependencyEntry>> => !!item);

		// normalizeDependencyEntry calls parseLinkToPath which strips [[ ]]
		expect(normalized[0].uid).toBe('Task1');

		// serialization should re-wrap
		const serialized = serializeDependencies(normalized);
		expect(serialized[0].uid).toBe('[[Task1]]');
	});

	/**
	 * Multiple dependencies should all retain wikilink format after serialization.
	 */
	it('reproduces issue #1472: multiple dependencies should all be stored as wikilinks', () => {
		const rawBlockedBy = [
			{ uid: '[[Task1]]', reltype: 'FINISHTOSTART' },
			{ uid: '[[Project/SubTask]]', reltype: 'STARTTOSTART' },
		];

		const normalized = rawBlockedBy
			.map((item) => normalizeDependencyEntry(item))
			.filter((item): item is NonNullable<ReturnType<typeof normalizeDependencyEntry>> => !!item);

		const serialized = serializeDependencies(normalized);

		expect(serialized[0].uid).toBe('[[Task1]]');
		expect(serialized[1].uid).toBe('[[Project/SubTask]]');
	});

	/**
	 * Dependencies added as plain strings should also be serialized as wikilinks.
	 */
	it('reproduces issue #1472: string dependency entries should be serialized as wikilinks', () => {
		const rawBlockedBy = ['[[Task1]]', '[[Another Task]]'];

		const normalized = normalizeDependencyList(rawBlockedBy);
		expect(normalized).toBeDefined();

		const serialized = serializeDependencies(normalized!);

		expect(serialized[0].uid).toBe('[[Task1]]');
		expect(serialized[1].uid).toBe('[[Another Task]]');
	});

	/**
	 * Dependencies with gap values should retain wikilinks AND preserve the gap.
	 */
	it('reproduces issue #1472: dependencies with gap should retain wikilinks', () => {
		const rawBlockedBy = [
			{ uid: '[[Task1]]', reltype: 'FINISHTOSTART', gap: 'P2D' },
		];

		const normalized = rawBlockedBy
			.map((item) => normalizeDependencyEntry(item))
			.filter((item): item is NonNullable<ReturnType<typeof normalizeDependencyEntry>> => !!item);

		const serialized = serializeDependencies(normalized);

		expect(serialized[0].uid).toBe('[[Task1]]');
		expect(serialized[0].gap).toBe('P2D');
	});

	/**
	 * UIDs already wrapped in wikilinks should not be double-wrapped.
	 */
	it('should not double-wrap uids that already have wikilink brackets', () => {
		const dependencies: TaskDependency[] = [
			{ uid: '[[Task1]]', reltype: 'FINISHTOSTART' },
		];

		const serialized = serializeDependencies(dependencies);

		expect(serialized[0].uid).toBe('[[Task1]]');
	});
});
