/**
 * TaskManager.isTaskFile - Tag hash prefix handling
 *
 * @see https://github.com/callumalpass/tasknotes/pull/1607
 *
 * Bug:
 * Obsidian's metadata cache prepends '#' to frontmatter tags internally.
 * For example, a file with `tags: [task]` in YAML frontmatter has
 * `cache.frontmatter.tags` = `["#task"]` at runtime.
 *
 * TaskManager.isTaskFile() passed these raw cache values (with '#' prefix)
 * to FilterUtils.matchesHierarchicalTagExact(), which compares them against
 * the taskTag setting (e.g. "task" without '#'). The comparison "#task" !== "task"
 * always failed, causing all tag-identified tasks to be invisible.
 *
 * Fix:
 * Strip the '#' prefix from each tag before passing to matchesHierarchicalTagExact().
 */

import { describe, it, expect } from '@jest/globals';
import { FilterUtils } from '../../../src/utils/FilterUtils';

// Replicate the exact isTaskFile logic from TaskManager to test in isolation
// without needing to construct the full TaskManager with App/Settings dependencies.
interface IsTaskFileSettings {
	taskIdentificationMethod: 'tag' | 'property';
	taskTag: string;
	taskPropertyName?: string;
	taskPropertyValue?: string;
}

function isTaskFile(
	frontmatter: Record<string, unknown> | null | undefined,
	settings: IsTaskFileSettings
): boolean {
	if (!frontmatter) return false;

	if (settings.taskIdentificationMethod === 'property') {
		const propName = settings.taskPropertyName;
		const propValue = settings.taskPropertyValue;
		if (!propName || !propValue) return false;

		const frontmatterValue = frontmatter[propName];
		if (frontmatterValue === undefined) return false;

		if (Array.isArray(frontmatterValue)) {
			return frontmatterValue.some(
				(val: unknown) => val === propValue
			);
		}
		return frontmatterValue === propValue;
	} else {
		// Tag-based method (the fixed version)
		if (!Array.isArray(frontmatter.tags)) return false;
		return frontmatter.tags.some((tag: string) => {
			if (typeof tag !== 'string') return false;
			// Obsidian metadata cache prepends '#' to frontmatter tags
			const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
			return FilterUtils.matchesHierarchicalTagExact(cleanTag, settings.taskTag);
		});
	}
}

describe('TaskManager.isTaskFile - tag hash prefix handling', () => {
	const tagSettings: IsTaskFileSettings = {
		taskIdentificationMethod: 'tag',
		taskTag: 'task',
	};

	describe('Obsidian metadata cache tags (with # prefix)', () => {
		it('should identify task when tags have # prefix from metadata cache', () => {
			const frontmatter = { tags: ['#task', '#planning'] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(true);
		});

		it('should identify task when only the task tag has # prefix', () => {
			const frontmatter = { tags: ['#task'] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(true);
		});

		it('should return false when # tags do not include the task tag', () => {
			const frontmatter = { tags: ['#planning', '#work'] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(false);
		});
	});

	describe('Raw frontmatter tags (without # prefix)', () => {
		it('should identify task with plain tag values', () => {
			const frontmatter = { tags: ['task', 'planning'] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(true);
		});

		it('should return false when plain tags do not include the task tag', () => {
			const frontmatter = { tags: ['planning', 'work'] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(false);
		});
	});

	describe('Mixed tag formats', () => {
		it('should handle mix of # prefixed and plain tags', () => {
			const frontmatter = { tags: ['#planning', 'task'] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(true);
		});

		it('should handle mix where task tag has # prefix among plain tags', () => {
			const frontmatter = { tags: ['planning', '#task', 'work'] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(true);
		});
	});

	describe('Hierarchical tags with # prefix', () => {
		it('should match hierarchical child tag with # prefix', () => {
			const frontmatter = { tags: ['#task/project', '#planning'] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(true);
		});

		it('should match hierarchical child tag without # prefix', () => {
			const frontmatter = { tags: ['task/subtask', 'planning'] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(true);
		});

		it('should not match when tag only starts with same characters', () => {
			// "taskmaster" starts with "task" but is not "task" or "task/..."
			const frontmatter = { tags: ['#taskmaster'] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(false);
		});
	});

	describe('Case insensitivity', () => {
		it('should match case-insensitively with # prefix', () => {
			const frontmatter = { tags: ['#Task', '#Planning'] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(true);
		});

		it('should match case-insensitively without # prefix', () => {
			const frontmatter = { tags: ['TASK'] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(true);
		});
	});

	describe('Edge cases', () => {
		it('should return false for null frontmatter', () => {
			expect(isTaskFile(null, tagSettings)).toBe(false);
		});

		it('should return false for undefined frontmatter', () => {
			expect(isTaskFile(undefined, tagSettings)).toBe(false);
		});

		it('should return false when tags is not an array', () => {
			const frontmatter = { tags: 'task' };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(false);
		});

		it('should return false for empty tags array', () => {
			const frontmatter = { tags: [] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(false);
		});

		it('should handle non-string values in tags array', () => {
			const frontmatter = { tags: [42, null, '#task', undefined] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(true);
		});

		it('should return false when all tag values are non-string', () => {
			const frontmatter = { tags: [42, null, true, undefined] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(false);
		});

		it('should not strip # from tags that are just "#"', () => {
			const frontmatter = { tags: ['#'] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(false);
		});

		it('should handle double-hash tags gracefully', () => {
			// If somehow tags have "##task" (double hash), stripping one '#' yields "#task"
			// which should NOT match "task"
			const frontmatter = { tags: ['##task'] };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(false);
		});
	});

	describe('Property-based identification (unaffected by fix)', () => {
		const propSettings: IsTaskFileSettings = {
			taskIdentificationMethod: 'property',
			taskPropertyName: 'type',
			taskPropertyValue: 'task',
			taskTag: 'task',
		};

		it('should identify task by property value', () => {
			const frontmatter = { type: 'task' };
			expect(isTaskFile(frontmatter, propSettings)).toBe(true);
		});

		it('should return false when property does not match', () => {
			const frontmatter = { type: 'note' };
			expect(isTaskFile(frontmatter, propSettings)).toBe(false);
		});

		it('should handle array property values', () => {
			const frontmatter = { type: ['note', 'task'] };
			expect(isTaskFile(frontmatter, propSettings)).toBe(true);
		});
	});
});
