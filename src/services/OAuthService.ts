import { createServer, Server, IncomingMessage, ServerResponse } from "http";
import { Notice, requestUrl } from "obsidian";
import { randomBytes, createHash } from "crypto";
import TaskNotesPlugin from "../main";
import { OAuthProvider, OAuthTokens, OAuthConnection, OAuthConfig } from "../types";

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
			tokenEndpoint: "https://oauth2.googleapis.com/token"
		},
		microsoft: {
			provider: "microsoft",
			clientId: "", // Will be set from built-in or plugin settings
			redirectUri: "http://127.0.0.1:8080",
			scope: [
				"Calendars.Read",
				"Calendars.ReadWrite",
				"offline_access"
			],
			authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
			tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token"
		}
	};

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
		this.loadClientIds();
	}

	private loadClientIds(): void {
		// Priority order for client IDs and secrets:
		// 1. User-configured credentials (allows custom OAuth apps)
		// 2. Built-in TaskNotes credentials (injected at build time)
		// 3. Empty string (will show error on authenticate)

		// Google Calendar
		this.configs.google.clientId =
			this.plugin.settings.googleOAuthClientId ||
			process.env.GOOGLE_OAUTH_CLIENT_ID ||
			"";
		this.configs.google.clientSecret =
			this.plugin.settings.googleOAuthClientSecret ||
			process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
			"";

		// Microsoft Calendar
		this.configs.microsoft.clientId =
			this.plugin.settings.microsoftOAuthClientId ||
			process.env.MICROSOFT_OAUTH_CLIENT_ID ||
			"";
		this.configs.microsoft.clientSecret =
			this.plugin.settings.microsoftOAuthClientSecret ||
			process.env.MICROSOFT_OAUTH_CLIENT_SECRET ||
			"";
	}

	/**
	 * Initiates OAuth flow for a provider
	 */
	async authenticate(provider: OAuthProvider): Promise<void> {
		try {
			const config = this.configs[provider];

			if (!config.clientId) {
				throw new Error(`${provider} OAuth client ID not configured. Please add it in settings.`);
			}

			// Generate PKCE code verifier and challenge
			const codeVerifier = this.generateCodeVerifier();
			const codeChallenge = await this.generateCodeChallenge(codeVerifier);
			const state = this.generateState();

			// Start HTTP server to receive callback
			const port = 8080; // TODO: Make this configurable or find available port
			await this.startCallbackServer(port);

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

		} catch (error) {
			console.error(`OAuth authentication failed for ${provider}:`, error);
			new Notice(`Failed to connect to ${provider}: ${error.message}`);
			throw error;
		} finally {
			await this.stopCallbackServer();
		}
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

			this.callbackServer = createServer((req: IncomingMessage, res: ServerResponse) => {
				this.handleCallback(req, res);
			});

			this.callbackServer.on("error", (error: Error) => {
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
	 * Gets valid access token, refreshing if necessary
	 */
	async getValidToken(provider: OAuthProvider): Promise<string> {
		const connection = await this.getConnection(provider);
		if (!connection) {
			throw new Error(`Not connected to ${provider}`);
		}

		// Check if token is expired or about to expire (5 minute buffer)
		const now = Date.now();
		const bufferMs = 5 * 60 * 1000; // 5 minutes

		if (connection.tokens.expiresAt - bufferMs < now) {
			console.log(`${provider} token expired or expiring soon, refreshing...`);
			const newTokens = await this.refreshToken(provider);
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

		// TODO: Call revocation endpoint to invalidate tokens
		// For now, just remove from storage

		const data = await this.plugin.loadData() || {};
		if (data.oauthConnections) {
			delete data.oauthConnections[provider];
			await this.plugin.saveData(data);
		}

		new Notice(`Disconnected from ${provider} Calendar`);
	}

	/**
	 * Cleanup method to be called when plugin unloads
	 */
	async destroy(): Promise<void> {
		await this.stopCallbackServer();
		this.pendingOAuthState.clear();
	}
}
