# Calendar Integration Setup

TaskNotes supports Google Calendar and Microsoft Calendar integration via OAuth 2.0.

<!-- TEMPORARILY DISABLED FOR BETA RELEASE
## Quick Setup

TaskNotes bundles OAuth client IDs (and the Google client secret) so you can connect without creating your own apps. You'll need an active TaskNotes license to unlock these built-in credentials.

1. Go to Settings → Integrations → Calendar.
2. In the license card, ensure **Quick Setup** is selected and enter your Lemon Squeezy license key.
3. Click **Validate License** (or blur the input) and wait for the success notice.
4. Use the Google or Microsoft card to click **Connect** and authorize access in your browser.
   - Google uses the OAuth loopback flow and will reopen to `http://127.0.0.1:<port>` to finish the login.
   - Microsoft uses the OAuth device-flow and will show you a short code and link.
-->

## Setup (Your Own OAuth Credentials)

To connect your calendars, you'll need to create OAuth applications with Google and/or Microsoft.

### Google Calendar

<iframe width="560" height="315" src="https://www.youtube.com/embed/DzMN1Wu2P-g?start=210" title="How to set up Google Calendar OAuth" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

*Video by [@antoneheyward](https://www.youtube.com/@antoneheyward)*

1. **Create OAuth App**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing
   - Enable Google Calendar API
   - Create OAuth 2.0 credentials (Desktop application type)

2. **Configure Credentials**
   - Copy Client ID and Client Secret
   - In TaskNotes Settings → Integrations → Calendar:
     - Paste your Client ID in the Google Calendar card
     - Paste your Client Secret in the Google Calendar card
   - Click "Connect Google Calendar"

### Microsoft Calendar

1. **Create Azure App Registration**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to "App registrations" → "New registration"
   - Name: Choose any name (e.g., "TaskNotes")
   - Supported account types: Select appropriate option for your use case
   - Redirect URI: Add "http://localhost:8080" (Platform: Web)

2. **Configure API Permissions**
   - In your app registration, go to "API permissions"
   - Add permissions:
     - `Calendars.Read`
     - `Calendars.ReadWrite`
     - `offline_access`
   - Grant admin consent if required

3. **Get Credentials**
   - In "Overview", copy the Application (client) ID
   - In "Certificates & secrets", create a new client secret
   - Copy the secret value immediately (shown only once)

4. **Configure TaskNotes**
   - In TaskNotes Settings → Integrations → Calendar:
     - Paste your Client ID in the Microsoft Calendar card
     - Paste your Client Secret in the Microsoft Calendar card
   - Click "Connect Microsoft Calendar"

## Security Notes

- Your OAuth credentials are stored locally in Obsidian's data folder
- Access tokens are stored securely and refreshed automatically
- Calendar data is synced directly between Obsidian and your calendar provider
- Disconnect at any time to revoke access

## Troubleshooting

**"Failed to connect"**

- Verify Client ID and Secret are correct
- Check redirect URI is configured: `http://localhost:8080`
- Check no other services are running on port 8080 
  - You may need to disable the API integration and restart if it is using port 8080. You will be able to re-enable the API after calendar authorization. 
- Ensure required API permissions are granted

**"Failed to fetch events"**

- Disconnect and reconnect to refresh tokens
- Check calendar permissions in Google/Microsoft settings

**Connection lost after Obsidian restart**

- Tokens are persisted - you should not need to reconnect
- If you do, there may be a file permissions issue with your vault
