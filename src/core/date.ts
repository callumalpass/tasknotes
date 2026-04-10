import {
	formatDateForStorage as formatDateForStorageFromUtils,
	getCurrentDateString as getCurrentDateStringFromUtils,
	getDatePart as getDatePartFromUtils,
	hasTimeComponent as hasTimeComponentFromUtils,
	isBeforeDateSafe as isBeforeDateSafeFromUtils,
	isSameDateSafe as isSameDateSafeFromUtils,
	parseDateToLocal as parseDateToLocalFromUtils,
	parseDateToUTC as parseDateToUTCFromUtils,
} from "../utils/dateUtils";

export function parseDateToUTC(dateString: string): Date {
	return parseDateToUTCFromUtils(dateString);
}

export function parseDateToLocal(dateString: string): Date {
	return parseDateToLocalFromUtils(dateString);
}

export function formatDateForStorage(date: Date): string {
	return formatDateForStorageFromUtils(date);
}

export function getCurrentDateString(): string {
	return getCurrentDateStringFromUtils();
}

export function validateDateString(date: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		throw new Error(`Invalid date "${date}". Expected YYYY-MM-DD.`);
	}

	parseDateToUTC(date);
	return date;
}

export function hasTimeComponent(dateString: string | undefined): boolean {
	if (!dateString) return false;
	return hasTimeComponentFromUtils(dateString);
}

export function getDatePart(dateString: string): string {
	if (!dateString) return "";
	return getDatePartFromUtils(dateString);
}

function extractValidDatePartOrUndefined(dateString: string | undefined): string | undefined {
	if (!dateString || dateString.trim().length === 0) {
		return undefined;
	}

	try {
		const datePart = getDatePart(dateString.trim());
		return validateDateString(datePart);
	} catch {
		return undefined;
	}
}

export function resolveOperationTargetDate(
	explicitDate: string | undefined,
	scheduled: string | undefined,
	due: string | undefined
): string {
	if (explicitDate) {
		return validateDateString(explicitDate);
	}

	const scheduledDatePart = extractValidDatePartOrUndefined(scheduled);
	if (scheduledDatePart) {
		return scheduledDatePart;
	}

	const dueDatePart = extractValidDatePartOrUndefined(due);
	if (dueDatePart) {
		return dueDatePart;
	}

	return getCurrentDateString();
}

export function isSameDateSafe(date1: string, date2: string): boolean {
	return isSameDateSafeFromUtils(date1, date2);
}

export function isBeforeDateSafe(date1: string, date2: string): boolean {
	return isBeforeDateSafeFromUtils(date1, date2);
}
