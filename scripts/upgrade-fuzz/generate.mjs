// Random v4 / v5-beta vault + settings state generator for the upgrade fuzzer.
// Everything is derived from a seed so a failing scenario can be replayed exactly.

export function rng(seed) {
	let s = seed >>> 0 || 1;
	const next = () => {
		s ^= s << 13; s >>>= 0;
		s ^= s >>> 17;
		s ^= s << 5; s >>>= 0;
		return s / 4294967296;
	};
	const r = {
		next,
		int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
		chance: (p) => next() < p,
		pick: (arr) => arr[Math.floor(next() * arr.length)],
		sample: (arr, n) => {
			const copy = [...arr];
			const out = [];
			while (copy.length && out.length < n) out.push(copy.splice(Math.floor(next() * copy.length), 1)[0]);
			return out;
		},
	};
	return r;
}

export const V4_VERSIONS = ["4.3.2", "4.5.0", "4.9.2", "4.12.0", "4.13.7", "4.14.0", "4.16.1", "4.17.0"];
export const BETAS = [
	"5.0.0-beta.0", "5.0.0-beta.1", "5.0.0-beta.2", "5.0.0-beta.3",
	"5.0.0-beta.4", "5.0.0-beta.5", "5.0.0-beta.6", "5.0.0-beta.7",
];

const WORDS = ["write", "report", "call", "Bob", "fix", "the", "roof", "plan", "trip", "review", "PR", "draft",
	"email", "budget", "Q3", "café", "naïve", "日本語", "emoji 🎉", "a/b", "x:y", "#hash", "[[link]]", "100%", "quote's"];

function title(r) {
	const n = r.int(1, 5);
	const parts = [];
	for (let i = 0; i < n; i++) parts.push(r.pick(WORDS));
	return parts.join(" ").replace(/\s+/g, " ").trim();
}

function safeName(t) {
	return t.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim().slice(0, 60) || "untitled";
}

function isoDate(r, spreadDays = 60) {
	const d = new Date(Date.UTC(2026, 10, 10) + r.int(-spreadDays, spreadDays) * 86400000);
	return d.toISOString().slice(0, 10);
}

function dateValue(r) {
	const d = isoDate(r);
	return r.pick([
		d, d, d,
		`${d}T${String(r.int(0, 23)).padStart(2, "0")}:${r.pick(["00", "15", "30", "45"])}`,
		`${d}T09:00:00`,
		"", null, "not a date", "2026-13-45", 20261110,
	]);
}

const RRULES = [
	"FREQ=DAILY", "FREQ=WEEKLY;BYDAY=MO,WE,FR", "FREQ=MONTHLY;BYMONTHDAY=15",
	"DTSTART:20260101T000000Z;FREQ=WEEKLY;INTERVAL=2", "FREQ=YEARLY", "every day", "FREQ=DAILY;COUNT=5",
	"DTSTART:20261001;FREQ=DAILY;UNTIL=20261231", "garbage-rule",
];

function yamlScalar(v) {
	if (v === null) return "null";
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	const s = String(v);
	if (s === "" || /[:#\[\]{}&*!|>'"%@`,]|^\s|\s$|^(true|false|null|yes|no|on|off|~)$|^[0-9.\-]+$/i.test(s) && !/^\d{4}-\d{2}-\d{2}/.test(s)) {
		return JSON.stringify(s);
	}
	return s;
}

function yaml(fm, r) {
	const lines = [];
	for (const [k, v] of Object.entries(fm)) {
		if (v === undefined) continue;
		if (Array.isArray(v)) {
			if (v.length === 0) { lines.push(`${k}: []`); continue; }
			if (v.every((x) => typeof x !== "object") && r.chance(0.3)) {
				lines.push(`${k}: [${v.map((x) => JSON.stringify(x)).join(", ")}]`);
			} else {
				lines.push(`${k}:`);
				for (const item of v) {
					if (item && typeof item === "object") {
						const entries = Object.entries(item);
						entries.forEach(([ik, iv], idx) => lines.push(`${idx === 0 ? "  - " : "    "}${ik}: ${yamlScalar(iv)}`));
					} else lines.push(`  - ${yamlScalar(item)}`);
				}
			}
		} else lines.push(`${k}: ${yamlScalar(v)}`);
	}
	return lines.join("\n");
}

const FIELD_KEYS = ["title", "status", "priority", "due", "scheduled", "contexts", "projects", "timeEstimate",
	"completedDate", "dateCreated", "dateModified", "recurrence", "archiveTag", "timeEntries",
	"completeInstances", "skippedInstances", "blockedBy", "reminders", "pomodoros"];

/** Settings overrides seeded into data.json before the first (old-version) launch. */
export function generateSettings(r, version) {
	const s = {};
	const notes = [];
	const isBeta = version.startsWith("5.");

	if (r.chance(0.35)) {
		s.taskIdentificationMethod = "property";
		s.taskPropertyName = r.pick(["type", "category", "isTask", "kind"]);
		s.taskPropertyValue = s.taskPropertyName === "isTask" ? "true" : r.pick(["task", "Task", "todo"]);
		notes.push("property identification");
	} else if (r.chance(0.3)) {
		s.taskTag = r.pick(["todo", "tasks/active", "TASK", "work/task"]);
		notes.push(`tag ${s.taskTag}`);
	}
	if (r.chance(0.4)) s.tasksFolder = r.pick(["Tasks", "", "Work/Tasks", "TaskNotes/Tasks", "Ünïcode/タスク"]);
	if (r.chance(0.25)) s.excludedFolders = r.pick(["Archive", "Templates, Archive", "Old/", " spaced , list "]);
	if (r.chance(0.2)) { s.moveArchivedTasks = true; s.archiveFolder = r.pick(["Archive", "TaskNotes/Archive/{{year}}"]); }

	if (r.chance(0.45)) {
		const mapping = {};
		for (const k of r.sample(FIELD_KEYS, r.int(1, 6))) {
			mapping[k] = r.pick([`${k}_x`, `tn-${k.toLowerCase()}`, k === "due" ? "deadline" : `my${k}`, `${k}Date`]);
		}
		// avoid two fields colliding on the same property
		const seen = new Set();
		for (const [k, v] of Object.entries(mapping)) { if (seen.has(v)) delete mapping[k]; else seen.add(v); }
		s.fieldMapping = mapping;
		notes.push(`fieldMapping ${Object.keys(mapping).join(",")}`);
	}

	if (r.chance(0.4)) {
		const statuses = [
			{ id: "none", value: "none", label: "None", color: "#cccccc", isCompleted: false, order: 0 },
			{ id: "open", value: "open", label: "Open", color: "#808080", isCompleted: false, order: 1 },
			{ id: "in-progress", value: r.pick(["in-progress", "doing", "WIP"]), label: "Doing", color: "#0066cc", isCompleted: false, order: 2 },
			{ id: "done", value: r.pick(["done", "complete", "✓"]), label: "Done", color: "#00aa00", isCompleted: true, order: 3 },
		];
		if (r.chance(0.5)) statuses.push({ id: "cancelled", value: "cancelled", label: "Cancelled", color: "#aa0000", isCompleted: true, order: 4, excludeFromCycle: true });
		if (r.chance(0.3)) statuses.push({ id: "waiting", value: "waiting on", label: "Waiting", color: "#aaaa00", isCompleted: false, order: 5, autoArchive: true, autoArchiveDelay: 10 });
		if (r.chance(0.2)) statuses.splice(0, 1); // drop "none"
		s.customStatuses = statuses;
		s.defaultTaskStatus = r.pick(statuses.filter((x) => !x.isCompleted)).value;
		notes.push(`statuses ${statuses.map((x) => x.value).join("|")}`);
	}
	if (r.chance(0.3)) {
		s.customPriorities = [
			{ id: "p1", value: "p1", label: "P1", color: "#f00", weight: 3 },
			{ id: "p2", value: "p2", label: "P2", color: "#fa0", weight: 2 },
			{ id: "p3", value: r.pick(["p3", "low", "3"]), label: "P3", color: "#0a0", weight: 1 },
		];
		s.defaultTaskPriority = "p2";
		notes.push("custom priorities");
	}
	if (r.chance(0.4)) {
		const types = ["text", "number", "date", "boolean", "list"];
		s.userFields = r.sample(types, r.int(1, 4)).map((type, i) => ({
			id: `uf${i}`,
			displayName: r.pick(["Effort", "Area", "Due Soon", "Client", "Is Billable"]) + i,
			key: r.pick([`field${i}`, ` padded${i} `, `area-${i}`]),
			type,
		}));
		notes.push(`userFields ${s.userFields.map((f) => f.type).join(",")}`);
	}
	if (!isBeta && r.chance(0.15)) {
		s.userField = { enabled: true, displayName: "Legacy Effort", key: "effort", type: r.pick(["number", "text"]) };
		notes.push("legacy single userField");
	}
	if (r.chance(0.2)) { s.statusSuggestionTrigger = r.pick(["*", "$", ""]); delete s.nlpTriggers; notes.push("statusSuggestionTrigger"); }
	if (r.chance(0.3)) { s.taskFilenameFormat = r.pick(["title", "zettel", "timestamp", "custom"]); s.customFilenameTemplate = r.pick(["{title}", "{{title}}", "{{date}}-{{title}}", "{zettel}"]); }
	if (r.chance(0.2)) s.storeTitleInFilename = false;

	if (r.chance(0.4)) {
		s.enableAPI = r.chance(0.5);
		s.apiPort = r.int(18000, 18999);
		s.apiAuthToken = r.pick(["", `tok-${r.int(1e6, 9e6)}`]);
		notes.push(`api token ${s.apiAuthToken ? "set" : "empty"}`);
	}
	if (r.chance(0.3)) s.lastSeenVersion = r.pick(["4.0.0", "4.13.7", "3.25.6", version]);
	if (r.chance(0.2)) s.lastNotifiedReleaseVersion = r.pick(["4.16.0", "5.0.0-beta.3"]);
	if (r.chance(0.3)) { s.enableMdbaseSpec = true; notes.push("mdbase"); }
	if (r.chance(0.2)) s.useFrontmatterMarkdownLinks = true;
	if (r.chance(0.2)) s.resetCheckboxesOnRecurrence = true;
	if (r.chance(0.2)) s.maintainDueDateOffsetInRecurring = true;
	if (r.chance(0.15)) s.autoCreateDefaultBasesFiles = false;
	if (r.chance(0.2)) s.pomodoroWorkDuration = r.int(1, 90);
	if (r.chance(0.2)) s.pomodoroStorageLocation = "daily-notes";
	if (r.chance(0.2)) {
		s.webhooks = [{ id: "wh1", url: "http://127.0.0.1:9/hook", events: ["task.created"], secret: "s3cret", active: r.chance(0.5), createdAt: "2026-01-01T00:00:00.000Z", failureCount: 0, successCount: 3 }];
	}
	if (r.chance(0.2)) {
		s.icsIntegration = { defaultNoteTemplate: "", defaultNoteFolder: "Meetings", icsNoteFilenameFormat: "title", customICSNoteFilenameTemplate: "{title}", useICSEndAsDue: true };
	}
	if (r.chance(0.25)) {
		s.savedViews = [{ id: "sv1", name: "My view", query: { type: "group", id: "root", conjunction: "and", children: [], sortKey: "due", sortDirection: "asc", groupKey: "status" } }];
		notes.push("savedViews");
	}
	if (r.chance(0.15)) { s.googleOAuthClientId = "legacy-client-id"; s.googleOAuthClientSecret = "legacy-secret"; notes.push("legacy oauth in data.json"); }
	if (r.chance(0.2)) s.commandFileMapping = { "open-tasks-view": r.pick(["Custom/My Tasks.base", "TaskNotes/Views/tasks-default.base"]) };
	if (r.chance(0.2)) s.uiLanguage = r.pick(["de", "fr", "ja", "system"]);
	if (r.chance(0.15)) s.unknownFutureKey = { nested: [1, 2, 3] }; // keys TaskNotes does not know about must survive
	if (r.chance(0.1)) s.enableBases = r.pick([true, false]);
	if (r.chance(0.1)) s.useNativeMetadataCache = true;
	if (r.chance(0.2)) s.taskCreationDefaults = { defaultTags: "work, home", defaultContexts: "@office", useParentNoteAsProject: r.chance(0.5), defaultReminders: [] };
	if (r.chance(0.2)) s.calendarViewSettings = { defaultView: r.pick(["dayGridMonth", "timeGridWeek"]), firstDay: r.int(0, 6), slotDuration: "00:15:00" };
	return { settings: s, notes };
}

function effective(settingsOverrides) {
	const fm = { title: "title", status: "status", priority: "priority", due: "due", scheduled: "scheduled",
		contexts: "contexts", projects: "projects", timeEstimate: "timeEstimate", completedDate: "completedDate",
		dateCreated: "dateCreated", dateModified: "dateModified", recurrence: "recurrence", archiveTag: "archived",
		timeEntries: "timeEntries", completeInstances: "complete_instances", skippedInstances: "skipped_instances",
		blockedBy: "blockedBy", reminders: "reminders", pomodoros: "pomodoros", ...(settingsOverrides.fieldMapping || {}) };
	const statuses = (settingsOverrides.customStatuses || [
		{ value: "none" }, { value: "open" }, { value: "in-progress" }, { value: "done", isCompleted: true }]).map((x) => x.value);
	const priorities = (settingsOverrides.customPriorities || [{ value: "none" }, { value: "low" }, { value: "normal" }, { value: "high" }]).map((x) => x.value);
	return {
		fm, statuses, priorities,
		method: settingsOverrides.taskIdentificationMethod || "tag",
		tag: settingsOverrides.taskTag || "task",
		propName: settingsOverrides.taskPropertyName, propValue: settingsOverrides.taskPropertyValue,
		folder: settingsOverrides.tasksFolder ?? "TaskNotes/Tasks",
		userFields: settingsOverrides.userFields || [],
	};
}

/** Vault files written to disk before the first launch. Map path -> string | Buffer */
export function generateVault(r, settingsOverrides) {
	const e = effective(settingsOverrides);
	const files = {};
	const taskCount = r.int(0, 30);
	const folders = [e.folder, e.folder, "", "Projects", "Archive", "deep/nested/folder", "Templates"];
	const projects = [];
	for (let i = 0; i < r.int(0, 3); i++) {
		const p = `Projects/Project ${i}.md`;
		projects.push(p.replace(/\.md$/, ""));
		files[p] = `---\ntags: [project]\n---\n# Project ${i}\n`;
	}
	const taskPaths = [];
	for (let i = 0; i < taskCount; i++) {
		const t = title(r);
		const folder = r.pick(folders);
		const name = `${safeName(t)} ${i}`;
		const path = `${folder ? folder + "/" : ""}${name}.md`;
		taskPaths.push(path.replace(/\.md$/, ""));
		const fm = {};
		const ident = r.chance(0.92); // a few near-tasks that do not identify as tasks
		if (e.method === "tag") {
			const tags = [];
			if (ident) tags.push(r.chance(0.8) ? e.tag : `${e.tag}/sub`);
			if (r.chance(0.4)) tags.push(r.pick(["work", "home", "errand", "#hashed"]));
			if (tags.length || r.chance(0.5)) fm.tags = tags;
		} else if (ident) {
			fm[e.propName] = e.propValue === "true" ? true : e.propValue;
		}
		if (r.chance(0.85)) fm[e.fm.title] = r.chance(0.9) ? t : "";
		if (r.chance(0.9)) fm[e.fm.status] = r.chance(0.9) ? r.pick(e.statuses) : r.pick(["Unknown", "TODO", 3, true]);
		if (r.chance(0.7)) fm[e.fm.priority] = r.chance(0.9) ? r.pick(e.priorities) : r.pick(["urgent", 1]);
		if (r.chance(0.5)) fm[e.fm.due] = dateValue(r);
		if (r.chance(0.5)) fm[e.fm.scheduled] = dateValue(r);
		if (r.chance(0.3)) fm[e.fm.contexts] = r.chance(0.8) ? r.sample(["home", "office", "@phone", "errands"], r.int(1, 2)) : "office";
		if (projects.length && r.chance(0.4)) fm[e.fm.projects] = [`[[${r.pick(projects)}]]`];
		if (r.chance(0.3)) fm[e.fm.timeEstimate] = r.pick([15, 30, 90, "45", 0]);
		if (r.chance(0.6)) fm[e.fm.dateCreated] = `${isoDate(r, 300)}T10:00:00.000${r.pick(["Z", "+10:00", "-05:00"])}`;
		if (r.chance(0.5)) fm[e.fm.dateModified] = `${isoDate(r, 30)}T11:00:00.000+10:00`;
		const done = fm[e.fm.status] === "done" || fm[e.fm.status] === "complete";
		if (done && r.chance(0.7)) fm[e.fm.completedDate] = isoDate(r, 30);
		if (r.chance(0.25)) {
			fm[e.fm.recurrence] = r.pick(RRULES);
			if (r.chance(0.6)) fm[e.fm.completeInstances] = r.sample(["2026-11-01", "2026-11-02", "2026-11-03", "2026-10-30"], r.int(0, 3));
			if (r.chance(0.3)) fm[e.fm.skippedInstances] = ["2026-11-05"];
			if (r.chance(0.3)) fm.recurrence_anchor = r.pick(["scheduled", "completion"]);
		}
		if (r.chance(0.25)) {
			fm[e.fm.timeEntries] = Array.from({ length: r.int(1, 3) }, (_, k) => {
				const entry = { startTime: `2026-11-0${k + 1}T09:00:00.000Z` };
				if (r.chance(0.85)) entry.endTime = `2026-11-0${k + 1}T09:${r.pick(["25", "45", "59"])}:00.000Z`;
				if (r.chance(0.3)) entry.description = "Work session";
				return entry;
			});
		}
		if (taskPaths.length > 1 && r.chance(0.2)) {
			fm[e.fm.blockedBy] = r.chance(0.6)
				? [{ uid: `[[${r.pick(taskPaths.slice(0, -1))}]]`, reltype: "FINISHTOSTART" }]
				: [`[[${r.pick(taskPaths.slice(0, -1))}]]`];
		}
		if (r.chance(0.15)) {
			fm[e.fm.reminders] = [r.chance(0.5)
				? { id: `rem_${i}`, type: "relative", relatedTo: "due", offset: "-PT15M", description: "Soon" }
				: { id: `rem_${i}`, type: "absolute", absoluteTime: "2026-11-20T09:00:00", description: "" }];
		}
		if (r.chance(0.1)) fm[e.fm.archiveTag] = true;
		if (r.chance(0.15)) fm.id = r.pick([`task-${i}`, `0192c0de-0000-7000-8000-${String(i).padStart(12, "0")}`]);
		for (const uf of e.userFields) {
			if (!r.chance(0.5)) continue;
			const key = uf.key.trim();
			fm[key] = uf.type === "number" ? r.pick([3, "5", 0.5]) : uf.type === "boolean" ? r.pick([true, false, "yes"])
				: uf.type === "date" ? isoDate(r) : uf.type === "list" ? ["a", "b"] : "Acme";
		}
		if (r.chance(0.1)) fm.custom_unknown = { nested: { deep: [1, "two"] } };
		if (r.chance(0.1)) fm.aliases = [t.slice(0, 10)];
		const bodies = ["", "\nSome notes about this task.\n", "\n- [ ] subtask one\n- [x] subtask two\n",
			"\n## Log\n\n- did a thing\n\n```js\nconsole.log('---')\n```\n", "\n![[image.png]]\n> [!note]\n> callout\n"];
		let text = `---\n${yaml(fm, r)}\n---\n${r.pick(bodies)}`;
		if (r.chance(0.08)) text = text.replace(/\n/g, "\r\n");
		if (r.chance(0.05)) text = "﻿" + text;
		files[path] = text;
	}
	// non-task notes that must never change
	for (let i = 0; i < r.int(1, 6); i++) {
		const kind = r.pick(["plain", "fm", "inline", "malformed", "daily"]);
		let p = `Notes/note ${i}.md`;
		let text = "Just a note.\n";
		if (kind === "fm") text = `---\ntype: article-journal\ntitle: Paper ${i}\nstatus: draft\n---\nDo not change.\n`;
		if (kind === "inline") text = `# Inline\n\n- [ ] inline task ${i} 📅 2026-11-20\n- [ ] [[Some task]]\n`;
		if (kind === "malformed") text = `---\ntitle: [unclosed\nstatus: : :\n---\nbody\n`;
		if (kind === "daily") { p = `Daily/2026-11-${String(r.int(1, 28)).padStart(2, "0")}.md`; text = "# Daily\n\n- [ ] thing\n"; }
		files[p] = text;
	}
	// User-maintained Base files, sometimes overriding the generated defaults
	if (r.chance(0.3)) {
		files["TaskNotes/Views/tasks-default.base"] = `# user edited\nfilters:\n  and:\n    - file.hasTag("${e.tag}")\nviews:\n  - type: tasknotesTaskList\n    name: My edited tasks\n    order:\n      - status\n      - file.name\n`;
	}
	if (r.chance(0.2)) {
		files["Custom/My Tasks.base"] = `filters:\n  and:\n    - note.status != "done"\nviews:\n  - type: tasknotesKanban\n    name: Board\n    groupBy:\n      property: note.status\n      direction: ASC\n`;
	}
	if (r.chance(0.15)) files["Templates/task template.md"] = `---\ntags: [${e.tag}]\nstatus: open\n---\n{{title}} created {{date}}\n`;
	return files;
}

/** Actions run through the old build's own API after it has loaded. Encoded as data. */
export function generateActivities(r) {
	const acts = [];
	const n = r.int(0, 5);
	for (let i = 0; i < n; i++) {
		acts.push(r.pick([
			{ kind: "create", title: `Created by old ${i} ${r.pick(WORDS)}`, due: r.chance(0.5) ? isoDate(r) : undefined, recurrence: r.chance(0.3) ? "FREQ=DAILY" : undefined },
			{ kind: "toggle" },
			{ kind: "timer" },
			{ kind: "recurring-complete" },
			{ kind: "set-priority" },
			{ kind: "save-settings" },
		]));
	}
	return acts;
}

/** Version chain: one or two old builds, then head. */
export function generateChain(r, forced) {
	if (forced) return [...forced.split(","), "head"];
	const mode = r.next();
	if (mode < 0.45) return [r.pick(["4.17.0", "4.17.0", "4.16.1", ...V4_VERSIONS]), "head"];
	if (mode < 0.75) return [r.pick(BETAS), "head"];
	if (mode < 0.92) return [r.pick(["4.17.0", "4.13.7", "4.16.1"]), r.pick(BETAS), "head"];
	const i = r.int(0, BETAS.length - 2);
	return [BETAS[i], BETAS[r.int(i + 1, BETAS.length - 1)], "head"];
}

export function generateScenario(seed, forcedChain) {
	const r = rng(seed * 2654435761);
	const chain = generateChain(r, forcedChain);
	const { settings, notes } = generateSettings(r, chain[0]);
	const files = generateVault(r, settings);
	const activities = generateActivities(r);
	const partialData = r.chance(0.3); // data.json missing most keys (as if from an old version that never saved)
	return { seed, chain, settings, notes, files, activities, partialData };
}
