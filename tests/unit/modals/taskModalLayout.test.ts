import {
	collapseTaskModalDetailsLayout,
	expandTaskModalDetailsLayout,
	shouldUseEditSidebarLayout,
	shouldUseSplitLayoutEnabledClass,
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

describe("shouldUseEditSidebarLayout", () => {
	it("uses the edit sidebar for desktop edit modals", () => {
		expect(
			shouldUseEditSidebarLayout({
				isEditMode: true,
				isCreationMode: false,
				isExpanded: false,
				isMobileLikeEnvironment: false,
			})
		).toBe(true);
	});

	it("uses the edit sidebar for expanded desktop creation modals", () => {
		expect(
			shouldUseEditSidebarLayout({
				isEditMode: false,
				isCreationMode: true,
				isExpanded: true,
				isMobileLikeEnvironment: false,
			})
		).toBe(true);
	});

	it("keeps collapsed desktop creation modals on the chip-row layout", () => {
		expect(
			shouldUseEditSidebarLayout({
				isEditMode: false,
				isCreationMode: true,
				isExpanded: false,
				isMobileLikeEnvironment: false,
			})
		).toBe(false);
	});

	it("never uses the edit sidebar on mobile-like environments", () => {
		expect(
			shouldUseEditSidebarLayout({
				isEditMode: true,
				isCreationMode: false,
				isExpanded: true,
				isMobileLikeEnvironment: true,
			})
		).toBe(false);
	});
});

describe("shouldUseSplitLayoutEnabledClass", () => {
	it("enables the legacy split layout on a wide desktop window when the setting is on", () => {
		expect(
			shouldUseSplitLayoutEnabledClass({
				enableModalSplitLayout: true,
				usesEditSidebarLayout: false,
				usesSheetLayout: false,
			})
		).toBe(true);
	});

	it("stays disabled when the setting is off", () => {
		expect(
			shouldUseSplitLayoutEnabledClass({
				enableModalSplitLayout: false,
				usesEditSidebarLayout: false,
				usesSheetLayout: false,
			})
		).toBe(false);
	});

	it("stays disabled for the desktop edit sidebar layout", () => {
		expect(
			shouldUseSplitLayoutEnabledClass({
				enableModalSplitLayout: true,
				usesEditSidebarLayout: true,
				usesSheetLayout: false,
			})
		).toBe(false);
	});

	it("never combines with the mobile/touch bottom-sheet layout, even on a wide viewport", () => {
		expect(
			shouldUseSplitLayoutEnabledClass({
				enableModalSplitLayout: true,
				usesEditSidebarLayout: false,
				usesSheetLayout: true,
			})
		).toBe(false);
	});
});
