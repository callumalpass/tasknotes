import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv";

const require = createRequire(import.meta.url);

test("MCP and ajv-formats share the pinned runtime AJV", () => {
	const sdkRequire = createRequire(require.resolve("@modelcontextprotocol/sdk/server/index.js"));
	const formatsRequire = createRequire(sdkRequire.resolve("ajv-formats"));
	assert.equal(sdkRequire.resolve("ajv"), require.resolve("ajv"));
	assert.equal(formatsRequire.resolve("ajv"), require.resolve("ajv"));
	assert.equal(require("ajv/package.json").version, "8.20.0");
});

test("MCP JSON Schema validation retains format and format-limit checks", () => {
	const validate = new AjvJsonSchemaValidator().getValidator({
		type: "object",
		required: ["email", "date"],
		additionalProperties: false,
		properties: {
			email: { type: "string", format: "email" },
			date: { type: "string", format: "date", formatMinimum: "2026-01-01" },
		},
	});
	const valid = { email: "test@example.com", date: "2026-09-15" };
	assert.equal(validate(valid).valid, true);
	for (const input of [
		{ ...valid, email: "not-an-email" },
		{ ...valid, date: "not-a-date" },
		{ ...valid, date: "2025-12-31" },
		{ ...valid, extra: true },
		{ email: valid.email },
	]) {
		const result = validate(input);
		assert.equal(result.valid, false);
		assert.ok(result.errorMessage);
	}
});
