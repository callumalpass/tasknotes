# Issue #801 Analysis: Support Google OAuth Access for Private Calendars

## Problem Understanding

### User Request
The user wants to sync both personal and work calendars to TaskNotes. While the personal calendar works, the work calendar is behind Google Workspace and requires OAuth + SSO authorization to access. Without proper authorization, they receive a 404 error when trying to access the ICS file URL. When properly authorized (e.g., in an incognito browser window), the same URL works.

### Root Cause
TaskNotes currently uses the `requestUrl` API to fetch ICS calendar feeds using simple HTTP GET requests with basic headers. This approach works for:
- Publicly accessible calendar URLs
- URLs with authentication embedded in the URL itself (e.g., secret tokens in query parameters)

However, it **does not support**:
- OAuth 2.0 authentication flows
- Bearer token authentication
- Session-based authentication requiring cookies
- Google Workspace SSO authentication

The current implementation in `src/services/ICSSubscriptionService.ts:157-167`:
```typescript
const response = await requestUrl({
    url: subscription.url,
    method: "GET",
    headers: {
        Accept: "text/calendar,*/*;q=0.1",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    },
});
```

### Why 404 Occurs
Google Calendar returns a 404 error (instead of 401/403) when:
1. The ICS feed URL requires OAuth authentication
2. No valid authentication token is provided
3. The calendar is private and not shared publicly
4. Google Workspace domain restrictions are in place

This is a security-by-obscurity pattern where Google treats unauthorized requests as "resource not found" rather than exposing that a private calendar exists.

## Test File Location

**Test not created** - This is a feature request, not a bug. A test would require:
- Mocking OAuth flow (complex)
- Simulating Google Workspace authentication (not feasible in unit tests)
- Integration test would require real Google credentials

However, for manual testing:
1. Add a Google Workspace calendar subscription
2. Use private calendar ICS URL (requires auth)
3. Verify 404 error occurs
4. After implementing OAuth, verify calendar syncs successfully

## Relevant Code Locations

### Core Files
- **ICS Subscription Service**: `src/services/ICSSubscriptionService.ts:157-167` - Where HTTP requests are made
- **ICS Subscription Type**: `src/types.ts:742-753` - ICSSubscription interface definition
- **Integration Settings UI**: `src/settings/tabs/integrationsTab.ts:520-848` - Where subscriptions are managed
- **Documentation**: `docs/features/ics-integration.md` - User-facing ICS documentation

### Key Functions
- `fetchSubscription()` at `src/services/ICSSubscriptionService.ts:144` - Main fetch logic
- `parseICS()` at `src/services/ICSSubscriptionService.ts:244` - ICS parsing (works fine, not the issue)
- `renderICSSubscriptionsList()` at `src/settings/tabs/integrationsTab.ts:520` - Settings UI

## Proposed Solutions

### Solution 1: OAuth 2.0 Flow Implementation (Full Support)

**Approach**: Implement a complete OAuth 2.0 authentication flow for calendar subscriptions.

**Implementation**:
1. Extend `ICSSubscription` type to include OAuth configuration:
   ```typescript
   interface ICSSubscription {
       // ... existing fields
       authType?: 'none' | 'oauth2' | 'bearer';
       oauth?: {
           clientId?: string;
           clientSecret?: string;
           accessToken?: string;
           refreshToken?: string;
           tokenExpiry?: string;
           authUrl?: string;
           tokenUrl?: string;
           scope?: string;
       };
   }
   ```

2. Create OAuth flow handler:
   - Add "Authenticate with Google" button in settings UI
   - Open OAuth consent in browser/modal
   - Handle OAuth callback and store tokens
   - Implement token refresh logic

3. Update `fetchSubscription()` to use OAuth tokens:
   ```typescript
   if (subscription.authType === 'oauth2' && subscription.oauth?.accessToken) {
       headers['Authorization'] = `Bearer ${subscription.oauth.accessToken}`;
   }
   ```

4. Add Google Calendar API integration as fallback:
   - If ICS URL fails, try Google Calendar API
   - Convert API events to ICSEvent format

**Pros**:
- Full support for Google Workspace, Microsoft 365, and other OAuth providers
- Secure token storage and automatic refresh
- Best user experience (click to authenticate)
- Future-proof for enterprise calendars

**Cons**:
- Significant development effort (OAuth flow, token management, UI)
- Requires Google Cloud project setup (client ID/secret)
- Complex error handling (token expiry, revocation, etc.)
- Privacy concerns with storing OAuth tokens
- May require plugin approval for OAuth redirect URLs

**Estimated Effort**: 3-5 days

---

### Solution 2: Bearer Token Support (Simple Auth)

**Approach**: Add support for manual bearer token entry without full OAuth flow.

**Implementation**:
1. Add optional auth fields to subscription:
   ```typescript
   interface ICSSubscription {
       // ... existing fields
       authType?: 'none' | 'bearer' | 'basic';
       authToken?: string; // For bearer tokens
       authUsername?: string; // For basic auth
       authPassword?: string; // For basic auth
   }
   ```

2. Update UI to show auth options based on type:
   - Dropdown: None / Bearer Token / Basic Auth
   - Conditional inputs for token/credentials

3. Update fetch logic:
   ```typescript
   const headers: Record<string, string> = {
       Accept: "text/calendar,*/*;q=0.1",
   };

   if (subscription.authType === 'bearer' && subscription.authToken) {
       headers['Authorization'] = `Bearer ${subscription.authToken}`;
   } else if (subscription.authType === 'basic' && subscription.authUsername) {
       const encoded = btoa(`${subscription.authUsername}:${subscription.authPassword}`);
       headers['Authorization'] = `Basic ${encoded}`;
   }
   ```

4. Document how users can obtain bearer tokens:
   - Google: OAuth Playground or API Console
   - Other providers: Their respective docs

**Pros**:
- Much simpler implementation (1 day vs 5 days)
- Works with any auth system that accepts bearer tokens
- No external dependencies or OAuth complexity
- Users maintain full control over tokens
- Can support basic auth too

**Cons**:
- Manual token management by user
- Tokens expire and need manual refresh
- Less user-friendly than automatic OAuth
- Requires technical knowledge to obtain tokens
- Security risk if user stores long-lived tokens

**Estimated Effort**: 1 day

---

### Solution 3: Google Calendar API Integration

**Approach**: Add native Google Calendar API support as an alternative to ICS feeds.

**Implementation**:
1. Add new subscription type:
   ```typescript
   type: 'remote' | 'local' | 'google-calendar'
   ```

2. Implement Google Calendar API client:
   - OAuth flow for authentication
   - Use Calendar API to fetch events
   - Convert to ICSEvent format

3. Update UI with "Add Google Calendar" option:
   - Triggers OAuth flow
   - Lists available calendars
   - Syncs events periodically

4. Keep ICS support for other providers

**Pros**:
- Native Google integration (best for Google users)
- More reliable than ICS feeds
- Access to full event metadata
- Can filter events by various criteria

**Cons**:
- Only solves Google Calendar (not other OAuth providers)
- Requires Google Cloud project setup
- Two different sync mechanisms (ICS + API)
- More code to maintain
- Doesn't address the core OAuth issue

**Estimated Effort**: 4-6 days

---

### Solution 4: Hybrid Approach (Recommended)

**Approach**: Combine Solution 2 (bearer tokens) with a future path to Solution 1 (OAuth).

**Phase 1 - Quick Win (v1)**:
- Implement bearer token support (Solution 2)
- Add documentation for obtaining tokens
- Support basic auth as well

**Phase 2 - Full OAuth (v2)**:
- Add OAuth 2.0 flow for Google
- Implement token refresh
- Extend to other providers (Microsoft, etc.)

**Implementation Plan**:
1. **Now**: Add auth fields to `ICSSubscription` with forward compatibility:
   ```typescript
   interface ICSSubscription {
       authType?: 'none' | 'bearer' | 'basic' | 'oauth2';
       // Simple auth (v1)
       authToken?: string;
       authUsername?: string;
       authPassword?: string;
       // OAuth (v2)
       oauth?: {
           provider?: 'google' | 'microsoft' | 'custom';
           accessToken?: string;
           refreshToken?: string;
           tokenExpiry?: string;
           // ... other OAuth fields
       };
   }
   ```

2. **Now**: Update UI and fetch logic for bearer/basic auth

3. **Later**: Add OAuth button and flow without breaking existing subscriptions

**Pros**:
- Immediate solution for users (bearer tokens)
- Clean upgrade path to OAuth
- Supports multiple auth methods
- Backward compatible
- Incremental complexity

**Cons**:
- Two-phase implementation
- Bearer tokens are interim solution
- Need to maintain both auth paths

**Estimated Effort**:
- Phase 1: 1-2 days
- Phase 2: 3-4 days (future)

## Recommended Approach

**Implement Solution 4 (Hybrid Approach)** with the following priority:

### Phase 1: Bearer Token Support (Immediate)
1. Add `authType`, `authToken`, `authUsername`, `authPassword` fields to `ICSSubscription`
2. Update settings UI to allow auth type selection and credential input
3. Modify `fetchSubscription()` to include auth headers
4. Add secure storage considerations (warn users about token security)
5. Document how to obtain bearer tokens for Google Calendar

### Why This Approach?
- **Solves the immediate problem**: Users can manually get tokens and use private calendars
- **Low complexity**: Can be implemented quickly without OAuth infrastructure
- **Extensible**: Clean path to add OAuth later without breaking changes
- **Flexible**: Supports any provider that accepts bearer/basic auth
- **User control**: Advanced users can use this immediately while OAuth is in development

### Future Enhancement Path
Once bearer tokens prove the concept works, implement OAuth 2.0 for a better UX:
- Google OAuth for Google Calendar/Workspace
- Microsoft OAuth for Outlook/Office 365
- Generic OAuth2 for other providers

### Security Considerations
- Store auth tokens encrypted in plugin data
- Warn users about token expiry and rotation
- Add "Test Connection" button to validate credentials
- Log auth failures with helpful error messages
- Consider using Obsidian's secret storage if available

### Documentation Needs
- How to obtain Google Calendar API bearer token
- How to obtain Microsoft Graph API token
- Security best practices for token management
- Troubleshooting auth failures
- Migration guide when OAuth is added
