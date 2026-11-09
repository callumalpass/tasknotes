#!/usr/bin/env node
// Mixed-version sync fuzzer: two devices share one vault through a simulated sync
// service while one runs v5 head and the other still runs a shipped v4 build.
//
// Each device is an isolated Obsidian instance with its own vault copy. sync() is a
// three-way, last-writer-wins file sync of the vault plus the plugin's data.json (plugin
// code is not synced, so each device keeps its own version, as when updates are
// installed per device). Steps for each seed:
//   1. both devices on v4 <chain[0]>, synced
//   2. device A updates in place to head; sync
//   3. rounds of activity alternating between B (still v4) and A (head), syncing and
//      checking both devices after each; B cold-restarts on v4 midway
//   4. B updates to head; both cold-restart; final checks
// Invariants: both devices load without errors, sync converges (no write ping-pong),
// devices agree on tasks, created tasks and changed settings survive, the user's
// original settings survive, the API token survives, mdbase metadata ends at v0.3.
//
// Usage: node scripts/upgrade-fuzz/sync.mjs --builds <dir> --out <dir> [--seeds 1-10 | --seedlist 3,7]
//   [--workers 2] [--port 9560] [--from 4.18.0] [--rounds 4] [--settings data.json] [--keep]
// Each worker uses two consecutive CDP ports. See run.mjs for the builds layout.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { generateScenario, rng, V4_VERSIONS } from "./generate.mjs";
import {
	cfg, deepEqual, diffKeys, installBuild, launch, METADATA_RE, norm, pluginDir, quit, readData, runActivities,
	settingsFindings, settle, sleep, snapshotPage, updateInPlace, walk,
} from "./lib.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
	if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] === undefined ? "1" : all[i + 1]]);
	return acc;
}, []));
cfg.builds = path.resolve(args.builds);
cfg.runtime = path.resolve(args.runtime ?? new URL("../../.obsidian-unpacked", import.meta.url).pathname);
const OUT = path.resolve(args.out);
const WORKERS = Number(args.workers ?? 2);
const ROUNDS = Number(args.rounds ?? 4);
const KEEP = args.keep === "1";
const [lo, hi] = (args.seeds ?? "1-6").split("-").map(Number);
const SEEDS = args.seedlist ? args.seedlist.split(",").map(Number) : Array.from({ length: (hi ?? lo) - lo + 1 }, (_, i) => lo + i);
const PORT_BASE = Number(args.port ?? 9560);
const HEAD_VERSION = JSON.parse(fs.readFileSync(path.join(cfg.builds, "head/manifest.json"), "utf8")).version;
fs.mkdirSync(OUT, { recursive: true });
process.on("unhandledRejection", (e) => console.error("unhandledRejection (ignored):", String(e).slice(0, 200)));

const DATA_JSON = ".obsidian/plugins/tasknotes/data.json";
// Both devices run on one machine, so the second HTTP API listener finds the port taken.
const NOISE = /DateUtils\]\[validation\]|Failed to load resource|EADDRINUSE/;
const hash = (buf) => crypto.createHash("sha1").update(buf).digest("hex");

/** Synced files: the vault outside .obsidian, plus the plugin's data.json. */
function listSynced(vault) {
	const out = {};
	const visit = (rel) => {
		for (const ent of fs.readdirSync(path.join(vault, rel), { withFileTypes: true })) {
			const p = rel ? `${rel}/${ent.name}` : ent.name;
			if (ent.isDirectory()) { if (p !== ".obsidian" && p !== ".trash") visit(p); }
			else if (ent.isFile()) {
				const full = path.join(vault, p);
				out[p] = { sha: hash(fs.readFileSync(full)), mtime: fs.statSync(full).mtimeMs };
			}
		}
	};
	visit("");
	const dj = path.join(vault, DATA_JSON);
	if (fs.existsSync(dj)) out[DATA_JSON] = { sha: hash(fs.readFileSync(dj)), mtime: fs.statSync(dj).mtimeMs };
	return out;
}

function copyFile(from, to, p) {
	fs.mkdirSync(path.dirname(path.join(to, p)), { recursive: true });
	fs.copyFileSync(path.join(from, p), path.join(to, p));
}

/** One three-way pass. Returns the transfers it made. */
function syncOnce(env) {
	const { a, b } = env;
	const la = listSynced(a.vault), lb = listSynced(b.vault), base = env.base;
	const moves = [];
	for (const p of new Set([...Object.keys(la), ...Object.keys(lb), ...Object.keys(base)])) {
		const fa = la[p], fb = lb[p], s0 = base[p];
		if (fa?.sha === fb?.sha) continue;
		const aChanged = fa?.sha !== s0, bChanged = fb?.sha !== s0;
		let winner;
		if (aChanged && !bChanged) winner = "a";
		else if (bChanged && !aChanged) winner = "b";
		else if (!fa) winner = "b"; // deleted on A, edited on B: keep the edit
		else if (!fb) winner = "a";
		else { winner = fa.mtime >= fb.mtime ? "a" : "b"; moves.push({ p, conflict: true, winner }); }
		const [src, dst] = winner === "a" ? [a, b] : [b, a];
		const fsrc = winner === "a" ? fa : fb;
		let dataDiff;
		if (p === DATA_JSON && fsrc) {
			const read = (v) => { try { return JSON.parse(fs.readFileSync(path.join(v, p), "utf8")); } catch { return {}; } };
			dataDiff = diffKeys(read(dst.vault), read(src.vault)).map((d) => ({ path: d.path, from: d.before, to: d.after }));
		}
		if (fsrc) copyFile(src.vault, dst.vault, p);
		else fs.rmSync(path.join(dst.vault, p), { force: true });
		moves.push({ p, to: dst.name, op: fsrc ? "write" : "delete", ...(dataDiff ? { dataDiff } : {}) });
	}
	const now = listSynced(a.vault);
	env.base = Object.fromEntries(Object.entries(now).map(([p, f]) => [p, f.sha]));
	return moves;
}

/** Sync, let both running devices react, repeat until nothing moves. */
async function syncUntilStable(env, label, findings) {
	const history = [];
	for (let i = 0; i < 6; i++) {
		const moves = syncOnce(env).filter((m) => !m.conflict);
		history.push(moves.map((m) => `${m.to}:${m.op} ${m.p}`));
		for (const m of moves) env.transfers.push({ label, ...m });
		if (!moves.length) return history;
		for (const d of [env.a, env.b]) if (d.page) await settle(d, `${label}-sync${i}`, 30000);
		await sleep(1000);
	}
	findings.push({ severity: "error", kind: "sync-never-converges", detail: { label, lastPasses: history.slice(-3) } });
	return history;
}

async function deviceSnap(d) {
	const page = await snapshotPage(d);
	return { page, data: readData(d.vault) };
}

function compareDevices(sa, sb, label, add) {
	const ta = sa.page.tasks ?? {}, tb = sb.page.tasks ?? {};
	for (const p of Object.keys(ta)) if (!tb[p]) add("error", "devices-disagree-task-missing", { label, missingOn: "B", path: p });
	for (const p of Object.keys(tb)) if (!ta[p]) add("error", "devices-disagree-task-missing", { label, missingOn: "A", path: p });
	for (const [p, t] of Object.entries(ta)) {
		const u = tb[p];
		if (!u) continue;
		for (const k of new Set([...Object.keys(t), ...Object.keys(u)])) {
			if (k === "id") continue;
			if (k === "priority" && (t[k] ?? "normal") === (u[k] ?? "normal")) continue; // v4 shows missing as "normal"
			if (k === "title" && [t[k], u[k]].includes("Untitled task")) continue;
			if (!deepEqual(norm(k, t[k]), norm(k, u[k]))) add("warn", "devices-disagree-field", { label, path: p, field: k, A: t[k], B: u[k] });
		}
	}
}

function deviceHealth(d, snap, label, add) {
	if (!snap.page.loaded) add("error", "plugin-not-loaded", `${label} ${d.name}`);
	if (snap.page.taskError) add("error", "task-cache-error", `${label} ${d.name}: ${snap.page.taskError}`);
	for (const e of snap.page.errors ?? []) add("error", "window-error", `${label} ${d.name} (${snap.page.version}): ${e}`);
	if (snap.data.__unreadable) add("error", "data-json-unreadable", `${label} ${d.name}`);
	const counts = {};
	for (const n of snap.page.notices ?? []) counts[n.text] = (counts[n.text] ?? 0) + 1;
	for (const [text, c] of Object.entries(counts)) if (c > 2) add("warn", "repeated-notice", { label, device: d.name, count: c, text });
}

function settingChanges(r, round) {
	const options = [
		{ key: "pomodoroWorkDuration", value: r.int(15, 60) },
		{ key: "enableNaturalLanguageInput", value: r.chance(0.5) },
		{ key: "defaultTaskStatus", value: null }, // filled from the device's statuses
	];
	const o = r.pick(options);
	return { kind: "change-setting", key: o.key, value: o.value, round };
}

function roundActivities(r, round) {
	const acts = [];
	const n = r.int(1, 4);
	for (let i = 0; i < n; i++) {
		const k = r.next();
		if (k < 0.3) acts.push({ kind: "create", title: `Sync r${round} ${i} ${r.int(100, 999)}`, due: r.chance(0.5) ? `2026-12-${String(r.int(10, 28)).padStart(2, "0")}` : undefined });
		else if (k < 0.45) acts.push({ kind: "toggle" });
		else if (k < 0.55) acts.push({ kind: "set-priority" });
		else if (k < 0.65) acts.push({ kind: "timer" });
		else if (k < 0.85) acts.push(settingChanges(r, round));
		else acts.push({ kind: "save-settings" });
	}
	return acts;
}

async function runScenario(seed, w) {
	const r = rng(seed * 40503 + 17);
	const from = args.from ?? r.pick(["4.18.0", "4.18.0", "4.17.0", ...V4_VERSIONS]);
	const sc = generateScenario(seed, from);
	if (args.settings) { sc.settings = JSON.parse(fs.readFileSync(args.settings, "utf8")); sc.notes = [`forced settings ${path.basename(args.settings)}`]; }
	const dir = path.join(OUT, `s${seed}`);
	fs.rmSync(dir, { recursive: true, force: true });
	const mk = (name, port) => ({ name, vault: path.join(dir, `vault-${name}`), profile: path.join(dir, `profile-${name}`), port, console: [], phase: "seed" });
	const a = mk("A", PORT_BASE + 2 * w), b = mk("B", PORT_BASE + 2 * w + 1);
	const env = { a, b, base: {}, transfers: [] };
	const findings = [];
	const add = (severity, kind, detail) => findings.push({ severity, kind, detail });
	const log = { seed, from, notes: sc.notes, steps: [] };
	const created = new Set(), touched = new Set(), expectedSettings = {};

	// identical starting vaults
	for (const d of [a, b]) {
		fs.mkdirSync(path.join(d.vault, ".obsidian"), { recursive: true });
		fs.writeFileSync(path.join(d.vault, ".obsidian/community-plugins.json"), JSON.stringify(["tasknotes"]));
		fs.writeFileSync(path.join(d.vault, ".obsidian/core-plugins.json"), JSON.stringify({ "file-explorer": true, "global-search": true, bases: true, "daily-notes": true }));
		fs.writeFileSync(path.join(d.vault, ".obsidian/app.json"), JSON.stringify({ promptDelete: false }));
		for (const [p, text] of Object.entries(sc.files)) {
			fs.mkdirSync(path.dirname(path.join(d.vault, p)), { recursive: true });
			fs.writeFileSync(path.join(d.vault, p), text);
		}
		installBuild(d.vault, from);
	}
	fs.writeFileSync(path.join(pluginDir(a.vault), "data.json"), JSON.stringify(sc.settings, null, 2));

	const act = async (d, acts, label) => {
		for (const x of acts) if (x.kind === "change-setting" && x.key === "defaultTaskStatus") {
			const statuses = await d.page.evaluate(() => window.app.plugins.plugins.tasknotes.settings.customStatuses.map((s) => s.value));
			x.value = statuses[seed % statuses.length];
		}
		const out = await runActivities(d, acts, seed + label.length);
		for (const line of out) {
			const m = /^(create|toggle|timer|prio|recur) (.+)$/.exec(line);
			if (m) touched.add(m[2]);
			if (m?.[1] === "create") created.add(m[2]);
			const s = /^set (\w+)=(.+)$/.exec(line);
			if (s) expectedSettings[s[1]] = JSON.parse(s[2]);
			if (line.startsWith("ERR")) add("warn", "activity-error", { label, device: d.name, line });
		}
		log.steps.push({ label, device: d.name, activity: out });
		await settle(d, label);
	};
	const checkpoint = async (label) => {
		const sa = await deviceSnap(a), sb = await deviceSnap(b);
		deviceHealth(a, sa, label, add);
		deviceHealth(b, sb, label, add);
		compareDevices(sa, sb, label, add);
		log.steps.push({ label, versions: { A: sa.page.version, B: sb.page.version }, tasks: { A: Object.keys(sa.page.tasks ?? {}).length, B: Object.keys(sb.page.tasks ?? {}).length } });
		for (const d of [a, b]) await d.page.evaluate(() => { window.__fuzzNotices = []; window.__fuzzErrors = []; });
		return { sa, sb };
	};

	try {
		// 1. both on v4
		a.phase = `A-${from}`; b.phase = `B-${from}`;
		await launch(a);
		await settle(a, "A-first");
		await act(a, [{ kind: "save-settings" }], "A-v4-save");
		syncOnce(env);
		await launch(b);
		await settle(b, "B-first");
		await syncUntilStable(env, "v4-v4", findings);
		const origin = await checkpoint("both-v4");
		const originData = origin.sa.data;
		const token = originData.apiAuthToken || origin.sa.page.settings?.apiAuthToken || "";

		// 2. A updates
		a.phase = "A-head";
		const v = await updateInPlace(a, "head");
		if (v !== HEAD_VERSION) add("error", "wrong-version", `A after update: ${v}`);
		await settle(a, "A-update");
		await syncUntilStable(env, "after-A-update", findings);
		const mixed = await checkpoint("mixed-start");
		if (token && mixed.sa.page.secretToken !== token) add("error", "api-token-lost", { device: "A", phase: "mixed-start", secret: mixed.sa.page.secretToken });
		if (token && mixed.sb.page.settings?.apiAuthToken !== token) add("warn", "v4-device-api-token-changed", { phase: "mixed-start", now: mixed.sb.page.settings?.apiAuthToken ?? null });

		// 3. mixed-version rounds
		for (let i = 0; i < ROUNDS; i++) {
			const d = i % 2 === 0 ? b : a;
			if (i === Math.floor(ROUNDS / 2)) { // v4 device cold-starts on synced v5 state
				await quit(b);
				await launch(b);
				await settle(b, "B-v4-restart");
				await syncUntilStable(env, `round${i}-B-restart`, findings);
			}
			await act(d, roundActivities(r, i), `round${i}-${d.name}`);
			await syncUntilStable(env, `round${i}`, findings);
			const cp = await checkpoint(`round${i}`);
			if (token && cp.sa.page.secretToken !== token) add("error", "api-token-lost", { device: "A", phase: `round${i}`, secret: cp.sa.page.secretToken });
		}

		// 4. B updates, then both cold-start
		b.phase = "B-head";
		const vb = await updateInPlace(b, "head");
		if (vb !== HEAD_VERSION) add("error", "wrong-version", `B after update: ${vb}`);
		await settle(b, "B-update");
		await syncUntilStable(env, "after-B-update", findings);
		await quit(a); await quit(b);
		await launch(a); await launch(b);
		await settle(a, "A-final"); await settle(b, "B-final");
		await syncUntilStable(env, "final", findings);
		const fin = await checkpoint("final");

		// final invariants
		for (const p of created) {
			if (!fin.sa.page.tasks?.[p]) add("error", "created-task-lost", { device: "A", path: p });
			if (!fin.sb.page.tasks?.[p]) add("error", "created-task-lost", { device: "B", path: p });
		}
		for (const p of Object.keys(origin.sa.page.tasks ?? {})) if (!fin.sa.page.tasks?.[p]) add("error", "task-lost", p);
		for (const [key, value] of Object.entries(expectedSettings)) {
			for (const [name, s] of [["A", fin.sa], ["B", fin.sb]]) {
				if (!deepEqual(s.page.settings?.[key], value)) add("error", "setting-change-lost", { device: name, key, expected: value, effective: s.page.settings?.[key], dataJson: s.data[key] });
			}
		}
		const untouchedOrigin = Object.fromEntries(Object.entries(originData).filter(([k]) => !(k in expectedSettings)));
		for (const f of settingsFindings(untouchedOrigin, fin.sa.data)) add(f.severity, f.kind, f.detail);
		if (token) {
			if (fin.sa.page.secretToken !== token) add("error", "api-token-lost", { device: "A", phase: "final", secret: fin.sa.page.secretToken });
			if (fin.sb.page.secretToken !== token) add("warn", "api-token-not-carried-to-B", { secret: fin.sb.page.secretToken });
		}
		const filesEnd = walk(a.vault);
		for (const [p, text] of Object.entries(sc.files)) {
			if (METADATA_RE.test(p) || touched.has(p)) continue;
			const g = filesEnd[p];
			if (!g) add("error", "file-deleted", p);
			else if (g.text !== null && g.text !== text) add("error", "file-modified", { path: p, before: text.slice(0, 800), after: g.text.slice(0, 800) });
		}
		if (originData.enableMdbaseSpec || sc.settings.enableMdbaseSpec) {
			const cfgText = filesEnd["mdbase.yaml"]?.text ?? "";
			if (cfgText && !/spec_version:\s*"?0\.3/.test(cfgText)) add("warn", "mdbase-not-upgraded", cfgText.slice(0, 200));
		}
		const metaWrites = env.transfers.filter((t) => METADATA_RE.test(t.p) && t.op === "write");
		const perPath = {};
		for (const t of metaWrites) perPath[t.p] = (perPath[t.p] ?? 0) + 1;
		for (const [p, c] of Object.entries(perPath)) if (c > 3) add("warn", "metadata-churn", { path: p, syncedWrites: c });
		const backups = Object.keys(filesEnd).filter((p) => p.startsWith(".tasknotes/"));
		if (backups.length > 12) add("warn", "backup-pileup", backups.length);
		const conflicts = env.transfers.filter((t) => t.conflict);
		if (conflicts.length) add("info", "sync-conflicts", conflicts.map((c) => c.p));
		for (const d of [a, b]) {
			// v4 builds' own console errors are not ours to fix; report those from head.
			for (const e of new Set(d.console)) if (!NOISE.test(e) && e.includes("-head]")) add("warn", "console-error", `${d.name}: ${e}`);
		}
	} catch (e) {
		add("error", "harness-or-load-crash", String(e.stack || e));
	}
	await quit(a).catch(() => {}); await quit(b).catch(() => {});
	log.findings = findings;
	log.transfers = env.transfers;
	log.expectedSettings = expectedSettings;
	const bad = findings.some((f) => f.severity === "error");
	fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify(log, null, 2));
	if (!KEEP && !bad) for (const d of [a, b]) fs.rmSync(d.profile, { recursive: true, force: true });
	const summary = [...new Set(findings.filter((f) => f.severity !== "info").map((f) => `${f.severity}:${f.kind}`))];
	console.log(`seed ${seed} [${from} A→head, B on ${from}] ${sc.notes.join("; ")} :: ${bad ? "FAIL" : "ok"} ${summary.join(", ")}`);
}

const queue = [...SEEDS];
await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
	while (queue.length) await runScenario(queue.shift(), w);
}));
