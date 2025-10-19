/**
 * Constants for OAuth and Calendar services
 * Centralizes magic numbers and configuration values
 */

// OAuth Service Constants
export const OAUTH_CONSTANTS = {
	/** Time buffer before token expiry to trigger refresh (5 minutes in milliseconds) */
	TOKEN_REFRESH_BUFFER_MS: 5 * 60 * 1000,

	/** Port range for OAuth callback server */
	CALLBACK_PORT_START: 8080,
	CALLBACK_PORT_END: 8090,

	/** Device Flow polling configuration */
	DEVICE_FLOW: {
		/** Maximum polling attempts before timeout */
		MAX_ATTEMPTS: 60,
		/** Default polling interval in seconds */
		DEFAULT_INTERVAL_SECONDS: 5,
		/** Additional delay when server requests slow_down */
		SLOW_DOWN_INCREMENT_SECONDS: 5,
	}
} as const;

// Google Calendar Service Constants
export const GOOGLE_CALENDAR_CONSTANTS = {
	/** Refresh interval for polling calendar events (15 minutes in milliseconds) */
	REFRESH_INTERVAL_MS: 15 * 60 * 1000,

	/** Minimum time between manual refreshes to prevent API abuse (30 seconds) */
	MIN_MANUAL_REFRESH_INTERVAL_MS: 30 * 1000,

	/** Maximum number of events to fetch per API call */
	MAX_RESULTS_PER_REQUEST: 2500,

	/** Calendar view time range */
	VIEW_RANGE: {
		/** Days to look back from today */
		DAYS_BEFORE: 30,
		/** Days to look ahead from today */
		DAYS_AFTER: 90,
	},

	/** Default duration for newly created timed events (1 hour in milliseconds) */
	DEFAULT_EVENT_DURATION_MS: 60 * 60 * 1000,

	/** API rate limiting and retry configuration */
	RATE_LIMIT: {
		/** Maximum number of retry attempts for rate-limited requests */
		MAX_RETRIES: 3,
		/** Initial backoff delay in milliseconds */
		INITIAL_BACKOFF_MS: 1000,
		/** Maximum backoff delay in milliseconds (16 seconds) */
		MAX_BACKOFF_MS: 16000,
		/** Exponential backoff multiplier */
		BACKOFF_MULTIPLIER: 2,
	},
} as const;

// Microsoft Calendar Service Constants
export const MICROSOFT_CALENDAR_CONSTANTS = {
	/** Refresh interval for polling calendar events (15 minutes in milliseconds) */
	REFRESH_INTERVAL_MS: 15 * 60 * 1000,

	/** Minimum time between manual refreshes to prevent API abuse (30 seconds) */
	MIN_MANUAL_REFRESH_INTERVAL_MS: 30 * 1000,

	/** Maximum number of events to fetch per API call */
	MAX_RESULTS_PER_REQUEST: 50,

	/** Calendar view time range */
	VIEW_RANGE: {
		/** Days to look back from today */
		DAYS_BEFORE: 30,
		/** Days to look ahead from today */
		DAYS_AFTER: 90,
	},

	/** Default duration for newly created timed events (1 hour in milliseconds) */
	DEFAULT_EVENT_DURATION_MS: 60 * 60 * 1000,

	/** API rate limiting and retry configuration */
	RATE_LIMIT: {
		/** Maximum number of retry attempts for rate-limited requests */
		MAX_RETRIES: 3,
		/** Initial backoff delay in milliseconds */
		INITIAL_BACKOFF_MS: 1000,
		/** Maximum backoff delay in milliseconds (16 seconds) */
		MAX_BACKOFF_MS: 16000,
		/** Exponential backoff multiplier */
		BACKOFF_MULTIPLIER: 2,
	},
} as const;

// License Service Constants
export const LICENSE_CONSTANTS = {
	/** Duration to cache license validation results (24 hours in milliseconds) */
	CACHE_DURATION_MS: 24 * 60 * 60 * 1000,

	/** Grace period for offline license validation (7 days in milliseconds) */
	GRACE_PERIOD_MS: 7 * 24 * 60 * 60 * 1000,
} as const;

// Time conversion utilities
export const TIME = {
	/** Milliseconds in one second */
	SECOND_MS: 1000,
	/** Milliseconds in one minute */
	MINUTE_MS: 60 * 1000,
	/** Milliseconds in one hour */
	HOUR_MS: 60 * 60 * 1000,
	/** Milliseconds in one day */
	DAY_MS: 24 * 60 * 60 * 1000,
} as const;
