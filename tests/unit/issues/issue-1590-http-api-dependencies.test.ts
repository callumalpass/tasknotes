/**
 * Issue #1590: HTTP API task creation should expose dependency fields.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1590
 */

import { TasksController } from "../../../src/api/TasksController";
import type { HTTPRequestLike, HTTPResponseLike } from "../../../src/api/httpTypes";
import { generateOpenAPISpec } from "../../../src/utils/OpenAPIDecorators";
import { PluginFactory } from "../../helpers/mock-factories";
import type { TaskDependency } from "../../../src/types";

type SchemaObject = {
	properties?: Record<
		string,
		{
			items?: { $ref?: string };
			readOnly?: boolean;
		}
	>;
};

function createJsonRequest(body: unknown): HTTPRequestLike {
	return {
		headers: { "content-type": "application/json" },
		on(event, listener) {
			if (event === "data") {
				listener(JSON.stringify(body));
			}
			if (event === "end") {
				listener();
			}
		},
	};
}

function createResponse(): HTTPResponseLike & { body?: string } {
	return {
		statusCode: 0,
		setHeader: jest.fn(),
		writeHead: jest.fn(),
		end: jest.fn(function (this: { body?: string }, data?: string) {
			this.body = data;
		}),
	};
}

function createController(taskService: { createTask: jest.Mock }) {
	const plugin = PluginFactory.createMockPlugin();
	return new TasksController(
		plugin,
		taskService as never,
		{} as never,
		plugin.cacheManager as never,
		{} as never
	);
}

describe("Issue #1590: HTTP API dependency creation", () => {
	it("passes blockedBy from POST /api/tasks to the task service", async () => {
		const blockedBy: TaskDependency[] = [
			{
				uid: "[[Draft docs]]",
				reltype: "FINISHTOSTART",
			},
		];
		const taskService = {
			createTask: jest.fn(async (taskData) => ({
				taskInfo: {
					...taskData,
					path: "Tasks/review-docs.md",
					archived: false,
				},
			})),
		};
		const controller = createController(taskService);
		const res = createResponse();

		await controller.createTask(
			createJsonRequest({
				title: "Review docs",
				priority: "high",
				blockedBy,
			}),
			res
		);

		expect(taskService.createTask).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Review docs",
				blockedBy,
			})
		);
		expect(res.statusCode).toBe(201);

		const responseBody = JSON.parse(res.body ?? "{}");
		expect(responseBody.data.blockedBy).toEqual(blockedBy);
	});

	it("documents blockedBy as writable and blocking as read-only in the OpenAPI schema", () => {
		const controller = createController({ createTask: jest.fn() });
		const spec = generateOpenAPISpec(controller);
		const schemas = spec.components.schemas as Record<string, SchemaObject>;

		expect(schemas.TaskCreationData.properties.blockedBy.items.$ref).toBe(
			"#/components/schemas/TaskDependency"
		);
		expect(schemas.Task.properties.blockedBy.items.$ref).toBe(
			"#/components/schemas/TaskDependency"
		);
		expect(schemas.Task.properties.blocking.readOnly).toBe(true);
	});
});
