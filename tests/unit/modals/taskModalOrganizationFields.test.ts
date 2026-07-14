import {
	createTaskModalBlockedByField,
	createTaskModalBlockingField,
	createTaskModalProjectsField,
	createTaskModalSubtasksField,
	type TaskModalOrganizationFieldContext,
} from "../../../src/modals/taskModalOrganizationFields";

jest.mock("obsidian", () => ({
	setIcon: jest.fn((element: HTMLElement) => {
		element.textContent = "icon";
	}),
}));

function createContext(): TaskModalOrganizationFieldContext {
	return {
		translate: (key, params) =>
			params ? `${key}:${JSON.stringify(params)}` : `translated:${key}`,
	};
}

describe("taskModalOrganizationFields", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("creates an empty projects row with a sidebar row and chevron", () => {
		const container = document.createElement("div");
		const onButtonClick = jest.fn();

		const row = createTaskModalProjectsField(createContext(), {
			container,
			onButtonClick,
			getItemCount: () => 0,
		});

		const emptyRow = container.querySelector<HTMLElement>(
			".tn-task-modal__org-empty-row .tn-task-modal__sidebar-row"
		);
		expect(row.listElement.classList.contains("tn-task-modal__org-list")).toBe(true);
		expect(emptyRow?.querySelector(".tn-task-modal__sidebar-row-icon")).not.toBeNull();
		expect(emptyRow?.querySelector(".tn-task-modal__sidebar-row-chevron")).not.toBeNull();
		expect(emptyRow?.querySelector(".tn-task-modal__sidebar-row-label")?.textContent).toBe(
			"translated:modals.task.organization.projects"
		);
		expect(container.querySelector(".tn-task-modal__org-header")?.hasAttribute("hidden")).toBe(
			true
		);

		emptyRow?.click();
		expect(onButtonClick).toHaveBeenCalledTimes(1);
	});

	it("shows section title without a completion count when items exist", () => {
		const container = document.createElement("div");
		const row = createTaskModalProjectsField(createContext(), {
			container,
			onButtonClick: jest.fn(),
			getItemCount: () => 2,
		});

		row.updateHeader();

		expect(container.querySelector(".tn-task-modal__org-header-title")?.textContent).toBe(
			"translated:modals.task.organization.projects"
		);
		expect(container.querySelector(".tn-task-modal__org-header-count")).toBeNull();
	});

	it("shows section title and add button when items exist", () => {
		const container = document.createElement("div");
		const onButtonClick = jest.fn();
		const row = createTaskModalSubtasksField(createContext(), {
			container,
			onButtonClick,
			getItemCount: () => 3,
		});

		row.updateHeader();

		expect(container.querySelector(".tn-task-modal__org-empty-row")?.hidden).toBe(true);
		expect(container.querySelector(".tn-task-modal__org-header-title")?.textContent).toBe(
			"translated:modals.task.organization.subtasks"
		);
		expect(container.querySelector(".tn-task-modal__org-header-count")).toBeNull();

		const titleLabel = container.querySelector(".tn-task-modal__org-header-label");
		expect(titleLabel?.tagName).toBe("DIV");
		titleLabel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(onButtonClick).not.toHaveBeenCalled();

		container.querySelector<HTMLButtonElement>(".tn-task-modal__org-add-button")?.click();
		expect(onButtonClick).toHaveBeenCalledTimes(1);
	});

	it("creates blocked-by and blocking rows with translated section labels", () => {
		const blockedByContainer = document.createElement("div");
		const blockingContainer = document.createElement("div");

		createTaskModalBlockedByField(createContext(), {
			container: blockedByContainer,
			onButtonClick: jest.fn(),
			getItemCount: () => 0,
		});
		createTaskModalBlockingField(createContext(), {
			container: blockingContainer,
			onButtonClick: jest.fn(),
			getItemCount: () => 0,
		});

		expect(
			blockedByContainer.querySelector(".tn-task-modal__sidebar-row-label")?.textContent
		).toBe("translated:modals.task.dependencies.blockedBy");
		expect(
			blockingContainer.querySelector(".tn-task-modal__sidebar-row-label")?.textContent
		).toBe("translated:modals.task.dependencies.blocking");
	});
});
