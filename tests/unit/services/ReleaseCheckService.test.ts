import { describe, expect, it } from "@jest/globals";
import {
	compareVersions,
	getLatestCompatibleVersion,
	shouldNotifyForRelease,
} from "../../../src/api/releaseCheck";

describe("ReleaseCheckService", () => {
	describe("compareVersions", () => {
		it("orders standard semantic versions", () => {
			expect(compareVersions("4.10.1", "4.10.0")).toBe(1);
			expect(compareVersions("4.9.2", "4.10.0")).toBe(-1);
			expect(compareVersions("4.10.0", "4.10.0")).toBe(0);
		});

		it("orders prereleases below final releases", () => {
			expect(compareVersions("4.0.0-beta.1", "4.0.0-beta.0")).toBe(1);
			expect(compareVersions("4.0.0-beta.1", "4.0.0")).toBe(-1);
			expect(compareVersions("4.0.0", "4.0.0-beta.1")).toBe(1);
		});
	});

	describe("getLatestCompatibleVersion", () => {
		it("uses the latest manifest version when the current Obsidian app can run it", () => {
			expect(
				getLatestCompatibleVersion(
					{ version: "4.10.1", minAppVersion: "1.12.2" },
					{ "4.9.2": "1.12.2" },
					() => true
				)
			).toBe("4.10.1");
		});

		it("falls back to the highest compatible versions.json entry", () => {
			expect(
				getLatestCompatibleVersion(
					{ version: "4.11.0", minAppVersion: "1.13.0" },
					{
						"4.8.0": "1.12.2",
						"4.10.0": "1.12.2",
						"4.11.0": "1.13.0",
					},
					(minAppVersion) => minAppVersion !== "1.13.0"
				)
			).toBe("4.10.0");
		});
	});

	describe("shouldNotifyForRelease", () => {
		it("notifies once for a newer version", () => {
			expect(shouldNotifyForRelease("4.10.0", "4.10.1", undefined)).toBe(true);
			expect(shouldNotifyForRelease("4.10.0", "4.10.1", "4.10.1")).toBe(false);
		});

		it("does not notify for current or older versions", () => {
			expect(shouldNotifyForRelease("4.10.0", "4.10.0", undefined)).toBe(false);
			expect(shouldNotifyForRelease("4.10.0", "4.9.2", undefined)).toBe(false);
			expect(shouldNotifyForRelease("4.10.0", null, undefined)).toBe(false);
		});
	});
});
