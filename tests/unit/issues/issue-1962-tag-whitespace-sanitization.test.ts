import {
	mapTaskFromFrontmatter,
	mapTaskToFrontmatter,
} from "../../../src/core/fieldMapping";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import { sanitizeTags } from "../../../src/utils/helpers";
import { getFrontmatterTags } from "../../../src/utils/taskIdentificationFrontmatter";

describe("issue #1962 tag whitespace sanitization", () => {
	it("normalizes spaces in comma-separated tag input", () => {
		expect(sanitizeTags("#abc xyz, multi   word, keep/tag")).toBe(
			"abc-xyz, multi-word, keep/tag"
		);
	});

	it("normalizes spaces when reading frontmatter tags", () => {
		expect(getFrontmatterTags(["#abc xyz", "multi   word", "keep/tag"])).toEqual([
			"abc-xyz",
			"multi-word",
			"keep/tag",
		]);
	});

	it("normalizes spaces before writing frontmatter tags", () => {
		const frontmatter = mapTaskToFrontmatter(
			DEFAULT_FIELD_MAPPING,
			{
				title: "Spaced tags",
				tags: ["abc xyz", "#multi   word"],
			},
			"task"
		);

		expect(frontmatter.tags).toEqual(["abc-xyz", "multi-word", "task"]);
	});

	it("maps existing spaced frontmatter tags to normalized task tags", () => {
		const task = mapTaskFromFrontmatter(
			DEFAULT_FIELD_MAPPING,
			{
				title: "Spaced tags",
				tags: ["abc xyz", "#multi   word"],
			},
			"Tasks/Spaced tags.md",
			true
		);

		expect(task.tags).toEqual(["abc-xyz", "multi-word"]);
	});
});
