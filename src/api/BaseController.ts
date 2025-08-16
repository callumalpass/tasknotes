import { IncomingMessage, ServerResponse } from 'http';

export interface APIResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

export abstract class BaseController {
	protected sendResponse(res: ServerResponse, statusCode: number, data: any): void {
		res.statusCode = statusCode;
		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		res.end(JSON.stringify(data));
	}

	protected successResponse<T>(data: T, message?: string): APIResponse<T> {
		return { success: true, data, message };
	}

	protected errorResponse(error: string): APIResponse {
		return { success: false, error };
	}

	protected async parseRequestBody(req: IncomingMessage): Promise<any> {
		return new Promise((resolve, reject) => {
			let body = '';
			req.on('data', chunk => {
				body += chunk.toString();
			});
			req.on('end', () => {
				try {
					resolve(body ? JSON.parse(body) : {});
				} catch (error) {
					reject(new Error('Invalid JSON'));
				}
			});
			req.on('error', reject);
		});
	}
}