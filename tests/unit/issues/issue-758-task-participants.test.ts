/**
 * Feature request tests for Issue #758: Add participants to tasks
 *
 * Users want to add participants (with email addresses) as a property of tasks
 * to facilitate collaborative work. This would be similar to existing multi-value
 * properties like contexts, tags, and projects.
 *
 * Expected behavior:
 * - Tasks can have a `participants` property containing email addresses
 * - Participants can be added/removed via task modal UI
 * - Tasks can be filtered by participant
 * - Participants should work with existing multi-value patterns (array storage)
 * - Optional: Email validation for participant values
 *
 * See: https://github.com/{{owner}}/{{repo}}/issues/758
 */

import { describe, it, expect } from '@jest/globals';

interface MockTaskInfo {
	path: string;
	title: string;
	participants?: string[];
	status?: string;
}

/**
 * Validates email format for participant entries
 */
function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Simulates adding a participant to a task
 */
function addParticipant(task: MockTaskInfo, email: string): MockTaskInfo {
	const participants = task.participants || [];
	if (!participants.includes(email)) {
		return {
			...task,
			participants: [...participants, email]
		};
	}
	return task;
}

/**
 * Simulates removing a participant from a task
 */
function removeParticipant(task: MockTaskInfo, email: string): MockTaskInfo {
	const participants = task.participants || [];
	return {
		...task,
		participants: participants.filter(p => p !== email)
	};
}

/**
 * Simulates filtering tasks by participant
 */
function filterTasksByParticipant(
	tasks: MockTaskInfo[],
	participantEmail: string
): MockTaskInfo[] {
	return tasks.filter(task =>
		task.participants?.includes(participantEmail)
	);
}

/**
 * Simulates grouping tasks by participant (for kanban view)
 */
function groupTasksByParticipant(
	tasks: MockTaskInfo[]
): Map<string, MockTaskInfo[]> {
	const groups = new Map<string, MockTaskInfo[]>();

	for (const task of tasks) {
		if (task.participants && task.participants.length > 0) {
			for (const participant of task.participants) {
				if (!groups.has(participant)) {
					groups.set(participant, []);
				}
				groups.get(participant)!.push(task);
			}
		} else {
			if (!groups.has('Unassigned')) {
				groups.set('Unassigned', []);
			}
			groups.get('Unassigned')!.push(task);
		}
	}

	return groups;
}

describe('Issue #758: Add participants to tasks', () => {
	describe('Participant property storage', () => {
		it.skip('reproduces issue #758 - should store participants as array in task frontmatter', () => {
			// Expected: tasks can have a participants property with email addresses
			const task: MockTaskInfo = {
				path: 'tasks/team-meeting.md',
				title: 'Team meeting',
				participants: ['alice@example.com', 'bob@example.com'],
				status: 'todo'
			};

			expect(task.participants).toBeDefined();
			expect(task.participants).toHaveLength(2);
			expect(task.participants).toContain('alice@example.com');
			expect(task.participants).toContain('bob@example.com');
		});

		it.skip('reproduces issue #758 - should allow tasks without participants', () => {
			const task: MockTaskInfo = {
				path: 'tasks/solo-task.md',
				title: 'Solo task',
				status: 'todo'
			};

			expect(task.participants).toBeUndefined();
		});

		it.skip('reproduces issue #758 - should handle empty participants array', () => {
			const task: MockTaskInfo = {
				path: 'tasks/empty-participants.md',
				title: 'Task with empty participants',
				participants: [],
				status: 'todo'
			};

			expect(task.participants).toHaveLength(0);
		});
	});

	describe('Participant validation', () => {
		it.skip('reproduces issue #758 - should validate email format', () => {
			expect(isValidEmail('alice@example.com')).toBe(true);
			expect(isValidEmail('bob@company.org')).toBe(true);
			expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
		});

		it.skip('reproduces issue #758 - should reject invalid email formats', () => {
			expect(isValidEmail('not-an-email')).toBe(false);
			expect(isValidEmail('@missing-local.com')).toBe(false);
			expect(isValidEmail('missing-domain@')).toBe(false);
			expect(isValidEmail('spaces in@email.com')).toBe(false);
		});
	});

	describe('Adding and removing participants', () => {
		it.skip('reproduces issue #758 - should add participant to task', () => {
			const task: MockTaskInfo = {
				path: 'tasks/project.md',
				title: 'Project task',
				participants: ['alice@example.com'],
				status: 'todo'
			};

			const updated = addParticipant(task, 'bob@example.com');

			expect(updated.participants).toHaveLength(2);
			expect(updated.participants).toContain('alice@example.com');
			expect(updated.participants).toContain('bob@example.com');
		});

		it.skip('reproduces issue #758 - should not add duplicate participant', () => {
			const task: MockTaskInfo = {
				path: 'tasks/project.md',
				title: 'Project task',
				participants: ['alice@example.com'],
				status: 'todo'
			};

			const updated = addParticipant(task, 'alice@example.com');

			expect(updated.participants).toHaveLength(1);
		});

		it.skip('reproduces issue #758 - should remove participant from task', () => {
			const task: MockTaskInfo = {
				path: 'tasks/project.md',
				title: 'Project task',
				participants: ['alice@example.com', 'bob@example.com'],
				status: 'todo'
			};

			const updated = removeParticipant(task, 'alice@example.com');

			expect(updated.participants).toHaveLength(1);
			expect(updated.participants).not.toContain('alice@example.com');
			expect(updated.participants).toContain('bob@example.com');
		});

		it.skip('reproduces issue #758 - should handle removing non-existent participant', () => {
			const task: MockTaskInfo = {
				path: 'tasks/project.md',
				title: 'Project task',
				participants: ['alice@example.com'],
				status: 'todo'
			};

			const updated = removeParticipant(task, 'charlie@example.com');

			expect(updated.participants).toHaveLength(1);
			expect(updated.participants).toContain('alice@example.com');
		});
	});

	describe('Filtering by participant', () => {
		const tasks: MockTaskInfo[] = [
			{
				path: 'tasks/task1.md',
				title: 'Task 1',
				participants: ['alice@example.com', 'bob@example.com'],
				status: 'todo'
			},
			{
				path: 'tasks/task2.md',
				title: 'Task 2',
				participants: ['bob@example.com'],
				status: 'todo'
			},
			{
				path: 'tasks/task3.md',
				title: 'Task 3',
				participants: ['charlie@example.com'],
				status: 'todo'
			},
			{
				path: 'tasks/task4.md',
				title: 'Task 4',
				status: 'todo'
			}
		];

		it.skip('reproduces issue #758 - should filter tasks by single participant', () => {
			const filtered = filterTasksByParticipant(tasks, 'bob@example.com');

			expect(filtered).toHaveLength(2);
			expect(filtered.map(t => t.title)).toContain('Task 1');
			expect(filtered.map(t => t.title)).toContain('Task 2');
		});

		it.skip('reproduces issue #758 - should return empty array when no tasks match participant', () => {
			const filtered = filterTasksByParticipant(tasks, 'unknown@example.com');

			expect(filtered).toHaveLength(0);
		});

		it.skip('reproduces issue #758 - should not include tasks without participants when filtering', () => {
			const filtered = filterTasksByParticipant(tasks, 'alice@example.com');

			expect(filtered).toHaveLength(1);
			expect(filtered[0].title).toBe('Task 1');
		});
	});

	describe('Grouping by participant (kanban)', () => {
		const tasks: MockTaskInfo[] = [
			{
				path: 'tasks/task1.md',
				title: 'Task 1',
				participants: ['alice@example.com', 'bob@example.com'],
				status: 'todo'
			},
			{
				path: 'tasks/task2.md',
				title: 'Task 2',
				participants: ['bob@example.com'],
				status: 'todo'
			},
			{
				path: 'tasks/task3.md',
				title: 'Task 3',
				status: 'todo'
			}
		];

		it.skip('reproduces issue #758 - should group tasks by participant for kanban view', () => {
			const groups = groupTasksByParticipant(tasks);

			expect(groups.has('alice@example.com')).toBe(true);
			expect(groups.has('bob@example.com')).toBe(true);
			expect(groups.has('Unassigned')).toBe(true);
		});

		it.skip('reproduces issue #758 - should place task with multiple participants in each column', () => {
			const groups = groupTasksByParticipant(tasks);

			expect(groups.get('alice@example.com')?.map(t => t.title)).toContain('Task 1');
			expect(groups.get('bob@example.com')?.map(t => t.title)).toContain('Task 1');
		});

		it.skip('reproduces issue #758 - should place tasks without participants in Unassigned column', () => {
			const groups = groupTasksByParticipant(tasks);

			expect(groups.get('Unassigned')?.map(t => t.title)).toContain('Task 3');
		});
	});

	describe('Integration with field mapping', () => {
		it.skip('reproduces issue #758 - should support custom YAML property name via field mapping', () => {
			// Expected: users can configure the YAML property name for participants
			// e.g., "attendees", "collaborators", "assignees" instead of default "participants"
			const fieldMapping = {
				participants: 'collaborators' // custom YAML key
			};

			// When reading frontmatter with "collaborators" key, it should map to participants
			const yamlFrontmatter = {
				collaborators: ['alice@example.com', 'bob@example.com']
			};

			// The task should expose these as task.participants
			expect(yamlFrontmatter[fieldMapping.participants as keyof typeof yamlFrontmatter])
				.toEqual(['alice@example.com', 'bob@example.com']);
		});
	});

	describe('Integration with calendar sync', () => {
		it.skip('reproduces issue #758 - should map participants to ICS ATTENDEE properties', () => {
			// When exporting to ICS format, participants should become ATTENDEE entries
			const task: MockTaskInfo = {
				path: 'tasks/meeting.md',
				title: 'Team meeting',
				participants: ['alice@example.com', 'bob@example.com'],
				status: 'todo'
			};

			// Expected ICS output format:
			// ATTENDEE:mailto:alice@example.com
			// ATTENDEE:mailto:bob@example.com
			const expectedAttendees = task.participants?.map(p => `mailto:${p}`);

			expect(expectedAttendees).toContain('mailto:alice@example.com');
			expect(expectedAttendees).toContain('mailto:bob@example.com');
		});
	});

	describe('Natural language parsing', () => {
		it.skip('reproduces issue #758 - should parse participants from NLP trigger', () => {
			// Expected: users can add participants via natural language input
			// e.g., "Team meeting @participant:alice@example.com @participant:bob@example.com"
			const input = 'Team meeting @participant:alice@example.com @participant:bob@example.com';
			const participantPattern = /@participant:([^\s]+)/g;
			const matches = [...input.matchAll(participantPattern)];

			expect(matches).toHaveLength(2);
			expect(matches[0][1]).toBe('alice@example.com');
			expect(matches[1][1]).toBe('bob@example.com');
		});
	});
});
