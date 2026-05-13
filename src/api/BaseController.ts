import type { HTTPRequestLike, HTTPResponseLike } from "./httpTypes";
import { parseJSONBody, sendJSONResponse } from "./httpUtils";

export interface APIResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

export abstract class BaseController {
	protected sendResponse(res: HTTPResponseLike, statusCode: number, data: unknown): void {
		sendJSONResponse(res, statusCode, data);
	}

	protected successResponse<T>(data: T, message?: string): APIResponse<T> {
		return { success: true, data, message };
	}

	protected errorResponse(error: string): APIResponse {
		return { success: false, error };
	}

	protected getErrorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}

	protected async parseRequestBody<T extends object = Record<string, unknown>>(
		req: HTTPRequestLike
	): Promise<T> {
		return (await parseJSONBody(req)) as T;
	}
}
