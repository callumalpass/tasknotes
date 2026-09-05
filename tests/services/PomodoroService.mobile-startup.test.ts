import { Platform } from "obsidian";
import { PomodoroService } from "../../src/services/PomodoroService";

describe("saved Pomodoro sessions on mobile", () => {
	it("does not resume a persisted Pomodoro writer on mobile startup", async () => {
		const previous = Platform.isMobile;
		(Platform as any).isMobile = true;
		try {
			const service: any = new PomodoroService({
				settings: { pomodoroWorkDuration: 25 },
			} as any);
			service.loadState = async () => {
				service.state = {
					isRunning: true,
					currentSession: { id: "fixture" },
					timeRemaining: 1,
				};
			};
			service.setupTicker = () => {};
			service.subscribeToTaskFileRenames = () => {};
			service.resumeTimer = jest.fn();
			await service.initialize();
			expect(service.resumeTimer).not.toHaveBeenCalled();
			expect(service.state.isRunning).toBe(false);
			expect(service.state.currentSession.id).toBe("fixture");
		} finally {
			(Platform as any).isMobile = previous;
		}
	});
});
