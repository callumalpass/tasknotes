import { App, Modal, Notice } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";

class DeleteTaskConfirmationModal extends Modal {
	private task: TaskInfo;
	private onConfirm: () => Promise<void>;

	constructor(app: App, task: TaskInfo, onConfirm: () => Promise<void>) {
		super(app);
		this.task = task;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Delete Task" });

		const description = contentEl.createEl("p");
		description.appendText('Are you sure you want to delete the task "');
		description.createEl("strong", { text: this.task.title });
		description.appendText('"?');

		contentEl.createEl("p", {
			cls: "mod-warning",
			text: "This action cannot be undone. The task file will be permanently deleted.",
		});

		const buttonContainer = contentEl.createEl("div", { cls: "modal-button-container" });
		buttonContainer.style.display = "flex";
		buttonContainer.style.gap = "10px";
		buttonContainer.style.justifyContent = "flex-end";
		buttonContainer.style.marginTop = "20px";

		const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		const deleteButton = buttonContainer.createEl("button", {
			text: "Delete",
			cls: "mod-warning",
		});
		deleteButton.style.backgroundColor = "var(--color-red)";
		deleteButton.style.color = "white";

		deleteButton.addEventListener("click", async () => {
			try {
				await this.onConfirm();
				this.close();
				new Notice("Task deleted successfully");
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				new Notice(`Failed to delete task: ${errorMessage}`);
				console.error("Error in delete confirmation:", error);
			}
		});

		cancelButton.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export async function showDeleteConfirmationModal(
	task: TaskInfo,
	plugin: TaskNotesPlugin
): Promise<void> {
	return new Promise((resolve, reject) => {
		const modal = new DeleteTaskConfirmationModal(plugin.app, task, async () => {
			try {
				await plugin.taskService.deleteTask(task);
				resolve();
			} catch (error) {
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
		modal.open();
	});
}
