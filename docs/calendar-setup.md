# Calendar Integration Setup

TaskNotes supports Google Calendar and Microsoft Calendar integration via OAuth 2.0.

## Quick Setup (Recommended)

TaskNotes includes built-in OAuth credentials. Simply:

1. Go to Settings → Integrations → Calendar
2. Click "Connect to Google Calendar" or "Connect to Microsoft Calendar"
3. Authorize access in your browser

## Advanced Setup (Your Own Credentials)

If you prefer to use your own OAuth application:

### Google Calendar

1. **Create OAuth App**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing
   - Enable Google Calendar API
   - Create OAuth 2.0 credentials (Desktop application type)

2. **Configure Credentials**
   - Copy Client ID and Client Secret
   - In TaskNotes Settings → Integrations → Calendar:
     - Select "Advanced Setup"
     - Paste your Client ID
     - Paste your Client Secret
   - Click "Connect to Google Calendar"

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
     - Select "Advanced Setup"
     - Paste your Client ID
     - Paste your Client Secret
   - Click "Connect to Microsoft Calendar"

## Security Notes

- Quick Setup uses OAuth 2.0 Device Flow (no secrets in plugin code)
- Advanced Setup stores your credentials locally in Obsidian's data folder
- Tokens are stored securely and refreshed automatically
- Disconnect at any time to revoke access

## Troubleshooting

**"Failed to connect"**
- Verify Client ID and Secret are correct
- Check redirect URI is configured: `http://localhost:8080`
- Ensure required API permissions are granted

**"Failed to fetch events"**
- Disconnect and reconnect to refresh tokens
- Check calendar permissions in Google/Microsoft settings

**Connection lost after Obsidian restart**
- Tokens are persisted - you should not need to reconnect
- If you do, there may be a file permissions issue with your vault
