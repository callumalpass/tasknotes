# Integrations

TaskNotes integrates with external services and Obsidian's core plugins.

[← Back to Features](../features.md)

## Bases Core Plugin

TaskNotes v4 uses Obsidian's Bases core plugin for its main views (Task List, Kanban, Calendar, Agenda). Bases must be enabled from Settings → Core Plugins.

For details on Bases integration, see [Core Concepts](../core-concepts.md#bases-integration).

## External Calendars

TaskNotes supports bidirectional sync with Google Calendar and Microsoft Outlook via OAuth, plus read-only access to any calendar via ICS subscriptions.

For setup instructions, see [Calendar Integration](calendar-integration.md).

## HTTP API

A REST API enables external applications to create, update, and query tasks. Use this for automation, browser extensions, mobile apps, or custom integrations.

For API documentation, see [HTTP API](../HTTP_API.md).

## Webhooks

Send task data to external services when tasks are created, updated, or completed. Supports custom payload transformations for services like Slack, Discord, and Microsoft Teams.

For configuration, see [Webhooks](../webhooks.md).
