import {
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
});
