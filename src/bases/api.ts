/**
 * Bases Plugin API Module
 *
 * This module provides a type-safe interface to the Bases plugin,
 * encapsulating all interactions and reducing reliance on internal APIs.
 */

import { App, Plugin } from "obsidian";

export interface BasesQuery {
	on?: (event: string, callback: () => void) => void;
	off?: (event: string, callback: () => void) => void;
	getViewConfig?: (key: string) => any;
	properties?: Record<string, any>;
}

export interface BasesController {
	runQuery?: () => Promise<void>;
	getViewConfig?: () => any;
	results?: Map<any, any>;
	query?: BasesQuery;
}

export interface BasesContainer {
	results?: Map<any, any>;
	query?: BasesQuery;
	viewContainerEl?: HTMLElement;
	controller?: BasesController;
	ctx?: {
		formulas?: Record<string, any>;
	};
}

// View Option Types (Obsidian 1.10.0+ Public API)
export type ViewOption =
	| PropertyOption
	| DropdownOption
	| SliderOption
	| ToggleOption
	| TextOption
	| MultitextOption
	| GroupOption;

export interface PropertyOption {
	type: "property";
	key: string;
	displayName: string;
	default?: string;
	placeholder?: string;
	filter?: (prop: string) => boolean;
}

export interface DropdownOption {
	type: "dropdown";
	key: string;
	displayName: string;
	options: string[];
	default?: string;
}

export interface SliderOption {
	type: "slider";
	key: string;
	displayName: string;
	min: number;
	max: number;
	step: number;
	default?: number;
}

export interface ToggleOption {
	type: "toggle";
	key: string;
	displayName: string;
	default?: boolean;
}

export interface TextOption {
	type: "text";
	key: string;
	displayName: string;
	default?: string;
	placeholder?: string;
}

export interface MultitextOption {
	type: "multitext";
	key: string;
	displayName: string;
	default?: string;
	placeholder?: string;
}

export interface GroupOption {
	type: "group";
	displayName: string;
	options: ViewOption[];
}

export interface BasesViewRegistration {
	name: string;
	icon: string;
	factory: (container: BasesContainer) => any;
	options?: () => ViewOption[];
}

export interface BasesAPI {
	registrations: Record<string, BasesViewRegistration>;
	isEnabled: boolean;
	version?: string;
}

/**
 * Safely retrieves the Bases plugin API
 */
export function getBasesAPI(app: App): BasesAPI | null {
	try {
		// Try the correct path for Bases plugin (internal plugins)
		const internalPlugins = (app as any).internalPlugins;
		if (!internalPlugins) {
			console.debug("[TaskNotes][Bases] Internal plugins manager not available");
			return null;
		}

		const basesPlugin = internalPlugins.getEnabledPluginById?.("bases");
		if (!basesPlugin) {
			console.debug("[TaskNotes][Bases] Bases plugin not found or not enabled");
			return null;
		}

		// Check if the plugin has the expected API structure
		if (!basesPlugin.registrations || typeof basesPlugin.registrations !== "object") {
			console.warn(
				"[TaskNotes][Bases] Bases plugin found but registrations API not available"
			);
			return null;
		}

		return {
			registrations: basesPlugin.registrations,
			isEnabled: true,
			version: basesPlugin.manifest?.version || "unknown",
		};
	} catch (error) {
		console.warn("[TaskNotes][Bases] Error accessing Bases plugin API:", error);
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
 * Uses public API (1.10.0+) with fallback to internal API for backward compatibility
 */
export function registerBasesView(
	plugin: Plugin,
	viewId: string,
	registration: BasesViewRegistration
): boolean {
	// Try public API first (Obsidian 1.10.0+)
	if (typeof (plugin as any).registerBasesView === "function") {
		try {
			const success = (plugin as any).registerBasesView(viewId, registration);
			if (success) {
				console.debug(
					`[TaskNotes][Bases] Successfully registered view via public API: ${viewId}`
				);
				return true;
			}
			console.debug(
				`[TaskNotes][Bases] Public API returned false (Bases may be disabled), trying internal API`
			);
		} catch (error: any) {
			// Check if error is because view already exists - treat as success
			if (error?.message?.includes("already exists")) {
				console.debug(
					`[TaskNotes][Bases] View ${viewId} already registered via public API`
				);
				return true;
			}
			console.warn(
				`[TaskNotes][Bases] Public API registration failed for ${viewId}, trying internal API:`,
				error
			);
		}
	}

	// Fallback to internal API for older versions or if public API fails
	const api = getBasesAPI(plugin.app);
	if (!api) {
		console.warn("[TaskNotes][Bases] Cannot register view: Bases plugin not available");
		return false;
	}

	try {
		// Only register if it doesn't already exist
		if (!api.registrations[viewId]) {
			api.registrations[viewId] = registration;
			console.debug(
				`[TaskNotes][Bases] Successfully registered view via internal API: ${viewId}`
			);
		} else {
			console.debug(`[TaskNotes][Bases] View ${viewId} already registered, skipping`);
		}
		return true;
	} catch (error) {
		console.error(`[TaskNotes][Bases] Error registering view ${viewId}:`, error);
		return false;
	}
}

/**
 * Safely unregister a view from the Bases plugin
 * Note: Public API doesn't provide unregister method, so we use internal API
 */
export function unregisterBasesView(plugin: Plugin, viewId: string): boolean {
	const api = getBasesAPI(plugin.app);
	if (!api) {
		// If Bases is not available, consider unregistration successful
		return true;
	}

	try {
		if (api.registrations[viewId]) {
			delete api.registrations[viewId];
			console.debug(`[TaskNotes][Bases] Successfully unregistered view: ${viewId}`);
		}
		return true;
	} catch (error) {
		console.error(`[TaskNotes][Bases] Error unregistering view ${viewId}:`, error);
		return false;
	}
}

/**
 * Type guard to check if a container is a valid BasesContainer
 */
export function isValidBasesContainer(container: any): container is BasesContainer {
	return (
		container &&
		typeof container === "object" &&
		(container.results instanceof Map || container.results === undefined) &&
		(container.viewContainerEl instanceof HTMLElement ||
			container.viewContainerEl === undefined)
	);
}
