import { Notice } from "obsidian";

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
			logError?: boolean;
		} = {}
	): Promise<T | undefined> {
		const {
			fallback,
			errorMessage = "An error occurred",
			showNotice = true,
			logError = true,
		} = options;

		try {
			return await operation();
		} catch (error) {
			if (logError) {
				console.error(errorMessage, error);
			}

			if (showNotice) {
				const message = error instanceof Error ? error.message : String(error);
				new Notice(`${errorMessage}: ${message}`);
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
		} = {}
	): Promise<T | undefined> {
		const {
			maxRetries = 3,
			retryDelay = 1000,
			errorMessage = "Operation failed",
			showNotice = true,
		} = options;

		let lastError: Error;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				if (attempt < maxRetries) {
					await new Promise((resolve) => setTimeout(resolve, retryDelay));
					continue;
				}

				// Final attempt failed
				console.error(`${errorMessage} after ${maxRetries + 1} attempts:`, lastError);

				if (showNotice) {
					new Notice(`${errorMessage}: ${lastError.message}`);
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
		} = {}
	): Promise<T | undefined> {
		const { showNotice = true } = options;

		// Check all validations
		for (const validation of validations) {
			if (!validation.condition) {
				if (showNotice) {
					new Notice(validation.message);
				}
				return undefined;
			}
		}

		// All validations passed, execute operation
		return this.execute(operation, options);
	}
}
