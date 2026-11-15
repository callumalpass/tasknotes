import { test, expect, type Locator, type Page } from "@playwright/test";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import {
	launchObsidian,
	closeObsidian,
	openTaskNotesSettings,
	nativeSettingRow,
	closeObsidianSettings,
	type ObsidianApp,
} from "./obsidian";

/**
 * Signing in with Google through the TaskNotes calendar service, driven from the
 * real settings page. The service is a local stand-in and the browser window is
 * captured, so no request leaves this machine and nothing opens on the desktop.
 */

const WORK = "11111111-1111-4111-8111-111111111111";
const TEAM = "22222222-2222-4222-8222-222222222222";
const HOLIDAYS = "33333333-3333-4333-8333-333333333333";
const CONNECTION = "44444444-4444-4444-8444-444444444444";
const CREDENTIAL = "bearer-e2e-credential";
const CODE = "ABCD2345";

function event(calendarId: string, name: string) {
	const start = new Date(Date.now() + 86_400_000);
	start.setUTCHours(9, 0, 0, 0);
	return {
		status: "confirmed",
		id: `e1_${name}`,
		etag: '"1"',
		calendar_id: calendarId,
		title: name,
		description: null,
		location: null,
		recurrence: null,
		start: { kind: "date_time", date_time: start.toISOString() },
		end: { kind: "date_time", date_time: new Date(start.getTime() + 3_600_000).toISOString() },
	};
}

/** The calendar service as the plugin sees it over HTTP. */
function fakeCalendarService() {
	const state = {
		session: false,
		connected: false,
		polls: 0,
		/** The person is still in their browser. */
		away: false,
		requests: [] as { method: string; path: string; authorization: string | undefined }[],
	};
	const server = http.createServer((request, response) => {
		const chunks: Buffer[] = [];
		request.on("data", (chunk: Buffer) => chunks.push(chunk));
		request.on("end", () => {
			const { pathname } = new URL(request.url ?? "/", "http://127.0.0.1");
			const method = request.method ?? "GET";
			const authorization = request.headers.authorization;
			state.requests.push({ method, path: pathname, authorization });
			const text = Buffer.concat(chunks).toString();
			const body = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
			const answer = (status: number, value?: unknown) => {
				response.writeHead(status, { "content-type": "application/json" });
				response.end(value === undefined ? "" : JSON.stringify(value));
			};

			const authorizing = /^\/v1\/(sign-in|connections\/google)\/(start|t1\/status|t1\/redeem)$/.exec(pathname);
			if (authorizing) {
				const [, flow, step] = authorizing;
				if (flow !== "sign-in" && authorization !== `Bearer ${CREDENTIAL}`)
					return answer(401, { code: "unauthorized" });
				if (step === "start") {
					state.polls = 0;
					return answer(200, {
						transaction_id: "t1",
						polling_secret: "secret",
						authorization_url: `https://accounts.google.com/o/oauth2/v2/auth?state=${flow}`,
						expires_at: new Date(Date.now() + 600_000).toISOString(),
					});
				}
				// The person takes a moment in their browser.
				if (step === "t1/status")
					return answer(200, {
						status: state.away || state.polls++ === 0 ? "pending" : "authorized",
					});
				if (flow === "sign-in") {
					if (body.confirmation_code !== CODE) return answer(400, { code: "invalid_request" });
					state.session = true;
					return answer(200, { session: { session_id: "session-1", credential: CREDENTIAL } });
				}
				state.connected = true;
				return answer(200, { connection_id: CONNECTION });
			}

			if (!state.session || authorization !== `Bearer ${CREDENTIAL}`)
				return answer(401, { code: "unauthorized" });
			if (pathname === "/v1/session") return answer(200, { session_id: "session-1" });
			if (pathname === "/v1/connections")
				return answer(200, {
					connections: state.connected ? [{ id: CONNECTION, status: "active" }] : [],
				});
			if (pathname === "/v1/calendars")
				return answer(200, {
					calendars: [
						{ id: WORK, name: "Work", can_write: true, is_primary: true, color: "#0b8043" },
						{ id: TEAM, name: "Team", can_write: false, is_primary: false, is_selected: true },
						{ id: HOLIDAYS, name: "Holidays", can_write: false, is_primary: false },
					],
				});
			if (pathname === "/v1/devices/session-1" && method === "DELETE") {
				state.session = false;
				return answer(204);
			}
			const calendar = /^\/v1\/calendars\/([^/]+)\/events$/.exec(pathname);
			if (calendar && method === "GET") {
				const name = { [WORK]: "Standup", [TEAM]: "Review", [HOLIDAYS]: "Holiday" }[calendar[1]];
				return answer(200, {
					events: name ? [event(calendar[1], name)] : [],
					omitted_count: 0,
					next_cursor: null,
				});
			}
			return answer(404, { code: "not_found" });
		});
	});
	return { state, server };
}

let instance: ObsidianApp;
let page: Page;
const service = fakeCalendarService();

test.beforeAll(async () => {
	await new Promise<void>((resolve) => service.server.listen(0, "127.0.0.1", resolve));
	const origin = `http://127.0.0.1:${(service.server.address() as AddressInfo).port}`;

	instance = await launchObsidian();
	page = instance.page;
	// The calendar providers start after the workspace is ready.
	await page.waitForFunction(
		() => (window as any).app.plugins.plugins.tasknotes?.taskCalendarSyncService != null
	);
	await page.evaluate((origin) => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		plugin.hostedGoogleCalendarService.client.origin = origin;
		// An earlier run's choice of calendars outlives its session.
		for (const key of Object.keys(localStorage))
			if (key.includes("tasknotes-calendar-service:")) localStorage.removeItem(key);
		// The consent page would open in the desktop's browser. Obsidian's own
		// windows, such as Settings, still open.
		(window as any).calendarServiceOpened = [];
		const open = ((window as any).calendarServiceOpen = window.open);
		window.open = (...args: Parameters<typeof window.open>) => {
			if (!String(args[0]).startsWith("https://accounts.google.com/")) return open(...args);
			(window as any).calendarServiceOpened.push(String(args[0]));
			return null;
		};
	}, origin);
});

test.afterAll(async () => {
	try {
		await page?.evaluate(async () => {
			const plugin = (window as any).app.plugins.plugins.tasknotes;
			if (plugin.hostedGoogleCalendarService.isSignedIn())
				await plugin.hostedGoogleCalendarService.signOut();
			window.open = (window as any).calendarServiceOpen;
		});
	} finally {
		if (instance) await closeObsidian(instance);
		await new Promise((resolve) => service.server.close(resolve));
	}
});

/** A modal opens in whichever Obsidian window the person last used. */
async function inAnyWindow(find: (candidate: Page) => Locator): Promise<Locator> {
	let found: Locator | undefined;
	await expect
		.poll(
			async () => {
				for (const candidate of page.context().pages()) {
					const locator = find(candidate);
					if (await locator.isVisible().catch(() => false)) {
						found = locator;
						return true;
					}
				}
				return false;
			},
			{ timeout: 20000 }
		)
		.toBe(true);
	return found!;
}

/** Opens the settings page that holds the row with this name. */
async function revealSettingNamed(name: string): Promise<Page> {
	const settings = await openTaskNotesSettings(page);
	const path = await page.evaluate((name) => {
		const setting = (window as any).app.setting;
		const tab = setting.openTabById("tasknotes");
		tab.update();
		const find = (items: any[], path: string[] = []): string[] | undefined => {
			for (const item of items) {
				if (item.name === name) return path;
				const match = item.items && find(item.items, item.type === "page" ? [...path, item.name] : path);
				if (match) return match;
			}
		};
		const path = find(tab.settingItems);
		if (!path) throw new Error(`Missing native setting: ${name}`);
		setting.navigateToPage(tab, path);
		return path;
	}, name);
	await expect(settings.locator(".setting-page-title:visible").last()).toHaveText(path.at(-1)!);
	return settings;
}

const plugin = <T>(read: string) =>
	page.evaluate(
		(read) => new Function("plugin", `return ${read}`)((window as any).app.plugins.plugins.tasknotes) as T,
		read
	);

const opened = () => page.evaluate(() => (window as any).calendarServiceOpened as string[]);

test("a sign-in the person gives up on can be cancelled", async () => {
	service.state.away = true;
	const settings = await revealSettingNamed("Sign in with Google");
	await expect(nativeSettingRow(settings, "Connection status")).toContainText("Not connected");
	await settings.screenshot({ path: "test-results/calendar-service/signed-out.png" });
	await nativeSettingRow(settings, "Sign in with Google").locator(".setting-item-name").click();

	await expect(nativeSettingRow(settings, "Connection status")).toContainText(
		"Waiting for you to finish in your browser"
	);
	await expect(nativeSettingRow(settings, "Sign in with Google")).toHaveCount(0);
	await expect.poll(opened).toEqual(["https://accounts.google.com/o/oauth2/v2/auth?state=sign-in"]);
	await settings.screenshot({ path: "test-results/calendar-service/waiting.png" });

	await nativeSettingRow(settings, "Cancel sign-in").locator(".setting-item-name").click();
	await expect(nativeSettingRow(settings, "Sign in with Google")).toBeVisible();
	await expect(nativeSettingRow(settings, "Connection status")).toContainText("Not connected");
	await expect(settings.locator(".notice")).toHaveCount(0);
	expect(await plugin("plugin.hostedGoogleCalendarService.isSignedIn()")).toBe(false);

	await closeObsidianSettings(page, settings);
	service.state.away = false;
	await page.evaluate(() => ((window as any).calendarServiceOpened = []));
});

test("signs in with Google from settings, shows the person's events, and signs out", async () => {
	test.setTimeout(90000);
	const settings = await revealSettingNamed("Sign in with Google");
	await nativeSettingRow(settings, "Sign in with Google").locator(".setting-item-name").click();
	await expect.poll(opened).toEqual(["https://accounts.google.com/o/oauth2/v2/auth?state=sign-in"]);

	const code = await inAnyWindow((candidate) =>
		candidate.locator(".modal").filter({ hasText: "Enter the code shown in your browser" })
	);
	await code.locator("input").fill(CODE.toLowerCase());
	await code.page().screenshot({ path: "test-results/calendar-service/code.png" });
	await code.getByRole("button", { name: "Continue", exact: true }).click();

	// Calendar access is a second visit to Google, without a code.
	await expect(nativeSettingRow(settings, "Connection status")).toContainText("Signed in with Google", {
		timeout: 30000,
	});
	expect(await opened()).toEqual([
		"https://accounts.google.com/o/oauth2/v2/auth?state=sign-in",
		"https://accounts.google.com/o/oauth2/v2/auth?state=connections/google",
	]);
	await expect(nativeSettingRow(settings, "Sign in with Google")).toHaveCount(0);

	// The primary calendar and the ones shown in Google Calendar start shown.
	const shown = (name: string) => nativeSettingRow(settings, name).locator(".checkbox-container");
	await expect(shown("Work")).toHaveClass(/is-enabled/);
	await expect(shown("Team")).toHaveClass(/is-enabled/);
	await expect(shown("Holidays")).not.toHaveClass(/is-enabled/);
	await expect(nativeSettingRow(settings, "Team")).toContainText("Read only");

	const titles = () =>
		plugin<string[]>("plugin.calendarProviderRegistry.getProvider('google').getAllEvents().map((event) => event.title).sort()");
	await expect.poll(titles).toEqual(["Review", "Standup"]);
	expect(await plugin("plugin.googleCalendarService === plugin.hostedGoogleCalendarService")).toBe(true);

	await settings.screenshot({ path: "test-results/calendar-service/signed-in.png" });
	await shown("Holidays").click();
	await expect.poll(titles).toEqual(["Holiday", "Review", "Standup"]);

	// The session credential is in secret storage, and in nothing that syncs.
	expect(await plugin("plugin.app.secretStorage.getSecret('tasknotes-calendar-service-session')")).toBe(CREDENTIAL);
	expect(await plugin("JSON.stringify(plugin.settings)")).not.toContain(CREDENTIAL);
	// What the plugin keeps for itself is the selection and a signed-in flag.
	const kept = await page.evaluate(() =>
		Object.keys(localStorage)
			.filter((key) => key.includes("tasknotes-calendar-service:"))
			.map((key) => localStorage.getItem(key) ?? "")
	);
	expect(kept.length).toBeGreaterThan(0);
	expect(kept.join("\n")).not.toContain(CREDENTIAL);
	expect(service.state.requests.some(({ path, authorization }) =>
		path === "/v1/calendars" && authorization === `Bearer ${CREDENTIAL}`
	)).toBe(true);

	await nativeSettingRow(settings, "Sign out on this device").locator(".setting-item-name").click();
	await expect(nativeSettingRow(settings, "Sign in with Google")).toBeVisible();
	await expect(nativeSettingRow(settings, "Connection status")).toContainText("Not connected");
	expect(service.state.requests.some(({ method, path }) =>
		method === "DELETE" && path === "/v1/devices/session-1"
	)).toBe(true);
	expect(await plugin("plugin.googleCalendarService === plugin.ownGoogleCalendarService")).toBe(true);
	expect(await titles()).toEqual([]);
	expect(await plugin("plugin.app.secretStorage.getSecret('tasknotes-calendar-service-session') || null")).toBeNull();

	await closeObsidianSettings(page, settings);
});
