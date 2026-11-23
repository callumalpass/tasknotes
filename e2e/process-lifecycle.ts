import type { ChildProcess } from "node:child_process";

/** A signal is not an exit acknowledgement: the old process can still own its profile/port. */
async function waitForRootExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve, reject) => {
    const onExit = () => {
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      child.off("exit", onExit);
      reject(new Error("Timed out waiting for owned Obsidian process to exit"));
    }, 5000);
    child.once("exit", onExit);
  });
}

export async function stopOwnedProcess(child?: ChildProcess): Promise<void> {
  if (!child?.pid) return;
  for (const signal of ["SIGTERM", "SIGKILL"] as const) {
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") {
        await waitForRootExit(child);
        return;
      }
      throw error;
    }
    if (signal === "SIGTERM") await new Promise(resolve => setTimeout(resolve, 1000));
  }
  await waitForRootExit(child);
}
