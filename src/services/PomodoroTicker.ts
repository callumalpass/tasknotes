const tickerWorkerSource = `
	let timerInterval = null;

	self.onmessage = function(event) {
		if (event.data && event.data.command === "start") {
			if (timerInterval) {
				clearInterval(timerInterval);
			}

			timerInterval = setInterval(function() {
				self.postMessage({ type: "tick" });
			}, 1000);
			return;
		}

		if (event.data && event.data.command === "stop") {
			if (timerInterval) {
				clearInterval(timerInterval);
				timerInterval = null;
			}
		}
	};
`;

export class PomodoroTicker {
	private worker: Worker | null = null;
	private workerUrl: string | null = null;
	private fallbackInterval: number | null = null;
	private running = false;

	constructor(private readonly onTick: () => void) {}

	start(): void {
		if (this.running) {
			return;
		}

		this.running = true;
		if (this.canUseWorker()) {
			this.startWorkerTicker();
			return;
		}

		this.fallbackInterval = window.setInterval(this.onTick, 1000);
	}

	stop(): void {
		if (!this.running && !this.worker && this.fallbackInterval === null) {
			return;
		}

		this.running = false;
		if (this.worker) {
			this.worker.postMessage({ command: "stop" });
			this.worker.terminate();
			this.worker = null;
		}

		if (this.workerUrl) {
			URL.revokeObjectURL(this.workerUrl);
			this.workerUrl = null;
		}

		if (this.fallbackInterval !== null) {
			window.clearInterval(this.fallbackInterval);
			this.fallbackInterval = null;
		}
	}

	destroy(): void {
		this.stop();
	}

	private canUseWorker(): boolean {
		return (
			typeof Worker !== "undefined" &&
			typeof Blob !== "undefined" &&
			typeof URL !== "undefined" &&
			typeof URL.createObjectURL === "function"
		);
	}

	private startWorkerTicker(): void {
		const blob = new Blob([tickerWorkerSource], { type: "application/javascript" });
		this.workerUrl = URL.createObjectURL(blob);
		this.worker = new Worker(this.workerUrl);
		this.worker.onmessage = (event) => {
			if (event.data?.type === "tick") {
				this.onTick();
			}
		};
		this.worker.postMessage({ command: "start" });
	}
}
