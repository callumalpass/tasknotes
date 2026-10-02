import { normalizeContext, normalizeTag } from "../../../src/ui/renderers/tagRenderer";

describe("issue #2258 context and tag card display", () => {
	it.each([
		["Deep Work 🧠", "@Deep Work 🧠"],
		["Admin 👨‍💻", "@Admin 👨‍💻"],
		["Waiting ⏳", "@Waiting ⏳"],
		["Review 👍🏽", "@Review 👍🏽"],
	])("preserves spaces and complete emoji sequences in contexts", (input, expected) => {
		expect(normalizeContext(input)).toBe(expected);
	});

	it.each([
		["important 🔥", "#important 🔥"],
		["pair 👨‍💻", "#pair 👨‍💻"],
		["approved 👍🏽", "#approved 👍🏽"],
	])("preserves spaces and complete emoji sequences in tags", (input, expected) => {
		expect(normalizeTag(input)).toBe(expected);
	});

	it.each([
		"#\uFE0F\u20E3", "*\uFE0F\u20E3", "1\uFE0F\u20E3",
		"#\u20E3", "*\u20E3", "0\u20E3",
		"\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
	])("preserves keycaps and subdivision flags in contexts and tags: %s", (emoji) => {
		for (const prefix of ["", "@"]) {
			expect(normalizeContext(`${prefix}label ${emoji}`)).toBe(`@label ${emoji}`);
		}
		for (const prefix of ["", "#"]) {
			expect(normalizeTag(`${prefix}label ${emoji}`)).toBe(`#label ${emoji}`);
		}
	});

	it("does not admit bare asterisks, hash punctuation in contexts, or stray emoji tags", () => {
		expect(normalizeContext("label # *\t\n\u{E0067}\u{E007F}")).toBe("@label  ");
		expect(normalizeTag("label *\t\n\u{E0067}\u{E007F}")).toBe("#label ");
	});

	it("continues removing punctuation and control characters from display labels", () => {
		expect(normalizeContext("Admin!!!\nTeam")).toBe("@AdminTeam");
		expect(normalizeTag('quote"s;')).toBe("#quotes");
	});
});
