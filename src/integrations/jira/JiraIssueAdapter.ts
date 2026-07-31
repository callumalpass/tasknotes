import type { App } from "obsidian";

export const JIRA_PLUGIN_ID = "obsidian-jira-issue";

export type JiraIssueAdapterErrorCode =
	| "invalid-issue-key"
	| "dependency-unavailable"
	| "fetch-failed"
	| "invalid-response";

export class JiraIssueAdapterError extends Error {
	readonly cause?: unknown;

	constructor(
		public readonly code: JiraIssueAdapterErrorCode,
		message: string,
		options?: { cause?: unknown }
	) {
		super(message);
		this.name = "JiraIssueAdapterError";
		this.cause = options?.cause;
	}
}

export interface JiraIssue {
	key: string;
	fields: {
		[key: string]: unknown;
		summary: string;
		description?: unknown;
		status?: { name?: string | null } | null;
		priority?: { name?: string | null } | null;
		created?: string | null;
		duedate?: string | null;
		timeestimate?: number | null;
		labels?: unknown;
	};
}

interface JiraPluginApi {
	api: {
		base: {
			getIssue(issueKey: string): Promise<unknown>;
		};
	};
}

function isJiraPluginApi(value: unknown): value is JiraPluginApi {
	if (!value || typeof value !== "object") return false;
	const api = Reflect.get(value, "api");
	if (!api || typeof api !== "object") return false;
	const base = Reflect.get(api, "base");
	return (
		!!base &&
		typeof base === "object" &&
		typeof Reflect.get(base, "getIssue") === "function"
	);
}

function parseJiraIssue(value: unknown): JiraIssue {
	if (!value || typeof value !== "object") {
		throw new JiraIssueAdapterError("invalid-response", "Jira returned an invalid issue.");
	}

	const key = Reflect.get(value, "key");
	const fields = Reflect.get(value, "fields");
	const summary =
		fields && typeof fields === "object" ? Reflect.get(fields, "summary") : undefined;

	if (
		typeof key !== "string" ||
		!key.trim() ||
		!fields ||
		typeof fields !== "object" ||
		typeof summary !== "string" ||
		!summary.trim()
	) {
		throw new JiraIssueAdapterError(
			"invalid-response",
			"Jira returned an issue without a key or summary."
		);
	}

	return value as JiraIssue;
}

export function normalizeJiraIssueKey(issueKey: string): string {
	const normalized = issueKey.trim().toUpperCase();
	if (!/^[A-Z][A-Z0-9_]*-\d+$/.test(normalized)) {
		throw new JiraIssueAdapterError(
			"invalid-issue-key",
			`Invalid Jira issue key: ${issueKey}`
		);
	}
	return normalized;
}

/**
 * Isolates TaskNotes from the optional obsidian-jira-issue dependency and validates
 * the small part of its runtime API used by issue import.
 */
export class JiraIssueAdapter {
	constructor(private readonly getPlugin: () => unknown) {}

	static fromApp(app: App): JiraIssueAdapter {
		return new JiraIssueAdapter(() => app.plugins.getPlugin(JIRA_PLUGIN_ID));
	}

	async getIssue(issueKey: string): Promise<JiraIssue> {
		const normalizedKey = normalizeJiraIssueKey(issueKey);
		const plugin = this.getPlugin();
		if (!isJiraPluginApi(plugin)) {
			throw new JiraIssueAdapterError(
				"dependency-unavailable",
				"The obsidian-jira-issue plugin is unavailable or has an incompatible API."
			);
		}

		try {
			return parseJiraIssue(await plugin.api.base.getIssue(normalizedKey));
		} catch (error) {
			if (error instanceof JiraIssueAdapterError) throw error;
			throw new JiraIssueAdapterError(
				"fetch-failed",
				`Failed to fetch Jira issue ${normalizedKey}.`,
				{ cause: error }
			);
		}
	}
}
