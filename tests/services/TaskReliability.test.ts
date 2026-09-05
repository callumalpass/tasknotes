jest.mock("../../src/services/MCPService", () => ({ MCPService: jest.fn() }));
import { TFile, Platform, requestUrl } from "obsidian";
import {
	GoogleCalendarService,
	taskProjectionMatches,
} from "../../src/services/GoogleCalendarService";
import { TaskUpdateService } from "../../src/services/task-service/TaskUpdateService";
import { TaskCalendarSyncService } from "../../src/services/TaskCalendarSyncService";
import { OAuthService } from "../../src/services/OAuthService";
import { OAuthSecretStore } from "../../src/services/OAuthSecretStore";
import { HTTPAPIService } from "../../src/services/HTTPAPIService";
import { PomodoroService } from "../../src/services/PomodoroService";

const UID = "61d3d239-e29c-4295-aac2-a40be5ace641";
const OTHER = "a0a38710-9c32-485a-bd39-9a049cc7e9ee";

describe("task write and recovery boundaries", () => {
	it("rebases a stale modal patch on current recurrence fields and returns that state", async () => {
		const file = Object.assign(Object.create(TFile.prototype), { path: "Tasks/example.md" });
		const fm: any = {
			status: "ready",
			priority: "normal",
			scheduled: "2026-09-07",
			recurrence: "DTSTART:20260905;FREQ=DAILY",
			complete_instances: ["2026-09-05", "2026-09-06"],
			timeEstimate: 5,
			custom: "keep",
		};
		const runtime: any = {
			app: {
				vault: { getAbstractFileByPath: () => file },
				fileManager: { processFrontMatter: async (_: unknown, fn: any) => fn(fm) },
			},
			settings: {
				storeTitleInFilename: false,
				maintainDueDateOffsetInRecurring: false,
				taskIdentificationMethod: "property",
				taskPropertyName: "type",
				taskPropertyValue: "task",
			},
			fieldMapper: {
				mapFromFrontmatter: (value: any) => ({ ...value }),
				mapToFrontmatter: (value: any) => ({ ...value }),
				toUserField: (key: string) => key,
			},
			cacheManager: { updateTaskInfoInCache: jest.fn() },
			emitter: { trigger: jest.fn() },
			statusManager: { isCompletedStatus: () => false },
		};
		const service = new TaskUpdateService({
			runtime,
			updateCompletedDateInFrontmatter: () => {},
		});
		const stale: any = {
			...fm,
			path: file.path,
			title: "Example",
			scheduled: "2026-09-06",
			due: "2026-09-01",
			complete_instances: ["2026-09-05"],
		};
		const result = await service.updateTask(stale, { timeEstimate: 10 });
		expect(fm.scheduled).toBe("2026-09-07");
		expect(fm.complete_instances).toEqual(["2026-09-05", "2026-09-06"]);
		expect(fm.custom).toBe("keep");
		expect(fm.due).toBeUndefined();
		expect(result.due).toBeUndefined();
		expect(result.scheduled).toBe("2026-09-07");
		expect(result.complete_instances).toEqual(fm.complete_instances);
		expect(result.timeEstimate).toBe(10);
		expect(stale.scheduled).toBe("2026-09-06");
	});

	function projectionFixture() {
		const task: any = {
			path: "Tasks/new-name.md",
			title: "Example",
			status: "ready",
			scheduled: "2026-09-06",
			archived: false,
		};
		const file: any = { path: task.path };
		const plugin: any = {
			app: {
				vault: {
					getName: () => "Example Vault",
					getMarkdownFiles: () => [file],
					read: async () => `---\ntasknotesUid: ${UID}\n---\n`,
				},
			},
			settings: {
				googleCalendarExport: {
					enabled: true,
					reconcileFromTasks: true,
					targetCalendarId: "test-calendar",
				},
			},
			fieldMapper: { mapFromFrontmatter: () => ({ ...task }) },
			cacheManager: { getAllTasks: async () => [task] },
		};
		const owner = {
			tasknotesProjection: "1",
			tasknotesVault: "Example Vault",
			tasknotesUid: UID,
			tasknotesRole: "series",
		};
		const events: any[] = [{ id: "event1", extendedProperties: { private: owner } }];
		const google: any = {
			listTaskProjections: jest.fn(async () => events),
			getConnectionGeneration: () => 0,
		};
		const service: any = new TaskCalendarSyncService(plugin, google);
		service.isEnabled = () => true;
		service.assertConnectionGenerationCurrent = async () => {};
		service.projectionIdentity = async () => UID;
		service.ownedProjectionIsCurrent = () => false;
		service.isTaskCalendarEligible = (t: any) => !t.archived;
		service.getTaskEventId = (t: any) => t.googleCalendarEventId;
		service.saveTaskEventId = jest.fn(async () => {});
		service.saveTaskExceptionMetadata = jest.fn(async () => {});
		service.syncTaskToCalendar = jest.fn(async () => true);
		service.deleteOrQueueCalendarEvent = jest.fn(async () => true);
		return { task, file, plugin, google, service, events, owner };
	}

	it("recovers a moved task's event link without a local provider index", async () => {
		const { task, service } = projectionFixture();
		await service.reconcileOwnedTaskProjections();
		expect(service.saveTaskEventId).toHaveBeenCalledWith(
			task.path,
			"event1",
			"test-calendar",
			0
		);
		expect(service.syncTaskToCalendar).toHaveBeenCalledTimes(1);
		expect(service.deleteOrQueueCalendarEvent).not.toHaveBeenCalled();
	});

	it("repairs a survivor before removing duplicate projections and cleans owned orphans", async () => {
		const { service, events, owner } = projectionFixture();
		events.push(
			{ id: "duplicate", extendedProperties: { private: owner } },
			{ id: "orphan", extendedProperties: { private: { ...owner, tasknotesUid: OTHER } } },
			{ id: "unowned", extendedProperties: { private: {} } }
		);
		await service.reconcileOwnedTaskProjections();
		expect(service.deleteOrQueueCalendarEvent.mock.calls.map((call: any[]) => call[2])).toEqual(
			["duplicate", "orphan"]
		);
		expect(service.syncTaskToCalendar.mock.invocationCallOrder[0]).toBeLessThan(
			service.deleteOrQueueCalendarEvent.mock.invocationCallOrder[0]
		);
	});

	it("keeps duplicate events if the canonical survivor cannot be repaired", async () => {
		const { service, events, owner } = projectionFixture();
		events.push({ id: "duplicate", extendedProperties: { private: owner } });
		service.syncTaskToCalendar.mockResolvedValue(false);
		await service.reconcileOwnedTaskProjections();
		expect(service.deleteOrQueueCalendarEvent).not.toHaveBeenCalled();
	});

	it("deletes the projection of an archived task while retaining its identity", async () => {
		const { task, service } = projectionFixture();
		task.archived = true;
		await service.reconcileOwnedTaskProjections();
		expect(service.deleteOrQueueCalendarEvent).toHaveBeenCalledWith(
			task.path,
			"test-calendar",
			"event1"
		);
		expect(service.syncTaskToCalendar).not.toHaveBeenCalled();
	});

	it.each(["duplicate identity", "unreadable source", "attendees"])(
		"refuses cleanup on %s",
		async (kind) => {
			const { plugin, service, file, events } = projectionFixture();
			if (kind === "duplicate identity")
				plugin.app.vault.getMarkdownFiles = () => [file, { path: "Tasks/copy.md" }];
			if (kind === "unreadable source")
				plugin.app.vault.read = async () => {
					throw Error("unavailable");
				};
			if (kind === "attendees") events[0].attendees = [{ email: "invitee@example.com" }];
			await expect(service.reconcileOwnedTaskProjections()).rejects.toThrow();
			expect(service.saveTaskEventId).not.toHaveBeenCalled();
			expect(service.deleteOrQueueCalendarEvent).not.toHaveBeenCalled();
			expect(service.syncTaskToCalendar).not.toHaveBeenCalled();
		}
	);

	it("recovers a detached recurrence event separately from its parent series", async () => {
		const { task, service, events, owner } = projectionFixture();
		task.googleCalendarExceptionOriginalScheduled = "2026-09-06";
		events.push({
			id: "detached",
			extendedProperties: {
				private: {
					...owner,
					tasknotesRole: "exception",
					tasknotesOccurrence: "2026-09-06",
				},
			},
		});
		await service.reconcileOwnedTaskProjections();
		expect(service.saveTaskExceptionMetadata).toHaveBeenCalledWith(
			task.path,
			{ googleCalendarExceptionEventId: "detached" },
			"test-calendar",
			0
		);
		expect(service.deleteOrQueueCalendarEvent).not.toHaveBeenCalled();
	});

	it("does not enable unauthenticated HTTP API access when the token is empty", () => {
		const service: any = Object.create(HTTPAPIService.prototype);
		service.plugin = { settings: { apiAuthToken: "" } };
		expect(service.authenticate({ headers: {} })).toBe(false);
		service.plugin.settings.apiAuthToken = "fixture-token";
		expect(service.authenticate({ headers: { authorization: "Bearer wrong" } })).toBe(false);
		expect(service.authenticate({ headers: { authorization: "Bearer fixture-token" } })).toBe(
			true
		);
	});

	it("does not resume a persisted Pomodoro writer on mobile startup", async () => {
		const previous = Platform.isMobile;
		(Platform as any).isMobile = true;
		try {
			const service: any = new PomodoroService({
				settings: { pomodoroWorkDuration: 25 },
			} as any);
			service.loadState = async () => {
				service.state = {
					isRunning: true,
					currentSession: { id: "fixture" },
					timeRemaining: 1,
				};
			};
			service.setupTicker = () => {};
			service.subscribeToTaskFileRenames = () => {};
			service.resumeTimer = jest.fn();
			await service.initialize();
			expect(service.resumeTimer).not.toHaveBeenCalled();
			expect(service.state.isRunning).toBe(false);
			expect(service.state.currentSession.id).toBe("fixture");
		} finally {
			(Platform as any).isMobile = previous;
		}
	});

	it("validates and consumes OAuth state before writing a static response", () => {
		const store = new OAuthSecretStore({ getSecret: () => null, setSecret: () => {} });
		const service: any = new OAuthService({} as any, store);
		const response: any = { writeHead: jest.fn(), end: jest.fn() };
		service.handleCallback(
			{ method: "GET", url: "/?error=%3Cscript%3E&state=unknown", headers: {} },
			response
		);
		expect(response.writeHead.mock.calls[0][0]).toBe(400);
		expect(response.end.mock.calls[0][0]).not.toContain("<script>");
		const resolve = jest.fn();
		service.pendingOAuthState.set("known", { resolve, reject: jest.fn() });
		response.writeHead = jest.fn(() =>
			expect(service.pendingOAuthState.has("known")).toBe(false)
		);
		service.handleCallback(
			{ method: "GET", url: "/?code=fixture-code&state=known", headers: {} },
			response
		);
		expect(resolve).toHaveBeenCalledWith("fixture-code");
		expect(response.writeHead.mock.calls[0][1]["Content-Security-Policy"]).toContain(
			"frame-ancestors 'none'"
		);
		expect(response.writeHead.mock.calls[0][1]["Cache-Control"]).toBe("no-store");
		service.handleCallback(
			{ method: "GET", url: "/?code=replay&state=known", headers: {} },
			response
		);
		expect(resolve).toHaveBeenCalledTimes(1);
	});
});

describe("owned provider projection safety", () => {
	const owner = { tasknotesProjection: "1", tasknotesVault: "Example Vault", tasknotesUid: UID };
	function fixture() {
		const service: any = Object.create(GoogleCalendarService.prototype);
		service.baseUrl = "https://www.googleapis.com/calendar/v3";
		service.plugin = {
			app: { vault: { getName: () => "Example Vault" } },
			settings: {
				googleCalendarExport: {
					reconcileFromTasks: true,
					targetCalendarId: "test-calendar",
				},
			},
		};
		service.oauthService = { getValidToken: async () => "fixture-token" };
		service.withRetry = (fn: any) => fn();
		service.refreshAllCalendars = jest.fn(async () => {});
		service.convertToICSEvent = (event: any) => event;
		(requestUrl as jest.Mock).mockReset();
		return service;
	}
	it("pages through owned records, allowing a valid empty final page", async () => {
		const service = fixture();
		(requestUrl as jest.Mock)
			.mockResolvedValueOnce({
				json: {
					items: [{ id: "one" }, { id: "cancelled", status: "cancelled" }],
					nextPageToken: "next",
				},
			})
			.mockResolvedValueOnce({ json: {} });
		expect(await service.listTaskProjections("test-calendar", "Example Vault")).toEqual([
			{ id: "one" },
		]);
		const url = new URL((requestUrl as jest.Mock).mock.calls[1][0].url);
		expect(url.searchParams.getAll("privateExtendedProperty")).toEqual([
			"tasknotesProjection=1",
			"tasknotesVault=Example Vault",
		]);
		expect(url.searchParams.get("pageToken")).toBe("next");
	});
	it.each(["invitation", "unowned", "no etag"])(
		"refuses to delete a changed %s record",
		async (kind) => {
			const service = fixture();
			const event: any = {
				id: "fixture",
				etag: '"version1"',
				extendedProperties: { private: owner },
			};
			if (kind === "invitation") event.attendees = [{ email: "fixture@example.com" }];
			if (kind === "unowned") delete event.extendedProperties;
			if (kind === "no etag") delete event.etag;
			(requestUrl as jest.Mock).mockResolvedValue({ json: event });
			await expect(service.deleteEvent("test-calendar", "fixture")).rejects.toThrow();
			expect((requestUrl as jest.Mock).mock.calls.map((call) => call[0].method)).toEqual([
				"GET",
			]);
		}
	);
	it("uses the freshly read etag for deletion, including saved retries", async () => {
		const service = fixture();
		(requestUrl as jest.Mock)
			.mockResolvedValueOnce({
				json: { id: "fixture", etag: '"version1"', extendedProperties: { private: owner } },
			})
			.mockResolvedValueOnce({ status: 204 });
		await service.deleteEvent("test-calendar", "fixture");
		expect((requestUrl as jest.Mock).mock.calls[1][0]).toMatchObject({
			method: "DELETE",
			headers: { "If-Match": '"version1"' },
		});
	});
	it("detects remote edits even when the ownership marker is unchanged", () => {
		const expected = {
			summary: "Source",
			start: { date: "2026-09-05" },
			end: { date: "2026-09-06" },
			reminders: { useDefault: false },
			transparency: "transparent",
			visibility: "private",
			extendedProperties: { private: owner },
		};
		expect(taskProjectionMatches({ ...expected }, expected)).toBe(true);
		expect(taskProjectionMatches({ ...expected, summary: "Remote drift" }, expected)).toBe(
			false
		);
		expect(
			taskProjectionMatches({ ...expected, recurrence: ["RRULE:FREQ=DAILY"] }, expected)
		).toBe(false);
	});
});
