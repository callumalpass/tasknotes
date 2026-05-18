/**
 * Bases Plugin API Module
 *
 * This module provides a type-safe interface to the Bases plugin,
 * encapsulating all interactions and reducing reliance on internal APIs.
 */

import { App, Plugin } from "obsidian";
import type { BasesViewRegistration as ObsidianBasesViewRegistration } from "obsidian";
import { createTaskNotesLogger, type TaskNotesLogger } from "../utils/tasknotesLogger";

export interface BasesQuery {
	on?: (event: string, callback: () => void) => void;
	off?: (event: string, callback: () => void) => void;
	getViewConfig?: (key: string) => unknown;
	properties?: Record<string, unknown>;
}

export interface BasesController {
	runQuery?: () => Promise<void>;
	getViewConfig?: () => unknown;
	results?: Map<unknown, unknown>;
	query?: BasesQuery;
}

export interface BasesContainer {
	results?: Map<unknown, unknown>;
	query?: BasesQuery;
	viewContainerEl?: HTMLElement;
	controller?: BasesController;
	ctx?: {
		formulas?: Record<string, unknown>;
	};
}

export type BasesViewRegistration = ObsidianBasesViewRegistration;

export interface BasesAPI {
	registrations: Record<string, BasesViewRegistration>;
	isEnabled: boolean;
	version?: string;
}

type InternalPluginManager = {
	getEnabledPluginById?: (id: string) => {
		registrations?: Record<string, BasesViewRegistration>;
		manifest?: { version?: string };
	};
};

type AppWithInternalPlugins = {
	internalPlugins?: InternalPluginManager;
};

function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object";
}

const basesApiLogger = createTaskNotesLogger({ tag: "Bases/API" });

/**
 * Safely retrieves the Bases plugin API
 */
export function getBasesAPI(
	app: App,
	logger: TaskNotesLogger = basesApiLogger
): BasesAPI | null {
	try {
		// Try the correct path for Bases plugin (internal plugins)
		const internalPlugins = (app as unknown as AppWithInternalPlugins).internalPlugins;
		if (!internalPlugins) {
			logger.debug("Internal plugins manager not available", {
				category: "configuration",
				operation: "get-api",
			});
			return null;
		}

		const basesPlugin = internalPlugins.getEnabledPluginById?.("bases");
		if (!basesPlugin) {
			logger.debug("Bases plugin not found or not enabled", {
				category: "configuration",
				operation: "get-api",
			});
			return null;
		}

		// Check if the plugin has the expected API structure
		if (!basesPlugin.registrations || typeof basesPlugin.registrations !== "object") {
			logger.warn("Bases plugin found but registrations API is not available", {
				category: "provider",
				operation: "get-api",
			});
			return null;
		}

		return {
			registrations: basesPlugin.registrations,
			isEnabled: true,
			version: basesPlugin.manifest?.version || "unknown",
		};
	} catch (error) {
		logger.warn("Error accessing Bases plugin API", {
			category: "provider",
			operation: "get-api",
			error,
		});
		return null;
	}
}

/**
 * Check if Bases plugin is available and compatible
 */
export function isBasesPluginAvailable(app: App): boolean {
	const api = getBasesAPI(app);
	return api !== null && api.isEnabled;
}

/**
 * Safely register a view with the Bases plugin
 * Requires Obsidian 1.10.0+ (public Bases API only)
 */
export function registerBasesView(
	plugin: Plugin,
	viewId: string,
	registration: BasesViewRegistration,
	logger: TaskNotesLogger = basesApiLogger
): boolean {
	// Use public API (Obsidian 1.10.0+)
	if (typeof plugin.registerBasesView === "function") {
		try {
			const success = plugin.registerBasesView(viewId, registration);
			if (success) {
				logger.debug("Successfully registered view via public API", {
					category: "configuration",
					operation: "register-view",
					details: { viewId },
				});
				return true;
			}
			logger.debug("Public API returned false", {
				category: "configuration",
				operation: "register-view",
				details: { viewId },
			});
			return false;
		} catch (error: unknown) {
			// Check if error is because view already exists - treat as success
			if (error instanceof Error && error.message.includes("already exists")) {
				logger.debug("View already registered via public API", {
					category: "configuration",
					operation: "register-view",
					details: { viewId },
				});
				return true;
			}
			logger.warn("Public API registration failed", {
				category: "provider",
				operation: "register-view",
				details: { viewId },
				error,
			});
			return false;
		}
	}

	logger.warn("Cannot register view because Bases public API is not available", {
		category: "configuration",
		operation: "register-view",
		details: { viewId },
	});
	return false;
}

/**
 * Safely unregister a view from the Bases plugin
 * Note: Public API doesn't provide unregister method, so we use internal API
 */
export function unregisterBasesView(
	plugin: Plugin,
	viewId: string,
	logger: TaskNotesLogger = basesApiLogger
): boolean {
	const api = getBasesAPI(plugin.app, logger);
	if (!api) {
		// If Bases is not available, consider unregistration successful
		return true;
	}

	try {
		if (api.registrations[viewId]) {
			delete api.registrations[viewId];
		}
		return true;
	} catch (error) {
		logger.error("Error unregistering view", {
			category: "provider",
			operation: "unregister-view",
			details: { viewId },
			error,
		});
		return false;
	}
}

/**
 * Type guard to check if a container is a valid BasesContainer
 */
export function isValidBasesContainer(container: unknown): container is BasesContainer {
	if (!isObject(container)) {
		return false;
	}

	// Use cross-window compatible instanceOf check for pop-out window support
	const isValidViewContainer =
		container.viewContainerEl === undefined ||
		(container.viewContainerEl as Node)?.instanceOf?.(HTMLElement) === true;
	return (
		(container.results instanceof Map || container.results === undefined) &&
		isValidViewContainer
	);
}
