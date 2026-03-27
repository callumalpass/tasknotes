import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
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

// Parse CHANGELOG.md and extract all version entries
function parseChangelog() {
	const changelog = readFileSync("CHANGELOG.md", "utf8");
	const versions = [];
	const versionRegex = /^## \[(\d+\.\d+\.\d+(?:-[\w.]+)?)\]/gm;
	let match;

	while ((match = versionRegex.exec(changelog)) !== null) {
		versions.push(match[1]);
	}

	return versions;
}

// Extract release notes content for a specific version from CHANGELOG.md
function extractVersionNotes(version) {
	const changelog = readFileSync("CHANGELOG.md", "utf8");
	const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const versionHeaderRegex = new RegExp(`^## \\[${escapedVersion}\\].*$`, 'm');

	const match = changelog.match(versionHeaderRegex);
	if (!match) return null;

	const startIndex = match.index + match[0].length;
	const remainingContent = changelog.slice(startIndex);

	// Find the next version header or the "---" separator or end of file
	const nextHeaderMatch = remainingContent.match(/^## \[|^---/m);
	const endIndex = nextHeaderMatch ? nextHeaderMatch.index : remainingContent.length;

	return remainingContent.slice(0, endIndex).trim();
}

// Create missing release notes file from CHANGELOG.md
function createMissingReleaseNotes(version) {
	const filePath = `docs/releases/${version}.md`;

	if (existsSync(filePath)) {
		return false; // Already exists
	}

	const notes = extractVersionNotes(version);
	if (!notes) {
		console.warn(`  ⚠ No changelog entry found for ${version}, skipping`);
		return false;
	}

	// Determine if this is a fork release (check if notes mention "fork" or version contains "fork")
	const isFork = version.includes('fork') ||
		notes.toLowerCase().includes('fork') ||
		parseVersion(version)?.major === 4; // Assume 4.x are fork versions

	const content = `# TaskNotes ${version}${isFork ? ' (Fork)' : ''}

${isFork ? '*This release is from the [cybersader/tasknotes](https://github.com/cybersader/tasknotes) fork.*\n\n' : ''}${notes}
`;

	writeFileSync(filePath, content);
	console.log(`  ✓ Created missing release notes: ${filePath}`);
	return true;
}

// Get all release note files and bundle versions since last minor (includes pre-release versions)
let releaseFiles = readdirSync("docs/releases")
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

// Parse CHANGELOG.md to find versions that should have release notes
const changelogVersions = parseChangelog()
	.map(v => parseVersion(v))
	.filter(v => v !== null);

// Find versions in CHANGELOG that are in current or previous minor series but missing release notes
const versionsToCheck = changelogVersions.filter(v =>
	v.major === current.major &&
	(v.minor === current.minor || v.minor === current.minor - 1)
);

// Check for and create missing release notes
let createdAny = false;
for (const v of versionsToCheck) {
	const filePath = `docs/releases/${v.full}.md`;
	if (!existsSync(filePath)) {
		if (createMissingReleaseNotes(v.full)) {
			createdAny = true;
		}
	}
}

// Re-scan release files if we created any
if (createdAny) {
	releaseFiles = readdirSync("docs/releases")
		.filter(f => f.match(/^\d+\.\d+\.\d+(?:-[\w.]+)?\.md$/))
		.map(f => f.replace('.md', ''))
		.map(v => parseVersion(v))
		.filter(v => v !== null)
		.sort((a, b) => {
			if (a.major !== b.major) return b.major - a.major;
			if (a.minor !== b.minor) return b.minor - a.minor;
			return b.patch - a.patch;
		});
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
	// If both have dates, sort by date descending (newest first)
	if (a.date && b.date) {
		const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
		if (dateCompare !== 0) return dateCompare;
	}

	// Fall back to semantic version comparison (newest first)
	const vA = parseVersion(a.version);
	const vB = parseVersion(b.version);
	if (vA && vB) {
		if (vA.major !== vB.major) return vB.major - vA.major;
		if (vA.minor !== vB.minor) return vB.minor - vA.minor;
		return vB.patch - vA.patch;
	}

	// Last resort: string comparison
	return b.version.localeCompare(a.version);
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
