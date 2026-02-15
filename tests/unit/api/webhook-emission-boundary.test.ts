import fs from "fs";
import path from "path";

function readWorkspaceFile(relativePath: string): string {
	const filePath = path.resolve(process.cwd(), relativePath);
	return fs.readFileSync(filePath, "utf8");
}

function countTriggerWebhookCalls(source: string): number {
	return (source.match(/\btriggerWebhook\s*\(/g) || []).length;
}

describe("Webhook emission boundary", () => {
	it("keeps API and MCP layers free of direct webhook emissions", () => {
		const boundaryFiles = [
			"src/api/TasksController.ts",
			"src/api/TimeTrackingController.ts",
			"src/api/SystemController.ts",
			"src/services/MCPService.ts",
		];

		for (const file of boundaryFiles) {
			const source = readWorkspaceFile(file);
			expect(countTriggerWebhookCalls(source)).toBe(0);
		}
	});

	it("keeps webhook emission in service/domain layer", () => {
		const taskServiceSource = readWorkspaceFile("src/services/TaskService.ts");
		expect(countTriggerWebhookCalls(taskServiceSource)).toBeGreaterThan(0);
	});
});
