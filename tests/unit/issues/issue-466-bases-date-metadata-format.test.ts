import { mapTaskToFrontmatter } from "../../../src/core/fieldMapping";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";

describe("Issue #466: Bases-compatible task metadata timestamps", () => {
	it("normalizes dateCreated and dateModified to datetime strings Bases can parse", () => {
		const frontmatter = mapTaskToFrontmatter(DEFAULT_FIELD_MAPPING, {
			title: "Timestamp metadata",
			status: "open",
			dateCreated: "2025-08-15T14:53:20.653+08:00",
			dateModified: "2025-08-15T14:53:20.653Z",
		});

		expect(frontmatter.dateCreated).toBe("2025-08-15T14:53:20");
		expect(frontmatter.dateModified).toBe("2025-08-15T14:53:20");
	});

	it("preserves already compatible datetime values", () => {
		const frontmatter = mapTaskToFrontmatter(DEFAULT_FIELD_MAPPING, {
			title: "Timestamp metadata",
			status: "open",
			dateCreated: "2025-08-15T14:53:20",
			dateModified: "2025-08-15T14:53:21",
		});

		expect(frontmatter.dateCreated).toBe("2025-08-15T14:53:20");
		expect(frontmatter.dateModified).toBe("2025-08-15T14:53:21");
	});
});
