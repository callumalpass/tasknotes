import { uiData } from "../../i18n/dataText";

/** Explicit defaults for a new setup; existing configs retain the spec defaults. */
export const NEW_TYPES_FOLDER = uiData(
	"_mdbase/types",
	"Vault-relative metadata folder, not UI prose"
);
export const NEW_CONTRACTS_FOLDER = "_mdbase/contracts";
export const MDBASE_README_PATH = "_mdbase/README.md";
export const MDBASE_README = `# mdbase

This folder holds the setup for this collection: the types that describe your
notes, the data contracts apps rely on, and each app's settings. Apps such as
TaskNotes create and update these files for you.

You can open and read anything here. Avoid deleting or renaming files unless you
know what they're for: apps use them to understand your notes.

- \`types/\`: what each kind of note looks like (for example, a task).
- \`contracts/\` and \`schemas/\`: shared definitions apps agree on.
- \`settings/\`: one file per app, holding settings everyone using that app here shares.

Learn more at https://mdbase.dev.
`;
