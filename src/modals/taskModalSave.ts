export type TaskSaveOutcome =
	| { status: "saved" }
	/** The task was written but a later step failed. Saving again would repeat the write. */
	| { status: "partial" }
	| { status: "failed" };

export interface TaskSaveFollowUp {
	run: () => Promise<void>;
	onError: (error: unknown) => void;
}

/** Run the steps that follow the core write. A failure never undoes or repeats that write. */
export async function runTaskSaveFollowUps(
	steps: readonly TaskSaveFollowUp[]
): Promise<TaskSaveOutcome> {
	let outcome: TaskSaveOutcome = { status: "saved" };
	for (const step of steps) {
		try {
			await step.run();
		} catch (error) {
			step.onError(error);
			outcome = { status: "partial" };
		}
	}
	return outcome;
}
