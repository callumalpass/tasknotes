/**
 * CalDAV protocol client (RFC 4791, RFC 6578).
 *
 * Every request goes through Obsidian's `requestUrl`, which accepts arbitrary
 * methods and headers, exposes response headers (so ETags are readable), and
 * bypasses CORS — none of which `fetch` gives us inside a plugin. It also works
 * unchanged on mobile, which matters because TaskNotes is not desktop-only.
 *
 * This file is on the `no-network-outside-provider` allowlist in
 * scripts/run-architecture-conformance.mjs as a provider service, alongside the
 * Google/Microsoft/ICS ones.
 */

import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from "obsidian";

import {
	buildCalendarCollectionsRequest,
	buildCalendarHomeSetRequest,
	buildCalendarQueryVTodoRequest,
	buildCollectionTagRequest,
	buildCurrentUserPrincipalRequest,
	buildEtagListRequest,
	buildMultigetRequest,
	buildSyncCollectionRequest,
	normalizeEtag,
	parseMultistatus,
	parseSyncCollection,
	selectVTodoCollections,
} from "./caldav/caldavXml";
import { createTaskNotesLogger, type TaskNotesLogger } from "../utils/tasknotesLogger";

export interface CalDavCredentials {
	username: string;
	password: string;
}

export interface CalDavCollectionInfo {
	/** Absolute URL of the collection. */
	url: string;
	displayName: string;
	/** Sync token as of discovery, when the server advertises one. */
	syncToken?: string;
}

export interface CalDavResource {
	/** Absolute URL of the resource. */
	url: string;
	etag?: string;
	/** Raw iCalendar body, when the response carried one. */
	data?: string;
}

/** Cheap change signal for a collection, used to skip pointless polls. */
export interface CalDavCollectionTag {
	ctag?: string;
	syncToken?: string;
}

export interface CalDavSyncResult {
	syncToken?: string;
	changed: CalDavResource[];
	removed: string[];
	/** True when the server does not support sync-collection and we listed instead. */
	usedFallback: boolean;
}

export type CalDavRequestFn = (params: RequestUrlParam) => Promise<RequestUrlResponse>;

export type CalDavErrorKind =
	| "auth"
	| "not-found"
	| "conflict"
	| "precondition"
	| "server"
	| "network"
	| "protocol";

export class CalDavError extends Error {
	constructor(
		readonly kind: CalDavErrorKind,
		message: string,
		readonly status?: number
	) {
		super(message);
		this.name = "CalDavError";
	}
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8000;
const BACKOFF_MULTIPLIER = 2;
/** Upper bound on ancestor paths probed while hunting for the principal. */
const MAX_PRINCIPAL_ANCESTORS = 6;

export interface CalDavClientOptions {
	serverUrl: string;
	credentials: CalDavCredentials;
	/** Injectable for tests; defaults to Obsidian's `requestUrl`. */
	requestFn?: CalDavRequestFn;
	logger?: TaskNotesLogger;
	/** Overridable so tests do not actually wait out the backoff. */
	sleepFn?: (ms: number) => Promise<void>;
}

export class CalDavClient {
	private readonly serverUrl: string;
	private readonly credentials: CalDavCredentials;
	private readonly request: CalDavRequestFn;
	private readonly logger: TaskNotesLogger;
	private readonly sleep: (ms: number) => Promise<void>;

	constructor(options: CalDavClientOptions) {
		this.serverUrl = options.serverUrl;
		this.credentials = options.credentials;
		this.request = options.requestFn ?? requestUrl;
		this.logger = options.logger ?? createTaskNotesLogger({ tag: "Services/CalDavClient" });
		this.sleep =
			options.sleepFn ??
			((ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms)));

		assertCredentialsAreSafeToSend(options.serverUrl);
	}

	/**
	 * Walks the RFC 4791 discovery chain and returns only the collections that
	 * can actually hold VTODOs, so an event-only calendar is never offered as a
	 * task list.
	 */
	async discoverCollections(): Promise<CalDavCollectionInfo[]> {
		const principal = await this.findCurrentUserPrincipal();
		const homeSet = await this.findCalendarHomeSet(principal);

		const response = await this.send({
			method: "PROPFIND",
			url: homeSet,
			headers: { Depth: "1" },
			body: buildCalendarCollectionsRequest(),
		});

		const { responses } = parseMultistatus(response.text);
		return selectVTodoCollections(responses).map((entry) => ({
			url: this.resolve(entry.href),
			displayName: entry.displayName?.trim() || lastPathSegment(entry.href),
		}));
	}

	/**
	 * Reads the collection's change tokens without listing anything.
	 *
	 * One small request that answers "is a poll worth doing at all?". Collections
	 * routinely hold far more VEVENTs than VTODOs, so skipping the query when
	 * nothing has moved is the difference between one round trip and a full
	 * calendar download.
	 */
	async getCollectionTag(collectionUrl: string): Promise<CalDavCollectionTag> {
		const response = await this.send({
			method: "PROPFIND",
			url: collectionUrl,
			headers: { Depth: "0" },
			body: buildCollectionTagRequest(),
		});

		const { responses } = parseMultistatus(response.text);
		const entry = responses.find((item) => item.ctag || item.collectionSyncToken);
		return { ctag: entry?.ctag, syncToken: entry?.collectionSyncToken };
	}

	/** Fetches every VTODO in a collection, bodies included. Used for first sync. */
	async fetchAllVTodos(collectionUrl: string): Promise<CalDavResource[]> {
		const response = await this.send({
			method: "REPORT",
			url: collectionUrl,
			headers: { Depth: "1" },
			body: buildCalendarQueryVTodoRequest(),
		});

		return parseMultistatus(response.text)
			.responses.filter((entry) => entry.calendarData)
			.map((entry) => ({
				url: this.resolve(entry.href),
				etag: entry.etag,
				data: entry.calendarData,
			}));
	}

	/**
	 * Incremental change feed.
	 *
	 * Prefers RFC 6578 sync-collection, which reports deletions explicitly. When
	 * the server rejects it (many older Radicale and Baikal builds do), falls
	 * back to listing ETags — the caller then infers deletions from hrefs that
	 * were in its index but absent from the listing.
	 */
	async syncCollection(
		collectionUrl: string,
		syncToken?: string
	): Promise<CalDavSyncResult> {
		try {
			const response = await this.send({
				method: "REPORT",
				url: collectionUrl,
				headers: { Depth: "1" },
				body: buildSyncCollectionRequest(syncToken),
			});

			const parsed = parseSyncCollection(response.text);
			// A server that ignores sync-collection can still answer 207 with an
			// empty body; treating that as "nothing changed" would stall the sync
			// forever, so fall back when it yields nothing usable.
			if (!parsed.syncToken && parsed.changed.length === 0 && parsed.removed.length === 0) {
				return this.listCollectionEtags(collectionUrl);
			}

			return {
				syncToken: parsed.syncToken,
				changed: parsed.changed.map((entry) => ({
					url: this.resolve(entry.href),
					etag: entry.etag,
				})),
				removed: parsed.removed.map((href) => this.resolve(href)),
				usedFallback: false,
			};
		} catch (error) {
			if (error instanceof CalDavError && isSyncCollectionUnsupported(error)) {
				this.logger.info("Server does not support sync-collection; listing ETags", {
					category: "provider",
					operation: "sync-collection-fallback",
					details: { collectionUrl },
				});
				return this.listCollectionEtags(collectionUrl);
			}
			throw error;
		}
	}

	/** Lists hrefs and ETags without bodies. The sync-collection fallback. */
	async listCollectionEtags(collectionUrl: string): Promise<CalDavSyncResult> {
		const response = await this.send({
			method: "PROPFIND",
			url: collectionUrl,
			headers: { Depth: "1" },
			body: buildEtagListRequest(),
		});

		const collection = normalizeUrl(collectionUrl);
		const changed = parseMultistatus(response.text)
			.responses.map((entry) => ({ url: this.resolve(entry.href), etag: entry.etag }))
			// The collection itself comes back in a Depth:1 listing; it is not a
			// resource, and treating it as one would create a phantom task.
			.filter((entry) => normalizeUrl(entry.url) !== collection && Boolean(entry.etag));

		return { changed, removed: [], usedFallback: true };
	}

	/** Fetches the bodies of specific resources in one round trip. */
	async fetchResources(
		collectionUrl: string,
		urls: readonly string[]
	): Promise<CalDavResource[]> {
		if (urls.length === 0) return [];

		const response = await this.send({
			method: "REPORT",
			url: collectionUrl,
			headers: { Depth: "1" },
			body: buildMultigetRequest(urls.map((url) => pathOf(url))),
		});

		return parseMultistatus(response.text)
			.responses.filter((entry) => entry.calendarData)
			.map((entry) => ({
				url: this.resolve(entry.href),
				etag: entry.etag,
				data: entry.calendarData,
			}));
	}

	/** Reads one resource. Returns null when it no longer exists. */
	async getResource(url: string): Promise<CalDavResource | null> {
		try {
			const response = await this.send({
				method: "GET",
				url,
				headers: { Accept: "text/calendar" },
			});
			return {
				url,
				etag: normalizeEtag(headerValue(response.headers, "etag")),
				data: response.text,
			};
		} catch (error) {
			if (error instanceof CalDavError && error.kind === "not-found") return null;
			throw error;
		}
	}

	/**
	 * Writes a resource under optimistic concurrency control.
	 *
	 * `ifMatch` carries the ETag from the last sync, so a 412 means the remote
	 * changed underneath us — that is what makes conflict *detection* possible
	 * rather than blindly overwriting. `ifNoneMatch: "*"` is used for a first
	 * push, so an existing resource at the same href is never clobbered.
	 */
	async putResource(
		url: string,
		icsBody: string,
		options: { ifMatch?: string; ifNoneMatch?: "*" } = {}
	): Promise<{ etag?: string; conflict: boolean }> {
		const headers: Record<string, string> = {
			"Content-Type": "text/calendar; charset=utf-8",
		};
		if (options.ifMatch) headers["If-Match"] = `"${options.ifMatch}"`;
		if (options.ifNoneMatch) headers["If-None-Match"] = options.ifNoneMatch;

		try {
			const response = await this.send({ method: "PUT", url, headers, body: icsBody });
			return {
				etag: normalizeEtag(headerValue(response.headers, "etag")),
				conflict: false,
			};
		} catch (error) {
			if (error instanceof CalDavError && error.kind === "precondition") {
				return { conflict: true };
			}
			throw error;
		}
	}

	/**
	 * Deletes a resource. Returns false when it was already gone, which is a
	 * success for our purposes, and reports a conflict when the ETag no longer
	 * matches.
	 */
	async deleteResource(
		url: string,
		options: { ifMatch?: string } = {}
	): Promise<{ deleted: boolean; conflict: boolean }> {
		const headers: Record<string, string> = {};
		if (options.ifMatch) headers["If-Match"] = `"${options.ifMatch}"`;

		try {
			await this.send({ method: "DELETE", url, headers });
			return { deleted: true, conflict: false };
		} catch (error) {
			if (error instanceof CalDavError && error.kind === "not-found") {
				return { deleted: false, conflict: false };
			}
			if (error instanceof CalDavError && error.kind === "precondition") {
				return { deleted: false, conflict: true };
			}
			throw error;
		}
	}

	// -----------------------------------------------------------------------
	// Discovery steps
	// -----------------------------------------------------------------------

	/**
	 * Entry points to probe for the principal, nearest first.
	 *
	 * Users paste whatever URL they had to hand — often a collection or even the
	 * files endpoint — and the principal usually lives on an ancestor path, so
	 * walk up to the origin before falling back to the well-known endpoint.
	 * That fallback is deliberately last: servers behind a reverse proxy
	 * frequently redirect it to plain http, and `requestUrl` follows redirects
	 * with no way to veto a scheme downgrade, which would put the credentials on
	 * the wire in clear text.
	 */
	private principalCandidates(): string[] {
		const candidates: string[] = [];
		const push = (url: string) => {
			if (!candidates.includes(url)) candidates.push(url);
		};

		push(this.serverUrl);

		try {
			const parsed = new URL(this.serverUrl);
			const segments = parsed.pathname.split("/").filter(Boolean);
			for (let depth = segments.length - 1; depth >= 0; depth--) {
				if (candidates.length > MAX_PRINCIPAL_ANCESTORS) break;
				const path = `/${segments.slice(0, depth).join("/")}${depth > 0 ? "/" : ""}`;
				push(new URL(path, parsed).toString());
			}
		} catch {
			// An unparseable URL is caught by assertCredentialsAreSafeToSend in the
			// constructor; nothing useful to add to the ladder here.
		}

		// Always last, never dropped by the cap above.
		push(this.resolve("/.well-known/caldav"));
		return candidates;
	}

	private async findCurrentUserPrincipal(): Promise<string> {
		for (const candidate of this.principalCandidates()) {
			try {
				const response = await this.send({
					method: "PROPFIND",
					url: candidate,
					headers: { Depth: "0" },
					body: buildCurrentUserPrincipalRequest(),
				});
				const principal = parseMultistatus(response.text).responses.find(
					(entry) => entry.currentUserPrincipal
				)?.currentUserPrincipal;
				if (principal) return this.resolve(principal);
			} catch (error) {
				// Auth failures are fatal and worth surfacing immediately; anything
				// else just means this candidate was not the right entry point.
				if (error instanceof CalDavError && error.kind === "auth") throw error;
			}
		}

		// Some servers expose no principal at all but serve collections directly
		// from the configured URL.
		return this.serverUrl;
	}

	private async findCalendarHomeSet(principalUrl: string): Promise<string> {
		try {
			const response = await this.send({
				method: "PROPFIND",
				url: principalUrl,
				headers: { Depth: "0" },
				body: buildCalendarHomeSetRequest(),
			});
			const home = parseMultistatus(response.text).responses.find(
				(entry) => entry.calendarHomeSet
			)?.calendarHomeSet;
			if (home) return this.resolve(home);
		} catch (error) {
			if (error instanceof CalDavError && error.kind === "auth") throw error;
		}
		return principalUrl;
	}

	// -----------------------------------------------------------------------
	// Transport
	// -----------------------------------------------------------------------

	private async send(params: {
		method: string;
		url: string;
		headers?: Record<string, string>;
		body?: string;
	}): Promise<RequestUrlResponse> {
		let backoff = INITIAL_BACKOFF_MS;
		let lastError: unknown;

		for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
			let response: RequestUrlResponse;
			try {
				response = await this.request({
					url: params.url,
					method: params.method,
					headers: {
						Authorization: basicAuthHeader(this.credentials),
						"User-Agent": "TaskNotes/CalDAV",
						...params.headers,
					},
					body: params.body,
					// Status codes are part of the protocol here — 207, 404 and 412
					// all carry meaning — so they must not be thrown as exceptions.
					throw: false,
				});
			} catch (error) {
				// A genuine transport failure (DNS, TLS, offline).
				lastError = error;
				if (attempt === MAX_RETRIES) {
					throw new CalDavError("network", describeError(error));
				}
				await this.sleep(jitter(backoff));
				backoff = Math.min(backoff * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
				continue;
			}

			if (response.status >= 200 && response.status < 300) return response;

			if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
				this.logger.debug("Retrying CalDAV request", {
					category: "provider",
					operation: "retry",
					details: { status: response.status, method: params.method, attempt },
				});
				await this.sleep(jitter(backoff));
				backoff = Math.min(backoff * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
				continue;
			}

			throw this.toError(response, params.method, params.url);
		}

		throw new CalDavError("network", describeError(lastError));
	}

	private toError(
		response: RequestUrlResponse,
		method: string,
		url: string
	): CalDavError {
		const kind = classifyStatus(response.status);
		// Never log the URL's credentials or the request body; a 401 body from
		// some servers echoes the submitted username.
		this.logger.warn("CalDAV request failed", {
			category: "provider",
			operation: "request",
			details: { status: response.status, method, path: pathOf(url), kind },
		});
		return new CalDavError(
			kind,
			`CalDAV ${method} failed with status ${response.status}`,
			response.status
		);
	}

	/** Resolves an href or absolute URL against the configured server. */
	private resolve(hrefOrUrl: string): string {
		try {
			return new URL(hrefOrUrl, this.serverUrl).toString();
		} catch {
			return hrefOrUrl;
		}
	}
}

function classifyStatus(status: number): CalDavErrorKind {
	if (status === 401 || status === 403) return "auth";
	if (status === 404 || status === 410) return "not-found";
	if (status === 409) return "conflict";
	if (status === 412) return "precondition";
	if (status >= 500) return "server";
	return "protocol";
}

/**
 * A server without sync-collection support answers with 400 (bad request),
 * 403 (forbidden report) or 501 (not implemented) rather than a clean signal.
 */
function isSyncCollectionUnsupported(error: CalDavError): boolean {
	return (
		error.status === 400 ||
		error.status === 403 ||
		error.status === 501 ||
		error.kind === "protocol"
	);
}

/**
 * Refuses to send credentials in the clear. Loopback is exempt so a local
 * Radicale instance can be used for development without a certificate.
 */
export function assertCredentialsAreSafeToSend(serverUrl: string): void {
	let parsed: URL;
	try {
		parsed = new URL(serverUrl);
	} catch {
		throw new CalDavError("protocol", "CalDAV server URL is not a valid URL");
	}

	if (parsed.protocol === "https:") return;

	const host = parsed.hostname;
	const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "::1";
	if (parsed.protocol === "http:" && isLoopback) return;

	throw new CalDavError(
		"protocol",
		"Refusing to send CalDAV credentials over an unencrypted connection. Use https://."
	);
}

export function basicAuthHeader(credentials: CalDavCredentials): string {
	const raw = `${credentials.username}:${credentials.password}`;
	// btoa is Latin-1 only, so encode to UTF-8 bytes first — otherwise a
	// non-ASCII password throws instead of authenticating.
	const bytes = new TextEncoder().encode(raw);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return `Basic ${btoa(binary)}`;
}

function headerValue(
	headers: Record<string, string> | undefined,
	name: string
): string | undefined {
	if (!headers) return undefined;
	const wanted = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === wanted) return value;
	}
	return undefined;
}

function jitter(backoffMs: number): number {
	return Math.round(backoffMs * (1 + Math.random() * 0.3));
}

function normalizeUrl(url: string): string {
	return url.replace(/\/+$/u, "");
}

function pathOf(url: string): string {
	try {
		return new URL(url).pathname;
	} catch {
		return url;
	}
}

function lastPathSegment(href: string): string {
	const segments = href.split("/").filter(Boolean);
	return segments[segments.length - 1] ?? href;
}

function describeError(error: unknown): string {
	if (error instanceof Error) return `CalDAV request failed: ${error.message}`;
	return "CalDAV request failed";
}
