import { NotificationService } from "../../../src/services/NotificationService";

class MockOscillator {
	frequency = { value: 0 };
	type: OscillatorType = "sine";
	connect = jest.fn();
	start = jest.fn();
	stop = jest.fn();
}

class MockGain {
	gain = { value: 0 };
	connect = jest.fn();
}

class MockAudioContext {
	currentTime = 10;
	destination = {};
	state: AudioContextState = "running";
	oscillators: MockOscillator[] = [];
	gains: MockGain[] = [];
	close = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

	createOscillator(): OscillatorNode {
		const oscillator = new MockOscillator();
		this.oscillators.push(oscillator);
		return oscillator as unknown as OscillatorNode;
	}

	createGain(): GainNode {
		const gain = new MockGain();
		this.gains.push(gain);
		return gain as unknown as GainNode;
	}
}

describe("Issue #873: notification reminder sound", () => {
	let originalAudioContext: typeof window.AudioContext | undefined;
	let contexts: MockAudioContext[];

	beforeEach(() => {
		jest.useFakeTimers();
		originalAudioContext = window.AudioContext;
		contexts = [];

		const AudioContextMock = jest.fn(() => {
			const context = new MockAudioContext();
			contexts.push(context);
			return context;
		});

		Object.defineProperty(window, "AudioContext", {
			configurable: true,
			value: AudioContextMock as unknown as typeof AudioContext,
		});
	});

	afterEach(() => {
		Object.defineProperty(window, "AudioContext", {
			configurable: true,
			value: originalAudioContext,
		});
		jest.useRealTimers();
	});

	function createService(settings: {
		notificationSoundEnabled: boolean;
		notificationSoundVolume: number;
	}): NotificationService {
		return new NotificationService({
			settings,
		} as unknown as ConstructorParameters<typeof NotificationService>[0]);
	}

	it("plays a two-tone reminder sound using the configured volume", () => {
		const service = createService({
			notificationSoundEnabled: true,
			notificationSoundVolume: 50,
		});

		service.playNotificationSound();

		expect(contexts).toHaveLength(1);
		expect(contexts[0].gains[0].gain.value).toBeCloseTo(0.15);
		expect(contexts[0].oscillators[0].frequency.value).toBe(880);
		expect(contexts[0].oscillators[0].stop).toHaveBeenCalledWith(10.12);

		jest.advanceTimersByTime(140);

		expect(contexts[0].oscillators).toHaveLength(2);
		expect(contexts[0].oscillators[1].frequency.value).toBe(1175);
		expect(contexts[0].oscillators[1].stop).toHaveBeenCalledWith(10.12);

		jest.advanceTimersByTime(180);

		expect(contexts[0].close).toHaveBeenCalledTimes(1);
	});

	it("does not create audio when notification sounds are disabled", () => {
		const service = createService({
			notificationSoundEnabled: false,
			notificationSoundVolume: 50,
		});

		service.playNotificationSound();

		expect(contexts).toHaveLength(0);
	});

	it("cleans up active notification audio when the service is destroyed", () => {
		const service = createService({
			notificationSoundEnabled: true,
			notificationSoundVolume: 100,
		});

		service.playNotificationSound();
		service.destroy();

		expect(contexts[0].close).toHaveBeenCalledTimes(1);
		jest.runOnlyPendingTimers();
		expect(contexts[0].close).toHaveBeenCalledTimes(1);
	});
});
