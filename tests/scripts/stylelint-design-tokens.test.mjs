import assert from "node:assert/strict";
import test from "node:test";
import stylelint from "stylelint";
import config from "../../stylelint.config.mjs";

async function tokenWarnings(code, file = "styles/token-contract-fixture.css") {
	const result = await stylelint.lint({ code, codeFilename: file, config });
	return result.results.flatMap((entry) => entry.warnings).filter((warning) => warning.rule === "tasknotes/design-tokens");
}

test("design tokens reject raw dimensions, fallback values, custom properties and hex colours", async () => {
	for (const declaration of [
		"font-size: 13px",
		"font: 500 13px/1.4 var(--font-interface)",
		"font-size: var(--tn-type-sm, 13px)",
		"border-radius: 0 4px",
		"border-top-left-radius: 50%",
		"--custom-font-size: 1rem",
		"--custom-radius: 4px",
		"color: #fff",
		"--custom-colour: #abcdef",
	]) {
		assert.equal((await tokenWarnings(`.tasknotes-plugin { ${declaration}; }`)).length, 1, declaration);
	}
});

test("design tokens permit theme values and the canonical token source", async () => {
	const code = ".tasknotes-plugin { font-size: var(--tn-type-sm); border-radius: var(--tn-radius-md); color: var(--text-normal); }";
	assert.equal((await tokenWarnings(code)).length, 0);
	assert.equal((await tokenWarnings(".tasknotes-plugin { --tn-type-base: 16px; border-radius: 4px; color: #ffffff; }", "styles/tokens.css")).length, 0);
});
