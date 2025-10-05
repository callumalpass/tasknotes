import { readFileSync, writeFileSync } from "fs";

// Read current version from manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const version = manifest.version;

// Generate the TypeScript file that imports the current version's release notes
const content = `// Auto-generated file - do not edit manually
// This file is regenerated during the build process to import the current version's release notes

import releaseNotes from "../docs/releases/${version}.md";

export const CURRENT_VERSION = "${version}";
export const CURRENT_RELEASE_NOTES = releaseNotes;
`;

// Write to src/releaseNotes.ts
writeFileSync("src/releaseNotes.ts", content);

console.log(`✓ Generated release notes import for version ${version}`);
