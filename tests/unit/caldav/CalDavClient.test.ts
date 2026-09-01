import type { RequestUrlParam, RequestUrlResponse } from "obsidian";
import {
	assertCredentialsAreSafeToSend,
	basicAuthHeader,
	CalDavClient,
	CalDavError,
	type CalDavRequestFn,
} from "../../../src/services/CalDavClient";

const credentials = { username: "fabian", password: "app-password" };

function response(
	status: number,
	body = "",
	headers: Record<string, string> = {}
): RequestUrlResponse {
	return {
		status,
		headers,
		text: body,
		json: undefined,
		arrayBuffer: new ArrayBuffer(0),
	} as unknown as RequestUrlResponse;
}

/** Records every request and replies from a queue of canned responses. */
function recorder(replies: Array<(params: RequestUrlParam) => RequestUrlResponse>) {
	const calls: RequestUrlParam[] = [];
	let index = 0;
	const requestFn: CalDavRequestFn = async (params) => {
		calls.push(params);
		const reply = replies[Math.min(index, replies.length - 1)];
		index++;
		return reply(params);
	};
	return { calls, requestFn };
}

function makeClient(requestFn: CalDavRequestFn, serverUrl = "https://cloud.example.com") {
	return new CalDavClient({
		serverUrl,
		credentials,
		requestFn,
		sleepFn: async () => undefined, // never actually wait out the backoff
	});
}

const MULTISTATUS_ETAGS = `<d:multistatus xmlns:d="DAV:">
	<d:response><d:href>/cal/tasks/</d:href>
		<d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
		<d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
	<d:response><d:href>/cal/tasks/1.ics</d:href>
		<d:propstat><d:prop><d:getetag>"e1"</d:getetag></d:prop>
		<d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
</d:multistatus>`;

describe("credential safety", () => {
	it("accepts https", () => {
		expect(() => assertCredentialsAreSafeToSend("https://cloud.example.com")).not.toThrow();
	});

	it("refuses plain http to a remote host", () => {
		expect(() => assertCredentialsAreSafeToSend("http://cloud.example.com")).toThrow(
			/unencrypted/iu
		);
	});

	it("allows http on loopback so a local Radicale can be used", () => {
		for (const url of ["http://localhost:5232", "http://127.0.0.1:5232"]) {
			expect(() => assertCredentialsAreSafeToSend(url)).not.toThrow();
		}
	});

	it("rejects a malformed URL", () => {
		expect(() => assertCredentialsAreSafeToSend("not a url")).toThrow(CalDavError);
	});

	it("is enforced by the constructor", () => {
		expect(
			() =>
				new CalDavClient({
					serverUrl: "http://cloud.example.com",
					credentials,
					requestFn: async () => response(200),
				})
		).toThrow(/unencrypted/iu);
	});
});

describe("basicAuthHeader", () => {
	it("encodes username and password", () => {
		expect(basicAuthHeader({ username: "user", password: "pass" })).toBe(
			`Basic ${btoa("user:pass")}`
		);
	});

	it("handles a non-ASCII password without throwing", () => {
		// btoa is Latin-1 only, so this would throw without the UTF-8 step.
		expect(() =>
			basicAuthHeader({ username: "fabian", password: "pässwörd–ü" })
		).not.toThrow();
	});
});

describe("authentication header", () => {
	it("is sent on every request", async () => {
		const { calls, requestFn } = recorder([() => response(207, MULTISTATUS_ETAGS)]);
		await makeClient(requestFn).listCollectionEtags("https://cloud.example.com/cal/tasks/");

		expect(calls[0].headers?.Authorization).toBe(basicAuthHeader(credentials));
	});
});

describe("listCollectionEtags", () => {
	it("returns resources and excludes the collection itself", async () => {
		const { requestFn } = recorder([() => response(207, MULTISTATUS_ETAGS)]);
		const result = await makeClient(requestFn).listCollectionEtags(
			"https://cloud.example.com/cal/tasks/"
		);

		expect(result.usedFallback).toBe(true);
		expect(result.changed).toEqual([
			{ url: "https://cloud.example.com/cal/tasks/1.ics", etag: "e1" },
		]);
	});

	it("sends PROPFIND with Depth 1", async () => {
		const { calls, requestFn } = recorder([() => response(207, MULTISTATUS_ETAGS)]);
		await makeClient(requestFn).listCollectionEtags("https://cloud.example.com/cal/tasks/");

		expect(calls[0].method).toBe("PROPFIND");
		expect(calls[0].headers?.Depth).toBe("1");
	});
});

describe("syncCollection", () => {
	const SYNC_RESPONSE = `<d:multistatus xmlns:d="DAV:">
		<d:response><d:href>/cal/tasks/1.ics</d:href>
			<d:propstat><d:prop><d:getetag>"e2"</d:getetag></d:prop>
			<d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
		<d:response><d:href>/cal/tasks/gone.ics</d:href>
			<d:status>HTTP/1.1 404 Not Found</d:status></d:response>
		<d:sync-token>token-2</d:sync-token>
	</d:multistatus>`;

	it("reports changes, removals and the next token", async () => {
		const { calls, requestFn } = recorder([() => response(207, SYNC_RESPONSE)]);
		const result = await makeClient(requestFn).syncCollection(
			"https://cloud.example.com/cal/tasks/",
			"token-1"
		);

		expect(calls[0].method).toBe("REPORT");
		expect(calls[0].body).toContain("<d:sync-token>token-1</d:sync-token>");
		expect(result.usedFallback).toBe(false);
		expect(result.syncToken).toBe("token-2");
		expect(result.changed).toEqual([
			{ url: "https://cloud.example.com/cal/tasks/1.ics", etag: "e2" },
		]);
		expect(result.removed).toEqual(["https://cloud.example.com/cal/tasks/gone.ics"]);
	});

	it("falls back to an ETag listing when the server rejects the REPORT", async () => {
		const { calls, requestFn } = recorder([
			() => response(400, "unsupported report"),
			() => response(207, MULTISTATUS_ETAGS),
		]);
		const result = await makeClient(requestFn).syncCollection(
			"https://cloud.example.com/cal/tasks/"
		);

		expect(calls[0].method).toBe("REPORT");
		expect(calls[1].method).toBe("PROPFIND");
		expect(result.usedFallback).toBe(true);
		expect(result.changed).toHaveLength(1);
	});

	it("falls back when the server answers 207 with nothing usable", async () => {
		// Stalling forever on an empty delta would be worse than one extra listing.
		const { requestFn } = recorder([
			() => response(207, `<d:multistatus xmlns:d="DAV:"></d:multistatus>`),
			() => response(207, MULTISTATUS_ETAGS),
		]);
		const result = await makeClient(requestFn).syncCollection(
			"https://cloud.example.com/cal/tasks/"
		);
		expect(result.usedFallback).toBe(true);
	});
});

describe("putResource", () => {
	it("sends If-Match with the stored ETag and returns the new one", async () => {
		const { calls, requestFn } = recorder([() => response(204, "", { etag: '"e3"' })]);
		const result = await makeClient(requestFn).putResource(
			"https://cloud.example.com/cal/tasks/1.ics",
			"BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
			{ ifMatch: "e2" }
		);

		expect(calls[0].method).toBe("PUT");
		expect(calls[0].headers?.["If-Match"]).toBe('"e2"');
		expect(calls[0].headers?.["Content-Type"]).toContain("text/calendar");
		expect(result).toEqual({ etag: "e3", conflict: false });
	});

	it("reports a 412 as a conflict rather than throwing", async () => {
		// This is the detection half of the conflict rule.
		const { requestFn } = recorder([() => response(412)]);
		const result = await makeClient(requestFn).putResource(
			"https://cloud.example.com/cal/tasks/1.ics",
			"body",
			{ ifMatch: "stale" }
		);
		expect(result.conflict).toBe(true);
		expect(result.etag).toBeUndefined();
	});

	it("uses If-None-Match on a first push so an existing resource is not clobbered", async () => {
		const { calls, requestFn } = recorder([() => response(201, "", { ETag: "W/\"new\"" })]);
		const result = await makeClient(requestFn).putResource(
			"https://cloud.example.com/cal/tasks/new.ics",
			"body",
			{ ifNoneMatch: "*" }
		);

		expect(calls[0].headers?.["If-None-Match"]).toBe("*");
		expect(calls[0].headers?.["If-Match"]).toBeUndefined();
		// Weak validator and quotes are stripped so it compares equal later.
		expect(result.etag).toBe("new");
	});

	it("reads the ETag header case-insensitively", async () => {
		const { requestFn } = recorder([() => response(204, "", { ETAG: '"shouty"' })]);
		const result = await makeClient(requestFn).putResource(
			"https://cloud.example.com/cal/tasks/1.ics",
			"body"
		);
		expect(result.etag).toBe("shouty");
	});
});

describe("deleteResource", () => {
	it("deletes with If-Match", async () => {
		const { calls, requestFn } = recorder([() => response(204)]);
		const result = await makeClient(requestFn).deleteResource(
			"https://cloud.example.com/cal/tasks/1.ics",
			{ ifMatch: "e1" }
		);

		expect(calls[0].method).toBe("DELETE");
		expect(calls[0].headers?.["If-Match"]).toBe('"e1"');
		expect(result).toEqual({ deleted: true, conflict: false });
	});

	it("treats an already-missing resource as a non-error", async () => {
		const { requestFn } = recorder([() => response(404)]);
		expect(
			await makeClient(requestFn).deleteResource("https://cloud.example.com/cal/tasks/1.ics")
		).toEqual({ deleted: false, conflict: false });
	});

	it("reports a 412 as a conflict", async () => {
		const { requestFn } = recorder([() => response(412)]);
		expect(
			await makeClient(requestFn).deleteResource(
				"https://cloud.example.com/cal/tasks/1.ics",
				{ ifMatch: "stale" }
			)
		).toEqual({ deleted: false, conflict: true });
	});
});

describe("getResource", () => {
	it("returns the body and ETag", async () => {
		const { requestFn } = recorder([
			() => response(200, "BEGIN:VCALENDAR", { etag: '"e9"' }),
		]);
		const result = await makeClient(requestFn).getResource(
			"https://cloud.example.com/cal/tasks/1.ics"
		);
		expect(result).toMatchObject({ etag: "e9", data: "BEGIN:VCALENDAR" });
	});

	it("returns null when the resource is gone", async () => {
		const { requestFn } = recorder([() => response(404)]);
		expect(
			await makeClient(requestFn).getResource("https://cloud.example.com/cal/tasks/1.ics")
		).toBeNull();
	});
});

describe("error handling", () => {
	it("classifies 401 as an auth error", async () => {
		const { requestFn } = recorder([() => response(401)]);
		await expect(
			makeClient(requestFn).getResource("https://cloud.example.com/cal/tasks/1.ics")
		).rejects.toMatchObject({ kind: "auth", status: 401 });
	});

	it("classifies 500 as a server error after exhausting retries", async () => {
		const { calls, requestFn } = recorder([() => response(500)]);
		await expect(
			makeClient(requestFn).getResource("https://cloud.example.com/cal/tasks/1.ics")
		).rejects.toMatchObject({ kind: "server" });
		expect(calls).toHaveLength(4); // initial attempt plus three retries
	});

	it("retries a 429 and succeeds", async () => {
		let attempts = 0;
		const requestFn: CalDavRequestFn = async () => {
			attempts++;
			return attempts < 3 ? response(429) : response(200, "ok", { etag: '"e"' });
		};
		const result = await makeClient(requestFn).getResource(
			"https://cloud.example.com/cal/tasks/1.ics"
		);
		expect(attempts).toBe(3);
		expect(result?.data).toBe("ok");
	});

	it("does not retry a 404", async () => {
		const { calls, requestFn } = recorder([() => response(404)]);
		await makeClient(requestFn).getResource("https://cloud.example.com/cal/tasks/1.ics");
		expect(calls).toHaveLength(1);
	});

	it("wraps a transport failure as a network error", async () => {
		const requestFn: CalDavRequestFn = async () => {
			throw new Error("ENOTFOUND");
		};
		await expect(
			makeClient(requestFn).getResource("https://cloud.example.com/cal/tasks/1.ics")
		).rejects.toMatchObject({ kind: "network" });
	});

	it("does not leak credentials in the error message", async () => {
		const { requestFn } = recorder([() => response(401, "user fabian rejected")]);
		const error = await makeClient(requestFn)
			.getResource("https://cloud.example.com/cal/tasks/1.ics")
			.catch((caught: CalDavError) => caught);

		expect((error as CalDavError).message).not.toContain(credentials.password);
	});
});

describe("discoverCollections", () => {
	const PRINCIPAL = `<d:multistatus xmlns:d="DAV:"><d:response><d:href>/</d:href>
		<d:propstat><d:prop><d:current-user-principal><d:href>/principals/fabian/</d:href>
		</d:current-user-principal></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
	</d:response></d:multistatus>`;

	// What Nextcloud actually answers for a path that has no principal: a 207
	// whose propstat is 404, not an HTTP error.
	const NO_PRINCIPAL = `<d:multistatus xmlns:d="DAV:"><d:response><d:href>/</d:href>
		<d:propstat><d:prop><d:current-user-principal/></d:prop>
		<d:status>HTTP/1.1 404 Not Found</d:status></d:propstat>
	</d:response></d:multistatus>`;

	const HOME_SET = `<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
		<d:response><d:href>/principals/fabian/</d:href><d:propstat><d:prop>
		<cal:calendar-home-set><d:href>/calendars/fabian/</d:href></cal:calendar-home-set>
		</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`;

	const COLLECTIONS = `<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
		<d:response><d:href>/calendars/fabian/tasks/</d:href><d:propstat><d:prop>
			<d:displayname>Tasks</d:displayname>
			<d:resourcetype><d:collection/><cal:calendar/></d:resourcetype>
			<cal:supported-calendar-component-set><cal:comp name="VTODO"/></cal:supported-calendar-component-set>
		</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
		<d:response><d:href>/calendars/fabian/events/</d:href><d:propstat><d:prop>
			<d:displayname>Events</d:displayname>
			<d:resourcetype><d:collection/><cal:calendar/></d:resourcetype>
			<cal:supported-calendar-component-set><cal:comp name="VEVENT"/></cal:supported-calendar-component-set>
		</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
	</d:multistatus>`;

	it("walks the discovery chain and keeps only VTODO collections", async () => {
		const { calls, requestFn } = recorder([
			() => response(207, PRINCIPAL),
			() => response(207, HOME_SET),
			() => response(207, COLLECTIONS),
		]);
		const collections = await makeClient(requestFn).discoverCollections();

		// The configured URL is tried first: it is the one address the user
		// actually vouched for, and it keeps the scheme they chose.
		expect(calls[0].url).toBe("https://cloud.example.com");
		expect(collections).toEqual([
			{
				url: "https://cloud.example.com/calendars/fabian/tasks/",
				displayName: "Tasks",
			},
		]);
	});

	it("climbs to ancestor paths when the configured URL has no principal", async () => {
		// Pasting the files endpoint or a collection URL is common, and the
		// principal usually lives further up the tree.
		const { calls, requestFn } = recorder([
			() => response(207, NO_PRINCIPAL),
			() => response(207, NO_PRINCIPAL),
			() => response(207, PRINCIPAL),
			() => response(207, HOME_SET),
			() => response(207, COLLECTIONS),
		]);
		await makeClient(
			requestFn,
			"https://cloud.example.com/remote.php/dav/files/fabian"
		).discoverCollections();

		expect(calls.slice(0, 3).map((call) => call.url)).toEqual([
			"https://cloud.example.com/remote.php/dav/files/fabian",
			"https://cloud.example.com/remote.php/dav/files/",
			"https://cloud.example.com/remote.php/dav/",
		]);
	});

	it("tries well-known only after every ancestor path", async () => {
		// requestUrl follows redirects with no way to veto a downgrade, and
		// well-known commonly redirects to plain http behind a reverse proxy,
		// so it must be the last place credentials are sent, never the first.
		const { calls, requestFn } = recorder([
			() => response(207, NO_PRINCIPAL),
			() => response(207, NO_PRINCIPAL),
			() => response(207, NO_PRINCIPAL),
			() => response(207, PRINCIPAL),
			() => response(207, HOME_SET),
			() => response(207, COLLECTIONS),
		]);
		await makeClient(requestFn, "https://cloud.example.com/dav/cal/").discoverCollections();

		const probed = calls.map((call) => call.url);
		expect(probed.slice(0, 3)).toEqual([
			"https://cloud.example.com/dav/cal/",
			"https://cloud.example.com/dav/",
			"https://cloud.example.com/",
		]);
		expect(probed[3]).toBe("https://cloud.example.com/.well-known/caldav");
	});

	it("surfaces an auth failure immediately instead of trying other entry points", async () => {
		const { calls, requestFn } = recorder([() => response(401)]);
		await expect(makeClient(requestFn).discoverCollections()).rejects.toMatchObject({
			kind: "auth",
		});
		expect(calls).toHaveLength(1);
	});

	it("falls back to well-known when no ancestor serves a principal", async () => {
		const { calls, requestFn } = recorder([
			() => response(404),
			() => response(207, PRINCIPAL),
			() => response(207, HOME_SET),
			() => response(207, COLLECTIONS),
		]);
		const collections = await makeClient(requestFn).discoverCollections();

		expect(calls[1].url).toBe("https://cloud.example.com/.well-known/caldav");
		expect(collections).toHaveLength(1);
	});
});
