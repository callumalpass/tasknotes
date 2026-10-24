import type TaskNotesPlugin from "../main";
import { BaseController } from "./BaseController";
import type { HTTPRequestLike, HTTPResponseLike } from "./httpTypes";
import { OpenAPI, Post } from "../utils/OpenAPIDecorators";

export class BasesController extends BaseController {
	constructor(private plugin: TaskNotesPlugin) {
		super();
	}

	@OpenAPI({
		summary: "Update default Base files",
		description:
			"Overwrite the configured default TaskNotes .base files with templates generated from current settings.",
		operationId: "updateDefaultBaseFiles",
		tags: ["Bases"],
		responses: {
			"200": {
				description: "Default Base files updated",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								success: { type: "boolean" },
								data: {
									type: "object",
									properties: {
										created: { type: "array", items: { type: "string" } },
										updated: { type: "array", items: { type: "string" } },
										skipped: { type: "array", items: { type: "string" } },
									},
									required: ["created", "updated", "skipped"],
								},
							},
							required: ["success", "data"],
						},
					},
				},
			},
			"500": {
				description: "Default Base files could not be updated",
				content: {
					"application/json": {
						schema: { $ref: "#/components/schemas/Error" },
					},
				},
			},
		},
	})
	@Post("/api/bases/default-files/update")
	async updateDefaultFiles(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const result = await this.plugin.updateDefaultBasesFiles();
			this.sendResponse(res, 200, this.successResponse(result));
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}
}
