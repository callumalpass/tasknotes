import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { _android, expect } from "@playwright/test";
import { exportLanguagePacks } from "../scripts/lib/language-packs.mjs";
import { sha256 } from "../scripts/lib/language-pack-publishing.mjs";

// This runner deliberately refuses physical devices and other users' existing AVDs/vaults.
const serial = process.env.TASKNOTES_ANDROID_SERIAL ?? "emulator-5574";
assert.match(serial, /^emulator-\d+$/);
const adb = (...args) =>
	execFileSync("adb", ["-s", serial, ...args], { encoding: "utf8", timeout: 30_000 });
assert.equal(adb("emu", "avd", "name").split(/\r?\n/)[0], "tasknotes-language-packs");
const vault = "/sdcard/Documents/TaskNotesLanguagePacks";
const pluginDirectory = `${vault}/.obsidian/plugins/tasknotes`;
const identity = "multilingual-products-tasknotes-language-pack-acceptance-only\n";
assert.equal(adb("shell", "cat", `${vault}/vault-identity.txt`), identity);
const { manifest, directory } = await exportLanguagePacks();
const french = JSON.parse(await readFile(join(directory, "fr.json"), "utf8"));
const german = JSON.parse(await readFile(join(directory, "de.json"), "utf8"));
const cacheFile = `${pluginDirectory}/language-packs/${manifest.packs.fr.sha256}/fr.json`;
const evidence = resolve(".tmp/android-language-packs");
await mkdir(evidence, { recursive: true });
const report = {
	serial,
	avd: "tasknotes-language-packs",
	android: adb("shell", "getprop", "ro.build.version.release").trim(),
	sdk: adb("shell", "getprop", "ro.build.version.sdk").trim(),
	catalogue: manifest.catalogueVersion,
	checks: [],
};
const passed = (check) => {
	report.checks.push(check);
	console.log(`PASS ${check}`);
};
const device = (await _android.devices()).find((device) => device.serial() === serial);
assert.ok(device, "Owned Android emulator is not connected");
let page;
const attach = async () => {
	let pid;
	await expect
		.poll(
			() => {
				try {
					pid = Number(adb("shell", "pidof", "md.obsidian").trim());
					return Number.isSafeInteger(pid) ? pid : 0;
				} catch {
					return 0;
				}
			},
			{ timeout: 30_000 }
		)
		.toBeGreaterThan(0);
	const view = await device.webView(
		// In Playwright 1.57 the package selector takes precedence over socketName.
		{ socketName: `webview_devtools_remote_${pid}` },
		{ timeout: 30_000 }
	);
	assert.equal(view.pid(), pid);
	assert.equal(view.pkg(), "md.obsidian");
	page = await view.page();
	await page.waitForFunction(
		() => !!window.app?.plugins?.plugins?.tasknotes?.initializationComplete,
		null,
		{ timeout: 60_000 }
	);
	const state = await page.evaluate(async () => ({
		vault: window.app.vault.getName(),
		identity: await window.app.vault.adapter.read("vault-identity.txt"),
		resource: window.app.vault.adapter.getResourcePath("vault-identity.txt"),
		classes: document.body.className,
		secure: isSecureContext,
		subtle: !!crypto.subtle,
		userAgent: navigator.userAgent,
	}));
	assert.equal(state.vault, "TaskNotesLanguagePacks");
	assert.equal(state.identity, identity);
	assert.ok(
		state.resource.startsWith(
			"http://localhost/_capacitor_file_/storage/emulated/0/Documents/TaskNotesLanguagePacks/"
		)
	);
	assert.match(state.classes, /is-mobile/);
	assert.match(state.classes, /is-android/);
	assert.equal(state.secure, true);
	assert.equal(state.subtle, true);
	report.runtime = state;
};
const locale = () =>
	page.evaluate(() => window.app.plugins.plugins.tasknotes.i18n.getCurrentLocale());
const picker = () => page.locator('select:has(option[value="system"]):has(option[value="fr"])');
const settings = () =>
	page.evaluate(() => {
		window.app.setting.open();
		window.app.setting.openTabById("tasknotes");
	});
const choose = async (code) => {
	await picker().selectOption(code);
	await expect.poll(locale, { timeout: 30_000 }).toBe(code);
};
const restart = async () => {
	await page.evaluate(async () => {
		await window.app.plugins.plugins.tasknotes.saveSettings();
		window.app.setting.close();
	});
	adb("shell", "am", "force-stop", "md.obsidian");
	adb("shell", "am", "start", "-W", "-n", "md.obsidian/.MainActivity");
	await attach();
};
const network = async (enabled) => {
	adb("shell", "cmd", "connectivity", "airplane-mode", enabled ? "disable" : "enable");
	adb("shell", "svc", "wifi", enabled ? "enable" : "disable");
	adb("shell", "svc", "data", enabled ? "enable" : "disable");
	await expect
		.poll(() => adb("shell", "cmd", "wifi", "status"), { timeout: 15_000 })
		.toMatch(enabled ? /Wifi is enabled/ : /Wifi is disabled/);
};
const internet = () =>
	page.evaluate(async (url) => {
		try {
			return (await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(3000) })).ok;
		} catch {
			return false;
		}
	}, `https://i18n.mdbase.dev/tasknotes/${manifest.catalogueVersion}/manifest.json`);
try {
	await attach();
	assert.equal(await locale(), "en", "Begin with English in this disposable vault");
	passed("actual Android WebView, mobile adapter, secure origin and WebCrypto");
	await settings();
	await choose("fr");
	await expect(picker().locator('option[value="system"]')).toHaveText(
		french.messages["common.systemDefault"]
	);
	assert.equal(sha256(Buffer.from(adb("shell", "cat", cacheFile))), manifest.packs.fr.sha256);
	passed("French picker download from public HTTPS R2, SHA-256 and local cache");
	await picker().scrollIntoViewIfNeeded();
	await writeFile(join(evidence, "french-online.png"), await device.screenshot());

	await network(false);
	await expect.poll(internet, { timeout: 15_000 }).toBe(false);
	await restart();
	await expect.poll(locale, { timeout: 30_000 }).toBe("fr");
	assert.equal(
		await page.evaluate(() => window.app.commands.commands["tasknotes:create-new-task"].name),
		`TaskNotes: ${french.messages["commands.createNewTask"]}`
	);
	passed("offline full Android app force-stop/relaunch retains French and translated commands");
	await settings();
	await picker().selectOption("de");
	const failure = french.messages["notices.languagePackDownloadFailed"].replace(
		"{language}",
		"Deutsch"
	);
	await expect(page.locator(".notice").filter({ hasText: failure })).toBeVisible({
		timeout: 25_000,
	});
	assert.equal(await locale(), "fr");
	passed("uncached German fails offline without replacing the working French locale");

	await network(true);
	await expect.poll(internet, { timeout: 30_000 }).toBe(true);
	// Network reconnection and native DNS negative-cache expiry are asynchronous.
	// Exercise the real retry button, without replacing the native transport.
	await expect
		.poll(
			async () => {
				if ((await locale()) !== "de")
					await page
						.getByRole("button", {
							name: french.messages["settings.features.uiLanguage.retryDownload"],
							exact: true,
						})
						.click();
				return locale();
			},
			{ timeout: 45_000, intervals: [2000, 5000, 10000] }
		)
		.toBe("de");
	assert.equal(
		await page.evaluate(() =>
			window.app.plugins.plugins.tasknotes.i18n.translate("common.save")
		),
		german.messages["common.save"]
	);
	passed("native retry button recovers German after reconnecting");
	for (const code of ["es", "it", "ja", "ko", "pt", "ru", "zh"]) {
		await choose(code);
		const text = adb(
			"shell",
			"cat",
			`${pluginDirectory}/language-packs/${manifest.packs[code].sha256}/${code}.json`
		);
		assert.equal(sha256(Buffer.from(text)), manifest.packs[code].sha256);
		passed(`${code} native download, integrity validation, activation and cache`);
	}
	await choose("fr");

	const original = await readFile(join(directory, "fr.json"));
	const corrupted = Buffer.from(original);
	const position = corrupted.indexOf(Buffer.from("Enregistrer"));
	assert.ok(position >= 0, "Expected French fixture message");
	corrupted[position] ^= 1;
	assert.notEqual(sha256(corrupted), manifest.packs.fr.sha256);
	const corruptPath = join(evidence, "corrupt-fr.json");
	await writeFile(corruptPath, corrupted);
	await page.evaluate(async () => {
		await window.app.plugins.plugins.tasknotes.saveSettings();
		window.app.setting.close();
	});
	adb("shell", "am", "force-stop", "md.obsidian");
	adb("push", corruptPath, cacheFile);
	adb("shell", "am", "start", "-W", "-n", "md.obsidian/.MainActivity");
	await attach();
	await expect.poll(locale, { timeout: 30_000 }).toBe("fr");
	assert.equal(sha256(Buffer.from(adb("shell", "cat", cacheFile))), manifest.packs.fr.sha256);
	assert.equal(
		await page.evaluate(() =>
			window.app.plugins.plugins.tasknotes.i18n.translate("common.save")
		),
		french.messages["common.save"]
	);
	passed(
		"same-length corrupt French cache rejected and repaired from pinned HTTPS artifact after cold start"
	);
	await settings();
	await picker().scrollIntoViewIfNeeded();
	await writeFile(join(evidence, "french-repaired.png"), await device.screenshot());
	report.passed = true;
} catch (error) {
	report.passed = false;
	report.error = String(error);
	try {
		await writeFile(join(evidence, "failure.png"), await device.screenshot());
	} catch {
		/* No screenshot if device disappeared. */
	}
	throw error;
} finally {
	await network(true);
	await writeFile(join(evidence, "report.json"), JSON.stringify(report, null, 2));
	await device.close();
}
