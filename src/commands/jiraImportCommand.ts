import { Notice } from "obsidian";
import type TaskNotesPlugin from "../main";
import { JiraIssueAdapter } from "../integrations/jira/JiraIssueAdapter";
import { showTextInputModal } from "../modals/TextInputModal";
import { JiraImportError, JiraImportService } from "../services/JiraImportService";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Commands/JiraImport" });

export async function executeJiraImportCommand(plugin: TaskNotesPlugin): Promise<void> {
	const issueKey = await showTextInputModal(plugin.app, {
		title: plugin.i18n.translate("commands.importJiraIssue"),
		placeholder: plugin.i18n.translate("commands.jiraIssueKeyPlaceholder"),
		confirmText: plugin.i18n.translate("commands.jiraImportButton"),
		cancelText: plugin.i18n.translate("common.cancel"),
	});
	if (!issueKey) return;

	const service = new JiraImportService(
		JiraIssueAdapter.fromApp(plugin.app),
		plugin.taskService,
		plugin.settings.jiraMapping,
		plugin.settings.userFields ?? []
	);

	try {
		const task = await service.importIssue(issueKey);
		new Notice(
			plugin.i18n.translate("commands.jiraImportSuccess", {
				title: task.title,
			})
		);
	} catch (error) {
		tasknotesLogger.error("Failed to import Jira issue", {
			category: "provider",
			operation: "importing-jira-issue",
			error,
		});

		const noticeKey =
			error instanceof JiraImportError
				? {
						"invalid-issue-key": "commands.jiraImportInvalidKey",
						"dependency-unavailable": "commands.jiraImportMissingPlugin",
						"fetch-failed": "commands.jiraImportFetchFailed",
						"creation-failed": "commands.jiraImportCreationFailed",
					}[error.code]
				: "commands.jiraImportFetchFailed";
		new Notice(plugin.i18n.translate(noticeKey));
	}
}
