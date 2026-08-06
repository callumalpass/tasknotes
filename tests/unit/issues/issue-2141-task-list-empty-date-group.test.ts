import {
	convertBasesGroupKeyToString,
	convertBasesValueToNative,
} from "../../../src/bases/basesValueConversion";

describe("Issue #2141: Task List empty date group labels", () => {
	it("does not render Bases empty date group placeholders as raw icon objects", () => {
		const emptyDatePlaceholder = {
			icon: "lucide-file-question",
		};

		expect(convertBasesValueToNative(emptyDatePlaceholder)).toBeNull();
		expect(
			convertBasesGroupKeyToString(emptyDatePlaceholder)
		).toBe("None");
	});
});
