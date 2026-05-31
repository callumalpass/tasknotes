import { mkdir } from "node:fs/promises";
import { build } from "esbuild";

const entries = [
	"index",
	"config",
	"date",
	"mapping",
	"schema",
	"recurrence",
	"time",
	"validation",
	"operations",
	"frontmatter",
	"conformance",
];

const external = ["rrule", "yaml", "zod"];

await mkdir("dist/esm", { recursive: true });
await mkdir("dist/cjs", { recursive: true });

await Promise.all(
	entries.flatMap((entry) => [
		build({
			entryPoints: [`src/${entry}.ts`],
			bundle: true,
			platform: "neutral",
			format: "esm",
			target: "es2020",
			sourcemap: true,
			external,
			outfile: `dist/esm/${entry}.js`,
		}),
		build({
			entryPoints: [`src/${entry}.ts`],
			bundle: true,
			platform: "node",
			format: "cjs",
			target: "es2020",
			sourcemap: true,
			external,
			outfile: `dist/cjs/${entry}.cjs`,
		}),
	])
);
