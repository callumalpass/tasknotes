# mdbase upgrade fixtures

Exact collections written by shipped builds, used by
`tests/unit/services/mdbaseReleaseUpgrades.test.ts`. Do not edit them; capture
new ones instead.

- `v4-*`: TaskNotes 4.13.6 enabling the mdbase integration (mdbase v0.2).
- `beta0-*`, `beta3-*`: 5.0.0-beta.0 and beta.3 creating a collection
  (tasknotes.task 0.3.0-rc.3, @tasknotes/model 0.3.0-rc.9).
- `beta0-kept-v4-*`: a v4 collection after beta.0, which left it at v0.2.
- `beta3-from-beta0-*`: a beta.0 collection after beta.3.
- `app-*`: TaskNotes App collection setup through Connect's engine
  (mdbase-rs 88d4a21): pack rc.12 (`app-rc12`), the same with a
  generator-written task type (`app-rc12-f5`), and upgraded to rc.17
  (`app-rc17`). `.mdbase/` state is omitted.
- `beta3-app-then-beta3-*`: a beta.3 collection approved by TaskNotes App
  (pack rc.17), then loaded again by beta.3, which did not recognize the updated
  type and wrote a second, rc.3 `tasknotes-task` type and rc.3 support files.

`-default` fixtures use each build's default settings; `-custom` fixtures map
`due` to `deadline`, add a number property and a skipped `cancelled` status.
Additional captured collections (also immutable):

- `meaning-policy/`: COMPAT-02 before-state captured by the compat migration audit from beta.0 with custom `uid`, archive tag `cold`, rolling occurrence policy and `P90D` horizon; `.mdbase/` state omitted.
- `meaning-folders/`: MATRIX-02 live 4.13.7 → beta.5 folder-exclusion collection; original task/template bytes retained and transient state omitted. Includes a PATHS-04 real beta.0 `relationships.base` capture from the paths audit, which was invisible before additive Base configuration.
- `meaning-minimal/`: MATRIX-08 live 4.13.7 → beta.5 collection with one dateless tag-identified task; captured metadata and task bytes retained, `.obsidian/` and `.mdbase/` state omitted.

Each build ran its own `MdbaseSpecService` (`generate()` for new collections,
`initialize()` on load) against an in-memory vault holding two task notes and
one unrelated note.
