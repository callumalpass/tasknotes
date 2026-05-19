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

		const result = renderBasesSearchNoResults(container, "<client>");

		expect(result.className).toBe("tn-search-no-results");
		expect(container.querySelector(".tn-search-no-results__text")?.textContent).toBe(
			'No tasks match "<client>"'
		);
		expect(container.querySelector(".tn-search-no-results__hint")?.textContent).toBe(
			"Try a different search term or clear the search"
		);
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
