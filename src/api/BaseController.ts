import { IncomingMessage, ServerResponse } from "http";
import { parseJSONBody, sendJSONResponse } from "./httpUtils";

export interface APIResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

export abstract class BaseController {
	protected sendResponse(res: ServerResponse, statusCode: number, data: any): void {
		sendJSONResponse(res, statusCode, data);
	}

	protected successResponse<T>(data: T, message?: string): APIResponse<T> {
		return { success: true, data, message };
	}

	protected errorResponse(error: string): APIResponse {
		return { success: false, error };
	}

	protected async parseRequestBody(req: IncomingMessage): Promise<any> {
		return parseJSONBody(req);
	}
}
