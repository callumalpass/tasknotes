# OAuth Calendar Integration - Setup Guide

This guide walks you through all the steps needed to set up OAuth for Google Calendar and Microsoft Outlook integration in TaskNotes, from creating OAuth apps to submitting for verification.

---

## Table of Contents

1. [Overview](#overview)
2. [Google Calendar Setup](#google-calendar-setup)
3. [Microsoft Outlook Setup](#microsoft-outlook-setup)
4. [Development & Testing](#development--testing)
5. [Submitting for Verification](#submitting-for-verification)
6. [Post-Verification](#post-verification)

---

## Overview

### What You'll Create

- **Google Cloud Project** with OAuth 2.0 credentials for Google Calendar API
- **Azure AD App Registration** with OAuth 2.0 credentials for Microsoft Graph API
- **OAuth Apps** verified and ready for production use

### Timeline

| Step | Duration | Cost |
|------|----------|------|
| Google Cloud setup | 30 minutes | $0 |
| Azure AD setup | 30 minutes | $0 |
| Development | 12-17 days | $0 |
| Google verification | 3-5 business days | $0 |
| Microsoft verification | Not required | $0 |
| **Total** | **~15-20 days** | **$0** |

### Prerequisites

- Google Account (for Google Cloud Console)
- Microsoft Account (for Azure Portal)
- TaskNotes plugin development environment
- Ability to record demo video
- YouTube account (for uploading demo video)

---

## Google Calendar Setup

### Phase 1: Create Google Cloud Project

#### Step 1.1: Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google Account
3. If this is your first time, accept Terms of Service

#### Step 1.2: Create New Project

1. Click the **project dropdown** at the top of the page (next to "Google Cloud")
2. Click **"NEW PROJECT"**
3. Enter project details:
   - **Project name**: `TaskNotes Calendar Integration` (or similar)
   - **Organization**: Leave as "No organization" (unless you have one)
   - **Location**: Leave as default
4. Click **"CREATE"**
5. Wait for project creation (takes ~30 seconds)
6. Select your new project from the dropdown

#### Step 1.3: Enable Google Calendar API

1. In the left sidebar, navigate to **"APIs & Services" → "Library"**
   - Or use the search bar: type "API Library" and click the result
2. In the API Library search bar, type: **"Google Calendar API"**
3. Click on **"Google Calendar API"** from the results
4. Click the **"ENABLE"** button
5. Wait for the API to be enabled (~10 seconds)
6. You should see "API enabled" confirmation

### Phase 2: Configure OAuth Consent Screen

#### Step 2.1: Access OAuth Consent Screen

1. In left sidebar: **"APIs & Services" → "OAuth consent screen"**
2. You'll see the OAuth consent screen configuration page

#### Step 2.2: Choose User Type

Select **"External"** user type:
- **External**: Any Google user can authorize your app
- **Internal**: Only available if you have a Google Workspace organization

Click **"CREATE"**

#### Step 2.3: Configure App Information

Fill out the **"OAuth consent screen"** tab:

**App Information:**
- **App name**: `TaskNotes`
- **User support email**: Your email address (select from dropdown)
- **App logo**: (Optional - can upload TaskNotes logo)

**App Domain:**
- **Application home page**: `https://github.com/yourusername/tasknotes` (your GitHub repo)
- **Application privacy policy link**: `https://github.com/yourusername/tasknotes/blob/main/PRIVACY.md`
  - ⚠️ **Important**: Create a PRIVACY.md file in your repo explaining:
    - What data you access (calendar events)
    - How you store it (locally in Obsidian vault)
    - That you don't transmit data to external servers
    - How users can revoke access
- **Application terms of service link**: (Optional)

**Authorized Domains:**
- Leave empty for now (not required for desktop apps)

**Developer Contact Information:**
- **Email addresses**: Your email address

Click **"SAVE AND CONTINUE"**

#### Step 2.4: Add Scopes

Click **"ADD OR REMOVE SCOPES"**

In the scope selection dialog:

1. **Filter scopes**: Type "calendar" in the search box
2. **Select these scopes**:
   - ✅ `https://www.googleapis.com/auth/calendar` - See, edit, share, and permanently delete all the calendars you can access using Google Calendar
   - ✅ `https://www.googleapis.com/auth/calendar.readonly` - See and download any calendar you can access using your Google Calendar (optional, for users who want read-only)

3. Click **"UPDATE"** at the bottom
4. Verify scopes appear in the list
5. Click **"SAVE AND CONTINUE"**

#### Step 2.5: Add Test Users (for Development)

During development (before verification), only test users can use your app:

1. Click **"ADD USERS"**
2. Enter email addresses (one per line):
   - Your email
   - Any other developers/testers
3. Click **"ADD"**
4. Click **"SAVE AND CONTINUE"**

#### Step 2.6: Review Summary

1. Review all the information
2. Click **"BACK TO DASHBOARD"**

### Phase 3: Create OAuth Credentials

#### Step 3.1: Access Credentials Page

1. In left sidebar: **"APIs & Services" → "Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**

#### Step 3.2: Configure OAuth Client

1. **Application type**: Select **"Desktop app"**
   - ℹ️ Even though Obsidian is Electron-based, "Desktop app" is the correct choice for apps using custom protocol handlers

2. **Name**: `TaskNotes Desktop Client` (or similar)

3. Click **"CREATE"**

#### Step 3.3: Save Credentials

A dialog will appear with your credentials:

1. **Copy and save** (you can only see the full secret once):
   - **Client ID**: `xxx.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxx`

2. Click **"DOWNLOAD JSON"** to save a backup

3. Store these securely:
   ```
   Google Calendar OAuth Credentials:
   Client ID: [paste here]
   Client Secret: [paste here]
   ```

4. Click **"OK"** to close the dialog

#### Step 3.4: Add Redirect URI

⚠️ **Important**: Desktop app type may not allow custom protocol URIs in the UI. You'll need to use the **OAuth client configuration**:

1. Find your newly created OAuth client in the list
2. Click the **pencil icon** (edit) next to it
3. Under **"Authorized redirect URIs"**, click **"+ ADD URI"**
4. Add: `obsidian://tasknotes-oauth`
5. Click **"SAVE"**

If you get an error about custom protocol URIs:
- The desktop app type should support this
- If not, you may need to use `http://localhost` as fallback during development
- The custom protocol should work once deployed

### Phase 4: Test OAuth Flow (Development)

Before submitting for verification, test with your test users:

1. Implement OAuth flow in your plugin code (see implementation plan)
2. Test with accounts listed as test users
3. Verify:
   - ✅ OAuth consent screen appears
   - ✅ Scopes are displayed correctly
   - ✅ Redirect to Obsidian works
   - ✅ Tokens are received
   - ✅ Calendar API calls work
   - ✅ Token refresh works

⚠️ **Note**: During development, users will see "This app isn't verified" warning. This is normal and will be removed after verification.

---

## Microsoft Outlook Setup

### Phase 1: Register Azure AD App

#### Step 1.1: Access Azure Portal

1. Go to [Azure Portal](https://portal.azure.com/)
2. Sign in with your Microsoft Account
3. Accept any terms if prompted

#### Step 1.2: Navigate to App Registrations

1. In the search bar at the top, type: **"App registrations"**
2. Click **"App registrations"** from the results
3. Or navigate: **Azure Active Directory → App registrations**

#### Step 1.3: Create New Registration

1. Click **"+ New registration"** at the top
2. Fill out the registration form:

**Name:**
- Enter: `TaskNotes Calendar`

**Supported account types:**
- Select: **"Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)"**
- ℹ️ This allows both personal Outlook.com accounts and work/school accounts

**Redirect URI (optional):**
- Platform: Select **"Public client/native (mobile & desktop)"**
- Redirect URI: Enter `obsidian://tasknotes-oauth`
- ℹ️ Note: If custom protocol doesn't work, you may need to add it via Manifest (see below)

3. Click **"Register"**

#### Step 1.4: Record Application Details

On the **Overview** page, copy and save:

```
Microsoft Graph OAuth Credentials:
Application (client) ID: [paste here]
Directory (tenant) ID: [paste here]
```

### Phase 2: Configure Authentication

#### Step 2.1: Add Custom Protocol Redirect URI (if needed)

If you couldn't add `obsidian://tasknotes-oauth` during registration:

1. Go to **"Authentication"** in the left sidebar
2. Under **"Platform configurations"**, find your platform
3. Try adding the URI: `obsidian://tasknotes-oauth`

If the UI doesn't accept custom protocols:

**Use Application Manifest:**

1. In left sidebar, click **"Manifest"**
2. Find the `"replyUrlsWithType"` array
3. Add an entry:
   ```json
   {
     "url": "obsidian://tasknotes-oauth",
     "type": "PublicClient"
   }
   ```
4. Click **"Save"** at the top
5. Return to **"Authentication"** to verify it appears

#### Step 2.2: Enable Public Client Flow

1. In **"Authentication"** page, scroll to **"Advanced settings"**
2. Under **"Allow public client flows"**, toggle **"Yes"**
3. Click **"Save"** at the top

### Phase 3: Configure API Permissions

#### Step 3.1: Add Microsoft Graph Permissions

1. In left sidebar, click **"API permissions"**
2. You'll see `User.Read` already added (default)
3. Click **"+ Add a permission"**

#### Step 3.2: Select Microsoft Graph

1. In the **"Request API permissions"** panel, click **"Microsoft Graph"**
2. Select **"Delegated permissions"** (should be default)

#### Step 3.3: Add Calendar Permissions

1. In the search box, type: **"Calendar"**
2. Expand **"Calendars"**
3. Check these permissions:
   - ✅ `Calendars.Read` - Read user calendars
   - ✅ `Calendars.ReadWrite` - Have full access to user calendars
4. Also check:
   - ✅ `offline_access` - Maintain access to data you have given it access to
   - ℹ️ This is required for refresh tokens

5. Click **"Add permissions"** at the bottom

#### Step 3.4: Verify Permissions

Your permissions list should show:
- ✅ `Calendars.Read` - Delegated
- ✅ `Calendars.ReadWrite` - Delegated
- ✅ `offline_access` - Delegated
- `User.Read` - Delegated (default, can keep it)

⚠️ **Note**: Admin consent is NOT required for these delegated permissions for personal accounts. Work/school admins may need to grant consent for their organization.

### Phase 4: Test OAuth Flow

1. Implement OAuth flow in your plugin code
2. Test with personal Microsoft account
3. Test with work/school account (if available)
4. Verify:
   - ✅ OAuth consent screen appears
   - ✅ Permissions are displayed correctly
   - ✅ Redirect to Obsidian works
   - ✅ Tokens are received
   - ✅ Calendar API calls work
   - ✅ Token refresh works

ℹ️ **Note**: Microsoft doesn't require verification for apps using standard Graph API permissions. Your app can be used in production immediately!

---

## Development & Testing

### Implementation Checklist

Before submitting for verification, complete these steps:

#### Core OAuth Implementation
- [ ] Implement OAuthService with PKCE flow
- [ ] Register Obsidian protocol handler (`obsidian://tasknotes-oauth`)
- [ ] Implement token storage (encrypted)
- [ ] Implement token refresh logic
- [ ] Add CSRF protection (state parameter)

#### Google Calendar Integration
- [ ] Implement GoogleCalendarService
- [ ] Fetch events with OAuth token
- [ ] Handle token expiry and refresh
- [ ] List available calendars
- [ ] Convert Google events to TaskNotes format
- [ ] (Optional) Create/edit/delete events

#### Microsoft Calendar Integration
- [ ] Implement MicrosoftCalendarService
- [ ] Fetch events with OAuth token
- [ ] Handle token expiry and refresh
- [ ] List available calendars
- [ ] Convert Microsoft events to TaskNotes format
- [ ] (Optional) Create/edit/delete events

#### UI/UX
- [ ] Add "Connect Google Calendar" button in settings
- [ ] Add "Connect Microsoft Outlook" button in settings
- [ ] Show OAuth connection status
- [ ] Show calendar selection dropdown
- [ ] Add disconnect/revoke access option
- [ ] Display helpful error messages

#### Testing
- [ ] Test OAuth flow (Google & Microsoft)
- [ ] Test with multiple test users
- [ ] Test token refresh before expiry
- [ ] Test error handling (network errors, API errors)
- [ ] Test on Windows, macOS, and Linux
- [ ] Test concurrent calendar subscriptions
- [ ] Test calendar event display
- [ ] (If implemented) Test event editing

### Test User Instructions

Share this with your test users:

1. **Install the development version** of TaskNotes
2. **Open Settings** → Integrations
3. **Click "Connect Google Calendar"**
4. **You'll see "This app isn't verified"** warning - this is expected during development
5. Click **"Advanced"** → **"Go to TaskNotes (unsafe)"**
6. Review permissions and click **"Allow"**
7. You should be redirected back to Obsidian
8. **Verify** that your calendar events appear in TaskNotes

---

## Submitting for Verification

### When to Submit

✅ Submit for verification when:
- OAuth flow is fully implemented and tested
- UI is complete and polished
- Multiple test users have successfully tested the app
- You're ready for public release
- Privacy policy is published
- Demo video is ready

❌ Don't submit yet if:
- Still developing core features
- OAuth flow has known bugs
- UI is incomplete or placeholder
- Haven't tested with real users

### Google OAuth Verification

#### Preparation (Before Submission)

##### 1. Create Privacy Policy

Create `PRIVACY.md` in your GitHub repo:

```markdown
# TaskNotes Privacy Policy

Last updated: [Date]

## Overview
TaskNotes is an Obsidian plugin that helps you manage tasks and calendar events within your notes.

## Data Collection and Usage

### Google Calendar Integration
When you connect your Google Calendar:
- **What we access**: Your calendar events (title, time, description, location, attendees)
- **How we use it**: To display events in your Obsidian vault and allow you to manage them
- **Where it's stored**: Locally in your Obsidian vault only. We do not transmit your data to external servers.
- **Third-party access**: None. Your calendar data stays on your device.

### Microsoft Outlook Integration
When you connect your Microsoft Outlook calendar:
- **What we access**: Your calendar events (title, time, description, location, attendees)
- **How we use it**: To display events in your Obsidian vault and allow you to manage them
- **Where it's stored**: Locally in your Obsidian vault only. We do not transmit your data to external servers.
- **Third-party access**: None. Your calendar data stays on your device.

## Data Storage
- OAuth tokens are stored encrypted in your Obsidian vault
- Calendar events are cached locally for performance
- No data is sent to external servers or third parties

## Data Deletion
You can delete your data at any time:
1. Disconnect your calendar in TaskNotes settings
2. This revokes OAuth access and deletes local tokens
3. To remove cached events, disable the plugin or delete the plugin data folder

## Revoking Access
You can revoke TaskNotes' access to your calendar:
- **Google**: Visit [Google Account Permissions](https://myaccount.google.com/permissions)
- **Microsoft**: Visit [Microsoft Account Apps](https://account.microsoft.com/privacy/app-access)

## Changes to Privacy Policy
We may update this policy. Changes will be posted in this file with an updated date.

## Contact
For questions: [your-email@example.com] or [GitHub Issues link]
```

Publish this file and get the URL: `https://github.com/yourusername/tasknotes/blob/main/PRIVACY.md`

##### 2. Verify OAuth Consent Screen

Go to **Google Cloud Console** → **OAuth consent screen**:

- ✅ App name is set correctly
- ✅ User support email is valid
- ✅ Privacy policy link is published and accessible
- ✅ App logo uploaded (optional but recommended)
- ✅ Scopes are correct (`calendar` or `calendar.readonly`)

##### 3. Create Demo Video

**Required content** (must show all of these):

1. **OAuth Grant Process** (2-3 minutes):
   - Start from TaskNotes settings
   - Click "Connect Google Calendar"
   - Show browser opening with OAuth consent screen
   - **Highlight**: App name appears correctly
   - **Highlight**: OAuth client ID in browser address bar
   - Show the consent screen with scopes listed
   - Click "Allow"
   - Show redirect back to Obsidian
   - Show success message

2. **Scope Usage Demonstration** (3-5 minutes):
   - Show calendar events appearing in TaskNotes
   - Show event details (title, time, description)
   - Demonstrate filtering/viewing calendar data
   - If implementing write access: show creating/editing an event
   - Verify changes sync back to Google Calendar

3. **Additional Views**:
   - Show settings page where OAuth connection is managed
   - Show disconnect/revoke access option
   - Show calendar selection (if multiple calendars supported)

**Recording tips**:
- Use screen recording software (OBS Studio, Loom, QuickTime)
- Record at 1080p resolution
- Add voice narration or text overlays highlighting key points
- Keep it concise (5-8 minutes total)
- Show the complete, uninterrupted flow
- Use English for narration/text

**Video preparation**:
1. Record the video
2. Edit if needed (add text overlays, trim dead time)
3. Upload to **YouTube**
4. Set visibility to **"Unlisted"** (not Private, not Public)
5. Copy the video URL

##### 4. Submit for Verification

1. Go to **Google Cloud Console** → **OAuth consent screen**
2. Look for **"PUBLISH APP"** or **"Start verification"** button
3. Click to start the verification request

**Fill out the verification form**:

**App information:**
- Confirm app name, logo, links are correct

**Scopes justification:**
- **Scope**: `https://www.googleapis.com/auth/calendar`
- **Justification**:
  ```
  TaskNotes uses the Google Calendar scope to sync and display users' calendar
  events within their Obsidian notes. Users can view their calendar events
  alongside their tasks and notes, helping them manage their schedule and
  productivity. Events are displayed in calendar views, agenda views, and can
  be referenced in daily notes. All data is stored locally in the user's
  Obsidian vault; we do not transmit calendar data to external servers.
  ```

**Demo video:**
- Paste your unlisted YouTube video URL

**Domain verification** (if required):
- If you have a domain for your app, verify it via Google Search Console
- For GitHub-only projects, this may not be required

**Additional information:**
- Provide any other details requested
- Explain that TaskNotes is an Obsidian plugin (desktop application)
- Mention that all data is stored locally

##### 5. Submit and Wait

1. Review all information
2. Click **"Submit for verification"**
3. You'll receive a confirmation email
4. **Expected timeline**: 3-5 business days
5. Google may request additional information via email

**Possible outcomes**:
- ✅ **Approved**: Your app is verified! Remove test user restrictions.
- ❓ **Additional information needed**: Respond promptly with requested details
- ❌ **Rejected**: Review feedback, make changes, resubmit

### Microsoft Verification

**Good news**: Microsoft doesn't require verification for standard Microsoft Graph API permissions like `Calendars.Read` and `Calendars.ReadWrite`.

✅ Your app can be used in production immediately after development!

However, if you want to publish your app in the Microsoft AppSource marketplace (optional):

1. Visit [Microsoft Partner Center](https://partner.microsoft.com/)
2. Create a developer account (may require fee)
3. Submit your app for AppSource listing
4. Follow marketplace submission guidelines

**For most use cases**: This is NOT necessary. Users can use your OAuth app without marketplace listing.

---

## Post-Verification

### After Google Verification is Approved

#### Step 1: Update OAuth Consent Screen

1. Go to **Google Cloud Console** → **OAuth consent screen**
2. **Status** should now show "Published" or "Verified"
3. The "unverified app" warning will no longer appear to users

#### Step 2: Remove Test User Restrictions

1. In **OAuth consent screen** → **Test users**
2. You can now remove test users (since app is verified)
3. Any Google user can now authorize your app

#### Step 3: Update Documentation

Update your plugin documentation:
- Remove any mentions of "test users only"
- Add instructions for connecting Google Calendar
- Include screenshots of the OAuth flow
- Link to privacy policy

#### Step 4: Publish Plugin Release

1. Tag a new release in your GitHub repo
2. Update Obsidian plugin manifest version
3. Submit to Obsidian Community Plugins (if not already)
4. Announce OAuth calendar support!

### Monitoring & Maintenance

#### Google Cloud Console Monitoring

Regularly check:
- **APIs & Services → Dashboard**: API usage quotas
- **OAuth consent screen**: Verification status
- **Credentials**: Ensure client ID/secret haven't been compromised

#### Quota Limits

Google Calendar API quotas (free tier):
- **Queries per day**: 1,000,000 (very generous)
- **Queries per minute per user**: 60

If you exceed these:
- You'll get rate limit errors
- Implement exponential backoff in your code
- Consider caching events to reduce API calls

#### Token Refresh

- OAuth tokens expire (typically 1 hour for access tokens)
- Refresh tokens last indefinitely (until revoked)
- Your code should automatically refresh tokens before expiry
- Test token refresh regularly

#### Handling Revoked Access

Users can revoke access at any time:
- Your app will get authentication errors
- Gracefully handle these errors
- Show user-friendly message: "Calendar access revoked. Please reconnect."
- Provide easy reconnection flow

### Annual Review (Google)

For **sensitive scopes** (like Calendar):
- ✅ No annual security assessment required
- ✅ No annual re-verification needed (unlike restricted scopes)

However, Google may:
- Request updated demo video if API changes
- Review if you change scopes
- Contact you about policy compliance

Stay updated:
- Subscribe to Google Calendar API announcements
- Monitor your Google Cloud Console email notifications

### Support & Troubleshooting

#### Common User Issues

**"This app isn't verified" warning:**
- This should only appear during development
- After verification, it should be removed
- If it persists, check OAuth consent screen status

**"Redirect URI mismatch" error:**
- Verify `obsidian://tasknotes-oauth` is in authorized redirect URIs
- Check for typos in your code
- Ensure protocol handler is registered correctly

**"Insufficient permissions" error:**
- Token may not have correct scopes
- User may have declined some permissions
- Re-initiate OAuth flow to request permissions again

**Token refresh fails:**
- Refresh token may have been revoked by user
- User needs to reconnect calendar
- Provide clear error message and reconnection option

#### Getting Help

- **Google OAuth**: [Google OAuth Help Center](https://support.google.com/cloud/answer/13463073)
- **Microsoft Graph**: [Microsoft Graph Support](https://developer.microsoft.com/en-us/graph/support)
- **Obsidian Plugin Development**: [Obsidian Developer Docs](https://docs.obsidian.md/)

---

## Quick Reference

### Important URLs

**Google:**
- Google Cloud Console: https://console.cloud.google.com/
- OAuth Consent Screen: https://console.cloud.google.com/apis/credentials/consent
- Credentials: https://console.cloud.google.com/apis/credentials
- Calendar API Docs: https://developers.google.com/calendar/api
- OAuth Verification Help: https://support.google.com/cloud/answer/13463073

**Microsoft:**
- Azure Portal: https://portal.azure.com/
- App Registrations: https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps
- Graph API Docs: https://learn.microsoft.com/en-us/graph/api/resources/calendar
- OAuth Permissions Reference: https://learn.microsoft.com/en-us/graph/permissions-reference

### OAuth Endpoints

**Google:**
```
Authorization URL: https://accounts.google.com/o/oauth2/v2/auth
Token URL: https://oauth2.googleapis.com/token
Scopes:
  - https://www.googleapis.com/auth/calendar (read/write)
  - https://www.googleapis.com/auth/calendar.readonly (read only)
Redirect URI: obsidian://tasknotes-oauth
```

**Microsoft:**
```
Authorization URL: https://login.microsoftonline.com/common/oauth2/v2.0/authorize
Token URL: https://login.microsoftonline.com/common/oauth2/v2.0/token
Scopes:
  - Calendars.Read
  - Calendars.ReadWrite
  - offline_access (for refresh tokens)
Redirect URI: obsidian://tasknotes-oauth
```

### Credentials Storage Format

Store your credentials securely (don't commit to Git):

```typescript
// .env.local or secure storage
GOOGLE_OAUTH_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxx

MICROSOFT_OAUTH_CLIENT_ID=xxx
MICROSOFT_OAUTH_TENANT_ID=common (or specific tenant)
```

### Testing Checklist

Before submitting for verification:

- [ ] OAuth flow works for Google Calendar
- [ ] OAuth flow works for Microsoft Outlook
- [ ] Token refresh works automatically
- [ ] Error messages are helpful
- [ ] Settings UI is polished
- [ ] Privacy policy is published
- [ ] Demo video is recorded and uploaded (unlisted)
- [ ] Tested on Windows, macOS, Linux
- [ ] Tested with multiple test users
- [ ] Code is ready for release

---

## Appendix: Troubleshooting OAuth Setup

### Google Cloud Console Issues

**Problem**: Can't add custom redirect URI (`obsidian://...`)
- **Solution**: Desktop app type should support it. If not, use manifest editor or use `http://localhost` during development.

**Problem**: "App domain" verification required
- **Solution**: Not typically required for desktop apps. Skip if optional.

**Problem**: Can't find OAuth consent screen
- **Solution**: Go to APIs & Services → OAuth consent screen. Create one if it doesn't exist.

### Azure Portal Issues

**Problem**: Custom redirect URI not accepted
- **Solution**: Use the manifest editor to add it manually (see Microsoft Outlook Setup section).

**Problem**: "Admin consent required" error
- **Solution**: This applies to organizational accounts. Personal accounts don't need admin consent for standard permissions.

**Problem**: Can't find "App registrations"
- **Solution**: Search for "App registrations" in the top search bar or navigate to Azure Active Directory first.

### Protocol Handler Issues

**Problem**: `obsidian://` redirect doesn't work
- **Solution 1**: Ensure protocol handler is registered in Obsidian plugin
- **Solution 2**: Test with `http://localhost` first
- **Solution 3**: Check Obsidian logs for protocol handler errors
- **Solution 4**: Verify redirect URI exactly matches (including trailing slashes)

### Verification Issues

**Problem**: Verification rejected - "Scope justification insufficient"
- **Solution**: Provide more detailed explanation of how you use each scope with specific examples

**Problem**: Verification rejected - "Demo video doesn't show required elements"
- **Solution**: Re-record video ensuring all checklist items are shown clearly with highlighting

**Problem**: Verification pending for >5 days
- **Solution**: Check spam folder for Google emails. Reply to verification email if you received one asking for status.

---

## Next Steps

1. ✅ Complete this setup guide for Google and Microsoft
2. 📝 Follow the [OAuth Calendar Integration Implementation Plan](./oauth-calendar-integration-plan.md)
3. 🧪 Test thoroughly with test users
4. 🎥 Record demo video
5. 📤 Submit for Google verification
6. 🚀 Release to production!

Good luck with your OAuth integration! 🎉
