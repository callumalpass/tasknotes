import { clearStaticStyleClasses, STATIC_STYLE_CLASSES } from "../../../src/utils/staticStyleClasses";

describe("static style classes", () => {
	it("exports a unique class list", () => {
		expect(new Set(STATIC_STYLE_CLASSES).size).toBe(STATIC_STYLE_CLASSES.length);
	});

	it("clears migrated static style classes and inline styles", () => {
		const element = document.createElement("div");
		element.classList.add(STATIC_STYLE_CLASSES[0], "unrelated-class");
		element.setAttribute("style", "display: none; color: red;");

		clearStaticStyleClasses(element);

		expect(element.classList.contains(STATIC_STYLE_CLASSES[0])).toBe(false);
		expect(element.classList.contains("unrelated-class")).toBe(true);
		expect(element.hasAttribute("style")).toBe(false);
	});
});
