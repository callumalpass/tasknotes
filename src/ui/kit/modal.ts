import type { Modal } from "obsidian";
import { renderKeyHint, TASK_KEYBOARD_MAP } from "./keyHint";
import { setIcon } from "obsidian";
import { colorValueToInputValue, normalizeThemeColor } from "../../utils/themeColors";
import { uiText, uiLocale } from "../../i18n/runtime";
import { msg } from "@lingui/core/macro";

export function applyModalShell(modal: Pick<Modal, "modalEl" | "contentEl" | "onClose">): void {
	modal.modalEl.addClass("tasknotes-plugin", "tn-modal");
	modal.contentEl.addClass("tn-modal__content");
	const opener = modal.modalEl.ownerDocument.activeElement as HTMLElement | null;
	const view = opener?.closest<HTMLElement>(".bases-view .tasknotes-plugin[tabindex]");
	const close = modal.onClose.bind(modal);
	modal.onClose = () => {
		close();
		queueMicrotask(() => {
			const doc = modal.modalEl.ownerDocument;
			if (doc.activeElement === doc.body || modal.modalEl.contains(doc.activeElement)) {
				const target = view ?? opener;
				if (target?.isConnected) target.focus({ preventScroll: true });
			}
		});
	};
}

export function renderModalSubmitHint(button: HTMLElement): void {
	renderKeyHint(button, TASK_KEYBOARD_MAP.save);
}

export function createModalComposer(modal: Pick<Modal, "modalEl" | "contentEl">): {
	body: HTMLElement;
	properties: HTMLElement;
	footer: HTMLElement;
} {
	modal.modalEl.addClass("tn-modal--composer");
	const body = modal.contentEl.createDiv({ cls: "tn-modal__body" });
	const properties = body.createDiv({ cls: "tn-modal__properties" });
	const footer = modal.contentEl.createDiv({ cls: "tn-modal__footer" });
	return { body, properties, footer };
}

export function createModalTimeField(
	container: HTMLElement,
	label: string,
	value: string,
	format: "12" | "24",
	onChange: () => void
): HTMLInputElement {
	const chip = container.createDiv({ cls: "tn-modal__time tn-chip" });
	setIcon(chip.createSpan({ cls: "tn-modal__property-icon" }), "clock");
	chip.createSpan({ text: label });
	const input = chip.createEl("input", { type: "hidden", value });
	const parsed = /^(\d{2}):(\d{2})$/.exec(value);
	const hourValue = parsed ? Number(parsed[1]) : null;
	const hour = chip.createEl("select", { cls: "tn-select", attr: { "aria-label": label } });
	const minute = chip.createEl("select", {
		cls: "tn-select",
		attr: { "aria-label": `${label} :` },
	});
	minute.before(container.ownerDocument.createTextNode(":"));
	const period =
		format === "12"
			? chip.createEl("select", { cls: "tn-select", attr: { "aria-label": label } })
			: null;
	for (const select of [hour, minute]) select.createEl("option", { value: "", text: "—" });
	for (let index = format === "12" ? 1 : 0; index < (format === "12" ? 13 : 24); index++) {
		hour.createEl("option", { value: String(index), text: String(index).padStart(2, "0") });
	}
	for (let index = 0; index < 60; index++)
		minute.createEl("option", { value: String(index), text: String(index).padStart(2, "0") });
	if (period) {
		for (const half of [0, 1]) {
			const date = new Date(2000, 0, 1, half * 12);
			const text =
				new Intl.DateTimeFormat(uiLocale(), { hour: "numeric", hour12: true })
					.formatToParts(date)
					.find((part) => part.type === "dayPeriod")?.value ?? "";
			period.createEl("option", { value: String(half), text });
		}
		period.value = hourValue !== null && hourValue >= 12 ? "1" : "0";
	}
	hour.value =
		hourValue === null ? "" : String(format === "12" ? hourValue % 12 || 12 : hourValue);
	minute.value = parsed ? String(Number(parsed[2])) : "";
	for (const select of [hour, minute, period])
		select?.addEventListener("change", () => {
			const hours =
				(Number(hour.value) % (format === "12" ? 12 : 24)) +
				(period ? Number(period.value) * 12 : 0);
			input.value =
				hour.value !== "" && minute.value !== ""
					? `${String(hours).padStart(2, "0")}:${String(Number(minute.value)).padStart(2, "0")}`
					: "";
			onChange();
		});
	return input;
}

export function createModalColorField(
	container: HTMLElement,
	label: string,
	value: string
): HTMLInputElement {
	const disclosure = container.createEl("details", { cls: "tn-modal__color" });
	const summary = disclosure.createEl("summary", { cls: "tn-chip", text: label });
	const preview = summary.createSpan({ cls: "tn-modal__swatch" });
	const palette = disclosure.createDiv({ cls: "tn-modal__palette" });
	const input = disclosure.createEl("input", {
		type: "text",
		value: colorValueToInputValue(value),
		cls: "tn-modal__color-value",
		attr: { "aria-label": label },
	});
	const update = () => {
		preview.setCssProps({ "--tn-swatch-color": normalizeThemeColor(input.value) });
		for (const button of palette.querySelectorAll<HTMLButtonElement>("button"))
			button.setAttribute("aria-pressed", String(button.dataset.color === input.value));
	};
	const colors = [
		{ value: "red", label: msg({ message: "Red", context: "color name" }) },
		{ value: "orange", label: msg({ message: "Orange", context: "color name" }) },
		{ value: "yellow", label: msg({ message: "Yellow", context: "color name" }) },
		{ value: "green", label: msg({ message: "Green", context: "color name" }) },
		{ value: "cyan", label: msg({ message: "Cyan", context: "color name" }) },
		{ value: "blue", label: msg({ message: "Blue", context: "color name" }) },
		{ value: "purple", label: msg({ message: "Purple", context: "color name" }) },
		{ value: "pink", label: msg({ message: "Pink", context: "color name" }) },
		{ value: "accent", label: msg({ message: "Accent", context: "color name" }) },
	];
	for (const { value: color, label: colorLabel } of colors) {
		const swatch = palette.createEl("button", {
			cls: "tn-modal__swatch",
			attr: { type: "button", "aria-label": uiText(colorLabel) },
		});
		swatch.dataset.color = color;
		swatch.setCssProps({ "--tn-swatch-color": normalizeThemeColor(color) });
		swatch.addEventListener("click", () => {
			input.value = color;
			update();
		});
	}
	const custom = palette.createEl("input", { type: "color", attr: { "aria-label": label } });
	if (/^#[0-9a-f]{6}$/i.test(value)) custom.value = value;
	custom.addEventListener("input", () => {
		input.value = custom.value;
		update();
	});
	input.addEventListener("input", update);
	update();
	return input;
}
