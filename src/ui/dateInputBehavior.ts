const COMPACT_DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;
const SEPARATED_DATE_PATTERN = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
const DEFAULT_TYPE_BUFFER_RESET_MS = 1500;

export interface DateInputBehaviorOptions {
	onCommit?: (value: string) => void;
	now?: () => number;
	typeBufferResetMs?: number;
}

function padDatePart(value: string): string {
	return value.padStart(2, "0");
}

function toValidDateValue(year: string, month: string, day: string): string | null {
	const yearNumber = Number(year);
	const monthNumber = Number(month);
	const dayNumber = Number(day);
	const date = new Date(yearNumber, monthNumber - 1, dayNumber);

	if (
		date.getFullYear() !== yearNumber ||
		date.getMonth() !== monthNumber - 1 ||
		date.getDate() !== dayNumber
	) {
		return null;
	}

	return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

export function normalizeDateEntryValue(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const compactMatch = COMPACT_DATE_PATTERN.exec(trimmed);
	if (compactMatch) {
		return toValidDateValue(compactMatch[1], compactMatch[2], compactMatch[3]);
	}

	const separatedMatch = SEPARATED_DATE_PATTERN.exec(trimmed);
	if (separatedMatch) {
		return toValidDateValue(separatedMatch[1], separatedMatch[2], separatedMatch[3]);
	}

	return null;
}

function commitDateInputValue(
	inputEl: HTMLInputElement,
	value: string,
	options: DateInputBehaviorOptions
): void {
	inputEl.value = value;
	options.onCommit?.(value);
	inputEl.dispatchEvent(new Event("input", { bubbles: true }));
	inputEl.dispatchEvent(new Event("change", { bubbles: true }));
}

function isPlainDigitKey(event: KeyboardEvent): boolean {
	return (
		event.key.length === 1 &&
		/\d/.test(event.key) &&
		!event.altKey &&
		!event.ctrlKey &&
		!event.metaKey
	);
}

export function attachDateInputBehavior(
	inputEl: HTMLInputElement,
	options: DateInputBehaviorOptions = {}
): () => void {
	let digitBuffer = "";
	let lastDigitAt = 0;
	const now = options.now ?? (() => Date.now());
	const resetMs = options.typeBufferResetMs ?? DEFAULT_TYPE_BUFFER_RESET_MS;

	const handleKeydown = (event: KeyboardEvent) => {
		if (!isPlainDigitKey(event)) return;

		const eventTime = now();
		if (eventTime - lastDigitAt > resetMs) {
			digitBuffer = "";
		}

		lastDigitAt = eventTime;
		digitBuffer = `${digitBuffer}${event.key}`.slice(-8);

		const normalized = normalizeDateEntryValue(digitBuffer);
		if (!normalized) return;

		event.preventDefault();
		digitBuffer = "";
		commitDateInputValue(inputEl, normalized, options);
	};

	const handlePaste = (event: ClipboardEvent) => {
		const pastedText = event.clipboardData?.getData("text") ?? "";
		const normalized = normalizeDateEntryValue(pastedText);
		if (!normalized) return;

		event.preventDefault();
		digitBuffer = "";
		commitDateInputValue(inputEl, normalized, options);
	};

	const handleInput = () => {
		const normalized = normalizeDateEntryValue(inputEl.value);
		if (!normalized || normalized === inputEl.value) return;

		digitBuffer = "";
		commitDateInputValue(inputEl, normalized, options);
	};

	inputEl.addEventListener("keydown", handleKeydown);
	inputEl.addEventListener("paste", handlePaste);
	inputEl.addEventListener("input", handleInput);

	return () => {
		inputEl.removeEventListener("keydown", handleKeydown);
		inputEl.removeEventListener("paste", handlePaste);
		inputEl.removeEventListener("input", handleInput);
	};
}
