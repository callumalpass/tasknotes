# Canonical TaskNotes resources

`mdbase-contracts/tasknotes.task-0.3.0-rc.12.json` is the same published provision
pinned by TaskNotes App. `scripts/verify-tasknotes-pack.mjs --check` verifies its
SHA-256 and byte-for-byte embedded resources before production and development
builds. Run the script without `--check` only when intentionally regenerating
the embedded resource module. Updating the pack requires an explicit new digest.

`tasknotes-model-0.3.0-rc.11.tgz` is the exact model snapshot vendored by TaskNotes
App, installed through package-lock.json integrity. It generates the editable,
collection-specific implementing type. Immutable contracts and schemas come
from the catalog provision instead.
