/**
 * @see https://github.com/callumalpass/tasknotes/issues/1482
 */

import { describe, expect, it, jest } from "@jest/globals";
import { renderPropertyMetadata } from "../../../src/ui/taskCardProperties";
import type { TaskInfo } from "../../../src/types";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

function createPlugin() {
	const plugin = PluginFactory.createMockPlugin();
	plugin.settings.userFields = [
		{ id: "pr", key: "pr", displayName: "PR", type: "text" },
		{ id: "links", key: "links", displayName: "Links", type: "list" },
	];
	plugin.fieldMapper.lookupMappingKey = jest.fn(() => undefined);
	return plugin;
}

describe("issue #1482 custom field links", () => {
	it("renders bare external URLs in text custom fields as clickable links", () => {
		const container = document.createElement("div");
		const plugin = createPlugin();
		const task = {
			...TaskFactory.createTask({ path: "Tasks/External.md" }),
			pr: "https://github.com/callumalpass/tasknotes/pull/1482",
		} as TaskInfo;

		const property = renderPropertyMetadata(container, "user:pr", task, plugin);

		const link = property?.querySelector<HTMLAnchorElement>("a.external-link");
		expect(link).not.toBeNull();
		expect(link?.textContent).toBe("https://github.com/callumalpass/tasknotes/pull/1482");
		expect(link?.getAttribute("href")).toBe(
			"https://github.com/callumalpass/tasknotes/pull/1482"
		);
	});

	it("renders internal and external links in list custom fields", () => {
		const container = document.createElement("div");
		const plugin = createPlugin();
		const task = {
			...TaskFactory.createTask({ path: "Tasks/References.md" }),
			links: ["[[Project Brief]]", "<https://example.com/spec>"],
		} as TaskInfo;

		const property = renderPropertyMetadata(container, "user:links", task, plugin);

		const internalLink = property?.querySelector<HTMLAnchorElement>("a.internal-link");
		expect(internalLink).not.toBeNull();
		expect(internalLink?.textContent).toBe("Project Brief");
		expect(internalLink?.getAttribute("data-href")).toBe("Project Brief");

		const externalLink = property?.querySelector<HTMLAnchorElement>("a.external-link");
		expect(externalLink).not.toBeNull();
		expect(externalLink?.textContent).toBe("https://example.com/spec");
		expect(externalLink?.getAttribute("href")).toBe("https://example.com/spec");
	});
});
