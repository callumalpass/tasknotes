import {
	JiraIssueAdapter,
	JiraIssueAdapterError,
	normalizeJiraIssueKey,
} from "../../../src/integrations/jira/JiraIssueAdapter";

describe("JiraIssueAdapter", () => {
	it("normalizes valid issue keys", () => {
		expect(normalizeJiraIssueKey(" proj-123 ")).toBe("PROJ-123");
	});

	it("rejects invalid issue keys before resolving the plugin", async () => {
		const getPlugin = jest.fn();
		const adapter = new JiraIssueAdapter(getPlugin);

		await expect(adapter.getIssue("not an issue key")).rejects.toMatchObject({
			code: "invalid-issue-key",
		});
		expect(getPlugin).not.toHaveBeenCalled();
	});

	it("reports a missing or incompatible dependency", async () => {
		const adapter = new JiraIssueAdapter(() => null);

		await expect(adapter.getIssue("PROJ-123")).rejects.toMatchObject({
			code: "dependency-unavailable",
		});
	});

	it("wraps provider fetch failures", async () => {
		const providerError = new Error("network unavailable");
		const adapter = new JiraIssueAdapter(() => ({
			api: {
				base: {
					getIssue: jest.fn().mockRejectedValue(providerError),
				},
			},
		}));

		await expect(adapter.getIssue("PROJ-123")).rejects.toMatchObject({
			code: "fetch-failed",
			cause: providerError,
		});
	});

	it("rejects malformed provider responses", async () => {
		const adapter = new JiraIssueAdapter(() => ({
			api: {
				base: {
					getIssue: jest.fn().mockResolvedValue({ key: "PROJ-123", fields: {} }),
				},
			},
		}));

		await expect(adapter.getIssue("PROJ-123")).rejects.toBeInstanceOf(
			JiraIssueAdapterError
		);
		await expect(adapter.getIssue("PROJ-123")).rejects.toMatchObject({
			code: "invalid-response",
		});
	});

	it("fetches a validated issue with the normalized key", async () => {
		const issue = {
			key: "PROJ-123",
			fields: { summary: "Conjure release notes" },
		};
		const getIssue = jest.fn().mockResolvedValue(issue);
		const adapter = new JiraIssueAdapter(() => ({
			api: { base: { getIssue } },
		}));

		await expect(adapter.getIssue("proj-123")).resolves.toBe(issue);
		expect(getIssue).toHaveBeenCalledTimes(1);
		expect(getIssue).toHaveBeenCalledWith("PROJ-123");
	});
});

