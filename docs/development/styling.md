# Styling TaskNotes

TaskNotes shares an interface with Obsidian notes and Bases. Use the vault's
theme, interface font, and reading size. Task titles should lead, metadata should
remain readable, and colour should communicate status, urgency, or interaction.

## Source and tokens

`build-css.mjs` owns the stylesheet list and cascade order. Edit the files under
`styles/`, then run `npm run build-css`. The generated `styles.css` is ignored by
Git and included in the plugin build.

`styles/variables.css` contains the shared `--tn-` tokens:

- Backgrounds, text, borders, and semantic colours inherit Obsidian variables.
- Spacing uses 2, 4, 8, 12, 16, and 24 pixels.
- UI typography has a readable minimum and grows with the configured reading size.
- Corners and shadows inherit the theme. Ordinary list rows have no elevation;
  board cards use a subtle surface and border.
- Transitions are brief and disabled when reduced motion is requested.

Use `--tn-font-size-lg` for task titles and `--tn-font-size-md` for metadata.
Smaller sizes are for compact supporting controls. Keep note content and inline
widgets aligned with the editor's typography.

The old `--cs-` token layer and unused layout utility framework have been removed.
Use the semantic `--tn-` tokens for new snippets. `utilities.css` now contains the
shared settings buttons and editor compatibility rules; the separate
`static-style-utilities.css` is still used by runtime code.

## Components

Keep rules with their owning component and edit existing declarations before
adding overrides. Scope rules with TaskNotes classes, retain the existing BEM
hooks, and avoid `!important` and `:has()`.

List rows align their indicators with the title. Board cards put secondary
actions below the content so narrow columns have space for titles and properties.
Keep the user's selected properties and configured status and priority colours.
Completed tasks should remain readable without applying opacity to the whole row.

Calendar grid lines and date labels are secondary to events. A filled day number
identifies today. Task event titles inherit normal text colour while their borders,
backgrounds, and indicators retain task colours. Preserve the distinction between
recurrence previews and scheduled instances.

Task dialogs show active values beside their icons. The translated tooltip is the
accessible button name; the visible value is plain text and is excluded from the
accessible name to avoid duplication. Controls wrap at narrow widths.

## Review in Obsidian

From a worktree, target the running test vault explicitly:

```sh
OBSIDIAN_PLUGIN_PATH=/path/to/test-vault/.obsidian/plugins/tasknotes npm run build:test
obsidian vault=test plugin:reload id=tasknotes
obsidian vault=test dev:screenshot path=/absolute/path/review.png
obsidian vault=test dev:errors
```

Review list, default and compact board, swimlane, month/week/list calendar,
task dialog, settings, and embedded task views. Include long titles, multiple tags,
custom properties, completed tasks, and expanded relationships. Check light and
dark themes, narrow panes, mobile emulation, keyboard focus, and reduced motion.

Mobile emulation reloads Obsidian. Wait for the workspace and plugin to finish
loading before sending the next command, and restore desktop mode after review.

Run `npm run lint` and the tests for any presentation logic changed alongside CSS.
