const registerBasesTaskListMock = jest.fn();

jest.mock(
	"../../../src/releaseNotes",
	() => ({
		CURRENT_VERSION: "test",
		RELEASE_NOTES_BUNDLE: {},
	}),
	{ virtual: true }
);

jest.mock("../../../src/bases/registration", () => {
	const actual = jest.requireActual("../../../src/bases/registration");
	return {
		...actual,
		registerBasesTaskList: (...args: unknown[]) => registerBasesTaskListMock(...args),
	};
});

type MockPlugin = {
	settings: { enableBases: boolean; enableDebugLogging?: boolean };
	app: {
		internalPlugins: {
			getEnabledPluginById: jest.Mock;
		};
		workspace: {
			iterateAllLeaves: jest.Mock;
		};
	};
	registerBasesView: jest.Mock;
	register: jest.Mock;
	basesRegistered: boolean;
	basesRegistrationRetryIntervalId: number | null;
};

function createPlugin(): MockPlugin {
	return {
		settings: { enableBases: true },
		app: {
			internalPlugins: {
				getEnabledPluginById: jest.fn(() => null),
			},
			workspace: {
				iterateAllLeaves: jest.fn(),
			},
		},
		registerBasesView: jest.fn(),
		register: jest.fn(),
		basesRegistered: false,
		basesRegistrationRetryIntervalId: null,
	};
}

describe("issue #2093 - Bases registration after enabling Bases later", () => {
	afterEach(() => {
		jest.useRealTimers();
		registerBasesTaskListMock.mockReset();
	});

	it("does not mark Bases views registered when registration fails", async () => {
		jest.useFakeTimers();
		registerBasesTaskListMock.mockResolvedValue(false);
		const plugin = createPlugin();
		const { registerBasesIntegration } = await import("../../../src/bootstrap/pluginBootstrap");

		await registerBasesIntegration(plugin as never);

		expect(plugin.basesRegistered).toBe(false);
		expect(plugin.basesRegistrationRetryIntervalId).not.toBeNull();
		expect(plugin.register).toHaveBeenCalledTimes(1);
	});

	it("retries registration when the Bases core plugin becomes enabled", async () => {
		jest.useFakeTimers();
		registerBasesTaskListMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		const plugin = createPlugin();
		const { registerBasesIntegration } = await import("../../../src/bootstrap/pluginBootstrap");

		await registerBasesIntegration(plugin as never);
		expect(plugin.basesRegistered).toBe(false);

		plugin.app.internalPlugins.getEnabledPluginById.mockReturnValue({ registrations: {} });
		await jest.advanceTimersByTimeAsync(5000);

		expect(registerBasesTaskListMock).toHaveBeenCalledTimes(2);
		expect(plugin.basesRegistered).toBe(true);
		expect(plugin.basesRegistrationRetryIntervalId).toBeNull();
	});
});

describe("issue #2093 - Bases registration helper result", () => {
	it("returns false when every TaskNotes Bases view registration fails", async () => {
		const { registerBasesTaskList } = jest.requireActual<
			typeof import("../../../src/bases/registration")
		>("../../../src/bases/registration");
		const plugin = createPlugin();
		plugin.registerBasesView.mockReturnValue(false);

		await expect(registerBasesTaskList(plugin as never)).resolves.toBe(false);
		expect(plugin.registerBasesView).toHaveBeenCalledWith("tasknotesTaskList", expect.anything());
		expect(plugin.registerBasesView).toHaveBeenCalledWith("tasknotesKanban", expect.anything());
		expect(plugin.registerBasesView).toHaveBeenCalledWith("tasknotesCalendar", expect.anything());
		expect(plugin.registerBasesView).toHaveBeenCalledWith(
			"tasknotesMiniCalendar",
			expect.anything()
		);
	});
});
