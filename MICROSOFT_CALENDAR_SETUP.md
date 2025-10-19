# Microsoft Calendar Integration Setup Guide

This guide explains how to set up Microsoft Calendar integration in TaskNotes using Azure Active Directory (Microsoft Entra ID).

---

## Overview

TaskNotes supports two methods for Microsoft Calendar integration:

1. **Quick Setup (Recommended)** - Use TaskNotes' built-in OAuth credentials with a valid license
2. **Advanced Setup** - Use your own Azure OAuth app credentials

The Quick Setup is easier and requires no Azure configuration, but requires a TaskNotes license. This guide focuses on the Advanced Setup for users who want to use their own credentials.

---

## Prerequisites

- A Microsoft account (personal or work/school)
- Access to Azure Portal (https://portal.azure.com)
- Admin permissions to create Azure app registrations (for organizational accounts)

---

## Step-by-Step Setup

### 1. Sign in to Azure Portal

1. Navigate to https://portal.azure.com
2. Sign in with your Microsoft account
3. If using a work/school account, ensure you have permissions to create app registrations

### 2. Create a New App Registration

1. In the Azure Portal, search for **"App registrations"** in the top search bar
2. Click **"App registrations"** from the results
3. Click **"+ New registration"** at the top

### 3. Configure Basic Settings

Fill in the following information:

**Name:**
```
TaskNotes Calendar Integration
```
(You can choose any name you prefer)

**Supported account types:**
Select one of:
- **"Accounts in this organizational directory only"** - Only your organization (single tenant)
- **"Accounts in any organizational directory"** - Any Azure AD directory (multi-tenant)
- **"Accounts in any organizational directory and personal Microsoft accounts"** - Work/school and personal accounts (recommended for maximum flexibility)

**Redirect URI:**
- Platform: **"Web"**
- URL: `http://127.0.0.1:8080`

> **Note:** TaskNotes uses a local HTTP server on port 8080 for OAuth callbacks. If this port is unavailable, the service will automatically try ports 8081-8090.

Click **"Register"** to create the app.

### 4. Configure API Permissions

After registration, you'll be taken to the app's overview page.

1. Click **"API permissions"** in the left sidebar
2. Click **"+ Add a permission"**
3. Select **"Microsoft Graph"**
4. Select **"Delegated permissions"**
5. Search for and add the following permissions:
   - `Calendars.Read` - Read user calendars
   - `Calendars.ReadWrite` - Read and write user calendars
   - `offline_access` - Maintain access to data you have given it access to (required for refresh tokens)

6. Click **"Add permissions"**

**Optional:** For organizational accounts, an admin can click **"Grant admin consent"** to pre-approve these permissions for all users. Otherwise, users will see a consent prompt on first login.

### 5. Create a Client Secret

1. Click **"Certificates & secrets"** in the left sidebar
2. Click **"+ New client secret"**
3. Enter a description: `TaskNotes OAuth Secret`
4. Select an expiration period:
   - **"6 months"** - More secure, requires periodic renewal
   - **"12 months"** - Balance of security and convenience
   - **"24 months"** - Maximum convenience, less frequent renewal
   - **"Custom"** - Set your own expiration date

5. Click **"Add"**

6. **IMPORTANT:** Copy the **Value** (not the Secret ID) immediately and save it securely
   - This secret will **only be shown once**
   - You'll need this value for TaskNotes configuration
   - If you lose it, you'll need to create a new secret

### 6. Get Your Application (Client) ID

1. Go back to the app's **"Overview"** page
2. Copy the **Application (client) ID**
3. Save this value - you'll need it for TaskNotes configuration

### 7. Configure TaskNotes

1. Open Obsidian with TaskNotes plugin installed
2. Go to **Settings → TaskNotes → Integrations**
3. Scroll to the **Microsoft Calendar** section
4. Select **"Advanced Setup (Your Own OAuth App)"**
5. Enter your credentials:
   - **Microsoft OAuth Client ID:** Paste the Application (client) ID from step 6
   - **Microsoft OAuth Client Secret:** Paste the secret value from step 5
6. Click **"Connect to Microsoft Calendar"**
7. A browser window will open for Microsoft authorization
8. Sign in and grant the requested permissions
9. You'll be redirected back to TaskNotes

### 8. Select Calendars to Display

After successful authorization:

1. In TaskNotes settings, you'll see a list of your Microsoft calendars
2. Toggle the calendars you want to display in TaskNotes
3. Leave all calendars enabled to show events from all calendars
4. Save your settings

---

## Security Best Practices

### Client Secret Management

1. **Never commit secrets to version control**
   - Add `.env` files to `.gitignore`
   - Use environment variables for CI/CD

2. **Rotate secrets periodically**
   - Set calendar reminders for secret expiration
   - Create new secrets before old ones expire
   - Delete old secrets after migration

3. **Limit secret access**
   - Only share credentials with necessary personnel
   - Use separate apps for dev/staging/production

### Permission Scope

TaskNotes requests minimal required permissions:
- `Calendars.Read` - View calendar events
- `Calendars.ReadWrite` - Create, update, and delete events
- `offline_access` - Refresh access tokens without re-authentication

**Why these permissions?**
- TaskNotes needs read access to display your events
- Write access enables drag-and-drop event editing
- Offline access provides a seamless experience without frequent logins

---

## Troubleshooting

### "Redirect URI mismatch" Error

**Problem:** You see an error about redirect URI not matching.

**Solution:**
1. Ensure the redirect URI in Azure matches exactly: `http://127.0.0.1:8080`
2. Check that you selected "Web" as the platform type
3. TaskNotes will try ports 8080-8090 if the first port is busy

### "Invalid client secret" Error

**Problem:** Authentication fails with invalid secret error.

**Solution:**
1. Verify you copied the secret **Value** (not Secret ID)
2. Check for extra spaces when pasting
3. If the secret expired, create a new one in Azure Portal
4. Update the secret in TaskNotes settings

### "Insufficient permissions" Error

**Problem:** You can't read or write calendar events.

**Solution:**
1. Verify all three permissions are added:
   - `Calendars.Read`
   - `Calendars.ReadWrite`
   - `offline_access`
2. For organizational accounts, ask an admin to grant consent
3. Try disconnecting and reconnecting to Microsoft Calendar

### Events Not Appearing

**Problem:** Calendar events don't show up in TaskNotes.

**Solution:**
1. Check that the calendar is enabled in TaskNotes settings
2. Verify the calendar has events in the configured date range (30 days back, 90 days forward)
3. Click the refresh button in the calendar view toolbar
4. Check the developer console (Ctrl+Shift+I) for error messages

### Token Expired / Need to Re-authenticate

**Problem:** You're prompted to reconnect frequently.

**Solution:**
- This is normal if you haven't used TaskNotes for a long time
- Refresh tokens expire after a period of inactivity
- Simply reconnect through settings when prompted

---

## API Rate Limits

### Microsoft Graph API Limits

Microsoft enforces the following limits:
- **10,000 requests per 10 minutes** per user
- **1,000 requests per 10 seconds** per application

TaskNotes implements several strategies to stay within limits:

1. **Incremental Sync (Delta Links)**
   - Only fetches changed events after the first sync
   - Dramatically reduces API calls for large calendars

2. **Exponential Backoff**
   - Automatically retries failed requests with increasing delays
   - Handles temporary rate limit errors (429 responses)

3. **Manual Refresh Rate Limiting**
   - Minimum 30 seconds between manual refresh button clicks
   - Prevents accidental API abuse

4. **Efficient Caching**
   - Events are cached locally
   - Automatic refresh every 15 minutes
   - Minimal API calls during normal operation

---

## Privacy & Data Storage

### What Data Does TaskNotes Store?

TaskNotes stores the following data **locally on your device**:

1. **OAuth Tokens** - Encrypted and stored in Obsidian's plugin data
2. **Calendar Events** - Cached locally for offline access and performance
3. **Sync Tokens** - Delta links for incremental sync
4. **Settings** - Your calendar selection preferences

### What Data Is Sent to Microsoft?

TaskNotes only communicates with Microsoft Graph API to:

1. Fetch your calendar list
2. Fetch calendar events
3. Create/update/delete events when you edit them
4. Refresh access tokens when they expire

**No data is sent to third-party servers.** All Microsoft communication is direct between your device and Microsoft's servers.

### Data Deletion

To delete all Microsoft Calendar data from TaskNotes:

1. In TaskNotes settings, go to Integrations → Microsoft Calendar
2. Click "Disconnect from Microsoft Calendar"
3. This will:
   - Revoke access tokens on Microsoft's servers
   - Delete cached calendar events
   - Remove sync tokens
   - Clear all stored credentials

---

## Advanced Configuration

### Using a Different Port

If port 8080 is already in use:

1. TaskNotes automatically tries ports 8081-8090
2. Check the console for which port was selected
3. If you need a specific port, edit the redirect URI in Azure:
   - Go to your app registration → Authentication
   - Update the redirect URI to `http://127.0.0.1:XXXX` (replace XXXX with your port)

### Multiple Calendars

TaskNotes supports displaying multiple Microsoft calendars:

1. All calendars are fetched during initial sync
2. Select which calendars to display in settings
3. Events from all selected calendars appear in TaskNotes
4. Each calendar's events are color-coded (blue for Microsoft events)

### Event Synchronization

**Sync Frequency:**
- Automatic: Every 15 minutes
- Manual: Click refresh button (limited to once per 30 seconds)

**What Gets Synced:**
- New events
- Updated events (title, time, location, description)
- Deleted events
- Moved events

**What Doesn't Get Synced:**
- Event attendees
- Event reminders (Microsoft-side)
- Event recurrence patterns (TaskNotes shows expanded instances)

---

## Comparison: Quick Setup vs Advanced Setup

| Feature | Quick Setup (License) | Advanced Setup (Your App) |
|---------|----------------------|---------------------------|
| **Setup Time** | 2 minutes | 15-20 minutes |
| **Azure Configuration** | None required | Full Azure app setup |
| **Ongoing Maintenance** | None | Secret rotation required |
| **Cost** | License fee | Azure app is free |
| **Privacy** | Uses TaskNotes credentials | Uses your own credentials |
| **Rate Limits** | Shared across users | Dedicated to your app |
| **Recommended For** | Most users | Power users, organizations |

---

## Support

### Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Enable developer console (Ctrl+Shift+I) and check for errors
3. Report issues on GitHub: https://github.com/callumzhong/tasknotes/issues

### Useful Resources

- [Microsoft Graph Calendar API Documentation](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [Azure App Registration Guide](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [OAuth 2.0 Device Flow](https://oauth.net/2/device-flow/)

---

## Appendix: Quick Reference

### Required Azure Settings

```
App Name: TaskNotes Calendar Integration
Redirect URI: http://127.0.0.1:8080
Platform: Web

Permissions:
- Calendars.Read (Delegated)
- Calendars.ReadWrite (Delegated)
- offline_access (Delegated)

Client Secret: Create and copy immediately
```

### TaskNotes Configuration

```
Settings → TaskNotes → Integrations → Microsoft Calendar
- Mode: Advanced Setup
- Client ID: <Your Application (client) ID>
- Client Secret: <Your client secret value>
- Click: Connect to Microsoft Calendar
```

---

**Last Updated:** 2025-10-19
**TaskNotes Version:** 3.25.3+
