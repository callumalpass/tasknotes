import { setIcon } from "obsidian";
import { msg } from "@lingui/core/macro";
import { uiText } from "../../i18n/runtime";
import { renderKeyHint } from "./keyHint";
import { openPopover, type PopoverHandle, type PopoverOptions } from "./popover";

export interface PickerItem {
	id: string;
	label: string;
	/** Paints the leading glyph or icon. */
	renderLeading?: (host: HTMLElement) => void;
	detail?: string;
	keyHint?: string;
	selected?: boolean;
	keywords?: string;
}

export interface ListPickerOptions
	extends Pick<PopoverOptions, "anchor" | "app" | "className" | "onClose"> {
	items: readonly PickerItem[];
	placeholder: string;
	emptyText: string;
	unfilteredEmptyText?: string;
	showUnfilteredEmptyText?: boolean;
	/** Multi-select pickers stay open and toggle. */
	multiple?: boolean;
	/** Offered as the last row when nothing matches exactly, for free-text values. */
	createLabel?: (query: string) => string;
	canCreate?: (query: string) => boolean;
	onChoose: (item: PickerItem) => void;
	onCreate?: (query: string) => void;
}

export function matchesPickerQuery(item: PickerItem, query: string): boolean {
	const needle = query.trim().toLowerCase();
	if (!needle) return true;
	return `${item.label} ${item.keywords ?? ""}`.toLowerCase().includes(needle);
}

export function openListPicker(options: ListPickerOptions): PopoverHandle {
	const popover = openPopover({
		...options,
		className: `tn-picker ${options.className ?? ""}`.trim(),
	});
	const { el } = popover;
	const input = el.createEl("input", {
		cls: "tn-picker__input",
		attr: { type: "text", placeholder: options.placeholder, "aria-label": options.placeholder },
	});
	const list = el.createDiv({ cls: "tn-picker__list", attr: { role: "listbox" } });
	if (options.multiple) list.setAttribute("aria-multiselectable", "true");
	const footer = el.createDiv({ cls: "tn-picker__footer" });
	renderKeyHint(footer, "Enter");
	footer.createSpan({ text: uiText(msg({ message: "Select", context: "contextMenus.date.modal.select" })) });
	renderKeyHint(footer, "Escape");
	footer.createSpan({ text: uiText(msg({ message: "to dismiss", context: "modals.unscheduledTasksSelector.instructions.dismiss" })) });

	const items = options.items.map((item) => ({ ...item }));
	let visible: PickerItem[] = [];
	let activeIndex = 0;
	let createRow: HTMLElement | null = null;

	const rows = () => Array.from(list.querySelectorAll<HTMLElement>(".tn-picker__row"));

	const paintActive = () => {
		rows().forEach((row, index) => {
			const active = index === activeIndex;
			row.classList.toggle("is-active", active);
			row.setAttribute("aria-selected", String(!!visible[index]?.selected));
			if (active) row.scrollIntoView({ block: "nearest" });
		});
	};

	const choose = (item: PickerItem) => {
		if (options.multiple) {
			item.selected = !item.selected;
			options.onChoose(item);
			render();
			activeIndex = Math.max(0, visible.findIndex((candidate) => candidate.id === item.id));
			paintActive();
			return;
		}
		popover.close();
		if (item.selected) return;
		options.onChoose(item);
	};

	const create = () => {
		const query = input.value.trim();
		if (!query || options.canCreate?.(query) === false) return;
		if (options.multiple) {
			items.push({ id: query, label: query, selected: true });
			input.value = "";
			options.onCreate?.(query);
			render();
			return;
		}
		popover.close();
		options.onCreate?.(query);
	};

	function render(): void {
		list.empty();
		const query = input.value;
		visible = items.filter((item) => matchesPickerQuery(item, query));
		if (options.multiple) visible.sort((left, right) => Number(!!right.selected) - Number(!!left.selected));
		createRow = null;
		const unfilteredNotice = !query && options.showUnfilteredEmptyText;
		if (unfilteredNotice) list.createDiv({ cls: "tn-picker__empty", text: options.unfilteredEmptyText });

		for (const [index, item] of visible.entries()) {
			const row = list.createDiv({
				cls: "tn-picker__row",
				attr: { role: "option", "data-picker-id": item.id },
			});
			row.classList.toggle("is-selected", !!item.selected);
			const leading = row.createSpan({ cls: "tn-picker__leading" });
			item.renderLeading?.(leading);
			const check = row.createSpan({ cls: "tn-picker__check" });
			if (item.selected) setIcon(check, "check");
			row.createSpan({
				cls: "tn-picker__label",
				text: item.label,
				attr: { title: item.label },
			});
			if (item.detail) row.createSpan({ cls: "tn-picker__detail", text: item.detail });
			if (item.keyHint && item.keyHint !== "Enter") renderKeyHint(row, item.keyHint);
			row.addEventListener("pointermove", () => {
				if (activeIndex === index) return;
				activeIndex = index;
				paintActive();
			});
			row.addEventListener("click", () => choose(item));
		}

		const trimmed = query.trim();
		const exact = items.some((item) => item.label.toLowerCase() === trimmed.toLowerCase());
		if (options.createLabel && options.onCreate && trimmed && !exact) {
			createRow = list.createDiv({ cls: "tn-picker__row", attr: { role: "option" } });
			createRow.setAttribute("aria-disabled", String(options.canCreate?.(trimmed) === false));
			createRow.createSpan({ cls: "tn-picker__leading" });
			createRow.createSpan({ cls: "tn-picker__label", text: options.createLabel(trimmed) });
			createRow.addEventListener("click", create);
		}

		const rowCount = visible.length + (createRow ? 1 : 0);
		if (rowCount === 0 && !unfilteredNotice) list.createDiv({ cls: "tn-picker__empty", text: query ? options.emptyText : options.unfilteredEmptyText ?? options.emptyText });
		activeIndex = Math.min(activeIndex, Math.max(0, rowCount - 1));
		paintActive();
		popover.reposition();
	}

	input.addEventListener("input", () => {
		activeIndex = 0;
		render();
	});
	input.addEventListener("keydown", (event) => {
		const rowCount = rows().length;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (rowCount === 0) return;
			const step = event.key === "ArrowDown" ? 1 : -1;
			activeIndex = (activeIndex + step + rowCount) % rowCount;
			paintActive();
		} else if (event.key === "Enter") {
			event.preventDefault();
			if (activeIndex < visible.length) choose(visible[activeIndex]);
			else create();
		}
	});

	render();
	const firstSelected = visible.findIndex((item) => item.selected);
	if (firstSelected > 0) {
		activeIndex = firstSelected;
		paintActive();
	}
	input.focus();
	return popover;
}
