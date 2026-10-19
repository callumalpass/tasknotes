# Local Credentials and Runtime State

Implementation plan for [#2345](https://github.com/callumalpass/tasknotes/issues/2345), reported by @Oriery. This is a proposal, not a description of shipped behavior.

## Current behavior

OAuth credentials and account tokens already use Obsidian Secret Storage. The HTTP API authentication token still lives in `settings.apiAuthToken` and is written to `data.json`. Starting the API without a token generates and persists one. Settings saves also retain runtime keys such as Pomodoro state and calendar recovery queues.

Reducing redundant writes does not make `data.json` safe to publish. Until credential migration ships, users should not commit it unredacted. Removing a leaked token from the current file does not remove it from Git history; an exposed token should be rotated and clients updated.

## Stage 1: API credentials

### Storage contract

Introduce a dedicated API credential store backed by Obsidian Secret Storage, with an explicit configured/cleared state. Determine and test vault/device isolation before choosing the secret identifier: two vaults must not accidentally share or overwrite an API token. Do not reuse a Google or Microsoft OAuth credential slot.

The API service, integrations settings, endpoint-loader helpers, and MCP authentication should resolve credentials through the store rather than a shareable settings field. Runtime access may retain a compatibility accessor temporarily, but settings serialization must not copy that value back into `data.json`. Document any change to the public settings/API contract.

### Migration sequence

1. Read the existing plugin data safely; do not migrate from a failed or incomplete read.
2. If no local credential is configured or explicitly cleared, copy the legacy token without rotating it.
3. Verify the secret can be read back unchanged before removing the legacy field.
4. Remove the legacy token from persisted settings through the existing serialized save path.
5. Confirm future saves and runtime writes cannot reintroduce the legacy field.

If the secure write or read-back fails, preserve the legacy data, report the migration failure without printing the token, and do not generate a replacement credential. If cleanup fails after secure persistence, retry cleanup without rotating the token. Explicit clearing must not resurrect an old token from a synced file.

### Client experience

Keep a reveal/copy action in Integrations settings so HTTP API and MCP clients can retrieve their local token. Make generation, clearing, and rotation explicit. Never return the token from unauthenticated endpoints or include it in debug exports, notices, or logs.

For Secret Storage that is unavailable or fails, the proposed default is to keep the API disabled with an actionable error rather than silently fall back to plaintext. The supported-platform requirements and any explicitly authorized fallback need approval before implementation.

### Acceptance checks

- Existing HTTP API and MCP clients keep working after migration with the same token.
- Fresh installs persist generated credentials securely before starting the server.
- Explicit rotation invalidates the previous token; clearing cannot restore a stale synced token.
- Secure-write, read-back, cleanup, interrupted-startup, and retry failures do not lose credentials.
- Multiple vaults/devices have the documented isolation behavior.
- Settings saves, debug exports, settings synchronization, and endpoint documentation contain no token.
- Native Secret Storage checks run on supported desktop platforms; mocks alone are insufficient.

## Stage 2: classify runtime data before moving it

Do not move every non-settings key into an ignored file. Classify each key with an owner, version, migration rule, and sync/backup contract first.

| Data | Proposed classification | Required decision |
| --- | --- | --- |
| API token | Local credential | Secure storage and vault/device isolation |
| Last seen/notified release version | Device-local UI bookkeeping | Behavior after restoring or syncing a vault |
| Pomodoro runtime state and `lastPomodoroDate` | Mixed runtime state | Separate live session recovery from durable statistics; prevent two-device timer conflicts |
| Google calendar sync cursors | Account/calendar-specific cache | Invalidate on account changes; confirm whether local storage is appropriate |
| Task-event links, fingerprints, pending sync/deletion queues | Recovery/ownership state | Preserve idempotency, retry durability, and cross-device event ownership |
| Task time entries and completion history | Shared task data | Remain in task notes; do not move them to local state |
| Intentional status, priority, mapping, and view settings | Shared configuration | Remain versionable configuration |

Use a versioned local-state schema only after those decisions. Migration must be safe to rerun, preserve unknown/unmigrated data, and tolerate partial writes. Document which files can be versioned, which should be excluded, and how local-state backups and recovery work.

## Scope boundary

No API-token or runtime-state migration is implemented by this document. Prepare that change separately after the storage scope, fallback policy, and compatibility contract are agreed and native tests are available.
