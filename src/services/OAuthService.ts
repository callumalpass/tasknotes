import type { Server, IncomingMessage, ServerResponse } from "http";
import { Notice, requestUrl, Platform } from "obsidian";
import { randomBytes, createHash } from "crypto";
import TaskNotesPlugin from "../main";
import { OAuthProvider, OAuthTokens, OAuthConnection, OAuthConfig } from "../types";
import { OAUTH_CONSTANTS } from "./constants";
import { OAuthNotConfiguredError, TokenExpiredError, TokenRefreshError } from "./errors";

let cachedHttpModule: typeof import("http") | null = null;

function ensureHttpModule(): typeof import("http") {
	if (!Platform.isDesktopApp) {
		throw new Error("OAuth redirect handling is only available on desktop.");
	}

	if (!cachedHttpModule) {
		// Lazy-load the Node http module so mobile builds don't crash at load time
		// eslint-disable-next-line @typescript-eslint/no-require-imports
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
	 * Loads OAuth client IDs and secrets
	 * from user settings.
	 */
	async loadClientIds(): Promise<void> {
		// Google Calendar
		this.configs.google.clientId = this.plugin.settings.googleOAuthClientId || "";
		this.configs.google.clientSecret = this.plugin.settings.googleOAuthClientSecret || "";

		// Microsoft Calendar
		this.configs.microsoft.clientId = this.plugin.settings.microsoftOAuthClientId || "";
		this.configs.microsoft.clientSecret = this.plugin.settings.microsoftOAuthClientSecret || "";
	}

	/**
	 * Initiates OAuth flow for a provider
	 * Uses standard loopback redirect flow with user-provided credentials.
	 */
	async authenticate(provider: OAuthProvider): Promise<void> {
		const config = this.configs[provider];

		if (!config.clientId) {
			throw new OAuthNotConfiguredError(provider);
		}

		const hasCredentials =
			(provider === "google" && this.plugin.settings.googleOAuthClientId) ||
			(provider === "microsoft" && this.plugin.settings.microsoftOAuthClientId);

		if (!hasCredentials) {
			throw new OAuthNotConfiguredError(provider);
		}

		return await this.authenticateStandard(provider);
	}

	/**
	 * Standard OAuth flow with loopback redirect (client_id required, client_secret optional)
	 * Used for desktop applications with PKCE for security
	 */
	private async authenticateStandard(provider: OAuthProvider): Promise<void> {
		try {
			const config = this.configs[provider];

			if (!Platform.isDesktopApp) {
				new Notice("OAuth authentication requires the desktop app.");
				throw new Error("OAuth authentication requires the desktop app.");
			}

			// Note: client_secret is optional for desktop apps using PKCE
			// PKCE (Proof Key for Code Exchange) provides security without requiring a secret

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
		const params: Record<string, string> = {
			client_id: config.clientId,
			code: code,
			code_verifier: codeVerifier,
			redirect_uri: config.redirectUri,
			grant_type: "authorization_code"
		};

		// Only include client_secret if it exists (optional for public clients)
		if (config.clientSecret) {
			params.client_secret = config.clientSecret;
		}

		const urlParams = new URLSearchParams(params);

		try {
			const response = await requestUrl({
				url: config.tokenEndpoint,
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					"Accept": "application/json"
				},
				body: urlParams.toString(),
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
	 * Refreshes an expired access token.
	 *
	 * Handles irrecoverable token errors (HTTP 400/401 with invalid_grant or invalid_client)
	 * by automatically disconnecting the OAuth connection and throwing TokenRefreshError.
	 * This prevents repeated failed refresh attempts and provides actionable guidance to users.
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
		const params: Record<string, string> = {
			client_id: config.clientId,
			refresh_token: connection.tokens.refreshToken,
			grant_type: "refresh_token"
		};

		// Only include client_secret if it exists (optional for public clients)
		if (config.clientSecret) {
			params.client_secret = config.clientSecret;
		}

		const urlParams = new URLSearchParams(params);

		try {
			const response = await requestUrl({
				url: config.tokenEndpoint,
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					"Accept": "application/json"
				},
				body: urlParams.toString(),
				throw: false // Don't throw on error status so we can inspect the response
			});

			// Check for error responses (400, 401, etc.)
			if (response.status !== 200) {
				// Parse OAuth error from response body
				let oauthError: string | undefined;
				let oauthErrorDescription: string | undefined;

				try {
					const errorData = response.json;
					oauthError = errorData?.error;
					oauthErrorDescription = errorData?.error_description;
				} catch {
					// Response body might not be JSON
				}

				console.error("[OAuth] Token refresh failed:", {
					status: response.status,
					error: oauthError,
					description: oauthErrorDescription
				});

				// Check if this is an irrecoverable token error
				// HTTP 400 with invalid_grant: refresh token revoked, expired, or otherwise invalid
				// HTTP 400 with invalid_client: client credentials changed
				// HTTP 401: unauthorized (token invalid)
				const isIrrecoverableError =
					response.status === 401 ||
					(response.status === 400 && (
						oauthError === "invalid_grant" ||
						oauthError === "invalid_client"
					));

				if (isIrrecoverableError) {
					// Auto-disconnect to prevent repeated failures
					// This clears local tokens but doesn't revoke on provider (token is already invalid)
					await this.clearConnection(provider);

					new Notice(`${provider} connection expired. Please reconnect in Settings > Integrations.`);
					throw new TokenRefreshError(provider, oauthError, oauthErrorDescription);
				}

				// For other errors (5xx server errors, network issues), throw generic error
				// These may be transient and worth retrying
				throw new Error(`Token refresh failed with status ${response.status}: ${oauthError || response.text || "Unknown error"}`);
			}

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
			// Re-throw TokenRefreshError as-is (already handled above)
			if (error instanceof TokenRefreshError) {
				throw error;
			}

			console.error("Token refresh failed:", error);
			throw new Error(`Failed to refresh ${provider} token: ${error.message}`);
		}
	}

	/**
	 * Clears a stored OAuth connection without revoking tokens on the provider.
	 * Used when tokens are already invalid (e.g., after refresh failure with invalid_grant).
	 */
	private async clearConnection(provider: OAuthProvider): Promise<void> {
		const data = await this.plugin.loadData() || {};
		if (data.oauthConnections) {
			delete data.oauthConnections[provider];
			await this.plugin.saveData(data);
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
				const newTokens = await pendingRefresh;
				return newTokens.accessToken;
			}

			// Start new refresh and store the promise
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

			// Token revocation completed (status 200 or token already invalid)
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
