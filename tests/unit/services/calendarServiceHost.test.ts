import { requestUrl } from "obsidian";
import type { ServiceRequest } from "@tasknotes/calendar-service-client";
import {
	obsidianCalendarHost,
	obsidianTransport,
	sessionCredentialStore,
	vaultLocalStore,
} from "../../../src/services/calendarServiceHost";
import { CALENDAR_SERVICE_CONSTANTS } from "../../../src/services/constants";
import {
	CalendarProviderRegistry,
	GoogleCalendarSource,
	useGoogleCalendarSource,
} from "../../../src/services/CalendarProvider";

jest.mock("obsidian", () => ({
	...jest.requireActual<object>("obsidian"),
	requestUrl: jest.fn(),
}));

const sent = requestUrl as unknown as jest.Mock;

function secrets() {
	const values = new Map<string, string>();
	return {
		values,
		getSecret: (id: string) => values.get(id) ?? null,
		setSecret: (id: string, value: string) => void values.set(id, value),
	};
}

function request(overrides: Partial<ServiceRequest> = {}): ServiceRequest {
	return {
		method: "GET",
		headers: { Authorization: "Bearer credential" },
		signal: new AbortController().signal,
		credentials: "omit",
		cache: "no-store",
		redirect: "error",
		referrerPolicy: "no-referrer",
		...overrides,
	};
}

describe("the calendar service's Obsidian host", () => {
	it("keeps the session credential in secret storage and nowhere else", async () => {
		const storage = secrets();
		const store = sessionCredentialStore(storage);

		expect(await store.load()).toBeNull();
		await store.save("bearer-1");
		expect(await store.load()).toBe("bearer-1");
		expect([...storage.values.keys()]).toEqual([CALENDAR_SERVICE_CONSTANTS.SESSION_SECRET_ID]);

		// Secret storage cannot remove an entry; an emptied one reads as none.
		await store.clear();
		expect(await store.load()).toBeNull();
	});

	it("keeps its own state in this vault's local storage on this device", () => {
		const values = new Map<string, unknown>();
		const store = vaultLocalStore({
			loadLocalStorage: (key: string) => values.get(key) ?? null,
			saveLocalStorage: (key: string, value: unknown) =>
				void (value === null ? values.delete(key) : values.set(key, value)),
		});

		store.setItem("selection", "[]");
		expect(store.getItem("selection")).toBe("[]");
		expect([...values.keys()]).toEqual([`${CALENDAR_SERVICE_CONSTANTS.STORAGE_PREFIX}selection`]);
		store.removeItem("selection");
		expect(store.getItem("selection")).toBeNull();
	});

	it("signs in as the Obsidian plugin with a bearer session", () => {
		const host = obsidianCalendarHost({ secretStorage: secrets() } as never);

		expect(host.clientKind).toBe("obsidian");
		expect(host.credentials).not.toBeNull();
	});

	it("sends requests through Obsidian and reports the answer", async () => {
		sent.mockResolvedValue({ status: 200, text: '{"session_id":"s1"}' });

		const response = await obsidianTransport(
			"https://calendar.example/v1/session",
			request({ method: "POST", body: '{"a":1}' })
		);

		expect(sent).toHaveBeenCalledWith({
			url: "https://calendar.example/v1/session",
			method: "POST",
			headers: { Authorization: "Bearer credential" },
			body: '{"a":1}',
			throw: false,
		});
		expect(response).toMatchObject({ status: 200, ok: true });
		expect(await response.json()).toEqual({ session_id: "s1" });
	});

	it("reports a refusal without throwing, so the client can read why", async () => {
		sent.mockResolvedValue({ status: 409, text: '{"code":"reconnect_required"}' });

		const response = await obsidianTransport("https://calendar.example/v1/calendars", request());

		expect(response).toMatchObject({ status: 409, ok: false });
		expect(await response.json()).toEqual({ code: "reconnect_required" });
	});

	it("reports an unreachable service the way fetch does", async () => {
		sent.mockRejectedValue(new Error("net::ERR_INTERNET_DISCONNECTED"));

		await expect(
			obsidianTransport("https://calendar.example/v1/session", request())
		).rejects.toBeInstanceOf(TypeError);
	});

	it("stops waiting when the request is abandoned", async () => {
		sent.mockReturnValue(new Promise(() => undefined));
		const abandoned = new AbortController();

		const pending = obsidianTransport(
			"https://calendar.example/v1/session",
			request({ signal: abandoned.signal })
		);
		abandoned.abort(new DOMException("Abandoned", "AbortError"));

		await expect(pending).rejects.toMatchObject({ name: "AbortError" });
	});
});

describe("choosing the Google Calendar source", () => {
	class Source extends GoogleCalendarSource {
		getAvailableCalendars = () => [];
		getAllEvents = () => [];
		initialize = () => Promise.resolve();
		refresh = () => Promise.resolve();
		refreshAllCalendars = () => Promise.resolve();
		listCalendars = () => Promise.resolve([]);
		createCalendar = () => Promise.resolve("");
		createEvent = () => Promise.reject(new Error("unused"));
		updateEvent = () => Promise.reject(new Error("unused"));
		deleteEvent = () => Promise.resolve();
		clearCache = () => undefined;
		destroy = () => undefined;
	}

	it("reads the calendar service while signed in to it, otherwise the person's own application", () => {
		let signedIn = false;
		const own = new Source();
		const hosted = Object.assign(new Source(), { isSignedIn: () => signedIn });
		const plugin = {
			ownGoogleCalendarService: own,
			hostedGoogleCalendarService: hosted,
			calendarProviderRegistry: new CalendarProviderRegistry(),
			googleCalendarService: undefined as GoogleCalendarSource | undefined,
		};

		expect(useGoogleCalendarSource(plugin as never)).toBe(true);
		expect(plugin.googleCalendarService).toBe(own);
		expect(plugin.calendarProviderRegistry.getProvider("google")).toBe(own);
		expect(useGoogleCalendarSource(plugin as never)).toBe(false);

		signedIn = true;
		expect(useGoogleCalendarSource(plugin as never)).toBe(true);
		expect(plugin.googleCalendarService).toBe(hosted);
		// One provider answers for Google events, never both.
		expect(plugin.calendarProviderRegistry.getAllProviders()).toEqual([hosted]);
	});
});
