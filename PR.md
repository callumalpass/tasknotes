# fix/projects-removal

## Ensure project removals persist from the edit dialog

When removing project assignments in the task edit modal, the frontmatter now updates correctly (including fully removing the property when the list is emptied). We also normalize link comparisons so different link syntaxes (e.g., angle‑bracket markdown links) do not cause false change detection.

Examples (illustrative):

- Removing the last project now deletes the `projects` property from frontmatter.
- `[Project](<path/to/Project.md>)` and `[[path/to/Project]]` compare as the same target for change detection.

## Changelog

- Normalize project link comparisons in the edit modal to handle angle‑bracket markdown links.
- Persist empty project lists by explicitly removing the `projects` field from frontmatter.
- Add a unit test to ensure empty project updates remove the property.

## Tests

- `./node_modules/.bin/jest tests/unit/services/TaskService.test.ts --runInBand`
