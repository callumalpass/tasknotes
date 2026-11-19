# TaskNotes Privacy Policy

Last updated: November 7, 2026

## Overview

TaskNotes is an Obsidian plugin, with web and mobile apps. The plugin stores task data in your local vault files. This policy also covers the optional hosted TaskNotes Calendar service.

TaskNotes is run by Callum Alpass, in Melbourne, Australia.

## Data Collection and Usage

TaskNotes does not include telemetry or analytics collection. TaskNotes Calendar keeps the operational logs described below.

## Local Storage

Task and note content stays in your local Obsidian vault.
Plugin settings are stored in Obsidian's local plugin configuration.

## Optional Network Features

TaskNotes is local-first. Network requests occur only for enabled features that require them.
Some enabled integrations perform periodic background refreshes, such as calendar provider sync and ICS subscription updates.

Optional network features:

- Release checks: when enabled, TaskNotes checks GitHub once on startup for newer compatible TaskNotes releases. This is enabled by default and can be disabled in TaskNotes settings.
- OAuth calendar integration (Google/Microsoft): fetches and updates calendar events through provider APIs.
- Sign in with Google: fetches and updates Google Calendar events through TaskNotes Calendar, described below.
- ICS subscriptions: fetches events from configured ICS URLs.
- Webhooks: sends event payloads to webhook endpoints you configure.
- API docs UI (`/api/docs/ui`): loads Swagger UI assets from `unpkg.com` in your browser.
- Downloadable interface languages (experimental builds only): builds explicitly configured with a language-pack host download the selected language, or the system language when selected, if a compatible local pack is unavailable. English is bundled. Packs are validated and cached locally for offline use; there is no periodic refresh. Requests identify the catalogue version and language but do not send notes, tasks, or other vault content. The host receives normal connection metadata, such as your IP address. Ordinary builds bundle all supported languages and do not make these requests.

## TaskNotes Calendar (hosted service)

TaskNotes Calendar is an optional service that shows your Google Calendar events in the TaskNotes web and mobile apps, and in the Obsidian plugin when you choose **Sign in with Google**, and lets you create, edit and delete them there. It is only used if you sign in to it.

**What we receive from Google.** When you sign in, we receive your Google account identifier, email address and name. When you connect calendars, we receive access to the list of calendars you subscribe to and to the events on them.

**What we store.**

- Your Google account identifier, email address and name, until you delete your account.
- Google access credentials, encrypted, until you disconnect, reconnect or delete your account.
- The details of your calendars, such as their names, until you disconnect or delete your account.
- Digests of your device sessions, which expire after 30 days without use and after 90 days at most.

**What we do not store.** Your calendar events pass through the service when you view or change them. They are not saved on our servers.

**Logs.** Our logs record the route, method, status, duration and any error code of each request. They do not include your identity, IP address, calendar data or event content. Logs are kept for up to 7 days.

**Who processes this data.** The service runs on Cloudflare, which hosts it and its database. Calendar data is exchanged with Google. We do not sell your data, use it for advertising, or share it with anyone else, except where the law requires it.

**Your choices.** You can disconnect your calendars or delete your account in the app's settings, or in the plugin's Google Calendar settings, at any time. Either one deletes our stored Google credential and asks Google to revoke our access. Deleting your account removes the data listed above, apart from a keyed digest of your identity, kept for about an hour so that sign-ins already in progress cannot recreate the account. Deleted data can remain in database backups for up to 30 days. You can also remove access from your Google Account's linked apps page. Deleting your account does not change your Google events or your tasks.

**Google API Services.** TaskNotes' use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

## OAuth Credentials and Tokens

This section covers the Obsidian plugin when it connects to calendar providers directly, using your own OAuth application. If you choose **Sign in with Google** instead, the plugin uses TaskNotes Calendar, described above. Google's tokens then stay with that service, and Obsidian Secret Storage holds only this device's session with it. Calendar events are kept in memory and are not written to your vault.

- OAuth client IDs and client secrets are configured by you in TaskNotes settings.
- OAuth client credentials, access tokens, and refresh tokens are stored locally in Obsidian Secret Storage, which is encrypted at rest when supported by the operating system.
- These values are not written to TaskNotes' `data.json`.
- Secret Storage is local to the Obsidian installation and vault, so another device may require its own credentials and calendar connection.
- You can disconnect providers at any time to revoke TaskNotes access. Disconnecting retains the OAuth app credentials for reconnection; **Forget saved credentials** removes them from Secret Storage.

## ICS Subscription Credentials

- Passwords for authenticated ICS subscriptions are stored in Obsidian Secret Storage and are not written to `data.json`. The username is stored with the subscription settings.
- Credentials are sent only to the subscription's `https://` URL.
- Deleting the subscription, or setting its authentication to **None**, removes the saved password.

## Third-Party Services (When Enabled)

- Google APIs: https://policies.google.com/privacy
- Cloudflare (TaskNotes Calendar): https://www.cloudflare.com/privacypolicy/
- Microsoft APIs: https://privacy.microsoft.com/privacystatement
- GitHub: https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement
- Any ICS host or webhook endpoint you configure
- The language-pack host configured by the distributor of an experimental downloadable-language build

## What TaskNotes Does Not Do

- No TaskNotes-hosted sync of your tasks or notes
- No remote storage of your vault content by TaskNotes
- No telemetry pipeline sending usage metrics

## Data Deletion

You can stop TaskNotes processing by disabling the plugin.
You can remove plugin settings by uninstalling the plugin. Before uninstalling, disconnect calendar providers and use **Forget saved credentials** to remove OAuth values from Obsidian Secret Storage.
Your notes remain in your vault.

To delete TaskNotes Calendar data, delete your account in the app's settings or the plugin's Google Calendar settings, as described above.

## Changes to This Policy

This policy may be updated. Changes are published in this file with a new date.

## Contact

For privacy questions, open an issue:

https://github.com/callumalpass/tasknotes/issues

## Open Source Verification

TaskNotes is open source. You can inspect the implementation:

https://github.com/callumalpass/tasknotes
