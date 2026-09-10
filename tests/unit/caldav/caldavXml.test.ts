import {
	buildCalendarCollectionsRequest,
	buildCalendarQueryVTodoRequest,
	buildCurrentUserPrincipalRequest,
	buildMultigetRequest,
	buildSyncCollectionRequest,
	escapeXml,
	normalizeEtag,
	parseMultistatus,
	parseSyncCollection,
	selectVTodoCollections,
} from "../../../src/services/caldav/caldavXml";

describe("request bodies", () => {
	it("asks for the current user principal", () => {
		const body = buildCurrentUserPrincipalRequest();
		expect(body).toContain("<d:current-user-principal/>");
		expect(body).toContain('xmlns:d="DAV:"');
	});

	it("asks for the properties needed to pick a VTODO collection", () => {
		const body = buildCalendarCollectionsRequest();
		expect(body).toContain("<cal:supported-calendar-component-set/>");
		expect(body).toContain("<d:resourcetype/>");
		expect(body).toContain("<d:sync-token/>");
	});

	it("filters a calendar-query down to VTODO", () => {
		const body = buildCalendarQueryVTodoRequest();
		expect(body).toContain('<cal:comp-filter name="VCALENDAR">');
		expect(body).toContain('<cal:comp-filter name="VTODO"/>');
	});

	it("sends an empty sync-token on the first pass", () => {
		expect(buildSyncCollectionRequest()).toContain("<d:sync-token></d:sync-token>");
		expect(buildSyncCollectionRequest("http://x/token/42")).toContain(
			"<d:sync-token>http://x/token/42</d:sync-token>"
		);
	});

	it("escapes XML metacharacters in a sync token", () => {
		expect(buildSyncCollectionRequest('a&b<c"')).toContain("a&amp;b&lt;c&quot;");
	});

	it("lists hrefs in a multiget", () => {
		const body = buildMultigetRequest(["/c/1.ics", "/c/2.ics"]);
		expect(body).toContain("<d:href>/c/1.ics</d:href>");
		expect(body).toContain("<d:href>/c/2.ics</d:href>");
	});

	it("escapes an ampersand in an href", () => {
		expect(buildMultigetRequest(["/c/a&b.ics"])).toContain("/c/a&amp;b.ics");
	});

	it("escapes the five XML metacharacters", () => {
		expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;");
	});
});

describe("parseMultistatus", () => {
	const NEXTCLOUD_PREFIXES = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/remote.php/dav/calendars/fabian/tasks/1.ics</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"etag-one"</d:getetag>
        <cal:calendar-data>BEGIN:VCALENDAR
BEGIN:VTODO
UID:task-1
END:VTODO
END:VCALENDAR</cal:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

	// Radicale uses different prefixes and uppercase D:, which must parse the same.
	const RADICALE_PREFIXES = `<?xml version="1.0"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/fabian/tasks/1.ics</D:href>
    <D:propstat>
      <D:prop><D:getetag>"etag-one"</D:getetag></D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

	it("parses hrefs, ETags and calendar data", () => {
		const { responses } = parseMultistatus(NEXTCLOUD_PREFIXES);
		expect(responses).toHaveLength(1);
		expect(responses[0].href).toBe("/remote.php/dav/calendars/fabian/tasks/1.ics");
		expect(responses[0].etag).toBe("etag-one");
		expect(responses[0].calendarData).toContain("UID:task-1");
	});

	it("is indifferent to namespace prefix and case", () => {
		const { responses } = parseMultistatus(RADICALE_PREFIXES);
		expect(responses[0].href).toBe("/fabian/tasks/1.ics");
		expect(responses[0].etag).toBe("etag-one");
	});

	it("percent-decodes hrefs so they compare equal later", () => {
		const xml = `<d:multistatus xmlns:d="DAV:"><d:response>
			<d:href>/cal/My%20Tasks/a%20b.ics</d:href></d:response></d:multistatus>`;
		expect(parseMultistatus(xml).responses[0].href).toBe("/cal/My Tasks/a b.ics");
	});

	it("keeps a malformed percent sequence rather than throwing", () => {
		const xml = `<d:multistatus xmlns:d="DAV:"><d:response>
			<d:href>/cal/100%.ics</d:href></d:response></d:multistatus>`;
		expect(parseMultistatus(xml).responses[0].href).toBe("/cal/100%.ics");
	});

	it("ignores properties reported as 404 in their own propstat", () => {
		const xml = `<d:multistatus xmlns:d="DAV:"><d:response>
			<d:href>/c/1.ics</d:href>
			<d:propstat><d:prop><d:getetag>"good"</d:getetag></d:prop>
				<d:status>HTTP/1.1 200 OK</d:status></d:propstat>
			<d:propstat><d:prop><d:displayname/></d:prop>
				<d:status>HTTP/1.1 404 Not Found</d:status></d:propstat>
		</d:response></d:multistatus>`;
		const response = parseMultistatus(xml).responses[0];
		expect(response.etag).toBe("good");
		expect(response.displayName).toBeUndefined();
	});

	it("returns no responses for malformed XML or a non-multistatus root", () => {
		expect(parseMultistatus("<not-xml").responses).toEqual([]);
		expect(parseMultistatus("<html><body>401</body></html>").responses).toEqual([]);
		expect(parseMultistatus("").responses).toEqual([]);
	});

	it("reads discovery properties", () => {
		const xml = `<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
			<d:response><d:href>/</d:href><d:propstat><d:prop>
				<d:current-user-principal><d:href>/principals/fabian/</d:href></d:current-user-principal>
				<cal:calendar-home-set><d:href>/calendars/fabian/</d:href></cal:calendar-home-set>
			</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
		</d:multistatus>`;
		const response = parseMultistatus(xml).responses[0];
		expect(response.currentUserPrincipal).toBe("/principals/fabian/");
		expect(response.calendarHomeSet).toBe("/calendars/fabian/");
	});
});

describe("normalizeEtag", () => {
	it("strips quotes and weak validators so stored ETags compare equal", () => {
		expect(normalizeEtag('"abc"')).toBe("abc");
		expect(normalizeEtag('W/"abc"')).toBe("abc");
		expect(normalizeEtag("abc")).toBe("abc");
	});

	it("returns undefined for absent or empty ETags", () => {
		expect(normalizeEtag(undefined)).toBeUndefined();
		expect(normalizeEtag('""')).toBeUndefined();
		expect(normalizeEtag("   ")).toBeUndefined();
	});
});

describe("selectVTodoCollections", () => {
	const base = { href: "/c/", resourceTypes: ["collection", "calendar"] };

	it("keeps a collection that advertises VTODO", () => {
		expect(
			selectVTodoCollections([{ ...base, supportedComponents: ["VEVENT", "VTODO"] }])
		).toHaveLength(1);
	});

	it("drops an event-only calendar", () => {
		expect(
			selectVTodoCollections([{ ...base, supportedComponents: ["VEVENT"] }])
		).toHaveLength(0);
	});

	it("keeps a calendar that advertises nothing, per RFC 4791", () => {
		expect(selectVTodoCollections([{ ...base, supportedComponents: [] }])).toHaveLength(1);
	});

	it("drops a plain collection that is not a calendar", () => {
		expect(
			selectVTodoCollections([
				{ href: "/c/", resourceTypes: ["collection"], supportedComponents: ["VTODO"] },
			])
		).toHaveLength(0);
	});
});

describe("parseSyncCollection", () => {
	it("separates changed resources from removed ones", () => {
		const xml = `<d:multistatus xmlns:d="DAV:">
			<d:response>
				<d:href>/c/changed.ics</d:href>
				<d:propstat><d:prop><d:getetag>"new"</d:getetag></d:prop>
					<d:status>HTTP/1.1 200 OK</d:status></d:propstat>
			</d:response>
			<d:response>
				<d:href>/c/gone.ics</d:href>
				<d:status>HTTP/1.1 404 Not Found</d:status>
			</d:response>
			<d:sync-token>http://server/token/99</d:sync-token>
		</d:multistatus>`;

		const result = parseSyncCollection(xml);
		expect(result.changed).toEqual([{ href: "/c/changed.ics", etag: "new" }]);
		expect(result.removed).toEqual(["/c/gone.ics"]);
		expect(result.syncToken).toBe("http://server/token/99");
	});

	it("treats 410 Gone as a removal", () => {
		const xml = `<d:multistatus xmlns:d="DAV:"><d:response>
			<d:href>/c/gone.ics</d:href><d:status>HTTP/1.1 410 Gone</d:status>
		</d:response></d:multistatus>`;
		expect(parseSyncCollection(xml).removed).toEqual(["/c/gone.ics"]);
	});

	it("returns empty change sets for an unusable response", () => {
		const result = parseSyncCollection("<html>500</html>");
		expect(result.changed).toEqual([]);
		expect(result.removed).toEqual([]);
		expect(result.syncToken).toBeUndefined();
	});
});
