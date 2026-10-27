# Canonical TaskNotes resources

`mdbase-contracts/tasknotes.task-0.3.0-rc.19.json` is the mdbase-contracts
tasknotes.task 0.3.0-rc.19 provision that TaskNotes App pins. `scripts/verify-tasknotes-pack.mjs --check` verifies its
SHA-256 and byte-for-byte embedded resources before production and development
builds. Run the script without `--check` only when intentionally regenerating
the embedded resource module. Updating the pack requires an explicit new digest.

`@tasknotes/model@0.3.0-rc.20` (tasknotes.task 0.3.0-rc.6 and the TaskNotes settings record)
comes from npm, and TaskNotes App uses the same version. It generates the editable, collection-specific implementing type and
the settings record. Immutable contracts and schemas come from the catalog provision instead.
