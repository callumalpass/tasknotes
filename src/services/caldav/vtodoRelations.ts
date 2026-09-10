/**
 * Task relationships as iCalendar `RELATED-TO` (RFC 5545 §3.8.4.5, RFC 9253).
 *
 * TaskNotes has no parent field: a subtask is a task whose `projects` array
 * links to its parent, so `projects` *is* the parent relation and, being
 * many-valued, maps directly onto repeated `RELATED-TO;RELTYPE=PARENT` lines.
 * Dependencies map just as directly — `TaskDependency` is already shaped like
 * RFC 9253's temporal relation, carrying a reltype and an optional `GAP`.
 *
 * Relation targets are VTODO UIDs, not vault paths. Resolving between the two
 * needs Obsidian's metadata cache, so it stays in CalDavSyncService; this
 * module only ever speaks UIDs.
 *
 * Pure: no Obsidian runtime, no network, no DOM or timer globals.
 */

import type { TaskDependency, TaskDependencyRelType } from "../../types";
import {
	getProperties,
	replaceProperties,
	unescapeText,
	type IcsProperty,
	type VTodoDocument,
} from "./vtodoDocument";

const RELATED_TO = "RELATED-TO";
const PARENT = "PARENT";

/** RFC 9253 temporal reltypes, which are exactly TaskNotes' dependency kinds. */
const DEPENDENCY_RELTYPES: readonly TaskDependencyRelType[] = [
	"FINISHTOSTART",
	"FINISHTOFINISH",
	"STARTTOSTART",
	"STARTTOFINISH",
];

export interface VTodoRelations {
	/** UIDs of the parent tasks this task belongs to. */
	parents: string[];
	/** Dependencies, with UIDs in place of vault links. */
	dependencies: TaskDependency[];
}

/**
 * The reltype of a RELATED-TO line. Absent means PARENT: RFC 5545 defines it as
 * the default, and Nextcloud Tasks and Apple Reminders both rely on that when
 * writing subtasks.
 */
function reltypeOf(property: IcsProperty): string {
	return (property.params.RELTYPE ?? PARENT).toUpperCase();
}

function isDependencyRelType(value: string): value is TaskDependencyRelType {
	return (DEPENDENCY_RELTYPES as readonly string[]).includes(value);
}

/** True for the relations TaskNotes maps, and only those. */
export function ownsRelation(property: IcsProperty): boolean {
	const reltype = reltypeOf(property);
	return reltype === PARENT || isDependencyRelType(reltype);
}

/** Reads the relations TaskNotes models, ignoring any others (e.g. SIBLING). */
export function readRelations(doc: VTodoDocument): VTodoRelations {
	const parents: string[] = [];
	const dependencies: TaskDependency[] = [];

	for (const property of getProperties(doc, RELATED_TO)) {
		const uid = unescapeText(property.value).trim();
		if (!uid) continue;

		const reltype = reltypeOf(property);
		if (reltype === PARENT) {
			if (!parents.includes(uid)) parents.push(uid);
			continue;
		}
		if (!isDependencyRelType(reltype)) continue;

		const gap = property.params.GAP?.trim();
		dependencies.push(gap ? { uid, reltype, gap } : { uid, reltype });
	}

	return { parents, dependencies };
}

/**
 * Writes the relations TaskNotes owns, preserving every other RELATED-TO line.
 *
 * Callers pass only relations whose target has a known UID; a parent that is
 * not itself synced simply has no address on the server, and dropping the line
 * is the honest representation of that.
 */
export function applyRelations(doc: VTodoDocument, relations: VTodoRelations): void {
	const replacements: Omit<IcsProperty, "name">[] = [];

	for (const uid of dedupe(relations.parents)) {
		replacements.push({ params: { RELTYPE: PARENT }, value: uid });
	}

	const seenDependencies = new Set<string>();
	for (const dependency of relations.dependencies) {
		const uid = dependency.uid.trim();
		if (!uid) continue;
		const key = `${dependency.reltype} ${uid}`;
		if (seenDependencies.has(key)) continue;
		seenDependencies.add(key);

		const params: Record<string, string> = { RELTYPE: dependency.reltype };
		if (dependency.gap) params.GAP = dependency.gap;
		replacements.push({ params, value: uid });
	}

	replaceProperties(doc, RELATED_TO, ownsRelation, replacements);
}

function dedupe(values: readonly string[]): string[] {
	const seen: string[] = [];
	for (const value of values) {
		const trimmed = value.trim();
		if (trimmed && !seen.includes(trimmed)) seen.push(trimmed);
	}
	return seen;
}
