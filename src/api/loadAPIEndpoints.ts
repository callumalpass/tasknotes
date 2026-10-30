import { displayError } from "../i18n/runtime";
import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import { requestUrl, type RequestUrlParam } from "obsidian";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Api/LoadAPIEndpoints" });

type OpenAPIOperationSummary = {
	tags?: string[];
	summary?: string;
	description?: string;
};

type OpenAPISpecSummary = {
	paths?: Record<string, Record<string, OpenAPIOperationSummary>>;
};

type EndpointSummary = {
	method: string;
	path: string;
	summary: string;
};

type LoadAPIEndpointsOptions = {
	apiAuthToken?: string;
};

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function buildAPIEndpointsDocsRequest(
	apiPort = 8080,
	options: LoadAPIEndpointsOptions = {}
): RequestUrlParam {
	const request: RequestUrlParam = {
		url: `http://localhost:${apiPort}/api/docs`,
		throw: false,
	};
	const token = options.apiAuthToken?.trim();

	if (token) {
		request.headers = {
			Authorization: `Bearer ${token}`,
		};
	}

	return request;
}

async function loadAPIEndpoints(
	container: HTMLElement,
	apiPort = 8080,
	options: LoadAPIEndpointsOptions = {}
): Promise<void> {
	// Show loading message first
	const loadingEl = container.createEl("p", {
		text: uiText(msg({ message: "Loading API endpoints...", context: "api/loadAPIEndpoints: loadAPIEndpoints text" })),
		attr: { style: "color: var(--text-muted); font-style: italic; margin: 16px 0;" },
	});

	try {
		const response = await requestUrl(buildAPIEndpointsDocsRequest(apiPort, options));

		if (response.status < 200 || response.status >= 300) {
			throw new Error(`API unavailable (${response.status})`);
		}

		const openApiSpec = response.json as OpenAPISpecSummary;

		// Remove loading message
		loadingEl.remove();

		// Group endpoints by tags/categories
		const endpointsByTag: Record<string, EndpointSummary[]> = {};

		if (openApiSpec.paths) {
			for (const [path, methods] of Object.entries(openApiSpec.paths)) {
				for (const [method, operation] of Object.entries(methods)) {
					const tags = operation.tags || [uiText(msg({ message: "General", context: "api/loadAPIEndpoints: loadAPIEndpoints display" }))];
					const tag = tags[0];

					if (!endpointsByTag[tag]) {
						endpointsByTag[tag] = [];
					}

					endpointsByTag[tag].push({
						method: method.toUpperCase(),
						path,
						summary: operation.summary || operation.description || uiText(msg({ message: "No description", context: "api/loadAPIEndpoints: loadAPIEndpoints summary" })),
					});
				}
			}
		}

		// Render grouped endpoints
		if (Object.keys(endpointsByTag).length > 0) {
			Object.entries(endpointsByTag).forEach(([tag, endpoints]) => {
				container.createEl("h5", {
					text: tag,
					attr: {
						style: "margin: 16px 0 8px 0; font-weight: 600; color: var(--text-normal);",
					},
				});
				const endpointList = container.createEl("ul");
				endpoints.forEach((endpoint) => {
					endpointList.createEl("li", {
						text: `${endpoint.method} ${endpoint.path} - ${endpoint.summary}`,
					});
				});
			});
		} else {
			container.createEl("p", {
				text: uiText(msg({ message: "No API endpoints found in specification.", context: "api/loadAPIEndpoints: loadAPIEndpoints text" })),
				attr: { style: "color: var(--text-muted); margin: 16px 0;" },
			});
		}
	} catch (error: unknown) {
		tasknotesLogger.error("Error loading API endpoints:", {
			category: "provider",
			operation: "loading-api-endpoints",
			error: error,
		});

		// Remove loading message
		loadingEl.remove();

		// Show error message with more details
		container.createEl("p", {
			text: uiText(msg({ message: "API server not accessible ({message}). Ensure the TaskNotes API server is running on port {apiPort, number}.", context: "api/loadAPIEndpoints: loadAPIEndpoints text" }), { message: displayError(getErrorMessage(error)), apiPort: apiPort }),
			attr: { style: "color: var(--text-muted); font-style: italic; margin: 16px 0;" },
		});
	}
}

export { buildAPIEndpointsDocsRequest, loadAPIEndpoints };
