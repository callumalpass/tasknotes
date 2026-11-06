import { observeTranslation as mockObserveTranslation } from "../../helpers/real-i18n";
import { TaskEditModal } from "../../../src/modals/TaskEditModal";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import type { App } from "obsidian";
import type { TaskInfo } from "../../../src/types";

jest.mock("../../../src/modals/ConfirmationModal", () => ({
	ConfirmationModal: jest.fn().mockImplementation(() => ({
		show: jest.fn().mockResolvedValue(false),
		open: jest.fn(),
		close: jest.fn(),
	})),
}));

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Pay invoice",
		status: "open",
		priority: "normal",
		path: "Tasks/Pay invoice.md",
		archived: false,
		tags: ["task"],
		contexts: [],
		projects: [],
		attachments: ["[[Files/invoice.pdf]]", "[[Files/receipt.png]]"],
		...overrides,
	} as TaskInfo;
}

function setup(task: TaskInfo) {
	MockObsidian.reset();
	const app = MockObsidian.createMockApp() as unknown as App;
	const vaultFiles = new Set(["Files/invoice.pdf", "Files/receipt.png", "Files/contract.pdf"]);
	const createBinary = jest.fn(async (path: string) => {
		vaultFiles.add(path);
		return { path };
	});
	const vaultDelete = jest.fn();
	const vaultTrash = jest.fn();
	const trashFile = jest.fn();
	const getAvailablePathForAttachment = jest.fn(async (filename: string) => `Attachments/${filename}`);
	Object.assign(app.vault, {
		createBinary,
		delete: vaultDelete,
		trash: vaultTrash,
		getAbstractFileByPath: jest.fn((path: string) => {
			if (!vaultFiles.has(path)) return null;
			const { TFile } = jest.requireActual("obsidian") as typeof import("obsidian");
			const file = Object.create(TFile.prototype);
			file.path = path;
			return file;
		}),
	});
	Object.assign(app.fileManager, { trashFile, getAvailablePathForAttachment });

	const updateTask = jest.fn(async (original: TaskInfo, changes: Partial<TaskInfo>) => ({
		...original,
		...changes,
	}));
	const plugin = {
		app,
		settings: {
			taskTag: "task",
			taskIdentificationMethod: "tag",
			defaultTaskPriority: "normal",
			defaultTaskStatus: "open",
			userFields: [],
		},
		taskService: { updateTask },
		statusManager: { isCompletedStatus: jest.fn(() => false) },
		cacheManager: { getTaskInfo: jest.fn() },
		i18n: { translate: mockObserveTranslation() },
	};

	const modal = new TaskEditModal(app, plugin as never, { task });
	const internals = modal as unknown as {
		initializeFormData(): Promise<void>;
		createAttachmentsField(container: HTMLElement): void;
		getChanges(): Partial<TaskInfo>;
	};
	return {
		modal,
		internals,
		updateTask,
		createBinary,
		trashFile,
		destructive: [vaultDelete, vaultTrash, trashFile],
	};
}

async function renderField(task: TaskInfo) {
	const ctx = setup(task);
	await ctx.internals.initializeFormData();
	const container = document.createElement("div");
	document.body.appendChild(container);
	ctx.internals.createAttachmentsField(container);
	return { ...ctx, container };
}

function pendingFile(name: string): File {
	const file = new File(["bytes"], name, { type: "image/png", lastModified: 1 });
	// jsdom's File lacks arrayBuffer in some versions.
	Object.defineProperty(file, "arrayBuffer", {
		value: async () => new TextEncoder().encode("bytes").buffer,
	});
	return file;
}

describe("TaskEditModal attachments", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("writes vault picks and imported files as canonical attachment links in list order", async () => {
		const { modal, updateTask, container } = await renderField(createTask({ attachments: [] }));
		const field = (modal as unknown as { attachmentsField: { addVaultFile(f: { path: string; name: string }): void; addPendingFiles(f: File[]): void } }).attachmentsField;

		field.addVaultFile({ path: "Files/contract.pdf", name: "contract.pdf" });
		field.addPendingFiles([pendingFile("scan.png")]);
		expect(container.querySelectorAll(".task-attachment-item")).toHaveLength(2);

		await modal.handleSave();

		expect(updateTask).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				attachments: ["[[Files/contract.pdf]]", "[[Attachments/scan.png]]"],
			})
		);
	});

	it("does not write imported files to the vault when the edit is discarded", async () => {
		const { modal, internals, createBinary, updateTask } = await renderField(createTask());
		const field = (modal as unknown as { attachmentsField: { addPendingFiles(f: File[]): void } }).attachmentsField;

		field.addPendingFiles([pendingFile("scan.png")]);
		// The pending import counts as an unsaved change...
		expect(Object.keys(internals.getChanges())).toContain("attachments");

		// ...but discarding closes without copying anything into the vault.
		modal.forceClose();

		expect(createBinary).not.toHaveBeenCalled();
		expect(updateTask).not.toHaveBeenCalled();
	});

	it("removing an attachment only unlinks it and never deletes the vault file", async () => {
		const { modal, internals, updateTask, destructive, container } = await renderField(createTask());

		const removeButtons = container.querySelectorAll<HTMLButtonElement>(".task-attachment-remove");
		expect(removeButtons[0].getAttribute("aria-label")).toContain("invoice.pdf");
		removeButtons[0].click();

		expect(internals.getChanges().attachments).toEqual(["[[Files/receipt.png]]"]);
		// Focus stays in the list for keyboard users.
		expect(document.activeElement).toBe(container.querySelector(".task-attachment-remove"));

		await modal.handleSave();

		expect(updateTask).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ attachments: ["[[Files/receipt.png]]"] })
		);
		for (const destroy of destructive) {
			expect(destroy).not.toHaveBeenCalled();
		}
	});

	it("rejects files whose names can't be stored as attachment links", async () => {
		const { modal, container, createBinary } = await renderField(createTask({ attachments: [] }));
		const field = (modal as unknown as { attachmentsField: { addVaultFile(f: { path: string; name: string }): void; addPendingFiles(f: File[]): void } }).attachmentsField;

		field.addPendingFiles([pendingFile("scan [1].png"), pendingFile("README")]);
		field.addVaultFile({ path: "Files/Invoice #42.pdf", name: "Invoice #42.pdf" });

		expect(container.querySelectorAll(".task-attachment-item")).toHaveLength(0);
		expect(createBinary).not.toHaveBeenCalled();
	});

	it("trashes imported files and keeps them pending when the task update fails", async () => {
		const { modal, container, updateTask, createBinary, trashFile } = await renderField(
			createTask({ attachments: [] })
		);
		const field = (modal as unknown as { attachmentsField: { addPendingFiles(f: File[]): void } }).attachmentsField;
		field.addPendingFiles([pendingFile("scan.png")]);
		updateTask.mockRejectedValueOnce(new Error("write failed"));

		await modal.handleSave();

		expect(createBinary).toHaveBeenCalledWith("Attachments/scan.png", expect.anything());
		expect(trashFile).toHaveBeenCalledWith(expect.objectContaining({ path: "Attachments/scan.png" }));
		expect(container.querySelector(".task-attachment-item--pending")).not.toBeNull();
	});
});
