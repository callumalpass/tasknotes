const OBSIDIAN_THEME_COLOR_NAMES = [
	"red",
	"orange",
	"yellow",
	"green",
	"cyan",
	"blue",
	"purple",
	"pink",
] as const;

const OBSIDIAN_THEME_COLOR_SET = new Set<string>(OBSIDIAN_THEME_COLOR_NAMES);
const CSS_VARIABLE_PATTERN = /^var\(\s*(--[a-z0-9_-]+)\s*\)$/i;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const CSS_COLOR_FUNCTION_PATTERN = /^(?:rgb|rgba|hsl|hsla|oklch|lab|color|color-mix)\(/i;

export const THEME_COLOR_INPUT_PLACEHOLDER = "#6366f1, red, blue, cyan";
export const THEME_COLOR_SUGGESTIONS = [
	...OBSIDIAN_THEME_COLOR_NAMES,
	"accent",
	"var(--color-accent)",
] as const;

export function normalizeThemeColor(value: string | null | undefined, fallback = ""): string {
	const trimmed = value?.trim() ?? "";
	if (!trimmed) return fallback;

	const lower = trimmed.toLowerCase();
	if (OBSIDIAN_THEME_COLOR_SET.has(lower)) {
		return `var(--color-${lower})`;
	}
	if (lower === "accent") {
		return "var(--color-accent)";
	}
	if (lower.startsWith("color-")) {
		const colorName = lower.slice("color-".length);
		if (OBSIDIAN_THEME_COLOR_SET.has(colorName) || colorName === "accent") {
			return `var(--${lower})`;
		}
	}
	if (lower.startsWith("--")) {
		return `var(${trimmed})`;
	}

	return trimmed;
}

export function colorValueToInputValue(value: string | null | undefined): string {
	const trimmed = value?.trim() ?? "";
	const match = trimmed.match(CSS_VARIABLE_PATTERN);
	if (!match) return trimmed;

	const variableName = match[1].toLowerCase();
	if (variableName === "--color-accent") return "accent";

	const colorName = variableName.replace(/^--color-/, "");
	return OBSIDIAN_THEME_COLOR_SET.has(colorName) ? colorName : trimmed;
}

export function isCssVariableColor(value: string | null | undefined): boolean {
	return normalizeThemeColor(value).startsWith("var(");
}

export function isSupportedColorValue(value: string | null | undefined): boolean {
	const normalized = normalizeThemeColor(value);
	if (!normalized) return false;
	if (HEX_COLOR_PATTERN.test(normalized)) return true;
	if (isCssVariableColor(normalized)) return true;
	if (CSS_COLOR_FUNCTION_PATTERN.test(normalized)) return true;

	return false;
}

export function colorWithAlpha(value: string, alpha: number): string {
	const normalized = normalizeThemeColor(value);
	if (!normalized) {
		return `rgba(128, 128, 128, ${alpha})`;
	}
	if (isCssVariableColor(normalized) || CSS_COLOR_FUNCTION_PATTERN.test(normalized)) {
		return `color-mix(in srgb, ${normalized} ${Math.round(alpha * 100)}%, transparent)`;
	}

	const hex = normalized.replace("#", "");
	if (/^[0-9a-f]{3}$/i.test(hex)) {
		const r = parseInt(hex[0] + hex[0], 16);
		const g = parseInt(hex[1] + hex[1], 16);
		const b = parseInt(hex[2] + hex[2], 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}
	if (!/^[0-9a-f]{6}$/i.test(hex)) {
		return `rgba(128, 128, 128, ${alpha})`;
	}

	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
