import { TFile } from "obsidian";

import { CalDavSyncService } from "../../src/services/CalDavSyncService";
import { CALDAV_FRONTMATTER_KEYS } from "../../src/services/caldav/caldavFingerprint";
import { DEFAULT_PRIORITIES, DEFAULT_STATUSES } from "../../src/settings/defaults";
import { parseVTodoDocument, getTextProperty } from "../../src/services/caldav/vtodoDocument";
import type { TaskInfo } from "../../src/types";

/**
 * Builds a plugin stand-in with an in-memory vault of one task file, plus a
 * fake CalDAV client so no network is involved.
 */
function makeHarness(
	options: {
		frontmatter?: Record<string, unknown>;
		task?: Partial<TaskInfo>;
		remoteDeletionPolicy?: "archive" | "delete" | "unlink";
	} = {}
) {
	const path = "Tasks/buy-groceries.md";
	const frontmatter: Record<string, unknown> = { ...(options.frontmatter ?? {}) };

	const task: TaskInfo = {
		title: "Buy groceries",
		status: "open",
		priority: "normal",
		path,
		archived: false,
		dateModified: "2025-09-01T12:00:00.000Z",
		...options.task,
	};

	const file = Object.assign(Object.create(TFile.prototype) as TFile, {
		path,
		basename: "buy-groceries",
		extension: "md",
		stat: { mtime: Date.parse("2025-09-01T12:00:00.000Z"), ctime: 0, size: 0 },
	});

	const pluginData: Record<string, unknown> = {};

	const client = {
		getResource: jest.fn().mockResolvedValue(null),
		putResource: jest.fn().mockResolvedValue({ etag: "etag-1", conflict: false }),
		deleteResource: jest.fn().mockResolvedValue({ deleted: true, conflict: false }),
		fetchAllVTodos: jest.fn().mockResolvedValue([]),
		fetchResources: jest.fn().mockResolvedValue([]),
		syncCollection: jest
			.fn()
			.mockResolvedValue({ changed: [], removed: [], usedFallback: false }),
		getCollectionTag: jest.fn().mockResolvedValue({ ctag: "ctag-1", syncToken: "token-1" }),
	};

	const taskService = {
		updateTask: jest.fn().mockResolvedValue(task),
		createTask: jest.fn().mockResolvedValue({ file, taskInfo: task }),
		toggleArchive: jest.fn().mockResolvedValue({ ...task, archived: true }),
		deleteTask: jest.fn().mockResolvedValue(undefined),
	};

	const plugin = {
		settings: {
			caldav: {
				enabled: true,
				pushOnChange: true,
				pushDebounceMs: 100,
				accounts: [
					{
						id: "work",
						name: "Work",
						enabled: true,
						serverUrl: "https://cloud.example.com",
						collectionUrl: "https://cloud.example.com/cal/tasks/",
						username: "fabian",
						syncIntervalMinutes: 15,
						taskFolder: "",
						statusOverrides: {},
						remoteDeletionPolicy: options.remoteDeletionPolicy ?? "archive",
						initialSyncCompleted: true,
					},
				],
			},
			customStatuses: DEFAULT_STATUSES,
			customPriorities: DEFAULT_PRIORITIES,
			userFields: [],
		},
		app: {
			secretStorage: {
				getSecret: jest.fn(() =>
					JSON.stringify({
						version: 1,
						state: "configured",
						credentials: { username: "fabian", password: "pw" },
					})
				),
				setSecret: jest.fn(),
			},
			vault: {
				getAbstractFileByPath: jest.fn((candidate: string) =>
					candidate === path ? file : null
				),
			},
			metadataCache: {
				getFileCache: jest.fn(() => ({ frontmatter })),
			},
			fileManager: {
				processFrontMatter: jest.fn(
					async (_file: TFile, update: (fm: Record<string, unknown>) => void) => {
						update(frontmatter);
					}
				),
			},
		},
		cacheManager: {
			getTaskInfo: jest.fn(async (candidate: string) =>
				candidate === path ? task : null
			),
			getAllTasks: jest.fn(async () => [task]),
		},
		taskService,
		statusManager: {
			getCompletedStatuses: () => ["done"],
			isCompletedStatus: (status: string) => status === "done",
		},
		emitter: { trigger: jest.fn() },
		// The real implementations re-parse data.json on every read, so hand out
		// a copy: returning the live object would let saveData's clear-and-assign
		// wipe the very document it was given.
		loadData: jest.fn(async () => ({ ...pluginData })),
		loadPluginDataForSafeWrite: jest.fn(async () => ({ ...pluginData })),
		saveData: jest.fn(async (data: Record<string, unknown>) => {
			for (const key of Object.keys(pluginData)) delete pluginData[key];
			Object.assign(pluginData, data);
		}),
	};

	const service = new CalDavSyncService(plugin as never);
	// Isolate from the network the same way the Google sync tests do.
	(service as unknown as { createClient: () => unknown }).createClient = () => client;

	return { service, plugin, client, taskService, frontmatter, task, path, pluginData };
}

describe("CalDavSyncService push", () => {
	it("uploads a new task and stamps the sync metadata", async () => {
		const { service, client, frontmatter, path } = makeHarness();

		await service.pushTask("work", path);

		expect(client.putResource).toHaveBeenCalledTimes(1);
		const [url, body, options] = client.putResource.mock.calls[0];
		expect(url).toMatch(/^https:\/\/cloud\.example\.com\/cal\/tasks\/.+\.ics$/u);
		// A first push must not clobber an existing resource at that href.
		expect(options).toEqual({ ifNoneMatch: "*" });

		const doc = parseVTodoDocument(body as string)!;
		expect(getTextProperty(doc, "SUMMARY")).toBe("Buy groceries");

		expect(frontmatter[CALDAV_FRONTMATTER_KEYS.etag]).toBe("etag-1");
		expect(frontmatter[CALDAV_FRONTMATTER_KEYS.account]).toBe("work");
		expect(frontmatter[CALDAV_FRONTMATTER_KEYS.uid]).toBeDefined();
	});

	it("does not put the vault path in the UID", async () => {
		// The collection may be shared, so the UID must not leak local structure.
		const { service, frontmatter, path } = makeHarness();
		await service.pushTask("work", path);
		expect(String(frontmatter[CALDAV_FRONTMATTER_KEYS.uid])).not.toContain("Tasks");
	});

	it("sends If-Match once the task has a stored ETag", async () => {
		const { service, client, path } = makeHarness({
			frontmatter: {
				[CALDAV_FRONTMATTER_KEYS.uid]: "uid-1",
				[CALDAV_FRONTMATTER_KEYS.href]: "https://cloud.example.com/cal/tasks/uid-1.ics",
				[CALDAV_FRONTMATTER_KEYS.etag]: "etag-0",
				[CALDAV_FRONTMATTER_KEYS.account]: "work",
			},
		});
		client.getResource.mockResolvedValue({
			url: "https://cloud.example.com/cal/tasks/uid-1.ics",
			etag: "etag-0",
			data: [
				"BEGIN:VCALENDAR",
				"BEGIN:VTODO",
				"UID:uid-1",
				"SUMMARY:Old",
				"X-PHONE-ONLY:keep-me",
				"END:VTODO",
				"END:VCALENDAR",
			].join("\r\n"),
		});

		await service.pushTask("work", path);

		expect(client.putResource.mock.calls[0][2]).toEqual({ ifMatch: "etag-0" });
	});

	it("preserves remote properties it does not model", async () => {
		const { service, client, path } = makeHarness({
			frontmatter: {
				[CALDAV_FRONTMATTER_KEYS.uid]: "uid-1",
				[CALDAV_FRONTMATTER_KEYS.href]: "https://cloud.example.com/cal/tasks/uid-1.ics",
				[CALDAV_FRONTMATTER_KEYS.etag]: "etag-0",
			},
		});
		client.getResource.mockResolvedValue({
			url: "https://cloud.example.com/cal/tasks/uid-1.ics",
			etag: "etag-0",
			data: [
				"BEGIN:VCALENDAR",
				"BEGIN:VTODO",
				"UID:uid-1",
				"SUMMARY:Old",
				"DESCRIPTION:Written on the phone",
				"X-PHONE-ONLY:keep-me",
				"BEGIN:VALARM",
				"TRIGGER:-PT15M",
				"END:VALARM",
				"END:VTODO",
				"END:VCALENDAR",
			].join("\r\n"),
		});

		await service.pushTask("work", path);

		const body = client.putResource.mock.calls[0][1] as string;
		expect(body).toContain("X-PHONE-ONLY:keep-me");
		expect(body).toContain("DESCRIPTION:Written on the phone");
		expect(body).toContain("BEGIN:VALARM");
		expect(body).toContain("SUMMARY:Buy groceries");
	});
});

describe("CalDavSyncService loop prevention", () => {
	it("ignores a change whose sync-relevant content is unchanged", async () => {
		const { service, plugin, path, task } = makeHarness();

		// First pass records the fingerprint.
		await service.pushTask("work", path);
		const putCallsAfterPush = 1;

		// Now simulate the file-updated event that our own metadata write fires.
		await service.handleTaskFileUpdated(path, task);

		// No push was scheduled, so nothing further was written.
		expect(plugin.saveData).toHaveBeenCalled();
		expect(
			(service as unknown as { pushTimers: Map<string, number> }).pushTimers.size
		).toBe(0);
		expect(putCallsAfterPush).toBe(1);
	});

	it("ignores a file it is currently writing itself", async () => {
		const { service, path, task } = makeHarness();
		(service as unknown as { handlingPaths: Set<string> }).handlingPaths.add(path);

		await service.handleTaskFileUpdated(path, task);

		expect(
			(service as unknown as { pushTimers: Map<string, number> }).pushTimers.size
		).toBe(0);
	});

	it("schedules a push for a genuine content edit", async () => {
		const { service, path, task } = makeHarness();

		await service.handleTaskFileUpdated(path, { ...task, title: "Something new" });

		expect(
			(service as unknown as { pushTimers: Map<string, number> }).pushTimers.size
		).toBe(1);
		service.destroy();
	});
});

describe("CalDavSyncService remote deletion", () => {
	const linkedFrontmatter = {
		[CALDAV_FRONTMATTER_KEYS.uid]: "uid-1",
		[CALDAV_FRONTMATTER_KEYS.href]: "https://cloud.example.com/cal/tasks/uid-1.ics",
		[CALDAV_FRONTMATTER_KEYS.etag]: "etag-0",
		[CALDAV_FRONTMATTER_KEYS.account]: "work",
	};

	async function runDeletionPass(policy: "archive" | "delete" | "unlink") {
		const harness = makeHarness({
			frontmatter: { ...linkedFrontmatter },
			remoteDeletionPolicy: policy,
		});
		// A VTODO-filtered query returns the whole task list, so a linked task
		// missing from it is a remote deletion.
		harness.client.fetchAllVTodos.mockResolvedValue([]);

		await harness.service.syncAccount("work");
		return harness;
	}

	it("archives the note by default and strips its sync metadata", async () => {
		const { taskService, frontmatter } = await runDeletionPass("archive");

		expect(taskService.toggleArchive).toHaveBeenCalledTimes(1);
		expect(taskService.deleteTask).not.toHaveBeenCalled();
		expect(frontmatter[CALDAV_FRONTMATTER_KEYS.uid]).toBeUndefined();
		expect(frontmatter[CALDAV_FRONTMATTER_KEYS.etag]).toBeUndefined();
	});

	it("deletes the note only when explicitly configured", async () => {
		const { taskService } = await runDeletionPass("delete");

		expect(taskService.deleteTask).toHaveBeenCalledTimes(1);
		expect(taskService.toggleArchive).not.toHaveBeenCalled();
	});

	it("unlinks without archiving or deleting", async () => {
		const { taskService, frontmatter } = await runDeletionPass("unlink");

		expect(taskService.deleteTask).not.toHaveBeenCalled();
		expect(taskService.toggleArchive).not.toHaveBeenCalled();
		expect(frontmatter[CALDAV_FRONTMATTER_KEYS.uid]).toBeUndefined();
	});
});

describe("CalDavSyncService local deletion", () => {
	it("deletes the remote VTODO when the task file is removed", async () => {
		const { service, client } = makeHarness();

		await service.handleTaskFileDeleted("Tasks/buy-groceries.md", {
			[CALDAV_FRONTMATTER_KEYS.account]: "work",
			[CALDAV_FRONTMATTER_KEYS.href]: "https://cloud.example.com/cal/tasks/uid-1.ics",
			[CALDAV_FRONTMATTER_KEYS.etag]: "etag-0",
		});

		expect(client.deleteResource).toHaveBeenCalledWith(
			"https://cloud.example.com/cal/tasks/uid-1.ics",
			{ ifMatch: "etag-0" }
		);
	});

	it("does nothing for a task that was never synced", async () => {
		const { service, client } = makeHarness();
		await service.handleTaskFileDeleted("Tasks/other.md", {});
		expect(client.deleteResource).not.toHaveBeenCalled();
	});
});

describe("CalDavSyncService first sync", () => {
	it("previews without writing anything", async () => {
		const { service, client, taskService, plugin } = makeHarness();
		client.fetchAllVTodos.mockResolvedValue([
			{
				url: "https://cloud.example.com/cal/tasks/remote.ics",
				etag: "e-remote",
				data: [
					"BEGIN:VCALENDAR",
					"BEGIN:VTODO",
					"UID:remote-uid",
					"SUMMARY:From the server",
					"END:VTODO",
					"END:VCALENDAR",
				].join("\r\n"),
			},
		]);

		const plan = await service.previewFirstSync("work");

		expect(plan.toImport).toHaveLength(1);
		expect(plan.toUpload).toHaveLength(1); // the local task has no UID yet
		expect(client.putResource).not.toHaveBeenCalled();
		expect(taskService.createTask).not.toHaveBeenCalled();
		expect(plugin.saveData).not.toHaveBeenCalled();
	});

	it("creates imported tasks through the normal creation path", async () => {
		const { service, client, taskService } = makeHarness();
		client.fetchAllVTodos.mockResolvedValue([
			{
				url: "https://cloud.example.com/cal/tasks/remote.ics",
				etag: "e-remote",
				data: [
					"BEGIN:VCALENDAR",
					"BEGIN:VTODO",
					"UID:remote-uid",
					"SUMMARY:From the server",
					"DUE;VALUE=DATE:20250910",
					"END:VTODO",
					"END:VCALENDAR",
				].join("\r\n"),
			},
		]);

		const plan = await service.previewFirstSync("work");
		await service.applyFirstSync("work", { ...plan, toUpload: [] });

		expect(taskService.createTask).toHaveBeenCalledTimes(1);
		const created = taskService.createTask.mock.calls[0][0];
		expect(created.title).toBe("From the server");
		expect(created.due).toBe("2025-09-10");
		// completeTaskData drops unknown fields, so these must ride along as
		// custom frontmatter or the link is lost.
		expect(created.customFrontmatter[CALDAV_FRONTMATTER_KEYS.uid]).toBe("remote-uid");
		expect(created.customFrontmatter[CALDAV_FRONTMATTER_KEYS.account]).toBe("work");
	});
});

describe("CalDavSyncService import fidelity", () => {
	it("does not invent dates the remote task never had", async () => {
		// The vault's creation defaults schedule new tasks for today. Letting
		// that apply to an import would write a date back onto the user's remote
		// task on the next push.
		const { service, client, taskService } = makeHarness();
		client.fetchAllVTodos.mockResolvedValue([
			{
				url: "https://cloud.example.com/cal/tasks/remote-1.ics",
				etag: "etag-r",
				data: [
					"BEGIN:VCALENDAR",
					"BEGIN:VTODO",
					"UID:remote-1",
					"SUMMARY:No dates here",
					"END:VTODO",
					"END:VCALENDAR",
				].join("\r\n"),
			},
		]);

		await service.syncAccount("work", { force: true });

		const created = taskService.createTask.mock.calls.at(-1)?.[0] as Record<string, unknown>;
		expect(created.title).toBe("No dates here");
		expect(created.due).toBe("");
		expect(created.scheduled).toBe("");
	});
});

describe("CalDavSyncService polling", () => {
	it("skips the whole poll when the collection tag has not moved", async () => {
		const { service, client } = makeHarness();
		await service.syncAccount("work");
		client.fetchAllVTodos.mockClear();

		// Second pass sees the same ctag: nothing should be downloaded.
		await service.syncAccount("work");

		expect(client.getCollectionTag).toHaveBeenCalledTimes(2);
		expect(client.fetchAllVTodos).not.toHaveBeenCalled();
	});

	it("polls again once the tag changes", async () => {
		const { service, client } = makeHarness();
		await service.syncAccount("work");

		client.getCollectionTag.mockResolvedValue({ ctag: "ctag-2", syncToken: "token-2" });
		client.fetchAllVTodos.mockClear();
		await service.syncAccount("work");

		expect(client.fetchAllVTodos).toHaveBeenCalledTimes(1);
	});

	it("never fans out over the collection's non-task resources", async () => {
		// Task lists commonly share a collection with far more VEVENTs; pulling
		// every resource body to find the todos is the thing to avoid.
		const { service, client } = makeHarness();
		await service.syncAccount("work", { force: true });

		expect(client.fetchResources).not.toHaveBeenCalled();
		expect(client.syncCollection).not.toHaveBeenCalled();
	});
});

describe("CalDavSyncService persistence safety", () => {
	it("does not write sync state when data.json could not be read", async () => {
		const { service, plugin, client } = makeHarness();
		// null is the "exists but unreadable" signal; writing anyway would
		// persist a document built from nothing and wipe every setting.
		plugin.loadPluginDataForSafeWrite.mockResolvedValue(null);

		await service.syncAccount("work", { force: true });

		expect(client.fetchAllVTodos).toHaveBeenCalled();
		expect(plugin.saveData).not.toHaveBeenCalled();
	});
});

describe("CalDavSyncService retry queue", () => {
	async function failPush() {
		const harness = makeHarness();
		harness.client.putResource.mockRejectedValue(new Error("network down"));
		harness.client.getResource.mockResolvedValue(null);
		await expect(harness.service.pushTask("work", harness.path)).rejects.toThrow();
		return harness;
	}

	it("queues a push that failed so the edit is not lost", async () => {
		const harness = await failPush();
		await (
			harness.service as unknown as {
				enqueueRetry: (a: string, p: string, e: unknown) => Promise<void>;
			}
		).enqueueRetry("work", harness.path, new Error("network down"));

		const queue = harness.pluginData.caldavSyncQueue as { taskPath: string }[];
		expect(queue).toHaveLength(1);
		expect(queue[0].taskPath).toBe(harness.path);
	});

	it("clears the entry once the retry succeeds", async () => {
		const harness = await failPush();
		await (
			harness.service as unknown as {
				enqueueRetry: (a: string, p: string, e: unknown) => Promise<void>;
			}
		).enqueueRetry("work", harness.path, new Error("network down"));

		harness.client.putResource.mockResolvedValue({ etag: "etag-2", conflict: false });
		await harness.service.drainRetryQueue();

		expect(harness.pluginData.caldavSyncQueue).toEqual([]);
	});

	it("gives up after repeated failures rather than retrying forever", async () => {
		const harness = await failPush();
		await (
			harness.service as unknown as {
				enqueueRetry: (a: string, p: string, e: unknown) => Promise<void>;
			}
		).enqueueRetry("work", harness.path, new Error("network down"));

		for (let attempt = 0; attempt < 6; attempt++) {
			await harness.service.drainRetryQueue();
		}

		expect(harness.pluginData.caldavSyncQueue).toEqual([]);
	});
});

describe("CalDavSyncService unlink", () => {
	it("strips the sync metadata but leaves the note's own fields alone", async () => {
		const { service, frontmatter, taskService } = makeHarness({
			frontmatter: {
				[CALDAV_FRONTMATTER_KEYS.uid]: "uid-1",
				[CALDAV_FRONTMATTER_KEYS.href]: "https://cloud.example.com/cal/tasks/uid-1.ics",
				[CALDAV_FRONTMATTER_KEYS.etag]: "etag-0",
				[CALDAV_FRONTMATTER_KEYS.account]: "work",
				projects: ["[[Renovation]]"],
			},
		});

		await service.unlinkAllTasks();

		expect(frontmatter[CALDAV_FRONTMATTER_KEYS.uid]).toBeUndefined();
		expect(frontmatter[CALDAV_FRONTMATTER_KEYS.href]).toBeUndefined();
		expect(frontmatter.projects).toEqual(["[[Renovation]]"]);
		expect(taskService.deleteTask).not.toHaveBeenCalled();
	});

	it("does not delete anything on the server", async () => {
		const { service, client } = makeHarness({
			frontmatter: { [CALDAV_FRONTMATTER_KEYS.uid]: "uid-1" },
		});
		await service.unlinkAllTasks();
		expect(client.deleteResource).not.toHaveBeenCalled();
	});

	it("leaves the fingerprint in place so the task is not instantly re-pushed", async () => {
		// Forgetting it would make every unlinked task look freshly edited, and
		// push-on-change would re-upload it under a new UID.
		const { service, plugin, path } = makeHarness({
			frontmatter: { [CALDAV_FRONTMATTER_KEYS.uid]: "uid-1" },
		});

		await service.unlinkAllTasks();
		const fingerprints = plugin.loadData.mock.calls.length
			? ((await plugin.loadData()) as Record<string, Record<string, string>>)
			: {};

		expect(fingerprints.caldavTaskFingerprints?.[path]).toBeDefined();
	});
});

describe("CalDavSyncService gating", () => {
	it("does nothing when the integration is disabled", async () => {
		const { service, plugin, path, task } = makeHarness();
		plugin.settings.caldav.enabled = false;

		await service.handleTaskFileUpdated(path, task);

		expect(
			(service as unknown as { pushTimers: Map<string, number> }).pushTimers.size
		).toBe(0);
	});
});
