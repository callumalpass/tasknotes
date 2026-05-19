import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const tasks = [
	["run", "lint:ts"],
	["run", "lint:css"],
	["run", "lint:architecture"],
];

let failed = false;

for (const args of tasks) {
	const result = spawnSync(npmCommand, args, {
		stdio: "inherit",
	});

	if (result.status !== 0) {
		failed = true;
	}
}

process.exit(failed ? 1 : 0);
