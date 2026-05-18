export type TaskModalTitleInputElement = HTMLInputElement | HTMLTextAreaElement;

export interface TaskModalTitleTextareaOptions {
	container: HTMLElement;
	className: string;
	placeholder: string;
	value: string;
	onChange: (value: string) => void;
	attachFocusScrollGuard?: (input: TaskModalTitleInputElement) => void;
}

export interface TaskModalTitleInputBinding {
	value: string;
	onChange: (value: string) => void;
	attachFocusScrollGuard?: (input: TaskModalTitleInputElement) => void;
}

export function createTaskModalTitleTextarea({
	container,
	className,
	placeholder,
	value,
	onChange,
	attachFocusScrollGuard,
}: TaskModalTitleTextareaOptions): HTMLTextAreaElement {
	const input = container.createEl("textarea", { cls: className });
	input.placeholder = placeholder;
	input.rows = 1;
	input.spellcheck = true;
	input.setAttribute("aria-label", placeholder);

	input.addEventListener("keydown", (event) => {
		if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
			event.preventDefault();
		}
	});

	bindTaskModalTitleInput(input, {
		value,
		onChange,
		attachFocusScrollGuard,
	});

	return input;
}

export function bindTaskModalTitleInput(
	input: TaskModalTitleInputElement,
	{ value, onChange, attachFocusScrollGuard }: TaskModalTitleInputBinding
): void {
	input.value = value;
	input.addEventListener("input", (event) => {
		const target = event.target as TaskModalTitleInputElement;
		const normalizedTitle = normalizeTaskModalTitleValue(target.value);
		if (target.value !== normalizedTitle) {
			target.value = normalizedTitle;
		}
		onChange(normalizedTitle);
		resizeTaskModalTitleTextarea(target);
	});
	attachFocusScrollGuard?.(input);
	resizeTaskModalTitleTextarea(input);
}

export function normalizeTaskModalTitleValue(value: string): string {
	return value.replace(/\s*\n+\s*/g, " ");
}

export function resizeTaskModalTitleTextarea(input: TaskModalTitleInputElement): void {
	const inputWindow = input.ownerDocument.defaultView;
	const TextAreaConstructor = inputWindow?.HTMLTextAreaElement ?? HTMLTextAreaElement;
	if (!(input instanceof TextAreaConstructor)) return;

	const computed = inputWindow?.getComputedStyle(input);
	const lineHeight = computed ? Number.parseFloat(computed.lineHeight) : 0;
	const paddingTop = computed ? Number.parseFloat(computed.paddingTop) || 0 : 0;
	const paddingBottom = computed ? Number.parseFloat(computed.paddingBottom) || 0 : 0;
	const borderTop = computed ? Number.parseFloat(computed.borderTopWidth) || 0 : 0;
	const borderBottom = computed ? Number.parseFloat(computed.borderBottomWidth) || 0 : 0;
	const maxHeight =
		(lineHeight > 0 ? lineHeight * 3 : 72) +
		paddingTop +
		paddingBottom +
		borderTop +
		borderBottom;

	setTaskModalTitleTextareaCssProps(input, { "--tn-task-modal-title-height": "auto" });
	const nextHeight = Math.min(input.scrollHeight, maxHeight);
	setTaskModalTitleTextareaCssProps(input, {
		"--tn-task-modal-title-height": `${nextHeight}px`,
		"--tn-task-modal-title-overflow-y": input.scrollHeight > maxHeight ? "auto" : "hidden",
	});
}

export function setTaskModalTitleTextareaCssProps(
	input: HTMLTextAreaElement,
	props: Record<string, string>
): void {
	if (typeof input.setCssProps === "function") {
		input.setCssProps(props);
		return;
	}

	for (const [property, value] of Object.entries(props)) {
		input.style.setProperty(property, value);
	}
}
