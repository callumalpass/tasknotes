/**
 * Regression coverage for Issue #1439: "cannot find 'uid' on type Link" in Blocking view
 *
 * This is a followup to issue #1304 (which fixed the missing list() wrapper).
 * After applying the fix from #1304, users still encounter a new error:
 * `Failed to evaluate a filter: cannot find "uid" on type Link`
 *
 * The filter in question:
 *   `list(note.blockedBy).map(value.uid).contains(this.file.asLink())`
 *
 * Root cause analysis:
 * The blockedBy property can contain different data types depending on how it was set:
 * 1. TaskDependency objects: { uid: "[[Task]]", reltype: "FINISHTOSTART" } - Has .uid ✓
 * 2. Plain strings: "[[Task]]" - After list(), becomes ["[[Task]]"], no .uid property
 * 3. Obsidian Link objects: { path: "Task.md", ... } - Has .path but NOT .uid ✗
 *
 * When Bases evaluates the filter on raw frontmatter data, it may receive:
 * - Link objects (Obsidian's internal link representation) which don't have a .uid property
 * - The .map(value.uid) fails because Link has .path, not .uid
 *
 * The fix needs to handle the case where blockedBy entries are Link objects,
 * either by:
 * 1. Normalizing data before it reaches Bases (ensure all entries are TaskDependency objects)
 * 2. Changing the filter to handle both .uid and .path properties
 * 3. Using a different filter approach that works with raw Link objects
 */

import { describe, it, expect } from '@jest/globals';

/**
 * Represents an Obsidian Link object as returned by Bases when parsing frontmatter links.
 * Link objects have a `path` property but NOT a `uid` property.
 */
interface ObsidianLink {
	path: string;
	display?: string;
	subpath?: string;
	type?: 'file' | 'header' | 'block';
}

/**
 * Represents a TaskDependency object as used by TaskNotes.
 * This has a `uid` property containing the link string.
 */
interface TaskDependency {
	uid: string;
	reltype: string;
	gap?: string;
}

/**
 * Simulates the list() function in Bases filter expressions.
 */
function list<T>(value: T | T[] | null | undefined): T[] {
	if (value === null || value === undefined) {
		return [];
	}
	if (Array.isArray(value)) {
		return value;
	}
	return [value];
}

/**
 * Simulates the asLink() function returning a Link object for comparison.
 */
function asLink(path: string): ObsidianLink {
	return { path };
}

/**
 * Simulates evaluating the CURRENT filter on Link objects.
 * Filter: `list(note.blockedBy).map(value.uid).contains(this.file.asLink())`
 *
 * This will fail when blockedBy contains Link objects because they don't have .uid
 */
function evaluateBlockingFilterWithLinkObjects(
	blockedBy: (TaskDependency | ObsidianLink | string)[] | TaskDependency | ObsidianLink | string | null | undefined,
	targetFile: ObsidianLink
): boolean | Error {
	const blockedByList = list(blockedBy);

	if (blockedByList.length === 0) {
		return false;
	}

	// Simulate what Bases does: .map(value.uid)
	// This fails when value is a Link object (has .path, not .uid)
	const uids: (string | undefined)[] = [];
	for (const value of blockedByList) {
		if (typeof value === 'object' && value !== null) {
			// Check if this is a Link object (has path but not uid)
			if ('uid' in value) {
				uids.push((value as TaskDependency).uid);
			} else if ('path' in value) {
				// This is a Link object - accessing .uid will fail in Bases
				// Simulating the error: "cannot find 'uid' on type Link"
				return new Error('cannot find "uid" on type Link');
			}
		} else if (typeof value === 'string') {
			// Strings don't have .uid property either
			return new Error('cannot find "uid" on type string');
		}
	}

	// Check if any uid matches the target link
	const targetLinkStr = `[[${targetFile.path.replace(/\.md$/, '')}]]`;
	return uids.some(uid => uid === targetLinkStr);
}

/**
 * A potential fix: Use asLink() for comparison and check for .path on Link objects
 * Filter could be: `list(note.blockedBy).map(value.path || value.uid).contains(this.file.asLink().path)`
 * Or ensure all blockedBy entries are properly normalized before storage
 */
function evaluateBlockingFilterFixed(
	blockedBy: (TaskDependency | ObsidianLink | string)[] | TaskDependency | ObsidianLink | string | null | undefined,
	targetFile: ObsidianLink
): boolean {
	const blockedByList = list(blockedBy);

	if (blockedByList.length === 0) {
		return false;
	}

	// Extract path/uid from each entry, handling all possible formats
	const paths: string[] = [];
	for (const value of blockedByList) {
		if (typeof value === 'string') {
			// Plain string link like "[[Task]]"
			const match = value.match(/\[\[([^\]|]+)/);
			if (match) {
				paths.push(match[1] + '.md');
			}
		} else if (typeof value === 'object' && value !== null) {
			if ('path' in value) {
				// Link object - use path directly
				paths.push((value as ObsidianLink).path);
			} else if ('uid' in value) {
				// TaskDependency - extract path from uid
				const uid = (value as TaskDependency).uid;
				const match = uid.match(/\[\[([^\]|]+)/);
				if (match) {
					paths.push(match[1] + '.md');
				}
			}
		}
	}

	// Compare against target file path
	return paths.includes(targetFile.path);
}

describe('Issue #1439: Blocking view "cannot find uid on type Link"', () => {
	const targetFile: ObsidianLink = {
		path: 'TaskNotes/Project setup.md'
	};

	describe('When blockedBy contains Link objects (not TaskDependency)', () => {
		// This is the problematic case - Obsidian/Bases returns Link objects
		// instead of TaskDependency objects
		const linkObject: ObsidianLink = {
			path: 'TaskNotes/Project setup.md',
			display: 'Project setup'
		};

		it('CURRENT: should fail with "cannot find uid" error when blockedBy is a Link object', () => {
			// This test documents the current broken behavior
			const result = evaluateBlockingFilterWithLinkObjects(linkObject, targetFile);

			// The current implementation fails because Link objects don't have .uid
			expect(result).toBeInstanceOf(Error);
			expect((result as Error).message).toContain('cannot find "uid" on type Link');
		});

		it('CURRENT: should fail with "cannot find uid" error when blockedBy array contains Link objects', () => {
			const linkObjects: ObsidianLink[] = [
				{ path: 'TaskNotes/Project setup.md' },
				{ path: 'TaskNotes/Other task.md' }
			];

			const result = evaluateBlockingFilterWithLinkObjects(linkObjects, targetFile);

			expect(result).toBeInstanceOf(Error);
			expect((result as Error).message).toContain('cannot find "uid" on type Link');
		});

		it('FIXED: should correctly evaluate filter when blockedBy contains Link objects', () => {
			const result = evaluateBlockingFilterFixed(linkObject, targetFile);

			// With proper handling, the filter should work
			expect(result).toBe(true);
		});
	});

	describe('When blockedBy contains TaskDependency objects (expected format)', () => {
		const taskDependency: TaskDependency = {
			uid: '[[TaskNotes/Project setup]]',
			reltype: 'FINISHTOSTART'
		};

		it('CURRENT: should work correctly with TaskDependency objects', () => {
			const result = evaluateBlockingFilterWithLinkObjects(taskDependency, targetFile);

			// TaskDependency objects have .uid, so this works
			expect(result).not.toBeInstanceOf(Error);
			expect(result).toBe(true);
		});

		it('FIXED: should work correctly with TaskDependency objects', () => {
			const result = evaluateBlockingFilterFixed(taskDependency, targetFile);

			expect(result).toBe(true);
		});
	});

	describe('When blockedBy contains mixed types', () => {
		it('CURRENT: should fail if any entry is a Link object', () => {
			const mixedEntries = [
				{ uid: '[[Other task]]', reltype: 'FINISHTOSTART' } as TaskDependency,
				{ path: 'TaskNotes/Project setup.md' } as ObsidianLink // This causes the error
			];

			const result = evaluateBlockingFilterWithLinkObjects(mixedEntries, targetFile);

			// Even one Link object in the array causes failure
			// (In reality, Bases would fail on the first Link object encountered)
			expect(result).toBeInstanceOf(Error);
		});

		it('FIXED: should handle mixed types correctly', () => {
			const mixedEntries = [
				{ uid: '[[Other task]]', reltype: 'FINISHTOSTART' } as TaskDependency,
				{ path: 'TaskNotes/Project setup.md' } as ObsidianLink
			];

			const result = evaluateBlockingFilterFixed(mixedEntries, targetFile);

			expect(result).toBe(true);
		});
	});

	describe('When blockedBy contains plain strings', () => {
		it('CURRENT: should fail with "cannot find uid" error for string values', () => {
			const plainString = '[[TaskNotes/Project setup]]';

			const result = evaluateBlockingFilterWithLinkObjects(plainString, targetFile);

			// Strings don't have .uid property
			expect(result).toBeInstanceOf(Error);
			expect((result as Error).message).toContain('cannot find "uid" on type string');
		});

		it('FIXED: should handle plain string links correctly', () => {
			const plainString = '[[TaskNotes/Project setup]]';

			const result = evaluateBlockingFilterFixed(plainString, targetFile);

			expect(result).toBe(true);
		});
	});

	describe('Edge cases', () => {
		it('should return false for null blockedBy', () => {
			expect(evaluateBlockingFilterFixed(null, targetFile)).toBe(false);
		});

		it('should return false for undefined blockedBy', () => {
			expect(evaluateBlockingFilterFixed(undefined, targetFile)).toBe(false);
		});

		it('should return false for empty array', () => {
			expect(evaluateBlockingFilterFixed([], targetFile)).toBe(false);
		});

		it('should return false when target file is not in blockedBy', () => {
			const otherDependency: TaskDependency = {
				uid: '[[Some other task]]',
				reltype: 'FINISHTOSTART'
			};

			expect(evaluateBlockingFilterFixed(otherDependency, targetFile)).toBe(false);
		});
	});
});

describe('Data format variations for blockedBy property', () => {
	/**
	 * Documents the different formats that blockedBy entries can take
	 * depending on how the data was entered and how Obsidian/Bases parses it
	 */

	it('TaskDependency format (expected): has uid, reltype, optional gap', () => {
		const entry: TaskDependency = {
			uid: '[[Project setup]]',
			reltype: 'FINISHTOSTART',
			gap: 'P1D'
		};

		expect(entry.uid).toBe('[[Project setup]]');
		expect('path' in entry).toBe(false); // Does NOT have .path
	});

	it('Obsidian Link format (problematic): has path, display, but NO uid', () => {
		const entry: ObsidianLink = {
			path: 'TaskNotes/Project setup.md',
			display: 'Project setup'
		};

		expect(entry.path).toBe('TaskNotes/Project setup.md');
		expect('uid' in entry).toBe(false); // Does NOT have .uid
	});

	it('String format: just the link text, no properties', () => {
		const entry = '[[Project setup]]';

		expect(typeof entry).toBe('string');
		// Strings have no .uid or .path properties
		expect((entry as any).uid).toBeUndefined();
		expect((entry as any).path).toBeUndefined();
	});
});

describe('Relationship between #1304 and #1439', () => {
	/**
	 * Issue #1304: "Cannot find function map on type Link"
	 * - Problem: blockedBy was a single Link, not an array
	 * - Fix: Wrap with list() to ensure array: `list(note.blockedBy).map(...)`
	 *
	 * Issue #1439: "Cannot find uid on type Link"
	 * - Problem: After list() wrapper, blockedBy is now an array, but entries are Link objects
	 * - The .map(value.uid) fails because Link objects have .path, not .uid
	 * - This is a data format mismatch, not a list/array issue
	 */

	it('#1304 fix resolved: list() wrapper ensures blockedBy is always an array', () => {
		const singleLink: ObsidianLink = { path: 'Task.md' };

		// Before #1304 fix: calling .map() on a single Link would fail
		// After #1304 fix: list() ensures we have an array
		const asArray = list(singleLink);

		expect(Array.isArray(asArray)).toBe(true);
		expect(asArray.length).toBe(1);
	});

	it('#1439 problem: even with list(), accessing .uid fails on Link objects', () => {
		const linkArray = [{ path: 'Task.md' }];

		// list() worked, but now .map(value.uid) fails because Link has .path not .uid
		const hasUid = linkArray.every(entry => 'uid' in entry);
		expect(hasUid).toBe(false);

		const hasPath = linkArray.every(entry => 'path' in entry);
		expect(hasPath).toBe(true);
	});
});
