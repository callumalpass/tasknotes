/**
 * Issue #1464: GET /api/tasks should recognize context as a filter query key.
 *
 * GET /api/tasks is intentionally pagination-only. Matching project behavior,
 * context filters should return the advanced-query guidance instead of being
 * silently ignored.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1464
 */

import { TasksController } from "../../../src/api/TasksController";
import type { HTTPRequestLike, HTTPResponseLike } from "../../../src/api/httpTypes";
import { PluginFactory } from "../../helpers/mock-factories";

function createRequest(url: string): HTTPRequestLike {
	return {
		url,
		headers: {},
		on: jest.fn(),
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

function createController(cacheManager: { getAllTasks: jest.Mock }) {
	const plugin = PluginFactory.createMockPlugin();

	return new TasksController(
		plugin,
		{} as never,
		{} as never,
		cacheManager as never,
		{} as never
	);
}

describe("Issue #1464: HTTP API context query parameter", () => {
	it("rejects context filters on GET /api/tasks with the same advanced-query guidance as project", async () => {
		const cacheManager = { getAllTasks: jest.fn() };
		const controller = createController(cacheManager);
		const res = createResponse();

		await controller.getTasks(createRequest("/api/tasks?context=@office"), res);

		expect(res.statusCode).toBe(400);
		expect(cacheManager.getAllTasks).not.toHaveBeenCalled();

		const responseBody = JSON.parse(res.body ?? "{}");
		expect(responseBody.success).toBe(false);
		expect(responseBody.error).toContain("POST /api/tasks/query");
	});
});
