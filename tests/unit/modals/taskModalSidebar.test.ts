import { setIcon } from "obsidian";
import {
	createTaskModalPropertySections,
	createTaskModalSidebarOrgSection,
	type TaskModalSidebarRowSpec,
} from "../../../src/modals/taskModalSidebar";

jest.mock("obsidian", () => ({
	setIcon: jest.fn((element: HTMLElement) => {
		element.textContent = "icon";
	}),
}));

function installObsidianElementPolyfills(): void {
	const proto = HTMLElement.prototype as typeof HTMLElement.prototype & {
		createDiv?: (cls?: string) => HTMLElement;
	};

	proto.createDiv ??= function createDiv(this: HTMLElement, cls?: string) {
		const element = document.createElement("div");
		if (cls) element.className = cls;
		this.appendChild(element);
		return element;
	};
}

function makeRow(id: string): TaskModalSidebarRowSpec {
	return {
		id,
		iconName: "dot-square",
		label: id,
		value: id,
		hasValue: true,
		onClick: jest.fn(),
	};
}

describe("createTaskModalSidebarOrgSection", () => {
	beforeAll(() => {
		installObsidianElementPolyfills();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("renders the organization list directly under its sidebar row", () => {
		const container = document.createElement("div");
		const { section, row, listElement } = createTaskModalSidebarOrgSection(
			container,
			makeRow("subtasks")
		);

		expect(section.className).toBe("tn-task-modal__sidebar-section");
		expect(section.children[0]).toBe(row);
		expect(section.children[1]).toBe(listElement);
		expect(listElement.classList.contains("tn-task-modal__org-list")).toBe(true);
	});
});

describe("createTaskModalPropertySections", () => {
	beforeAll(() => {
		installObsidianElementPolyfills();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("renders all property rows in one mobile group card", () => {
		const container = document.createElement("div");
		createTaskModalPropertySections({
			container,
			groups: [[makeRow("status"), makeRow("priority")], [makeRow("contexts")]],
		});

		expect(container.querySelectorAll(".tn-task-modal__mobile-group")).toHaveLength(1);
		expect(container.querySelectorAll(".tn-task-modal__sidebar-row")).toHaveLength(3);
	});

	it("inserts a full-width divider element between every row", () => {
		const container = document.createElement("div");
		createTaskModalPropertySections({
			container,
			groups: [[makeRow("status"), makeRow("priority")], [makeRow("contexts")]],
		});

		const card = container.querySelector(".tn-task-modal__mobile-group");
		expect(card).not.toBeNull();
		expect(card?.querySelectorAll(".tn-task-modal__sidebar-row-divider")).toHaveLength(2);
		expect(card?.children[1]?.classList.contains("tn-task-modal__sidebar-row-divider")).toBe(
			true
		);
		expect(card?.children[3]?.classList.contains("tn-task-modal__sidebar-row-divider")).toBe(
			true
		);
	});

	it("does not render a divider before the first row", () => {
		const container = document.createElement("div");
		createTaskModalPropertySections({
			container,
			groups: [[makeRow("status")]],
		});

		const card = container.querySelector(".tn-task-modal__mobile-group");
		expect(card?.firstElementChild?.classList.contains("tn-task-modal__sidebar-row")).toBe(
			true
		);
		expect(card?.querySelector(".tn-task-modal__sidebar-row-divider")).toBeNull();
	});

	it("returns an empty wrapper when no rows are visible", () => {
		const container = document.createElement("div");
		const wrapper = createTaskModalPropertySections({
			container,
			groups: [[], []],
		});

		expect(wrapper.className).toBe("tn-task-modal__mobile-sections");
		expect(wrapper.querySelector(".tn-task-modal__mobile-group")).toBeNull();
		expect(setIcon).not.toHaveBeenCalled();
	});
});
