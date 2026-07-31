import type { TaskCreationData, TaskInfo } from "../types";
import type { JiraFieldMappingSettings, UserMappedField } from "../types/settings";
import {
	JiraIssueAdapter,
	JiraIssueAdapterError,
	type JiraIssue,
} from "../integrations/jira/JiraIssueAdapter";
import { mapJiraIssueWithSettings } from "../integrations/jira/JiraFieldMapping";

export type JiraImportErrorCode =
	| "invalid-issue-key"
	| "dependency-unavailable"
	| "fetch-failed"
	| "creation-failed";

export class JiraImportError extends Error {
	readonly cause?: unknown;

	constructor(
		public readonly code: JiraImportErrorCode,
		message: string,
		options?: { cause?: unknown }
	) {
		super(message);
		this.name = "JiraImportError";
		this.cause = options?.cause;
	}
}

export interface JiraTaskCreator {
	createTask(
		taskData: TaskCreationData,
		options?: { applyDefaults?: boolean; applyTemplate?: boolean }
	): Promise<{ taskInfo: TaskInfo }>;
}

/**
 * Coordinates Jira retrieval and TaskNotes creation without exposing the optional
 * dependency to command registration or the core task-creation service.
 */
export class JiraImportService {
	constructor(
		private readonly adapter: JiraIssueAdapter,
		private readonly taskCreator: JiraTaskCreator,
		private readonly mappingSettings: JiraFieldMappingSettings,
		private readonly userFields: readonly UserMappedField[]
	) {}

	async importIssue(issueKey: string): Promise<TaskInfo> {
		let issue: JiraIssue;
		try {
			issue = await this.adapter.getIssue(issueKey);
		} catch (error) {
			if (error instanceof JiraIssueAdapterError) {
				const code =
					error.code === "invalid-response" ? "fetch-failed" : error.code;
				throw new JiraImportError(code, error.message, { cause: error });
			}
			throw new JiraImportError("fetch-failed", "Failed to fetch Jira issue.", {
				cause: error,
			});
		}

		try {
			const result = await this.taskCreator.createTask(
				mapJiraIssueWithSettings(issue, this.mappingSettings, this.userFields),
				{ applyDefaults: true, applyTemplate: true }
			);
			return result.taskInfo;
		} catch (error) {
			throw new JiraImportError(
				"creation-failed",
				`Failed to create a task for Jira issue ${issue.key}.`,
				{ cause: error }
			);
		}
	}
}
