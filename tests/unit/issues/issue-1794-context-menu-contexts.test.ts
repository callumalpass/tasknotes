import {
	addContextToList,
	removeContextFromList,
	toggleContextInList,
} from "../../../src/components/TaskContextMenu";

describe("Issue #1794: context menu context updates", () => {
	it("adds a new context without changing existing contexts", () => {
		expect(addContextToList(["home"], "work")).toEqual(["home", "work"]);
	});

	it("does not duplicate an existing context", () => {
		expect(addContextToList(["home", "work"], "work")).toEqual(["home", "work"]);
	});

	it("trims context input before adding it", () => {
		expect(addContextToList(["home"], "  work  ")).toEqual(["home", "work"]);
	});

	it("removes the selected context and clears the field when the list becomes empty", () => {
		expect(removeContextFromList(["work"], "work")).toBeUndefined();
	});

	it("toggles known contexts on and off", () => {
		expect(toggleContextInList(["home"], "work")).toEqual(["home", "work"]);
		expect(toggleContextInList(["home", "work"], "work")).toEqual(["home"]);
	});
});
