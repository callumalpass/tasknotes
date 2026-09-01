/**
 * A VTODO resource, modelled as an ordered list of content lines rather than a
 * decoded object graph.
 *
 * The point is preservation. A VTODO written by Nextcloud Tasks or Apple
 * Reminders carries properties TaskNotes does not model — VALARM blocks,
 * ATTACH, X-APPLE-SORT-ORDER, RELATED-TO chains. Re-serialising from a decoded
 * struct would silently drop all of them, so instead we keep every line we did
 * not deliberately change, and patch only the handful we own.
 *
 * Pure: no Obsidian runtime, no network, no DOM or timer globals.
 */

export interface IcsProperty {
	/** Uppercased property name, e.g. `SUMMARY`. */
	name: string;
	/** Parameters, keyed by uppercased name. */
	params: Record<string, string>;
	/** Raw (still escaped) value text. */
	value: string;
}

/** A nested component such as VALARM, kept verbatim. */
interface NestedComponent {
	kind: "component";
	lines: string[];
}

interface PropertyEntry {
	kind: "property";
	property: IcsProperty;
}

type VTodoEntry = PropertyEntry | NestedComponent;

export interface VTodoDocument {
	/** Everything before `BEGIN:VTODO`, verbatim. */
	prologue: string[];
	entries: VTodoEntry[];
	/** Everything after `END:VTODO`, verbatim. */
	epilogue: string[];
}

const MAX_LINE_OCTETS = 75;

/**
 * Parses an iCalendar object and isolates its first VTODO.
 * Returns null when the payload contains no VTODO (e.g. the server handed back
 * a VEVENT, or an error page).
 */
export function parseVTodoDocument(icsText: string): VTodoDocument | null {
	const lines = unfoldLines(icsText);

	const start = lines.findIndex((line) => line.trim().toUpperCase() === "BEGIN:VTODO");
	if (start === -1) return null;

	const entries: VTodoEntry[] = [];
	let depth = 0;
	let nested: string[] | null = null;
	let index = start + 1;

	for (; index < lines.length; index++) {
		const line = lines[index];
		const upper = line.trim().toUpperCase();

		if (upper === "END:VTODO" && depth === 0) break;

		if (upper.startsWith("BEGIN:")) {
			depth++;
			nested = nested ?? [];
		}

		if (nested) {
			nested.push(line);
			if (upper.startsWith("END:")) {
				depth--;
				if (depth === 0) {
					entries.push({ kind: "component", lines: nested });
					nested = null;
				}
			}
			continue;
		}

		const property = parseContentLine(line);
		if (property) entries.push({ kind: "property", property });
	}

	// An unterminated VTODO means a truncated or malformed response; refusing it
	// is safer than syncing against half an object.
	if (index >= lines.length) return null;

	return {
		prologue: lines.slice(0, start),
		entries,
		epilogue: lines.slice(index + 1),
	};
}

/** Builds a minimal VCALENDAR wrapper around a brand-new VTODO. */
export function createVTodoDocument(): VTodoDocument {
	return {
		prologue: [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//TaskNotes//CalDAV Sync//EN",
			"CALSCALE:GREGORIAN",
		],
		entries: [],
		epilogue: ["END:VCALENDAR"],
	};
}

export function serializeVTodoDocument(doc: VTodoDocument): string {
	const lines: string[] = [
		...doc.prologue,
		"BEGIN:VTODO",
		...doc.entries.flatMap((entry) =>
			entry.kind === "component"
				? entry.lines
				: [serializeContentLine(entry.property)]
		),
		"END:VTODO",
		...doc.epilogue,
	];

	return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function getProperty(doc: VTodoDocument, name: string): IcsProperty | undefined {
	const wanted = name.toUpperCase();
	for (const entry of doc.entries) {
		if (entry.kind === "property" && entry.property.name === wanted) {
			return entry.property;
		}
	}
	return undefined;
}

export function getProperties(doc: VTodoDocument, name: string): IcsProperty[] {
	const wanted = name.toUpperCase();
	return doc.entries
		.filter(
			(entry): entry is PropertyEntry =>
				entry.kind === "property" && entry.property.name === wanted
		)
		.map((entry) => entry.property);
}

/**
 * Sets a property, replacing the first occurrence in place so property order —
 * which some clients rely on for display — survives an edit. Any duplicate
 * occurrences are removed.
 */
export function setProperty(
	doc: VTodoDocument,
	name: string,
	value: string,
	params: Record<string, string> = {}
): void {
	const wanted = name.toUpperCase();
	const property: IcsProperty = { name: wanted, params, value };

	let replaced = false;
	const next: VTodoEntry[] = [];
	for (const entry of doc.entries) {
		if (entry.kind === "property" && entry.property.name === wanted) {
			if (!replaced) {
				next.push({ kind: "property", property });
				replaced = true;
			}
			continue;
		}
		next.push(entry);
	}
	if (!replaced) next.push({ kind: "property", property });

	doc.entries = next;
}

/**
 * Replaces the occurrences of a repeatable property that we own, leaving the
 * rest untouched.
 *
 * `RELATED-TO` is the motivating case: TaskNotes owns the parent and dependency
 * links but must not disturb a `RELTYPE=SIBLING` line some other client wrote.
 * The replacements are placed where the first owned occurrence sat, so ordering
 * stays stable across a round trip.
 */
export function replaceProperties(
	doc: VTodoDocument,
	name: string,
	owns: (property: IcsProperty) => boolean,
	replacements: readonly Omit<IcsProperty, "name">[]
): void {
	const wanted = name.toUpperCase();
	const fresh: VTodoEntry[] = replacements.map((replacement) => ({
		kind: "property",
		property: { name: wanted, params: replacement.params, value: replacement.value },
	}));

	let inserted = false;
	const next: VTodoEntry[] = [];
	for (const entry of doc.entries) {
		if (entry.kind === "property" && entry.property.name === wanted && owns(entry.property)) {
			if (!inserted) {
				next.push(...fresh);
				inserted = true;
			}
			continue;
		}
		next.push(entry);
	}
	if (!inserted) next.push(...fresh);

	doc.entries = next;
}

/** The raw lines of every nested component with the given name, e.g. VALARM. */
export function getComponents(doc: VTodoDocument, name: string): string[][] {
	const begin = `BEGIN:${name.toUpperCase()}`;
	return doc.entries
		.filter((entry): entry is NestedComponent => entry.kind === "component")
		.filter((entry) => entry.lines[0]?.trim().toUpperCase() === begin)
		.map((entry) => [...entry.lines]);
}

/**
 * Replaces the nested components we own, keeping every other one verbatim.
 *
 * Alarms are the case that matters: TaskNotes writes a VALARM per reminder, but
 * an alarm added on someone's phone has to survive the next push, so ownership
 * is decided per component rather than by wiping the list.
 */
export function replaceComponents(
	doc: VTodoDocument,
	name: string,
	owns: (lines: readonly string[]) => boolean,
	replacements: readonly (readonly string[])[]
): void {
	const begin = `BEGIN:${name.toUpperCase()}`;
	const isOwned = (entry: VTodoEntry): boolean =>
		entry.kind === "component" &&
		entry.lines[0]?.trim().toUpperCase() === begin &&
		owns(entry.lines);

	const fresh: VTodoEntry[] = replacements.map((lines) => ({
		kind: "component",
		lines: [...lines],
	}));

	let inserted = false;
	const next: VTodoEntry[] = [];
	for (const entry of doc.entries) {
		if (isOwned(entry)) {
			if (!inserted) {
				next.push(...fresh);
				inserted = true;
			}
			continue;
		}
		next.push(entry);
	}
	if (!inserted) next.push(...fresh);

	doc.entries = next;
}

export function removeProperty(doc: VTodoDocument, name: string): void {
	const wanted = name.toUpperCase();
	doc.entries = doc.entries.filter(
		(entry) => entry.kind === "component" || entry.property.name !== wanted
	);
}

/** Reads a TEXT-typed property with iCalendar escaping removed. */
export function getTextProperty(doc: VTodoDocument, name: string): string | undefined {
	const property = getProperty(doc, name);
	return property ? unescapeText(property.value) : undefined;
}

/** Writes a TEXT-typed property, applying iCalendar escaping. */
export function setTextProperty(
	doc: VTodoDocument,
	name: string,
	value: string,
	params: Record<string, string> = {}
): void {
	setProperty(doc, name, escapeText(value), params);
}

/** Reads a comma-separated TEXT list such as CATEGORIES. */
export function getTextListProperty(doc: VTodoDocument, name: string): string[] {
	const property = getProperty(doc, name);
	if (!property) return [];

	return splitUnescapedCommas(property.value)
		.map((part) => unescapeText(part).trim())
		.filter((part) => part.length > 0);
}

export function setTextListProperty(
	doc: VTodoDocument,
	name: string,
	values: string[]
): void {
	if (values.length === 0) {
		removeProperty(doc, name);
		return;
	}
	setProperty(doc, name, values.map(escapeText).join(","));
}

export function escapeText(text: string): string {
	return text
		.replace(/\\/gu, "\\\\")
		.replace(/;/gu, "\\;")
		.replace(/,/gu, "\\,")
		.replace(/\r\n|\n|\r/gu, "\\n");
}

export function unescapeText(text: string): string {
	let out = "";
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (char !== "\\") {
			out += char;
			continue;
		}
		const next = text[++i];
		if (next === undefined) break;
		if (next === "n" || next === "N") out += "\n";
		else out += next;
	}
	return out;
}

/**
 * Reverses RFC 5545 line folding. Continuation lines begin with a single space
 * or tab, which is removed on join.
 */
export function unfoldLines(icsText: string): string[] {
	const raw = icsText.split(/\r\n|\n|\r/u);
	const unfolded: string[] = [];

	for (const line of raw) {
		if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
			unfolded[unfolded.length - 1] += line.slice(1);
			continue;
		}
		unfolded.push(line);
	}

	// A trailing newline produces a final empty entry that is not a content line.
	while (unfolded.length > 0 && unfolded[unfolded.length - 1].trim() === "") {
		unfolded.pop();
	}

	return unfolded;
}

export function parseContentLine(line: string): IcsProperty | null {
	if (!line.trim()) return null;

	// Walk to the value separator, ignoring any ':' inside a quoted parameter.
	let colon = -1;
	let quoted = false;
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (char === '"') quoted = !quoted;
		else if (char === ":" && !quoted) {
			colon = i;
			break;
		}
	}
	if (colon === -1) return null;

	const head = line.slice(0, colon);
	const value = line.slice(colon + 1);

	const segments = splitUnquoted(head, ";");
	const name = segments.shift()?.trim().toUpperCase();
	if (!name) return null;

	const params: Record<string, string> = {};
	for (const segment of segments) {
		const equals = segment.indexOf("=");
		if (equals === -1) continue;
		const key = segment.slice(0, equals).trim().toUpperCase();
		const paramValue = segment.slice(equals + 1).trim().replace(/^"|"$/gu, "");
		if (key) params[key] = paramValue;
	}

	return { name, params, value };
}

export function serializeContentLine(property: IcsProperty): string {
	const params = Object.entries(property.params)
		.map(([key, value]) => `;${key}=${needsQuoting(value) ? `"${value}"` : value}`)
		.join("");
	return `${property.name}${params}:${property.value}`;
}

/** Folds to 75 octets per RFC 5545, counting UTF-8 bytes rather than characters. */
function foldLine(line: string): string {
	if (octetLength(line) <= MAX_LINE_OCTETS) return line;

	const parts: string[] = [];
	let current = "";
	let currentOctets = 0;
	// The continuation space costs an octet, so subsequent chunks get one less.
	let limit = MAX_LINE_OCTETS;

	for (const char of line) {
		const size = octetLength(char);
		if (currentOctets + size > limit) {
			parts.push(current);
			current = "";
			currentOctets = 0;
			limit = MAX_LINE_OCTETS - 1;
		}
		current += char;
		currentOctets += size;
	}
	if (current) parts.push(current);

	return parts.map((part, index) => (index === 0 ? part : ` ${part}`)).join("\r\n");
}

function octetLength(text: string): number {
	let octets = 0;
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		if (code <= 0x7f) octets += 1;
		else if (code <= 0x7ff) octets += 2;
		else if (code <= 0xffff) octets += 3;
		else octets += 4;
	}
	return octets;
}

function needsQuoting(value: string): boolean {
	return /[;:,]/u.test(value);
}

function splitUnquoted(text: string, separator: string): string[] {
	const parts: string[] = [];
	let current = "";
	let quoted = false;

	for (const char of text) {
		if (char === '"') {
			quoted = !quoted;
			current += char;
			continue;
		}
		if (char === separator && !quoted) {
			parts.push(current);
			current = "";
			continue;
		}
		current += char;
	}
	parts.push(current);
	return parts;
}

function splitUnescapedCommas(text: string): string[] {
	const parts: string[] = [];
	let current = "";

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (char === "\\") {
			current += char + (text[++i] ?? "");
			continue;
		}
		if (char === ",") {
			parts.push(current);
			current = "";
			continue;
		}
		current += char;
	}
	parts.push(current);
	return parts;
}
