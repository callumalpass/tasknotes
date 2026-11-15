import {
	createBasesSearchControls,
	isBasesSearchWithNoResults,
	renderBasesSearchNoResults,
} from "../../../src/bases/basesSearchUi";

describe("Bases search UI helpers", () => {
	it("detects search no-result states only for active searches with original tasks", () => {
		expect(isBasesSearchWithNoResults("client", 0, 3)).toBe(true);
		expect(isBasesSearchWithNoResults("", 0, 3)).toBe(false);
		expect(isBasesSearchWithNoResults("client", 1, 3)).toBe(false);
		expect(isBasesSearchWithNoResults("client", 0, 0)).toBe(false);
	});

	it("renders the no-results message without treating the search term as markup", () => {
		const container = document.createElement("div");

		const onClear = jest.fn();
		const result = renderBasesSearchNoResults(container, "<client>", onClear);

		expect(result.classList.contains("tn-search-no-results")).toBe(true);
		expect(container.querySelector(".tn-empty__message")?.textContent).toBe(
			'No tasks match "<client>"'
		);
		const button = container.querySelector("button");
		expect(button?.textContent).toContain("Clear search");
		button?.click();
		expect(onClear).toHaveBeenCalledTimes(1);
		button?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		expect(onClear).toHaveBeenCalledTimes(2);
		expect(container.querySelector("client")).toBeNull();
	});

	it("creates search controls at the top of the container and restores the term", () => {
		const container = document.createElement("div");
		const existingContent = document.createElement("section");
		container.appendChild(existingContent);
		const onSearch = jest.fn();

		const controls = createBasesSearchControls({
			container,
			visibleProperties: ["client"],
			currentSearchTerm: "alpha",
			onSearch,
			debounceMs: 0,
		});

		expect(container.firstElementChild).toBe(controls.searchContainer);
		expect(controls.searchContainer.nextElementSibling).toBe(existingContent);
		expect(controls.searchBox.getValue()).toBe("alpha");
		expect(
			controls.searchFilter.filterTasks(
				[
					{
						title: "Visible task",
						status: "open",
						priority: "normal",
						customProperties: { client: "Alpha" },
					} as never,
				],
				"alpha"
			)
		).toHaveLength(1);
	});
});
