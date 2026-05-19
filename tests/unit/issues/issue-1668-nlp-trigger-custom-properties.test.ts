import type { App } from "obsidian";
import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import { DEFAULT_PRIORITIES, DEFAULT_SETTINGS, DEFAULT_STATUSES } from "../../../src/settings/defaults";
import type { NLPTriggersConfig, UserMappedField } from "../../../src/types/settings";
import type TaskNotesPlugin from "../../../src/main";
import { buildTaskCreationDataFromParsed } from "../../../src/services/buildTaskCreationDataFromParsed";
import { TaskModal } from "../../../src/modals/TaskModal";
import { MockObsidian } from "../../__mocks__/obsidian";

jest.mock("obsidian");

const USER_FIELDS: UserMappedField[] = [
	{ id: "system", key: "system", displayName: "System", type: "text" },
	{ id: "useCase", key: "use_case", displayName: "Use Case", type: "text" },
];

const NLP_TRIGGERS: NLPTriggersConfig = {
	triggers: [
		{ propertyId: "system", trigger: "&", enabled: true },
		{ propertyId: "useCase", trigger: "^", enabled: true },
	],
};

function createParser(): NaturalLanguageParser {
	return new NaturalLanguageParser(
		DEFAULT_STATUSES,
		DEFAULT_PRIORITIES,
		true,
		"en",
		NLP_TRIGGERS,
		USER_FIELDS
	);
}

function createPlugin(userFields: UserMappedField[] = USER_FIELDS): TaskNotesPlugin {
	return {
		app: MockObsidian.createMockApp(),
		settings: {
			...DEFAULT_SETTINGS,
			userFields,
		},
		i18n: {
			translate: (key: string) => key,
		},
	} as unknown as TaskNotesPlugin;
}

class UserFieldModalHarness extends TaskModal {
	async initializeFormData(): Promise<void> {}
	async handleSave(): Promise<void> {}
	getModalTitle(): string {
		return "Harness";
	}

	attachInput(key: string, input: HTMLInputElement): void {
		this.userFieldInputs.set(key, input);
	}

	setUserFieldValue(key: string, value: unknown): void {
		this.userFields[key] = value;
	}

	syncUserFieldControls(): void {
		this.updateUserFieldControls();
	}
}

describe("Issue #1668: NLP trigger custom properties", () => {
	it("maps custom trigger values from parser field IDs to task frontmatter keys", () => {
		const parsed = createParser().parseInput("Fix login bug &backend ^authentication");

		expect(parsed.title).toBe("Fix login bug");
		expect(parsed.userFields).toEqual({
			system: "backend",
			useCase: "authentication",
		});

		const taskData = buildTaskCreationDataFromParsed(createPlugin(), parsed);

		expect(taskData.customFrontmatter).toEqual({
			system: "backend",
			use_case: "authentication",
		});
	});

	it("synchronizes already-rendered custom field inputs after NLP fills modal state", () => {
		const app = MockObsidian.createMockApp() as unknown as App;
		const modal = new UserFieldModalHarness(app, createPlugin());
		const systemInput = document.createElement("input");
		const useCaseInput = document.createElement("input");

		modal.attachInput("system", systemInput);
		modal.attachInput("use_case", useCaseInput);
		modal.setUserFieldValue("system", "backend");
		modal.setUserFieldValue("use_case", "authentication");

		modal.syncUserFieldControls();

		expect(systemInput.value).toBe("backend");
		expect(useCaseInput.value).toBe("authentication");
	});
});
