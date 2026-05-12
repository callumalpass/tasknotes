import { requestUrl } from "obsidian";

async function loadAPIEndpoints(container: HTMLElement, apiPort = 8080): Promise<void> {
	// Show loading message first
	const loadingEl = container.createEl("p", {
		text: "Loading API endpoints...",
		attr: { style: "color: var(--text-muted); font-style: italic; margin: 16px 0;" },
	});

	try {
		const response = await requestUrl({
			url: `http://localhost:${apiPort}/api/docs`,
			throw: false,
		});

		if (response.status < 200 || response.status >= 300) {
			throw new Error(`API unavailable (${response.status})`);
		}

		const openApiSpec = response.json;

		// Remove loading message
		loadingEl.remove();

		// Group endpoints by tags/categories
		const endpointsByTag: { [tag: string]: any[] } = {};

		if (openApiSpec.paths) {
			for (const [path, methods] of Object.entries(openApiSpec.paths)) {
				for (const [method, operation] of Object.entries(methods as any)) {
					const tags = (operation as any).tags || ["General"];
					const tag = tags[0];

					if (!endpointsByTag[tag]) {
						endpointsByTag[tag] = [];
					}

					endpointsByTag[tag].push({
						method: method.toUpperCase(),
						path,
						summary:
							(operation as any).summary ||
							(operation as any).description ||
							"No description",
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
				text: "No API endpoints found in specification.",
				attr: { style: "color: var(--text-muted); margin: 16px 0;" },
			});
		}
	} catch (error: any) {
		console.error("Error loading API endpoints:", error);

		// Remove loading message
		loadingEl.remove();

		// Show error message with more details
		container.createEl("p", {
			text: `API server not accessible (${error.message}). Ensure the TaskNotes API server is running on port ${apiPort}.`,
			attr: { style: "color: var(--text-muted); font-style: italic; margin: 16px 0;" },
		});
	}
}

export { loadAPIEndpoints };
