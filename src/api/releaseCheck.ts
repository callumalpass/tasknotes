import { requestUrl, requireApiVersion } from "obsidian";

export const TASKNOTES_RELEASE_MANIFEST_URL =
	"https://github.com/callumalpass/tasknotes/releases/latest/download/manifest.json";
export const TASKNOTES_VERSIONS_URL =
	"https://raw.githubusercontent.com/callumalpass/tasknotes/main/versions.json";
export const TASKNOTES_COMMUNITY_PLUGIN_URL = "obsidian://show-plugin?id=tasknotes";

interface PluginManifest {
	version?: string;
	minAppVersion?: string;
}

type VersionsManifest = Record<string, string>;

interface ParsedVersion {
	numbers: number[];
	prerelease: string[];
}

function parseVersion(version: string): ParsedVersion {
	const [mainPart, prereleasePart = ""] = version.trim().split("-", 2);
	const numbers = mainPart.split(".").map((part) => {
		const parsed = Number.parseInt(part, 10);
		return Number.isFinite(parsed) ? parsed : 0;
	});

	return {
		numbers,
		prerelease: prereleasePart ? prereleasePart.split(".") : [],
	};
}

function comparePrereleaseIdentifier(left: string, right: string): number {
	const leftNumber = Number.parseInt(left, 10);
	const rightNumber = Number.parseInt(right, 10);
	const leftIsNumber = String(leftNumber) === left;
	const rightIsNumber = String(rightNumber) === right;

	if (leftIsNumber && rightIsNumber) {
		return Math.sign(leftNumber - rightNumber);
	}
	if (leftIsNumber) {
		return -1;
	}
	if (rightIsNumber) {
		return 1;
	}
	return left.localeCompare(right);
}

export function compareVersions(left: string, right: string): number {
	const leftVersion = parseVersion(left);
	const rightVersion = parseVersion(right);
	const length = Math.max(leftVersion.numbers.length, rightVersion.numbers.length, 3);

	for (let index = 0; index < length; index++) {
		const difference = (leftVersion.numbers[index] ?? 0) - (rightVersion.numbers[index] ?? 0);
		if (difference !== 0) {
			return Math.sign(difference);
		}
	}

	if (leftVersion.prerelease.length === 0 && rightVersion.prerelease.length === 0) {
		return 0;
	}
	if (leftVersion.prerelease.length === 0) {
		return 1;
	}
	if (rightVersion.prerelease.length === 0) {
		return -1;
	}

	const prereleaseLength = Math.max(
		leftVersion.prerelease.length,
		rightVersion.prerelease.length
	);
	for (let index = 0; index < prereleaseLength; index++) {
		const leftIdentifier = leftVersion.prerelease[index];
		const rightIdentifier = rightVersion.prerelease[index];
		if (leftIdentifier === undefined) {
			return -1;
		}
		if (rightIdentifier === undefined) {
			return 1;
		}

		const comparison = comparePrereleaseIdentifier(leftIdentifier, rightIdentifier);
		if (comparison !== 0) {
			return comparison;
		}
	}

	return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function requestJson<T>(url: string): Promise<T> {
	const response = await requestUrl({ url, method: "GET" });
	return response.json as T;
}

function normalizeManifest(value: unknown): PluginManifest | null {
	if (!isRecord(value)) {
		return null;
	}

	const version = typeof value.version === "string" ? value.version.trim() : "";
	if (!version) {
		return null;
	}

	return {
		version,
		minAppVersion:
			typeof value.minAppVersion === "string" ? value.minAppVersion.trim() : undefined,
	};
}

function normalizeVersionsManifest(value: unknown): VersionsManifest {
	if (!isRecord(value)) {
		return {};
	}

	const versions: VersionsManifest = {};
	for (const [version, minAppVersion] of Object.entries(value)) {
		if (typeof minAppVersion === "string" && version.trim()) {
			versions[version] = minAppVersion;
		}
	}
	return versions;
}

export function getLatestCompatibleVersion(
	latestManifest: PluginManifest,
	versionsManifest: VersionsManifest,
	canRunMinAppVersion: (minAppVersion: string) => boolean = requireApiVersion
): string | null {
	if (!latestManifest.minAppVersion || canRunMinAppVersion(latestManifest.minAppVersion)) {
		return latestManifest.version ?? null;
	}

	const compatibleVersions = Object.entries(versionsManifest)
		.filter(([, minAppVersion]) => canRunMinAppVersion(minAppVersion))
		.map(([version]) => version)
		.sort(compareVersions);

	return compatibleVersions[compatibleVersions.length - 1] ?? null;
}

export function shouldNotifyForRelease(
	currentVersion: string,
	availableVersion: string | null,
	lastNotifiedReleaseVersion: string | undefined
): availableVersion is string {
	if (!availableVersion) {
		return false;
	}
	if (compareVersions(availableVersion, currentVersion) <= 0) {
		return false;
	}
	return lastNotifiedReleaseVersion !== availableVersion;
}

export async function getAvailableTaskNotesReleaseVersion(): Promise<string | null> {
	const latestManifest = normalizeManifest(
		await requestJson<unknown>(TASKNOTES_RELEASE_MANIFEST_URL)
	);
	if (!latestManifest) {
		return null;
	}

	if (!latestManifest.minAppVersion || requireApiVersion(latestManifest.minAppVersion)) {
		return latestManifest.version ?? null;
	}

	const versionsManifest = normalizeVersionsManifest(
		await requestJson<unknown>(TASKNOTES_VERSIONS_URL)
	);
	return getLatestCompatibleVersion(latestManifest, versionsManifest);
}
