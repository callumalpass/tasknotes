import { requestUrl } from "obsidian";
import TaskNotesPlugin from "../main";

interface LicenseValidationCache {
	key: string;
	valid: boolean;
	validUntil: number;
	meta?: {
		customerEmail?: string;
		expiresAt?: number;
	};
}

/**
 * LicenseService handles validation of Lemon Squeezy license keys
 * for accessing TaskNotes' built-in OAuth credentials.
 */
export class LicenseService {
	private plugin: TaskNotesPlugin;
	private cachedValidation: LicenseValidationCache | null = null;
	private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
	private readonly GRACE_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Validates a license key against Lemon Squeezy API
	 */
	async validateLicense(licenseKey: string): Promise<boolean> {
		if (!licenseKey || !licenseKey.trim()) {
			return false;
		}

		// Check cache first (validate once per day to reduce API calls)
		if (
			this.cachedValidation?.key === licenseKey &&
			Date.now() < this.cachedValidation.validUntil
		) {
			return this.cachedValidation.valid;
		}

		try {
			const response = await requestUrl({
				url: "https://api.lemonsqueezy.com/v1/licenses/validate",
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: `license_key=${encodeURIComponent(licenseKey)}`,
				throw: false,
			});

			if (response.status !== 200) {
				console.error("License validation failed with status:", response.status);
				return this.handleValidationFailure(licenseKey);
			}

			const data = response.json;
			const valid =
				data.valid === true &&
				(data.license_key?.status === "active" || data.license_key?.status === "inactive") &&
				!data.license_key?.disabled;

			// Cache the result
			this.cachedValidation = {
				key: licenseKey,
				valid,
				validUntil: Date.now() + this.CACHE_DURATION,
				meta: {
					customerEmail: data.meta?.customer_email,
					expiresAt: data.license_key?.expires_at
						? new Date(data.license_key.expires_at).getTime()
						: undefined,
				},
			};

			// Save cache to plugin data for persistence
			await this.saveCacheToData();

			return valid;
		} catch (error) {
			console.error("License validation error:", error);
			return this.handleValidationFailure(licenseKey);
		}
	}

	/**
	 * Handle validation failure with grace period
	 */
	private handleValidationFailure(licenseKey: string): boolean {
		// If validation server is down but we have a cached result within grace period, use it
		if (
			this.cachedValidation?.key === licenseKey &&
			Date.now() < this.cachedValidation.validUntil + this.GRACE_PERIOD
		) {
			return this.cachedValidation.valid;
		}

		return false;
	}

	/**
	 * Check if user can use built-in OAuth credentials
	 */
	async canUseBuiltInCredentials(): Promise<boolean> {
		const licenseKey = this.plugin.settings.lemonSqueezyLicenseKey;

		if (!licenseKey || !licenseKey.trim()) {
			return false;
		}

		return await this.validateLicense(licenseKey);
	}

	/**
	 * Get cached license info without making an API call
	 */
	getCachedLicenseInfo(): LicenseValidationCache | null {
		return this.cachedValidation;
	}

	/**
	 * Clear cached validation (useful when user changes license key)
	 */
	clearCache(): void {
		this.cachedValidation = null;
	}

	/**
	 * Load cached validation from plugin data on startup
	 */
	async loadCacheFromData(): Promise<void> {
		const data = await this.plugin.loadData();
		if (data?.licenseValidationCache) {
			this.cachedValidation = data.licenseValidationCache;
		}
	}

	/**
	 * Save cached validation to plugin data
	 */
	private async saveCacheToData(): Promise<void> {
		const data = (await this.plugin.loadData()) || {};
		data.licenseValidationCache = this.cachedValidation;
		await this.plugin.saveData(data);
	}
}
