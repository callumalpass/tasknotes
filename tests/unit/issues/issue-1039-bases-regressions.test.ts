import { TFile } from "obsidian";
import { decorateRefreshCalendarsButton } from "../../../src/bases/CalendarView";
import { renderGroupTitle } from "../../../src/bases/groupTitleRenderer";
import type { LinkServices } from "../../../src/ui/renderers/linkRenderer";

function makeLinkServices(): LinkServices {
	const nestedProject = new TFile("Projects/Client Alpha/Roadmap.md");
	return {
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

	it("renders the TaskNotes Calendar refresh control as an icon button", () => {
		const container = document.createElement("div");
		const button = container.createEl("button", {
			cls: "fc-refreshCalendars-button",
			text: "Refresh",
		});

		decorateRefreshCalendarsButton(container, "Refresh calendar subscriptions");

		expect(button.textContent).toBe("");
		expect(button.getAttribute("data-icon")).toBe("refresh-cw");
		expect(button.classList.contains("tasknotes-calendar-refresh-button--icon")).toBe(true);
		expect(button.getAttribute("aria-label")).toBe("Refresh calendar subscriptions");
		expect(button.getAttribute("title")).toBe("Refresh calendar subscriptions");
	});
});
