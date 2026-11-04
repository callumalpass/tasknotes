import { renderBasesValue } from "../../../src/ui/taskCardPresentation";

describe("card property dates", () => {
	it("renders native dates as read-only labels while preserving rich rendering for other values", () => {
		class DateValue {
			toString() { return "2026-11-05"; }
			renderTo = jest.fn((host: HTMLElement) => host.createEl("input", { type: "date" }));
		}
		const date = new DateValue();
		const host = document.createElement("div");
		expect(renderBasesValue(host, date, {} as never)).toBe(true);
		expect(host.textContent).toBe("2026-11-05");
		expect(date.renderTo).not.toHaveBeenCalled();
		const link = { toString: () => "Project", renderTo: (element: HTMLElement) => element.createEl("a", { text: "Project" }) };
		renderBasesValue(host, link, {} as never);
		expect(host.querySelector("a")?.textContent).toBe("Project");
	});
});
