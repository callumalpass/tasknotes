import { App } from "obsidian";
import { TimeblockCreationModal } from "../../../src/modals/TimeblockCreationModal";
import { TimeblockInfoModal } from "../../../src/modals/TimeblockInfoModal";
import { openTaskSelector } from "../../../src/modals/TaskSelectorWithCreateModal";
import { MockObsidian } from "../../helpers/obsidian-runtime";

jest.mock("obsidian-daily-notes-interface", () => ({
	appHasDailyNotesPluginLoaded: jest.fn(() => true),
	createDailyNote: jest.fn(),
	getAllDailyNotes: jest.fn(() => ({})),
	getDailyNote: jest.fn(),
}));
jest.mock("../../../src/modals/FileSelectorModal", () => ({ openFileSelector: jest.fn() }));
jest.mock("../../../src/modals/TaskSelectorWithCreateModal", () => ({
	openTaskSelector: jest.fn(),
}));

const task = { title: "Write report", path: "Tasks/Write report.md", archived: false };
const secondTask = { title: "Review report", path: "Tasks/Review report.md", archived: false };

function createPlugin() {
	return {
		i18n: { translate: (key: string) => key },
		settings: {
			calendarViewSettings: {
				defaultTimeblockColor: "#8b5cf6",
				timeblockAttachmentSearchOrder: "name",
			},
		},
		cacheManager: { getAllTasks: jest.fn(async () => [task, secondTask]) },
		emitter: { trigger: jest.fn() },
	} as any;
}

async function selectTask(modal: any, selectedTask: typeof task): Promise<void> {
	await modal.openTaskSelectorForTitle();
	const callback = (openTaskSelector as jest.Mock).mock.calls.at(-1)?.[2];
	expect(callback).toBeDefined();
	callback(selectedTask);
}

describe("Issue #2367: adding tasks preserves a named timeblock", () => {
	let app: App;

	beforeEach(async () => {
		MockObsidian.reset();
		app = MockObsidian.createMockApp() as unknown as App;
		await app.vault.create(task.path, "");
		await app.vault.create(secondTask.path, "");
		jest.clearAllMocks();
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		document.body.innerHTML = "";
	});

	it.each(["create", "edit"])(
		"keeps an existing title while adding multiple tasks in %s modal",
		async (mode) => {
			const modal =
				mode === "create"
					? new TimeblockCreationModal(app, createPlugin(), {
							date: "2026-05-16",
							prefilledTitle: "Focus block",
						})
					: new TimeblockInfoModal(
							app,
							createPlugin(),
							{
								id: "tb-1",
								title: "Focus block",
								startTime: "10:00",
								endTime: "11:00",
							},
							new Date(2026, 4, 16)
						);
			await modal.onOpen();
			await selectTask(modal, task);
			await selectTask(modal, secondTask);

			expect((modal as any).titleInput.value).toBe("Focus block");
			expect(
				(modal as any).selectedAttachments.map((file: { path: string }) => file.path)
			).toEqual([task.path, secondTask.path]);
		}
	);

	it.each(["create", "edit"])(
		"fills a blank title from the first task only in %s modal",
		async (mode) => {
			const modal =
				mode === "create"
					? new TimeblockCreationModal(app, createPlugin(), { date: "2026-05-16" })
					: new TimeblockInfoModal(
							app,
							createPlugin(),
							{
								id: "tb-1",
								title: "",
								startTime: "10:00",
								endTime: "11:00",
							},
							new Date(2026, 4, 16)
						);
			await modal.onOpen();
			await selectTask(modal, task);
			await selectTask(modal, secondTask);

			expect((modal as any).titleInput.value).toBe(task.title);
			expect((modal as any).selectedAttachments).toHaveLength(2);
		}
	);
});
