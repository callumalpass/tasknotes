/**
 * CalDAV request bodies and `207 Multistatus` parsing (RFC 4791, RFC 6578).
 *
 * Element lookup is by local name rather than prefix. Servers disagree wildly
 * about prefixes — Nextcloud emits `d:`/`cal:`, Radicale `D:`/`C:`, iCloud
 * something else again — and the namespace URIs are what actually matter.
 *
 * Not registered as a pure module: parsing uses `DOMParser`, which is available
 * in every environment Obsidian runs in (desktop, mobile webview, jsdom under
 * jest) but is still a DOM global.
 */

const NS_DAV = "DAV:";
const NS_CALDAV = "urn:ietf:params:xml:ns:caldav";

export interface DavResponse {
	href: string;
	/** Response-level status, present on sync-collection removals (404). */
	status?: number;
	etag?: string;
	calendarData?: string;
	displayName?: string;
	/** Local names inside `<resourcetype>`, e.g. `collection`, `calendar`. */
	resourceTypes: string[];
	/** Local names inside `<supported-calendar-component-set>`, e.g. `VTODO`. */
	supportedComponents: string[];
	currentUserPrincipal?: string;
	calendarHomeSet?: string;
	/** CalendarServer `getctag`, bumped whenever anything in the collection changes. */
	ctag?: string;
	/** Sync token read from `<prop>`, as opposed to the multistatus root. */
	collectionSyncToken?: string;
}

export interface MultistatusResult {
	responses: DavResponse[];
	/** Collection-level sync token, returned by a sync-collection REPORT. */
	syncToken?: string;
}

export interface SyncCollectionChanges {
	syncToken?: string;
	changed: Array<{ href: string; etag?: string }>;
	removed: string[];
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

const XML_HEADER = '<?xml version="1.0" encoding="utf-8" ?>';

/** Step 1 of discovery: who am I? Used with `PROPFIND Depth: 0`. */
export function buildCurrentUserPrincipalRequest(): string {
	return `${XML_HEADER}
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`;
}

/** Step 2: where does this principal keep its calendars? `PROPFIND Depth: 0`. */
export function buildCalendarHomeSetRequest(): string {
	return `${XML_HEADER}
<d:propfind xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:prop><cal:calendar-home-set/></d:prop>
</d:propfind>`;
}

/** Step 3: enumerate collections in the home set. `PROPFIND Depth: 1`. */
export function buildCalendarCollectionsRequest(): string {
	return `${XML_HEADER}
<d:propfind xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:resourcetype/>
    <d:displayname/>
    <d:sync-token/>
    <cal:supported-calendar-component-set/>
  </d:prop>
</d:propfind>`;
}

/** Lists hrefs and ETags of every VTODO in a collection. `PROPFIND Depth: 1`. */
/**
 * Cheap "has anything changed?" probe for a collection. `PROPFIND Depth: 0`.
 *
 * Asks for both tokens because servers vary: Nextcloud/SabreDAV answer with
 * each, older Radicale only with `getctag`.
 */
export function buildCollectionTagRequest(): string {
	return `${XML_HEADER}
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop><cs:getctag/><d:sync-token/></d:prop>
</d:propfind>`;
}

export function buildEtagListRequest(): string {
	return `${XML_HEADER}
<d:propfind xmlns:d="DAV:">
  <d:prop><d:getetag/><d:resourcetype/></d:prop>
</d:propfind>`;
}

/**
 * Fetches every VTODO in a collection, bodies included. `REPORT Depth: 1`.
 * Used for the first sync and as the fallback when sync-collection is absent.
 */
export function buildCalendarQueryVTodoRequest(): string {
	return `${XML_HEADER}
<cal:calendar-query xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <cal:calendar-data/>
  </d:prop>
  <cal:filter>
    <cal:comp-filter name="VCALENDAR">
      <cal:comp-filter name="VTODO"/>
    </cal:comp-filter>
  </cal:filter>
</cal:calendar-query>`;
}

/**
 * Incremental change feed (RFC 6578). An empty token asks for a full listing
 * plus a token to poll with next time.
 */
export function buildSyncCollectionRequest(syncToken?: string): string {
	return `${XML_HEADER}
<d:sync-collection xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:sync-token>${escapeXml(syncToken ?? "")}</d:sync-token>
  <d:sync-level>1</d:sync-level>
  <d:prop>
    <d:getetag/>
    <cal:calendar-data/>
  </d:prop>
</d:sync-collection>`;
}

/** Fetches the bodies of specific hrefs. `REPORT Depth: 1`. */
export function buildMultigetRequest(hrefs: readonly string[]): string {
	const items = hrefs.map((href) => `  <d:href>${escapeXml(href)}</d:href>`).join("\n");
	return `${XML_HEADER}
<cal:calendar-multiget xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <cal:calendar-data/>
  </d:prop>
${items}
</cal:calendar-multiget>`;
}

export function escapeXml(value: string): string {
	return value
		.replace(/&/gu, "&amp;")
		.replace(/</gu, "&lt;")
		.replace(/>/gu, "&gt;")
		.replace(/"/gu, "&quot;")
		.replace(/'/gu, "&apos;");
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export function parseMultistatus(xml: string): MultistatusResult {
	const doc = new DOMParser().parseFromString(xml, "application/xml");

	// A parser error yields a <parsererror> element rather than throwing.
	if (doc.getElementsByTagName("parsererror").length > 0) {
		return { responses: [] };
	}

	const root = doc.documentElement;
	if (!root || localName(root) !== "multistatus") {
		return { responses: [] };
	}

	const responses = childrenByLocalName(root, "response").map(parseResponse);
	const syncToken = directChildText(root, "sync-token");

	return syncToken ? { responses, syncToken } : { responses };
}

/**
 * Interprets a sync-collection result.
 *
 * Removals arrive as a `<response>` carrying a 404 status instead of a
 * propstat, which is how a deletion on the server is distinguished from a
 * resource we simply have not seen.
 */
export function parseSyncCollection(xml: string): SyncCollectionChanges {
	const { responses, syncToken } = parseMultistatus(xml);

	const changed: Array<{ href: string; etag?: string }> = [];
	const removed: string[] = [];

	for (const response of responses) {
		if (!response.href) continue;
		if (response.status === 404 || response.status === 410) {
			removed.push(response.href);
			continue;
		}
		changed.push({ href: response.href, etag: response.etag });
	}

	return syncToken ? { syncToken, changed, removed } : { changed, removed };
}

/** Filters a collections PROPFIND down to those that can hold VTODOs. */
export function selectVTodoCollections(responses: readonly DavResponse[]): DavResponse[] {
	return responses.filter((response) => {
		if (!response.resourceTypes.includes("calendar")) return false;
		// An absent component set means "everything is supported" per RFC 4791.
		if (response.supportedComponents.length === 0) return true;
		return response.supportedComponents.includes("VTODO");
	});
}

function parseResponse(element: Element): DavResponse {
	const response: DavResponse = {
		href: decodeHref(directChildText(element, "href") ?? ""),
		resourceTypes: [],
		supportedComponents: [],
	};

	const responseStatus = parseStatusCode(directChildText(element, "status"));
	if (responseStatus !== undefined) response.status = responseStatus;

	for (const propstat of childrenByLocalName(element, "propstat")) {
		const propstatStatus = parseStatusCode(directChildText(propstat, "status"));
		// Skip 404 propstats: they list properties the server does not have, and
		// reading them would overwrite good values from the 200 propstat.
		if (propstatStatus !== undefined && propstatStatus >= 400) continue;

		for (const prop of childrenByLocalName(propstat, "prop")) {
			readProp(prop, response);
		}
	}

	return response;
}

function readProp(prop: Element, response: DavResponse): void {
	for (const child of elementChildren(prop)) {
		switch (localName(child)) {
			case "getetag":
				response.etag = normalizeEtag(child.textContent ?? undefined);
				break;
			case "calendar-data":
				response.calendarData = child.textContent ?? undefined;
				break;
			case "displayname":
				response.displayName = child.textContent ?? undefined;
				break;
			case "getctag":
				response.ctag = child.textContent?.trim() || undefined;
				break;
			case "sync-token":
				response.collectionSyncToken = child.textContent?.trim() || undefined;
				break;
			case "resourcetype":
				response.resourceTypes = elementChildren(child).map(localName);
				break;
			case "supported-calendar-component-set":
				response.supportedComponents = elementChildren(child)
					.map((comp) => comp.getAttribute("name")?.toUpperCase())
					.filter((name): name is string => Boolean(name));
				break;
			case "current-user-principal":
				response.currentUserPrincipal = decodeHref(
					directChildText(child, "href") ?? ""
				);
				break;
			case "calendar-home-set":
				response.calendarHomeSet = decodeHref(directChildText(child, "href") ?? "");
				break;
			default:
				break;
		}
	}
}

/**
 * ETags are quoted, and a weak validator carries a `W/` prefix. Both are
 * stripped so a stored ETag compares equal to the one echoed back on a PUT.
 */
export function normalizeEtag(etag: string | undefined): string | undefined {
	if (!etag) return undefined;
	const trimmed = etag.trim().replace(/^W\//iu, "");
	const unquoted = trimmed.replace(/^"|"$/gu, "");
	return unquoted || undefined;
}

function parseStatusCode(status: string | undefined): number | undefined {
	if (!status) return undefined;
	const match = /\s(\d{3})\s?/u.exec(status);
	return match ? Number.parseInt(match[1], 10) : undefined;
}

/**
 * Hrefs come percent-encoded. Decoding keeps stored hrefs comparable with the
 * ones the server returns later, but a malformed sequence must not throw.
 */
function decodeHref(href: string): string {
	const trimmed = href.trim();
	try {
		return decodeURIComponent(trimmed);
	} catch {
		return trimmed;
	}
}

/** Local name without the namespace prefix, whatever prefix the server chose. */
function localName(element: Element): string {
	return element.localName || element.nodeName.replace(/^.*:/u, "");
}

function elementChildren(element: Element): Element[] {
	return Array.from(element.children ?? []);
}

function childrenByLocalName(element: Element, name: string): Element[] {
	return elementChildren(element).filter(
		(child) => localName(child).toLowerCase() === name.toLowerCase()
	);
}

function directChildText(element: Element, name: string): string | undefined {
	const match = childrenByLocalName(element, name)[0];
	return match?.textContent ?? undefined;
}

/** Exposed for tests and callers that need the namespace URIs. */
export const CALDAV_NAMESPACES = { dav: NS_DAV, caldav: NS_CALDAV } as const;
