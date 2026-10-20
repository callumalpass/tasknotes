import { serialize, deserialize } from "node:v8";
import {
	buildCompletionContentUndo,
	readCompletionContent,
	restoreCompletionContent,
} from '../../../src/services/task-service/recurringCompletionUndo';

const before = `---
scheduled: 2026-10-21
due: 2026-10-23
recurrence: 'DTSTART:20261021;FREQ=YEARLY'
complete_instances: []
dateModified: old
---
- [x] Review
`;
const after = `---
scheduled: 2027-10-21
due: 2027-10-23
recurrence: 'DTSTART:20261021;FREQ=YEARLY'
complete_instances: ['2026-10-21']
dateModified: new
---
- [ ] Review`;
const properties = ['scheduled', 'due', 'recurrence', 'complete_instances'];
const receipt = () => buildCompletionContentUndo(before, after, properties, 'dateModified');

describe('recurring completion Undo receipt', () => {
	beforeAll(() => {
		globalThis.structuredClone = value => deserialize(serialize(value));
	});
	it('restores the occurrence, schedule, due offset and reset checklist', () => {
		const restored = restoreCompletionContent(after, receipt(), 'dateModified', 'undo-time');
		expect(restored).not.toBeNull();
		const actual = readCompletionContent(restored!);
		expect(actual.frontmatter).toEqual({
			...readCompletionContent(before).frontmatter, dateModified: 'undo-time',
		});
		expect(actual.body).toBe('- [x] Review\n');
	});

	it('keeps later unrelated frontmatter edits', () => {
		const edited = after.replace('dateModified: new', 'dateModified: edited\npriority: high\ntitle: Renamed');
		const restored = restoreCompletionContent(edited, receipt(), 'dateModified', 'undo-time');
		expect(readCompletionContent(restored!).frontmatter).toMatchObject({ priority: 'high', title: 'Renamed' });
	});

	it.each([
		['schedule', after.replace('2027-10-21', '2027-11-01')],
		['recurrence rule', after.replace('FREQ=YEARLY', 'FREQ=MONTHLY')],
		['completion', after.replace("['2026-10-21']", "['2026-10-21', '2027-10-21']")],
		['checklist', after + '\nNew work'],
	])('refuses to overwrite a later %s edit', (_label, content) => {
		expect(restoreCompletionContent(content, receipt(), 'dateModified', 'undo-time')).toBeNull();
	});

	it('preserves later body edits when completion did not reset checkboxes', () => {
		const unchangedBody = after.replace('- [ ] Review', '- [x] Review\n');
		const undo = buildCompletionContentUndo(before, unchangedBody, properties, 'dateModified');
		const restored = restoreCompletionContent(unchangedBody + 'New work', undo, 'dateModified', 'undo-time');
		expect(readCompletionContent(restored!).body).toContain('New work');
	});

	it('supports custom property names and restores absent properties', () => {
		const undo = buildCompletionContentUndo('---\nplan: old\n---\n',
			'---\nplan: new\ndone_days: [today]\n---\n', ['plan', 'done_days'], 'modified');
		const restored = restoreCompletionContent('---\nplan: new\ndone_days: [today]\n---\n', undo, 'modified', 'now');
		expect(readCompletionContent(restored!).frontmatter).toEqual({ plan: 'old', modified: 'now' });
	});
});
