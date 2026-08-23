import { WorkspaceLeaf } from "obsidian";

export interface ReadingModeInjectionContext {
	isCurrent(): boolean;
}

interface InjectionState {
	running: boolean;
	rerun: boolean;
	version: number;
}

/**
 * Serializes async reading-mode widget injections per leaf and coalesces bursts
 * of refresh requests into a final rerun with the latest state.
 */
export class ReadingModeInjectionScheduler {
	private readonly states = new WeakMap<WorkspaceLeaf, InjectionState>();
	private disposed = false;

	schedule(
		leaf: WorkspaceLeaf,
		run: (context: ReadingModeInjectionContext) => Promise<void>
	): void {
		if (this.disposed) return;
		const state = this.getState(leaf);
		state.version += 1;

		if (state.running) {
			state.rerun = true;
			return;
		}

		state.running = true;
		void this.runLoop(leaf, run);
	}

	dispose(): void {
		this.disposed = true;
	}

	private getState(leaf: WorkspaceLeaf): InjectionState {
		let state = this.states.get(leaf);
		if (!state) {
			state = {
				running: false,
				rerun: false,
				version: 0,
			};
			this.states.set(leaf, state);
		}
		return state;
	}

	private async runLoop(
		leaf: WorkspaceLeaf,
		run: (context: ReadingModeInjectionContext) => Promise<void>
	): Promise<void> {
		const state = this.getState(leaf);

		try {
			do {
				state.rerun = false;
				const runVersion = state.version;
				await run({
					isCurrent: () =>
						!this.disposed && this.states.get(leaf)?.version === runVersion,
				});
			} while (state.rerun && !this.disposed);
		} finally {
			state.running = false;
			if (state.rerun && !this.disposed) {
				state.running = true;
				void this.runLoop(leaf, run);
			}
		}
	}
}
