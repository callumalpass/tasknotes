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
import { isTaskFrontmatter } from '../../../src/utils/taskIdentification';

interface IsTaskFileSettings {
	taskIdentificationMethod: 'tag' | 'property';
	taskTag: string;
	taskPropertyName?: string;
	taskPropertyValue?: string;
}

function isTaskFile(
	frontmatter: unknown,
	settings: IsTaskFileSettings
): boolean {
	return isTaskFrontmatter(frontmatter, {
		taskPropertyName: '',
		taskPropertyValue: '',
		...settings,
	});
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

		it('should identify task from a scalar tag string', () => {
			const frontmatter = { tags: 'task' };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(true);
		});

		it('should identify task from a scalar metadata-cache tag string with # prefix', () => {
			const frontmatter = { tags: '#task' };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(true);
		});

		it('should identify task from a scalar hierarchical tag string', () => {
			const frontmatter = { tags: 'task/project' };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(true);
		});

		it('should return false when scalar tag string does not match', () => {
			const frontmatter = { tags: 'planning' };
			expect(isTaskFile(frontmatter, tagSettings)).toBe(false);
		});

		it('should return false when tags is a non-string scalar', () => {
			const frontmatter = { tags: 42 };
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

		it('should return false for array frontmatter', () => {
			expect(isTaskFile([{ tags: ['task'] }], tagSettings)).toBe(false);
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

		it('should match boolean frontmatter against boolean-like settings', () => {
			const settings: IsTaskFileSettings = {
				taskIdentificationMethod: 'property',
				taskPropertyName: 'isTask',
				taskPropertyValue: 'true',
				taskTag: 'task',
			};

			expect(isTaskFile({ isTask: true }, settings)).toBe(true);
			expect(isTaskFile({ isTask: false }, settings)).toBe(false);
		});

		it('should match boolean list values against boolean-like settings', () => {
			const settings: IsTaskFileSettings = {
				taskIdentificationMethod: 'property',
				taskPropertyName: 'flags',
				taskPropertyValue: 'true',
				taskTag: 'task',
			};

			expect(isTaskFile({ flags: ['note', true] }, settings)).toBe(true);
		});
	});

	describe('Property-based identification with empty value (match any value)', () => {
		const anyValueSettings: IsTaskFileSettings = {
			taskIdentificationMethod: 'property',
			taskPropertyName: 'status',
			taskPropertyValue: '',
			taskTag: 'task',
		};

		it('should identify a task when the property exists with any value', () => {
			expect(isTaskFile({ status: 'open' }, anyValueSettings)).toBe(true);
			expect(isTaskFile({ status: 'done' }, anyValueSettings)).toBe(true);
			expect(isTaskFile({ status: 'anything-at-all' }, anyValueSettings)).toBe(true);
		});

		it('should treat whitespace-only configured value as match-any', () => {
			const settings: IsTaskFileSettings = { ...anyValueSettings, taskPropertyValue: '   ' };
			expect(isTaskFile({ status: 'open' }, settings)).toBe(true);
		});

		it('should identify a task for non-string scalar values', () => {
			expect(isTaskFile({ status: 3 }, anyValueSettings)).toBe(true);
			expect(isTaskFile({ status: true }, anyValueSettings)).toBe(true);
			expect(isTaskFile({ status: false }, anyValueSettings)).toBe(true);
		});

		it('should identify a task when the property is a non-empty array', () => {
			expect(isTaskFile({ status: ['open'] }, anyValueSettings)).toBe(true);
			expect(isTaskFile({ status: ['', 'open'] }, anyValueSettings)).toBe(true);
		});

		it('should NOT identify a task when the property is absent', () => {
			expect(isTaskFile({ type: 'note' }, anyValueSettings)).toBe(false);
			expect(isTaskFile({}, anyValueSettings)).toBe(false);
		});

		it('should NOT identify a task when the property is present but empty', () => {
			expect(isTaskFile({ status: '' }, anyValueSettings)).toBe(false);
			expect(isTaskFile({ status: '   ' }, anyValueSettings)).toBe(false);
			expect(isTaskFile({ status: null }, anyValueSettings)).toBe(false);
			expect(isTaskFile({ status: [] }, anyValueSettings)).toBe(false);
			expect(isTaskFile({ status: ['', '  '] }, anyValueSettings)).toBe(false);
		});

		it('should still exact-match when a value is configured', () => {
			const settings: IsTaskFileSettings = { ...anyValueSettings, taskPropertyValue: 'done' };
			expect(isTaskFile({ status: 'done' }, settings)).toBe(true);
			expect(isTaskFile({ status: 'open' }, settings)).toBe(false);
		});

		it('should return false when no property name is configured, even with match-any value', () => {
			const settings: IsTaskFileSettings = {
				taskIdentificationMethod: 'property',
				taskPropertyName: '',
				taskPropertyValue: '',
				taskTag: 'task',
			};
			expect(isTaskFile({ status: 'open' }, settings)).toBe(false);
		});
	});
});
