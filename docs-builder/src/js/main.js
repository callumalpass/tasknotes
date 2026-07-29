/* TaskNotes documentation client behavior. */

(() => {
	"use strict";

	const root = document.documentElement;
	const themeSelect = document.getElementById("js-theme");
	const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

	function themePreference() {
		const stored = localStorage.getItem("mdbase:theme");
		return stored === "light" || stored === "dark" ? stored : "system";
	}

	function applyTheme(preference) {
		const resolved =
			preference === "system" ? (systemTheme.matches ? "dark" : "light") : preference;
		root.dataset.theme = resolved;
		root.dataset.themePreference = preference;
		root.style.colorScheme = resolved;
		if (preference === "system") localStorage.removeItem("mdbase:theme");
		else localStorage.setItem("mdbase:theme", preference);
		if (themeSelect) themeSelect.value = preference;
		const themeColor = document.querySelector('meta[name="theme-color"]');
		themeColor?.setAttribute("content", resolved === "dark" ? "#1b1d22" : "#fcfcfd");
		window.dispatchEvent(
			new CustomEvent("mdbase:themechange", { detail: { preference, resolved } })
		);
	}

	applyTheme(themePreference());
	themeSelect?.addEventListener("change", () => applyTheme(themeSelect.value));
	systemTheme.addEventListener("change", () => {
		if (themePreference() === "system") applyTheme("system");
	});

	// Collapsible navigation groups
	document.querySelectorAll(".nav-section__toggle").forEach((button) => {
		button.addEventListener("click", () => {
			const section = button.closest(".nav-section");
			const isOpen = section?.classList.toggle("is-open") ?? false;
			button.setAttribute("aria-expanded", String(isOpen));
		});
	});

	// Mobile navigation dialog behavior
	const sidebar = document.getElementById("js-sidebar");
	const menuButton = document.getElementById("js-menu");
	const closeButton = document.getElementById("js-menu-close");
	const overlay = document.getElementById("js-overlay");
	const mobileQuery = window.matchMedia("(max-width: 48rem)");
	let returnFocus = null;

	function focusableInSidebar() {
		if (!sidebar) return [];
		return [...sidebar.querySelectorAll('a[href], button:not([disabled]), select, [tabindex="0"]')];
	}

	function setSidebarMode() {
		if (!sidebar) return;
		sidebar.inert = mobileQuery.matches && !sidebar.classList.contains("is-open");
	}

	function openNavigation() {
		if (!sidebar || !mobileQuery.matches) return;
		returnFocus = document.activeElement;
		sidebar.classList.add("is-open");
		sidebar.inert = false;
		overlay?.classList.add("is-visible");
		menuButton?.setAttribute("aria-expanded", "true");
		document.body.classList.add("is-nav-open");
		window.setTimeout(() => closeButton?.focus(), 0);
	}

	function closeNavigation({ restoreFocus = true } = {}) {
		if (!sidebar) return;
		sidebar.classList.remove("is-open");
		overlay?.classList.remove("is-visible");
		menuButton?.setAttribute("aria-expanded", "false");
		document.body.classList.remove("is-nav-open");
		setSidebarMode();
		if (restoreFocus && returnFocus instanceof HTMLElement) returnFocus.focus();
	}

	menuButton?.addEventListener("click", openNavigation);
	closeButton?.addEventListener("click", () => closeNavigation());
	overlay?.addEventListener("click", () => closeNavigation());
	sidebar?.querySelectorAll(".nav-link").forEach((link) => {
		link.addEventListener("click", () => closeNavigation({ restoreFocus: false }));
	});
	mobileQuery.addEventListener("change", () => {
		if (!mobileQuery.matches) closeNavigation({ restoreFocus: false });
		setSidebarMode();
	});
	setSidebarMode();

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && sidebar?.classList.contains("is-open")) {
			event.preventDefault();
			closeNavigation();
			return;
		}
		if (event.key !== "Tab" || !sidebar?.classList.contains("is-open")) return;
		const focusable = focusableInSidebar();
		if (!focusable.length) return;
		const first = focusable[0];
		const last = focusable.at(-1);
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	});

	// Code-copy controls stay visible for keyboard and touch users.
	document.querySelectorAll(".prose pre").forEach((pre) => {
		const button = document.createElement("button");
		button.className = "copy-btn";
		button.type = "button";
		button.setAttribute("aria-label", "Copy code");
		button.textContent = "Copy";
		pre.appendChild(button);

		button.addEventListener("click", async () => {
			const code = pre.querySelector("code");
			try {
				await navigator.clipboard.writeText(code ? code.textContent : pre.textContent);
				button.textContent = "Copied";
				button.classList.add("is-copied");
			} catch {
				button.textContent = "Copy failed";
			}
			window.setTimeout(() => {
				button.textContent = "Copy";
				button.classList.remove("is-copied");
			}, 1600);
		});
	});

	// Current page-section indicator
	const tocLinks = [...document.querySelectorAll(".toc a")];
	const headings = [...document.querySelectorAll(".prose h2[id], .prose h3[id]")];
	if (tocLinks.length && headings.length) {
		let queued = false;
		const updateToc = () => {
			queued = false;
			let active = headings[0];
			const top = window.scrollY + 100;
			for (const heading of headings) {
				if (heading.offsetTop <= top) active = heading;
			}
			for (const link of tocLinks) {
				link.classList.toggle("is-active", link.hash === `#${active.id}`);
			}
		};
		window.addEventListener(
			"scroll",
			() => {
				if (queued) return;
				queued = true;
				window.requestAnimationFrame(updateToc);
			},
			{ passive: true }
		);
		updateToc();
	}

	// Client-side documentation search
	const searchDialog = document.getElementById("js-search");
	const searchOpen = document.getElementById("js-search-open");
	const searchClose = document.getElementById("js-search-close");
	const searchInput = document.getElementById("js-search-input");
	const searchResults = document.getElementById("js-search-results");
	const searchStatus = document.getElementById("js-search-status");
	let searchIndex;
	let searchReturnFocus;

	async function loadSearchIndex() {
		if (!searchIndex) {
			const response = await fetch("/search-index.json");
			if (!response.ok) throw new Error(`Search index request failed: ${response.status}`);
			searchIndex = await response.json();
		}
		return searchIndex;
	}

	function scorePage(page, terms) {
		const title = page.title.toLowerCase();
		const description = page.description.toLowerCase();
		const text = page.text.toLowerCase();
		let score = 0;
		for (const term of terms) {
			if (!text.includes(term) && !title.includes(term) && !description.includes(term)) {
				return 0;
			}
			if (title === term) score += 100;
			else if (title.includes(term)) score += 30;
			if (description.includes(term)) score += 10;
			score += Math.min(6, text.split(term).length - 1);
		}
		return score;
	}

	function renderSearchResults(results, query) {
		searchResults.replaceChildren();
		if (!results.length) {
			searchStatus.textContent = `No results for “${query}”.`;
			return;
		}
		searchStatus.textContent = `${results.length} result${results.length === 1 ? "" : "s"}.`;
		for (const page of results) {
			const item = document.createElement("li");
			const link = document.createElement("a");
			const title = document.createElement("strong");
			const description = document.createElement("span");
			link.href = page.url;
			title.textContent = page.title;
			description.textContent = page.description;
			link.append(title, description);
			item.append(link);
			searchResults.append(item);
		}
	}

	async function runSearch() {
		const query = searchInput.value.trim();
		if (query.length < 2) {
			searchResults.replaceChildren();
			searchStatus.textContent = "Type at least two characters.";
			return;
		}
		searchStatus.textContent = "Searching…";
		try {
			const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
			const pages = await loadSearchIndex();
			const results = pages
				.map((page) => ({ page, score: scorePage(page, terms) }))
				.filter((result) => result.score > 0)
				.sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title))
				.slice(0, 12)
				.map((result) => result.page);
			renderSearchResults(results, query);
		} catch {
			searchStatus.textContent = "Search is unavailable. Try the navigation instead.";
		}
	}

	function showSearch() {
		if (!searchDialog) return;
		searchReturnFocus = document.activeElement;
		searchDialog.showModal();
		window.setTimeout(() => searchInput?.focus(), 0);
	}

	function hideSearch() {
		searchDialog?.close();
		if (searchReturnFocus instanceof HTMLElement) searchReturnFocus.focus();
	}

	searchOpen?.addEventListener("click", showSearch);
	searchClose?.addEventListener("click", hideSearch);
	searchDialog?.addEventListener("click", (event) => {
		if (event.target === searchDialog) hideSearch();
	});
	searchDialog?.addEventListener("close", () => {
		searchInput.value = "";
		searchResults.replaceChildren();
		searchStatus.textContent = "Type at least two characters.";
	});
	searchInput?.addEventListener("input", runSearch);
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && searchDialog?.open) {
			event.preventDefault();
			hideSearch();
			return;
		}
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
			event.preventDefault();
			searchDialog?.open ? hideSearch() : showSearch();
		}
	});
})();
