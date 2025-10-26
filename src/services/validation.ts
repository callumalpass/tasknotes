/**
 * Input validation helpers for service methods
 */

import { ValidationError } from "./errors";

/**
 * Validates that a string is not empty
 */
export function validateNotEmpty(value: string | undefined | null, fieldName: string): void {
	if (!value || value.trim() === "") {
		throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
	}
}

/**
 * Validates that a value is defined and not null
 */
export function validateRequired<T>(value: T | undefined | null, fieldName: string): asserts value is T {
	if (value === undefined || value === null) {
		throw new ValidationError(`${fieldName} is required`, fieldName);
	}
}

/**
 * Validates calendar ID format (alphanumeric with some special chars)
 */
export function validateCalendarId(calendarId: string): void {
	validateNotEmpty(calendarId, "Calendar ID");

	// Calendar IDs can be:
	// 1. Email format (Google Calendar primary): user@example.com
	// 2. Alphanumeric with dashes/underscores (Google Calendar secondary): abc123_def-456
	// 3. Base64 format (Microsoft Calendar): AQMkADAwATY0MDABLWI5YjQtNWIwMy0wMAItMDAKAEYAAAMK...
	const validPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^[a-zA-Z0-9_-]+$|^[a-zA-Z0-9+/]+=*$/;
	if (!validPattern.test(calendarId)) {
		throw new ValidationError(
			"Invalid calendar ID format. Expected email-like, alphanumeric, or Base64 format.",
			"calendarId"
		);
	}
}

/**
 * Validates event ID format
 */
export function validateEventId(eventId: string): void {
	validateNotEmpty(eventId, "Event ID");

	// Event IDs can be:
	// 1. Alphanumeric with dashes/underscores (Google Calendar): abc123_def-456
	// 2. Base64 format (Microsoft Calendar): AQMkADAwATY0MDABLWI5YjQtNWIwMy0wMAItMDA...
	// Allow Base64 characters (A-Za-z0-9+/=) plus common separators (-_)
	if (!/^[a-zA-Z0-9_+/=-]+$/.test(eventId)) {
		throw new ValidationError(
			"Invalid event ID format. Expected alphanumeric or Base64 format.",
			"eventId"
		);
	}
}

/**
 * Validates date is not in the past (for creating future events)
 */
export function validateFutureDate(date: Date, fieldName: string): void {
	validateRequired(date, fieldName);

	const now = new Date();
	if (date < now) {
		throw new ValidationError(
			`${fieldName} cannot be in the past`,
			fieldName
		);
	}
}

/**
 * Validates date range (end must be after start)
 */
export function validateDateRange(start: Date, end: Date): void {
	validateRequired(start, "Start date");
	validateRequired(end, "End date");

	if (end <= start) {
		throw new ValidationError(
			"End date must be after start date",
			"endDate"
		);
	}
}

/**
 * Validates OAuth provider is supported
 */
export function validateOAuthProvider(provider: string): void {
	const supportedProviders = ["google", "microsoft"];
	if (!supportedProviders.includes(provider)) {
		throw new ValidationError(
			`Unsupported OAuth provider: ${provider}. Supported: ${supportedProviders.join(", ")}`,
			"provider"
		);
	}
}

/**
 * Validates URL format
 */
export function validateUrl(url: string, fieldName: string): void {
	validateNotEmpty(url, fieldName);

	try {
		new URL(url);
	} catch {
		throw new ValidationError(
			`Invalid URL format for ${fieldName}`,
			fieldName
		);
	}
}
