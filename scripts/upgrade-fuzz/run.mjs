#!/usr/bin/env node
// Upgrade fuzzer: real shipped TaskNotes builds -> v5 head, in isolated Obsidian instances.
//
// For each seed: write a random vault + data.json, start the first build in a fresh
// Obsidian profile, run some activity through its own API, then update in place to
// each later build (files replaced, plugin reloaded, like Obsidian's updater), then
// quit and cold-start head twice. Invariants are checked on the head step.
//
// Usage: node scripts/upgrade-fuzz/run.mjs --builds <dir> --out <dir> [--seeds 1-20 | --seedlist 4,12]
//   [--workers 3] [--port 9460] [--chain 4.17.0] [--settings data.json] [--noactivity] [--keep]
//   [--runtime <unpacked Obsidian, default .obsidian-unpacked>]
// <builds>/<version>/ holds main.js, manifest.json and styles.css for each release in
// generate.mjs (`gh release download <version> -R callumalpass/tasknotes`), and
// <builds>/head/ holds `npm run build` output. Run under xvfb-run -a -s "-screen 0 1920x1080x24".
import fs from "node:fs";
import path from "node:path";
import { generateScenario } from "./generate.mjs";
import { cfg, check, installBuild, launch, NOTICE_HOOK, pluginDir, quit, readData, runActivities, settle, smokeViews, snapshotPage, updateInPlace, walk } from "./lib.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
	if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] === undefined ? "1" : all[i + 1]]);
	return acc;
}, []));
const BUILDS = path.resolve(args.builds);
const OUT = path.resolve(args.out);
const RUNTIME = path.resolve(args.runtime ?? new URL("../../.obsidian-unpacked", import.meta.url).pathname);
const WORKERS = Number(args.workers ?? 3);
const KEEP = args.keep === "1";
const [lo, hi] = (args.seeds ?? "1-10").split("-").map(Number);
const SEEDS = args.seedlist ? args.seedlist.split(",").map(Number) : Array.from({ length: (hi ?? lo) - lo + 1 }, (_, i) => lo + i);
const PORT_BASE = Number(args.port ?? 9460);
fs.mkdirSync(OUT, { recursive: true });
cfg.builds = BUILDS;
cfg.runtime = RUNTIME;
process.on("unhandledRejection", (e) => console.error("unhandledRejection (ignored):", String(e).slice(0, 200)));

async function runScenario(seed, workerIdx) {
	const sc = generateScenario(seed, args.chain);
	if (args.settings) { sc.settings = JSON.parse(fs.readFileSync(args.settings, "utf8")); sc.notes = [`forced settings ${path.basename(args.settings)}`]; }
	if (args.noactivity) sc.activities = [];
	const dir = path.join(OUT, `s${seed}`);
	fs.rmSync(dir, { recursive: true, force: true });
	const vault = path.join(dir, "vault");
	const ctx = { vault, profile: path.join(dir, "profile"), port: PORT_BASE + workerIdx, console: [], phase: "seed" };
	fs.mkdirSync(path.join(vault, ".obsidian"), { recursive: true });
	fs.writeFileSync(path.join(vault, ".obsidian/community-plugins.json"), JSON.stringify(["tasknotes"]));
	fs.writeFileSync(path.join(vault, ".obsidian/core-plugins.json"), JSON.stringify({ "file-explorer": true, "global-search": true, bases: true, "daily-notes": true, "page-preview": true }));
	fs.writeFileSync(path.join(vault, ".obsidian/app.json"), JSON.stringify({ promptDelete: false }));
	for (const [p, text] of Object.entries(sc.files)) {
		fs.mkdirSync(path.dirname(path.join(vault, p)), { recursive: true });
		fs.writeFileSync(path.join(vault, p), text);
	}
	installBuild(vault, sc.chain[0]);
	fs.writeFileSync(path.join(pluginDir(vault), "data.json"), JSON.stringify(sc.settings, null, 2));
	const log = { seed, chain: sc.chain, notes: sc.notes, activities: sc.activities, steps: [] };
	const st = { headVersion: JSON.parse(fs.readFileSync(path.join(BUILDS, "head/manifest.json"), "utf8")).version };
	const snap = async (label, settleRes) => ({ label, settle: settleRes, page: await snapshotPage(ctx), data: readData(vault), files: walk(vault) });
	try {
		// first build: cold start, activity, then a restart so it settles its own state
		ctx.phase = sc.chain[0];
		await launch(ctx);
		let s = await settle(ctx, "first");
		log.steps.push({ phase: "first", settle: s });
		if (!s.loaded) throw new Error(`first build ${sc.chain[0]} did not load`);
		if (!sc.partialData) sc.activities.unshift({ kind: "save-settings" });
		log.activityLog = await runActivities(ctx, sc.activities, seed);
		await settle(ctx, "after-activity");
		await quit(ctx);
		await launch(ctx);
		s = await settle(ctx, "first-restart");
		st.origin = await snap("origin", s);
		// intermediate builds
		for (const version of sc.chain.slice(1, -1)) {
			ctx.phase = version;
			const v = await updateInPlace(ctx, version);
			s = await settle(ctx, version);
			const mid = await snap(version, s);
			log.steps.push({ phase: version, loadedVersion: v, settle: s, notices: mid.page.notices.map((n) => n.text), errors: mid.page.errors });
			await quit(ctx);
			await launch(ctx);
			await settle(ctx, `${version}-restart`);
		}
		st.preHead = sc.chain.length > 2 ? await snap("pre-head", { loaded: true }) : st.origin;
		await ctx.page.evaluate(() => { window.__fuzzNotices = []; window.__fuzzErrors = []; window.__fuzzChanges = []; });
		// head: in-place update
		ctx.phase = "head-update";
		const consoleStart = ctx.console.length;
		const v = await updateInPlace(ctx, "head");
		s = await settle(ctx, "head");
		st.postUpdate = await snap("head-update", s);
		log.steps.push({ phase: "head-update", loadedVersion: v, settle: s });
		await quit(ctx);
		// head: cold start
		ctx.phase = "head-restart";
		await launch(ctx);
		s = await settle(ctx, "head-restart");
		st.postRestart = await snap("head-restart", s);
		// head: renderer reload with hooks from document start, to catch startup notices
		ctx.phase = "head-reload";
		await ctx.page.addInitScript(NOTICE_HOOK);
		await ctx.page.reload();
		await ctx.page.waitForFunction(() => window.app?.workspace?.layoutReady, null, { timeout: 60000 });
		s = await settle(ctx, "head-reload");
		st.postReload = await snap("head-reload", s);
		ctx.phase = "smoke";
		st.smoke = await smokeViews(ctx);
		st.consoleHead = ctx.console.slice(consoleStart);
		await quit(ctx);
		log.findings = check(sc, st);
	} catch (e) {
		log.crash = String(e.stack || e);
		log.findings = [{ severity: "error", kind: "harness-or-load-crash", detail: log.crash }];
		log.console = ctx.console.slice(-40);
		await quit(ctx);
	}
	log.consoleAll = ctx.console;
	const bad = log.findings.some((f) => f.severity === "error");
	fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ ...log, scenario: { settings: sc.settings, partialData: sc.partialData } }, null, 2));
	if (st.preHead) fs.writeFileSync(path.join(dir, "snapshots.json"), JSON.stringify({ preHead: { data: st.preHead.data, tasks: st.preHead.page.tasks }, postUpdate: { data: st.postUpdate?.data, tasks: st.postUpdate?.page.tasks }, postRestart: { data: st.postRestart?.data } }, null, 1));
	if (!KEEP && !bad) fs.rmSync(path.join(dir, "profile"), { recursive: true, force: true });
	const summary = log.findings.filter((f) => f.severity !== "info").map((f) => `${f.severity}:${f.kind}`);
	console.log(`seed ${seed} [${sc.chain.join(" → ")}] ${sc.notes.join("; ")} :: ${bad ? "FAIL" : "ok"} ${[...new Set(summary)].join(", ")}`);
	return log;
}

const queue = [...SEEDS];
await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
	while (queue.length) {
		const seed = queue.shift();
		await runScenario(seed, w);
	}
}));
