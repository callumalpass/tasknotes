export function isBasesSearchWithNoResults(
	searchTerm: string,
	filteredCount: number,
	originalCount: number
): boolean {
	return searchTerm.length > 0 && filteredCount === 0 && originalCount > 0;
}

export function renderBasesSearchNoResults(
	container: HTMLElement,
	searchTerm: string
): HTMLElement {
	const doc = container.ownerDocument;

	const noResultsEl = doc.createElement("div");
	noResultsEl.className = "tn-search-no-results";

	const textEl = doc.createElement("div");
	textEl.className = "tn-search-no-results__text";
	textEl.textContent = `No tasks match "${searchTerm}"`;

	const hintEl = doc.createElement("div");
	hintEl.className = "tn-search-no-results__hint";
	hintEl.textContent = "Try a different search term or clear the search";

	noResultsEl.appendChild(textEl);
	noResultsEl.appendChild(hintEl);
	container.appendChild(noResultsEl);

	return noResultsEl;
}
