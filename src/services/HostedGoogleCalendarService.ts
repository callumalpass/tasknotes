import { msg } from "@lingui/core/macro";
import {
	CalendarServiceError,
	eventLinks,
	type CalendarServiceClient,
	type CalendarServiceFailure,
	type EventBoundary,
	type EventFields,
	type GoogleCalendar,
	type GoogleEvent,
} from "@tasknotes/calendar-service-client";
import type TaskNotesPlugin from "../main";
import type { ICSEvent } from "../types";
import { uiData } from "../i18n/dataText";
import { uiText } from "../i18n/runtime";
import { publishUserNotice } from "../core/userNotices";
import { normalizeCalendarDescription } from "../utils/calendarDescription";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { generateUuidV4 } from "../utils/uuid";
import {
	GoogleCalendarSource,
	type CalendarEventData,
	type EventDateTime,
	type ProviderCalendar,
} from "./CalendarProvider";
import { CALENDAR_SERVICE_CONSTANTS } from "./constants";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/HostedGoogleCalendarService" });

const DAY_MS = 24 * 60 * 60 * 1000;
/** How often to look at whether the events on screen have gone stale. */
const STALE_CHECK_MS = 5 * 60 * 1000;
const DEFAULT_EVENT_COLOR = "#4285F4";

/** Says what went wrong in the person's terms; the service's codes stay out of the interface. */
export function calendarServiceFailureMessage(failure: CalendarServiceFailure): string {
	switch (failure) {
		case "authorization_failed":
			return uiText(msg({ message: "Google didn’t complete the authorization. Try again.", context: "services/HostedGoogleCalendarService: authorization failed" }));
		case "authorization_expired":
			return uiText(msg({ message: "The Google authorization expired. Try again.", context: "services/HostedGoogleCalendarService: authorization expired" }));
		case "code_rejected":
			return uiText(msg({ message: "That confirmation code wasn’t accepted, or it expired. Start again to get a new one.", context: "services/HostedGoogleCalendarService: confirmation code rejected" }));
		case "conflict":
			return uiText(msg({ message: "This event changed in Google Calendar. The latest version has been loaded; try again.", context: "services/HostedGoogleCalendarService: event changed elsewhere" }));
		case "invalid_authorization":
			return uiText(msg({ message: "The authorization link wasn’t valid, so it wasn’t opened.", context: "services/HostedGoogleCalendarService: authorization link refused" }));
		case "invalid_request":
			return uiText(msg({ message: "Google Calendar didn’t accept this change.", context: "services/HostedGoogleCalendarService: change refused" }));
		case "not_found":
			return uiText(msg({ message: "This event no longer exists in Google Calendar.", context: "services/HostedGoogleCalendarService: event missing" }));
		case "pagination":
			return uiText(msg({ message: "This calendar has too many events to show.", context: "services/HostedGoogleCalendarService: too many events" }));
		case "popup_blocked":
			return uiText(msg({ message: "The browser couldn’t be opened to sign in with Google.", context: "services/HostedGoogleCalendarService: browser not opened" }));
		case "rate_limited":
			return uiText(msg({ message: "Google Calendar is busy. Try again shortly.", context: "services/HostedGoogleCalendarService: rate limited" }));
		case "reconnect_required":
			return uiText(msg({ message: "Google Calendar needs reconnecting. Reconnect it in TaskNotes settings.", context: "services/HostedGoogleCalendarService: reconnect required" }));
		case "session_expired":
			return uiText(msg({ message: "Your Google Calendar sign-in ended. Sign in again in TaskNotes settings.", context: "services/HostedGoogleCalendarService: session ended" }));
		case "unavailable":
			return uiText(msg({ message: "Google Calendar is unavailable right now. Try again.", context: "services/HostedGoogleCalendarService: service unavailable" }));
	}
}

function failureOf(error: unknown): CalendarServiceFailure {
	return error instanceof CalendarServiceError ? error.failure : "unavailable";
}

/** The failure as an error a notice or a settings row can show. */
function userError(error: unknown): Error {
	return new Error(calendarServiceFailureMessage(failureOf(error)));
}

function icsCalendarId(calendarId: string): string {
	return `google-${calendarId}`;
}

function icsEventId(calendarId: string, eventId: string): string {
	return `google-${calendarId}-${eventId}`;
}

/** A start or end as the views want it: a date, or local wall time without an offset. */
function icsBoundary(boundary: EventBoundary): string {
	if (boundary.kind === "date") return boundary.date;
	const at = new Date(boundary.date_time);
	const pad = (value: number) => String(value).padStart(2, "0");
	return (
		`${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
		`T${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`
	);
}

/**
 * A start or end as the service takes it. Callers give a date, or a wall time
 * with the zone it is in; a wall time without an offset is this device's.
 */
function serviceBoundary(value: EventDateTime | string | undefined): EventBoundary | undefined {
	if (value === undefined) return undefined;
	const boundary: EventDateTime =
		typeof value === "string" ? (value.includes("T") ? { dateTime: value } : { date: value }) : value;
	if (boundary.date) return { kind: "date", date: boundary.date };
	if (!boundary.dateTime) return undefined;
	const instant = new Date(boundary.dateTime);
	if (Number.isNaN(instant.getTime())) return undefined;
	return {
		kind: "date_time",
		date_time: instant.toISOString(),
		...(boundary.timeZone ? { time_zone: boundary.timeZone } : {}),
	};
}

function eventFields(updates: Partial<CalendarEventData> & { title?: string }): EventFields {
	const title = updates.summary ?? updates.title;
	const start = serviceBoundary(updates.start);
	const end = serviceBoundary(updates.end);
	return {
		...(title === undefined ? {} : { title }),
		...(updates.description === undefined ? {} : { description: updates.description }),
		...(updates.location === undefined ? {} : { location: updates.location }),
		...(start ? { start } : {}),
		...(end ? { end } : {}),
	};
}

/**
 * Google Calendar through the TaskNotes calendar service. The person signs in
 * with Google in their browser; the service holds the Google tokens and this
 * device holds only its own session. Events are read for a window around today
 * and kept in memory, never in the vault.
 */
export class HostedGoogleCalendarService extends GoogleCalendarSource {
	private byId = new Map<string, GoogleEvent>();
	private shown: ICSEvent[] = [];
	private reading: AbortController | null = null;
	private lastRead = 0;
	private lastManualRefresh = 0;
	private staleCheck: number | null = null;
	private unsubscribe: (() => void) | null = null;
	private wasSignedIn = false;
	private authorizing = false;
	private syncStatus: {
		lastSuccess: string | null;
		calendarErrors: { calendarId: string; message: string }[];
		calendarsChecked: number;
	} = { lastSuccess: null, calendarErrors: [], calendarsChecked: 0 };

	constructor(
		private readonly plugin: Pick<TaskNotesPlugin, "emitter">,
		readonly client: CalendarServiceClient
	) {
		super();
	}

	/** Whether this device has a session with the service. */
	isSignedIn(): boolean {
		return this.client.getSnapshot().sessionId !== null;
	}

	/** Whether Google Calendar can be read: signed in, and Google access still stands. */
	isConnected(): boolean {
		const { sessionId, connection } = this.client.getSnapshot();
		return sessionId !== null && connection?.status === "active";
	}

	getSyncStatus() {
		return {
			...this.syncStatus,
			calendarErrors: this.syncStatus.calendarErrors.map((error) => ({ ...error })),
		};
	}

	/** Resumes a stored session, if there is one, and starts keeping events current. */
	async initialize(): Promise<void> {
		this.unsubscribe ??= this.client.subscribe(() => this.sessionChanged());
		if (this.staleCheck === null) {
			this.staleCheck = window.setInterval(this.refreshIfStale, STALE_CHECK_MS);
			document.addEventListener("visibilitychange", this.refreshIfStale);
		}
		await this.resume();
	}

	/** Does nothing unless this device was signed in when it last ran. */
	private async resume(): Promise<void> {
		await this.client.restore();
		this.sessionChanged();
		if (this.isSignedIn()) await this.refreshAllCalendars();
	}

	/**
	 * The session can end without anyone asking: the service signs a device out,
	 * or Google withdraws access. Whatever was read under it stops being shown.
	 */
	private sessionChanged(): void {
		const signedIn = this.isSignedIn();
		if (signedIn !== this.wasSignedIn) {
			this.wasSignedIn = signedIn;
			this.emit("session-changed");
		}
		if (!this.isConnected() && this.byId.size > 0) this.show(new Map());
	}

	/** Reads again only while Obsidian is on screen, and only once the last read has aged. */
	private refreshIfStale = (): void => {
		if (document.visibilityState !== "visible") return;
		if (!this.isSignedIn()) {
			// A start without a network leaves a stored session unresumed.
			void this.resume();
			return;
		}
		if (!this.isConnected()) return;
		if (Date.now() - this.lastRead < CALENDAR_SERVICE_CONSTANTS.REFRESH_INTERVAL_MS) return;
		void this.refreshAllCalendars();
	};

	/**
	 * Signs in with Google, then asks for Calendar access if it has not been
	 * given. The browser shows a code once Google has finished; `askForCode`
	 * collects it here, and answering nothing abandons the sign-in.
	 */
	async connect(askForCode: () => Promise<string | null>): Promise<void> {
		if (this.authorizing) return;
		this.authorizing = true;
		let asking = false;
		const stop = this.client.subscribe(() => {
			if (asking || !this.client.getSnapshot().awaitingCode) return;
			asking = true;
			void askForCode().then((code) => {
				asking = false;
				if (code?.trim()) this.client.submitCode(code);
				else this.client.cancelAuthorization();
			});
		});
		try {
			if (!this.isSignedIn()) {
				await this.client.signIn();
				this.throwClientFailure();
				if (!this.isSignedIn()) return;
			}
			if (!this.isConnected()) {
				await this.client.connect();
				this.throwClientFailure();
			}
		} finally {
			stop();
			this.authorizing = false;
		}
		await this.refreshAllCalendars({ propagateErrors: true });
	}

	/** Whether a sign-in is waiting on the person's browser. */
	isAuthorizing(): boolean {
		return this.authorizing;
	}

	/** Stops waiting for a sign-in the person has given up on. */
	cancelConnect(): void {
		this.client.cancelAuthorization();
	}

	/** Signs this device out. Google access and other devices are left as they are. */
	async signOut(): Promise<void> {
		await this.client.signOut();
		// A session the service no longer knows is gone either way.
		if (this.isSignedIn()) this.client.forget();
	}

	/** Withdraws Google Calendar access for every device, then signs this one out. */
	async handleDisconnect(): Promise<void> {
		await this.client.disconnect();
		this.throwClientFailure();
		await this.signOut();
	}

	/** Deletes the person's account with the service, on every device. */
	async deleteAccount(): Promise<void> {
		await this.client.deleteAccount();
		this.throwClientFailure();
	}

	/** Chooses which calendars are shown, then reads them. */
	async setShownCalendars(calendarIds: string[]): Promise<void> {
		this.client.setSelected(calendarIds);
		await this.refreshAllCalendars();
	}

	/** The client reports a failed action in its snapshot rather than by rejecting. */
	private throwClientFailure(): void {
		const { failure } = this.client.getSnapshot();
		if (failure) throw new Error(calendarServiceFailureMessage(failure));
	}

	/** Every calendar the person has, whether or not it is shown. */
	getAllCalendars(): GoogleCalendar[] {
		return this.client.getSnapshot().calendars;
	}

	private shownCalendars(): GoogleCalendar[] {
		const { calendars, selected } = this.client.getSnapshot();
		const shown = new Set(selected);
		return calendars.filter((calendar) => shown.has(calendar.id));
	}

	getAvailableCalendars(): ProviderCalendar[] {
		return this.shownCalendars().map((calendar) => ({
			id: calendar.id,
			summary: calendar.name,
			primary: calendar.is_primary,
			canWrite: calendar.can_write,
			...(calendar.color ? { backgroundColor: calendar.color } : {}),
		}));
	}

	async listCalendars(): Promise<ProviderCalendar[]> {
		await this.client.refresh();
		this.throwClientFailure();
		return this.getAvailableCalendars();
	}

	getAllEvents(): ICSEvent[] {
		return this.shown;
	}

	private toICSEvent(event: GoogleEvent, colors: ReadonlyMap<string, string>): ICSEvent {
		const link = eventLinks(event).google;
		const description = normalizeCalendarDescription(event.description);
		return {
			id: icsEventId(event.calendar_id, event.id),
			subscriptionId: icsCalendarId(event.calendar_id),
			title:
				event.title ||
				uiData("Untitled Event", "Persisted/cache provider fallback title; preserve English data seed"),
			start: icsBoundary(event.start),
			end: icsBoundary(event.end),
			allDay: event.start.kind === "date",
			color: colors.get(event.calendar_id) ?? DEFAULT_EVENT_COLOR,
			...(description ? { description } : {}),
			...(event.location ? { location: event.location } : {}),
			...(link ? { url: link } : {}),
			...(event.recurrence
				? { recurringEventId: icsEventId(event.calendar_id, event.recurrence.series_id) }
				: {}),
		};
	}

	/** Replaces what the views see and tells them. */
	private show(byId: Map<string, GoogleEvent>): void {
		const colors = new Map<string, string>();
		for (const calendar of this.getAllCalendars())
			if (calendar.color) colors.set(calendar.id, calendar.color);
		this.byId = byId;
		this.shown = [...byId.values()].map((event) => this.toICSEvent(event, colors));
		this.emit("data-changed");
	}

	async refreshAllCalendars(options: { propagateErrors?: boolean } = {}): Promise<void> {
		this.reading?.abort();
		if (!this.isConnected()) {
			if (this.byId.size > 0) this.show(new Map());
			return;
		}
		const reading = new AbortController();
		this.reading = reading;
		const now = Date.now();
		const start = new Date(now - CALENDAR_SERVICE_CONSTANTS.VIEW_RANGE.DAYS_BEFORE * DAY_MS);
		const end = new Date(now + CALENDAR_SERVICE_CONSTANTS.VIEW_RANGE.DAYS_AFTER * DAY_MS);
		const calendars = this.shownCalendars();
		const read = new Map<string, GoogleEvent>();
		const calendarErrors: { calendarId: string; message: string }[] = [];
		for (const calendar of calendars) {
			try {
				const { events } = await this.client.events(calendar.id, start, end, reading.signal);
				for (const event of events) read.set(icsEventId(event.calendar_id, event.id), event);
			} catch (error) {
				// A newer read, or the end of the session, has taken over.
				if (reading.signal.aborted || !this.isConnected()) return;
				tasknotesLogger.error("Failed to read a Google calendar:", {
					category: "provider",
					operation: "hosted-google-calendar-read",
					error,
				});
				calendarErrors.push({
					calendarId: calendar.name,
					message: calendarServiceFailureMessage(failureOf(error)),
				});
				// A passing failure keeps what was last read for this calendar.
				for (const [id, event] of this.byId)
					if (event.calendar_id === calendar.id) read.set(id, event);
			}
		}
		if (reading.signal.aborted) return;
		this.lastRead = Date.now();
		this.syncStatus = {
			lastSuccess:
				calendarErrors.length === 0 ? new Date().toISOString() : this.syncStatus.lastSuccess,
			calendarErrors,
			calendarsChecked: calendars.length,
		};
		this.show(read);
		if (calendarErrors.length > 0 && options.propagateErrors)
			throw new Error(
				calendarErrors.map(({ calendarId, message }) => `${calendarId}: ${message}`).join("\n")
			);
	}

	/** A refresh the person asked for: finds calendars again, then reads them. */
	async refresh(): Promise<void> {
		const wait = CALENDAR_SERVICE_CONSTANTS.MIN_MANUAL_REFRESH_INTERVAL_MS - (Date.now() - this.lastManualRefresh);
		if (wait > 0) {
			publishUserNotice(this.plugin.emitter, uiText(msg({ message: "{seconds, plural, one {Please wait # second before refreshing again} other {Please wait # seconds before refreshing again}}", context: "calendar refresh throttling" }), { seconds: Math.ceil(wait / 1000) }));
			return;
		}
		this.lastManualRefresh = Date.now();
		if (!this.isSignedIn()) return;
		await this.client.refresh();
		this.throwClientFailure();
		await this.refreshAllCalendars({ propagateErrors: true });
	}

	private known(calendarId: string, eventId: string): GoogleEvent {
		const event = this.byId.get(icsEventId(calendarId, eventId));
		if (!event) throw new Error(calendarServiceFailureMessage("not_found"));
		return event;
	}

	private keep(event: GoogleEvent): ICSEvent {
		const byId = new Map(this.byId);
		byId.set(icsEventId(event.calendar_id, event.id), event);
		this.show(byId);
		return this.shown.find(({ id }) => id === icsEventId(event.calendar_id, event.id)) as ICSEvent;
	}

	/** A write that lost to a change in Google needs the newer event before another try. */
	private afterFailedWrite(error: unknown): Error {
		const failure = failureOf(error);
		if (failure === "conflict" || failure === "not_found") void this.refreshAllCalendars();
		return userError(error);
	}

	async updateEvent(
		calendarId: string,
		eventId: string,
		updates: Partial<CalendarEventData>
	): Promise<ICSEvent> {
		const event = this.known(calendarId, eventId);
		try {
			return this.keep(await this.client.updateEvent(event, eventFields(updates)));
		} catch (error) {
			throw this.afterFailedWrite(error);
		}
	}

	async createEvent(calendarId: string, event: CalendarEventData): Promise<ICSEvent> {
		const fields = eventFields(event);
		if (!fields.start || !fields.end) throw new Error(calendarServiceFailureMessage("invalid_request"));
		try {
			return this.keep(
				await this.client.createEvent(
					calendarId,
					{ ...fields, start: fields.start, end: fields.end },
					generateUuidV4()
				)
			);
		} catch (error) {
			throw userError(error);
		}
	}

	async deleteEvent(calendarId: string, eventId: string): Promise<void> {
		const event = this.known(calendarId, eventId);
		try {
			await this.client.deleteEvent(event);
		} catch (error) {
			throw this.afterFailedWrite(error);
		}
		const byId = new Map(this.byId);
		byId.delete(icsEventId(calendarId, eventId));
		this.show(byId);
	}

	createCalendar(): Promise<string> {
		return Promise.reject(
			new Error(uiText(msg({ message: "Calendars can’t be created from TaskNotes. Create one in Google Calendar.", context: "services/HostedGoogleCalendarService: creating a calendar" })))
		);
	}

	clearCache(): void {
		this.byId = new Map();
		this.shown = [];
	}

	destroy(): void {
		this.reading?.abort();
		if (this.staleCheck !== null) window.clearInterval(this.staleCheck);
		this.staleCheck = null;
		document.removeEventListener("visibilitychange", this.refreshIfStale);
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.clearCache();
	}
}
