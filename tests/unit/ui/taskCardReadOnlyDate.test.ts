import { renderBasesValue } from "../../../src/ui/taskCardPresentation";
import { DateValue } from "obsidian";

describe("card property dates", () => {
	it("renders native dates as read-only labels while preserving rich rendering for other values", () => {
		const date = Object.assign(Object.create(DateValue.prototype), {
			constructor: { name: "MinifiedNativeDate" },
			toString: () => "2026-11-05",
			renderTo: jest.fn((host: HTMLElement) => host.createEl("input", { type: "datetime-local" })),
		});
		const host = document.createElement("div");
		expect(renderBasesValue(host, date, {} as never)).toBe(true);
		expect(host.textContent).toBe("2026-11-05");
		expect(date.renderTo).not.toHaveBeenCalled();
		const link = { toString: () => "Project", renderTo: (element: HTMLElement) => element.createEl("a", { text: "Project" }) };
		renderBasesValue(host, link, {} as never);
		expect(host.querySelector("a")?.textContent).toBe("Project");
	});
});
