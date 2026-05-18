import type { HTTPRequestLike, HTTPResponseLike } from "../../../src/api/httpTypes";
import { SystemController } from "../../../src/api/SystemController";
import type TaskNotesPlugin from "../../../src/main";
import type { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import type { TaskService } from "../../../src/services/TaskService";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";

function createPlugin(): TaskNotesPlugin {
	return {
		settings: {
			...DEFAULT_SETTINGS,
			defaultTaskStatus: "triage",
			defaultTaskPriority: "normal",
			userFields: [
				{
					id: "reviewed",
					key: "reviewed",
					displayName: "Reviewed",
					type: "boolean",
				},
			],
		},
	} as unknown as TaskNotesPlugin;
}

function createRequest(body: unknown): HTTPRequestLike {
	const payload = JSON.stringify(body);
	return {
		headers: {},
		on: (
			event: "data" | "end" | "error",
			listener: ((chunk: string) => void) | (() => void) | ((error: Error) => void)
		): void => {
			if (event === "data") {
				(listener as (chunk: string) => void)(payload);
			}
			if (event === "end") {
				(listener as () => void)();
			}
		},
	};
}

function createResponse(): HTTPResponseLike & {
	headers: Record<string, string>;
	body?: string;
	json: () => any;
} {
	return {
		statusCode: 0,
		headers: {},
		setHeader(name: string, value: string): void {
			this.headers[name] = value;
		},
		writeHead(statusCode: number, headers?: Record<string, string>): void {
			this.statusCode = statusCode;
			if (headers) {
				Object.assign(this.headers, headers);
			}
		},
		end(data?: string): void {
			this.body = data;
		},
		json(): any {
			return this.body ? JSON.parse(this.body) : undefined;
		},
	};
}

const parsedTask = {
	title: "Review PR",
	details: "Check release notes",
	priority: "high",
	dueDate: "2026-05-20",
	dueTime: "09:30",
	scheduledDate: "2026-05-19",
	scheduledTime: "08:15",
	tags: ["release"],
	contexts: ["work"],
	projects: ["[[Roadmap]]"],
	recurrence: "FREQ=WEEKLY",
	estimate: 30,
	isCompleted: false,
	userFields: {
		reviewed: true,
	},
};

function createParser(): NaturalLanguageParser {
	return {
		parseInput: jest.fn(() => parsedTask),
	} as unknown as NaturalLanguageParser;
}

describe("SystemController NLP task data", () => {
	it("uses the shared parsed-task creation builder for NLP parse responses", async () => {
		const parser = createParser();
		const controller = new SystemController(
			createPlugin(),
			{} as TaskService,
			parser
		);
		const response = createResponse();

		await controller.handleNLPParse(createRequest({ text: "review pr" }), response);

		expect(response.statusCode).toBe(200);
		expect(parser.parseInput).toHaveBeenCalledWith("review pr");
		expect(response.json().data.taskData).toMatchObject({
			title: "Review PR",
			details: "Check release notes",
			status: "triage",
			priority: "high",
			due: "2026-05-20T09:30",
			scheduled: "2026-05-19T08:15",
			tags: ["release"],
			contexts: ["work"],
			projects: ["[[Roadmap]]"],
			recurrence: "FREQ=WEEKLY",
			timeEstimate: 30,
			customFrontmatter: {
				reviewed: true,
			},
		});
	});

	it("uses the same shared builder when creating from NLP text", async () => {
		const parser = createParser();
		const taskService = {
			createTask: jest.fn(async (taskData) => ({
				file: { path: "Tasks/review-pr.md" },
				taskInfo: {
					...taskData,
					path: "Tasks/review-pr.md",
					archived: false,
				},
			})),
		} as unknown as TaskService;
		const controller = new SystemController(createPlugin(), taskService, parser);
		const response = createResponse();

		await controller.handleNLPCreate(createRequest({ text: "review pr" }), response);

		expect(response.statusCode).toBe(201);
		expect(taskService.createTask).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Review PR",
				status: "triage",
				priority: "high",
				due: "2026-05-20T09:30",
				scheduled: "2026-05-19T08:15",
				creationContext: "api",
				customFrontmatter: {
					reviewed: true,
				},
			})
		);
		expect(response.json().data.task).toMatchObject({
			title: "Review PR",
			path: "Tasks/review-pr.md",
		});
	});
});
