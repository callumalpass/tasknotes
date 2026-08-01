#!/usr/bin/env node

import fs from "fs";
import path from "path";

const root = process.cwd();
const files = [path.join(root, "README.md")];
const errors = [];

function walk(directory) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const target = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			if (entry.name !== "releases") walk(target);
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			files.push(target);
		}
	}
}

walk(path.join(root, "docs"));

const urls = new Set();
for (const file of files) {
	const content = fs
		.readFileSync(file, "utf8")
		.replace(/```[\s\S]*?```/g, "")
		.replace(/`[^`\n]+`/g, "");
	for (const match of content.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) {
		urls.add(match[1].replace(/[.,;:]$/, ""));
	}
	for (const match of content.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
		urls.add(match[1]);
	}
}

async function check(url) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 20_000);
	try {
		let response = await fetch(url, {
			method: "HEAD",
			redirect: "follow",
			signal: controller.signal,
			headers: { "user-agent": "TaskNotes-Docs-Link-Check/1.0" },
		});
		if (response.status === 405 || response.status === 501) {
			response = await fetch(url, {
				method: "GET",
				redirect: "follow",
				signal: controller.signal,
				headers: {
					"user-agent": "TaskNotes-Docs-Link-Check/1.0",
					range: "bytes=0-1024",
				},
			});
		}
		if (response.status >= 400 && ![401, 403, 408, 425, 429].includes(response.status)) {
			errors.push(`${response.status} ${url}`);
		}
	} catch (error) {
		errors.push(`${error.name === "AbortError" ? "timeout" : "network error"} ${url}`);
	} finally {
		clearTimeout(timeout);
	}
}

const queue = [...urls];
const workers = Array.from({ length: Math.min(8, queue.length) }, async () => {
	while (queue.length) await check(queue.shift());
});
await Promise.all(workers);

if (errors.length) {
	console.error(`External documentation link checks failed (${errors.length}):`);
	for (const error of errors) console.error(`- ${error}`);
	process.exit(1);
}

console.log(`External documentation link checks passed (${urls.size} unique URLs).`);
