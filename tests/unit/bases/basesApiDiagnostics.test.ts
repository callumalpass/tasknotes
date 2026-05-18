import type { App, Plugin } from "obsidian";
import { getBasesAPI, registerBasesView, unregisterBasesView } from "../../../src/bases/api";
import { createTaskNotesLogger } from "../../../src/utils/tasknotesLogger";

function createSink() {
	return {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	};
}

describe("Bases API diagnostics", () => {
	it("uses debug-gated diagnostics for missing internal plugins", () => {
		const sink = createSink();
		let debugEnabled = false;
		const logger = createTaskNotesLogger({
			tag: "Bases/API",
			isDebugEnabled: () => debugEnabled,
			sink,
		});

		expect(getBasesAPI({} as App, logger)).toBeNull();
		expect(sink.debug).not.toHaveBeenCalled();

		debugEnabled = true;
		expect(getBasesAPI({} as App, logger)).toBeNull();
		expect(sink.debug).toHaveBeenCalledWith(
			"[TaskNotes][Bases/API][configuration][get-api] Internal plugins manager not available"
		);
	});

	it("logs provider warnings when the Bases registration API is unavailable", () => {
		const sink = createSink();
		const logger = createTaskNotesLogger({ tag: "Bases/API", sink });
		const app = {
			internalPlugins: {
				getEnabledPluginById: () => ({ registrations: null }),
			},
		} as unknown as App;

		expect(getBasesAPI(app, logger)).toBeNull();

		expect(sink.warn).toHaveBeenCalledWith(
			"[TaskNotes][Bases/API][provider][get-api] Bases plugin found but registrations API is not available"
		);
	});

	it("logs register and unregister failures with view context", () => {
		const sink = createSink();
		const logger = createTaskNotesLogger({ tag: "Bases/API", sink });
		const registerError = new Error("registration failed");
		const unregisterError = new Error("delete failed");
		const plugin = {
			app: {
				internalPlugins: {
					getEnabledPluginById: () => ({
						registrations: new Proxy(
							{ tasknotesKanban: {} },
							{
								deleteProperty: () => {
									throw unregisterError;
								},
							}
						),
					}),
				},
			},
			registerBasesView: () => {
				throw registerError;
			},
		} as unknown as Plugin;

		expect(registerBasesView(plugin, "tasknotesKanban", {} as never, logger)).toBe(false);
		expect(sink.warn).toHaveBeenCalledWith(
			"[TaskNotes][Bases/API][provider][register-view] Public API registration failed",
			{ viewId: "tasknotesKanban" },
			registerError
		);

		expect(unregisterBasesView(plugin, "tasknotesKanban", logger)).toBe(false);
		expect(sink.error).toHaveBeenCalledWith(
			"[TaskNotes][Bases/API][provider][unregister-view] Error unregistering view",
			{ viewId: "tasknotesKanban" },
			unregisterError
		);
	});
});
