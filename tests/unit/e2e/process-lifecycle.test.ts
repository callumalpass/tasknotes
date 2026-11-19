import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { stopOwnedProcess } from "../../../e2e/process-lifecycle";

function ownedChild(): ChildProcess {
	return Object.assign(new EventEmitter(), { pid: 123456, exitCode: null, signalCode: null }) as unknown as ChildProcess;
}

describe("isolated Obsidian process shutdown", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(process, "kill").mockReturnValue(true);
	});
	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("does not hand the profile to a new launch until the owned root exits", async () => {
		const child = ownedChild();
		let finished = false;
		const stopped = stopOwnedProcess(child).then(() => { finished = true; });
		expect(process.kill).toHaveBeenCalledWith(-123456, "SIGTERM");
		await jest.advanceTimersByTimeAsync(1000);
		expect(process.kill).toHaveBeenCalledWith(-123456, "SIGKILL");
		expect(finished).toBe(false);
		child.emit("exit", null, "SIGKILL");
		await stopped;
		expect(finished).toBe(true);
		expect(child.listenerCount("exit")).toBe(0);
	});

	it("awaits a queued root exit even when the process group is already gone", async () => {
		const child = ownedChild();
		jest.mocked(process.kill).mockImplementation(() => {
			throw Object.assign(new Error("gone"), { code: "ESRCH" });
		});
		let finished = false;
		const stopped = stopOwnedProcess(child).then(() => { finished = true; });
		await Promise.resolve();
		expect(finished).toBe(false);
		child.emit("exit", 0, null);
		await stopped;
		expect(finished).toBe(true);
	});

	it("fails explicitly if an owned root never exits after being killed", async () => {
		const child = ownedChild();
		const stopped = stopOwnedProcess(child);
		const rejected = expect(stopped).rejects.toThrow("Timed out waiting for owned Obsidian process to exit");
		await jest.advanceTimersByTimeAsync(6000);
		await rejected;
		expect(child.listenerCount("exit")).toBe(0);
	});

	it("handles absent and already-exited roots without waiting", async () => {
		await stopOwnedProcess();
		expect(process.kill).not.toHaveBeenCalled();
		const child = ownedChild();
		child.exitCode = 0;
		jest.mocked(process.kill).mockImplementation(() => {
			throw Object.assign(new Error("gone"), { code: "ESRCH" });
		});
		await stopOwnedProcess(child);
		expect(child.listenerCount("exit")).toBe(0);
	});
});
