import type { FilterGroup, TaskInfo } from "../../../src/types";
import {
	CALDAV_FRONTMATTER_KEYS,
	CALDAV_FRONTMATTER_KEY_LIST,
	getCalDavRelevantFingerprint,
	hasCalDavRelevantChange,
	parseCalDavFingerprint,
} from "../../../src/services/caldav/caldavFingerprint";
import {
	resolveCollectionForTask,
	taskBelongsToCollection,
	type CalDavCollectionScope,
} from "../../../src/services/caldav/collectionMembership";
import type { FilterPredicateEvaluationContext } from "../../../src/services/filter-service/filterPredicateEvaluation";

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Buy groceries",
		status: "open",
		priority: "normal",
		path: "Tasks/buy-groceries.md",
		archived: false,
		...overrides,
	};
}

const filterContext: FilterPredicateEvaluationContext = {
	getUserFieldRawValue: () => undefined,
	getCompletedStatuses: () => ["done"],
	isCompletedStatus: (status: string) => status === "done",
};

function tagFilter(tag: string): FilterGroup {
	return {
		type: "group",
		id: "root",
		conjunction: "and",
		children: [
			{
				type: "condition",
				id: "c1",
				property: "tags",
				operator: "contains",
				value: tag,
			},
		],
	};
}

describe("getCalDavRelevantFingerprint", () => {
	it("is stable for an unchanged task", () => {
		const task = makeTask();
		expect(getCalDavRelevantFingerprint(task)).toBe(getCalDavRelevantFingerprint(task));
	});

	it("changes when user-visible content changes", () => {
		const before = getCalDavRelevantFingerprint(makeTask());
		expect(getCalDavRelevantFingerprint(makeTask({ title: "Something else" }))).not.toBe(
			before
		);
		expect(getCalDavRelevantFingerprint(makeTask({ status: "done" }))).not.toBe(before);
		expect(getCalDavRelevantFingerprint(makeTask({ due: "2025-09-03" }))).not.toBe(before);
	});

	it("does NOT change when only sync metadata is written", () => {
		// This is the property that breaks the write-back loop: stamping an ETag
		// into frontmatter must not look like a content edit.
		const before = getCalDavRelevantFingerprint(makeTask());
		const withMetadata = makeTask() as TaskInfo & Record<string, unknown>;
		for (const key of CALDAV_FRONTMATTER_KEY_LIST) {
			withMetadata[key] = "written-by-sync";
		}
		expect(getCalDavRelevantFingerprint(withMetadata)).toBe(before);
	});

	it("does not change when only dateModified or time tracking changes", () => {
		const before = getCalDavRelevantFingerprint(makeTask());
		expect(
			getCalDavRelevantFingerprint(
				makeTask({ dateModified: "2025-09-01T12:00:00Z", totalTrackedTime: 42 })
			)
		).toBe(before);
	});

	it("ignores tag reordering", () => {
		expect(getCalDavRelevantFingerprint(makeTask({ tags: ["a", "b"] }))).toBe(
			getCalDavRelevantFingerprint(makeTask({ tags: ["b", "a"] }))
		);
	});

	it("exposes the frontmatter keys the integration owns", () => {
		expect(CALDAV_FRONTMATTER_KEYS.uid).toBe("caldav_uid");
		expect(CALDAV_FRONTMATTER_KEY_LIST).toHaveLength(5);
		expect(CALDAV_FRONTMATTER_KEY_LIST.every((key) => key.startsWith("caldav_"))).toBe(true);
	});
});

describe("parseCalDavFingerprint", () => {
	it("round-trips a fingerprint back into a previous state", () => {
		const fingerprint = getCalDavRelevantFingerprint(
			makeTask({ title: "Old", status: "open" })
		);
		expect(parseCalDavFingerprint(fingerprint)).toMatchObject({
			title: "Old",
			status: "open",
		});
	});

	it("treats missing or corrupt fingerprints as no previous state", () => {
		expect(parseCalDavFingerprint(undefined)).toBeNull();
		expect(parseCalDavFingerprint("{not json")).toBeNull();
		expect(parseCalDavFingerprint("[1,2,3]")).toBeNull();
	});
});

describe("hasCalDavRelevantChange", () => {
	it("reports a change against no stored fingerprint", () => {
		expect(hasCalDavRelevantChange(makeTask(), undefined)).toBe(true);
	});

	it("reports no change for a metadata-only write", () => {
		const task = makeTask();
		expect(hasCalDavRelevantChange(task, getCalDavRelevantFingerprint(task))).toBe(false);
	});

	it("reports a change for a real edit", () => {
		const fingerprint = getCalDavRelevantFingerprint(makeTask());
		expect(hasCalDavRelevantChange(makeTask({ status: "done" }), fingerprint)).toBe(true);
	});
});

describe("taskBelongsToCollection", () => {
	it("matches every task when the scope has no filter", () => {
		const scope: CalDavCollectionScope = { accountId: "a" };
		expect(taskBelongsToCollection(makeTask(), scope, filterContext)).toBe(true);
	});

	it("matches every task when the filter group is empty", () => {
		const scope: CalDavCollectionScope = {
			accountId: "a",
			filter: { type: "group", id: "root", conjunction: "and", children: [] },
		};
		expect(taskBelongsToCollection(makeTask(), scope, filterContext)).toBe(true);
	});

	it("applies the configured filter", () => {
		const scope: CalDavCollectionScope = { accountId: "work", filter: tagFilter("work") };
		expect(
			taskBelongsToCollection(makeTask({ tags: ["work"] }), scope, filterContext)
		).toBe(true);
		expect(
			taskBelongsToCollection(makeTask({ tags: ["personal"] }), scope, filterContext)
		).toBe(false);
	});

	it("never includes an archived task", () => {
		// Archiving is how a remote deletion is reflected locally; re-uploading
		// archived tasks would resurrect VTODOs the user deleted on the server.
		const scope: CalDavCollectionScope = { accountId: "a" };
		expect(
			taskBelongsToCollection(makeTask({ archived: true }), scope, filterContext)
		).toBe(false);
	});

	it("excludes the task rather than throwing when a filter is malformed", () => {
		const scope: CalDavCollectionScope = {
			accountId: "a",
			filter: { type: "group", id: "root", conjunction: "and", children: [null as never] },
		};
		expect(() => taskBelongsToCollection(makeTask(), scope, filterContext)).not.toThrow();
	});
});

describe("resolveCollectionForTask", () => {
	const scopes: CalDavCollectionScope[] = [
		{ accountId: "work", filter: tagFilter("work") },
		{ accountId: "personal", filter: tagFilter("personal") },
		{ accountId: "catch-all" },
	];

	it("returns the first matching collection", () => {
		expect(
			resolveCollectionForTask(makeTask({ tags: ["personal"] }), scopes, filterContext)
				?.accountId
		).toBe("personal");
	});

	it("assigns a task to exactly one collection when several match", () => {
		// Order decides, so a task is uploaded once rather than duplicated.
		expect(
			resolveCollectionForTask(
				makeTask({ tags: ["work", "personal"] }),
				scopes,
				filterContext
			)?.accountId
		).toBe("work");
	});

	it("falls through to an unfiltered collection", () => {
		expect(
			resolveCollectionForTask(makeTask({ tags: ["other"] }), scopes, filterContext)
				?.accountId
		).toBe("catch-all");
	});

	it("returns undefined when nothing matches", () => {
		expect(
			resolveCollectionForTask(makeTask({ tags: ["other"] }), scopes.slice(0, 2), filterContext)
		).toBeUndefined();
	});
});
