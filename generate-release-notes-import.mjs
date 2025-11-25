import { readFileSync, writeFileSync, readdirSync } from "fs";
import { execSync } from "child_process";

// Read current version from manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const currentVersion = manifest.version;

// Parse semantic version (supports pre-release versions like 4.0.0-beta.0)
function parseVersion(version) {
	const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-[\w.]+)?$/);
	if (!match) return null;
	return {
		major: parseInt(match[1]),
		minor: parseInt(match[2]),
		patch: parseInt(match[3]),
		full: version
	};
}

// Get git tag date for a version
function getVersionDate(version) {
	try {
		const output = execSync(`git log -1 --format=%aI ${version}`, { encoding: 'utf8' }).trim();
		return output;
	} catch (error) {
		// If tag doesn't exist, return null
		return null;
	}
}

// Get all release note files and bundle versions since last minor (includes pre-release versions)
const releaseFiles = readdirSync("docs/releases")
	.filter(f => f.match(/^\d+\.\d+\.\d+(?:-[\w.]+)?\.md$/))
	.map(f => f.replace('.md', ''))
	.map(v => parseVersion(v))
	.filter(v => v !== null)
	.sort((a, b) => {
		if (a.major !== b.major) return b.major - a.major;
		if (a.minor !== b.minor) return b.minor - a.minor;
		return b.patch - a.patch;
	});

const current = parseVersion(currentVersion);
if (!current) {
	console.error(`Invalid version format: ${currentVersion}`);
	process.exit(1);
}

// Find all versions in current minor series (e.g., 3.25.x)
const currentMinorVersions = releaseFiles.filter(v =>
	v.major === current.major && v.minor === current.minor
);

// Find all versions from previous minor series (e.g., 3.24.x)
const previousMinorVersions = releaseFiles.filter(v =>
	v.major === current.major && v.minor === current.minor - 1
);

// Bundle current minor + all patches from previous minor
const versionsToBundle = [
	...currentMinorVersions.map(v => v.full),
	...previousMinorVersions.map(v => v.full)
];

// Fetch dates and sort by date (newest first)
const versionsWithDates = versionsToBundle.map(version => ({
	version,
	date: getVersionDate(version)
})).sort((a, b) => {
	// Versions without dates go to the end
	if (!a.date && !b.date) return 0;
	if (!a.date) return 1;
	if (!b.date) return -1;
	// Sort by date descending (newest first)
	return new Date(b.date).getTime() - new Date(a.date).getTime();
});

// Generate imports and metadata
const imports = versionsWithDates.map(({ version }, index) =>
	`import releaseNotes${index} from "../docs/releases/${version}.md";`
).join('\n');

const releaseNotesArray = versionsWithDates.map(({ version, date }, index) => {
	return `	{
		version: "${version}",
		content: releaseNotes${index},
		date: ${date ? `"${date}"` : 'null'},
		isCurrent: ${version === currentVersion}
	}`;
}).join(',\n');

// Generate the TypeScript file
const content = `// Auto-generated file - do not edit manually
// This file is regenerated during the build process to bundle release notes

${imports}

export interface ReleaseNoteVersion {
	version: string;
	content: string;
	date: string | null;
	isCurrent: boolean;
}

export const CURRENT_VERSION = "${currentVersion}";
export const RELEASE_NOTES_BUNDLE: ReleaseNoteVersion[] = [
${releaseNotesArray}
];
`;

// Write to src/releaseNotes.ts
writeFileSync("src/releaseNotes.ts", content);

console.log(`✓ Generated release notes bundle for version ${currentVersion}`);
console.log(`  Bundled versions: ${versionsToBundle.join(', ')}`);
