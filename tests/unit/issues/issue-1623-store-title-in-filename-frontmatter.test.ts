/**
 * Issue #1623: "Store title in filename" still saves title in frontmatter
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1623
 *
 * Docs currently state that when `storeTitleInFilename` is enabled,
 * the `title` property is removed from frontmatter.
 *
 * Current behavior in code keeps title in frontmatter (changed in PR #1608).
 * This test documents the reported expectation from issue #1623.
 */

import { FieldMapper } from '../../../src/services/FieldMapper';
import { DEFAULT_FIELD_MAPPING } from '../../../src/settings/defaults';
import type { TaskInfo } from '../../../src/types';

describe('Issue #1623: Store title in filename still writes title frontmatter', () => {
	it.skip('reproduces issue #1623: should omit title from frontmatter when storeTitleInFilename=true', () => {
		const fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);

		const taskData: Partial<TaskInfo> = {
			title: 'Plan quarterly review',
			status: 'open',
			priority: 'normal',
			path: 'tasks/Plan quarterly review.md',
			archived: false,
		};

		const frontmatter = fieldMapper.mapToFrontmatter(
			taskData,
			undefined,
			true // storeTitleInFilename
		);

		// Expected per docs (current code behavior differs): no title in frontmatter.
		expect(frontmatter).not.toHaveProperty(DEFAULT_FIELD_MAPPING.title);
	});
});
