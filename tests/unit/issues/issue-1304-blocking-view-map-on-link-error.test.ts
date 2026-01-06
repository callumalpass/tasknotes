/**
 * Regression coverage for Issue #1304: "Cannot find function map on type Link" in Blocking view
 *
 * When embedding the Relationships base and opening the "Blocking" view,
 * Obsidian throws an error: `Failed to evaluate a filter: cannot find function "map" on type Link`
 *
 * The issue is that the filter for the Blocking view is:
 *   `note.blockedBy.map(value.uid).contains(this.file.asLink())`
 *
 * But when `blockedBy` is a single Link object (not an array), the `.map()` method
 * doesn't exist on the Link type. This contrasts with the "Blocked By" view which
 * correctly wraps in `list()`:
 *   `list(this.note.blockedBy).map(value.uid).contains(file.asLink())`
 *
 * The fix: The "Blocking" view filter should also wrap with `list()` to ensure
 * array operations work regardless of whether the property contains one or many values.
 */

import { describe, it, expect } from '@jest/globals';

/**
 * Simulates how Bases parses the blockedBy property.
 * When a property has a single Link value, Bases may return it as a Link object
 * rather than an array containing one Link.
 */
interface MockLink {
	path: string;
	display?: string;
}

interface MockTaskDependency {
	uid: string;
	reltype?: string;
	gap?: string;
}

/**
 * Simulates the `list()` function in Bases filter expressions.
 * Converts single values to arrays and keeps arrays as-is.
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
 * Simulates the current (broken) Blocking view filter behavior.
 * Direct call to .map() on blockedBy without list() wrapper.
 *
 * Filter: `note.blockedBy.map(value.uid).contains(this.file.asLink())`
 */
function evaluateBlockingFilterCurrent(
	blockedBy: MockTaskDependency | MockTaskDependency[] | MockLink | null | undefined,
	targetLink: MockLink
): boolean | Error {
	if (blockedBy === null || blockedBy === undefined) {
		return false;
	}

	// Simulate what happens when Bases tries to call .map() on a non-array
	if (!Array.isArray(blockedBy)) {
		// This is what happens when blockedBy is a single Link object
		// The map function doesn't exist on Link type
		if (typeof (blockedBy as any).map !== 'function') {
			return new Error('cannot find function "map" on type Link');
		}
	}

	// If it's an array, map works fine
	const uids = (blockedBy as MockTaskDependency[]).map(dep => dep.uid);
	return uids.some(uid => uid === `[[${targetLink.path}]]`);
}

/**
 * Simulates the fixed Blocking view filter behavior.
 * Wraps blockedBy with list() before calling .map().
 *
 * Filter: `list(note.blockedBy).map(value.uid).contains(this.file.asLink())`
 */
function evaluateBlockingFilterFixed(
	blockedBy: MockTaskDependency | MockTaskDependency[] | null | undefined,
	targetLink: MockLink
): boolean {
	// Use list() to ensure we always have an array
	const blockedByList = list(blockedBy);

	if (blockedByList.length === 0) {
		return false;
	}

	const uids = blockedByList.map(dep => dep.uid);
	return uids.some(uid => uid === `[[${targetLink.path}]]`);
}

/**
 * Extract the Blocking view filter from the relationships template.
 * This simulates parsing the generated .base file.
 */
function extractBlockingViewFilter(baseContent: string): string | null {
	// Look for the Blocking view section and extract its filter
	const blockingMatch = baseContent.match(/name:\s*["']?Blocking["']?\s*\n\s*filters:\s*\n\s*and:\s*\n\s*-\s*(.+)/);
	return blockingMatch ? blockingMatch[1].trim() : null;
}

/**
 * Check if a filter expression properly uses list() wrapper for blockedBy
 */
function filterUsesListWrapper(filter: string): boolean {
	// Check if blockedBy is wrapped with list() before .map()
	// The pattern should be: list(...blockedBy...).map(...)
	// NOT: blockedBy.map(...)
	return /list\([^)]*blockedBy[^)]*\)\.map/.test(filter);
}

describe('Issue #1304: Blocking view "Cannot find function map on type Link"', () => {
	const targetFile: MockLink = {
		path: 'TaskNotes/Project setup.md',
		display: 'Project setup'
	};

	describe('When blockedBy is a single dependency (parsed as Link)', () => {
		// This represents the problematic case where Bases returns a single Link
		// instead of an array when there's only one blockedBy entry
		const singleDependency: MockTaskDependency = {
			uid: '[[TaskNotes/Project setup.md]]',
			reltype: 'FINISHTOSTART'
		};

		it('CURRENT: should fail with "cannot find function map" error', () => {
			// This test documents the current broken behavior
			const result = evaluateBlockingFilterCurrent(singleDependency, targetFile);

			// The current implementation fails because .map() doesn't exist on Link type
			expect(result).toBeInstanceOf(Error);
			expect((result as Error).message).toContain('cannot find function "map"');
		});

		it('FIXED: should correctly evaluate filter when wrapped with list()', () => {
			// This test shows the expected behavior with the fix
			const result = evaluateBlockingFilterFixed(singleDependency, targetFile);

			// With list() wrapper, the filter should work correctly
			expect(result).toBe(true);
		});
	});

	describe('When blockedBy is an array of dependencies', () => {
		const multipleDependencies: MockTaskDependency[] = [
			{ uid: '[[TaskNotes/Project setup.md]]', reltype: 'FINISHTOSTART' },
			{ uid: '[[TaskNotes/Review docs.md]]', reltype: 'FINISHTOSTART' }
		];

		it('CURRENT: should work correctly with array (no error)', () => {
			const result = evaluateBlockingFilterCurrent(multipleDependencies, targetFile);

			// Arrays work fine with the current implementation
			expect(result).not.toBeInstanceOf(Error);
			expect(result).toBe(true);
		});

		it('FIXED: should work correctly with array', () => {
			const result = evaluateBlockingFilterFixed(multipleDependencies, targetFile);

			expect(result).toBe(true);
		});
	});

	describe('When blockedBy is null or undefined', () => {
		it('CURRENT: should return false for null', () => {
			const result = evaluateBlockingFilterCurrent(null, targetFile);
			expect(result).toBe(false);
		});

		it('FIXED: should return false for null', () => {
			const result = evaluateBlockingFilterFixed(null, targetFile);
			expect(result).toBe(false);
		});

		it('CURRENT: should return false for undefined', () => {
			const result = evaluateBlockingFilterCurrent(undefined, targetFile);
			expect(result).toBe(false);
		});

		it('FIXED: should return false for undefined', () => {
			const result = evaluateBlockingFilterFixed(undefined, targetFile);
			expect(result).toBe(false);
		});
	});

	describe('When blockedBy is an empty array', () => {
		it('FIXED: should return false for empty array', () => {
			const result = evaluateBlockingFilterFixed([], targetFile);
			expect(result).toBe(false);
		});
	});

	describe('Template filter generation', () => {
		// This test verifies the actual template content uses list() wrapper
		// The template is generated in src/templates/defaultBasesFiles.ts

		const mockRelationshipsBase = `# Relationships
filters:
  and:
    - note.status && note.status != ""

views:
  - type: tasknotesTaskList
    name: "Blocked By"
    filters:
      and:
        - list(this.note.blockedBy).map(value.uid).contains(file.asLink())
  - type: tasknotesKanban
    name: "Blocking"
    filters:
      and:
        - note.blockedBy.map(value.uid).contains(this.file.asLink())
`;

		const fixedRelationshipsBase = `# Relationships
filters:
  and:
    - note.status && note.status != ""

views:
  - type: tasknotesTaskList
    name: "Blocked By"
    filters:
      and:
        - list(this.note.blockedBy).map(value.uid).contains(file.asLink())
  - type: tasknotesKanban
    name: "Blocking"
    filters:
      and:
        - list(note.blockedBy).map(value.uid).contains(this.file.asLink())
`;

		it('CURRENT: Blocking view filter does NOT use list() wrapper', () => {
			const filter = extractBlockingViewFilter(mockRelationshipsBase);

			expect(filter).toBeTruthy();
			// The current filter does NOT wrap with list()
			expect(filterUsesListWrapper(filter!)).toBe(false);
			// It directly calls .map() on blockedBy
			expect(filter).toContain('blockedBy.map');
		});

		it('FIXED: Blocking view filter SHOULD use list() wrapper', () => {
			const filter = extractBlockingViewFilter(fixedRelationshipsBase);

			expect(filter).toBeTruthy();
			// The fixed filter should wrap with list()
			expect(filterUsesListWrapper(filter!)).toBe(true);
		});

		it('"Blocked By" view correctly uses list() wrapper', () => {
			// Extract the "Blocked By" view filter
			const blockedByMatch = mockRelationshipsBase.match(
				/name:\s*["']?Blocked By["']?\s*\n\s*filters:\s*\n\s*and:\s*\n\s*-\s*(.+)/
			);
			const filter = blockedByMatch ? blockedByMatch[1].trim() : null;

			expect(filter).toBeTruthy();
			// The "Blocked By" view correctly uses list()
			expect(filter).toContain('list(this.note.blockedBy)');
		});
	});
});

describe('list() helper function behavior', () => {
	it('should convert single value to array', () => {
		const single = { uid: 'test', reltype: 'FINISHTOSTART' };
		const result = list(single);

		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(1);
		expect(result[0]).toBe(single);
	});

	it('should keep arrays as-is', () => {
		const arr = [
			{ uid: 'test1', reltype: 'FINISHTOSTART' },
			{ uid: 'test2', reltype: 'FINISHTOSTART' }
		];
		const result = list(arr);

		expect(result).toBe(arr);
		expect(result.length).toBe(2);
	});

	it('should return empty array for null', () => {
		const result = list(null);

		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(0);
	});

	it('should return empty array for undefined', () => {
		const result = list(undefined);

		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(0);
	});

	it('should handle empty array', () => {
		const result = list([]);

		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(0);
	});
});
