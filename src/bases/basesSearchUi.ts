import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import { SearchBox } from "./components/SearchBox";
import { TaskSearchFilter } from "./TaskSearchFilter";
import { createElementInDocument } from "../utils/documentDom";
import { renderEmptyState } from "../ui/kit/emptyState";

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
	searchTerm: string,
	onClear?: () => void
): HTMLElement {
	const empty = renderEmptyState(container, {
		message: uiText(msg({ message: "No tasks match \"{searchTerm}\"", context: "bases/basesSearchUi: renderBasesSearchNoResults display" }), { searchTerm }),
		actionLabel: uiText(msg({ message: "Clear search", context: "empty state action" })),
		actionKey: "Escape",
		onAction: onClear,
	});
	empty.addClass("tn-search-no-results");
	empty.addEventListener("keydown", (event) => {
		if (event.key !== "Escape" || !onClear) return;
		event.preventDefault();
		onClear();
	});
	return empty;
}
