import {
	colorValueToInputValue,
	colorWithAlpha,
	isSupportedColorValue,
	normalizeThemeColor,
} from "../../../src/utils/themeColors";

describe("theme color utilities", () => {
	it("maps Obsidian color names to theme CSS variables", () => {
		expect(normalizeThemeColor("red")).toBe("var(--color-red)");
		expect(normalizeThemeColor("BLUE")).toBe("var(--color-blue)");
		expect(normalizeThemeColor("cyan")).toBe("var(--color-cyan)");
		expect(normalizeThemeColor("accent")).toBe("var(--color-accent)");
	});

	it("keeps hex colors and existing CSS variables usable", () => {
		expect(normalizeThemeColor("#6366f1")).toBe("#6366f1");
		expect(normalizeThemeColor("var(--color-green)")).toBe("var(--color-green)");
		expect(normalizeThemeColor("--color-purple")).toBe("var(--color-purple)");
	});

	it("shows short theme names in settings inputs", () => {
		expect(colorValueToInputValue("var(--color-red)")).toBe("red");
		expect(colorValueToInputValue("var(--color-accent)")).toBe("accent");
		expect(colorValueToInputValue("#6366f1")).toBe("#6366f1");
	});

	it("supports theme colors in validation and translucent calendar backgrounds", () => {
		expect(isSupportedColorValue("red")).toBe(true);
		expect(isSupportedColorValue("var(--color-blue)")).toBe(true);
		expect(isSupportedColorValue("#123abc")).toBe(true);
		expect(colorWithAlpha("red", 0.2)).toBe(
			"color-mix(in srgb, var(--color-red) 20%, transparent)"
		);
		expect(colorWithAlpha("#369", 0.5)).toBe("rgba(51, 102, 153, 0.5)");
	});
});
