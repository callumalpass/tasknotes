import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const tasks = [
	["run", "test:lint-config"],
	["run", "lint:ts"],
	["run", "lint:review-types"],
	["run", "lint:css"],
	["run", "lint:architecture"],
];

let failed = false;

for (const args of tasks) {
	// Windows exposes npm as a command script, which needs a shell to spawn from Node.
	const result = spawnSync(npmCommand, args, {
		stdio: "inherit",
		shell: process.platform === "win32",
	});

	if (result.status !== 0) {
		failed = true;
	}
}

process.exit(failed ? 1 : 0);
