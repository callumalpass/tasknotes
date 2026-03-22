---
id: 'github:callumalpass/tasknotes:issue:1660'
provider: github
kind: issue
key: '1660'
external_ref: callumalpass/tasknotes#1660
repo: callumalpass/tasknotes
number: 1660
remote_state: OPEN
remote_title: >-
  [Bug]: OAuth Authentication fails with "Unknown encoding base64url" error
remote_author: rosystain
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1660'
local_status: triaged
priority: high
difficulty: easy
risk: low
summary: >-
  OAuth PKCE flow fails with "Unknown encoding base64url" because Node.js Buffer.toString("base64url")
  is not available in the Obsidian runtime (Electron/Chromium), which uses an older or restricted
  Buffer implementation.
notes: |-
  Root cause:
  - In src/services/OAuthService.ts lines 230 and 242, the code uses
    `randomBytes(32).toString("base64url")` and `Buffer.from(hash).toString("base64url")`.
    The "base64url" encoding for Buffer.toString() was added in Node.js 15.7+ but Obsidian's
    Electron runtime may not support it, causing the "Unknown encoding base64url" error.

  Suggested fix (preferred):
  - Replace `.toString("base64url")` with `.toString("base64")` followed by manual base64url
    conversion: `.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")`. The subsequent
    replace calls in the existing code already do this transformation but are unreachable because
    the toString("base64url") throws first.

  Fallback options:
  - Use the Web Crypto API (crypto.subtle) instead of Node.js crypto for PKCE generation, which
    is available in all modern Electron/Chromium versions.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
