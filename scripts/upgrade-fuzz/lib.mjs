// Shared harness for the upgrade fuzzers: isolated Obsidian launch/quit over CDP,
// settling, snapshots, in-app activity, in-place plugin updates and invariants.
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

/** Set by the runner: builds dir and unpacked Obsidian runtime. */
export const cfg = { builds: "", runtime: "" };

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const sha = (buf) => crypto.createHash("sha1").update(buf).digest("hex");

export function walk(root, rel = "", out = {}) {
	for (const ent of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
		const p = rel ? `${rel}/${ent.name}` : ent.name;
		if (ent.isDirectory()) {
			if (p === ".obsidian") continue;
			walk(root, p, out);
		} else if (ent.isFile()) {
			const buf = fs.readFileSync(path.join(root, p));
			out[p] = { sha: sha(buf), text: buf.length < 40000 ? buf.toString("utf8") : null };
		}
	}
	return out;
}

export const pluginDir = (vault) => path.join(vault, ".obsidian/plugins/tasknotes");
export function readData(vault) {
	try { return JSON.parse(fs.readFileSync(path.join(pluginDir(vault), "data.json"), "utf8")); } catch (e) { return { __unreadable: String(e) }; }
}
export function installBuild(vault, version) {
	const dir = pluginDir(vault);
	fs.mkdirSync(dir, { recursive: true });
	for (const f of ["main.js", "manifest.json", "styles.css"]) fs.copyFileSync(path.join(cfg.builds, version, f), path.join(dir, f));
}

export const NOTICE_HOOK = `(() => {
	if (window.__fuzzHooked) return; window.__fuzzHooked = true;
	window.__fuzzNotices = []; window.__fuzzErrors = [];
	const seen = new WeakSet();
	const grab = (el) => { if (seen.has(el)) return; seen.add(el); setTimeout(() => window.__fuzzNotices.push({ t: Date.now(), text: (el.textContent || '').slice(0, 600) }), 30); };
	new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) { if (n.nodeType !== 1) continue;
		if (n.matches && n.matches('.notice')) grab(n); n.querySelectorAll && n.querySelectorAll('.notice').forEach(grab); } })
		.observe(document, { childList: true, subtree: true });
	window.addEventListener('error', (e) => window.__fuzzErrors.push(String(e.message)));
	window.addEventListener('unhandledrejection', (e) => window.__fuzzErrors.push('unhandled: ' + String(e.reason && (e.reason.stack || e.reason))));
})()`;

export async function waitCdp(port, proc, timeout = 60000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		if (proc.exitCode !== null) throw new Error(`obsidian exited ${proc.exitCode}`);
		try {
			const res = await fetch(`http://127.0.0.1:${port}/json/version`);
			if (res.ok) return (await res.json()).webSocketDebuggerUrl;
		} catch { /* not yet */ }
		await sleep(250);
	}
	throw new Error("CDP timeout");
}

export async function launch(ctx) {
	const { profile, vault, port } = ctx;
	fs.mkdirSync(profile, { recursive: true });
	fs.writeFileSync(path.join(profile, "obsidian.json"), JSON.stringify({ updateDisabled: true, vaults: { fz: { path: vault, ts: Date.now(), open: true } } }));
	const bin = path.join(cfg.runtime, "obsidian");
	const proc = spawn("xvfb-run", ["-a", "-s", "-screen 0 1920x1080x24", bin, "--no-sandbox", "--password-store=basic",
		"--ozone-platform=x11", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, vault], {
		cwd: cfg.runtime, stdio: ["ignore", "pipe", "pipe"], detached: true, env: { ...process.env, DISPLAY: "", OBSIDIAN_CONFIG_DIR: profile },
	});
	let output = "";
	proc.stdout.on("data", (d) => { output = (output + d).slice(-4000); });
	proc.stderr.on("data", (d) => { output = (output + d).slice(-4000); });
	ctx.proc = proc;
	const ws = await waitCdp(port, proc);
	const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
	ctx.browser = browser;
	let page;
	for (let i = 0; i < 200 && !page; i++) {
		page = browser.contexts()[0]?.pages().find((p) => !p.url().startsWith("devtools"));
		if (!page) await sleep(100);
	}
	if (!page) throw new Error("no page " + ws + output);
	ctx.page = page;
	page.on("console", (m) => { if (m.type() === "error") ctx.console.push(`[${ctx.phase}] ${m.text().slice(0, 800)}`); });
	page.on("dialog", (d) => { d.accept().catch(() => {}); });
	page.on("pageerror", (e) => ctx.console.push(`[${ctx.phase}] pageerror ${String(e.stack || e).slice(0, 800)}`));
	await page.waitForFunction(() => window.app?.workspace?.layoutReady, null, { timeout: 60000 });
	const vaultPath = await page.evaluate(() => window.app.vault.adapter.basePath);
	if (path.resolve(vaultPath) !== path.resolve(vault)) throw new Error(`unexpected vault ${vaultPath}`);
	await page.evaluate(NOTICE_HOOK);
	// trust prompt on first open of this vault in this profile
	for (let i = 0; i < 20; i++) {
		const state = await page.evaluate(() => {
			if (window.app.plugins.enabledPlugins.has("tasknotes") && window.app.plugins.plugins.tasknotes) return "ready";
			const labels = ["Trust author and enable plugins", "Trust", "Turn on community plugins", "Enable community plugins"];
			const btn = [...document.querySelectorAll("button")].find((b) => labels.includes(b.textContent.trim()) && b.getClientRects().length);
			if (btn) { btn.click(); return "clicked"; }
			return "waiting";
		});
		if (state === "ready") break;
		await sleep(500);
	}
	return page;
}

export async function quit(ctx) {
	try { await ctx.page?.evaluate(() => window.app.workspace.requestSaveLayout?.run?.()); } catch { /* ignore */ }
	// Quit like a user does, so Chromium flushes localStorage (where desktop secrets live).
	try { await ctx.page?.evaluate(() => { setTimeout(() => window.electron.remote.app.quit(), 50); }); } catch { /* ignore */ }
	for (let i = 0; i < 100 && ctx.proc && ctx.proc.exitCode === null; i++) await sleep(100);
	ctx.gracefulExit = ctx.proc?.exitCode !== null;
	try { await ctx.browser?.close(); } catch { /* ignore */ }
	if (ctx.proc && ctx.proc.exitCode === null) {
		try { process.kill(-ctx.proc.pid, "SIGTERM"); } catch { /* ignore */ }
		for (let i = 0; i < 40 && ctx.proc.exitCode === null; i++) await sleep(100);
		try { process.kill(-ctx.proc.pid, "SIGKILL"); } catch { /* ignore */ }
	}
	ctx.page = ctx.browser = ctx.proc = undefined;
	await sleep(500);
}

/** Wait for the plugin to be loaded and the vault to stop changing. */
export async function settle(ctx, label, maxMs = 45000) {
	const { page } = ctx;
	const start = Date.now();
	const loaded = await page.waitForFunction(() => !!window.app.plugins.plugins.tasknotes, null, { timeout: 60000 }).then(() => true, () => false);
	if (!loaded) return { loaded: false };
	await page.evaluate(() => {
		if (window.__fuzzVaultHook) return; window.__fuzzVaultHook = true; window.__fuzzLastChange = Date.now(); window.__fuzzChanges = [];
		for (const ev of ["create", "modify", "delete", "rename"]) window.app.vault.on(ev, (f) => { window.__fuzzLastChange = Date.now(); window.__fuzzChanges.push(`${ev} ${f.path}`); });
	});
	let lastCount = -1;
	while (Date.now() - start < maxMs) {
		const s = await page.evaluate(async () => {
			const p = window.app.plugins.plugins.tasknotes;
			let count = -1;
			try { count = (await p.cacheManager.getAllTasks()).length; } catch { /* not ready */ }
			return { count, quiet: Date.now() - window.__fuzzLastChange };
		});
		if (s.count === lastCount && s.quiet > 3000 && Date.now() - start > 4000) return { loaded: true, ms: Date.now() - start };
		lastCount = s.count;
		await sleep(1500);
	}
	return { loaded: true, timeout: true };
}

export async function snapshotPage(ctx) {
	return ctx.page.evaluate(async () => {
		const p = window.app.plugins.plugins.tasknotes;
		const out = { loaded: !!p, version: p?.manifest?.version, notices: window.__fuzzNotices || [], errors: window.__fuzzErrors || [], changes: window.__fuzzChanges || [] };
		if (!p) return out;
		try {
			const tasks = await p.cacheManager.getAllTasks();
			const pick = (t) => {
				const o = {};
				for (const k of ["title", "status", "priority", "due", "scheduled", "completedDate", "recurrence", "recurrence_anchor", "tags", "contexts", "projects", "archived", "timeEstimate", "complete_instances", "skipped_instances", "dateCreated", "id"]) {
					if (t[k] !== undefined && t[k] !== null && !(Array.isArray(t[k]) && !t[k].length) && t[k] !== "") o[k] = t[k];
				}
				for (const k of ["timeEntries", "blockedBy", "reminders"]) if (Array.isArray(t[k]) && t[k].length) o[k] = t[k].length;
				if (t.customProperties && Object.keys(t.customProperties).length) o.customProperties = t.customProperties;
				return o;
			};
			out.tasks = Object.fromEntries(tasks.map((t) => [t.path, JSON.parse(JSON.stringify(pick(t)))]));
		} catch (e) { out.taskError = String(e); }
		try { out.settings = JSON.parse(JSON.stringify(p.settings)); } catch (e) { out.settingsError = String(e); }
		try { out.secretToken = window.app.secretStorage?.getSecret?.("tasknotes-api-auth-token") ?? null; } catch (e) { out.secretToken = "ERR " + e; }
		out.localLastSeen = window.app.loadLocalStorage("tasknotes-last-seen-version");
		return out;
	});
}

export async function runActivities(ctx, acts, seed) {
	return ctx.page.evaluate(async ({ acts, seed }) => {
		const p = window.app.plugins.plugins.tasknotes;
		let s = seed || 7;
		const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
		const log = [];
		const tasks = async () => (await p.cacheManager.getAllTasks()).sort((a, b) => a.path.localeCompare(b.path));
		for (const a of acts) {
			try {
				const all = await tasks();
				const any = all[Math.floor(rand() * all.length)];
				if (a.kind === "create") {
					const r = await p.taskService.createTask({ title: a.title, due: a.due, recurrence: a.recurrence, status: p.settings.defaultTaskStatus, priority: p.settings.defaultTaskPriority });
					log.push(`create ${r?.file?.path}`);
				} else if (a.kind === "toggle" && any && !any.recurrence) {
					await p.taskService.toggleStatus(any); log.push(`toggle ${any.path}`);
				} else if (a.kind === "timer" && any) {
					const started = await p.taskService.startTimeTracking(any);
					await new Promise((r) => setTimeout(r, 300));
					await p.taskService.stopTimeTracking(started); log.push(`timer ${any.path}`);
				} else if (a.kind === "recurring-complete") {
					const rec = all.find((t) => t.recurrence && /FREQ/.test(t.recurrence));
					if (rec) { await p.taskService.toggleRecurringTaskComplete(rec, new Date()); log.push(`recur ${rec.path}`); }
				} else if (a.kind === "set-priority" && any) {
					await p.taskService.updateProperty(any, "priority", p.settings.customPriorities[0].value); log.push(`prio ${any.path}`);
				} else if (a.kind === "save-settings") {
					await p.saveSettings(); log.push("save");
				} else if (a.kind === "change-setting") {
					p.settings[a.key] = a.value; await p.saveSettings(); log.push(`set ${a.key}=${JSON.stringify(a.value)}`);
				}
			} catch (e) { log.push(`ERR ${a.kind}: ${String(e).slice(0, 200)}`); }
			await new Promise((r) => setTimeout(r, 400));
		}
		return log;
	}, { acts, seed });
}

export async function updateInPlace(ctx, version) {
	installBuild(ctx.vault, version);
	return ctx.page.evaluate(async () => {
		const pl = window.app.plugins;
		await pl.loadManifests?.();
		if (typeof pl.unloadPlugin === "function" && typeof pl.loadPlugin === "function") {
			await pl.unloadPlugin("tasknotes");
			await pl.loadPlugin("tasknotes");
		} else {
			await pl.disablePlugin("tasknotes");
			await pl.enablePlugin("tasknotes");
		}
		return pl.plugins.tasknotes?.manifest?.version ?? null;
	});
}

export async function smokeViews(ctx) {
	const results = {};
	for (const cmd of ["tasknotes:open-tasks-view", "tasknotes:open-kanban-view", "tasknotes:open-advanced-calendar-view", "tasknotes:open-agenda-view"]) {
		const before = ctx.console.length;
		const r = await ctx.page.evaluate(async (cmd) => {
			const ok = window.app.commands.executeCommandById(cmd);
			await new Promise((res) => setTimeout(res, 2500));
			const leaf = window.app.workspace.getMostRecentLeaf?.() || window.app.workspace.activeLeaf;
			const root = leaf?.view?.containerEl;
			return { ok, viewType: leaf?.view?.getViewType?.(), file: leaf?.view?.file?.path,
				cards: root ? root.querySelectorAll("[data-task-path], .task-card, .tn-row, .fc-event").length : -1,
				errorText: root ? [...root.querySelectorAll(".bases-error, .tasknotes-error, .tn-error")].map((e) => e.textContent).join(" | ").slice(0, 300) : "" };
		}, cmd).catch((e) => ({ err: String(e) }));
		r.newConsoleErrors = [...new Set(ctx.console.slice(before))].filter((e) => !/DateUtils\]\[validation\]|Failed to load resource/.test(e));
		results[cmd] = r;
	}
	return results;
}

// ---------- invariants ----------
export const DEVICE_LOCAL = ["apiAuthToken", "lastSeenVersion", "lastNotifiedReleaseVersion"];
export const OAUTH_KEYS = ["googleOAuthClientId", "googleOAuthClientSecret", "microsoftOAuthClientId", "microsoftOAuthClientSecret", "oauthConnections"];
export const METADATA_RE = /^(mdbase\.yaml|mdbase\.lock\.yaml|_types\/|_contracts\/|_schemas\/|_settings\/|\.tasknotes\/)/;

export function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
/** after keeps everything before had (new keys / new id'd array entries are fine). */
export function keeps(before, after) {
	if (deepEqual(before, after)) return true;
	if (Array.isArray(before) && Array.isArray(after)) {
		const byId = before.every((x) => x && typeof x === "object" && "id" in x);
		return before.every((x, i) => keeps(x, byId ? after.find((y) => y?.id === x.id) : after[i]));
	}
	if (before && after && typeof before === "object" && typeof after === "object") return Object.keys(before).every((k) => keeps(before[k], after[k]));
	return false;
}
export const norm = (field, v) => {
	if (Array.isArray(v)) return v.map((x) => (field === "tags" && typeof x === "string" ? x.replace(/^#/, "") : x));
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	return v;
};
export function diffKeys(before, after, prefix = "") {
	const out = [];
	for (const k of new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])) {
		const a = before?.[k], b = after?.[k], p = prefix ? `${prefix}.${k}` : k;
		if (deepEqual(a, b)) continue;
		if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) out.push(...diffKeys(a, b, p));
		else out.push({ path: p, before: a, after: b });
	}
	return out;
}

/** Settings in `before` that `after` lost or changed, minus known benign migrations. */
export function settingsFindings(dBefore, dAfter) {
	const out = [];
	const add = (severity, kind, detail) => out.push({ severity, kind, detail });
	for (const d of diffKeys(dBefore, dAfter)) {
		const top = d.path.split(".")[0];
		if (DEVICE_LOCAL.includes(top) && d.after === undefined) continue;
		if (OAUTH_KEYS.includes(top) && d.after === undefined) continue;
		if (d.before === undefined) continue; // new setting with default
		if (["useNativeMetadataCache"].includes(top) && d.after === undefined) continue;
		if (d.after !== undefined && keeps(d.before, d.after)) continue;
		if (top === "customFilenameTemplate" && d.before === "{title}" && d.after === "{{title}}") continue;
		if (top === "starterNoteCreated" && d.after === true) continue; // v5 sets it for 4.x devices sharing data.json
		if (top === "excludedFolders" && String(d.before).split(",").map((x) => x.trim()).filter(Boolean).join(",") === String(d.after).split(",").map((x) => x.trim()).filter(Boolean).join(",")) continue;
		add(d.after === undefined ? "error" : "warn", d.after === undefined ? "setting-removed" : "setting-changed", d);
	}
	return out;
}

export function check(sc, st) {
	const findings = [];
	const add = (severity, kind, detail) => findings.push({ severity, kind, detail });
	const { preHead, postUpdate, postRestart, postReload, origin } = st;

	for (const [label, snap] of [["update", postUpdate], ["restart", postRestart], ["reload", postReload]]) {
		if (!snap?.page?.loaded) add("error", "plugin-not-loaded", label);
		else if (snap.page.version !== st.headVersion) add("error", "wrong-version", `${label} ${snap.page.version}`);
		if (snap?.settle?.timeout) add("warn", "never-settled", `${label}: vault kept changing / task count unstable after 45s; changes: ${snap.page?.changes?.slice(-10).join("; ")}`);
		if (snap?.page?.taskError) add("error", "task-cache-error", `${label}: ${snap.page.taskError}`);
		for (const e of snap?.page?.errors ?? []) add("error", "window-error", `${label}: ${e}`);
	}

	// 1. files: pre-existing files must not change outside managed metadata
	const filesBefore = preHead.files, filesAfter = postUpdate.files;
	for (const [p, f] of Object.entries(filesBefore)) {
		const g = filesAfter[p];
		if (!g) { add(METADATA_RE.test(p) ? "warn" : "error", "file-deleted", p); continue; }
		if (g.sha !== f.sha) {
			if (METADATA_RE.test(p)) {
				const backups = Object.entries(filesAfter).filter(([q, h]) => q.startsWith(".tasknotes/") && h.sha === f.sha);
				if (!backups.length) add("error", "metadata-changed-without-backup", p);
			} else {
				add("error", "file-modified", { path: p, before: f.text?.slice(0, 1500), after: g.text?.slice(0, 1500) });
			}
		}
	}
	const created = Object.keys(filesAfter).filter((p) => !filesBefore[p]);
	if (created.length) add("info", "files-created", created);

	// 2. data.json: no setting lost or silently altered
	const dBefore = preHead.data, dAfter = postUpdate.data;
	if (dAfter.__unreadable) add("error", "data-json-unreadable", dAfter.__unreadable);
	for (const { severity, kind, detail } of settingsFindings(dBefore, dAfter)) add(severity, kind, detail);
	for (const k of DEVICE_LOCAL) if (k in dAfter) add("warn", "device-local-in-data-json", k);

	// 3. device-local migration
	const tokenBefore = dBefore.apiAuthToken || preHead.page.settings?.apiAuthToken;
	if (tokenBefore && postUpdate.page.secretToken !== tokenBefore) add("error", "api-token-lost", { before: tokenBefore, secret: postUpdate.page.secretToken });
	if (tokenBefore && postRestart.page.secretToken !== tokenBefore) add("error", "api-token-lost-after-restart", { before: tokenBefore, secret: postRestart.page.secretToken });

	// 4. task parity vs pre-head and vs the very first build
	const parity = (ref, cur, label) => {
		if (!ref || !cur) return;
		for (const p of Object.keys(ref)) if (!cur[p]) add("error", "task-lost", `${label}: ${p}`);
		for (const p of Object.keys(cur)) if (!ref[p]) add("warn", "task-appeared", `${label}: ${p}`);
		for (const [p, t] of Object.entries(ref)) {
			const u = cur[p];
			if (!u) continue;
			for (const k of Object.keys(t)) {
				if (k === "id") continue;
				// v5 no longer presents a missing priority as "normal" (9ee14c8d1); frontmatter is unchanged.
				if (k === "priority" && t[k] === "normal" && u[k] === undefined) continue;
				if (k === "title" && t[k] === "Untitled task") continue; // pre-4.6 placeholder; v5 falls back to the filename
				if (!deepEqual(norm(k, t[k]), norm(k, u[k]))) add("error", "task-field-changed", { label, path: p, field: k, before: t[k], after: u[k] });
			}
		}
	};
	parity(preHead.page.tasks, postUpdate.page.tasks, "pre-head→update");
	parity(postUpdate.page.tasks, postRestart.page.tasks, "update→restart");
	if (origin !== preHead) parity(origin.page.tasks, postUpdate.page.tasks, "origin→head");

	// 5. restart idempotence
	for (const d of diffKeys(postUpdate.data, postRestart.data)) add("warn", "data-json-changed-on-restart", d);
	for (const [p, f] of Object.entries(postUpdate.files)) {
		const g = postRestart.files[p];
		if (!g) add("error", "file-deleted-on-restart", p);
		else if (g.sha !== f.sha) add(METADATA_RE.test(p) ? "warn" : "error", "file-changed-on-restart", { path: p, before: f.text?.slice(0, 800), after: g.text?.slice(0, 800) });
	}
	for (const p of Object.keys(postRestart.files)) if (!postUpdate.files[p]) add("info", "file-created-on-restart", p);

	// 6. mdbase
	if (dBefore.enableMdbaseSpec && filesBefore["mdbase.yaml"]) {
		const cfg = filesAfter["mdbase.yaml"]?.text ?? "";
		if (!/spec_version:\s*"?0\.3/.test(cfg)) add("warn", "mdbase-not-upgraded", { cfg: cfg.slice(0, 300), notices: postUpdate.page.notices.map((n) => n.text) });
	}

	// 7. console errors and notices
	const noise = /DateUtils\]\[validation\]|Failed to load resource/;
	for (const e of new Set(st.consoleHead)) if (!noise.test(e)) add("warn", "console-error", e);
	const noticeTexts = [...postUpdate.page.notices, ...postRestart.page.notices, ...postReload.page.notices].map((n) => n.text);
	if (noticeTexts.length) add("info", "notices", noticeTexts);
	for (const [cmd, r] of Object.entries(st.smoke ?? {})) {
		if (r.err || r.ok === false) add("warn", "view-open-failed", { cmd, ...r });
		if (r.errorText) add("warn", "view-error-text", { cmd, text: r.errorText });
		if (r.newConsoleErrors?.length) add("warn", "view-console-errors", { cmd, errors: r.newConsoleErrors });
	}
	return findings;
}
