/**
 * Fallback resolution for ICS events whose TZID parameter references a
 * timezone that is not defined in the calendar's VTIMEZONE blocks.
 *
 * Microsoft Exchange's "publish to web" calendars emit Windows-style TZIDs
 * (e.g. `W. Europe Standard Time`, `Romance Standard Time`). Exchange only
 * inlines a VTIMEZONE block for *some* of the TZIDs referenced by events —
 * typically just the user's primary zone. Events from invitees in other
 * zones can reference TZIDs that have no accompanying VTIMEZONE, and ical.js
 * silently demotes those to floating time. Calling `toUnixTime()` on a
 * floating ICAL.Time then interprets the wall clock as UTC, which surfaces
 * to the user as a fixed offset equal to their local zone (e.g. +2h in
 * Europe/Amsterdam in summer).
 *
 * The fix here is to (a) map common Windows TZIDs to their IANA equivalents
 * via the well-known CLDR `windowsZones` table, and (b) convert wall time
 * in that IANA zone to a UTC instant using Intl.DateTimeFormat — which is
 * fully populated with IANA tzdata in any modern JS runtime (including
 * Electron/Obsidian).
 */

import ICAL from "ical.js";
import { resolveWallTime } from "./vaultTime";

// CLDR `windowsZones` — Windows TZID to default IANA name.
// Source: https://github.com/unicode-org/cldr/blob/main/common/supplemental/windowsZones.xml
// Last synced: CLDR 46.
export const WINDOWS_TZID_TO_IANA: Readonly<Record<string, string>> = Object.freeze({
	"AUS Central Standard Time": "Australia/Darwin",
	"AUS Eastern Standard Time": "Australia/Sydney",
	"Afghanistan Standard Time": "Asia/Kabul",
	"Alaskan Standard Time": "America/Anchorage",
	"Aleutian Standard Time": "America/Adak",
	"Altai Standard Time": "Asia/Barnaul",
	"Arab Standard Time": "Asia/Riyadh",
	"Arabian Standard Time": "Asia/Dubai",
	"Arabic Standard Time": "Asia/Baghdad",
	"Argentina Standard Time": "America/Buenos_Aires",
	"Astrakhan Standard Time": "Europe/Astrakhan",
	"Atlantic Standard Time": "America/Halifax",
	"Aus Central W. Standard Time": "Australia/Eucla",
	"Azerbaijan Standard Time": "Asia/Baku",
	"Azores Standard Time": "Atlantic/Azores",
	"Bahia Standard Time": "America/Bahia",
	"Bangladesh Standard Time": "Asia/Dhaka",
	"Belarus Standard Time": "Europe/Minsk",
	"Bougainville Standard Time": "Pacific/Bougainville",
	"Canada Central Standard Time": "America/Regina",
	"Cape Verde Standard Time": "Atlantic/Cape_Verde",
	"Caucasus Standard Time": "Asia/Yerevan",
	"Cen. Australia Standard Time": "Australia/Adelaide",
	"Central America Standard Time": "America/Guatemala",
	"Central Asia Standard Time": "Asia/Almaty",
	"Central Brazilian Standard Time": "America/Cuiaba",
	"Central Europe Standard Time": "Europe/Budapest",
	"Central European Standard Time": "Europe/Warsaw",
	"Central Pacific Standard Time": "Pacific/Guadalcanal",
	"Central Standard Time": "America/Chicago",
	"Central Standard Time (Mexico)": "America/Mexico_City",
	"Chatham Islands Standard Time": "Pacific/Chatham",
	"China Standard Time": "Asia/Shanghai",
	"Cuba Standard Time": "America/Havana",
	"Dateline Standard Time": "Etc/GMT+12",
	"E. Africa Standard Time": "Africa/Nairobi",
	"E. Australia Standard Time": "Australia/Brisbane",
	"E. Europe Standard Time": "Europe/Chisinau",
	"E. South America Standard Time": "America/Sao_Paulo",
	"Easter Island Standard Time": "Pacific/Easter",
	"Eastern Standard Time": "America/New_York",
	"Eastern Standard Time (Mexico)": "America/Cancun",
	"Egypt Standard Time": "Africa/Cairo",
	"Ekaterinburg Standard Time": "Asia/Yekaterinburg",
	"FLE Standard Time": "Europe/Kiev",
	"Fiji Standard Time": "Pacific/Fiji",
	"GMT Standard Time": "Europe/London",
	"GTB Standard Time": "Europe/Bucharest",
	"Georgian Standard Time": "Asia/Tbilisi",
	"Greenland Standard Time": "America/Godthab",
	"Greenwich Standard Time": "Atlantic/Reykjavik",
	"Haiti Standard Time": "America/Port-au-Prince",
	"Hawaiian Standard Time": "Pacific/Honolulu",
	"India Standard Time": "Asia/Kolkata",
	"Iran Standard Time": "Asia/Tehran",
	"Israel Standard Time": "Asia/Jerusalem",
	"Jordan Standard Time": "Asia/Amman",
	"Kaliningrad Standard Time": "Europe/Kaliningrad",
	"Korea Standard Time": "Asia/Seoul",
	"Libya Standard Time": "Africa/Tripoli",
	"Line Islands Standard Time": "Pacific/Kiritimati",
	"Lord Howe Standard Time": "Australia/Lord_Howe",
	"Magadan Standard Time": "Asia/Magadan",
	"Magallanes Standard Time": "America/Punta_Arenas",
	"Marquesas Standard Time": "Pacific/Marquesas",
	"Mauritius Standard Time": "Indian/Mauritius",
	"Middle East Standard Time": "Asia/Beirut",
	"Montevideo Standard Time": "America/Montevideo",
	"Morocco Standard Time": "Africa/Casablanca",
	"Mountain Standard Time": "America/Denver",
	"Mountain Standard Time (Mexico)": "America/Chihuahua",
	"Myanmar Standard Time": "Asia/Yangon",
	"N. Central Asia Standard Time": "Asia/Novosibirsk",
	"Namibia Standard Time": "Africa/Windhoek",
	"Nepal Standard Time": "Asia/Katmandu",
	"New Zealand Standard Time": "Pacific/Auckland",
	"Newfoundland Standard Time": "America/St_Johns",
	"Norfolk Standard Time": "Pacific/Norfolk",
	"North Asia East Standard Time": "Asia/Irkutsk",
	"North Asia Standard Time": "Asia/Krasnoyarsk",
	"North Korea Standard Time": "Asia/Pyongyang",
	"Omsk Standard Time": "Asia/Omsk",
	"Pacific SA Standard Time": "America/Santiago",
	"Pacific Standard Time": "America/Los_Angeles",
	"Pacific Standard Time (Mexico)": "America/Tijuana",
	"Pakistan Standard Time": "Asia/Karachi",
	"Paraguay Standard Time": "America/Asuncion",
	"Qyzylorda Standard Time": "Asia/Qyzylorda",
	"Romance Standard Time": "Europe/Paris",
	"Russia Time Zone 10": "Asia/Srednekolymsk",
	"Russia Time Zone 11": "Asia/Kamchatka",
	"Russia Time Zone 3": "Europe/Samara",
	"Russian Standard Time": "Europe/Moscow",
	"SA Eastern Standard Time": "America/Cayenne",
	"SA Pacific Standard Time": "America/Bogota",
	"SA Western Standard Time": "America/La_Paz",
	"SE Asia Standard Time": "Asia/Bangkok",
	"Saint Pierre Standard Time": "America/Miquelon",
	"Sakhalin Standard Time": "Asia/Sakhalin",
	"Samoa Standard Time": "Pacific/Apia",
	"Sao Tome Standard Time": "Africa/Sao_Tome",
	"Saratov Standard Time": "Europe/Saratov",
	"Singapore Standard Time": "Asia/Singapore",
	"South Africa Standard Time": "Africa/Johannesburg",
	"South Sudan Standard Time": "Africa/Juba",
	"Sri Lanka Standard Time": "Asia/Colombo",
	"Sudan Standard Time": "Africa/Khartoum",
	"Syria Standard Time": "Asia/Damascus",
	"Taipei Standard Time": "Asia/Taipei",
	"Tasmania Standard Time": "Australia/Hobart",
	"Tocantins Standard Time": "America/Araguaina",
	"Tokyo Standard Time": "Asia/Tokyo",
	"Tomsk Standard Time": "Asia/Tomsk",
	"Tonga Standard Time": "Pacific/Tongatapu",
	"Transbaikal Standard Time": "Asia/Chita",
	"Turkey Standard Time": "Europe/Istanbul",
	"Turks And Caicos Standard Time": "America/Grand_Turk",
	"US Eastern Standard Time": "America/Indianapolis",
	"US Mountain Standard Time": "America/Phoenix",
	"UTC": "Etc/UTC",
	"UTC+12": "Etc/GMT-12",
	"UTC+13": "Etc/GMT-13",
	"UTC-02": "Etc/GMT+2",
	"UTC-08": "Etc/GMT+8",
	"UTC-09": "Etc/GMT+9",
	"UTC-11": "Etc/GMT+11",
	"Ulaanbaatar Standard Time": "Asia/Ulaanbaatar",
	"Venezuela Standard Time": "America/Caracas",
	"Vladivostok Standard Time": "Asia/Vladivostok",
	"Volgograd Standard Time": "Europe/Volgograd",
	"W. Australia Standard Time": "Australia/Perth",
	"W. Central Africa Standard Time": "Africa/Lagos",
	"W. Europe Standard Time": "Europe/Berlin",
	"W. Mongolia Standard Time": "Asia/Hovd",
	"West Asia Standard Time": "Asia/Tashkent",
	"West Bank Standard Time": "Asia/Hebron",
	"West Pacific Standard Time": "Pacific/Port_Moresby",
	"Yakutsk Standard Time": "Asia/Yakutsk",
});

const intlSupportCache = new Map<string, boolean>();

/**
 * Check whether the JS runtime's Intl implementation recognizes a TZID.
 * Returns true for any IANA name the host's tzdata can resolve. Memoized.
 */
function isIntlKnownZone(tzid: string): boolean {
	const cached = intlSupportCache.get(tzid);
	if (cached !== undefined) return cached;
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: tzid });
		intlSupportCache.set(tzid, true);
		return true;
	} catch {
		intlSupportCache.set(tzid, false);
		return false;
	}
}

/**
 * Resolve a raw TZID parameter value to an IANA name that Intl can handle.
 *
 * Returns:
 *   - the same TZID if it's already a valid IANA name,
 *   - the mapped IANA name if it's a recognized Windows TZID,
 *   - null if it can't be resolved (caller should fall back to existing behavior).
 */
export function resolveTzidToIANA(rawTzid: string | undefined | null): string | null {
	if (!rawTzid) return null;
	const trimmed = rawTzid.trim();
	if (!trimmed) return null;

	// Strip the "(GMT+01:00) ..." prefix some clients prepend.
	const stripped = trimmed.replace(/^\([^)]+\)\s*/u, "").trim();

	if (isIntlKnownZone(stripped)) return stripped;

	const mapped = WINDOWS_TZID_TO_IANA[stripped];
	if (mapped && isIntlKnownZone(mapped)) return mapped;

	return null;
}

/** Resolve an ICS wall time whose source supplies an IANA zone. */
export function wallTimeInZoneToUtcIso(time: ICAL.Time, timeZone: string): string {
	const wall = new Date(0);
	wall.setUTCFullYear(time.year, time.month - 1, time.day);
	wall.setUTCHours(time.hour, time.minute, time.second, 0);
	return resolveWallTime(wall, timeZone).toISOString();
}
