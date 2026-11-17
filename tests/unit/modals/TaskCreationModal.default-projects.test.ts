import { TFile } from "obsidian";
import { TaskCreationModal } from "../../../src/modals/TaskCreationModal";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";

describe("default projects only when no project is specified (#2436)", () => {
	let app: any;
	let plugin: any;

	beforeEach(() => {
		MockObsidian.reset();
		app = MockObsidian.createMockApp();
		plugin = {
			app,
			settings: {
				...DEFAULT_SETTINGS,
				taskCreationDefaults: {
					...DEFAULT_SETTINGS.taskCreationDefaults,
					defaultProjects: "[[Homework]], [[School]]",
					defaultProjectsOnlyWhenEmpty: true,
				},
			},
		};
	});

	async function create(projects?: string[]) {
		const modal = new TaskCreationModal(
			app,
			plugin,
			projects === undefined ? {} : { prePopulatedValues: { projects } }
		) as any;
		await modal.initializeFormData();
		modal.renderProjectsList = jest.fn();
		return modal;
	}

	it("swaps the defaults for typed projects and restores them when the text is removed", async () => {
		const modal = await create();
		expect(modal.buildTaskData().projects).toEqual(["[[Homework]]", "[[School]]"]);

		modal.syncNaturalLanguageProjects(["[[Personal]]"]);
		expect(modal.buildTaskData().projects).toEqual(["[[Personal]]"]);

		modal.syncNaturalLanguageProjects([]);
		expect(modal.buildTaskData().projects).toEqual(["[[Homework]]", "[[School]]"]);
	});

	it("keeps adding typed projects to the defaults when the setting is off", async () => {
		plugin.settings.taskCreationDefaults.defaultProjectsOnlyWhenEmpty = false;
		const modal = await create();
		modal.syncNaturalLanguageProjects(["[[Personal]]"]);
		expect(modal.buildTaskData().projects).toEqual(["[[Homework]]", "[[School]]", "[[Personal]]"]);
	});

	it("drops the defaults for good once a project is picked", async () => {
		const modal = await create();
		const file = new TFile();
		file.path = "Errands.md";
		file.basename = "Errands";
		modal.buildProjectReference = () => "[[Errands]]";
		modal.addProject(file);
		modal.syncNaturalLanguageProjects(["[[Personal]]"]);
		modal.syncNaturalLanguageProjects([]);
		expect(modal.buildTaskData().projects).toEqual(["[[Errands]]"]);
	});

	it("does not treat projects supplied by the caller as defaults", async () => {
		const modal = await create(["[[Homework]]"]);
		modal.syncNaturalLanguageProjects(["[[Personal]]"]);
		expect(modal.buildTaskData().projects).toEqual(["[[Homework]]", "[[Personal]]"]);
	});
});
