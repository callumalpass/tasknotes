/**
 * Decides which CalDAV collection a task belongs to.
 *
 * Membership reuses the plugin's existing filter engine rather than inventing a
 * second query language: each configured collection carries a `FilterGroup`,
 * evaluated with `evaluateFilterNode` from the filter-service pure layer. That
 * means a collection can be scoped by tag, folder, project, status or any other
 * property the FilterBar already exposes.
 *
 * Pure: no Obsidian runtime, no network, no DOM or timer globals.
 */

import type { FilterGroup, TaskInfo } from "../../types";
import {
	evaluateFilterNode,
	type FilterPredicateEvaluationContext,
} from "../filter-service/filterPredicateEvaluation";

export interface CalDavCollectionScope {
	/** Stable id of the configured account/collection. */
	accountId: string;
	/**
	 * Filter deciding membership. An undefined filter, or a group with no
	 * children, means "every task" — the single-collection case.
	 */
	filter?: FilterGroup;
}

export function taskBelongsToCollection(
	task: TaskInfo,
	scope: CalDavCollectionScope,
	context: FilterPredicateEvaluationContext
): boolean {
	// Archived tasks are never pushed; archiving is how a remote deletion is
	// reflected locally, so re-uploading them would resurrect deleted VTODOs.
	if (task.archived) return false;

	if (!scope.filter || scope.filter.children.length === 0) return true;

	try {
		return evaluateFilterNode(scope.filter, task, context);
	} catch {
		// A malformed saved filter must not take the whole sync down; excluding
		// the task is the conservative reading, since it avoids uploading things
		// the user meant to scope out.
		return false;
	}
}

/**
 * Resolves the single collection that owns a task.
 *
 * Scopes are evaluated in configured order and the first match wins, so a task
 * matching two collections is uploaded once rather than duplicated across both.
 */
export function resolveCollectionForTask(
	task: TaskInfo,
	scopes: readonly CalDavCollectionScope[],
	context: FilterPredicateEvaluationContext
): CalDavCollectionScope | undefined {
	return scopes.find((scope) => taskBelongsToCollection(task, scope, context));
}
