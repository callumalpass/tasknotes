/**
 * Issue #1380: task context menus should be able to add/remove tags without
 * exposing the identifying task tag as a destructive menu target.
 */

import {
	addTagsToList,
	clearEditableTagsFromList,
	getEditableTaskTags,
	parseTaskTagInput,
	removeTagsFromList,
} from "../../../src/utils/taskTagList";

const tagSettings = {
	taskIdentificationMethod: "tag",
	taskTag: "task",
};

describe("Issue #1380: context-menu tag list helpers", () => {
	it("normalizes typed tags and strips hash prefixes", () => {
		expect(parseTaskTagInput(" #next, inbox, , #waiting ")).toEqual([
			"next",
			"inbox",
			"waiting",
		]);
	});

	it("adds typed tags without duplicating existing tags", () => {
		expect(addTagsToList(["task", "next"], ["#next", "waiting"])).toEqual([
			"task",
			"next",
			"waiting",
		]);
	});

	it("removes only the selected tag", () => {
		expect(removeTagsFromList(["task", "next", "waiting"], ["#next"])).toEqual([
			"task",
			"waiting",
		]);
	});

	it("hides the identifying task tag from editable menu tags", () => {
		expect(getEditableTaskTags({ tags: ["task", "next"] }, tagSettings)).toEqual(["next"]);
	});

	it("preserves the identifying task tag when clearing editable tags", () => {
		expect(clearEditableTagsFromList(["task", "next", "waiting"], tagSettings)).toEqual([
			"task",
		]);
	});
});
