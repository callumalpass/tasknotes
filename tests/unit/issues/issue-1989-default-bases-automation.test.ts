/**
 * Issue #1989: default Base files can be refreshed from automation surfaces.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1989
 */

import { BasesController } from "../../../src/api/BasesController";
import { TaskNotesAPI } from "../../../src/api/TaskNotesAPI";
import type { HTTPRequestLike, HTTPResponseLike } from "../../../src/api/httpTypes";
import { createTaskNotesCommandDefinitions } from "../../../src/commands/taskNotesCommands";
import type TaskNotesPlugin from "../../../src/main";
import { showConfirmationModal } from "../../../src/modals/ConfirmationModal";
import { generateOpenAPISpec } from "../../../src/utils/OpenAPIDecorators";
jest.mock("../../../src/modals/ConfirmationModal", () => ({
	showConfirmationModal: jest.fn(),
}));

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

describe("Issue #1989: default Base file automation", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("registers a confirmed command-palette action for updating default Base files", async () => {
		const definitions = createTaskNotesCommandDefinitions({} as TaskNotesPlugin);
		const command = definitions.find(
			(definition) => definition.id === "update-default-base-files"
		);
		const ctx = {
			app: {},
			i18n: { translate: jest.fn((key: string) => `translated:${key}`) },
			createDefaultBasesFiles: jest.fn(async () => undefined),
		};
		(showConfirmationModal as jest.Mock).mockResolvedValue(true);

		expect(command?.nameKey).toBe("commands.updateDefaultBaseFiles");

		await command?.callback?.(ctx as never);

		expect(showConfirmationModal).toHaveBeenCalledWith(ctx.app, {
			title:
				"translated:settings.integrations.basesIntegration.updateDefaultFiles.confirmTitle",
			message:
				"translated:settings.integrations.basesIntegration.updateDefaultFiles.confirmMessage",
			confirmText:
				"translated:settings.integrations.basesIntegration.updateDefaultFiles.confirmText",
			isDestructive: false,
		});
		expect(ctx.createDefaultBasesFiles).toHaveBeenCalledWith({ overwriteExisting: true });
	});

	it("does not update default Base files when the command confirmation is cancelled", async () => {
		const command = createTaskNotesCommandDefinitions({} as TaskNotesPlugin).find(
			(definition) => definition.id === "update-default-base-files"
		);
		const ctx = {
			app: {},
			i18n: { translate: jest.fn((key: string) => key) },
			createDefaultBasesFiles: jest.fn(async () => undefined),
		};
		(showConfirmationModal as jest.Mock).mockResolvedValue(false);

		await command?.callback?.(ctx as never);

		expect(ctx.createDefaultBasesFiles).not.toHaveBeenCalled();
	});

	it("exposes a runtime API method for updating default Base files", async () => {
		const result = {
			created: [],
			updated: ["TaskNotes/Views/tasks-default.base"],
			skipped: ["TaskNotes/Views/calendar-default.base"],
		};
		const plugin = {
			updateDefaultBasesFiles: jest.fn(async () => result),
		} as unknown as TaskNotesPlugin;
		const api = new TaskNotesAPI(plugin);

		expect(api.capabilities).toContain("bases.write");
		expect(typeof api.bases.updateDefaultFiles).toBe("function");
		await expect(api.bases.updateDefaultFiles()).resolves.toEqual(result);
		expect(plugin.updateDefaultBasesFiles).toHaveBeenCalledTimes(1);
	});

	it("updates default Base files through the HTTP API controller", async () => {
		const result = {
			created: [],
			updated: ["TaskNotes/Views/tasks-default.base"],
			skipped: [],
		};
		const plugin = {
			updateDefaultBasesFiles: jest.fn(async () => result),
		} as unknown as TaskNotesPlugin;
		const controller = new BasesController(plugin);
		const response = createResponse();

		await controller.updateDefaultFiles({} as HTTPRequestLike, response);

		expect(plugin.updateDefaultBasesFiles).toHaveBeenCalledTimes(1);
		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body ?? "{}")).toEqual({
			success: true,
			data: result,
		});
	});

	it("documents the HTTP update endpoint in generated OpenAPI metadata", () => {
		const controller = new BasesController({} as TaskNotesPlugin);
		const spec = generateOpenAPISpec(controller);

		expect(spec.paths["/api/bases/default-files/update"].post).toMatchObject({
			operationId: "updateDefaultBaseFiles",
			tags: ["Bases"],
		});
	});
});
