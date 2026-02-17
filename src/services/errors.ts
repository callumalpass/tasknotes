/**
 * Custom error classes for TaskNotes services
 * Provides better error context and handling
 */

/**
 * Base error class for all TaskNotes service errors
 */
export class TaskNotesServiceError extends Error {
	constructor(message: string, public readonly code?: string) {
		super(message);
		this.name = 'TaskNotesServiceError';
		// Maintains proper stack trace for where error was thrown
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}

/**
 * OAuth authentication and authorization errors
 */
export class OAuthError extends TaskNotesServiceError {
	constructor(
		message: string,
		public readonly provider: string,
		code?: string
	) {
		super(message, code);
		this.name = 'OAuthError';
	}
}

/**
 * OAuth token has expired and needs refresh
 */
export class TokenExpiredError extends OAuthError {
	constructor(provider: string) {
		super(`${provider} authentication expired. Please reconnect.`, provider, 'TOKEN_EXPIRED');
		this.name = 'TokenExpiredError';
	}
}

/**
 * OAuth token refresh failed with an irrecoverable error.
 * This indicates the refresh token has been revoked, expired, or is otherwise invalid.
 * The user needs to reconnect their account.
 */
export class TokenRefreshError extends OAuthError {
	constructor(
		provider: string,
		public readonly oauthErrorCode?: string,
		public readonly oauthErrorDescription?: string
	) {
		const message = `${provider} connection expired. Please reconnect in Settings > Integrations.`;
		super(message, provider, 'TOKEN_REFRESH_FAILED');
		this.name = 'TokenRefreshError';
	}
}

/**
 * OAuth credentials not configured
 */
export class OAuthNotConfiguredError extends OAuthError {
	constructor(provider: string) {
		super(
			`${provider} OAuth is not configured. Please provide OAuth credentials in settings.`,
			provider,
			'NOT_CONFIGURED'
		);
		this.name = 'OAuthNotConfiguredError';
	}
}

/**
 * Google Calendar API errors
 */
export class GoogleCalendarError extends TaskNotesServiceError {
	constructor(
		message: string,
		public readonly statusCode?: number,
		code?: string
	) {
		super(message, code);
		this.name = 'GoogleCalendarError';
	}
}

/**
 * Calendar event not found
 */
export class EventNotFoundError extends GoogleCalendarError {
	constructor(eventId: string) {
		super(`Calendar event not found: ${eventId}`, 404, 'EVENT_NOT_FOUND');
		this.name = 'EventNotFoundError';
	}
}

/**
 * Calendar not found
 */
export class CalendarNotFoundError extends GoogleCalendarError {
	constructor(calendarId: string) {
		super(`Calendar not found: ${calendarId}`, 404, 'CALENDAR_NOT_FOUND');
		this.name = 'CalendarNotFoundError';
	}
}

/**
 * API rate limit exceeded
 */
export class RateLimitError extends GoogleCalendarError {
	constructor(retryAfter?: number) {
		const message = retryAfter
			? `Rate limit exceeded. Retry after ${retryAfter} seconds.`
			: 'Rate limit exceeded. Please try again later.';
		super(message, 429, 'RATE_LIMIT');
		this.name = 'RateLimitError';
	}
}

/**
 * Network and connectivity errors
 */
export class NetworkError extends TaskNotesServiceError {
	constructor(
		message: string,
		public readonly originalError?: Error
	) {
		super(message, 'NETWORK_ERROR');
		this.name = 'NetworkError';
	}
}

/**
 * Validation errors for invalid input
 */
export class ValidationError extends TaskNotesServiceError {
	constructor(
		message: string,
		public readonly field?: string
	) {
		super(message, 'VALIDATION_ERROR');
		this.name = 'ValidationError';
	}
}

/**
 * Helper to determine if an error is retriable
 */
export function isRetriableError(error: Error): boolean {
	if (error instanceof NetworkError) {
		return true;
	}
	if (error instanceof GoogleCalendarError) {
		// Retry on server errors (5xx) but not client errors (4xx)
		return error.statusCode ? error.statusCode >= 500 : false;
	}
	return false;
}

/**
 * Helper to extract user-friendly error message
 */
export function getUserFriendlyMessage(error: Error): string {
	if (error instanceof TokenRefreshError) {
		return `Your ${error.provider} connection has expired. Please reconnect in Settings > Integrations.`;
	}
	if (error instanceof TokenExpiredError) {
		return `Your ${error.provider} connection has expired. Please reconnect in settings.`;
	}
	if (error instanceof OAuthNotConfiguredError) {
		return `${error.provider} is not set up. Please configure it in settings.`;
	}
	if (error instanceof RateLimitError) {
		return 'Too many requests. Please wait a moment and try again.';
	}
	if (error instanceof EventNotFoundError || error instanceof CalendarNotFoundError) {
		return 'The requested calendar item could not be found. It may have been deleted.';
	}
	if (error instanceof NetworkError) {
		return 'Network error. Please check your internet connection and try again.';
	}
	if (error instanceof ValidationError) {
		return error.message; // Validation messages are already user-friendly
	}

	// Generic fallback
	return error.message || 'An unexpected error occurred.';
}
