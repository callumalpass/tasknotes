import {
	createTaskModalBlockedByField,
	createTaskModalBlockingField,
	createTaskModalListField,
	createTaskModalProjectsField,
	createTaskModalSubtasksField,
	type TaskModalOrganizationFieldContext,
} from "../../../src/modals/taskModalOrganizationFields";

function createContext(): TaskModalOrganizationFieldContext {
	return {
		translate: (key) => `translated:${key}`,
	};
}

describe("taskModalOrganizationFields", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("creates a generic list field with ghost button styling and a reusable list element", () => {
		const container = document.createElement("div");
		const existingList = document.createElement("div");
		const onButtonClick = jest.fn();

		const list = createTaskModalListField(container, {
			label: "Projects",
			buttonText: "Add project",
			buttonTooltip: "Choose a project",
			onButtonClick,
			listElement: existingList,
		});

		const button = container.querySelector<HTMLButtonElement>("button");
		expect(list).toBe(existingList);
		expect(container.textContent).toContain("Projects");
		expect(button?.textContent).toBe("Add project");
		expect(button?.title).toBe("Choose a project");
		expect(button?.classList.contains("tn-btn")).toBe(true);
		expect(button?.classList.contains("tn-btn--ghost")).toBe(true);

		button?.click();
		expect(onButtonClick).toHaveBeenCalledTimes(1);
	});

	it("creates the projects field with translated copy and a new list element", () => {
		const container = document.createElement("div");
		const onButtonClick = jest.fn();

		const list = createTaskModalProjectsField(createContext(), {
			container,
			onButtonClick,
		});

		const button = container.querySelector<HTMLButtonElement>("button");
		expect(list.classList.contains("task-projects-list")).toBe(true);
		expect(container.textContent).toContain("translated:modals.task.organization.projects");
		expect(button?.textContent).toBe(
			"translated:modals.task.organization.addToProjectButton"
		);
		expect(button?.title).toBe("translated:modals.task.projectsTooltip");

		button?.click();
		expect(onButtonClick).toHaveBeenCalledTimes(1);
	});

	it("creates the subtasks field with translated copy and preserves existing lists", () => {
		const container = document.createElement("div");
		const existingList = document.createElement("div");
		const onButtonClick = jest.fn();

		const list = createTaskModalSubtasksField(createContext(), {
			container,
			onButtonClick,
			listElement: existingList,
		});

		const button = container.querySelector<HTMLButtonElement>("button");
		expect(list).toBe(existingList);
		expect(container.textContent).toContain("translated:modals.task.organization.subtasks");
		expect(button?.textContent).toBe(
			"translated:modals.task.organization.addSubtasksButton"
		);
		expect(button?.title).toBe("translated:modals.task.organization.addSubtasksTooltip");

		button?.click();
		expect(onButtonClick).toHaveBeenCalledTimes(1);
	});

	it("creates the blocked-by dependency field with translated copy", () => {
		const container = document.createElement("div");
		const onButtonClick = jest.fn();

		const list = createTaskModalBlockedByField(createContext(), {
			container,
			onButtonClick,
		});

		const button = container.querySelector<HTMLButtonElement>("button");
		expect(list.classList.contains("task-projects-list")).toBe(true);
		expect(container.textContent).toContain("translated:modals.task.dependencies.blockedBy");
		expect(button?.textContent).toBe("translated:modals.task.dependencies.addTaskButton");
		expect(button?.title).toBe("translated:modals.task.dependencies.selectTaskTooltip");

		button?.click();
		expect(onButtonClick).toHaveBeenCalledTimes(1);
	});

	it("creates the blocking dependency field with translated copy and preserves existing lists", () => {
		const container = document.createElement("div");
		const existingList = document.createElement("div");
		const onButtonClick = jest.fn();

		const list = createTaskModalBlockingField(createContext(), {
			container,
			onButtonClick,
			listElement: existingList,
		});

		const button = container.querySelector<HTMLButtonElement>("button");
		expect(list).toBe(existingList);
		expect(container.textContent).toContain("translated:modals.task.dependencies.blocking");
		expect(button?.textContent).toBe("translated:modals.task.dependencies.addTaskButton");
		expect(button?.title).toBe("translated:modals.task.dependencies.selectTaskTooltip");

		button?.click();
		expect(onButtonClick).toHaveBeenCalledTimes(1);
	});
});
