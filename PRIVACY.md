# TaskNotes Privacy Policy

Last updated: February 21, 2026

## Overview

TaskNotes is an Obsidian plugin. It stores task data in your local vault files.

## Data Collection and Usage

TaskNotes does not include telemetry or analytics collection.

## Local Storage

Task and note content stays in your local Obsidian vault.
Plugin settings are stored in Obsidian's local plugin configuration.

## Optional Network Features

TaskNotes is local-first. Network requests occur only when you enable features that require them.

Optional network features:

- OAuth calendar integration (Google/Microsoft): fetches and updates calendar events through provider APIs.
- ICS subscriptions: fetches events from configured ICS URLs.
- Webhooks: sends event payloads to webhook endpoints you configure.
- API docs UI (`/api/docs/ui`): loads Swagger UI assets from `unpkg.com` in your browser.

## OAuth Credentials and Tokens

- OAuth client credentials are configured by you in TaskNotes settings.
- Access and refresh tokens are stored locally on your device.
- You can disconnect providers at any time to revoke TaskNotes access.

## Third-Party Services (When Enabled)

- Google APIs: https://policies.google.com/privacy
- Microsoft APIs: https://privacy.microsoft.com/privacystatement
- Any ICS host or webhook endpoint you configure

## What TaskNotes Does Not Do

- No TaskNotes-hosted cloud sync service
- No remote storage of your vault content by TaskNotes
- No telemetry pipeline sending usage metrics

## Data Deletion

You can stop TaskNotes processing by disabling the plugin.
You can remove plugin settings by uninstalling the plugin.
Your notes remain in your vault.

## Changes to This Policy

This policy may be updated. Changes are published in this file with a new date.

## Contact

For privacy questions, open an issue:

https://github.com/callumalpass/tasknotes/issues

## Open Source Verification

TaskNotes is open source. You can inspect the implementation:

https://github.com/callumalpass/tasknotes
