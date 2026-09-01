import {
	hasUnsyncedLocalChange,
	planFirstSync,
	planIncrementalSync,
	planRemoteDeletion,
	resolveConflict,
	summarizeFirstSyncPlan,
	type LocalTaskSnapshot,
	type RemoteTodoSnapshot,
} from "../../../src/services/caldav/caldavReconciliation";

function local(overrides: Partial<LocalTaskSnapshot> = {}): LocalTaskSnapshot {
	return {
		path: "Tasks/a.md",
		changedAtMs: 1000,
		fingerprint: "fp",
		syncedFingerprint: "fp",
		...overrides,
	};
}

function remote(overrides: Partial<RemoteTodoSnapshot> = {}): RemoteTodoSnapshot {
	return {
		uid: "uid-1",
		url: "https://s/cal/1.ics",
		etag: "e1",
		revisionMs: 1000,
		...overrides,
	};
}

describe("resolveConflict", () => {
	it("gives the win to the newer side", () => {
		expect(resolveConflict(2000, 1000)).toBe("local");
		expect(resolveConflict(1000, 2000)).toBe("remote");
	});

	it("breaks an exact tie deterministically in favour of the remote", () => {
		// Every device sees the same server revision, so this converges; local
		// clocks do not agree with each other.
		expect(resolveConflict(1000, 1000)).toBe("remote");
	});

	it("prefers the side whose edit time is actually known", () => {
		expect(resolveConflict(null, 1000)).toBe("remote");
		expect(resolveConflict(1000, null)).toBe("local");
	});

	it("falls back to the remote when neither side has a timestamp", () => {
		expect(resolveConflict(null, null)).toBe("remote");
	});
});

describe("hasUnsyncedLocalChange", () => {
	it("is false when the fingerprint matches the last sync", () => {
		expect(hasUnsyncedLocalChange(local())).toBe(false);
	});

	it("is true after a content edit", () => {
		expect(hasUnsyncedLocalChange(local({ fingerprint: "changed" }))).toBe(true);
	});

	it("is true for a task that has never been synced", () => {
		expect(hasUnsyncedLocalChange(local({ syncedFingerprint: undefined }))).toBe(true);
	});
});

describe("planFirstSync", () => {
	it("uploads a local task the server has never seen", () => {
		const plan = planFirstSync([local({ uid: undefined })], []);
		expect(plan.toUpload).toHaveLength(1);
		expect(plan.toImport).toHaveLength(0);
	});

	it("imports a VTODO with no local counterpart", () => {
		const plan = planFirstSync([], [remote()]);
		expect(plan.toImport).toEqual([remote()]);
	});

	it("links a matched pair that is already in agreement", () => {
		const plan = planFirstSync([local({ uid: "uid-1", etag: "e1" })], [remote()]);
		expect(plan.toLink).toHaveLength(1);
		expect(plan.toResolve).toHaveLength(0);
		expect(plan.toUpload).toHaveLength(0);
	});

	it("resolves a matched pair whose ETags differ", () => {
		const plan = planFirstSync(
			[local({ uid: "uid-1", etag: "old", changedAtMs: 5000 })],
			[remote({ etag: "new", revisionMs: 1000 })]
		);
		expect(plan.toResolve).toHaveLength(1);
		expect(plan.toResolve[0].winner).toBe("local");
	});

	it("resolves a matched pair with unsynced local edits", () => {
		const plan = planFirstSync(
			[local({ uid: "uid-1", etag: "e1", fingerprint: "edited", changedAtMs: 500 })],
			[remote({ revisionMs: 9000 })]
		);
		expect(plan.toResolve[0].winner).toBe("remote");
	});

	it("reconnecting after a disconnect is a no-op", () => {
		// The whole point of storing the UID: nothing is duplicated or moved.
		const locals = [
			local({ path: "Tasks/a.md", uid: "uid-1", etag: "e1" }),
			local({ path: "Tasks/b.md", uid: "uid-2", etag: "e2" }),
		];
		const remotes = [
			remote({ uid: "uid-1", etag: "e1" }),
			remote({ uid: "uid-2", etag: "e2", url: "https://s/cal/2.ics" }),
		];

		const plan = planFirstSync(locals, remotes);
		expect(plan.toLink).toHaveLength(2);
		expect(plan.toUpload).toHaveLength(0);
		expect(plan.toImport).toHaveLength(0);
		expect(plan.toResolve).toHaveLength(0);
	});

	it("never matches on title or dates, only UID", () => {
		// Two tasks that look identical but carry no shared UID stay separate.
		const plan = planFirstSync([local({ uid: undefined })], [remote({ uid: "other" })]);
		expect(plan.toUpload).toHaveLength(1);
		expect(plan.toImport).toHaveLength(1);
		expect(plan.toLink).toHaveLength(0);
	});

	it("uploads a task whose UID is not on the server", () => {
		const plan = planFirstSync([local({ uid: "orphan" })], [remote({ uid: "uid-1" })]);
		expect(plan.toUpload).toHaveLength(1);
		expect(plan.toImport).toHaveLength(1);
	});

	it("summarises for the preview", () => {
		const plan = planFirstSync(
			[local({ uid: undefined }), local({ path: "b", uid: "uid-1", etag: "e1" })],
			[remote(), remote({ uid: "uid-9", url: "https://s/cal/9.ics" })]
		);
		expect(summarizeFirstSyncPlan(plan)).toEqual({
			upload: 1,
			import: 1,
			link: 1,
			resolve: 0,
			total: 3,
		});
	});
});

describe("planIncrementalSync", () => {
	it("pushes a local edit the server did not report", () => {
		const plan = planIncrementalSync(
			[local({ uid: "uid-1", etag: "e1", fingerprint: "edited" })],
			[]
		);
		expect(plan.toPush).toHaveLength(1);
		expect(plan.conflicts).toHaveLength(0);
	});

	it("does nothing for a task with no changes on either side", () => {
		const plan = planIncrementalSync([local({ uid: "uid-1", etag: "e1" })], []);
		expect(plan.toPush).toHaveLength(0);
		expect(plan.toPull).toHaveLength(0);
	});

	it("pulls a remote change when the local side is clean", () => {
		const plan = planIncrementalSync(
			[local({ uid: "uid-1", etag: "old" })],
			[remote({ etag: "new" })]
		);
		expect(plan.toPull).toHaveLength(1);
		expect(plan.conflicts).toHaveLength(0);
	});

	it("ignores our own write echoing back", () => {
		// The server reports the resource as changed, but the ETag is the one we
		// already stored, so there is nothing new to pull.
		const plan = planIncrementalSync(
			[local({ uid: "uid-1", etag: "e1" })],
			[remote({ etag: "e1" })]
		);
		expect(plan.toPull).toHaveLength(0);
		expect(plan.toPush).toHaveLength(0);
	});

	it("reports a conflict when both sides changed", () => {
		const plan = planIncrementalSync(
			[local({ uid: "uid-1", etag: "old", fingerprint: "edited", changedAtMs: 9000 })],
			[remote({ etag: "new", revisionMs: 1000 })]
		);
		expect(plan.conflicts).toHaveLength(1);
		expect(plan.conflicts[0].winner).toBe("local");
		expect(plan.toPush).toHaveLength(0);
		expect(plan.toPull).toHaveLength(0);
	});

	it("imports a remote resource with no local task", () => {
		const plan = planIncrementalSync([], [remote({ uid: "brand-new" })]);
		expect(plan.toPull).toHaveLength(1);
	});

	it("detects an explicitly reported remote deletion", () => {
		const plan = planIncrementalSync(
			[local({ uid: "uid-1", href: "https://s/cal/1.ics", etag: "e1" })],
			[],
			{ removedUrls: ["https://s/cal/1.ics"] }
		);
		expect(plan.remoteDeleted).toHaveLength(1);
		expect(plan.toPush).toHaveLength(0);
	});

	it("infers a deletion from a complete listing", () => {
		// The sync-collection fallback path: absent from a full listing means gone.
		const plan = planIncrementalSync(
			[local({ uid: "uid-1", href: "https://s/cal/1.ics", etag: "e1" })],
			[remote({ uid: "uid-2", url: "https://s/cal/2.ics" })],
			{ remotesAreComplete: true }
		);
		expect(plan.remoteDeleted).toHaveLength(1);
	});

	it("does NOT infer deletions from an incomplete delta", () => {
		// Without remotesAreComplete, an unreported task is simply unchanged —
		// treating it as deleted would wipe the vault on every poll.
		const plan = planIncrementalSync(
			[local({ uid: "uid-1", href: "https://s/cal/1.ics", etag: "e1" })],
			[]
		);
		expect(plan.remoteDeleted).toHaveLength(0);
	});

	it("ignores a trailing slash when comparing hrefs", () => {
		const plan = planIncrementalSync(
			[local({ uid: "uid-1", href: "https://s/cal/1.ics/", etag: "e1" })],
			[remote({ uid: "uid-1", url: "https://s/cal/1.ics", etag: "e1" })],
			{ remotesAreComplete: true }
		);
		expect(plan.remoteDeleted).toHaveLength(0);
	});

	it("pushes a never-synced task", () => {
		const plan = planIncrementalSync(
			[local({ uid: undefined, syncedFingerprint: undefined })],
			[]
		);
		expect(plan.toPush).toHaveLength(1);
	});
});

describe("planRemoteDeletion", () => {
	it("archives and unlinks by default", () => {
		expect(planRemoteDeletion("archive")).toEqual({
			action: "archive",
			stripSyncMetadata: true,
		});
	});

	it("deletes when explicitly configured", () => {
		expect(planRemoteDeletion("delete")).toEqual({
			action: "delete",
			stripSyncMetadata: false,
		});
	});

	it("strips metadata when unlinking so the task is not re-uploaded", () => {
		expect(planRemoteDeletion("unlink")).toEqual({
			action: "unlink",
			stripSyncMetadata: true,
		});
	});
});
