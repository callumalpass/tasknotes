import type { JiraIssue } from "../../../src/integrations/jira/JiraIssueAdapter";
import type {
	JiraFieldMappingSettings,
	UserMappedField,
} from "../../../src/types/settings";
import {
	buildJiraIssueBacklink,
	buildJiraMappingPreview,
	createDefaultJiraMappingSettings,
	getJiraValueByPath,
	mapJiraIssueWithSettings,
	normalizeJiraMappingSettings,
	prependJiraIssueBacklink,
	renderJiraTemplate,
} from "../../../src/integrations/jira/JiraFieldMapping";

const issue: JiraIssue = {
	key: "MAGIC-17",
	fields: {
		summary: "Audit enchanted broom inventory",
		description: "Three brooms remain unaccounted for.",
		status: { name: "Doing" },
		priority: { name: "Major" },
		created: "2026-07-30T12:00:00.000Z",
		duedate: "2026-08-05",
		timeestimate: 3600,
		labels: ["inventory", "magic"],
		components: [{ name: "Dungeon" }, { name: "Laboratory" }],
		customfield_10090: "8",
		customfield_boolean: "yes",
	},
};

describe("safe Jira path lookup", () => {
	it("supports nested properties, indexes, and array projection", () => {
		expect(getJiraValueByPath(issue, "fields.status.name")).toBe("Doing");
		expect(getJiraValueByPath(issue, "fields.components[1].name")).toBe("Laboratory");
		expect(getJiraValueByPath(issue, "fields.components[].name")).toEqual([
			"Dungeon",
			"Laboratory",
		]);
	});

	it.each([
		"__proto__.polluted",
		"constructor.prototype",
		"fields.__proto__.polluted",
		"fields[nope].summary",
	])("rejects unsafe or malformed path %s", (path) => {
		expect(getJiraValueByPath(issue, path)).toBeUndefined();
	});

	it("never reads inherited properties", () => {
		const inherited = Object.create({ secret: "not allowed" }) as Record<string, unknown>;
		inherited.own = "allowed";

		expect(getJiraValueByPath(inherited, "own")).toBe("allowed");
		expect(getJiraValueByPath(inherited, "secret")).toBeUndefined();
	});
});

describe("Jira templates", () => {
	it("renders aliases, paths, arrays, missing values, and escaped newlines", () => {
		expect(
			renderJiraTemplate(
				"$key $summary\\n$fields.components[].name $fields.missing",
				issue
			)
		).toBe("MAGIC-17 Audit enchanted broom inventory\nDungeon, Laboratory");
	});

	it("leaves malformed token syntax as literal text", () => {
		expect(renderJiraTemplate("Cost is $ and ${fields.summary}", issue)).toBe(
			"Cost is $ and ${fields.summary}"
		);
	});
});

describe("configurable Jira mapping", () => {
	it("supports fixed, path, and template scalar sources", () => {
		const settings = createDefaultJiraMappingSettings();
		settings.fields.title = [
			{ mode: "template", value: "[$key] $fields.summary" },
		];
		settings.fields.status = [{ mode: "fixed", value: "open" }];
		settings.fields.due = [{ mode: "path", value: "fields.duedate" }];

		expect(mapJiraIssueWithSettings(issue, settings, [])).toEqual(
			expect.objectContaining({
				title: "[MAGIC-17] Audit enchanted broom inventory",
				status: "open",
				due: "2026-08-05",
			})
		);
	});

	it("merges, flattens, trims, and deduplicates list sources", () => {
		const settings = createDefaultJiraMappingSettings();
		settings.fields.contexts = [
			{ mode: "path", value: "fields.components[].name" },
			{ mode: "fixed", value: " Laboratory " },
		];
		settings.fields.tags = [
			{ mode: "path", value: "fields.labels" },
			{ mode: "fixed", value: "demo" },
		];

		expect(mapJiraIssueWithSettings(issue, settings, [])).toEqual(
			expect.objectContaining({
				contexts: ["Dungeon", "Laboratory"],
				tags: ["inventory", "magic", "demo"],
			})
		);
	});

	it("remaps enum values case-insensitively and preserves unmatched values", () => {
		const settings = createDefaultJiraMappingSettings();
		settings.fields.contexts = [
			{ mode: "path", value: "fields.components[].name" },
		];
		settings.enumRemaps.status = [
			{ taskValue: "in-progress", jiraValues: ["In Progress", "doing"] },
		];
		settings.enumRemaps.priority = [
			{ taskValue: "high", jiraValues: ["major"] },
		];
		settings.enumRemaps.contexts = [
			{ taskValue: "lab", jiraValues: ["laboratory"] },
		];

		expect(mapJiraIssueWithSettings(issue, settings, [])).toEqual(
			expect.objectContaining({
				status: "in-progress",
				priority: "high",
				contexts: ["Dungeon", "lab"],
			})
		);
	});

	it("uses stable user-field IDs and current frontmatter keys with type coercion", () => {
		const settings = createDefaultJiraMappingSettings();
		settings.userFields.storyPoints = [
			{ mode: "path", value: "fields.customfield_10090" },
		];
		settings.userFields.requiresWand = [
			{ mode: "path", value: "fields.customfield_boolean" },
		];
		const userFields: UserMappedField[] = [
			{
				id: "storyPoints",
				displayName: "Story points",
				key: "renamed_points_key",
				type: "number",
			},
			{
				id: "requiresWand",
				displayName: "Requires wand",
				key: "requires_wand",
				type: "boolean",
			},
		];

		expect(mapJiraIssueWithSettings(issue, settings, userFields).customFrontmatter).toEqual({
			renamed_points_key: 8,
			requires_wand: true,
		});
	});

	it("drops invalid dates and numbers instead of writing surprising values", () => {
		const settings = createDefaultJiraMappingSettings();
		settings.fields.due = [{ mode: "fixed", value: "not-a-date" }];
		settings.fields.timeEstimate = [{ mode: "fixed", value: "not-a-number" }];

		expect(mapJiraIssueWithSettings(issue, settings, [])).toEqual(
			expect.objectContaining({
				due: undefined,
				timeEstimate: undefined,
			})
		);
	});

	it("distinguishes resolved, empty, missing, and invalid preview values", () => {
		const settings = createDefaultJiraMappingSettings();
		settings.fields.due = [{ mode: "fixed", value: "not-a-date" }];
		settings.fields.projects = [{ mode: "path", value: "fields.emptyProjects" }];
		settings.fields.contexts = [{ mode: "path", value: "fields.missing" }];
		const issueWithEmptyList = {
			...issue,
			fields: { ...issue.fields, emptyProjects: [] },
		};

		const preview = buildJiraMappingPreview(issueWithEmptyList, settings, []);

		expect(preview).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: "title", status: "value" }),
				expect.objectContaining({ id: "projects", status: "empty", value: [] }),
				expect.objectContaining({ id: "contexts", status: "missing" }),
				expect.objectContaining({ id: "due", status: "invalid" }),
			])
		);
	});
});

describe("Jira issue backlinks", () => {
	it("builds a credential-free browser URL from the Jira account host", () => {
		const hostedIssue: JiraIssue = {
			...issue,
			account: {
				host: "https://wizard:secret@magic.atlassian.net/jira?token=hidden",
			},
		};

		expect(buildJiraIssueBacklink(hostedIssue)).toBe(
			"[Jira MAGIC-17](<https://magic.atlassian.net/browse/MAGIC-17>)"
		);
	});

	it("falls back to the companion plugin macro for missing or unsafe hosts", () => {
		expect(
			buildJiraIssueBacklink({
				...issue,
				account: { host: "javascript:alert(1)" },
			})
		).toBe("JIRA:MAGIC-17");
		expect(buildJiraIssueBacklink(issue)).toBe("JIRA:MAGIC-17");
	});

	it("preserves mapped details and does not duplicate backlinks on retries", () => {
		const first = prependJiraIssueBacklink("Keep these details.", issue);
		const second = prependJiraIssueBacklink(first, issue);

		expect(first).toBe("JIRA:MAGIC-17\n\nKeep these details.");
		expect(second).toBe(first);
	});
});

describe("Jira mapping settings normalization", () => {
	it("fills malformed or missing settings from versioned defaults", () => {
		const normalized = normalizeJiraMappingSettings({
			version: 99,
			fields: {
				title: [{ mode: "unknown", value: 42 }],
				tags: "not-an-array",
			},
			userFields: {
				__proto__: [{ mode: "path", value: "unsafe" }],
				valid: [{ mode: "fixed", value: "ok" }],
			},
		});

		expect(normalized.version).toBe(1);
		expect(normalized.fields.title).toEqual(
			createDefaultJiraMappingSettings().fields.title
		);
		expect(normalized.fields.tags).toEqual(
			createDefaultJiraMappingSettings().fields.tags
		);
		expect(normalized.userFields).toEqual({
			valid: [{ mode: "fixed", value: "ok" }],
		});
	});

	it("upgrades the legacy unversioned field and enum-map shape", () => {
		const legacy = {
			title: { mode: "template", value: "$key: $summary" },
			tags: [{ mode: "path", value: "fields.labels" }],
			statusMap: [{ taskValue: "done", jiraValues: ["Closed"] }],
		};

		const normalized = normalizeJiraMappingSettings(legacy);

		expect(normalized.fields.title).toEqual([
			{ mode: "template", value: "$key: $summary" },
		]);
		expect(normalized.fields.tags).toEqual([
			{ mode: "path", value: "fields.labels" },
		]);
		expect(normalized.enumRemaps.status).toEqual([
			{ taskValue: "done", jiraValues: ["Closed"] },
		]);
	});

	it("normalizes a fully configured versioned shape without losing sources", () => {
		const settings: JiraFieldMappingSettings = createDefaultJiraMappingSettings();
		settings.fields.projects = [
			{ mode: "path", value: "fields.project.name" },
			{ mode: "fixed", value: "[[Imported work]]" },
		];

		expect(normalizeJiraMappingSettings(settings).fields.projects).toEqual(
			settings.fields.projects
		);
	});
});
