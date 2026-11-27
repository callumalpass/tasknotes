import { TZDateMini } from "@date-fns/tz";
import { calendarDateToInstant } from "@tasknotes/model/calendar";
import { format, parseISO } from "date-fns";

let configuredZone: string | undefined;

export function namedTimeZone(value: unknown): string | undefined {
	if (typeof value !== "string" || !/^[A-Za-z]/.test(value) || value.toLowerCase() === "local") return;
	try {
		return new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions().timeZone;
	} catch {
		return undefined;
	}
}

export function setVaultTimeZone(zone: string | undefined): boolean {
	if (configuredZone === zone) return false;
	configuredZone = zone;
	return true;
}

export function getConfiguredVaultTimeZone(): string | undefined {
	return configuredZone;
}

export function getVaultTimeZone(): string {
	return configuredZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
}

/** A real instant whose local getters and date-fns operations use the vault clock. */
export function vaultDate(instant: Date | number = Date.now()): Date {
	return configuredZone ? new TZDateMini(+instant, configuredZone) : new Date(+instant);
}

const FLOATING_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?)?$/;
const LOCAL_ISO = /^\d{4}-\d{2}-\d{2}(?:$|[T ]\d)(?!.*(?:Z|[+-]\d{2}(?::?\d{2})?)$)/i;

/** Resolve civil fields encoded as UTC using Temporal's compatible rule. */
export function resolveWallTime(wall: Date, zone: string): Date {
	if (!Number.isFinite(wall.getTime())) return wall;
	return new Date(calendarDateToInstant(wall.toISOString().slice(0, -1), zone));
}

/** Date-only and floating strings use the vault zone. Offset strings keep their instant. */
export function parseVaultISO(value: string): Date {
	if (!configuredZone) return parseISO(value);
	if (FLOATING_DATE.test(value)) {
		const wall = parseISO(value.replace(" ", "T") + (value.length === 10 ? "T00:00Z" : "Z"));
		return vaultDate(resolveWallTime(wall, configuredZone));
	}
	if (LOCAL_ISO.test(value)) return new Date(NaN);
	return vaultDate(parseISO(value));
}

/** Civil-date construction with the same overflow behavior as the native constructor. */
export function createVaultDate(
	year: number, month: number, day: number, hour = 0, minute = 0, second = 0
): Date {
	if (!configuredZone) return new Date(year, month, day, hour, minute, second);
	const wall = new Date(Date.UTC(year, month, day, hour, minute, second));
	return vaultDate(resolveWallTime(wall, configuredZone));
}

/** Format an instant as a vault calendar key. */
export function vaultDay(instant?: Date | number): string {
	return format(vaultDate(instant), "yyyy-MM-dd");
}

/** Legacy API date parameters still accept the native Date input syntax. */
export function parseVaultDateOption(value: string): Date {
	if (!configuredZone) return new Date(value);
	if (FLOATING_DATE.test(value) || LOCAL_ISO.test(value)) return parseVaultISO(value);
	return vaultDate(new Date(value));
}
