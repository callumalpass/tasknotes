# TaskNotes Privacy Policy

Last updated: February 8, 2026

## Overview

TaskNotes is an Obsidian plugin that helps you manage tasks within your notes.

## Data Collection and Usage

TaskNotes does not collect, transmit, or share any of your data.

## Data Storage

- All task and note data remains local to your Obsidian vault
- Plugin settings are stored locally in Obsidian's configuration
- No data is sent to external servers or third parties

## Data Deletion

You can delete your data at any time:
- Disable the plugin to stop processing tasks
- Remove the plugin to delete all plugin settings
- Your notes remain in your Obsidian vault under your control

## Network Requests (Optional Features)

TaskNotes operates locally by default, but includes optional features that make network requests when you enable them:

**Optional network features:**

- **OAuth Calendar Integration**: If you connect Google Calendar or Microsoft Calendar, TaskNotes:
  - Uses OAuth 2.0 to authenticate with Google/Microsoft
  - Stores OAuth access and refresh tokens locally in plugin data on your device
  - Fetches calendar events from your connected calendars
  - Can create/update calendar events when you choose to sync tasks
  - Uses bundled OAuth credentials (client ID and secret) for Quick Setup mode
  - All OAuth flows are industry-standard and use PKCE for enhanced security
- **ICS Calendar Subscriptions**: If you configure calendar subscriptions, TaskNotes fetches calendar data from the URLs you provide (e.g., Google Calendar, Outlook)
- **Webhooks**: If you configure webhooks, TaskNotes sends task event data to the webhook URLs you specify
- **License Validation**: If you use a TaskNotes license key, the plugin:
  - Validates your license key with Lemon Squeezy (our payment processor)
  - Sends only your license key to verify it's valid and active
  - Caches the validation result locally for 24 hours to reduce API calls
  - Includes a 7-day grace period if validation server is temporarily unavailable
  - Does not send any personal information except what's associated with your license key

**OAuth Credentials:**

- TaskNotes bundles OAuth client credentials (client ID and client secret) for easy setup
- These credentials are public (visible in the plugin code) and identify the app to Google/Microsoft
- Your actual authentication and calendar data remain secure through OAuth access tokens
- You can optionally provide your own OAuth credentials in Advanced Setup mode

**Third-Party Services:**

- **Lemon Squeezy**: License validation only (https://www.lemonsqueezy.com/privacy)
- **Google**: OAuth authentication and Calendar API access (https://policies.google.com/privacy)
- **Microsoft**: OAuth authentication and Calendar API access (https://privacy.microsoft.com/privacystatement)

**What we never do:**

- No analytics or tracking beyond license validation
- No telemetry data collection
- No access to your notes or task data
- Your notes remain local to your device
- We never access your calendar data - all calendar requests go directly to Google/Microsoft
- We never store your calendar data on our servers (we don't have any servers)

## Changes to Privacy Policy

We may update this policy. Changes will be posted in this file with an updated date.

## Contact

For questions or concerns about privacy, please open an issue on GitHub:
- https://github.com/callumalpass/tasknotes/issues

## Open Source

TaskNotes is open source software. You can review the code at https://github.com/callumalpass/tasknotes to verify these privacy practices.
