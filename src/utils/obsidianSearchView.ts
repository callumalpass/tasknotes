type SearchInputLike = {
	value: string;
};

type ObsidianSearchViewLike = {
	setQuery?: (query: string) => void;
	searchComponent?: {
		setValue?: (query: string) => void;
	};
	searchInputEl?: SearchInputLike;
	startSearch?: () => void;
};

export function applySearchQueryToView(view: unknown, query: string): boolean {
	const searchView = view as ObsidianSearchViewLike;

	if (typeof searchView.setQuery === "function") {
		searchView.setQuery(query);
		return true;
	}

	if (typeof searchView.searchComponent?.setValue === "function") {
		searchView.searchComponent.setValue(query);
		return true;
	}

	if (searchView.searchInputEl) {
		searchView.searchInputEl.value = query;
		if (typeof searchView.startSearch === "function") {
			searchView.startSearch();
		}
		return true;
	}

	return false;
}
