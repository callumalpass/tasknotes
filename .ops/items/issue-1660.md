---
id: issue-1660
provider: github
kind: issue
key: callumalpass/tasknotes#1660
external_ref: https://github.com/callumalpass/tasknotes/issues/1660
repo: callumalpass/tasknotes
number: 1660
remote_state: open
remote_title: "[Bug]: OAuth Authentication fails with \"Unknown encoding base64url\" error"
remote_author: "rosystain"
remote_url: https://github.com/callumalpass/tasknotes/issues/1660
local_status: triaged
priority: high
difficulty: medium
risk: medium
summary: "OAuth PKCE flow fails with 'Unknown encoding base64url' on some Node.js/Electron versions that don't support Buffer.toString('base64url')"
notes: |
  ## Root cause / Scope
  `OAuthService.ts` uses `Buffer.toString("base64url")` (lines 230 and 242) for PKCE code verifier and challenge generation. The `"base64url"` encoding was added to Node.js's `Buffer` in v14.18.0 / v16.0.0. Older Electron versions bundled with Obsidian may use a Node.js version that does not support this encoding, throwing `"Unknown encoding base64url"`. The error affects both Google Calendar and Microsoft Outlook OAuth connections, which is consistent with both using the same `OAuthService.generateCodeVerifier()` and `generateCodeChallenge()` methods. The code already manually replaces `+` with `-` and `/` with `_` after the base64url call (lines 231-233, 243-245), suggesting an awareness of the encoding quirks, but the `toString("base64url")` call itself fails before those replacements can run.

  ## Suggested fix / Approach
  Replace `Buffer.toString("base64url")` with a manual base64→base64url conversion that works across all Node.js/Electron versions: use `Buffer.toString("base64")` then chain `.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")`. The manual replacement lines that follow the `toString("base64url")` calls are redundant if this approach is used. This is a straightforward two-line fix in `OAuthService.ts` that removes the version-dependent encoding.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
