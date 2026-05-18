import {
	buildCustomFrontmatter,
	getUserFieldChanges,
	isTruthyUserFieldValue,
	isUserFieldValueDifferent,
	parseListUserFieldInput,
	parseNullableListUserFieldInput,
	parseNullableTextUserFieldInput,
	parseNumberUserFieldInput,
	userFieldValueToInputString,
	userFieldValueToString,
} from "../../../src/modals/taskModalUserFields";

describe("TaskModal - User Fields Integration", () => {
	it("should build custom frontmatter correctly from user fields", () => {
		const userFields = {
			assignee: "John Doe",
			priority_level: 5,
			is_completed: true,
			custom_tags: ["urgent", "review"],
			empty_field: null,
			undefined_field: undefined,
			empty_string: "",
		};

		const customFrontmatter = buildCustomFrontmatter(userFields);

		expect(customFrontmatter).toEqual({
			assignee: "John Doe",
			priority_level: 5,
			is_completed: true,
			custom_tags: ["urgent", "review"],
		});

		expect(customFrontmatter).not.toHaveProperty("empty_field");
		expect(customFrontmatter).not.toHaveProperty("undefined_field");
		expect(customFrontmatter).not.toHaveProperty("empty_string");
	});

	it("should detect user field changes correctly", () => {
		expect(isUserFieldValueDifferent("new", "old")).toBe(true);
		expect(isUserFieldValueDifferent("same", "same")).toBe(false);
		expect(isUserFieldValueDifferent(null, undefined)).toBe(false);
		expect(isUserFieldValueDifferent("", null)).toBe(false);
		expect(isUserFieldValueDifferent(["a", "b"], ["a", "b"])).toBe(false);
		expect(isUserFieldValueDifferent(["a", "b"], ["b", "a"])).toBe(true);
		expect(isUserFieldValueDifferent(5, "5")).toBe(true);
		expect(isUserFieldValueDifferent(true, "true")).toBe(true);
	});

	it("should build edit changes for configured user fields only", () => {
		expect(
			getUserFieldChanges(
				{
					assignee: "Ada",
					priority_level: null,
					ignored: "not configured",
					unchanged: "same",
					cleared: undefined,
				},
				{
					assignee: "Grace",
					priority_level: 5,
					unchanged: "same",
					cleared: "old",
				},
				[
					{ key: "assignee" },
					{ key: "priority_level" },
					{ key: "unchanged" },
					{ key: "cleared" },
				]
			)
		).toEqual({
			assignee: "Ada",
			priority_level: null,
			cleared: null,
		});
	});

	it("should normalize user field values for modal controls", () => {
		expect(userFieldValueToString(["alpha", 2, true])).toBe("alpha, 2, true");
		expect(userFieldValueToInputString(["alpha", "beta"])).toBe("alpha, beta");
		expect(parseListUserFieldInput(" alpha, , beta ")).toEqual(["alpha", "beta"]);
		expect(parseNullableListUserFieldInput(" , ")).toBeNull();
		expect(parseNumberUserFieldInput("4.5")).toBe(4.5);
		expect(parseNumberUserFieldInput("not a number")).toBeNull();
		expect(parseNullableTextUserFieldInput("")).toBeNull();
		expect(parseNullableTextUserFieldInput("value")).toBe("value");
		expect(isTruthyUserFieldValue(true)).toBe(true);
		expect(isTruthyUserFieldValue("true")).toBe(true);
		expect(isTruthyUserFieldValue("false")).toBe(false);
	});

	it("should handle user field value collection for autocomplete", () => {
		const mockFiles = [
			{ path: "task1.md" },
			{ path: "task2.md" },
			{ path: "task3.md" },
		];

		const mockMetadata = {
			"task1.md": { frontmatter: { assignee: "John Doe", priority: 5 } },
			"task2.md": { frontmatter: { assignee: "Jane Smith", priority: 3 } },
			"task3.md": { frontmatter: { assignee: "John Doe", status: "done" } },
		};

		// Simulate getExistingUserFieldValues logic
		const fieldKey = "assignee";
		const values = new Set<string>();

		for (const file of mockFiles) {
			const frontmatter = mockMetadata[file.path as keyof typeof mockMetadata]?.frontmatter;

			if (frontmatter && frontmatter[fieldKey] !== undefined) {
				const value = frontmatter[fieldKey];

				if (typeof value === "string" && value.trim()) {
					values.add(value.trim());
				}
			}
		}

		const result = Array.from(values).sort();
		expect(result).toEqual(["Jane Smith", "John Doe"]);
	});
});
