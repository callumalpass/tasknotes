# OAuth Calendar Integration - Implementation Plan

## Overview

This document outlines the plan for implementing Solution 1 from issue #801 - full OAuth 2.0 support for Google Calendar and Microsoft Outlook/Office 365 calendar integration in TaskNotes.

## Executive Summary

### Scope
- Add OAuth 2.0 authentication for calendar subscriptions
- Support Google Calendar API with OAuth
- Support Microsoft Graph API (Outlook/Office 365) with OAuth
- Enable both read and write operations (view, create, edit, delete events)
- Maintain backward compatibility with existing ICS subscription system

### Estimated Effort
- **Phase 1 (Core OAuth Infrastructure)**: 3-4 days
- **Phase 2 (Google Calendar Integration)**: 2-3 days
- **Phase 3 (Microsoft Outlook Integration)**: 2-3 days
- **Phase 4 (Event Editing UI)**: 3-4 days
- **Phase 5 (Testing & Documentation)**: 2-3 days
- **Total**: 12-17 days

### Cost Implications

#### Google Calendar
- **API Usage**: $0 (free)
- **OAuth App Verification**:
  - **Sensitive Scope Verification (Calendar scopes)**: $0 (3-5 business days)
  - ✅ **GOOD NEWS**: Google Calendar scopes are classified as **"sensitive"** (NOT "restricted")
  - ✅ **No Security Assessment Required**: Sensitive scopes only require app verification, not the expensive third-party security assessment
  - ⚠️ **Note**: The $15K-$75K annual security assessment is only required for **restricted scopes** (Gmail, Drive, certain Google Fit scopes), which Calendar scopes are NOT

#### Microsoft Outlook/Office 365
- **API Usage**: $0 (free)
- **OAuth App Registration**: $0 (free via Azure portal)
- **No additional verification costs identified**

#### Recommendations
1. ✅ **Both read and write access are cost-free** - No security assessment required for Calendar scopes
2. **Implement full read/write functionality** - No cost barrier to implementing event editing
3. **Complete app verification process** - Simple 3-5 day review process (free)

---

## Architecture Changes

### 1. Type Definitions

#### Extended ICSSubscription Type
```typescript
// src/types.ts
export interface ICSSubscription {
    id: string;
    name: string;

    // Existing fields
    url?: string;
    filePath?: string;
    type: "remote" | "local" | "oauth-google" | "oauth-microsoft";
    color: string;
    enabled: boolean;
    refreshInterval: number;
    lastFetched?: string;
    lastError?: string;

    // NEW: OAuth configuration
    authType?: 'none' | 'oauth2' | 'bearer' | 'basic';
    oauth?: OAuthConfig;
}

export interface OAuthConfig {
    provider: 'google' | 'microsoft';

    // Tokens (encrypted in storage)
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: string; // ISO timestamp

    // Provider-specific config
    calendarId?: string; // For selecting specific calendar
    scope?: string[]; // Requested permissions

    // OAuth flow state
    state?: string; // CSRF protection
    codeVerifier?: string; // PKCE
}

export interface OAuthProvider {
    id: 'google' | 'microsoft';
    name: string;
    authUrl: string;
    tokenUrl: string;
    scopes: {
        readonly: string[];
        readwrite: string[];
    };
    clientId: string; // Configured in settings or hardcoded
    redirectUri: string; // obsidian://tasknotes-oauth
}
```

#### Calendar Event Types
```typescript
export interface CalendarEvent extends ICSEvent {
    // Existing ICSEvent fields
    id: string;
    subscriptionId: string;
    title: string;
    description?: string;
    start: string;
    end?: string;
    location?: string;

    // NEW: OAuth-specific fields
    providerId?: string; // Original ID from Google/Microsoft
    provider?: 'google' | 'microsoft';
    isReadOnly?: boolean; // Can this event be edited?
    attendees?: EventAttendee[];
    recurrence?: RecurrenceRule;
}

export interface EventAttendee {
    email: string;
    name?: string;
    status?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
}

export interface RecurrenceRule {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;
    until?: string;
    count?: number;
}
```

### 2. New Services

#### OAuthService
```typescript
// src/services/OAuthService.ts
export class OAuthService extends EventEmitter {
    private providers: Map<string, OAuthProvider>;
    private pendingAuths: Map<string, {
        provider: OAuthProvider;
        resolve: (token: OAuthConfig) => void;
        reject: (error: Error) => void;
    }>;

    constructor(private plugin: TaskNotesPlugin) {
        super();
        this.initializeProviders();
        this.registerProtocolHandler();
    }

    private initializeProviders(): void {
        this.providers.set('google', {
            id: 'google',
            name: 'Google Calendar',
            authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            scopes: {
                readonly: ['https://www.googleapis.com/auth/calendar.readonly'],
                readwrite: ['https://www.googleapis.com/auth/calendar']
            },
            clientId: this.plugin.settings.googleOAuthClientId || GOOGLE_CLIENT_ID,
            redirectUri: 'obsidian://tasknotes-oauth'
        });

        this.providers.set('microsoft', {
            id: 'microsoft',
            name: 'Microsoft Outlook',
            authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
            tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            scopes: {
                readonly: ['Calendars.Read', 'offline_access'],
                readwrite: ['Calendars.ReadWrite', 'offline_access']
            },
            clientId: this.plugin.settings.microsoftOAuthClientId || MICROSOFT_CLIENT_ID,
            redirectUri: 'obsidian://tasknotes-oauth'
        });
    }

    private registerProtocolHandler(): void {
        this.plugin.registerObsidianProtocolHandler('tasknotes-oauth', async (params) => {
            await this.handleOAuthCallback(params);
        });
    }

    async startAuthFlow(provider: 'google' | 'microsoft', writeAccess: boolean = false): Promise<OAuthConfig> {
        const providerConfig = this.providers.get(provider);
        if (!providerConfig) {
            throw new Error(`Unknown provider: ${provider}`);
        }

        // Generate PKCE challenge
        const codeVerifier = this.generateCodeVerifier();
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);

        // Generate state for CSRF protection
        const state = this.generateState();

        // Build authorization URL
        const scopes = writeAccess ? providerConfig.scopes.readwrite : providerConfig.scopes.readonly;
        const authUrl = new URL(providerConfig.authUrl);
        authUrl.searchParams.set('client_id', providerConfig.clientId);
        authUrl.searchParams.set('redirect_uri', providerConfig.redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', scopes.join(' '));
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        // Store pending auth
        const authPromise = new Promise<OAuthConfig>((resolve, reject) => {
            this.pendingAuths.set(state, {
                provider: providerConfig,
                resolve,
                reject
            });

            // Timeout after 5 minutes
            setTimeout(() => {
                if (this.pendingAuths.has(state)) {
                    this.pendingAuths.delete(state);
                    reject(new Error('OAuth flow timed out'));
                }
            }, 5 * 60 * 1000);
        });

        // Store code verifier for token exchange
        this.plugin.settings.oauthPendingVerifiers = this.plugin.settings.oauthPendingVerifiers || {};
        this.plugin.settings.oauthPendingVerifiers[state] = codeVerifier;
        await this.plugin.saveSettings();

        // Open authorization URL in browser
        window.open(authUrl.toString());

        return authPromise;
    }

    private async handleOAuthCallback(params: Record<string, string>): Promise<void> {
        const { code, state, error } = params;

        if (error) {
            const pending = this.pendingAuths.get(state);
            if (pending) {
                pending.reject(new Error(`OAuth error: ${error}`));
                this.pendingAuths.delete(state);
            }
            return;
        }

        const pending = this.pendingAuths.get(state);
        if (!pending) {
            new Notice('OAuth callback received but no pending authorization found');
            return;
        }

        try {
            // Get code verifier
            const codeVerifier = this.plugin.settings.oauthPendingVerifiers?.[state];
            if (!codeVerifier) {
                throw new Error('Code verifier not found');
            }

            // Exchange code for tokens
            const tokens = await this.exchangeCodeForTokens(
                pending.provider,
                code,
                codeVerifier
            );

            // Create OAuth config
            const oauthConfig: OAuthConfig = {
                provider: pending.provider.id,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                scope: tokens.scope?.split(' ')
            };

            // Resolve promise
            pending.resolve(oauthConfig);
            this.pendingAuths.delete(state);

            // Cleanup
            delete this.plugin.settings.oauthPendingVerifiers[state];
            await this.plugin.saveSettings();

            new Notice(`Successfully authenticated with ${pending.provider.name}`);
        } catch (error) {
            pending.reject(error);
            this.pendingAuths.delete(state);
            new Notice(`OAuth authentication failed: ${error.message}`);
        }
    }

    private async exchangeCodeForTokens(
        provider: OAuthProvider,
        code: string,
        codeVerifier: string
    ): Promise<any> {
        const response = await requestUrl({
            url: provider.tokenUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: provider.clientId,
                code: code,
                redirect_uri: provider.redirectUri,
                grant_type: 'authorization_code',
                code_verifier: codeVerifier
            }).toString()
        });

        if (response.status !== 200) {
            throw new Error(`Token exchange failed: ${response.text}`);
        }

        return response.json;
    }

    async refreshAccessToken(oauth: OAuthConfig): Promise<OAuthConfig> {
        const provider = this.providers.get(oauth.provider);
        if (!provider) {
            throw new Error(`Unknown provider: ${oauth.provider}`);
        }

        const response = await requestUrl({
            url: provider.tokenUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: provider.clientId,
                refresh_token: oauth.refreshToken!,
                grant_type: 'refresh_token'
            }).toString()
        });

        if (response.status !== 200) {
            throw new Error(`Token refresh failed: ${response.text}`);
        }

        const tokens = response.json;

        return {
            ...oauth,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || oauth.refreshToken,
            tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        };
    }

    private generateCodeVerifier(): string {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    private async generateCodeChallenge(verifier: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(hash)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    private generateState(): string {
        return Math.random().toString(36).substring(2, 15) +
               Math.random().toString(36).substring(2, 15);
    }
}
```

#### GoogleCalendarService
```typescript
// src/services/GoogleCalendarService.ts
export class GoogleCalendarService {
    private readonly API_BASE = 'https://www.googleapis.com/calendar/v3';

    constructor(
        private plugin: TaskNotesPlugin,
        private oauthService: OAuthService
    ) {}

    async fetchEvents(
        subscription: ICSSubscription,
        timeMin: Date,
        timeMax: Date
    ): Promise<CalendarEvent[]> {
        if (!subscription.oauth?.accessToken) {
            throw new Error('No OAuth token available');
        }

        // Check if token is expired
        if (this.isTokenExpired(subscription.oauth)) {
            subscription.oauth = await this.oauthService.refreshAccessToken(subscription.oauth);
            await this.plugin.icsSubscriptionService.updateSubscription(subscription.id, {
                oauth: subscription.oauth
            });
        }

        const calendarId = subscription.oauth.calendarId || 'primary';
        const url = `${this.API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;

        const response = await requestUrl({
            url: url,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${subscription.oauth.accessToken}`,
                'Accept': 'application/json'
            },
            contentType: 'application/json',
            body: JSON.stringify({
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
                singleEvents: true,
                orderBy: 'startTime'
            })
        });

        if (response.status !== 200) {
            throw new Error(`Google Calendar API error: ${response.text}`);
        }

        const data = response.json;
        return data.items.map((item: any) => this.convertGoogleEventToCalendarEvent(item, subscription.id));
    }

    async createEvent(subscription: ICSSubscription, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
        if (!subscription.oauth?.accessToken) {
            throw new Error('No OAuth token available');
        }

        if (this.isTokenExpired(subscription.oauth)) {
            subscription.oauth = await this.oauthService.refreshAccessToken(subscription.oauth);
            await this.plugin.icsSubscriptionService.updateSubscription(subscription.id, {
                oauth: subscription.oauth
            });
        }

        const calendarId = subscription.oauth.calendarId || 'primary';
        const url = `${this.API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;

        const googleEvent = this.convertCalendarEventToGoogle(event);

        const response = await requestUrl({
            url: url,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${subscription.oauth.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(googleEvent)
        });

        if (response.status !== 200) {
            throw new Error(`Failed to create event: ${response.text}`);
        }

        return this.convertGoogleEventToCalendarEvent(response.json, subscription.id);
    }

    async updateEvent(subscription: ICSSubscription, event: CalendarEvent): Promise<CalendarEvent> {
        if (!subscription.oauth?.accessToken) {
            throw new Error('No OAuth token available');
        }

        if (this.isTokenExpired(subscription.oauth)) {
            subscription.oauth = await this.oauthService.refreshAccessToken(subscription.oauth);
            await this.plugin.icsSubscriptionService.updateSubscription(subscription.id, {
                oauth: subscription.oauth
            });
        }

        const calendarId = subscription.oauth.calendarId || 'primary';
        const url = `${this.API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${event.providerId}`;

        const googleEvent = this.convertCalendarEventToGoogle(event);

        const response = await requestUrl({
            url: url,
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${subscription.oauth.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(googleEvent)
        });

        if (response.status !== 200) {
            throw new Error(`Failed to update event: ${response.text}`);
        }

        return this.convertGoogleEventToCalendarEvent(response.json, subscription.id);
    }

    async deleteEvent(subscription: ICSSubscription, eventId: string): Promise<void> {
        if (!subscription.oauth?.accessToken) {
            throw new Error('No OAuth token available');
        }

        if (this.isTokenExpired(subscription.oauth)) {
            subscription.oauth = await this.oauthService.refreshAccessToken(subscription.oauth);
            await this.plugin.icsSubscriptionService.updateSubscription(subscription.id, {
                oauth: subscription.oauth
            });
        }

        const calendarId = subscription.oauth.calendarId || 'primary';
        const url = `${this.API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;

        const response = await requestUrl({
            url: url,
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${subscription.oauth.accessToken}`
            }
        });

        if (response.status !== 204 && response.status !== 200) {
            throw new Error(`Failed to delete event: ${response.text}`);
        }
    }

    async listCalendars(oauth: OAuthConfig): Promise<Array<{id: string, name: string}>> {
        if (!oauth.accessToken) {
            throw new Error('No OAuth token available');
        }

        if (this.isTokenExpired(oauth)) {
            oauth = await this.oauthService.refreshAccessToken(oauth);
        }

        const response = await requestUrl({
            url: `${this.API_BASE}/users/me/calendarList`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${oauth.accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (response.status !== 200) {
            throw new Error(`Failed to list calendars: ${response.text}`);
        }

        return response.json.items.map((cal: any) => ({
            id: cal.id,
            name: cal.summary
        }));
    }

    private convertGoogleEventToCalendarEvent(googleEvent: any, subscriptionId: string): CalendarEvent {
        return {
            id: `${subscriptionId}-${googleEvent.id}`,
            providerId: googleEvent.id,
            provider: 'google',
            subscriptionId: subscriptionId,
            title: googleEvent.summary || 'Untitled',
            description: googleEvent.description,
            start: googleEvent.start.dateTime || googleEvent.start.date,
            end: googleEvent.end?.dateTime || googleEvent.end?.date,
            location: googleEvent.location,
            isReadOnly: false,
            attendees: googleEvent.attendees?.map((a: any) => ({
                email: a.email,
                name: a.displayName,
                status: a.responseStatus
            })),
            recurrence: this.parseGoogleRecurrence(googleEvent.recurrence)
        };
    }

    private convertCalendarEventToGoogle(event: Partial<CalendarEvent>): any {
        const googleEvent: any = {
            summary: event.title,
            description: event.description,
            location: event.location,
            start: {},
            end: {}
        };

        // Handle all-day vs timed events
        if (event.start) {
            if (event.start.includes('T')) {
                googleEvent.start.dateTime = event.start;
                googleEvent.end.dateTime = event.end || event.start;
            } else {
                googleEvent.start.date = event.start;
                googleEvent.end.date = event.end || event.start;
            }
        }

        if (event.attendees) {
            googleEvent.attendees = event.attendees.map(a => ({
                email: a.email,
                displayName: a.name
            }));
        }

        return googleEvent;
    }

    private parseGoogleRecurrence(recurrence?: string[]): RecurrenceRule | undefined {
        if (!recurrence || recurrence.length === 0) return undefined;

        // Parse RRULE - simplified version
        const rrule = recurrence[0];
        const match = rrule.match(/FREQ=(\w+)/);
        if (!match) return undefined;

        return {
            frequency: match[1].toLowerCase() as any
        };
    }

    private isTokenExpired(oauth: OAuthConfig): boolean {
        if (!oauth.tokenExpiry) return true;
        return new Date(oauth.tokenExpiry) <= new Date();
    }
}
```

#### MicrosoftCalendarService
```typescript
// src/services/MicrosoftCalendarService.ts
export class MicrosoftCalendarService {
    private readonly API_BASE = 'https://graph.microsoft.com/v1.0';

    constructor(
        private plugin: TaskNotesPlugin,
        private oauthService: OAuthService
    ) {}

    async fetchEvents(
        subscription: ICSSubscription,
        timeMin: Date,
        timeMax: Date
    ): Promise<CalendarEvent[]> {
        if (!subscription.oauth?.accessToken) {
            throw new Error('No OAuth token available');
        }

        if (this.isTokenExpired(subscription.oauth)) {
            subscription.oauth = await this.oauthService.refreshAccessToken(subscription.oauth);
            await this.plugin.icsSubscriptionService.updateSubscription(subscription.id, {
                oauth: subscription.oauth
            });
        }

        const calendarId = subscription.oauth.calendarId || 'calendar';
        const url = `${this.API_BASE}/me/calendars/${calendarId}/events`;

        const params = new URLSearchParams({
            startDateTime: timeMin.toISOString(),
            endDateTime: timeMax.toISOString(),
            $orderby: 'start/dateTime'
        });

        const response = await requestUrl({
            url: `${url}?${params.toString()}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${subscription.oauth.accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (response.status !== 200) {
            throw new Error(`Microsoft Graph API error: ${response.text}`);
        }

        const data = response.json;
        return data.value.map((item: any) =>
            this.convertMicrosoftEventToCalendarEvent(item, subscription.id)
        );
    }

    async createEvent(subscription: ICSSubscription, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
        if (!subscription.oauth?.accessToken) {
            throw new Error('No OAuth token available');
        }

        if (this.isTokenExpired(subscription.oauth)) {
            subscription.oauth = await this.oauthService.refreshAccessToken(subscription.oauth);
            await this.plugin.icsSubscriptionService.updateSubscription(subscription.id, {
                oauth: subscription.oauth
            });
        }

        const calendarId = subscription.oauth.calendarId || 'calendar';
        const url = `${this.API_BASE}/me/calendars/${calendarId}/events`;

        const msEvent = this.convertCalendarEventToMicrosoft(event);

        const response = await requestUrl({
            url: url,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${subscription.oauth.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(msEvent)
        });

        if (response.status !== 201) {
            throw new Error(`Failed to create event: ${response.text}`);
        }

        return this.convertMicrosoftEventToCalendarEvent(response.json, subscription.id);
    }

    async updateEvent(subscription: ICSSubscription, event: CalendarEvent): Promise<CalendarEvent> {
        if (!subscription.oauth?.accessToken) {
            throw new Error('No OAuth token available');
        }

        if (this.isTokenExpired(subscription.oauth)) {
            subscription.oauth = await this.oauthService.refreshAccessToken(subscription.oauth);
            await this.plugin.icsSubscriptionService.updateSubscription(subscription.id, {
                oauth: subscription.oauth
            });
        }

        const url = `${this.API_BASE}/me/events/${event.providerId}`;
        const msEvent = this.convertCalendarEventToMicrosoft(event);

        const response = await requestUrl({
            url: url,
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${subscription.oauth.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(msEvent)
        });

        if (response.status !== 200) {
            throw new Error(`Failed to update event: ${response.text}`);
        }

        return this.convertMicrosoftEventToCalendarEvent(response.json, subscription.id);
    }

    async deleteEvent(subscription: ICSSubscription, eventId: string): Promise<void> {
        if (!subscription.oauth?.accessToken) {
            throw new Error('No OAuth token available');
        }

        if (this.isTokenExpired(subscription.oauth)) {
            subscription.oauth = await this.oauthService.refreshAccessToken(subscription.oauth);
            await this.plugin.icsSubscriptionService.updateSubscription(subscription.id, {
                oauth: subscription.oauth
            });
        }

        const url = `${this.API_BASE}/me/events/${eventId}`;

        const response = await requestUrl({
            url: url,
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${subscription.oauth.accessToken}`
            }
        });

        if (response.status !== 204 && response.status !== 200) {
            throw new Error(`Failed to delete event: ${response.text}`);
        }
    }

    async listCalendars(oauth: OAuthConfig): Promise<Array<{id: string, name: string}>> {
        if (!oauth.accessToken) {
            throw new Error('No OAuth token available');
        }

        if (this.isTokenExpired(oauth)) {
            oauth = await this.oauthService.refreshAccessToken(oauth);
        }

        const response = await requestUrl({
            url: `${this.API_BASE}/me/calendars`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${oauth.accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (response.status !== 200) {
            throw new Error(`Failed to list calendars: ${response.text}`);
        }

        return response.json.value.map((cal: any) => ({
            id: cal.id,
            name: cal.name
        }));
    }

    private convertMicrosoftEventToCalendarEvent(msEvent: any, subscriptionId: string): CalendarEvent {
        return {
            id: `${subscriptionId}-${msEvent.id}`,
            providerId: msEvent.id,
            provider: 'microsoft',
            subscriptionId: subscriptionId,
            title: msEvent.subject || 'Untitled',
            description: msEvent.bodyPreview,
            start: msEvent.start.dateTime,
            end: msEvent.end?.dateTime,
            location: msEvent.location?.displayName,
            isReadOnly: false,
            attendees: msEvent.attendees?.map((a: any) => ({
                email: a.emailAddress.address,
                name: a.emailAddress.name,
                status: a.status.response.toLowerCase()
            }))
        };
    }

    private convertCalendarEventToMicrosoft(event: Partial<CalendarEvent>): any {
        const msEvent: any = {
            subject: event.title,
            body: {
                contentType: 'text',
                content: event.description || ''
            },
            start: {
                dateTime: event.start,
                timeZone: 'UTC'
            },
            end: {
                dateTime: event.end || event.start,
                timeZone: 'UTC'
            }
        };

        if (event.location) {
            msEvent.location = {
                displayName: event.location
            };
        }

        if (event.attendees) {
            msEvent.attendees = event.attendees.map(a => ({
                emailAddress: {
                    address: a.email,
                    name: a.name
                },
                type: 'required'
            }));
        }

        return msEvent;
    }

    private isTokenExpired(oauth: OAuthConfig): boolean {
        if (!oauth.tokenExpiry) return true;
        return new Date(oauth.tokenExpiry) <= new Date();
    }
}
```

### 3. Update ICSSubscriptionService

Extend the existing service to support OAuth subscriptions:

```typescript
// src/services/ICSSubscriptionService.ts - modifications

async fetchSubscription(id: string): Promise<void> {
    const subscription = this.subscriptions.find((sub) => sub.id === id);
    if (!subscription || !subscription.enabled) {
        return;
    }

    try {
        let events: ICSEvent[] = [];

        if (subscription.type === "remote") {
            // Existing ICS remote logic
            const response = await requestUrl({
                url: subscription.url!,
                method: "GET",
                headers: {
                    Accept: "text/calendar,*/*;q=0.1",
                    "Accept-Language": "en-US,en;q=0.9",
                    "User-Agent": "Mozilla/5.0...",
                },
            });
            events = this.parseICS(response.text, subscription.id);

        } else if (subscription.type === "local") {
            // Existing local file logic
            const icsData = await this.readLocalICSFile(subscription.filePath!);
            events = this.parseICS(icsData, subscription.id);

        } else if (subscription.type === "oauth-google") {
            // NEW: Google Calendar OAuth
            const timeMin = new Date();
            const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
            events = await this.plugin.googleCalendarService.fetchEvents(
                subscription,
                timeMin,
                timeMax
            );

        } else if (subscription.type === "oauth-microsoft") {
            // NEW: Microsoft Calendar OAuth
            const timeMin = new Date();
            const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
            events = await this.plugin.microsoftCalendarService.fetchEvents(
                subscription,
                timeMin,
                timeMax
            );

        } else {
            throw new Error("Unknown subscription type");
        }

        // Rest of the existing logic...
        const cache: ICSCache = {
            subscriptionId: id,
            events,
            lastUpdated: new Date().toISOString(),
            expires: new Date(
                Date.now() + subscription.refreshInterval * 60 * 1000
            ).toISOString(),
        };
        this.cache.set(id, cache);

        await this.updateSubscription(id, {
            lastFetched: new Date().toISOString(),
            lastError: undefined,
        });

        this.emit("data-changed");
    } catch (error) {
        // Existing error handling...
    }
}
```

---

## Implementation Phases

### Phase 1: Core OAuth Infrastructure (3-4 days)

#### Tasks
1. **Update type definitions** (4 hours)
   - Add OAuth types to `src/types.ts`
   - Update ICSSubscription interface
   - Add CalendarEvent extensions

2. **Implement OAuthService** (1.5 days)
   - Create `src/services/OAuthService.ts`
   - Implement PKCE flow
   - Add protocol handler registration
   - Build token exchange logic
   - Add token refresh functionality

3. **Add OAuth settings UI** (1 day)
   - Add OAuth provider configuration section
   - Add client ID/secret fields (optional for advanced users)
   - Add "Connect Google Calendar" button
   - Add "Connect Microsoft Outlook" button
   - Show OAuth connection status

4. **Security implementation** (0.5 days)
   - Add token encryption in storage
   - Implement CSRF protection
   - Add secure state management

#### Deliverables
- Working OAuth flow for both providers
- Settings UI for initiating OAuth
- Token storage and refresh mechanism
- Protocol handler for OAuth callbacks

### Phase 2: Google Calendar Integration (2-3 days)

#### Tasks
1. **Implement GoogleCalendarService** (1.5 days)
   - Create `src/services/GoogleCalendarService.ts`
   - Implement event fetching with OAuth
   - Add calendar listing
   - Build event conversion logic

2. **Update ICSSubscriptionService** (0.5 days)
   - Add Google OAuth subscription type handling
   - Integrate with GoogleCalendarService

3. **Add Google-specific UI** (0.5 days)
   - Calendar selection dropdown
   - OAuth scope selection (read vs read/write)
   - Connection status indicators

4. **Testing** (0.5 days)
   - Test OAuth flow
   - Test event fetching
   - Test token refresh
   - Handle error cases

#### Deliverables
- Working Google Calendar read access
- Calendar selection in UI
- Event synchronization
- Error handling and retry logic

### Phase 3: Microsoft Outlook Integration (2-3 days)

#### Tasks
1. **Implement MicrosoftCalendarService** (1.5 days)
   - Create `src/services/MicrosoftCalendarService.ts`
   - Implement event fetching with OAuth
   - Add calendar listing
   - Build event conversion logic

2. **Update ICSSubscriptionService** (0.5 days)
   - Add Microsoft OAuth subscription type handling
   - Integrate with MicrosoftCalendarService

3. **Add Microsoft-specific UI** (0.5 days)
   - Calendar selection dropdown
   - OAuth scope selection
   - Connection status indicators

4. **Testing** (0.5 days)
   - Test OAuth flow
   - Test event fetching
   - Test token refresh
   - Handle error cases

#### Deliverables
- Working Microsoft Calendar read access
- Calendar selection in UI
- Event synchronization
- Error handling and retry logic

### Phase 4: Event Editing Capabilities (3-4 days)

✅ **NOTE**: Write scopes for Google Calendar are "sensitive" (not "restricted"), so no expensive security assessment is required - only standard app verification (free, 3-5 business days)

#### Tasks
1. **Extend calendar services** (1 day)
   - Add createEvent() methods
   - Add updateEvent() methods
   - Add deleteEvent() methods
   - Handle write permissions

2. **Build event editing UI** (1.5 days)
   - Create event editor modal
   - Add form for event details
   - Add time picker
   - Add attendee management
   - Add recurrence editor (optional)

3. **Integrate with existing views** (0.5 days)
   - Add edit buttons to calendar views
   - Add context menu options
   - Add drag-and-drop time updates

4. **Conflict resolution** (0.5 days)
   - Handle edit conflicts
   - Add optimistic updates
   - Implement error rollback

5. **Testing** (0.5 days)
   - Test CRUD operations
   - Test permissions
   - Test error handling
   - Test sync after edits

#### Deliverables
- Event creation UI
- Event editing UI
- Event deletion
- Sync after modifications

### Phase 5: Testing & Documentation (2-3 days)

#### Tasks
1. **Comprehensive testing** (1 day)
   - Unit tests for OAuth service
   - Integration tests for calendar services
   - E2E tests for OAuth flow
   - Error case testing
   - Token expiry testing

2. **Documentation** (1 day)
   - User guide for OAuth setup
   - Google Cloud project setup guide
   - Azure app registration guide
   - Troubleshooting guide
   - Security best practices

3. **Migration guide** (0.5 days)
   - How to migrate from ICS to OAuth
   - Benefits of OAuth vs ICS
   - When to use each approach

4. **Polish & bug fixes** (0.5 days)
   - Address edge cases
   - Improve error messages
   - Add loading states
   - Improve UX

#### Deliverables
- Test coverage >80%
- Complete user documentation
- Migration guides
- Troubleshooting documentation

---

## Settings Updates

### New Settings Fields

```typescript
// src/settings/Settings.ts
export interface TaskNotesSettings {
    // ... existing settings

    // NEW: OAuth Settings
    googleOAuthClientId?: string; // Optional: allow users to use their own OAuth app
    googleOAuthClientSecret?: string;
    microsoftOAuthClientId?: string;
    microsoftOAuthClientSecret?: string;

    // Internal state (not exposed in UI)
    oauthPendingVerifiers?: Record<string, string>; // state -> code_verifier mapping
}
```

### Settings UI Updates

Add new section to integrations tab:

```typescript
// OAuth Provider Configuration
const oauthSection = containerEl.createDiv("tasknotes-settings__section");
oauthSection.createEl("h3", { text: "OAuth Calendar Integration" });

// Google Calendar
new Setting(oauthSection)
    .setName("Connect Google Calendar")
    .setDesc("Authenticate with Google to access private calendars")
    .addButton(button => button
        .setButtonText("Connect Google")
        .onClick(async () => {
            try {
                const oauth = await plugin.oauthService.startAuthFlow('google', false);
                new Notice("Successfully connected to Google Calendar");
                // Prompt to create subscription
                await createOAuthSubscription('google', oauth);
            } catch (error) {
                new Notice(`Failed to connect: ${error.message}`);
            }
        })
    );

// Microsoft Outlook
new Setting(oauthSection)
    .setName("Connect Microsoft Outlook")
    .setDesc("Authenticate with Microsoft to access Outlook calendars")
    .addButton(button => button
        .setButtonText("Connect Outlook")
        .onClick(async () => {
            try {
                const oauth = await plugin.oauthService.startAuthFlow('microsoft', false);
                new Notice("Successfully connected to Microsoft Outlook");
                // Prompt to create subscription
                await createOAuthSubscription('microsoft', oauth);
            } catch (error) {
                new Notice(`Failed to connect: ${error.message}`);
            }
        })
    );

// Advanced: Custom OAuth credentials
new Setting(oauthSection)
    .setName("Advanced: Use custom OAuth credentials")
    .setDesc("Use your own Google/Microsoft OAuth app credentials")
    .addToggle(toggle => toggle
        .setValue(!!plugin.settings.googleOAuthClientId)
        .onChange(async (value) => {
            // Show/hide custom credential fields
        })
    );
```

---

## OAuth Client Setup Requirements

### Google Calendar

#### For Plugin Developer (You)
1. Create Google Cloud Project
2. Enable Google Calendar API
3. Create OAuth 2.0 Client ID (Desktop application)
4. Configure authorized redirect URIs: `obsidian://tasknotes-oauth`
5. Obtain Client ID and Client Secret
6. Embed Client ID in plugin code (or make configurable)
7. **(If using write scopes)** Submit for OAuth app verification
8. **(If using restricted scopes + server)** Complete security assessment ($15K-$75K)

#### For Users (If allowing custom OAuth apps)
1. Users create their own Google Cloud project
2. Enable Google Calendar API
3. Create OAuth 2.0 credentials
4. Copy Client ID into TaskNotes settings
5. Authenticate via OAuth flow

### Microsoft Outlook

#### For Plugin Developer (You)
1. Register app in Azure AD
2. Add Microsoft Graph API permissions: `Calendars.ReadWrite`, `offline_access`
3. Configure redirect URI: `obsidian://tasknotes-oauth`
4. Obtain Application (client) ID
5. Embed Client ID in plugin code (or make configurable)
6. No additional verification required

#### For Users (If allowing custom OAuth apps)
1. Users register app in Azure AD
2. Configure permissions
3. Copy Client ID into TaskNotes settings
4. Authenticate via OAuth flow

---

## Security Considerations

### Token Storage
- Store OAuth tokens encrypted in plugin data
- Use Obsidian's data storage API (already encrypted at rest)
- Never log tokens or include in error messages
- Clear tokens when user disconnects

### CSRF Protection
- Generate random state parameter for each OAuth flow
- Validate state in callback
- Timeout pending auth requests after 5 minutes

### PKCE (Proof Key for Code Exchange)
- Generate code_verifier for each flow
- Create SHA-256 code_challenge
- Store verifier temporarily (encrypted)
- Exchange in token request

### Token Refresh
- Check token expiry before each API call
- Automatically refresh if expired
- Handle refresh token rotation
- Graceful fallback if refresh fails

### Permissions
- Request minimum required scopes
- Start with read-only by default
- Only request write scopes if user enables editing
- Clearly explain what each permission allows

### Error Handling
- Never expose sensitive data in errors
- Provide actionable error messages
- Log security events (failed auth, token issues)
- Implement retry logic with exponential backoff

---

## User Experience Flow

### Initial Setup

1. **User navigates to Settings → Integrations**
2. **Sees OAuth calendar section**
3. **Clicks "Connect Google Calendar" or "Connect Microsoft Outlook"**
4. **OAuth flow starts:**
   - Browser opens with consent screen
   - User signs in to Google/Microsoft
   - User approves permissions
   - Browser redirects to `obsidian://tasknotes-oauth?code=...&state=...`
5. **TaskNotes receives callback:**
   - Validates state
   - Exchanges code for tokens
   - Stores tokens securely
   - Shows success notice
6. **User prompted to create subscription:**
   - Modal opens with calendar selection
   - User selects which calendar to sync
   - User chooses color and refresh interval
   - Subscription created and enabled
7. **Events start syncing automatically**

### Editing Events (Phase 4)

1. **User sees event in calendar view**
2. **Right-clicks event → "Edit event"**
3. **Event editor modal opens:**
   - Pre-filled with current details
   - Editable fields: title, time, description, location
   - Save/Cancel buttons
4. **User makes changes and clicks Save**
5. **TaskNotes:**
   - Updates event via API
   - Shows loading state
   - Updates local cache
   - Refreshes view
   - Shows success notice
6. **If error occurs:**
   - Shows error message
   - Reverts local changes
   - Suggests retry or manual fix

---

## Migration Strategy

### Backward Compatibility

- Keep existing ICS subscription types working
- Don't modify existing ICSSubscription interface (extend it)
- Support mixed subscriptions (ICS + OAuth)
- Allow users to migrate ICS to OAuth gradually

### Migration Path

1. **Detect ICS subscriptions for known OAuth providers:**
   ```typescript
   // Auto-detect Google Calendar ICS URLs
   if (subscription.type === 'remote' && subscription.url?.includes('calendar.google.com')) {
       // Show banner: "This looks like a Google Calendar. Connect via OAuth for better access?"
   }
   ```

2. **Provide migration helper:**
   - "Upgrade to OAuth" button next to ICS subscriptions
   - Guides user through OAuth flow
   - Matches calendar by name
   - Migrates settings (color, refresh interval)
   - Deletes old ICS subscription

3. **Keep ICS for non-OAuth calendars:**
   - iCloud calendars (no OAuth support)
   - Custom calendar servers
   - Public calendars
   - Other third-party calendars

---

## Testing Strategy

### Unit Tests

```typescript
// test/services/OAuthService.test.ts
describe('OAuthService', () => {
    it('should generate valid PKCE challenge', async () => {
        const service = new OAuthService(mockPlugin);
        const verifier = service['generateCodeVerifier']();
        const challenge = await service['generateCodeChallenge'](verifier);

        expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('should handle OAuth callback correctly', async () => {
        const service = new OAuthService(mockPlugin);
        const authPromise = service.startAuthFlow('google', false);

        // Simulate callback
        await service['handleOAuthCallback']({
            code: 'test-code',
            state: 'test-state'
        });

        // Verify token exchange
        expect(mockRequestUrl).toHaveBeenCalledWith(
            expect.objectContaining({
                url: expect.stringContaining('oauth2.googleapis.com/token'),
                method: 'POST'
            })
        );
    });
});

// test/services/GoogleCalendarService.test.ts
describe('GoogleCalendarService', () => {
    it('should fetch events correctly', async () => {
        const service = new GoogleCalendarService(mockPlugin, mockOAuthService);

        mockRequestUrl.mockResolvedValue({
            status: 200,
            json: {
                items: [
                    {
                        id: 'event1',
                        summary: 'Test Event',
                        start: { dateTime: '2025-10-08T10:00:00Z' },
                        end: { dateTime: '2025-10-08T11:00:00Z' }
                    }
                ]
            }
        });

        const events = await service.fetchEvents(
            mockSubscription,
            new Date('2025-10-08'),
            new Date('2025-10-09')
        );

        expect(events).toHaveLength(1);
        expect(events[0].title).toBe('Test Event');
    });

    it('should refresh token if expired', async () => {
        const service = new GoogleCalendarService(mockPlugin, mockOAuthService);

        mockSubscription.oauth.tokenExpiry = new Date(Date.now() - 1000).toISOString();

        await service.fetchEvents(mockSubscription, new Date(), new Date());

        expect(mockOAuthService.refreshAccessToken).toHaveBeenCalled();
    });
});
```

### Integration Tests

```typescript
// test/integration/oauth-flow.test.ts
describe('OAuth Integration Flow', () => {
    it('should complete full OAuth flow', async () => {
        const plugin = new TaskNotesPlugin(mockApp, mockManifest);
        await plugin.onload();

        // Start OAuth flow
        const authPromise = plugin.oauthService.startAuthFlow('google', false);

        // Simulate successful callback
        await plugin['handleObsidianProtocol']({
            action: 'tasknotes-oauth',
            code: 'auth-code',
            state: plugin.oauthService['pendingAuths'].keys().next().value
        });

        const oauth = await authPromise;

        expect(oauth.accessToken).toBeDefined();
        expect(oauth.refreshToken).toBeDefined();
        expect(oauth.provider).toBe('google');
    });
});
```

### Manual Testing Checklist

- [ ] Google OAuth flow completes successfully
- [ ] Microsoft OAuth flow completes successfully
- [ ] Events are fetched and displayed
- [ ] Token refresh works when expired
- [ ] Calendar selection dropdown works
- [ ] Events can be created (if write access)
- [ ] Events can be edited (if write access)
- [ ] Events can be deleted (if write access)
- [ ] Error messages are helpful
- [ ] OAuth disconnect works
- [ ] Migration from ICS works
- [ ] Multiple OAuth calendars work together
- [ ] Works on Windows, macOS, Linux

---

## Documentation Requirements

### User Documentation

1. **Getting Started with OAuth Calendars**
   - What is OAuth and why use it?
   - Benefits over ICS feeds
   - Supported providers

2. **Google Calendar Setup**
   - How to connect Google Calendar
   - Selecting calendars
   - Permissions explained
   - Troubleshooting

3. **Microsoft Outlook Setup**
   - How to connect Outlook
   - Selecting calendars
   - Permissions explained
   - Troubleshooting

4. **Editing Calendar Events**
   - How to create events
   - How to edit events
   - How to delete events
   - Sync behavior

5. **Advanced: Custom OAuth Apps**
   - Why use your own OAuth app
   - Setting up Google Cloud project
   - Setting up Azure app registration
   - Configuring in TaskNotes

### Developer Documentation

1. **OAuth Architecture**
   - Service design
   - Flow diagrams
   - Security considerations

2. **Adding New Providers**
   - How to add new OAuth providers
   - Required interfaces
   - Testing requirements

3. **API Reference**
   - OAuthService methods
   - Calendar service interfaces
   - Event types

---

## Risks & Mitigation

### Risk 1: ~~Google Security Assessment Cost~~ (RESOLVED)
- **Status**: ✅ **NOT A RISK** - Google Calendar scopes are "sensitive" (not "restricted")
- **Cost**: $0 - Only requires free app verification (3-5 business days)
- **Conclusion**: No financial barrier to implementing read/write calendar access

### Risk 2: OAuth Redirect Limitations
- **Impact**: OAuth flow may not work on all platforms
- **Probability**: Medium (Obsidian protocol handler may have issues)
- **Mitigation**:
  - Test on all platforms early
  - Provide fallback (manual token entry)
  - Document platform-specific issues

### Risk 3: Token Storage Security
- **Impact**: Tokens could be compromised if storage is insecure
- **Probability**: Low (Obsidian encrypts data at rest)
- **Mitigation**:
  - Use Obsidian's encrypted storage
  - Never log tokens
  - Implement token rotation
  - Provide clear security documentation

### Risk 4: API Rate Limits
- **Impact**: Users may hit API rate limits with frequent syncing
- **Probability**: Low to Medium
- **Mitigation**:
  - Implement exponential backoff
  - Cache events effectively
  - Show rate limit warnings
  - Allow configurable sync intervals

### Risk 5: Breaking Changes in APIs
- **Impact**: Google/Microsoft API changes could break integration
- **Probability**: Low (APIs are stable, but changes happen)
- **Mitigation**:
  - Version API requests
  - Monitor API deprecation notices
  - Implement graceful degradation
  - Maintain good error handling

---

## Success Criteria

### MVP (Minimum Viable Product)
- [ ] Google Calendar OAuth authentication works
- [ ] Microsoft Outlook OAuth authentication works
- [ ] Events are fetched and displayed correctly
- [ ] Tokens are refreshed automatically
- [ ] Read-only access is stable
- [ ] Documentation is complete
- [ ] No security vulnerabilities

### Full Release
- [ ] All MVP criteria met
- [ ] Event creation works
- [ ] Event editing works
- [ ] Event deletion works
- [ ] Sync conflicts are handled
- [ ] Migration from ICS works smoothly
- [ ] Test coverage >80%
- [ ] User feedback is positive

### Long-term Success
- [ ] No security incidents
- [ ] Google/Microsoft APIs remain supported
- [ ] User adoption >30% of ICS users
- [ ] Maintenance burden is manageable
- [ ] Community contributions enabled

---

## Alternative Approaches Considered

### 1. Hybrid Approach (Solution 4)
- **Start with bearer tokens** (1-2 days implementation)
- **Add OAuth later** as enhancement
- **Pros**: Faster to market, lower cost, user control
- **Cons**: Less user-friendly, manual token management

### 2. API-Only (No ICS)
- **Remove ICS support entirely**
- **Only support OAuth providers**
- **Pros**: Cleaner codebase, better features
- **Cons**: Breaks existing users, limits flexibility

### 3. Hybrid Storage (Client + Server)
- **Use backend server for OAuth**
- **Proxy API calls through server**
- **Pros**: Better security, centralized management
- **Cons**: Server costs, privacy concerns, complexity

**Recommendation**: Proceed with full OAuth (Solution 1) but start with read-only access to avoid Google security assessment costs initially. Add write capabilities in Phase 2 after validating the approach and user demand.

---

## Next Steps

1. **Review and approve this plan**
2. **Set up OAuth apps** (Google Cloud + Azure)
3. **Create feature branch**: `feature/oauth-calendar-integration`
4. **Begin Phase 1**: Core OAuth Infrastructure
5. **Iterate based on feedback**

---

## Questions for Decision

1. **Should we start with read-only or include write access from the beginning?**
   - ✅ **Updated Recommendation**: Include write access from the beginning - no cost barrier, just requires app verification

2. **Should we embed OAuth credentials or require users to create their own apps?**
   - Recommendation: Embed for ease of use, allow custom as advanced option

3. **Should we maintain ICS support indefinitely or deprecate it?**
   - Recommendation: Keep ICS for non-OAuth calendars (iCloud, custom servers)

4. **Should we implement all providers at once or start with Google?**
   - Recommendation: Implement both in parallel (similar effort, better UX)

5. **What should be the default refresh interval for OAuth calendars?**
   - Recommendation: 15 minutes (balance between freshness and API usage)
