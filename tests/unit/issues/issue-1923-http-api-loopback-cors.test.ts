jest.mock("http", () => ({
	createServer: jest.fn(),
}));

jest.mock("../../../src/services/MCPService", () => ({
	MCPService: jest.fn().mockImplementation(() => ({
		handleRequest: jest.fn(),
	})),
}));

import http from "http";
import type { HTTPRequestLike, HTTPResponseLike } from "../../../src/api/httpTypes";
import { resolveLocalCORSOrigin } from "../../../src/api/httpUtils";
import type TaskNotesPlugin from "../../../src/main";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { FilterService } from "../../../src/services/FilterService";
import { API_BIND_HOST, HTTPAPIService } from "../../../src/services/HTTPAPIService";
import { TaskService } from "../../../src/services/TaskService";
import { TaskManager } from "../../../src/utils/TaskManager";

type CreateServerMock = jest.MockedFunction<typeof http.createServer>;

interface MockHTTPServer {
	listening: boolean;
	listen: jest.Mock<void, [number, string, () => void]>;
	close: jest.Mock<void, [(() => void)?]>;
	on: jest.Mock<void, [string, (error: Error) => void]>;
	once: jest.Mock<void, [string, () => void]>;
}

function createMockServer(): MockHTTPServer {
	return {
		listening: false,
		listen: jest.fn((_port: number, _host: string, callback: () => void) => {
			callback();
		}),
		close: jest.fn((callback?: () => void) => {
			callback?.();
		}),
		on: jest.fn(),
		once: jest.fn(),
	};
}

function createPlugin(): TaskNotesPlugin {
	return {
		settings: {
			...DEFAULT_SETTINGS,
			enableAPI: true,
			apiPort: 9191,
			apiAuthToken: "",
		},
		app: {
			vault: {
				getName: () => "test",
				adapter: {},
			},
		},
		manifest: {
			version: "0.0.0-test",
		},
		oauthService: {},
		icsSubscriptionService: {
			getSubscriptions: jest.fn(() => []),
		},
		calendarProviderRegistry: {},
		saveSettings: jest.fn(),
	} as unknown as TaskNotesPlugin;
}

function createService(): HTTPAPIService {
	return new HTTPAPIService(
		createPlugin(),
		{} as TaskService,
		{} as FilterService,
		{
			getAllTasks: jest.fn(async () => []),
		} as unknown as TaskManager
	);
}

function createRequest(origin?: string): HTTPRequestLike {
	return {
		method: "GET",
		url: "/api/health",
		headers: origin ? { origin } : {},
		on: jest.fn(),
	};
}

function createResponse(): HTTPResponseLike & {
	headers: Record<string, string>;
	body?: string;
	json: () => unknown;
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
		json(): unknown {
			return this.body ? JSON.parse(this.body) : undefined;
		},
	};
}

async function handleRequest(
	service: HTTPAPIService,
	req: HTTPRequestLike,
	res: HTTPResponseLike
): Promise<void> {
	await (
		service as unknown as {
			handleRequest(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void>;
		}
	).handleRequest(req, res);
}

describe("Issue #1923: HTTP API loopback binding and CORS", () => {
	beforeEach(() => {
		(http.createServer as CreateServerMock).mockReset();
	});

	it("binds the HTTP API server to loopback instead of all interfaces", async () => {
		const server = createMockServer();
		(http.createServer as CreateServerMock).mockReturnValue(server as never);

		await createService().start();

		expect(server.listen).toHaveBeenCalledWith(9191, API_BIND_HOST, expect.any(Function));
	});

	it("allows browser CORS requests from loopback origins", async () => {
		const service = createService();
		const response = createResponse();

		await handleRequest(service, createRequest("http://localhost:5173"), response);

		expect(response.statusCode).toBe(200);
		expect(response.headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
		expect(response.json()).toMatchObject({ success: true });
	});

	it("allows Chrome extension origins for the browser extension", async () => {
		const service = createService();
		const response = createResponse();
		const extensionOrigin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

		await handleRequest(service, createRequest(extensionOrigin), response);

		expect(response.statusCode).toBe(200);
		expect(response.headers["Access-Control-Allow-Origin"]).toBe(extensionOrigin);
		expect(response.json()).toMatchObject({ success: true });
	});

	it("rejects browser CORS requests from non-loopback origins", async () => {
		const service = createService();
		const response = createResponse();

		await handleRequest(service, createRequest("http://192.168.1.20:5173"), response);

		expect(response.statusCode).toBe(403);
		expect(response.headers["Access-Control-Allow-Origin"]).toBeUndefined();
		expect(response.json()).toEqual({
			success: false,
			error: "CORS origin is not allowed",
		});
	});

	it("rejects malformed Chrome extension origins", async () => {
		expect(
			resolveLocalCORSOrigin(
				"chrome-extension://abcdefghijklmnopabcdefghijklmnop/options.html",
				"http://127.0.0.1:9191"
			)
		).toBeUndefined();
	});

	it("does not use a wildcard fallback for requests without an Origin header", async () => {
		expect(resolveLocalCORSOrigin(undefined, "http://127.0.0.1:9191")).toBe(
			"http://127.0.0.1:9191"
		);
		expect(resolveLocalCORSOrigin("http://192.168.1.20:5173", "http://127.0.0.1:9191"))
			.toBeUndefined();
	});
});
