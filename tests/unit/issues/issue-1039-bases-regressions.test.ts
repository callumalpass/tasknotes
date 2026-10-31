import { createI18nService } from "../../../src/i18n";
import { TFile } from "obsidian";
import { renderGroupTitle } from "../../../src/bases/groupTitleRenderer";
import type { LinkServices } from "../../../src/ui/renderers/linkRenderer";

function makeLinkServices(): LinkServices {
	const nestedProject = new TFile("Projects/Client Alpha/Roadmap.md");
	return {
		translate: (key, params) => createI18nService().translate(key, params),
		metadataCache: {
			getFirstLinkpathDest: jest.fn((linkPath: string) =>
				linkPath === "Projects/Client Alpha/Roadmap" ? nestedProject : null
			),
			getCache: jest.fn(() => null),
		} as unknown as LinkServices["metadataCache"],
		workspace: {
			getLeaf: jest.fn(() => ({
				openFile: jest.fn(),
			})),
			openLinkText: jest.fn(),
			trigger: jest.fn(),
		} as unknown as LinkServices["workspace"],
	};
}

describe("Issue #1039: Bases beta regressions", () => {
	it("renders nested project path headings with the project basename", () => {
		const container = document.createElement("div");

		renderGroupTitle(container, "Projects/Client Alpha/Roadmap", makeLinkServices());

		const link = container.querySelector<HTMLAnchorElement>("a.task-group-link");
		expect(link).not.toBeNull();
		expect(link?.textContent).toBe("Roadmap");
		expect(link?.getAttribute("data-href")).toBe("Projects/Client Alpha/Roadmap");
	});
});
