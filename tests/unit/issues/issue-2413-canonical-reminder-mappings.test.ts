import type { App } from "obsidian";
import { App as MockApp, MockObsidian } from "../../helpers/obsidian-runtime";
import { FieldMapper } from "../../../src/core/FieldMapper";
import { TaskManager } from "../../../src/utils/TaskManager";
import { DEFAULT_FIELD_MAPPING, DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { NotificationService } from "../../../src/ui/NotificationService";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";

it("startup catch-up uses canonical custom task identification and mapped due/reminder/status fields", async () => {
	jest.useFakeTimers();
	jest.setSystemTime(new Date("2026-06-01T10:30:00"));
	MockObsidian.reset();
	const app = new MockApp() as unknown as App;
	const settings = {
		...DEFAULT_SETTINGS,
		taskIdentificationMethod: "property" as const,
		taskPropertyName: "kind",
		taskPropertyValue: "action",
		excludedFolders: "",
		storeTitleInFilename: false,
		defaultTaskStatus: "open",
		enableNotifications: true,
		notificationType: "in-app" as const,
		fieldMapping: {
			...DEFAULT_FIELD_MAPPING,
			status: "workflow",
			due: "deadline",
			reminders: "alerts",
		},
	};
	const mapper = new FieldMapper(settings.fieldMapping);
	const manager = new TaskManager(app, settings, mapper);
	const storage = new Map<string, unknown>([
		["tasknotes-reminder-scan-cursor", Date.now() - 30 * 60 * 1000],
	]);
	app.loadLocalStorage = (key) => storage.get(key) ?? null;
	app.saveLocalStorage = (key, value) => {
		storage.set(key, value);
	};
	for (const [title, status, tags, kind] of [
		["Mapped reminder", "open", [], "action"],
		["Completed control", "done", [], "action"],
		["Archived control", "open", ["archived"], "action"],
		["Non-task control", "open", [], "note"],
	] as const) {
		MockObsidian.createTestFile(
			`Tasks/${title}.md`,
			`---\n${JSON.stringify({
				title,
				kind,
				workflow: status,
				tags,
				deadline: "2026-06-01T11:20:00",
				alerts: [{ id: title, type: "relative", relatedTo: "due", offset: "-PT1H" }],
			})}\n---\n`
		);
	}
	const plugin = {
		app,
		settings,
		fieldMapper: mapper,
		cacheManager: manager,
		i18n: createI18nService({ initialLocale: "en" }),
		emitter: { on: jest.fn(), offref: jest.fn() },
		statusManager: {
			getCompletedStatuses: () => ["done"],
			isCompletedStatus: (value: string) => value === "done",
		},
	} as unknown as TaskNotesPlugin;
	const services: NotificationService[] = [];
	try {
		expect(manager.getAllCachedTasks()).toHaveLength(3);
		for (const shouldDeliver of [true, false]) {
			const service = new NotificationService(plugin);
			services.push(service);
			const show = jest.spyOn(service as any, "showInAppNotice").mockImplementation(() => {});
			jest.spyOn(service as any, "playNotificationSound").mockImplementation(() => {});
			await service.initialize();
			await Promise.resolve();
			expect(show).toHaveBeenCalledTimes(shouldDeliver ? 1 : 0);
			if (shouldDeliver)
				expect(show.mock.calls[0][0]).toMatch(
					/^Missed reminder \(.+\): Mapped reminder is due /
				);
			service.destroy();
		}
	} finally {
		services.forEach((service) => service.destroy());
		jest.useRealTimers();
	}
});
