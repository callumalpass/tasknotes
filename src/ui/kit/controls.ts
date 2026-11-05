export interface SegmentOption<T extends string> {
	value: T;
	label: string;
	title?: string;
}

export interface SegmentedControl<T extends string> {
	el: HTMLElement;
	setValue: (value: T) => void;
}

export function createSegmentedControl<T extends string>(
	container: HTMLElement,
	segments: readonly SegmentOption<T>[],
	value: T,
	onChange: (value: T) => void
): SegmentedControl<T> {
	const el = container.createDiv({ cls: "tn-segmented", attr: { role: "tablist" } });
	const buttons = new Map<T, HTMLElement>();

	const setValue = (next: T) => {
		for (const [segment, button] of buttons) {
			const selected = segment === next;
			button.classList.toggle("is-selected", selected);
			button.setAttribute("aria-selected", String(selected));
			button.tabIndex = selected ? 0 : -1;
		}
	};

	for (const segment of segments) {
		const button = el.createEl("button", {
			cls: "tn-segmented__item",
			text: segment.label,
			attr: { role: "tab", title: segment.title ?? segment.label },
		});
		button.addEventListener("click", () => {
			setValue(segment.value);
			onChange(segment.value);
		});
		button.addEventListener("keydown", (event) => {
			if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
			event.preventDefault();
			const enabled = Array.from(buttons.entries()).filter(([, candidate]) =>
				!candidate.matches(":disabled, [aria-disabled=true]")
			);
			const index = enabled.findIndex(([candidate]) => candidate === segment.value);
			if (index < 0) return;
			const rtl = getComputedStyle(el).direction === "rtl";
			const step = (event.key === "ArrowRight" ? 1 : -1) * (rtl ? -1 : 1);
			const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 :
				(index + step + enabled.length) % enabled.length;
			const [nextValue, nextButton] = enabled[nextIndex];
			setValue(nextValue);
			nextButton.focus();
			onChange(nextValue);
		});
		buttons.set(segment.value, button);
	}

	setValue(value);
	return { el, setValue };
}
