/**
 * Shared assignee filtering utilities.
 *
 * Used by both NotificationService (upstream reminders) and
 * VaultWideNotificationService (bases notifications) to determine
 * whether a task's assignee matches the current device's user.
 */

import type { GroupRegistry } from "../identity/GroupRegistry";

/**
 * Normalize a path/wikilink for comparison.
 * Strips [[]], display text after |, .md extension, folder path — returns lowercase filename.
 */
export function normalizeAssigneePath(path: string): string {
	// Remove wikilink syntax
	let normalized = path.replace(/^\[\[/, "").replace(/\]\]$/, "");

	// Handle display text: [[path|display]] -> path
	const pipeIndex = normalized.indexOf("|");
	if (pipeIndex !== -1) {
		normalized = normalized.substring(0, pipeIndex);
	}

	// Remove .md extension
	normalized = normalized.replace(/\.md$/, "");

	// Get just the filename (last segment)
	const segments = normalized.split("/");
	return segments[segments.length - 1].toLowerCase();
}

/**
 * Check if an assignee value matches the current user.
 * Handles direct assignment and group membership via GroupRegistry.
 */
export function isAssignedToUser(
	assigneeValue: string | string[],
	currentUser: string,
	groupRegistry: GroupRegistry | null
): boolean {
	const assignees = Array.isArray(assigneeValue) ? assigneeValue : [assigneeValue];

	for (const assignee of assignees) {
		if (typeof assignee !== "string") continue;

		// Resolve the assignee (handles groups)
		const resolvedPersons = groupRegistry?.resolveAssignee(assignee) || [assignee];

		// Check if current user is in the resolved list
		for (const person of resolvedPersons) {
			const normalizedPerson = normalizeAssigneePath(person);
			const normalizedCurrentUser = normalizeAssigneePath(currentUser);

			if (normalizedPerson === normalizedCurrentUser) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Determine whether a notification should fire for a task given its assignee value.
 *
 * @param assigneeValue - The task's assignee field (string, string[], or undefined/null)
 * @param currentUser - The current device's person note path (null if not registered)
 * @param notifyForUnassigned - Whether to notify for tasks with no assignee
 * @param groupRegistry - GroupRegistry for resolving group membership
 * @returns true if the notification should fire
 */
export function shouldNotifyForTask(
	assigneeValue: string | string[] | undefined | null,
	currentUser: string | null,
	notifyForUnassigned: boolean,
	groupRegistry: GroupRegistry | null
): boolean {
	// If no user is registered for this device, can't filter — allow all
	if (!currentUser) {
		return true;
	}

	// No assignee on the task
	if (!assigneeValue || (Array.isArray(assigneeValue) && assigneeValue.length === 0)) {
		return notifyForUnassigned;
	}

	// Check if current user is assigned (directly or via group)
	return isAssignedToUser(assigneeValue, currentUser, groupRegistry);
}
