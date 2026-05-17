/**
 * Issue #1463: HTTP API FilterQuery documentation should be usable.
 *
 * The query endpoint is the supported filtering path for API clients. Its docs
 * and generated OpenAPI metadata should show the payload shape directly,
 * including the common context-filter use case.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1463
 */

import { readFileSync } from "fs";
import { TasksController } from "../../../src/api/TasksController";
import { generateOpenAPISpec } from "../../../src/utils/OpenAPIDecorators";
import { PluginFactory } from "../../helpers/mock-factories";

type SchemaObject = {
	properties?: Record<string, unknown>;
	requestBody?: unknown;
};

function createController() {
	const plugin = PluginFactory.createMockPlugin();

	return new TasksController(
		plugin,
		{} as never,
		{} as never,
		plugin.cacheManager as never,
		{} as never
	);
}

describe("Issue #1463: HTTP API FilterQuery docs", () => {
	it("documents context filtering inline instead of pointing to missing FilterQuery docs", () => {
		const docs = readFileSync("docs/HTTP_API.md", "utf8");

		expect(docs).not.toContain("TaskNotes FilterQuery documentation");
		expect(docs).toContain("Filter tasks by context");
		expect(docs).toContain('"property": "contexts"');
		expect(docs).toContain('"operator": "contains"');
		expect(docs).toContain('"value": "@office"');
		expect(docs).toContain('For user-defined fields, use `property: "user:<fieldId>"`.');
	});

	it("exposes FilterQuery schemas and a request body in generated OpenAPI docs", () => {
		const spec = generateOpenAPISpec(createController());
		const queryOperation = spec.paths["/api/tasks/query"].post as SchemaObject;
		const schemas = spec.components.schemas as Record<string, SchemaObject>;

		expect(queryOperation.requestBody).toMatchObject({
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/FilterQuery",
					},
				},
			},
		});
		expect(schemas.FilterQuery).toBeDefined();
		expect(schemas.FilterGroup).toBeDefined();
		expect(schemas.FilterCondition.properties?.property).toMatchObject({
			enum: expect.arrayContaining(["contexts", "status.isCompleted"]),
		});
		expect(schemas.FilterCondition.properties?.operator).toMatchObject({
			enum: expect.arrayContaining(["contains", "is-not-checked"]),
		});
	});
});
