# Canonical TaskNotes resources

`mdbase-contracts/tasknotes.task-0.3.0-rc.17.json` is the same published provision
pinned by TaskNotes App. `scripts/verify-tasknotes-pack.mjs --check` verifies its
SHA-256 and byte-for-byte embedded resources before production and development
builds. Run the script without `--check` only when intentionally regenerating
the embedded resource module. Updating the pack requires an explicit new digest.

`@tasknotes/model@0.3.0-rc.15` is installed from npm and pinned by package-lock.json
integrity; it is byte-identical to the model snapshot vendored by TaskNotes App. It generates the editable,
collection-specific implementing type. Immutable contracts and schemas come
from the catalog provision instead.
