import { setTaskModalDetailsCollapsed } from "../../../src/modals/taskModalLayout";

describe("taskModalLayout", () => {
	it("collapses optional fields without hiding the composer details editor", () => {
		const detailsContainer = document.createElement("div");
		const splitRightColumn = document.createElement("div");
		const elements = { detailsContainer, splitRightColumn };

		setTaskModalDetailsCollapsed(elements, true);
		expect(detailsContainer.classList).toContain("tn-task-modal__section--collapsed");
		expect(splitRightColumn.classList).not.toContain("tn-task-modal__section--collapsed");

		setTaskModalDetailsCollapsed(elements, false);
		expect(detailsContainer.classList).not.toContain("tn-task-modal__section--collapsed");
		expect(splitRightColumn.classList).not.toContain("tn-task-modal__section--collapsed");
	});
});
