import type { Server, IncomingMessage, ServerResponse } from "http";
import { Notice, requestUrl, Platform } from "obsidian";
import { randomBytes, createHash } from "crypto";
import TaskNotesPlugin from "../main";
import { OAuthProvider, OAuthTokens, OAuthConnection, OAuthConfig } from "../types";
import { DeviceCodeModal } from "../modals/DeviceCodeModal";
import { OAUTH_CONSTANTS } from "./constants";
import { OAuthError, OAuthNotConfiguredError, TokenExpiredError, NetworkError } from "./errors";

let cachedHttpModule: typeof import("http") | null = null;

function ensureHttpModule(): typeof import("http") {
	if (!Platform.isDesktopApp) {
		throw new Error("OAuth redirect handling is only available on desktop.");
	}

	if (!cachedHttpModule) {
		// Lazy-load the Node http module so mobile builds don't crash at load time
		cachedHttpModule = require("http");
	}

	// TypeScript doesn't know we always set cachedHttpModule in the if block above
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	return cachedHttpModule!;
}

/**
 * OAuthService handles OAuth 2.0 authentication flow with PKCE for Google Calendar and Microsoft Graph.
 *
 * Flow:
 * 1. Generate PKCE code verifier and challenge
 * 2. Start temporary local HTTP server on specified port
 * 3. Open browser to authorization URL with PKCE challenge
 * 4. Receive authorization code via HTTP callback
 * 5. Exchange code for tokens
 * 6. Store encrypted tokens
 * 7. Shut down HTTP server
 */
export class OAuthService {
	private plugin: TaskNotesPlugin;
	private callbackServer: Server | null = null;
	private pendingOAuthState: Map<string, {
		provider: OAuthProvider;
		codeVerifier: string;
		resolve: (code: string) => void;
		reject: (error: Error) => void;
	}> = new Map();

	// Token refresh mutex to prevent race conditions
	// Maps provider to pending refresh promise
	private tokenRefreshPromises: Map<OAuthProvider, Promise<OAuthTokens>> = new Map();

	// OAuth configurations for different providers
	private configs: Record<OAuthProvider, OAuthConfig> = {
		google: {
			provider: "google",
			clientId: "", // Will be set from built-in or plugin settings
			redirectUri: "http://127.0.0.1:8080",
			scope: [
				"https://www.googleapis.com/auth/calendar.readonly",
				"https://www.googleapis.com/auth/calendar.events"
			],
			authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
			tokenEndpoint: "https://oauth2.googleapis.com/token",
			deviceCodeEndpoint: "https://oauth2.googleapis.com/device/code",
			revocationEndpoint: "https://oauth2.googleapis.com/revoke"
		},
		microsoft: {
			provider: "microsoft",
			clientId: "", // Will be set from built-in or plugin settings
			redirectUri: "http://localhost:8080",
			scope: [
				"Calendars.Read",
				"Calendars.ReadWrite",
				"offline_access"
			],
			authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
			tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
			deviceCodeEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/devicecode",
			revocationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/logout"
		}
	};

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
		this.loadClientIds();
	}

	/**
	 * Loads OAuth client IDs
	 * Priority order:
	 * 1. User-configured credentials (for standard OAuth flow with client_secret)
	 * 2. Built-in TaskNotes credentials for Device Flow (public client_id only, no secret)
	 */
	async loadClientIds(): Promise<void> {
		// Google Calendar
		// User credentials take priority (for standard flow)
		if (this.plugin.settings.googleOAuthClientId) {
			this.configs.google.clientId = this.plugin.settings.googleOAuthClientId;
			this.configs.google.clientSecret = this.plugin.settings.googleOAuthClientSecret || "";
		} else {
			// Use built-in client_id for Device Flow (public, no secret)
			this.configs.google.clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
			this.configs.google.clientSecret = undefined; // Device Flow doesn't use secret
		}

		// Microsoft Calendar
		if (this.plugin.settings.microsoftOAuthClientId) {
			this.configs.microsoft.clientId = this.plugin.settings.microsoftOAuthClientId;
			this.configs.microsoft.clientSecret = this.plugin.settings.microsoftOAuthClientSecret || "";
		} else {
			this.configs.microsoft.clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID || "";
			this.configs.microsoft.clientSecret = undefined; // Device Flow doesn't use secret
		}
	}

	/**
	 * Initiates OAuth flow for a provider
	 * Chooses between Device Flow (licensed, easy) or Standard Flow (user credentials)
	 */
	async authenticate(provider: OAuthProvider): Promise<void> {
		const config = this.configs[provider];

		if (!config.clientId) {
			throw new OAuthNotConfiguredError(provider);
		}

		// Determine which flow to use based on the user's selected setup mode
		const useAdvancedSetup = this.plugin.settings.oauthSetupMode === "advanced";

		if (useAdvancedSetup) {
			// Advanced Setup: User provided their own OAuth app credentials - use standard flow
			// Validate that user has actually entered credentials
			const hasCredentials =
				(provider === "google" && this.plugin.settings.googleOAuthClientId) ||
				(provider === "microsoft" && this.plugin.settings.microsoftOAuthClientId);

			if (!hasCredentials) {
				throw new OAuthNotConfiguredError(provider);
			}

			return await this.authenticateStandard(provider);
		} else {
			// Quick Setup: Using built-in TaskNotes client_id - use Device Flow
			// Check license validation
			// TEMPORARILY DISABLED FOR TESTING
			// const hasValidLicense = await this.plugin.licenseService?.canUseBuiltInCredentials();

			// if (!hasValidLicense) {
			// 	throw new OAuthNotConfiguredError(provider);
			// }

			return await this.authenticateDeviceFlow(provider);
		}
	}

	/**
	 * Standard OAuth flow (requires client_id + client_secret)
	 * Used when user provides their own OAuth credentials
	 */
	private async authenticateStandard(provider: OAuthProvider): Promise<void> {
		try {
			const config = this.configs[provider];

			if (!Platform.isDesktopApp) {
				new Notice("OAuth authentication requires the desktop app.");
				throw new Error("OAuth authentication requires the desktop app.");
			}

			if (!config.clientSecret) {
				throw new Error(`${provider} OAuth client secret not configured. Please add both Client ID and Client Secret in settings.`);
			}

			// Generate PKCE code verifier and challenge
			const codeVerifier = this.generateCodeVerifier();
			const codeChallenge = await this.generateCodeChallenge(codeVerifier);
			const state = this.generateState();

			// Find available port
			const port = await this.findAvailablePort(
				OAUTH_CONSTANTS.CALLBACK_PORT_START,
				OAUTH_CONSTANTS.CALLBACK_PORT_END
			);
			await this.startCallbackServer(port);

			// Update redirect URI for this session
			const originalRedirectUri = config.redirectUri;
			config.redirectUri = `http://127.0.0.1:${port}`;

			try {
				// Build authorization URL
				const authUrl = this.buildAuthorizationUrl(config, codeChallenge, state);

				// Store pending state
				this.pendingOAuthState.set(state, {
					provider,
					codeVerifier,
					resolve: () => {}, // Will be set by promise
					reject: () => {}
				});

				new Notice(`Opening browser for ${provider} authorization...`);

				// Open browser to authorization URL
				window.open(authUrl, "_blank");

				// Wait for callback with timeout
				const code = await this.waitForCallback(state, 300000); // 5 minute timeout

				// Exchange code for tokens
				const tokens = await this.exchangeCodeForTokens(config, code, codeVerifier);

				// Store connection
				await this.storeConnection(provider, tokens);

				new Notice(`Successfully connected to ${provider} Calendar!`);
			} finally {
				// Restore original redirect URI
				config.redirectUri = originalRedirectUri;
			}

		} catch (error) {
			console.error(`OAuth authentication failed for ${provider}:`, error);
			new Notice(`Failed to connect to ${provider}: ${error.message}`);
			throw error;
		} finally {
			await this.stopCallbackServer();
		}
	}

	/**
	 * Device Flow OAuth (no client_secret required)
	 * Used when user has valid license for built-in TaskNotes credentials
	 */
	private async authenticateDeviceFlow(provider: OAuthProvider): Promise<void> {
		try {
			const config = this.configs[provider];

			if (!config.deviceCodeEndpoint) {
				throw new Error(`${provider} does not support Device Flow`);
			}

			// Step 1: Request device code
			const deviceResponse = await requestUrl({
				url: config.deviceCodeEndpoint,
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					"Accept": "application/json"
				},
				body: new URLSearchParams({
					client_id: config.clientId,
					scope: config.scope.join(" ")
				}).toString(),
				throw: false
			});

			if (deviceResponse.status !== 200) {
				console.error("Device code request failed:", deviceResponse.status, deviceResponse.text);
				throw new Error(`Failed to request device code: ${deviceResponse.status}`);
			}

			const deviceData = deviceResponse.json;
			const {
				device_code,
				user_code,
				verification_uri,
				verification_uri_complete,
				expires_in,
				interval
			} = deviceData;

			console.log("[OAuth] Device Flow initiated:", {
				userCode: user_code,
				verificationUri: verification_uri,
				expiresIn: expires_in
			});

			// Step 2: Show modal with code and instructions
			let cancelled = false;
			const modal = new DeviceCodeModal(
				this.plugin.app,
				{
					userCode: user_code,
					verificationUrl: verification_uri,
					verificationUrlComplete: verification_uri_complete,
					expiresIn: expires_in || 900 // Default 15 minutes
				},
				() => {
					cancelled = true;
				}
			);
			modal.open();

			// Step 3: Poll for authorization
			try {
				const tokens = await this.pollForDeviceToken(
					config,
					device_code,
					interval || 5,
					() => cancelled
				);

				// Close modal on success
				modal.close();

				// Store connection
				await this.storeConnection(provider, tokens);

				new Notice(`Successfully connected to ${provider} Calendar!`);

			} catch (error) {
				modal.close();
				throw error;
			}

		} catch (error) {
			console.error(`Device Flow authentication failed for ${provider}:`, error);
			new Notice(`Failed to connect to ${provider}: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Polls the token endpoint until user authorizes or timeout
	 */
	private async pollForDeviceToken(
		config: OAuthConfig,
		deviceCode: string,
		interval: number,
		isCancelled: () => boolean
	): Promise<OAuthTokens> {
		const maxAttempts = OAUTH_CONSTANTS.DEVICE_FLOW.MAX_ATTEMPTS;
		let currentInterval = interval;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			// Check if user cancelled
			if (isCancelled()) {
				throw new Error("Authorization cancelled by user");
			}

			// Wait before polling (except first attempt)
			if (attempt > 0) {
				await this.sleep(currentInterval * 1000);
			}

			try {
				const response = await requestUrl({
					url: config.tokenEndpoint,
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
						"Accept": "application/json"
					},
					body: new URLSearchParams({
						client_id: config.clientId,
						device_code: deviceCode,
						grant_type: "urn:ietf:params:oauth:grant-type:device_code"
					}).toString(),
					throw: false
				});

				if (response.status === 200) {
					// Success! Parse and return tokens
					const data = response.json;
					const expiresIn = data.expires_in || 3600;
					const expiresAt = Date.now() + (expiresIn * 1000);

					return {
						accessToken: data.access_token,
						refreshToken: data.refresh_token,
						expiresAt: expiresAt,
						scope: data.scope || config.scope.join(" "),
						tokenType: data.token_type || "Bearer"
					};
				}

				// Handle error responses
				const errorData = response.json;
				const errorCode = errorData.error;

				if (errorCode === "authorization_pending") {
					// User hasn't authorized yet, keep polling
					console.log(`[OAuth] Device Flow: Authorization pending (attempt ${attempt + 1}/${maxAttempts})`);
					continue;
				} else if (errorCode === "slow_down") {
					// Server wants us to slow down
					currentInterval += OAUTH_CONSTANTS.DEVICE_FLOW.SLOW_DOWN_INCREMENT_SECONDS;
					console.log(`[OAuth] Device Flow: Slow down requested, new interval: ${currentInterval}s`);
					continue;
				} else if (errorCode === "expired_token") {
					// Fatal error - code expired, don't retry
					throw new Error("Device code expired. Please try again.");
				} else if (errorCode === "access_denied") {
					// Fatal error - user denied access, don't retry
					throw new Error("Authorization denied by user");
				} else {
					// Other OAuth errors are also fatal
					throw new Error(`Authorization failed: ${errorCode || "unknown error"}`);
				}

			} catch (error) {
				// Check if this is a fatal OAuth error (thrown by us above)
				// These should propagate immediately without retry
				if (error instanceof Error &&
					(error.message.includes("expired") ||
					 error.message.includes("denied") ||
					 error.message.includes("Authorization failed"))) {
					throw error;
				}

				// Network errors can be retried - only throw on last attempt
				if (attempt === maxAttempts - 1) {
					throw error;
				}
				// Otherwise, log and continue polling
				console.error(`[OAuth] Device Flow polling error:`, error);
			}
		}

		throw new Error("Device authorization timed out. Please try again.");
	}

	/**
	 * Sleep helper for async polling
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Finds an available port in the given range
	 */
	private async findAvailablePort(startPort: number, endPort: number): Promise<number> {
		const http = ensureHttpModule();

		for (let port = startPort; port <= endPort; port++) {
			try {
				await new Promise<void>((resolve, reject) => {
					const server = http.createServer();
					server.once("error", reject);
					server.once("listening", () => {
						server.close();
						resolve();
					});
					server.listen(port, "127.0.0.1");
				});
				return port;
			} catch (error) {
				// Port in use, try next one
				continue;
			}
		}

		throw new Error(`No available ports found between ${startPort} and ${endPort}`);
	}

	/**
	 * Generates a random code verifier for PKCE
	 */
	private generateCodeVerifier(): string {
		return randomBytes(32)
			.toString("base64url")
			.replace(/=/g, "")
			.replace(/\+/g, "-")
			.replace(/\//g, "_");
	}

	/**
	 * Generates code challenge from verifier (SHA256)
	 */
	private async generateCodeChallenge(verifier: string): Promise<string> {
		const hash = createHash("sha256").update(verifier).digest();
		return Buffer.from(hash)
			.toString("base64url")
			.replace(/=/g, "")
			.replace(/\+/g, "-")
			.replace(/\//g, "_");
	}

	/**
	 * Generates a random state parameter for CSRF protection
	 */
	private generateState(): string {
		return randomBytes(16).toString("hex");
	}

	/**
	 * Builds the authorization URL with all required parameters
	 */
	private buildAuthorizationUrl(config: OAuthConfig, codeChallenge: string, state: string): string {
		const params = new URLSearchParams({
			client_id: config.clientId,
			redirect_uri: config.redirectUri,
			response_type: "code",
			scope: config.scope.join(" "),
			state: state,
			code_challenge: codeChallenge,
			code_challenge_method: "S256",
			access_type: "offline", // Request refresh token
			prompt: "consent" // Force consent screen to get refresh token
		});

		return `${config.authorizationEndpoint}?${params.toString()}`;
	}

	/**
	 * Starts a temporary HTTP server to receive the OAuth callback
	 */
	private async startCallbackServer(port: number): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.callbackServer) {
				resolve(); // Already running
				return;
			}

			let httpModule: ReturnType<typeof ensureHttpModule>;
			try {
				httpModule = ensureHttpModule();
			} catch (error) {
				reject(error);
				return;
			}

			this.callbackServer = httpModule.createServer((req: IncomingMessage, res: ServerResponse) => {
				this.handleCallback(req, res);
			});

			// Use .once() instead of .on() since we only need to handle the first error
			// This prevents memory leaks from accumulating error listeners
			this.callbackServer.once("error", (error: Error) => {
				console.error("OAuth callback server error:", error);
				reject(error);
			});

			this.callbackServer.listen(port, "127.0.0.1", () => {
				console.log(`OAuth callback server listening on http://127.0.0.1:${port}`);
				resolve();
			});
		});
	}

	/**
	 * Stops the callback HTTP server
	 */
	private async stopCallbackServer(): Promise<void> {
		return new Promise((resolve) => {
			if (!this.callbackServer) {
				resolve();
				return;
			}

			this.callbackServer.close(() => {
				console.log("OAuth callback server stopped");
				this.callbackServer = null;
				resolve();
			});
		});
	}

	/**
	 * Handles incoming HTTP requests to the callback server
	 */
	private handleCallback(req: IncomingMessage, res: ServerResponse): void {
		const url = new URL(req.url || "", `http://${req.headers.host}`);
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");
		const error = url.searchParams.get("error");

		// Send response to browser
		res.writeHead(200, { "Content-Type": "text/html" });

		if (error) {
			res.end(`
				<!DOCTYPE html>
				<html>
					<head><title>OAuth Error</title></head>
					<body>
						<h1>Authorization Failed</h1>
						<p>Error: ${error}</p>
						<p>You can close this window.</p>
					</body>
				</html>
			`);

			const pending = state ? this.pendingOAuthState.get(state) : null;
			if (pending && state) {
				pending.reject(new Error(`OAuth error: ${error}`));
				this.pendingOAuthState.delete(state);
			}
			return;
		}

		if (!code || !state) {
			res.end(`
				<!DOCTYPE html>
				<html>
					<head><title>OAuth Error</title></head>
					<body>
						<h1>Invalid Callback</h1>
						<p>Missing required parameters.</p>
						<p>You can close this window.</p>
					</body>
				</html>
			`);
			return;
		}

		res.end(`
			<!DOCTYPE html>
			<html>
				<head><title>OAuth Success</title></head>
				<body>
					<h1>Authorization Successful!</h1>
					<p>You can close this window and return to Obsidian.</p>
					<script>window.close();</script>
				</body>
			</html>
		`);

		// Resolve the pending promise
		const pending = this.pendingOAuthState.get(state);
		if (pending) {
			pending.resolve(code);
			this.pendingOAuthState.delete(state);
		}
	}

	/**
	 * Waits for the OAuth callback to complete
	 */
	private waitForCallback(state: string, timeout: number): Promise<string> {
		return new Promise((resolve, reject) => {
			const pending = this.pendingOAuthState.get(state);
			if (!pending) {
				reject(new Error("Invalid OAuth state"));
				return;
			}

			// Update the pending state with resolve/reject functions
			pending.resolve = resolve;
			pending.reject = reject;

			// Set timeout
			setTimeout(() => {
				if (this.pendingOAuthState.has(state)) {
					this.pendingOAuthState.delete(state);
					reject(new Error("OAuth timeout - authorization took too long"));
				}
			}, timeout);
		});
	}

	/**
	 * Exchanges authorization code for access and refresh tokens
	 */
	private async exchangeCodeForTokens(
		config: OAuthConfig,
		code: string,
		codeVerifier: string
	): Promise<OAuthTokens> {
		const params = new URLSearchParams({
			client_id: config.clientId,
			client_secret: config.clientSecret || "",
			code: code,
			code_verifier: codeVerifier,
			redirect_uri: config.redirectUri,
			grant_type: "authorization_code"
		});

		try {
			const response = await requestUrl({
				url: config.tokenEndpoint,
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					"Accept": "application/json"
				},
				body: params.toString(),
				throw: false  // Don't throw on error status, let us handle it
			});

			// Check if request failed
			if (response.status !== 200) {
				console.error("Token exchange failed with status:", response.status);
				console.error("Response headers:", response.headers);
				console.error("Response body:", response.text);
				console.error("Response JSON:", response.json);
				throw new Error(`Token exchange failed with status ${response.status}: ${response.text || JSON.stringify(response.json)}`);
			}

			const data = response.json;

			if (!data.access_token) {
				throw new Error("No access token in response");
			}

			const expiresIn = data.expires_in || 3600; // Default to 1 hour
			const expiresAt = Date.now() + (expiresIn * 1000);

			return {
				accessToken: data.access_token,
				refreshToken: data.refresh_token,
				expiresAt: expiresAt,
				scope: data.scope || config.scope.join(" "),
				tokenType: data.token_type || "Bearer"
			};
		} catch (error) {
			console.error("Token exchange error:", error);
			throw new Error(`Failed to exchange code for tokens: ${error.message}`);
		}
	}

	/**
	 * Refreshes an expired access token
	 */
	async refreshToken(provider: OAuthProvider): Promise<OAuthTokens> {
		const connection = await this.getConnection(provider);
		if (!connection) {
			throw new Error(`No ${provider} connection found`);
		}

		if (!connection.tokens.refreshToken) {
			throw new Error(`No refresh token available for ${provider}`);
		}

		const config = this.configs[provider];
		const params = new URLSearchParams({
			client_id: config.clientId,
			client_secret: config.clientSecret || "",
			refresh_token: connection.tokens.refreshToken,
			grant_type: "refresh_token"
		});

		try {
			const response = await requestUrl({
				url: config.tokenEndpoint,
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					"Accept": "application/json"
				},
				body: params.toString()
			});

			const data = response.json;

			if (!data.access_token) {
				throw new Error("No access token in refresh response");
			}

			const expiresIn = data.expires_in || 3600;
			const expiresAt = Date.now() + (expiresIn * 1000);

			const newTokens: OAuthTokens = {
				accessToken: data.access_token,
				refreshToken: data.refresh_token || connection.tokens.refreshToken, // Keep old refresh token if not provided
				expiresAt: expiresAt,
				scope: data.scope || connection.tokens.scope,
				tokenType: data.token_type || "Bearer"
			};

			// Update stored connection
			await this.storeConnection(provider, newTokens, connection.userEmail);

			return newTokens;
		} catch (error) {
			console.error("Token refresh failed:", error);
			throw new Error(`Failed to refresh ${provider} token: ${error.message}`);
		}
	}

	/**
	 * Gets valid access token, refreshing if necessary.
	 * Uses mutex pattern to prevent race conditions when multiple API calls
	 * happen simultaneously with an expired token.
	 */
	async getValidToken(provider: OAuthProvider): Promise<string> {
		const connection = await this.getConnection(provider);
		if (!connection) {
			throw new TokenExpiredError(provider);
		}

		// Check if token is expired or about to expire (5 minute buffer)
		const now = Date.now();
		const bufferMs = OAUTH_CONSTANTS.TOKEN_REFRESH_BUFFER_MS;

		if (connection.tokens.expiresAt - bufferMs < now) {
			// Check if a refresh is already in progress
			const pendingRefresh = this.tokenRefreshPromises.get(provider);
			if (pendingRefresh) {
				console.log(`${provider} token refresh already in progress, waiting...`);
				const newTokens = await pendingRefresh;
				return newTokens.accessToken;
			}

			// Start new refresh and store the promise
			console.log(`${provider} token expired or expiring soon, refreshing...`);
			const refreshPromise = this.refreshToken(provider)
				.finally(() => {
					// Clean up the pending promise when done (success or failure)
					this.tokenRefreshPromises.delete(provider);
				});

			this.tokenRefreshPromises.set(provider, refreshPromise);

			const newTokens = await refreshPromise;
			return newTokens.accessToken;
		}

		return connection.tokens.accessToken;
	}

	/**
	 * Stores OAuth connection (encrypted)
	 */
	private async storeConnection(
		provider: OAuthProvider,
		tokens: OAuthTokens,
		userEmail?: string
	): Promise<void> {
		const connection: OAuthConnection = {
			provider,
			tokens,
			userEmail,
			connectedAt: new Date().toISOString(),
			lastRefreshed: new Date().toISOString()
		};

		// Store in plugin data (Obsidian handles encryption)
		const data = await this.plugin.loadData() || {};
		if (!data.oauthConnections) {
			data.oauthConnections = {};
		}
		data.oauthConnections[provider] = connection;
		await this.plugin.saveData(data);
	}

	/**
	 * Retrieves stored OAuth connection
	 */
	async getConnection(provider: OAuthProvider): Promise<OAuthConnection | null> {
		const data = await this.plugin.loadData();
		return data?.oauthConnections?.[provider] || null;
	}

	/**
	 * Checks if connected to a provider
	 */
	async isConnected(provider: OAuthProvider): Promise<boolean> {
		const connection = await this.getConnection(provider);
		return connection !== null;
	}

	/**
	 * Disconnects from a provider (revokes tokens and removes stored data)
	 */
	async disconnect(provider: OAuthProvider): Promise<void> {
		const connection = await this.getConnection(provider);
		if (!connection) {
			return;
		}

		// Revoke tokens on the OAuth provider's server
		await this.revokeToken(provider, connection.tokens.accessToken);

		// Also revoke refresh token if present (best practice)
		if (connection.tokens.refreshToken) {
			await this.revokeToken(provider, connection.tokens.refreshToken);
		}

		// Remove from local storage
		const data = await this.plugin.loadData() || {};
		if (data.oauthConnections) {
			delete data.oauthConnections[provider];
			await this.plugin.saveData(data);
		}

		new Notice(`Disconnected from ${provider} Calendar`);
	}

	/**
	 * Revokes an OAuth token on the provider's server
	 * Note: Revocation failures are logged but don't prevent local disconnection
	 */
	private async revokeToken(provider: OAuthProvider, token: string): Promise<void> {
		const config = this.configs[provider];

		if (!config.revocationEndpoint) {
			console.warn(`No revocation endpoint configured for ${provider}`);
			return;
		}

		try {
			const response = await requestUrl({
				url: config.revocationEndpoint,
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded"
				},
				body: new URLSearchParams({
					token: token,
					...(config.clientId && { client_id: config.clientId })
				}).toString(),
				throw: false
			});

			if (response.status === 200) {
				console.log(`[OAuth] Successfully revoked token for ${provider}`);
			} else {
				// Token may already be revoked or invalid - this is not critical
				console.warn(`[OAuth] Token revocation returned status ${response.status} for ${provider}`);
			}
		} catch (error) {
			// Don't throw - revocation failure shouldn't prevent disconnection
			console.error(`[OAuth] Failed to revoke token for ${provider}:`, error);
		}
	}

	/**
	 * Cleanup method to be called when plugin unloads
	 * Ensures all resources are properly released to prevent memory leaks
	 */
	async destroy(): Promise<void> {
		// Stop HTTP callback server
		await this.stopCallbackServer();

		// Clear pending OAuth state
		this.pendingOAuthState.clear();

		// Clear token refresh mutex to prevent orphaned promises
		this.tokenRefreshPromises.clear();
	}
}
