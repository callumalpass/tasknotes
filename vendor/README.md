# Canonical TaskNotes resources

`mdbase-contracts/tasknotes.task-0.3.0-rc.22.json` is the mdbase-contracts
tasknotes.task 0.3.0-rc.22 provision that TaskNotes App pins. `scripts/verify-tasknotes-pack.mjs --check` verifies its
SHA-256 and the generated resource module before production and development
builds. The generated copy omits the legacy `target_type: any` from the two
unrestricted task seed links. The upstream provision retains its original digests.
Run the script without `--check` only when intentionally regenerating the embedded
resource module. Updating the pack requires an explicit new digest.

`@tasknotes/model@0.3.0-rc.22` (tasknotes.task 0.3.0-rc.6 and the TaskNotes settings record)
comes from npm and provides the shared settings path resolver. It generates the editable, collection-specific implementing type and
the settings record. Immutable contracts and schemas come from the catalog provision instead.
