import { webcrypto } from "node:crypto";
import {
	CalendarServiceClient,
	type ServiceRequest,
	type ServiceTransport,
} from "@tasknotes/calendar-service-client";
import { HostedGoogleCalendarService } from "../../../src/services/HostedGoogleCalendarService";
import { CALENDAR_SERVICE_CONSTANTS } from "../../../src/services/constants";

const ORIGIN = "https://calendar.example";
const WORK = "11111111-1111-4111-8111-111111111111";
const TEAM = "22222222-2222-4222-8222-222222222222";
const HOLIDAYS = "33333333-3333-4333-8333-333333333333";
const CONNECTION = "44444444-4444-4444-8444-444444444444";
const SIGNED_IN_KEY = "tasknotes:google-calendar-signed-in:v1";

function event(calendarId: string, name: string, overrides: Record<string, unknown> = {}) {
	return {
		status: "confirmed",
		id: `e1_${name}`,
		etag: '"1"',
		calendar_id: calendarId,
		title: name,
		description: null,
		location: null,
		recurrence: null,
		start: { kind: "date_time", date_time: "2026-11-16T09:00:00Z" },
		end: { kind: "date_time", date_time: "2026-11-16T10:00:00Z" },
		...overrides,
	};
}

/** The calendar service as the client sees it, without a network. */
function fakeService() {
	const state = {
		online: true,
		session: true,
		connection: "active" as "active" | "reconnect_required" | null,
		calendars: [
			{ id: WORK, name: "Work", can_write: true, is_primary: true, color: "#0b8043" },
			{ id: TEAM, name: "Team", can_write: false, is_primary: false, is_selected: true },
			{ id: HOLIDAYS, name: "Holidays", can_write: false, is_primary: false },
		],
		events: new Map<string, ReturnType<typeof event>[]>([
			[WORK, [event(WORK, "standup")]],
			[TEAM, [event(TEAM, "review")]],
		]),
		failing: new Map<string, { status: number; body?: unknown }>(),
		authorized: false,
		requests: [] as { method: string; path: string; request: ServiceRequest }[],
	};
	const answer = (status: number, body?: unknown) =>
		Promise.resolve({
			status,
			ok: status >= 200 && status < 300,
			json: () => Promise.resolve(body),
		});
	const transport: ServiceTransport = (url, request) => {
		const { pathname } = new URL(url);
		state.requests.push({ method: request.method, path: pathname, request });
		if (!state.online) return Promise.reject(new TypeError("offline"));
		const body = (request.body ? JSON.parse(request.body) : {}) as Record<string, unknown>;

		const authorization = /^\/v1\/(sign-in|connections\/google)\/(start|t1\/status|t1\/redeem)$/.exec(pathname);
		if (authorization) {
			const [, flow, step] = authorization;
			if (step === "start")
				return answer(200, {
					transaction_id: "t1",
					polling_secret: "secret",
					authorization_url: "https://accounts.google.com/o/oauth2/v2/auth?state=1",
					expires_at: new Date(Date.now() + 600_000).toISOString(),
				});
			if (step === "t1/status") return answer(200, { status: "authorized" });
			if (flow === "sign-in") {
				if (body.confirmation_code !== "ABCD2345") return answer(400, { code: "invalid_request" });
				state.session = true;
				return answer(200, { session: { session_id: "session-1", credential: "bearer-1" } });
			}
			state.connection = "active";
			return answer(200, { connection_id: CONNECTION });
		}

		if (!state.session) return answer(401, { code: "unauthorized" });
		if (pathname === "/v1/session") return answer(200, { session_id: "session-1" });
		if (pathname === "/v1/connections")
			return answer(200, {
				connections: state.connection ? [{ id: CONNECTION, status: state.connection }] : [],
			});
		if (pathname === "/v1/calendars") return answer(200, { calendars: state.calendars });
		if (pathname === "/v1/devices/session-1") {
			state.session = false;
			return answer(204);
		}

		const calendar = /^\/v1\/calendars\/([^/]+)\/events(?:\/(.+))?$/.exec(pathname);
		if (!calendar) return answer(404, { code: "not_found" });
		const [, calendarId, eventId] = calendar;
		const failure = state.failing.get(calendarId);
		if (failure) return answer(failure.status, failure.body);
		const events = state.events.get(calendarId) ?? [];
		if (request.method === "GET")
			return answer(200, { events, omitted_count: 0, next_cursor: null });
		if (request.method === "POST") {
			const created = event(calendarId, "created", body);
			state.events.set(calendarId, [...events, created]);
			return answer(200, created);
		}
		const existing = events.find(({ id }) => id === eventId);
		if (!existing) return answer(404, { code: "not_found" });
		if (request.headers["If-Match"] !== existing.etag) return answer(409, { code: "conflict" });
		if (request.method === "DELETE") {
			state.events.set(calendarId, events.filter((item) => item !== existing));
			return answer(204);
		}
		const updated = { ...existing, ...body, etag: '"2"' };
		state.events.set(calendarId, events.map((item) => (item === existing ? updated : item)));
		return answer(200, updated);
	};
	return { state, transport };
}

function hosted(options: { storedSession?: boolean } = {}) {
	const service = fakeService();
	const stored = new Map<string, string>(options.storedSession === false ? [] : [[SIGNED_IN_KEY, "1"]]);
	const credential = { value: options.storedSession === false ? null : ("bearer-1" as string | null) };
	const shown: string[] = [];
	const client = new CalendarServiceClient({
		origin: ORIGIN,
		transport: service.transport,
		storage: {
			getItem: (key) => stored.get(key) ?? null,
			setItem: (key, value) => void stored.set(key, value),
			removeItem: (key) => void stored.delete(key),
		},
		host: {
			clientKind: "obsidian",
			deviceName: "Test",
			credentials: {
				load: () => Promise.resolve(credential.value),
				save: (value) => {
					credential.value = value;
					return Promise.resolve();
				},
				clear: () => {
					credential.value = null;
					return Promise.resolve();
				},
			},
			openWindow: () => ({ show: (url) => void shown.push(url), close: () => undefined }),
		},
	});
	const notices: string[] = [];
	const emitter = {
		trigger: (_name: string, notice: { message: string }) => void notices.push(notice.message),
	};
	const source = new HostedGoogleCalendarService({ emitter } as never, client);
	const changes = { data: 0, session: 0 };
	source.on("data-changed", () => changes.data++);
	source.on("session-changed", () => changes.session++);
	return { ...service, source, client, credential, stored, shown, notices, changes };
}

const titles = (source: HostedGoogleCalendarService) =>
	source
		.getAllEvents()
		.map(({ title }) => title)
		.sort();

describe("HostedGoogleCalendarService", () => {
	const sources: HostedGoogleCalendarService[] = [];
	const start = async (options?: { storedSession?: boolean }) => {
		const context = hosted(options);
		sources.push(context.source);
		await context.source.initialize();
		return context;
	};

	beforeAll(() => {
		// jsdom has no SubtleCrypto; Obsidian does, and sign-in derives its PKCE challenge with it.
		if (!globalThis.crypto.subtle)
			Object.defineProperty(globalThis.crypto, "subtle", { value: webcrypto.subtle });
	});

	afterEach(() => {
		for (const source of sources.splice(0)) source.destroy();
	});

	it("asks the service nothing until this device has signed in", async () => {
		const { source, state } = await start({ storedSession: false });

		expect(source.isSignedIn()).toBe(false);
		expect(source.getAllEvents()).toEqual([]);
		expect(state.requests).toEqual([]);
	});

	it("resumes a stored session and reads the calendars that are shown", async () => {
		const { source, state, changes } = await start();

		expect(source.isSignedIn()).toBe(true);
		expect(source.isConnected()).toBe(true);
		expect(changes.session).toBe(1);
		// The primary calendar and those shown in Google; not every calendar the person has.
		expect(source.getAvailableCalendars()).toEqual([
			{ id: WORK, summary: "Work", primary: true, canWrite: true, backgroundColor: "#0b8043" },
			{ id: TEAM, summary: "Team", primary: false, canWrite: false },
		]);
		expect(titles(source)).toEqual(["review", "standup"]);
		expect(state.requests.some(({ path }) => path.includes(HOLIDAYS))).toBe(false);
		expect(state.requests.every(({ request }) => request.headers.Authorization === "Bearer bearer-1")).toBe(true);
	});

	it("reads a window around today in requests the service accepts", async () => {
		const { state } = await start();

		const reads = state.requests
			.filter(({ path }) => path === `/v1/calendars/${WORK}/events`)
			.map(({ request }) => request);
		expect(reads).toHaveLength(2);
		const { DAYS_BEFORE, DAYS_AFTER } = CALENDAR_SERVICE_CONSTANTS.VIEW_RANGE;
		expect(DAYS_BEFORE + DAYS_AFTER).toBeLessThanOrEqual(2 * 93);
	});

	it("gives the views events in their own shape", async () => {
		const context = hosted();
		sources.push(context.source);
		context.state.events.set(WORK, [
			event(WORK, "timed", {
				description: "Agenda",
				location: "Room 4",
				web_link: "https://www.google.com/calendar/event?eid=abc",
				recurrence: { series_id: "e1_series" },
			}),
			event(WORK, "allday", {
				title: null,
				web_link: "https://evil.example/calendar",
				start: { kind: "date", date: "2026-11-17" },
				end: { kind: "date", date: "2026-11-19" },
			}),
		]);
		context.state.events.set(TEAM, []);
		await context.source.initialize();

		const [timed, allDay] = context.source.getAllEvents();
		expect(timed).toEqual({
			id: `google-${WORK}-e1_timed`,
			subscriptionId: `google-${WORK}`,
			title: "timed",
			// Local wall time; the tests run in UTC.
			start: "2026-11-16T09:00:00",
			end: "2026-11-16T10:00:00",
			allDay: false,
			color: "#0b8043",
			description: "Agenda",
			location: "Room 4",
			url: "https://www.google.com/calendar/event?eid=abc",
			recurringEventId: `google-${WORK}-e1_series`,
		});
		expect(allDay).toEqual({
			id: `google-${WORK}-e1_allday`,
			subscriptionId: `google-${WORK}`,
			title: "Untitled Event",
			start: "2026-11-17",
			end: "2026-11-19",
			allDay: true,
			color: "#0b8043",
		});
		expect(context.source.ownsEvent(timed)).toBe(true);
		expect(context.source.extractEventIds(timed)).toEqual({ calendarId: WORK, eventId: "e1_timed" });
	});

	it("keeps a calendar's last events when one read fails, and says which", async () => {
		const { source, state } = await start();
		state.failing.set(TEAM, { status: 503 });
		state.events.set(WORK, [event(WORK, "standup"), event(WORK, "planning")]);

		await source.refreshAllCalendars();

		expect(titles(source)).toEqual(["planning", "review", "standup"]);
		expect(source.getSyncStatus().calendarErrors).toEqual([
			{ calendarId: "Team", message: "Google Calendar is unavailable right now. Try again." },
		]);
		await expect(source.refreshAllCalendars({ propagateErrors: true })).rejects.toThrow("Team: ");
	});

	it("stops showing events when the service ends the session", async () => {
		const { source, state, changes, credential, stored } = await start();
		state.session = false;

		await source.refreshAllCalendars();

		expect(source.isSignedIn()).toBe(false);
		expect(source.getAllEvents()).toEqual([]);
		expect(source.getAvailableCalendars()).toEqual([]);
		expect(changes.session).toBe(2);
		expect(credential.value).toBeNull();
		expect(stored.has(SIGNED_IN_KEY)).toBe(false);
	});

	it("stops showing events when Google access lapses, and stays signed in", async () => {
		const { source, state } = await start();
		state.failing.set(WORK, { status: 409, body: { code: "reconnect_required" } });

		await source.refreshAllCalendars();

		expect(source.isSignedIn()).toBe(true);
		expect(source.isConnected()).toBe(false);
		expect(source.getAllEvents()).toEqual([]);
	});

	it("resumes a session that could not be reached at start", async () => {
		const context = hosted();
		sources.push(context.source);
		context.state.online = false;
		await context.source.initialize();
		expect(context.source.isSignedIn()).toBe(false);
		expect(context.stored.has(SIGNED_IN_KEY)).toBe(true);

		context.state.online = true;
		document.dispatchEvent(new Event("visibilitychange"));
		await waitFor(() => context.source.getAllEvents().length === 2);

		expect(context.source.isSignedIn()).toBe(true);
		expect(context.changes.session).toBe(1);
	});

	it("reads again when Obsidian comes back into view with stale events", async () => {
		const { source, state } = await start();
		const read = () => state.requests.filter(({ path }) => path.endsWith("/events")).length;
		const before = read();

		document.dispatchEvent(new Event("visibilitychange"));
		await Promise.resolve();
		expect(read()).toBe(before);

		const now = Date.now();
		const clock = jest
			.spyOn(Date, "now")
			.mockReturnValue(now + CALENDAR_SERVICE_CONSTANTS.REFRESH_INTERVAL_MS + 1);
		state.events.set(WORK, []);
		document.dispatchEvent(new Event("visibilitychange"));
		clock.mockRestore();
		await waitFor(() => source.getAllEvents().length === 1);
	});

	it("changes an event against the version it last read", async () => {
		const { source, state } = await start();

		const updated = await source.updateEvent(WORK, "e1_standup", {
			summary: "Stand-up",
			start: { dateTime: "2026-11-16T11:00:00", timeZone: "UTC" },
			end: { dateTime: "2026-11-16T11:30:00", timeZone: "UTC" },
		});

		const sent = state.requests.at(-1);
		expect(sent).toMatchObject({ method: "PATCH", path: `/v1/calendars/${WORK}/events/e1_standup` });
		expect(sent?.request.headers["If-Match"]).toBe('"1"');
		expect(JSON.parse(sent?.request.body ?? "")).toEqual({
			title: "Stand-up",
			start: { kind: "date_time", date_time: "2026-11-16T11:00:00.000Z", time_zone: "UTC" },
			end: { kind: "date_time", date_time: "2026-11-16T11:30:00.000Z", time_zone: "UTC" },
		});
		expect(updated).toMatchObject({ title: "Stand-up", start: "2026-11-16T11:00:00" });
		expect(titles(source)).toEqual(["Stand-up", "review"]);

		// The next change carries the version the service just returned.
		await source.updateEvent(WORK, "e1_standup", { start: { date: "2026-11-18" }, end: { date: "2026-11-19" } });
		expect(state.requests.at(-1)?.request.headers["If-Match"]).toBe('"2"');
		expect(source.getAllEvents().find(({ title }) => title === "Stand-up")).toMatchObject({
			allDay: true,
			start: "2026-11-18",
		});
	});

	it("loads the newer event when a change loses to one made in Google", async () => {
		const { source, state } = await start();
		state.events.set(WORK, [event(WORK, "standup", { etag: '"9"', title: "Moved in Google" })]);

		await expect(source.updateEvent(WORK, "e1_standup", { summary: "Mine" })).rejects.toThrow(
			"This event changed in Google Calendar."
		);
		await waitFor(() => titles(source).includes("Moved in Google"));
	});

	it("refuses to change an event it has not read", async () => {
		const { source, state } = await start();
		const before = state.requests.length;

		await expect(source.updateEvent(WORK, "e1_unknown", { summary: "x" })).rejects.toThrow(
			"This event no longer exists in Google Calendar."
		);
		await expect(source.deleteEvent(WORK, "e1_unknown")).rejects.toThrow();
		expect(state.requests).toHaveLength(before);
	});

	it("creates and deletes events", async () => {
		const { source, state } = await start();

		const created = await source.createEvent(WORK, {
			summary: "created",
			start: { date: "2026-11-20" },
			end: { date: "2026-11-21" },
		});
		expect(created).toMatchObject({ id: `google-${WORK}-e1_created`, allDay: true, start: "2026-11-20" });
		const body = JSON.parse(state.requests.at(-1)?.request.body ?? "") as Record<string, unknown>;
		expect(body).toMatchObject({ title: "created", start: { kind: "date", date: "2026-11-20" } });
		expect(body.idempotency_key).toEqual(expect.any(String));

		await source.deleteEvent(WORK, "e1_created");
		expect(state.requests.at(-1)).toMatchObject({ method: "DELETE" });
		expect(titles(source)).toEqual(["review", "standup"]);

		await expect(source.createEvent(WORK, { summary: "No time" } as never)).rejects.toThrow();
		await expect(source.createCalendar()).rejects.toThrow("Create one in Google Calendar.");
	});

	it("reads the calendars the person chooses to show", async () => {
		const { source, state } = await start();
		state.events.set(HOLIDAYS, [event(HOLIDAYS, "holiday")]);

		await source.setShownCalendars([HOLIDAYS]);

		expect(titles(source)).toEqual(["holiday"]);
		expect(source.getAvailableCalendars().map(({ summary }) => summary)).toEqual(["Holidays"]);
		expect(source.getAllCalendars()).toHaveLength(3);
	});

	it("holds back a second refresh asked for straight after the first", async () => {
		const { source, state, notices } = await start();

		await source.refresh();
		const after = state.requests.length;
		await source.refresh();

		expect(state.requests).toHaveLength(after);
		expect(notices).toHaveLength(1);
	});

	it("signs in, asks for the code the browser shows, and connects Google Calendar", async () => {
		const context = hosted({ storedSession: false });
		sources.push(context.source);
		context.state.session = false;
		context.state.connection = null;
		await context.source.initialize();
		const askForCode = jest.fn(() => Promise.resolve<string | null>(" abcd2345 "));

		await context.source.connect(askForCode);

		expect(askForCode).toHaveBeenCalledTimes(1);
		expect(context.shown).toEqual([
			"https://accounts.google.com/o/oauth2/v2/auth?state=1",
			"https://accounts.google.com/o/oauth2/v2/auth?state=1",
		]);
		expect(context.source.isConnected()).toBe(true);
		expect(context.credential.value).toBe("bearer-1");
		expect(titles(context.source)).toEqual(["review", "standup"]);
		expect(context.source.isAuthorizing()).toBe(false);
	}, 15_000);

	it("abandons a sign-in when no code is given", async () => {
		const context = hosted({ storedSession: false });
		sources.push(context.source);
		context.state.session = false;
		await context.source.initialize();

		await context.source.connect(() => Promise.resolve(null));

		expect(context.source.isSignedIn()).toBe(false);
		expect(context.credential.value).toBeNull();
		expect(context.source.isAuthorizing()).toBe(false);
	}, 15_000);

	it("signs this device out and forgets its session", async () => {
		const { source, state, credential, changes } = await start();

		await source.signOut();

		expect(state.requests.at(-1)).toMatchObject({ method: "DELETE", path: "/v1/devices/session-1" });
		expect(source.isSignedIn()).toBe(false);
		expect(source.getAllEvents()).toEqual([]);
		expect(credential.value).toBeNull();
		expect(changes.session).toBe(2);
	});

	it("forgets the session on this device even when the service cannot be reached", async () => {
		const { source, state, credential } = await start();
		state.online = false;

		await source.signOut();

		expect(source.isSignedIn()).toBe(false);
		expect(credential.value).toBeNull();
	});
});

async function waitFor(condition: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 200; attempt++) {
		if (condition()) return;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	throw new Error("Condition was not met in time.");
}
