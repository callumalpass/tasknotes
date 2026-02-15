import { IncomingMessage, ServerResponse } from "http";

const DEFAULT_ALLOW_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const DEFAULT_ALLOW_HEADERS = "Content-Type, Authorization";

export function setCORSHeaders(
	res: ServerResponse,
	options?: { allowMethods?: string; allowHeaders?: string; allowOrigin?: string }
): void {
	res.setHeader("Access-Control-Allow-Origin", options?.allowOrigin ?? "*");
	res.setHeader("Access-Control-Allow-Methods", options?.allowMethods ?? DEFAULT_ALLOW_METHODS);
	res.setHeader("Access-Control-Allow-Headers", options?.allowHeaders ?? DEFAULT_ALLOW_HEADERS);
}

export function sendJSONResponse(res: ServerResponse, statusCode: number, data: unknown): void {
	res.statusCode = statusCode;
	res.setHeader("Content-Type", "application/json");
	setCORSHeaders(res);
	res.end(JSON.stringify(data));
}

export function parseJSONBody(req: IncomingMessage): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", (chunk: Buffer | string) => {
			body += chunk.toString();
		});
		req.on("end", () => {
			try {
				resolve(body ? JSON.parse(body) : {});
			} catch {
				reject(new Error("Invalid JSON"));
			}
		});
		req.on("error", reject);
	});
}
