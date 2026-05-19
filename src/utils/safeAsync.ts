import { createTaskNotesLogger } from "./tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Utils/SafeAsync" });

type SafeAsyncNoticeHandler = (message: string) => void;

interface SafeAsyncNoticeOptions {
	showNotice?: boolean;
	noticeHandler?: SafeAsyncNoticeHandler;
}

function notifyIfRequested(
	message: string,
	{ showNotice = true, noticeHandler }: SafeAsyncNoticeOptions
): void {
	if (showNotice) {
		noticeHandler?.(message);
	}
}

/**
 * Utility for safe async operations with error boundaries
 */
export class SafeAsync {
	/**
	 * Execute an async operation with error handling and user feedback
	 */
	static async execute<T>(
		operation: () => Promise<T>,
		options: {
			fallback?: T;
			errorMessage?: string;
			showNotice?: boolean;
			noticeHandler?: SafeAsyncNoticeHandler;
			logError?: boolean;
		} = {}
	): Promise<T | undefined> {
		const {
			fallback,
			errorMessage = "An error occurred",
			showNotice = true,
			noticeHandler,
			logError = true,
		} = options;

		try {
			return await operation();
		} catch (error) {
			if (logError) {
				tasknotesLogger.error(errorMessage, {
					category: "provider",
					operation: "execute-safe-operation",
					error: error,
				});
			}

			if (showNotice) {
				const message = error instanceof Error ? error.message : String(error);
				notifyIfRequested(`${errorMessage}: ${message}`, {
					showNotice,
					noticeHandler,
				});
			}

			return fallback;
		}
	}

	/**
	 * Execute an async operation with retry logic
	 */
	static async executeWithRetry<T>(
		operation: () => Promise<T>,
		options: {
			maxRetries?: number;
			retryDelay?: number;
			errorMessage?: string;
			showNotice?: boolean;
			noticeHandler?: SafeAsyncNoticeHandler;
		} = {}
	): Promise<T | undefined> {
		const {
			maxRetries = 3,
			retryDelay = 1000,
			errorMessage = "Operation failed",
			showNotice = true,
			noticeHandler,
		} = options;

		let lastError: Error;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				if (attempt < maxRetries) {
					await new Promise((resolve) => window.setTimeout(resolve, retryDelay));
					continue;
				}

				// Final attempt failed
				tasknotesLogger.error(`${errorMessage} after ${maxRetries + 1} attempts:`, {
					category: "provider",
					operation: "execute-with-retry",
					details: { attempts: maxRetries + 1 },
					error: lastError,
				});

				if (showNotice) {
					notifyIfRequested(`${errorMessage}: ${lastError.message}`, {
						showNotice,
						noticeHandler,
					});
				}

				return undefined;
			}
		}
	}

	/**
	 * Validate input before executing operation
	 */
	static async executeWithValidation<T>(
		operation: () => Promise<T>,
		validations: Array<{ condition: boolean; message: string }>,
		options: {
			errorMessage?: string;
			showNotice?: boolean;
			noticeHandler?: SafeAsyncNoticeHandler;
		} = {}
	): Promise<T | undefined> {
		const { showNotice = true, noticeHandler } = options;

		// Check all validations
		for (const validation of validations) {
			if (!validation.condition) {
				if (showNotice) {
					notifyIfRequested(validation.message, {
						showNotice,
						noticeHandler,
					});
				}
				return undefined;
			}
		}

		// All validations passed, execute operation
		return this.execute(operation, options);
	}
}
