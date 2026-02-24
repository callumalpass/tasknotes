/**
 * PersonGroupPicker - Reusable multi-select component for people and groups.
 *
 * Features:
 * - Searchable input with debounce
 * - Multi-select with pills/chips showing selected items
 * - Grouped dropdown (People section + Groups section)
 * - Avatar integration for each option
 * - Single or multi-select mode
 */

import { setIcon } from "obsidian";
import { PersonNoteInfo } from "../identity/PersonNoteService";
import { GroupNoteMapping } from "../identity/GroupRegistry";
import { createAvatar, getColorFromName } from "./PersonAvatar";

export interface PersonGroupPickerOptions {
	/** Container element to render into */
	container: HTMLElement;
	/** Available persons to select from */
	persons: PersonNoteInfo[];
	/** Available groups to select from */
	groups: GroupNoteMapping[];
	/** Allow selecting multiple items (default: true) */
	multiSelect?: boolean;
	/** Placeholder text for search input */
	placeholder?: string;
	/** Initially selected paths */
	initialSelection?: string[];
	/** Callback when selection changes */
	onChange?: (selectedPaths: string[]) => void;
	/** Callback when user clicks "Open settings" in empty state guidance */
	onConfigureClick?: () => void;
}

export interface PickerItem {
	path: string;
	displayName: string;
	type: "person" | "group";
	subtitle?: string;
}

/**
 * Create a PersonGroupPicker component.
 */
export function createPersonGroupPicker(options: PersonGroupPickerOptions): {
	getSelection: () => string[];
	setSelection: (paths: string[]) => void;
	closeDropdown: () => void;
	destroy: () => void;
} {
	const {
		container,
		persons,
		groups,
		multiSelect = true,
		placeholder = "Search people or groups...",
		initialSelection = [],
		onChange,
		onConfigureClick,
	} = options;

	// State
	let selectedPaths: Set<string> = new Set(initialSelection);
	let searchQuery = "";
	let isDropdownOpen = false;

	// Convert to unified items
	const allItems: PickerItem[] = [
		...persons.map(p => ({
			path: p.path,
			displayName: p.displayName,
			type: "person" as const,
			subtitle: p.role || p.department,
		})),
		...groups.map(g => ({
			path: g.notePath,
			displayName: g.displayName,
			type: "group" as const,
			subtitle: `${g.memberPaths.length} members`,
		})),
	];

	// Create DOM structure
	container.empty();
	container.addClass("tn-person-group-picker");

	// Selected items container (pills)
	const selectedContainer = container.createDiv({ cls: "tn-pgp-selected" });

	// Search input container
	const inputContainer = container.createDiv({ cls: "tn-pgp-input-container" });
	const searchInput = inputContainer.createEl("input", {
		cls: "tn-pgp-search",
		attr: {
			type: "text",
			placeholder,
		},
	});

	// Dropdown container - appended to body to escape modal overflow
	const dropdown = document.body.createDiv({ cls: "tn-pgp-dropdown" });
	dropdown.style.display = "none";

	// Render functions
	function renderSelectedPills() {
		selectedContainer.empty();

		if (selectedPaths.size === 0) {
			return;
		}

		for (const path of selectedPaths) {
			const item = allItems.find(i => i.path === path);
			if (!item) continue;

			const pill = selectedContainer.createDiv({ cls: "tn-pgp-pill" });

			// Avatar
			const avatar = createAvatar({
				name: item.displayName,
				size: "xs",
				isGroup: item.type === "group",
			});
			pill.appendChild(avatar);

			// Name
			pill.createSpan({ cls: "tn-pgp-pill-name", text: item.displayName });

			// Remove button
			const removeBtn = pill.createSpan({ cls: "tn-pgp-pill-remove" });
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				selectedPaths.delete(path);
				renderSelectedPills();
				renderDropdown();
				notifyChange();
			});
		}
	}

	function renderDropdown() {
		dropdown.empty();

		const query = searchQuery.toLowerCase();
		const filteredItems = allItems.filter(item => {
			// Exclude already selected in multi-select mode
			if (multiSelect && selectedPaths.has(item.path)) return false;
			// Filter by search query
			if (query && !item.displayName.toLowerCase().includes(query)) return false;
			return true;
		});

		// Group by type
		const personItems = filteredItems.filter(i => i.type === "person");
		const groupItems = filteredItems.filter(i => i.type === "group");

		if (filteredItems.length === 0) {
			const emptyMsg = dropdown.createDiv({ cls: "tn-pgp-empty" });
			if (query) {
				emptyMsg.textContent = "No matches found";
			} else if (allItems.length === 0) {
				// No persons or groups configured at all — show guidance
				emptyMsg.createDiv({ cls: "tn-pgp-empty-title", text: "No person or group notes found" });
				const hint = emptyMsg.createDiv({ cls: "tn-pgp-empty-hint" });
				hint.textContent = "Configure person notes folder and type property in ";
				if (onConfigureClick) {
					const link = hint.createEl("a", { text: "Settings \u2192 Team & Attribution" });
					link.style.cssText = "cursor: pointer; color: var(--text-accent)";
					link.addEventListener("click", (e) => {
						e.preventDefault();
						e.stopPropagation();
						onConfigureClick();
					});
				} else {
					hint.appendText("Settings \u2192 Team & Attribution");
				}
			} else {
				emptyMsg.textContent = "No options available";
			}
			return;
		}

		// People section
		if (personItems.length > 0) {
			const section = dropdown.createDiv({ cls: "tn-pgp-section" });
			section.createDiv({ cls: "tn-pgp-section-header", text: "People" });

			for (const item of personItems) {
				renderDropdownItem(section, item);
			}
		}

		// Groups section
		if (groupItems.length > 0) {
			const section = dropdown.createDiv({ cls: "tn-pgp-section" });
			section.createDiv({ cls: "tn-pgp-section-header", text: "Groups" });

			for (const item of groupItems) {
				renderDropdownItem(section, item);
			}
		}
	}

	function renderDropdownItem(container: HTMLElement, item: PickerItem) {
		const itemEl = container.createDiv({ cls: "tn-pgp-item" });

		// Avatar
		const avatar = createAvatar({
			name: item.displayName,
			size: "sm",
			isGroup: item.type === "group",
		});
		itemEl.appendChild(avatar);

		// Text content
		const textContainer = itemEl.createDiv({ cls: "tn-pgp-item-text" });
		textContainer.createDiv({ cls: "tn-pgp-item-name", text: item.displayName });
		if (item.subtitle) {
			textContainer.createDiv({ cls: "tn-pgp-item-subtitle", text: item.subtitle });
		}

		// Click handler
		itemEl.addEventListener("click", (e) => {
			e.stopPropagation(); // Prevent outside click handler from firing

			if (multiSelect) {
				selectedPaths.add(item.path);
				// Keep dropdown open for multi-select
				searchInput.value = "";
				searchQuery = "";
				renderSelectedPills();
				renderDropdown();
				positionDropdown(); // Reposition in case pills changed layout
				notifyChange();
				searchInput.focus();
			} else {
				selectedPaths.clear();
				selectedPaths.add(item.path);
				searchInput.value = "";
				searchQuery = "";
				renderSelectedPills();
				notifyChange();
				closeDropdown();
			}
		});
	}

	function positionDropdown() {
		const inputRect = searchInput.getBoundingClientRect();
		const dropdownHeight = 200; // max-height from CSS
		const viewportHeight = window.innerHeight;

		// Check if there's room below, otherwise show above
		const spaceBelow = viewportHeight - inputRect.bottom;
		const showAbove = spaceBelow < dropdownHeight && inputRect.top > spaceBelow;

		dropdown.style.left = `${inputRect.left}px`;
		dropdown.style.width = `${inputRect.width}px`;

		if (showAbove) {
			dropdown.style.bottom = `${viewportHeight - inputRect.top + 4}px`;
			dropdown.style.top = "auto";
		} else {
			dropdown.style.top = `${inputRect.bottom + 4}px`;
			dropdown.style.bottom = "auto";
		}
	}

	function openDropdown() {
		if (isDropdownOpen) return;
		isDropdownOpen = true;
		dropdown.style.display = "block";
		positionDropdown();
		renderDropdown();
	}

	function closeDropdown() {
		if (!isDropdownOpen) return;
		isDropdownOpen = false;
		dropdown.style.display = "none";
	}

	function notifyChange() {
		onChange?.(Array.from(selectedPaths));
	}

	// Event listeners
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	searchInput.addEventListener("focus", () => {
		openDropdown();
	});

	// Also open on click (for when already focused)
	searchInput.addEventListener("click", () => {
		openDropdown();
	});

	searchInput.addEventListener("input", () => {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			searchQuery = searchInput.value;
			renderDropdown();
		}, 150);
	});

	searchInput.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			closeDropdown();
			searchInput.blur();
		}
	});

	// Close dropdown when clicking outside (check both container and dropdown)
	const handleOutsideClick = (e: MouseEvent) => {
		const target = e.target as Node;
		if (!container.contains(target) && !dropdown.contains(target)) {
			closeDropdown();
		}
	};
	document.addEventListener("click", handleOutsideClick);

	// Reposition dropdown on scroll (in case modal scrolls)
	const handleScroll = () => {
		if (isDropdownOpen) {
			positionDropdown();
		}
	};
	window.addEventListener("scroll", handleScroll, true);

	// Initial render
	renderSelectedPills();

	// Public API
	return {
		getSelection: () => Array.from(selectedPaths),
		setSelection: (paths: string[]) => {
			selectedPaths = new Set(paths);
			renderSelectedPills();
			renderDropdown();
		},
		closeDropdown: () => {
			closeDropdown();
		},
		destroy: () => {
			document.removeEventListener("click", handleOutsideClick);
			window.removeEventListener("scroll", handleScroll, true);
			if (debounceTimer) clearTimeout(debounceTimer);
			dropdown.remove(); // Remove from body
			container.empty();
		},
	};
}
