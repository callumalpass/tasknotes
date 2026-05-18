import {
	collapseTaskModalDetailsLayout,
	expandTaskModalDetailsLayout,
} from "../../../src/modals/taskModalLayout";

describe("taskModalLayout", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("collapses the details and right-column layout surfaces", () => {
		const detailsContainer = document.createElement("div");
		const splitRightColumn = document.createElement("div");
		detailsContainer.classList.add(
			"tn-static-display-block-2a1b75c9",
			"tn-static-min-height-800px-997b4c8c"
		);
		splitRightColumn.classList.add(
			"tn-static-display-flex-4d51fc62",
			"tn-static-min-height-800px-997b4c8c"
		);

		collapseTaskModalDetailsLayout({ detailsContainer, splitRightColumn });

		expect(detailsContainer.classList.contains("tn-static-display-block-2a1b75c9")).toBe(
			false
		);
		expect(splitRightColumn.classList.contains("tn-static-display-flex-4d51fc62")).toBe(
			false
		);
		expect(detailsContainer.classList.contains("tn-static-display-none-6b99de8b")).toBe(
			true
		);
		expect(splitRightColumn.classList.contains("tn-static-display-none-6b99de8b")).toBe(
			true
		);
	});

	it("expands the details layout, reveals the right column, and completes animation classes", () => {
		const containerEl = document.createElement("div");
		const detailsContainer = document.createElement("div");
		const splitRightColumn = document.createElement("div");
		detailsContainer.classList.add(
			"tn-static-display-none-6b99de8b",
			"tn-static-opacity-1-c6e7979d",
			"tn-static-transform-translatey-0-1b976432"
		);
		splitRightColumn.classList.add("tn-static-display-none-6b99de8b");
		splitRightColumn.style.display = "none";

		expandTaskModalDetailsLayout({
			containerEl,
			detailsContainer,
			splitRightColumn,
			timerWindow: window,
		});

		expect(containerEl.classList.contains("expanded")).toBe(true);
		expect(detailsContainer.classList.contains("tn-static-display-none-6b99de8b")).toBe(
			false
		);
		expect(detailsContainer.classList.contains("tn-static-display-block-2a1b75c9")).toBe(
			true
		);
		expect(splitRightColumn.classList.contains("tn-static-display-none-6b99de8b")).toBe(
			false
		);
		expect(splitRightColumn.style.display).toBe("");
		expect(detailsContainer.classList.contains("tn-static-opacity-0-8d919cb5")).toBe(
			true
		);
		expect(
			detailsContainer.classList.contains("tn-static-transform-translatey-10px-5b91bf02")
		).toBe(true);

		jest.advanceTimersByTime(50);

		expect(detailsContainer.classList.contains("tn-static-opacity-0-8d919cb5")).toBe(
			false
		);
		expect(detailsContainer.classList.contains("tn-static-opacity-1-c6e7979d")).toBe(true);
		expect(
			detailsContainer.classList.contains("tn-static-transform-translatey-10px-5b91bf02")
		).toBe(false);
		expect(
			detailsContainer.classList.contains("tn-static-transform-translatey-0-1b976432")
		).toBe(true);
	});
});
