/**
 * ====================================================================
 * TaskNotes Card Component System
 * ====================================================================
 *
 * A comprehensive, reusable card UI system for TaskNotes settings.
 * Provides consistent, accessible cards with built-in interactions.
 *
 * FEATURES:
 * - Consistent styling across all settings tabs
 * - Built-in drag & drop support
 * - Header actions (edit, delete buttons)
 * - Color indicators and status badges
 * - Form inputs with proper sizing
 * - Action buttons with variants
 * - Responsive design
 *
 * USAGE EXAMPLES:
 *
 * 1. SIMPLE CARD:
 * ```typescript
 * const card = createCard(container, {
 *   header: {
 *     primaryText: "My Setting",
 *     secondaryText: "Description text"
 *   }
 * });
 * ```
 *
 * 1b. COLLAPSIBLE CARD:
 * ```typescript
 * const card = createCard(container, {
 *   collapsible: true,
 *   defaultCollapsed: true,
 *   header: {
 *     primaryText: "Collapsible Setting",
 *     secondaryText: "Click chevron to expand"
 *   },
 *   content: {
 *     sections: [{
 *       rows: [
 *         { label: 'Setting:', input: createCardInput('text', 'Value') }
 *       ]
 *     }]
 *   }
 * });
 * ```
 *
 * 2. CARD WITH STATUS AND DELETE:
 * ```typescript
 * const statusBadge = createStatusBadge('Active', 'active');
 * const card = createCard(container, {
 *   header: {
 *     primaryText: "Webhook #1",
 *     secondaryText: "https://api.example.com/webhook",
 *     meta: [statusBadge],
 *     actions: [createDeleteHeaderButton(() => deleteItem(id))]
 *   }
 * });
 * ```
 *
 * 3. FULL CONFIGURATION CARD:
 * ```typescript
 * const enabledInput = createCardInput('checkbox');
 * const nameInput = createCardInput('text', 'Enter name');
 * const colorInput = createCardInput('color', '', '#ff0000');
 *
 * const card = createCard(container, {
 *   id: 'unique-card-id',
 *   draggable: true,
 *   colorIndicator: { color: '#ff0000' },
 *   header: {
 *     primaryText: "Configuration Item",
 *     secondaryText: "Detailed description",
 *     meta: [createStatusBadge('Enabled', 'active')],
 *     actions: [createDeleteHeaderButton(() => deleteItem())]
 *   },
 *   content: {
 *     sections: [{
 *       rows: [
 *         { label: 'Enabled:', input: enabledInput },
 *         { label: 'Name:', input: nameInput, fullWidth: true },
 *         { label: 'Color:', input: colorInput }
 *       ]
 *     }]
 *   },
 *   actions: {
 *     buttons: [
 *       { text: 'Save', variant: 'primary', onClick: () => save() },
 *       { text: 'Test', icon: 'play', onClick: () => test() }
 *     ]
 *   }
 * });
 * ```
 *
 * 4. DRAGGABLE CARDS WITH REORDERING:
 * ```typescript
 * items.forEach(item => {
 *   const card = createCard(container, {
 *     id: item.id,
 *     draggable: true,
 *     header: { primaryText: item.name }
 *   });
 *
 *   setupCardDragAndDrop(card, container, (draggedId, targetId, insertBefore) => {
 *     reorderItems(draggedId, targetId, insertBefore);
 *   });
 * });
 * ```
 *
 * MIGRATION GUIDE:
 * ===============
 *
 * To migrate from manual DOM creation to the card system:
 *
 * OLD WAY (194 lines):
 * ```typescript
 * function renderStatusList(container: HTMLElement) {
 *   container.empty();
 *   const statusContainer = container.createDiv('tasknotes-statuses-container');
 *   plugin.settings.statuses.forEach(status => {
 *     const card = statusContainer.createDiv('tasknotes-status-card');
 *     // ... 20+ lines of manual DOM creation per item
 *   });
 * }
 * ```
 *
 * NEW WAY (58 lines):
 * ```typescript
 * function renderStatusList(container: HTMLElement) {
 *   container.empty();
 *   plugin.settings.statuses.forEach(status => {
 *     const nameInput = createCardInput('text', 'Status name', status.name);
 *     const colorInput = createCardInput('color', '', status.color);
 *
 *     createCard(container, {
 *       colorIndicator: { color: status.color },
 *       header: {
 *         primaryText: status.name,
 *         actions: [createDeleteHeaderButton(() => deleteStatus(status.id))]
 *       },
 *       content: {
 *         sections: [{
 *           rows: [
 *             { label: 'Name:', input: nameInput },
 *             { label: 'Color:', input: colorInput }
 *           ]
 *         }]
 *       }
 *     });
 *   });
 * }
 * ```
 *
 * QUICK REFERENCE:
 * ===============
 * - createCard() - Main card creation function
 * - createCardInput() - Text, number, color, checkbox inputs
 * - createCardSelect() - Dropdowns with options
 * - createCardTextarea() - Multi-line text input
 * - createCardUrlInput() - URL input with validation
 * - createCardNumberInput() - Number input with min/max
 * - createStatusBadge() - Active/inactive/completed badges
 * - createDeleteHeaderButton() - Delete button for card header
 * - createEditHeaderButton() - Edit button for card header
 * - createInfoBadge() - Read-only information badge
 * - setupCardDragAndDrop() - Enable drag & drop reordering
 * - showCardLoading() - Loading state utility
 * - showCardEmptyState() - Empty state with optional action
 *
 * COLLAPSIBLE CARDS:
 * - Set collapsible: true to enable fold/unfold button
 * - Set defaultCollapsed: true to start collapsed
 * - Chevron button appears in header actions area
 * - Content and actions sections hide when collapsed
 */

import { setIcon } from "obsidian";

/**
 * Main configuration interface for creating cards
 */
export interface CardConfig {
	/** Unique identifier for the card (required for drag & drop) */
	id?: string;
	/** Enable drag and drop functionality */
	draggable?: boolean;
	/** Enable collapsible functionality with fold/unfold button */
	collapsible?: boolean;
	/** Whether the card should start collapsed (only applies if collapsible is true) */
	defaultCollapsed?: boolean;
	/** Callback when collapse state changes */
	onCollapseChange?: (collapsed: boolean) => void;
	/** Color indicator on the left side of the card */
	colorIndicator?: {
		color: string;
		cssVar?: string;
	};
	/** Header section with title, subtitle, badges, and actions */
	header: {
		primaryText: string;
		secondaryText?: string;
		meta?: HTMLElement[];
		actions?: CardHeaderButton[];
	};
	/** Content section with form inputs and configuration */
	content?: {
		sections: CardSection[];
	};
	/** Bottom action buttons */
	actions?: {
		buttons: CardButton[];
	};
}

/** Header action button (small icons in card header) */
export interface CardHeaderButton {
	/** Obsidian icon name */
	icon: string;
	/** Button style variant */
	variant?: "delete" | "edit" | "default";
	/** Tooltip text on hover */
	tooltip?: string;
	/** Click handler */
	onClick: () => void;
}

/** Content section containing form rows */
export interface CardSection {
	rows: CardRow[];
}

/** Individual form row with label and input */
export interface CardRow {
	/** Label text */
	label: string;
	/** Form input element - any HTML element */
	input: HTMLElement;
	/** Whether input should span full card width */
	fullWidth?: boolean;
}

/** Action button in card footer */
export interface CardButton {
	/** Button text */
	text: string;
	/** Optional Obsidian icon name */
	icon?: string;
	/** Button style variant */
	variant?: "primary" | "secondary" | "delete" | "warning" | "default";
	/** Click handler */
	onClick: () => void;
	/** Whether button is disabled */
	disabled?: boolean;
}

/**
 * Creates a deduplicated card component
 */
export function createCard(container: HTMLElement, config: CardConfig): HTMLElement {
	const card = container.createDiv("tasknotes-settings__card");

	if (config.id) {
		card.setAttribute("data-card-id", config.id);
	}

	if (config.draggable) {
		card.addClass("tasknotes-settings__card--draggable");
	}

	if (config.collapsible) {
		card.addClass("tasknotes-settings__card--collapsible");
		if (config.defaultCollapsed) {
			card.addClass("tasknotes-settings__card--collapsed");
		}
	}

	// Create header
	const header = card.createDiv("tasknotes-settings__card-header");

	// Create drag handle if draggable - place it in the header
	let dragHandle: HTMLElement | null = null;
	if (config.draggable) {
		header.addClass("tasknotes-settings__card-header--with-drag-handle");
		dragHandle = header.createDiv("tasknotes-settings__card-drag-handle");
		dragHandle.textContent = "⋮⋮";
		dragHandle.draggable = true;
		dragHandle.title = "Drag to reorder";
	}

	// Left side of header with color indicator and info
	const headerLeft = header.createDiv();
	headerLeft.style.display = "flex";
	headerLeft.style.alignItems = "center";
	headerLeft.style.flex = "1";
	headerLeft.style.minWidth = "0";

	// Color indicator
	if (config.colorIndicator) {
		const colorIndicator = headerLeft.createDiv("tasknotes-settings__card-color-indicator");
		colorIndicator.style.backgroundColor = config.colorIndicator.color;
		if (config.colorIndicator.cssVar) {
			colorIndicator.style.setProperty("--card-color", config.colorIndicator.color);
		}
	}

	// Header info
	const headerInfo = headerLeft.createDiv("tasknotes-settings__card-info");
	const primaryText = headerInfo.createSpan("tasknotes-settings__card-primary-text");
	primaryText.textContent = config.header.primaryText;

	if (config.header.secondaryText) {
		const secondaryText = headerInfo.createSpan("tasknotes-settings__card-secondary-text");
		secondaryText.textContent = config.header.secondaryText;
	}

	// Right side of header with meta elements and actions
	const headerRight = header.createDiv();
	headerRight.style.display = "flex";
	headerRight.style.alignItems = "center";
	headerRight.style.gap = "0.5rem";

	// Meta elements
	if (config.header.meta && config.header.meta.length > 0) {
		const headerMeta = headerRight.createDiv("tasknotes-settings__card-meta");
		config.header.meta.forEach((metaEl) => {
			headerMeta.appendChild(metaEl);
		});
	}

	// Header actions (delete, edit buttons in header)
	if (config.header.actions && config.header.actions.length > 0) {
		const headerActions =
			headerRight.querySelector(".tasknotes-settings__card-header-actions") ||
			headerRight.createDiv("tasknotes-settings__card-header-actions");
		config.header.actions.forEach((actionConfig) => {
			const button = headerActions.createEl("button", {
				cls: "tasknotes-settings__card-header-btn",
			});

			if (actionConfig.variant === "delete") {
				button.addClass("tasknotes-settings__card-header-btn--delete");
			}

			const icon = button.createSpan();
			setIcon(icon, actionConfig.icon);

			if (actionConfig.tooltip) {
				button.title = actionConfig.tooltip;
			}

			button.onclick = (e) => {
				e.stopPropagation(); // Prevent header click from firing
				actionConfig.onClick();
			};
		});
	}

	// Add collapsible functionality if enabled
	if (config.collapsible) {
		// Create toggle function
		const toggleCollapse = () => {
			const isCurrentlyCollapsed = card.hasClass("tasknotes-settings__card--collapsed");

			if (isCurrentlyCollapsed) {
				// Expand
				card.removeClass("tasknotes-settings__card--collapsed");
				header.title = "Collapse card";
				config.onCollapseChange?.(false);
			} else {
				// Collapse
				card.addClass("tasknotes-settings__card--collapsed");
				header.title = "Expand card";
				config.onCollapseChange?.(true);
			}
		};

		// Make entire header clickable
		header.addClass("tasknotes-settings__card-header--clickable");
		header.title = config.defaultCollapsed ? "Expand card" : "Collapse card";
		header.onclick = (e) => {
			// Don't trigger if clicking on action buttons
			if ((e.target as Element).closest(".tasknotes-settings__card-header-actions")) {
				return;
			}
			toggleCollapse();
		};
	}

	// Create content sections
	if (config.content && config.content.sections.length > 0) {
		const content = card.createDiv("tasknotes-settings__card-content");
		if (config.draggable) {
			content.addClass("tasknotes-settings__card-content--with-drag-handle");
		}

		config.content.sections.forEach((section) => {
			section.rows.forEach((row) => {
				const configRow = content.createDiv("tasknotes-settings__card-config-row");

				if (row.fullWidth) {
					configRow.style.flexDirection = "column";
					configRow.style.alignItems = "flex-start";
					configRow.style.gap = "0.5rem";
				}

				const label = configRow.createSpan("tasknotes-settings__card-config-label");
				label.textContent = row.label;

				configRow.appendChild(row.input);
			});
		});
	}

	// Create actions
	if (config.actions && config.actions.buttons.length > 0) {
		const actions = card.createDiv("tasknotes-settings__card-actions");
		if (config.draggable) {
			actions.addClass("tasknotes-settings__card-actions--with-drag-handle");
		}

		config.actions.buttons.forEach((buttonConfig) => {
			const button = actions.createEl("button", {
				text: buttonConfig.text,
				cls: "tasknotes-settings__card-action-btn",
			});

			if (buttonConfig.variant) {
				button.addClass(`tasknotes-settings__card-action-btn--${buttonConfig.variant}`);
			}

			if (buttonConfig.icon) {
				const icon = button.createSpan();
				setIcon(icon, buttonConfig.icon);
				button.insertBefore(icon, button.firstChild);
			}

			if (buttonConfig.disabled) {
				button.disabled = true;
			}

			button.onclick = buttonConfig.onClick;
		});
	}

	return card;
}

/**
 * Creates a status badge element for card meta
 */
export function createStatusBadge(
	text: string,
	variant: "active" | "inactive" | "completed" | "default" = "default"
): HTMLElement {
	const badge = document.createElement("span");
	badge.addClass("tasknotes-settings__card-status-badge");
	badge.addClass(`tasknotes-settings__card-status-badge--${variant}`);
	badge.textContent = text;
	return badge;
}

/**
 * Creates a header delete button for compact card design
 */
export function createDeleteHeaderButton(onClick: () => void, tooltip?: string): CardHeaderButton {
	return {
		icon: "trash-2",
		variant: "delete",
		tooltip: tooltip || "Delete",
		onClick,
	};
}

/**
 * Creates a simple input element with card styling
 */
export function createCardInput(
	type: "text" | "number" | "color" | "checkbox" | "date" | "time" = "text",
	placeholder?: string,
	value?: string
): HTMLInputElement {
	const input = document.createElement("input");
	input.type = type;
	input.addClass("tasknotes-settings__card-input");

	if (placeholder) {
		input.placeholder = placeholder;
	}

	if (value) {
		input.value = value;
	}

	return input;
}

/**
 * Creates an Obsidian-style toggle switch for card content
 * Returns the toggle component's toggleEl directly
 */
export function createCardToggle(initialValue = false, onChange?: (value: boolean) => void): HTMLElement {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { Setting } = require("obsidian");
	const tempContainer = document.createElement("div");
	const setting = new Setting(tempContainer);

	let toggleEl: HTMLElement;
	setting.addToggle((toggle: any) => {
		toggle.setValue(initialValue);
		if (onChange) {
			toggle.onChange(onChange);
		}
		toggleEl = toggle.toggleEl;
	});

	return toggleEl!;
}

/**
 * Creates a select dropdown with card styling
 */
export function createCardSelect(
	options: Array<{ value: string; label: string }>,
	selectedValue?: string
): HTMLSelectElement {
	const select = document.createElement("select");
	select.addClass("tasknotes-settings__card-input");

	options.forEach((option) => {
		const optionEl = select.createEl("option", {
			value: option.value,
			text: option.label,
		});

		if (selectedValue === option.value) {
			optionEl.selected = true;
		}
	});

	return select;
}

/**
 * Sets up drag and drop functionality for a draggable card
 */
export function setupCardDragAndDrop(
	card: HTMLElement,
	container: HTMLElement,
	onReorder: (draggedId: string, targetId: string, insertBefore: boolean) => void
): void {
	const dragHandle = card.querySelector(".tasknotes-settings__card-drag-handle") as HTMLElement;
	if (!dragHandle) return;

	const cardId = card.getAttribute("data-card-id");
	if (!cardId) return;

	dragHandle.addEventListener("dragstart", (e) => {
		if (e.dataTransfer) {
			e.dataTransfer.setData("text/plain", cardId);
			card.addClass("tasknotes-settings__card--dragging");
		}
	});

	dragHandle.addEventListener("dragend", () => {
		card.removeClass("tasknotes-settings__card--dragging");
	});

	card.addEventListener("dragover", (e) => {
		e.preventDefault();
		const draggingCard = container.querySelector(
			".tasknotes-settings__card--dragging"
		) as HTMLElement;
		if (draggingCard && draggingCard !== card) {
			const rect = card.getBoundingClientRect();
			const midpoint = rect.top + rect.height / 2;

			card.removeClass(
				"tasknotes-settings__card--drag-over-top",
				"tasknotes-settings__card--drag-over-bottom"
			);

			if (e.clientY < midpoint) {
				card.addClass("tasknotes-settings__card--drag-over-top");
			} else {
				card.addClass("tasknotes-settings__card--drag-over-bottom");
			}
		}
	});

	card.addEventListener("dragleave", () => {
		card.removeClass(
			"tasknotes-settings__card--drag-over-top",
			"tasknotes-settings__card--drag-over-bottom"
		);
	});

	card.addEventListener("drop", (e) => {
		e.preventDefault();
		card.removeClass(
			"tasknotes-settings__card--drag-over-top",
			"tasknotes-settings__card--drag-over-bottom"
		);

		const draggedCardId = e.dataTransfer!.getData("text/plain");
		const targetCardId = cardId;

		if (draggedCardId !== targetCardId) {
			const rect = card.getBoundingClientRect();
			const midpoint = rect.top + rect.height / 2;
			const insertBefore = e.clientY < midpoint;

			onReorder(draggedCardId, targetCardId, insertBefore);
		}
	});
}

// =====================================================================
// ADDITIONAL HELPER FUNCTIONS FOR SETTINGS-WIDE USAGE
// =====================================================================

/**
 * Creates an edit header button with consistent styling
 */
export function createEditHeaderButton(onClick: () => void, tooltip?: string): CardHeaderButton {
	return {
		icon: "edit",
		variant: "edit",
		tooltip: tooltip || "Edit",
		onClick,
	};
}

/**
 * Creates a textarea element with card styling
 */
export function createCardTextarea(
	placeholder?: string,
	value?: string,
	rows = 3
): HTMLTextAreaElement {
	const textarea = document.createElement("textarea");
	textarea.addClass("tasknotes-settings__card-input");
	textarea.rows = rows;

	if (placeholder) {
		textarea.placeholder = placeholder;
	}

	if (value) {
		textarea.value = value;
	}

	return textarea;
}

/**
 * Creates a number input with min/max constraints
 */
export function createCardNumberInput(
	min?: number,
	max?: number,
	step?: number,
	value?: number
): HTMLInputElement {
	const input = createCardInput("number");

	if (min !== undefined) input.min = min.toString();
	if (max !== undefined) input.max = max.toString();
	if (step !== undefined) input.step = step.toString();
	if (value !== undefined) input.value = value.toString();

	return input;
}

/**
 * Normalizes calendar URLs by converting webcal:// and webcals:// protocols
 * to their http:// and https:// equivalents.
 *
 * This allows users to paste Apple Calendar URLs (and other calendar URLs)
 * that use the webcal:// protocol, which is the standard protocol for
 * iCalendar subscriptions.
 *
 * @param url - The URL to normalize
 * @returns The normalized URL with http:// or https:// protocol
 *
 * @example
 * normalizeCalendarUrl("webcal://example.com/calendar.ics")
 * // returns "http://example.com/calendar.ics"
 *
 * normalizeCalendarUrl("webcals://example.com/calendar.ics")
 * // returns "https://example.com/calendar.ics"
 */
export function normalizeCalendarUrl(url: string): string {
	if (!url) return url;

	return url
		.replace(/^webcal:\/\//i, 'http://')
		.replace(/^webcals:\/\//i, 'https://');
}

/**
 * Creates a URL input with validation styling.
 *
 * Accepts http://, https://, webcal://, and webcals:// protocols.
 * The webcal protocols are commonly used for calendar subscriptions
 * (especially Apple Calendar) and are automatically normalized to
 * http/https when the URL is saved.
 */
export function createCardUrlInput(placeholder?: string, value?: string): HTMLInputElement {
	const input = document.createElement("input");
	// Use type="text" instead of type="url" to allow webcal:// and webcals:// protocols
	// HTML5 type="url" validation only accepts http://, https://, and ftp://
	input.type = "text";
	input.addClass("tasknotes-settings__card-input");

	// Add pattern validation to accept calendar URL protocols
	input.pattern = "^(https?|webcals?)://.*";
	input.title = "Enter an http://, https://, webcal://, or webcals:// URL";

	if (placeholder) {
		input.placeholder = placeholder;
	}

	if (value) {
		input.value = value;
	}

	return input;
}

/**
 * Creates a card with just content (no header or actions)
 */
export function createSimpleCard(container: HTMLElement, rows: CardRow[]): HTMLElement {
	return createCard(container, {
		header: {
			primaryText: "", // Will be hidden by CSS if empty
		},
		content: {
			sections: [{ rows }],
		},
	});
}

/**
 * Creates an info badge for displaying read-only information
 */
export function createInfoBadge(text: string): HTMLElement {
	const badge = document.createElement("span");
	badge.addClass("tasknotes-settings__card-info-badge");
	badge.textContent = text;
	return badge;
}

/**
 * Utility to clear a container and show loading state
 */
export function showCardLoading(container: HTMLElement, message = "Loading..."): void {
	container.empty();
	const loadingCard = container.createDiv("tasknotes-settings__card");
	const loadingContent = loadingCard.createDiv("tasknotes-settings__card-content");
	loadingContent.style.textAlign = "center";
	loadingContent.style.padding = "2rem";
	loadingContent.style.color = "var(--text-muted)";
	loadingContent.textContent = message;
}

/**
 * Utility to show an empty state with consistent styling
 */
export function showCardEmptyState(
	container: HTMLElement,
	message: string,
	actionText?: string,
	onAction?: () => void
): void {
	container.empty();
	const emptyState = container.createDiv("tasknotes-settings__empty-state");
	emptyState.createSpan("tasknotes-settings__empty-icon");
	emptyState.createSpan({
		text: message,
		cls: "tasknotes-settings__empty-text",
	});

	if (actionText && onAction) {
		const actionButton = emptyState.createEl("button", {
			text: actionText,
			cls: "tn-btn tn-btn--primary",
		});
		actionButton.style.marginTop = "1rem";
		actionButton.onclick = onAction;
	}
}
