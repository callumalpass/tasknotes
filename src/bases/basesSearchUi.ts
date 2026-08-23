import { SearchBox } from "./components/SearchBox";
import { TaskSearchFilter } from "./TaskSearchFilter";
import { createElementInDocument } from "../utils/documentDom";

export type BasesSearchControls = {
	searchContainer: HTMLElement;
	searchBox: SearchBox;
	searchFilter: TaskSearchFilter;
};

export type CreateBasesSearchControlsOptions = {
	container: HTMLElement;
	visibleProperties: readonly string[];
	currentSearchTerm: string;
	onSearch: (term: string) => void;
	debounceMs?: number;
};

export function createBasesSearchControls({
	container,
	visibleProperties,
	currentSearchTerm,
	onSearch,
	debounceMs = 300,
}: CreateBasesSearchControlsOptions): BasesSearchControls {
	const doc = container.ownerDocument;
	const searchContainer = createElementInDocument(doc, "div");
	searchContainer.className = "tn-search-container";

	if (container.firstChild) {
		container.insertBefore(searchContainer, container.firstChild);
	} else {
		container.appendChild(searchContainer);
	}

	const searchFilter = new TaskSearchFilter([...visibleProperties]);
	const searchBox = new SearchBox(searchContainer, onSearch, debounceMs);
	searchBox.render();

	if (currentSearchTerm) {
		searchBox.setValue(currentSearchTerm);
	}

	return {
		searchContainer,
		searchBox,
		searchFilter,
	};
}

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

	const noResultsEl = createElementInDocument(doc, "div");
	noResultsEl.className = "tn-search-no-results";

	const textEl = createElementInDocument(doc, "div");
	textEl.className = "tn-search-no-results__text";
	textEl.textContent = `No tasks match "${searchTerm}"`;

	const hintEl = createElementInDocument(doc, "div");
	hintEl.className = "tn-search-no-results__hint";
	hintEl.textContent = "Try a different search term or clear the search";

	noResultsEl.appendChild(textEl);
	noResultsEl.appendChild(hintEl);
	container.appendChild(noResultsEl);

	return noResultsEl;
}
