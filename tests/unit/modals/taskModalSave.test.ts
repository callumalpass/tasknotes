import { runTaskSaveFollowUps } from "../../../src/modals/taskModalSave";

describe("runTaskSaveFollowUps", () => {
	it("reports a partial save and still runs the remaining steps", async () => {
		const onError = jest.fn();
		const lastStep = jest.fn().mockResolvedValue(undefined);

		const outcome = await runTaskSaveFollowUps([
			{ run: () => Promise.reject(new Error("blocked")), onError },
			{ run: lastStep, onError },
		]);

		expect(outcome).toEqual({ status: "partial" });
		expect(onError).toHaveBeenCalledTimes(1);
		expect(lastStep).toHaveBeenCalledTimes(1);
	});
});
