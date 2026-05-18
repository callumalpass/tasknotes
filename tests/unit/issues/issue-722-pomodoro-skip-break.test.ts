import { PomodoroService } from "../../../src/services/PomodoroService";
import {
	EVENT_POMODORO_INTERRUPT,
	EVENT_POMODORO_START,
	EVENT_POMODORO_TICK,
	PomodoroState,
} from "../../../src/types";

type PomodoroPlugin = ConstructorParameters<typeof PomodoroService>[0];

function createMockPlugin() {
	let data: Record<string, unknown> = {};

	return {
		settings: {
			pomodoroWorkDuration: 25,
			pomodoroShortBreakDuration: 5,
			pomodoroLongBreakDuration: 15,
			pomodoroLongBreakInterval: 4,
			pomodoroAutoStartBreaks: false,
			pomodoroAutoStartWork: false,
			pomodoroNotifications: false,
			pomodoroSoundEnabled: false,
			pomodoroStorageLocation: "plugin",
		},
		i18n: {
			translate: jest.fn((key: string) => key),
		},
		loadData: jest.fn(async () => data),
		saveData: jest.fn(async (nextData: Record<string, unknown>) => {
			data = { ...nextData };
		}),
		emitter: {
			trigger: jest.fn(),
		},
		taskService: {
			startTimeTracking: jest.fn(),
			stopTimeTracking: jest.fn(),
		},
		cacheManager: {
			getTaskInfo: jest.fn(),
		},
	};
}

function setPomodoroState(service: PomodoroService, state: PomodoroState): void {
	(service as unknown as { state: PomodoroState }).state = state;
}

describe("Issue #722: skipping a prepared break", () => {
	it("resets the queued break to an idle focus timer without starting a session", async () => {
		const plugin = createMockPlugin();
		const service = new PomodoroService(plugin as unknown as PomodoroPlugin);

		setPomodoroState(service, {
			isRunning: false,
			timeRemaining: 5 * 60,
			nextSessionType: "short-break",
		});

		await service.skipBreak();

		expect(service.getState()).toEqual({
			isRunning: false,
			timeRemaining: 25 * 60,
			currentSession: undefined,
			nextSessionType: undefined,
		});
		expect(plugin.saveData).toHaveBeenCalledWith(
			expect.objectContaining({
				pomodoroState: expect.objectContaining({
					isRunning: false,
					timeRemaining: 25 * 60,
					nextSessionType: undefined,
				}),
			})
		);
		expect(plugin.emitter.trigger).toHaveBeenCalledWith(EVENT_POMODORO_TICK, {
			timeRemaining: 25 * 60,
			session: undefined,
		});
		expect(plugin.emitter.trigger).not.toHaveBeenCalledWith(
			EVENT_POMODORO_START,
			expect.anything()
		);
		expect(plugin.emitter.trigger).not.toHaveBeenCalledWith(
			EVENT_POMODORO_INTERRUPT,
			expect.anything()
		);
		expect(plugin.taskService.startTimeTracking).not.toHaveBeenCalled();
		expect(plugin.taskService.stopTimeTracking).not.toHaveBeenCalled();
	});

	it("does nothing when no break is queued", async () => {
		const plugin = createMockPlugin();
		const service = new PomodoroService(plugin as unknown as PomodoroPlugin);

		await service.skipBreak();

		expect(service.getState()).toEqual({
			isRunning: false,
			timeRemaining: 25 * 60,
		});
		expect(plugin.saveData).not.toHaveBeenCalled();
		expect(plugin.emitter.trigger).not.toHaveBeenCalled();
	});
});
