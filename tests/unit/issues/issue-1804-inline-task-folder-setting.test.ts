import { renderGeneralTab } from "../../../src/settings/tabs/generalTab";
import { configureTextSetting } from "../../../src/settings/components/settingHelpers";
import type TaskNotesPlugin from "../../../src/main";

jest.mock("../../../src/settings/components/settingHelpers", () => ({
	createSettingGroup: jest.fn(
		(
			_container: HTMLElement,
			options: { heading: string },
			addSettings: (group: { addSetting: (callback: (setting: unknown) => void) => unknown }) => void
		) => {
			const group = {
				addSetting: jest.fn((callback: (setting: unknown) => void) => {
					callback({});
					return group;
				}),
			};

			if (options.heading === "settings.general.taskStorage.header") {
				addSettings(group);
			}

			return group;
		}
	),
	configureTextSetting: jest.fn((setting: unknown) => setting),
	configureToggleSetting: jest.fn((setting: unknown) => setting),
	configureDropdownSetting: jest.fn((setting: unknown) => setting),
}));

function createPlugin(enableInstantTaskConvert: boolean): TaskNotesPlugin {
	return {
		settings: {
			enableInstantTaskConvert,
			inlineTaskConvertFolder: "{{currentNotePath}}",
			tasksFolder: "TaskNotes/Tasks",
			moveArchivedTasks: false,
			taskIdentificationMethod: "tag",
			commandFileMapping: {},
			autoCreateDefaultBasesFiles: false,
			excludedFolders: "",
			uiLanguage: "system",
			showReleaseNotesOnUpdate: true,
		},
		i18n: {
			translate: jest.fn((key: string) => key),
			getAvailableLocales: jest.fn(() => []),
			getNativeLanguageName: jest.fn((code: string) => code),
		},
		app: {
			vault: {
				getConfig: jest.fn(() => false),
			},
		},
		manifest: {
			version: "0.0.0",
		},
	} as unknown as TaskNotesPlugin;
}

describe("issue #1804 inline task folder setting", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("keeps the inline-created task folder setting visible when instant conversion is disabled", () => {
		const container = document.createElement("div");

		renderGeneralTab(container, createPlugin(false), jest.fn());

		const inlineFolderCall = (configureTextSetting as jest.Mock).mock.calls.find(
			([, options]) => options.name === "settings.features.instantConvert.folder.name"
		);

		expect(inlineFolderCall).toBeDefined();
		expect(inlineFolderCall[1].getValue()).toBe("{{currentNotePath}}");
	});

	it("still shows the same setting when instant conversion is enabled", () => {
		const container = document.createElement("div");

		renderGeneralTab(container, createPlugin(true), jest.fn());

		const inlineFolderCalls = (configureTextSetting as jest.Mock).mock.calls.filter(
			([, options]) => options.name === "settings.features.instantConvert.folder.name"
		);

		expect(inlineFolderCalls).toHaveLength(1);
	});
});
