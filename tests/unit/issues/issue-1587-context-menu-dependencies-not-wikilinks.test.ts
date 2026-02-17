/**
 * Issue #1587: [Bug] Task Dependencies not always stored as wikilinks
 *
 * Bug Description:
 * When adding task dependencies via the right-click context menu
 * (Dependencies -> Add "blocked by"...), the blockedBy entry is stored
 * as a quoted string instead of a wikilink. However, using the Edit Task
 * modal correctly stores dependencies as wikilinks.
 *
 * The issue was partially fixed in v4.3.1 (#1472), but this context menu
 * path was missed.
 *
 * Additional observation from the issue reporter:
 * If you have one blocking task already listed and use either method to
 * add more, whichever mode you use determines how _all_ of the `uid` values
 * are formatted (the new entry's format propagates to all entries).
 *
 * Actual result (via context menu):
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
 * The context menu's handleBlockedBySelection() creates a dependency with
 * formatDependencyLink() (returns wikilink), passes it through
 * dedupeDependencyEntries() which calls normalizeDependencyEntry()
 * (strips brackets), and then the normalized entries are passed to
 * updateTaskProperty(). If the serialization step doesn't re-wrap them
 * in wikilinks, they are stored as bare strings.
 *
 * Relevant code:
 * - src/components/TaskContextMenu.ts:837-868 — handleBlockedBySelection() adds blocked-by via context menu
 * - src/components/TaskContextMenu.ts:764-777 — dedupeDependencyEntries() normalizes entries
 * - src/utils/dependencyUtils.ts:23-46 — normalizeDependencyEntry() strips wikilink brackets
 * - src/utils/dependencyUtils.ts:65-80 — serializeDependencies() should re-wrap in wikilinks
 * - src/services/FieldMapper.ts:272-283 — mapToFrontmatter() serializes blockedBy
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1587
 * @see https://github.com/callumalpass/tasknotes/issues/1472
 */

import { describe, it, expect } from '@jest/globals';
import {
	normalizeDependencyEntry,
	serializeDependencies,
} from '../../../src/utils/dependencyUtils';
import type { TaskDependency } from '../../../src/types';

describe('Issue #1587: Context menu dependencies not stored as wikilinks', () => {
	/**
	 * Simulates the context menu flow:
	 * 1. formatDependencyLink() returns "[[Task1]]"
	 * 2. dedupeDependencyEntries() normalizes it (strips brackets)
	 * 3. The normalized list is passed to updateTaskProperty()
	 * 4. mapToFrontmatter() should serialize with wikilinks
	 *
	 * The fix for #1472 added serializeDependencies() which re-wraps UIDs.
	 * This test verifies that even after normalization (as happens in the
	 * context menu's deduplication), the serialization correctly adds
	 * wikilink brackets.
	 */
	it.skip('reproduces issue #1587: context menu flow should produce wikilinks', () => {
		// Step 1: formatDependencyLink returns a wikilink
		const formattedLink = '[[Task1]]';
		const dependency: TaskDependency = {
			uid: formattedLink,
			reltype: 'FINISHTOSTART',
		};

		// Step 2: dedupeDependencyEntries calls normalizeDependencyEntry
		// which strips the brackets
		const normalized = normalizeDependencyEntry(dependency);
		expect(normalized).not.toBeNull();
		expect(normalized!.uid).toBe('Task1'); // Brackets stripped

		// Step 3: The normalized dependency is passed to updateTaskProperty
		// which calls mapToFrontmatter -> serializeDependencies
		const serialized = serializeDependencies([normalized!]);

		// Step 4: Verify wikilinks are preserved in the output
		expect(serialized[0].uid).toBe('[[Task1]]');
	});

	/**
	 * Tests the observed behavior where adding a dependency via context menu
	 * affects the format of ALL existing dependencies.
	 *
	 * Scenario: Task has one existing blockedBy entry stored as wikilink,
	 * user adds another via context menu, and ALL entries end up as
	 * quoted strings (not wikilinks).
	 */
	it.skip('reproduces issue #1587: adding via context menu should not change existing entry format', () => {
		// Existing dependency with wikilink format (as stored in task.blockedBy)
		const existingDependency: TaskDependency = {
			uid: '[[ExistingTask]]',
			reltype: 'FINISHTOSTART',
		};

		// New dependency added via context menu (formatDependencyLink returns wikilink)
		const newDependency: TaskDependency = {
			uid: '[[NewTask]]',
			reltype: 'FINISHTOSTART',
		};

		// Context menu's dedupeDependencyEntries normalizes ALL entries
		const normalizedExisting = normalizeDependencyEntry(existingDependency);
		const normalizedNew = normalizeDependencyEntry(newDependency);
		const combined = [normalizedExisting!, normalizedNew!];

		// Verify normalization strips brackets from both
		expect(combined[0].uid).toBe('ExistingTask');
		expect(combined[1].uid).toBe('NewTask');

		// After serialization, both should have wikilinks
		const serialized = serializeDependencies(combined);

		expect(serialized[0].uid).toBe('[[ExistingTask]]');
		expect(serialized[1].uid).toBe('[[NewTask]]');
	});

	/**
	 * Tests that dependencies with paths containing folders are handled correctly.
	 * The wikilink format should be preserved for nested paths.
	 */
	it.skip('reproduces issue #1587: nested path dependencies should retain wikilinks', () => {
		const dependency: TaskDependency = {
			uid: '[[Projects/SubProject/Task1]]',
			reltype: 'FINISHTOSTART',
		};

		const normalized = normalizeDependencyEntry(dependency);
		expect(normalized).not.toBeNull();
		expect(normalized!.uid).toBe('Projects/SubProject/Task1');

		const serialized = serializeDependencies([normalized!]);
		expect(serialized[0].uid).toBe('[[Projects/SubProject/Task1]]');
	});

	/**
	 * Tests that the "blocking" relationship (reverse direction) also
	 * preserves wikilinks when added via context menu.
	 *
	 * Note: The issue reporter mentioned that adding via "blocking"
	 * context menu worked correctly, but we should verify this path too.
	 */
	it.skip('reproduces issue #1587: blocking entries should also use wikilinks', () => {
		const blockingDependency: TaskDependency = {
			uid: '[[BlockedTask]]',
			reltype: 'FINISHTOSTART',
		};

		const normalized = normalizeDependencyEntry(blockingDependency);
		expect(normalized).not.toBeNull();

		const serialized = serializeDependencies([normalized!]);
		expect(serialized[0].uid).toBe('[[BlockedTask]]');
	});

	/**
	 * Tests the complete round-trip: wikilink -> normalize -> serialize -> wikilink
	 * This is the core flow that must work for the fix to be effective.
	 */
	it.skip('reproduces issue #1587: full round-trip preserves wikilinks', () => {
		// Original wikilink format from formatDependencyLink
		const original = '[[My Task]]';

		// Create dependency as context menu does
		const dependency: TaskDependency = {
			uid: original,
			reltype: 'FINISHTOSTART',
		};

		// Normalize (as dedupeDependencyEntries does)
		const normalized = normalizeDependencyEntry(dependency);
		expect(normalized!.uid).toBe('My Task'); // Brackets stripped

		// Serialize (as mapToFrontmatter does)
		const serialized = serializeDependencies([normalized!]);

		// Should be back to wikilink format
		expect(serialized[0].uid).toBe('[[My Task]]');
		expect(serialized[0].reltype).toBe('FINISHTOSTART');
	});

	/**
	 * Tests that gap values are preserved through the normalization
	 * and serialization process.
	 */
	it.skip('reproduces issue #1587: gap values preserved with wikilinks', () => {
		const dependency: TaskDependency = {
			uid: '[[Task1]]',
			reltype: 'FINISHTOSTART',
			gap: 'P2D',
		};

		const normalized = normalizeDependencyEntry(dependency);
		expect(normalized!.gap).toBe('P2D');

		const serialized = serializeDependencies([normalized!]);
		expect(serialized[0].uid).toBe('[[Task1]]');
		expect(serialized[0].gap).toBe('P2D');
	});
});
