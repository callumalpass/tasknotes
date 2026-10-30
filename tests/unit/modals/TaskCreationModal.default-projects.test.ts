import { TFile } from "obsidian";
import { TaskCreationModal } from "../../../src/modals/TaskCreationModal";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";

describe("creation default project provenance (#2436)", () => {
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
		const modal = new TaskCreationModal(app, plugin, projects === undefined ? {} : {
			prePopulatedValues: { projects },
		});
		await modal.initializeFormData();
		const state = modal as any;
		state.renderProjectsList = jest.fn();
		return state;
	}

	it("keeps defaults when no project is specified", async () => {
		const modal = await create();
		expect(modal.buildTaskData().projects).toEqual(["[[Homework]]", "[[School]]"]);
	});

	it("replaces all preloaded defaults with multiple NLP projects", async () => {
		const modal = await create();
		modal.addProjectsFromStrings(["[[Personal Projects]]", "[[Errands]]"]);
		expect(modal.buildTaskData().projects).toEqual(["[[Personal Projects]]", "[[Errands]]"]);
	});

	it("preserves the legacy additive behavior when disabled", async () => {
		plugin.settings.taskCreationDefaults.defaultProjectsOnlyWhenEmpty = false;
		const modal = await create();
		modal.addProjectsFromStrings(["[[Personal Projects]]"]);
		expect(modal.buildTaskData().projects).toEqual(["[[Homework]]", "[[School]]", "[[Personal Projects]]"]);
	});

	it.each(["[[Parent]]", "[[Homework]]"])("preserves prepopulated project %s", async (project) => {
		const modal = await create([project]);
		modal.addProjectsFromStrings(["[[Personal Projects]]"]);
		expect(modal.buildTaskData().projects).toEqual([project, "[[Personal Projects]]"]);
	});

	it("preserves an explicitly empty prepopulation", async () => {
		const modal = await create([]);
		expect(modal.selectedProjectItems).toEqual([]);
		expect(modal.buildTaskData().projects).toBeUndefined();
	});

	it("does not clear defaults for empty NLP project input", async () => {
		const modal = await create();
		modal.addProjectsFromStrings([]);
		expect(modal.buildTaskData().projects).toEqual(["[[Homework]]", "[[School]]"]);
	});

	it("keeps an explicitly chosen default without restoring the others", async () => {
		const modal = await create();
		modal.addProjectsFromStrings(["[[Homework]]"]);
		modal.addProjectsFromStrings(["[[Personal Projects]]"]);
		expect(modal.buildTaskData().projects).toEqual(["[[Homework]]", "[[Personal Projects]]"]);
	});

	it("replaces defaults through the file picker and keeps later NLP selections", async () => {
		const modal = await create();
		const file = new TFile();
		Object.assign(file, { path: "Personal Projects.md", basename: "Personal Projects" });
		modal.buildProjectReference = () => "[[Personal Projects]]";
		modal.addProject(file);
		modal.addProjectsFromStrings(["[[Errands]]"]);
		expect(modal.buildTaskData().projects).toEqual(["[[Personal Projects]]", "[[Errands]]"]);
	});

	it("does not restore defaults after the user removes the explicit project", async () => {
		const modal = await create();
		modal.addProjectsFromStrings(["[[Personal Projects]]"]);
		modal.removeProject(modal.selectedProjectItems[0]);
		modal.addProjectsFromStrings([]);
		expect(modal.selectedProjectItems).toEqual([]);
		expect(modal.buildTaskData().projects).toBeUndefined();
	});

	it("resets default provenance when initializing a fresh form", async () => {
		const modal = await create();
		modal.addProjectsFromStrings(["[[Personal Projects]]"]);
		await modal.initializeFormData();
		modal.addProjectsFromStrings(["[[Errands]]"]);
		expect(modal.buildTaskData().projects).toEqual(["[[Errands]]"]);
	});
});
