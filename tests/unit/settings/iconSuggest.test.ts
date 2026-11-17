import { iconSettingName, matchIconNames } from "../../../src/settings/components/IconSuggest";

describe("icon setting suggestions", () => {
	it("stores Lucide names without Obsidian's prefix", () => {
		expect(iconSettingName("lucide-activity")).toBe("activity");
		expect(iconSettingName("flag")).toBe("flag");
	});

	it("lists names that start with the query before names that contain it", () => {
		const names = ["flag-off", "red-flag", "flame", "flag"];
		expect(matchIconNames("fla", names)).toEqual(["flag", "flame", "flag-off", "red-flag"]);
		expect(matchIconNames("lucide-flag", names)).toEqual(["flag", "flag-off", "red-flag"]);
	});

	it("offers only installed starter icons for an empty query", () => {
		expect(matchIconNames("", ["flag", "not-a-starter"])).toEqual(["flag"]);
	});
});
