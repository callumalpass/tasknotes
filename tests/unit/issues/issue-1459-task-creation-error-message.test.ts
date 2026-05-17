/**
 * Issue #1459: task creation failures should not be double-prefixed.
 *
 * The underlying folder-exists race is covered by #1016/#1555. This keeps the
 * remaining user-facing notice readable when the task service already includes
 * the task-creation failure prefix.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1459
 */

import { getTaskCreationFailureNoticeMessage } from "../../../src/modals/TaskCreationModal";

describe("Issue #1459: task creation failure message", () => {
	it("strips an existing task creation prefix before passing the message to the notice", () => {
		expect(
			getTaskCreationFailureNoticeMessage(
				new Error("Failed to create task: Failed to create folder \"TaskNotes/Tasks\"")
			)
		).toBe('Failed to create folder "TaskNotes/Tasks"');
	});

	it("keeps unprefixed errors unchanged", () => {
		expect(getTaskCreationFailureNoticeMessage(new Error("Network error"))).toBe(
			"Network error"
		);
	});
});
