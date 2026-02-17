# TaskNotes Privacy Policy

Last updated: February 8, 2026

## Overview

TaskNotes is an Obsidian plugin that helps you manage tasks within your notes.

## Data Collection and Usage

TaskNotes does not collect, transmit, or share any of your data.

## Data Storage

Task and note content stays in your local Obsidian vault, and plugin settings are stored in Obsidian’s local configuration. By default, TaskNotes does not send vault data to external services.

## Data Deletion

You can stop TaskNotes processing by disabling the plugin, and remove plugin configuration by uninstalling it. Your notes remain in your vault under your control.

## Network Requests (Optional Features)

TaskNotes operates locally by default, but includes optional features that make network requests when you enable them:

**Optional network features:**

OAuth calendar integration (Google or Microsoft) uses OAuth 2.0 (with PKCE) to authenticate and stores access/refresh tokens locally on your device. If enabled, TaskNotes fetches calendar events and can update external events when you choose sync actions.

ICS subscriptions fetch event data from URLs you configure. Webhooks send task event payloads to endpoints you configure. License validation sends your license key to Lemon Squeezy for validity checks, caches results locally for 24 hours, and applies a 7-day grace period when validation is temporarily unavailable.

**OAuth Credentials:**

TaskNotes includes bundled OAuth client credentials for quick setup. These app credentials are public identifiers and do not expose your account. Authentication and calendar access are controlled by your user tokens. You can also use your own OAuth credentials in advanced setup.

**Third-Party Services:**

- **Lemon Squeezy**: License validation only (https://www.lemonsqueezy.com/privacy)
- **Google**: OAuth authentication and Calendar API access (https://policies.google.com/privacy)
- **Microsoft**: OAuth authentication and Calendar API access (https://privacy.microsoft.com/privacystatement)

**What we never do:**
TaskNotes does not run analytics/telemetry collection, does not read your notes remotely, and does not store your calendar data on TaskNotes servers. Calendar requests go directly between your device and the provider APIs you connect.

## Changes to Privacy Policy

We may update this policy. Changes will be posted in this file with an updated date.

## Contact

For questions or concerns about privacy, please open an issue on GitHub:

https://github.com/callumalpass/tasknotes/issues

## Open Source

TaskNotes is open source software. You can review the code at https://github.com/callumalpass/tasknotes to verify these privacy practices.
