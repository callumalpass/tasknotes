# fix-angle-brackets

## Angle Bracket Links + Project Titles

This change set improves angle‑bracket link handling, project title display, and dependency link normalization. The goal is to make internal link resolution consistent across filters, overlays, project links, and dependency displays.

Examples (illustrative):

- Angle‑bracket links: `[Spec](<Projects/Client X/Spec.md>)` and `<Projects/Client X/Spec.md>` now resolve like regular internal links.
- Project title display: a project link like `[[Projects/Client X]]` shows frontmatter `title` (e.g., "Client X Roadmap") instead of the raw filename/path; if no `title` is set, the existing display text/alias/basename remains.
- Dependency normalization: dependency values such as `[[Ops/Deploy Plan]]`, `[Deploy](<Ops/Deploy Plan.md>)`, or `Ops/Deploy Plan.md` normalize to the same target and render consistently.

## Changelog

### Links & Titles

- Enhanced link parsing to support `<...>` autolinks and angle-bracket paths in markdown links, including URL decoding and `.md` handling.
- Added `getProjectDisplayName` for consistent project display names across markdown links, wikilinks, and plain text.
- Normalized internal link resolution in overlays and detection to handle angle-bracket markdown links.
- Updated link rendering to:
  - resolve relative links using `sourcePath`,
  - normalize `data-href` with parsed paths,
  - prefer frontmatter `title` when the display text is just the filename/path,
  - support optional custom navigation hooks.
- Group-by headers now:
  - support markdown links,
  - normalize paths via `parseLinkToPath`,
  - prefer frontmatter `title` when applicable.
- Filters, stats, and task services now use `getProjectDisplayName` for consistent project titles.
- Updated call sites to pass `sourcePath` where needed (task cards, task modals, selector modals).

### Dependencies

- Dependency entries are normalized via `parseLinkToPath` to handle wikilinks, markdown links, and angle-bracket variants.
- Dependency resolution now tries multiple candidates (with/without `.md`, `parseLinktext` variants) for more reliable linking.
- Task modal normalizes dependencies before resolving them to improve display robustness.

### Tests

- Added unit coverage for angle-bracket link parsing and project display name resolution in `linkUtils`.

### Link anchors

- `parseLinkToPath` now strips `#heading`/`#^block` fragments so file resolution stays stable.
- Internal link rendering preserves anchors separately (`data-href-fragment`) and uses the full `path#anchor` for navigation and hovers.
- Relative project links resolve with a `sourcePath` when available for consistent display names.
