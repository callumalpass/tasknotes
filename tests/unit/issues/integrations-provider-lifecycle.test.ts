import { GoogleCalendarService } from "../../../src/services/GoogleCalendarService";
import { MicrosoftCalendarService } from "../../../src/services/MicrosoftCalendarService";
import { TaskCalendarSyncService } from "../../../src/services/TaskCalendarSyncService";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { promise, resolve };
};
const oauth = () => ({ isConnected: jest.fn().mockResolvedValue(true), getConnectionGeneration: jest.fn().mockReturnValue(0) });
const providerPlugin = () => ({
	settings: { enabledGoogleCalendars: ["a", "b"], enabledMicrosoftCalendars: ["a", "b"], microsoftCalendarSyncTokens: { a: "old" } },
	loadPluginDataForSafeWrite: jest.fn().mockResolvedValue({}), saveData: jest.fn().mockResolvedValue(undefined), emitter: { trigger: jest.fn() },
});

describe("provider cache and lifecycle", () => {
	it.each(["google", "microsoft"])("filters disabled %s calendars immediately", (name) => {
		const plugin = providerPlugin();
		const service: any = name === "google" ? new GoogleCalendarService(plugin as any, oauth() as any) : new MicrosoftCalendarService(plugin as any, oauth() as any);
		service.cache.set("all", ["a", "b"].map((id) => ({ subscriptionId: `${name}-${id}`, id })));
		if (name === "google") plugin.settings.enabledGoogleCalendars = ["a"];
		else plugin.settings.enabledMicrosoftCalendars = ["a"];
		expect(service.getAllEvents().map((event: any) => event.id)).toEqual(["a"]);
		service.destroy();
	});

	it("discards Microsoft events and calendar list after disconnect", async () => {
		const plugin = providerPlugin();
		const service: any = new MicrosoftCalendarService(plugin as any, oauth() as any);
		service.listCalendars = jest.fn().mockResolvedValue([{ id: "a" }]);
		const pending = deferred<any>();
		service.fetchCalendarEvents = jest.fn().mockReturnValue(pending.promise);
		const changed = jest.fn();
		service.on("data-changed", changed);
		const refresh = service.refreshAllCalendars();
		while (!service.fetchCalendarEvents.mock.calls.length) await Promise.resolve();
		await service.disconnect();
		pending.resolve({ events: [], isFullSync: true });
		await refresh;
		expect(service.getAllEvents()).toEqual([]);
		expect(service.getAvailableCalendars()).toEqual([]);
		expect(service.getSyncStatus().lastSuccess).toBeNull();
		expect(plugin.settings.microsoftCalendarSyncTokens).toEqual({});
		expect(changed).toHaveBeenCalledTimes(1);
		service.destroy();
	});

	it("does not start a Microsoft timer when destroyed during initialization", async () => {
		const service: any = new MicrosoftCalendarService(providerPlugin() as any, oauth() as any);
		const pending = deferred<void>();
		service.refreshAllCalendars = jest.fn().mockReturnValue(pending.promise);
		const init = service.initialize();
		await Promise.resolve();
		service.destroy();
		pending.resolve();
		await init;
		expect(service.refreshTimer).toBeNull();
	});

	it.each([false, true])("reports Google total/partial failures and preserves success timestamp (%s)", async (partial) => {
		const plugin = providerPlugin();
		const service: any = new GoogleCalendarService(plugin as any, oauth() as any);
		service.listCalendars = jest.fn().mockResolvedValue([{ id: "a" }, { id: "b" }]);
		service.fetchCalendarEvents = jest.fn().mockImplementation(async (id: string) => {
			if (!partial || id === "b") throw new Error("offline");
			return { events: [], isFullSync: true };
		});
		await expect(service.refresh()).rejects.toThrow("offline");
		expect(service.lastManualRefresh).toBe(0);
		expect(service.getSyncStatus().lastSuccess).toBeNull();
		expect(service.getSyncStatus().calendarErrors).toHaveLength(partial ? 1 : 2);
		service.destroy();
	});
});

describe("serialized Google sync queue", () => {
	const setup = () => {
		let data: any = {};
		const clone = (value: any) => JSON.parse(JSON.stringify(value));
		const plugin = PluginFactory.createMockPlugin();
		plugin.loadData = jest.fn(async () => clone(data));
		plugin.loadPluginDataForSafeWrite = jest.fn(async () => clone(data));
		plugin.saveData = jest.fn(async (next: any) => { data = clone(next); });
		const service: any = new TaskCalendarSyncService(plugin, {} as any);
		service.isSyncQueueReady = () => true;
		service.isTaskCalendarEligible = () => true;
		plugin.cacheManager.getTaskInfo = jest.fn(async (path: string) => TaskFactory.createTask({ path }));
		return { service, data: () => data };
	};
	it("preserves concurrent enqueues", async () => {
		const { service, data } = setup();
		await Promise.all([service.queueTaskSync("a"), service.queueTaskSync("b")]);
		expect(data().googleCalendarSyncQueue.map((item: any) => item.taskPath)).toEqual(["a", "b"]);
		service.destroy();
	});
	it.each(["a", "b"])("preserves enqueue of %s during a drain, including same-path revisions", async (path) => {
		const { service, data } = setup();
		await service.queueTaskSync("a");
		const pending = deferred<boolean>();
		service.syncTaskToCalendar = jest.fn().mockReturnValue(pending.promise);
		const drain = service.processPendingSyncQueue();
		while (!service.syncTaskToCalendar.mock.calls.length) await Promise.resolve();
		await service.queueTaskSync(path);
		pending.resolve(true);
		const result = await drain;
		expect(data().googleCalendarSyncQueue.map((item: any) => item.taskPath)).toEqual([path]);
		expect(result.remaining).toBe(1);
		service.destroy();
	});
});
