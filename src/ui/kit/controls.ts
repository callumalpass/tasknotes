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
		buttons.set(segment.value, button);
	}

	setValue(value);
	return { el, setValue };
}
