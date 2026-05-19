import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import type { PriorityConfig } from "../../../src/types";
import type { NLPTriggersConfig } from "../../../src/types/settings";

const PRIORITIES: PriorityConfig[] = [
	{ id: "low", value: "2-low", label: "Low", color: "#00aa00", weight: 1 },
	{ id: "normal", value: "3-norm", label: "Normal", color: "#ffaa00", weight: 2 },
	{ id: "high", value: "5-high", label: "High", color: "#ff0000", weight: 3 },
];

const NLP_TRIGGERS: NLPTriggersConfig = {
	triggers: [{ propertyId: "priority", trigger: "!", enabled: true }],
};

function createParser(): NaturalLanguageParser {
	return new NaturalLanguageParser([], PRIORITIES, true, "en", NLP_TRIGGERS);
}

describe("issue #1906 custom priority NLP shortcut values", () => {
	it("removes the full shortcut value when the label appears inside the value", () => {
		const lowResult = createParser().parseInput("test !2-low");
		const highResult = createParser().parseInput("test !5-high");

		expect(lowResult.priority).toBe("2-low");
		expect(lowResult.title).toBe("test");
		expect(highResult.priority).toBe("5-high");
		expect(highResult.title).toBe("test");
	});

	it("keeps existing label-only priority parsing working", () => {
		const result = createParser().parseInput("test high");

		expect(result.priority).toBe("5-high");
		expect(result.title).toBe("test");
	});

	it("removes a disabled priority shortcut character left by autocomplete values", () => {
		const parser = new NaturalLanguageParser([], PRIORITIES, true, "en", {
			triggers: [{ propertyId: "priority", trigger: "!", enabled: false }],
		});

		const result = parser.parseInput("test !3-norm");

		expect(result.priority).toBe("3-norm");
		expect(result.title).toBe("test");
	});
});
