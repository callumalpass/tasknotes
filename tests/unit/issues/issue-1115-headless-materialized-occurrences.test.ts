/**
 * Issue #1115 follow-up: headless APIs should support materialized occurrences.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1115
 */

import { TasksController } from "../../../src/api/TasksController";
import type { HTTPRequestLike, HTTPResponseLike } from "../../../src/api/httpTypes";
import type { TaskInfo } from "../../../src/types";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

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

function createController(task: TaskInfo, taskService: Record<string, jest.Mock>) {
	const plugin = PluginFactory.createMockPlugin();
	plugin.cacheManager.getTaskInfo = jest.fn(async (path: string) =>
		path === task.path ? task : null
	);

	return new TasksController(
		plugin,
		taskService as never,
		{} as never,
		plugin.cacheManager as never,
		{} as never
	);
}

describe("Issue #1115: headless materialized occurrence APIs", () => {
	it("uses materialized occurrence semantics from POST /api/tasks/:id/complete-instance", async () => {
		const parent = TaskFactory.createTask({
			path: "Tasks/daily.md",
			recurrence: "DTSTART:20260601;FREQ=DAILY",
			occurrence_materialization: "on_completion",
		});
		const updated = { ...parent, path: "Tasks/daily-2026-06-01.md" };
		const taskService = {
			toggleRecurringTaskCompleteWithOccurrenceNotes: jest.fn(async () => updated),
		};
		const controller = createController(parent, taskService);
		const res = createResponse();

		await controller.completeRecurringInstance(
			createJsonRequest({ date: "2026-06-01" }),
			res,
			{ id: parent.path }
		);

		expect(taskService.toggleRecurringTaskCompleteWithOccurrenceNotes).toHaveBeenCalledWith(
			parent,
			new Date("2026-06-01")
		);
		expect(res.statusCode).toBe(200);
		expect(JSON.parse(res.body ?? "{}").data.path).toBe(updated.path);
	});

	it("materializes an occurrence from POST /api/tasks/:id/materialize-occurrence", async () => {
		const parent = TaskFactory.createTask({
			path: "Tasks/daily.md",
			recurrence: "DTSTART:20260601;FREQ=DAILY",
		});
		const occurrence = TaskFactory.createTask({
			path: "Tasks/daily-2026-06-01.md",
			recurrence_parent: "[[Tasks/daily]]",
			occurrence_date: "2026-06-01",
		});
		const taskService = {
			materializeOccurrence: jest.fn(async () => occurrence),
		};
		const controller = createController(parent, taskService);
		const res = createResponse();

		await controller.materializeOccurrence(
			createJsonRequest({ date: "2026-06-01" }),
			res,
			{ id: parent.path }
		);

		expect(taskService.materializeOccurrence).toHaveBeenCalledWith(parent, "2026-06-01");
		expect(res.statusCode).toBe(200);
		expect(JSON.parse(res.body ?? "{}").data.occurrence_date).toBe("2026-06-01");
	});
});
